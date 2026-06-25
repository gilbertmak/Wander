export const designTokens = {
  color: {
    surfaceBase: "#061310",
    surfaceRaised: "#0b1f1a",
    surfacePanel: "#102822",
    surfaceMuted: "#17352d",
    borderSubtle: "rgba(190, 242, 100, 0.14)",
    textPrimary: "#f4fff8",
    textSecondary: "#b7c9c0",
    textMuted: "#7e948b",
    emerald: "#10b981",
    emeraldDeep: "#047857",
    gold: "#f2c94c",
    blueProgress: "#38bdf8",
    amberWarning: "#f59e0b",
    redReversal: "#ef4444",
  },
  typography: {
    family:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    scale: {
      caption: "0.75rem",
      body: "0.95rem",
      bodyLarge: "1.05rem",
      title: "1.35rem",
      display: "3rem",
    },
    lineHeight: {
      tight: "1.05",
      normal: "1.5",
      relaxed: "1.7",
    },
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    xxl: "32px",
  },
  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    pill: "999px",
  },
  shadow: {
    raised: "0 18px 48px rgba(0, 0, 0, 0.32)",
    focus: "0 0 0 3px rgba(242, 201, 76, 0.32)",
  },
  chart: {
    progress: "#38bdf8",
    milestone: "#f2c94c",
    income: "#10b981",
    expense: "#f59e0b",
    reversal: "#ef4444",
  },
} as const;

export type DesignTokens = typeof designTokens;
