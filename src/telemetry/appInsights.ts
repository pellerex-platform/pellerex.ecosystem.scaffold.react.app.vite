// Browser RUM via Azure Application Insights (WA-D9: the connection string is public
// runtime config, injected through env.js — it is NOT a secret).
//
// Initialised once at startup IF the platform populated appInsightsConnectionString;
// tenants that opt out of monitoring simply leave it empty and this module is a no-op.
// enableAutoRouteTracking records SPA route changes as page views, so the portal's
// monitoring views get request/page telemetry without per-page instrumentation.
import { ApplicationInsights } from "@microsoft/applicationinsights-web";

import { env } from "../config/env";

let appInsights: ApplicationInsights | undefined;

export function initTelemetry(): void {
  if (!env.appInsightsConnectionString || appInsights) {
    return;
  }

  appInsights = new ApplicationInsights({
    config: {
      connectionString: env.appInsightsConnectionString,
      enableAutoRouteTracking: true,
    },
  });

  appInsights.loadAppInsights();

  // Stamp every telemetry item with the product identity + environment so the
  // portal can slice by role/environment (the browser analogue of the API
  // scaffolds' service.name / Environment log enrichment).
  appInsights.addTelemetryInitializer((item) => {
    item.tags = item.tags ?? {};
    item.tags["ai.cloud.role"] = "RepoUniqueNormalisedIdentifier";
    item.data = item.data ?? {};
    item.data["Environment"] = env.environment;
  });

  appInsights.trackPageView();
}

/** The live client, for manual trackEvent/trackException calls (undefined when RUM is off). */
export function getAppInsights(): ApplicationInsights | undefined {
  return appInsights;
}
