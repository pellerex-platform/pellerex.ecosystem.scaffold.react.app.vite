import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

// An env.js written for the QA environment, with no sign-in set up
const settings = vi.hoisted(() => ({
  apiBaseUrl: "https://api.example.test",
  oidcIssuer: "",
  environment: "qualityassurance",
}));

// The runtime settings stand in for that env.js; no page is read.
vi.mock("./config/env", () => ({ env: settings, isOidcConfigured: false }));

// The sign-in helper stands in for a visitor who is not signed in; no identity provider is
// called.
vi.mock("./auth/oidc", () => ({
  isAuthenticated: () => false,
  getUser: () => null,
  login: vi.fn(),
  logout: vi.fn(),
  handleRedirectCallback: vi.fn(),
}));

// The markup the app shows at an address. Node has no browser page, so the app is rendered to
// markup, routed as the browser's router would route that address.
function pageAt(address: string): string {
  return renderToStaticMarkup(
    <StaticRouter location={address}>
      <App />
    </StaticRouter>,
  );
}

// Every address is a client-side page: nginx answers each with index.html, and the router
// picks the page.
describe("the pages", () => {
  it("shows the home page, with the runtime settings, at the root address", () => {
    const page = pageAt("/");

    expect(page).toContain("<h1>Welcome to your Pellerex web app</h1>");
    expect(page).toContain(`<strong>apiBaseUrl:</strong> ${settings.apiBaseUrl}`);
    expect(page).toContain("OIDC is not configured yet.");
  });

  it("shows the dashboard at /dashboard", () => {
    expect(pageAt("/dashboard")).toContain("<h1>Dashboard</h1>");
  });

  it("shows the sign-in landing page at /callback", () => {
    expect(pageAt("/callback")).toContain("<h1>Signing you in…</h1>");
  });

  it("names the environment in the header of every page", () => {
    for (const address of ["/", "/dashboard", "/callback"]) {
      expect(pageAt(address)).toContain(`<span class="env-badge">${settings.environment}</span>`);
    }
  });
});
