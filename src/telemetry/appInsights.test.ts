import type { ITelemetryItem } from "@microsoft/applicationinsights-web";
import { afterEach, describe, expect, it, vi } from "vitest";

// Application Insights' browser library stands in with a recorder: a client is made, and
// nothing is sent.
const { ApplicationInsights } = vi.hoisted(() => ({
  ApplicationInsights: vi.fn(function () {
    return { loadAppInsights: vi.fn(), addTelemetryInitializer: vi.fn(), trackPageView: vi.fn() };
  }),
}));
vi.mock("@microsoft/applicationinsights-web", () => ({ ApplicationInsights }));

const ENVIRONMENT = "staging";

// Loads the telemetry afresh with an env.js for the environment that names the given
// connection string, and starts it, as the app does once when it starts.
async function startTelemetryWith(appInsightsConnectionString: string) {
  vi.resetModules();
  vi.doMock("../config/env", () => ({
    env: { appInsightsConnectionString, environment: ENVIRONMENT },
  }));
  const telemetry = await import("./appInsights");
  telemetry.initTelemetry();
  return telemetry;
}

// The connection string is public browser settings, written by the SetupMonitoring
// provisioning step. An app that opted out of monitoring has none, and then sends nothing.
describe("browser telemetry", () => {
  afterEach(() => {
    ApplicationInsights.mockClear();
  });

  it("starts nothing when env.js names no connection string", async () => {
    const telemetry = await startTelemetryWith("");

    expect(ApplicationInsights).not.toHaveBeenCalled();
    expect(telemetry.getAppInsights()).toBeUndefined();
  });

  it("records page views, each tagged with the app's name and environment, when env.js names one", async () => {
    const connectionString = "InstrumentationKey=00000000-0000-0000-0000-000000000000";
    const client = (await startTelemetryWith(connectionString)).getAppInsights();

    expect(ApplicationInsights).toHaveBeenCalledWith({
      config: { connectionString, enableAutoRouteTracking: true },
    });
    expect(client?.loadAppInsights).toHaveBeenCalled();
    expect(client?.trackPageView).toHaveBeenCalled();

    const tagItem = vi.mocked(client!.addTelemetryInitializer).mock.calls[0][0];
    const item: ITelemetryItem = { name: "page view" };
    tagItem(item);
    expect(item.tags).toEqual({ "ai.cloud.role": "RepoUniqueNormalisedIdentifier" });
    expect(item.data).toEqual({ Environment: ENVIRONMENT });
  });
});
