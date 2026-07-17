import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { handleRedirectCallback } from "../auth/oidc";

// OIDC redirect landing route. Exchanges the authorization code for tokens (PKCE) then returns home.
export default function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>("");

  useEffect(() => {
    handleRedirectCallback()
      .then(() => navigate("/", { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [navigate]);

  return (
    <section>
      <h1>Signing you in…</h1>
      {error && <pre className="error">Login failed: {error}</pre>}
    </section>
  );
}
