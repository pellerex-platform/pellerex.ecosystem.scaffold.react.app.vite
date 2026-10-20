import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  getAccessToken,
  getUser,
  handleRedirectCallback,
  isAuthenticated,
  login,
  logout,
} from "./oidc";

// The tenant's identity provider, as env.js names it
const identityProviderSettings = vi.hoisted(() => ({
  oidcIssuer: "https://login.example.test/",
  oidcClientId: "shop-web",
  oidcAudience: "https://api.example.test",
  oidcRedirectUri: "https://app.example.test/callback",
}));

// The runtime settings stand in for that env.js; no page is read.
vi.mock("../config/env", () => ({ env: identityProviderSettings }));

const AUTHORIZATION_ENDPOINT = "https://login.example.test/authorize";
const TOKEN_ENDPOINT = "https://login.example.test/oauth/token";
const CODE_FROM_THE_PROVIDER = "code-from-the-provider";
const USER_ACCESS_TOKEN = "user-access-token";
const USER_EMAIL = "ada@example.test";
const APP_BASE_PATH = "/proxy/shop/staging";

// An id token for the user: an empty header and the payload, each base64url encoded with no
// padding, then a signature, which nothing checks, since the app reads the payload for display
// only. It is built from its JSON, so the repository holds no token-shaped text for the secret
// scan to stop on.
const ID_TOKEN = `e30.${btoa(JSON.stringify({ email: USER_EMAIL })).replace(/=+$/, "")}.signature`;

// The example of RFC 7636, appendix B: 32 random bytes, the code verifier they make, and the
// S256 code challenge of that verifier.
const RFC_7636_RANDOM_BYTES = new Uint8Array([
  116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77,
  105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
]);
const RFC_7636_CODE_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_7636_CODE_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

// The app signs the user in with the authorization code flow and PKCE, as a public client
// with no secret: the state it sends must come back unchanged, and the token is held only for
// as long as the identity provider said it lasts.
describe("signing in with the tenant's identity provider", () => {
  let fetchStandIn: Mock<typeof fetch>;
  let leavePageTo: Mock<(address: string) => void>;

  beforeEach(() => {
    // fetch stands in for the identity provider: nothing is sent. Discovery answers its two
    // addresses, and the code exchange answers tokens that last an hour.
    fetchStandIn = vi.fn<typeof fetch>(async (address) =>
      String(address).endsWith("/.well-known/openid-configuration")
        ? Response.json({
            authorization_endpoint: AUTHORIZATION_ENDPOINT,
            token_endpoint: TOKEN_ENDPOINT,
          })
        : Response.json({
            access_token: USER_ACCESS_TOKEN,
            id_token: ID_TOKEN,
            token_type: "Bearer",
            expires_in: 3600,
          }),
    );
    vi.stubGlobal("fetch", fetchStandIn);

    // The page and its session storage stand in as plain objects: the page is the app's, under
    // its proxy path, and leaving it is recorded, not done.
    leavePageTo = vi.fn();
    vi.stubGlobal("window", {
      location: { href: "https://app.example.test/", assign: leavePageTo },
      __PELLEREX_BASE_PATH__: APP_BASE_PATH,
    });
    const stored = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });

    // The random bytes are RFC 7636's, so the verifier and the challenge are known answers.
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      if (array instanceof Uint8Array) array.set(RFC_7636_RANDOM_BYTES.subarray(0, array.length));
      return array;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Starts a sign-in, and returns the address it sent the visitor to
  async function startSignIn(): Promise<URL> {
    await login();
    return new URL(leavePageTo.mock.calls[0][0]);
  }

  // Lands on the callback page with a code and the given state, as the identity provider
  // sends the visitor back
  function returnFromIdentityProvider(state: string | null): Promise<void> {
    window.location.href = `${identityProviderSettings.oidcRedirectUri}?code=${CODE_FROM_THE_PROVIDER}&state=${state}`;
    return handleRedirectCallback();
  }

  it("sends the visitor to the identity provider with the S256 challenge of the verifier it keeps", async () => {
    const sentTo = await startSignIn();

    expect(`${sentTo.origin}${sentTo.pathname}`).toBe(AUTHORIZATION_ENDPOINT);
    expect(Object.fromEntries(sentTo.searchParams)).toEqual({
      response_type: "code",
      client_id: identityProviderSettings.oidcClientId,
      redirect_uri: identityProviderSettings.oidcRedirectUri,
      scope: "openid profile email",
      state: expect.any(String),
      code_challenge: RFC_7636_CODE_CHALLENGE,
      code_challenge_method: "S256",
      audience: identityProviderSettings.oidcAudience,
    });
  });

  it("refuses an answer whose state is not the one it sent, and exchanges nothing", async () => {
    await startSignIn();

    await expect(returnFromIdentityProvider("state-of-another-sign-in")).rejects.toThrow(
      "OIDC state mismatch",
    );
    expect(fetchStandIn.mock.calls.map(([address]) => String(address))).not.toContain(TOKEN_ENDPOINT);
    expect(isAuthenticated()).toBe(false);
  });

  it("exchanges the code with the verifier it kept, and holds the token for as long as it lasts", async () => {
    const sentTo = await startSignIn();
    vi.useFakeTimers({ toFake: ["Date"] });
    const signedInAt = Date.now();
    await returnFromIdentityProvider(sentTo.searchParams.get("state"));

    const [address, init] = fetchStandIn.mock.calls[fetchStandIn.mock.calls.length - 1];
    expect(address).toBe(TOKEN_ENDPOINT);
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      grant_type: "authorization_code",
      client_id: identityProviderSettings.oidcClientId,
      code: CODE_FROM_THE_PROVIDER,
      redirect_uri: identityProviderSettings.oidcRedirectUri,
      code_verifier: RFC_7636_CODE_VERIFIER,
    });
    expect(getUser()).toEqual({ email: USER_EMAIL });

    vi.setSystemTime(signedInAt + 3599 * 1000);
    expect(getAccessToken()).toBe(USER_ACCESS_TOKEN);
    vi.setSystemTime(signedInAt + 3600 * 1000);
    expect(getAccessToken()).toBeNull();
  });

  it("forgets the user on sign-out and goes back to the app's own address", async () => {
    const sentTo = await startSignIn();
    await returnFromIdentityProvider(sentTo.searchParams.get("state"));

    logout();

    expect(isAuthenticated()).toBe(false);
    expect(getUser()).toBeNull();
    expect(leavePageTo).toHaveBeenLastCalledWith(APP_BASE_PATH);
  });
});
