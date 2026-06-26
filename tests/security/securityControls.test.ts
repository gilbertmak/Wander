import { describe, expect, it } from "vitest";

import {
  buildEncryptionReadinessPlan,
  decideSourceStatementRetention,
  redactSensitiveLog,
} from "../../src/security/securityControls";

describe("security controls", () => {
  it("does not retain source statement files by default", () => {
    const decision = decideSourceStatementRetention({ sourceType: "pdf" });

    expect(decision.persistSourceFile).toBe(false);
    expect(decision.requiredControls).toEqual([
      "explicit user consent",
      "encrypted local storage",
      "user-visible deletion controls",
    ]);
  });

  it("only allows source file retention when consent, encryption, and deletion controls exist", () => {
    const decision = decideSourceStatementRetention({
      sourceType: "pdf",
      explicitRetentionConsent: true,
      encryptedStorageAvailable: true,
      deletionControlsAvailable: true,
    });

    expect(decision.persistSourceFile).toBe(true);
    expect(decision.requiredControls).toEqual([]);
  });

  it("redacts sensitive parser and application log fields", () => {
    const redacted = redactSensitiveLog({
      sourceFilePath: "/Users/person/Documents/full_statement.pdf",
      sourceFileSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      email: "person@example.com",
      cardNumber: "4111 1111 1111 1111",
      descriptionRaw: "PAYPAL *PRIVATE MERCHANT",
      accountHint: "****123456",
    });

    expect(redacted).not.toContain("/Users/person/Documents/full_statement.pdf");
    expect(redacted).not.toContain("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    expect(redacted).not.toContain("person@example.com");
    expect(redacted).not.toContain("4111 1111 1111 1111");
    expect(redacted).not.toContain("PAYPAL *PRIVATE MERCHANT");
    expect(redacted).not.toContain("****123456");
    expect(redacted).toContain("[path-redacted]");
    expect(redacted).toContain("[hash-redacted]");
    expect(redacted).toContain("[email-redacted]");
    expect(redacted).toContain("[card-redacted]");
    expect(redacted).toContain("[description-redacted]");
    expect(redacted).toContain("[account-redacted]");
  });

  it("documents platform-specific encryption readiness gates", () => {
    const macPlan = buildEncryptionReadinessPlan("darwin");
    const webPlan = buildEncryptionReadinessPlan("web");

    expect(macPlan.realDataModeAllowed).toBe(true);
    expect(macPlan.storageTarget).toContain("SQLCipher");
    expect(macPlan.validationSteps.every((step) => step.requiredForRealData)).toBe(true);
    expect(webPlan.realDataModeAllowed).toBe(false);
    expect(webPlan.caveats.join(" ")).toContain("demo-only");
  });
});
