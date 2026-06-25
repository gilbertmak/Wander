import { describe, expect, it } from "vitest";

import { designTokens } from "../../src/ui/designTokens";

describe("design tokens", () => {
  it("defines the FP-2 semantic color palette", () => {
    expect(designTokens.color).toMatchObject({
      surfaceBase: "#061310",
      surfaceRaised: "#0b1f1a",
      emeraldDeep: "#047857",
      gold: "#f2c94c",
      blueProgress: "#38bdf8",
      amberWarning: "#f59e0b",
      redReversal: "#ef4444",
    });
  });

  it("defines layout primitives for responsive product surfaces", () => {
    expect(designTokens.radius).toMatchObject({
      md: "8px",
      pill: "999px",
    });
    expect(designTokens.spacing).toMatchObject({
      lg: "16px",
      xl: "24px",
      xxl: "32px",
    });
    expect(designTokens.chart).toMatchObject({
      progress: "#38bdf8",
      reversal: "#ef4444",
    });
  });
});
