import { afterEach, describe, expect, it, vi } from "vitest";
import type { PellerexEnv } from "./env";

// Loads the settings afresh, as the app does once when it starts, for a page at
// https://app.example.test. Node has no window, so one stands in, holding what the page's two
// scripts would have set: env.js sets window.__PELLEREX_ENV__, then the script in index.html
// sets window.__PELLEREX_BASE_PATH__.
async function loadSettingsFor(page: { envJs?: Partial<PellerexEnv>; basePath?: string }) {
  vi.stubGlobal("window", {
    __PELLEREX_ENV__: page.envJs,
    __PELLEREX_BASE_PATH__: page.basePath,
    location: { origin: "https://app.example.test" },
  });
  vi.resetModules();
  return import("./env");
}

// docker-entrypoint.d/env.sh writes env.js when the container starts, so one built image runs
// in every environment. A value env.js leaves out falls back to a development default.
describe("the runtime settings the app reads at start-up", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes every value from env.js", async () => {
    const envJs: PellerexEnv = {
      apiBaseUrl: "https://api.example.test",
      oidcIssuer: "https://login.example.test/",
      oidcClientId: "shop-web",
      oidcAudience: "https://api.example.test",
      oidcRedirectUri: "https://shop.example.test/callback",
      environment: "production",
      appInsightsConnectionString: "InstrumentationKey=00000000-0000-0000-0000-000000000000",
      basePath: "/proxy/shop/production",
    };

    const { env } = await loadSettingsFor({ envJs });

    expect(env).toEqual(envJs);
  });

  it("falls back to development values, and its own sign-in return address, when env.js sets none", async () => {
    const { env, basename } = await loadSettingsFor({ basePath: "/proxy/shop/qualityassurance" });

    expect(env).toEqual({
      apiBaseUrl: "",
      oidcIssuer: "",
      oidcClientId: "",
      oidcAudience: "",
      oidcRedirectUri: "https://app.example.test/proxy/shop/qualityassurance/callback",
      environment: "development",
      appInsightsConnectionString: "",
      basePath: "",
    });
    expect(basename).toBe("/proxy/shop/qualityassurance");
  });

  it("offers a sign-in only when env.js names both the issuer and the client id", async () => {
    const issuerOnly = await loadSettingsFor({ envJs: { oidcIssuer: "https://login.example.test/" } });
    const issuerAndClient = await loadSettingsFor({
      envJs: { oidcIssuer: "https://login.example.test/", oidcClientId: "shop-web" },
    });

    expect(issuerOnly.isOidcConfigured).toBe(false);
    expect(issuerAndClient.isOidcConfigured).toBe(true);
  });
});
