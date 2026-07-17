import { useState } from "react";
import { apiGetJson } from "../api/client";
import { env } from "../config/env";
import { isAuthenticated } from "../auth/oidc";

// Demonstrates a deep-linkable client-side route (WA-R8) plus a sample authenticated API call to the
// tenant's own backend (Mode 1, WA-D18). Replace the endpoint with your real backend.
export default function Dashboard() {
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function callBackend() {
    setError("");
    setResult("");
    try {
      const data = await apiGetJson<unknown>("/v1/hello");
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section>
      <h1>Dashboard</h1>
      <p>
        You reached a client-side route directly — nginx returned <code>index.html</code> and the
        router rendered this page (deep-link fallback works).
      </p>
      <p>
        <strong>Signed in:</strong> {isAuthenticated() ? "yes" : "no"} ·{" "}
        <strong>apiBaseUrl:</strong> {env.apiBaseUrl || "(not set)"}
      </p>
      <button onClick={callBackend}>Call backend /v1/hello</button>
      {result && <pre>{result}</pre>}
      {error && <pre className="error">Error: {error}</pre>}
    </section>
  );
}
