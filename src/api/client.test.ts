import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { getAccessToken } from "../auth/oidc";
import { apiFetch, apiGetJson } from "./client";

// The runtime settings stand in for an env.js that names the backend; no page is read.
vi.mock("../config/env", () => ({ env: { apiBaseUrl: "https://api.example.test/" } }));

// The sign-in helper stands in for the user's session; no identity provider is called.
vi.mock("../auth/oidc", () => ({ getAccessToken: vi.fn() }));

const USER_ACCESS_TOKEN = "user-access-token";
const CALLERS_CORRELATION_ID = "order-42";

// Every call to the backend carries the signed-in user's token and a correlation id in
// X-Correlation-Id, the header the platform and its API templates read, so the call and
// everything done for it can be found together in the logs.
describe("calling the backend", () => {
  let fetchStandIn: Mock<typeof fetch>;

  beforeEach(() => {
    // fetch stands in for the network: nothing is sent, and every call is answered 200.
    fetchStandIn = vi.fn<typeof fetch>(async () => Response.json({ message: "hello" }));
    vi.stubGlobal("fetch", fetchStandIn);
    vi.mocked(getAccessToken).mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sentCall(callNumber: number) {
    const [address, init] = fetchStandIn.mock.calls[callNumber - 1];
    return { address, headers: new Headers(init?.headers) };
  }

  it("sends the call to the backend env.js names, asking for JSON", async () => {
    await apiFetch("/v1/hello");

    expect(sentCall(1).address).toBe("https://api.example.test/v1/hello");
    expect(sentCall(1).headers.get("Accept")).toBe("application/json");
  });

  it("sends a new correlation id with each call, and keeps one the caller set", async () => {
    await apiFetch("/v1/hello");
    await apiFetch("/v1/hello");
    await apiFetch("/v1/hello", { headers: { "X-Correlation-Id": CALLERS_CORRELATION_ID } });

    const firstId = sentCall(1).headers.get("X-Correlation-Id");
    expect(firstId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(sentCall(2).headers.get("X-Correlation-Id")).not.toBe(firstId);
    expect(sentCall(3).headers.get("X-Correlation-Id")).toBe(CALLERS_CORRELATION_ID);
  });

  it("sends the signed-in user's token, and none when nobody is signed in", async () => {
    await apiFetch("/v1/hello");
    vi.mocked(getAccessToken).mockReturnValue(USER_ACCESS_TOKEN);
    await apiFetch("/v1/hello");

    expect(sentCall(1).headers.has("Authorization")).toBe(false);
    expect(sentCall(2).headers.get("Authorization")).toBe(`Bearer ${USER_ACCESS_TOKEN}`);
  });

  it("answers the backend's JSON, and an error naming the status when the backend refuses", async () => {
    await expect(apiGetJson("/v1/hello")).resolves.toEqual({ message: "hello" });

    fetchStandIn.mockResolvedValue(
      new Response(null, { status: 503, statusText: "Service Unavailable" }),
    );
    await expect(apiGetJson("/v1/hello")).rejects.toThrow("API call failed: 503 Service Unavailable");
  });
});
