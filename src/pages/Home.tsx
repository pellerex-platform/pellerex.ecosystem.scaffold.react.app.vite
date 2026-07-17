import { useState } from "react";
import { env, isOidcConfigured } from "../config/env";
import { getUser, isAuthenticated, login, logout } from "../auth/oidc";

export default function Home() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const user = getUser();

  return (
    <section>
      <h1>Welcome to your Pellerex web app</h1>
      <p>
        This is a client-side React (Vite) app, served as static assets on nginx and reached through
        ProxyApi at <code>app.pellerex.com/proxy/&#123;ProductName&#125;/&#123;env&#125;/</code>.
      </p>

      <h2>Runtime config</h2>
      <ul>
        <li>
          <strong>environment:</strong> {env.environment}
        </li>
        <li>
          <strong>apiBaseUrl:</strong> {env.apiBaseUrl || <em>(not set)</em>}
        </li>
        <li>
          <strong>oidcIssuer:</strong> {env.oidcIssuer || <em>(not set)</em>}
        </li>
      </ul>

      <h2>Sign in (your IDP)</h2>
      {!isOidcConfigured ? (
        <p>
          OIDC is not configured yet. Set <code>oidcIssuer</code> / <code>oidcClientId</code> in your
          environment to enable login against your own IDP (e.g. Auth0).
        </p>
      ) : authed ? (
        <div>
          <p>Signed in{user?.email ? ` as ${String(user.email)}` : ""}.</p>
          <button
            onClick={() => {
              logout();
              setAuthed(false);
            }}
          >
            Log out
          </button>
        </div>
      ) : (
        <button onClick={() => login()}>Log in</button>
      )}
    </section>
  );
}
