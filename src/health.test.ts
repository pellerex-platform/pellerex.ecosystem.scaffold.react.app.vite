import { describe, expect, it } from "vitest";
import chart from "../infrastructure/Helm/templates/deployment.yaml?raw";
import nginxConfig from "../nginx.conf?raw";

// The app's health addresses are answered by nginx (nginx.conf), not by the React app, and the
// chart's startup, liveness and readiness probes call them on the container's port. Both files
// are read as text.
const healthAddresses = ["/health/startup", "/health/live", "/health/ready"];

// The body of each exact-match block of nginx.conf ("location = /address { ... }"), by address
function exactMatchBlocks(config: string): Map<string, string> {
  return new Map(
    [...config.matchAll(/location = (\S+)\s*\{([^}]*)\}/g)].map(([, address, body]) => [
      address,
      body,
    ]),
  );
}

describe("the health addresses", () => {
  it.each(healthAddresses)("are answered by nginx itself: %s with 200 healthy", (address) => {
    expect(exactMatchBlocks(nginxConfig).get(address)).toContain('return 200 "healthy\\n";');
  });

  it("are the addresses the chart's probes call, on the port nginx listens on", () => {
    const probedAddresses = [...chart.matchAll(/^\s*path: (\S+)$/gm)].map(([, path]) => path);
    const listenPort = /^\s*listen (\S+);$/m.exec(nginxConfig)?.[1];
    const containerPort = /^\s*containerPort: (\S+)$/m.exec(chart)?.[1];

    expect(probedAddresses).toEqual(healthAddresses);
    expect(listenPort).toBeDefined();
    expect(listenPort).toBe(containerPort);
  });
});
