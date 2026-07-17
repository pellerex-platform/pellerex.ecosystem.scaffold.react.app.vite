import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { basename } from "./config/env";
import { initTelemetry } from "./telemetry/appInsights";
import "./styles.css";

// Browser RUM (no-op unless the platform injected an App Insights connection string).
initTelemetry();

// basename is the runtime-resolved path prefix (e.g. /proxy/{ProductName}/{env}) so client-side
// routing works under the ProxyApi path model without a per-environment rebuild (WA-D7).
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
