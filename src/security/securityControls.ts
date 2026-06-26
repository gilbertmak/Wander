import { sanitizeParserLog } from "../ingestion/parserBridge";

export type SourceStatementRetentionRequest = {
  sourceType: "pdf" | "csv";
  explicitRetentionConsent?: boolean;
  encryptedStorageAvailable?: boolean;
  deletionControlsAvailable?: boolean;
};

export type SourceStatementRetentionDecision = {
  persistSourceFile: boolean;
  reason: string;
  requiredControls: string[];
};

export type EncryptionPlatform = "darwin" | "win32" | "linux" | "web" | "unknown";

export type EncryptionValidationStep = {
  id: string;
  description: string;
  requiredForRealData: boolean;
};

export type EncryptionReadinessPlan = {
  platform: EncryptionPlatform;
  storageTarget: string;
  realDataModeAllowed: boolean;
  validationSteps: EncryptionValidationStep[];
  caveats: string[];
};

const requiredSourceFileControls = [
  "explicit user consent",
  "encrypted local storage",
  "user-visible deletion controls",
];

export function decideSourceStatementRetention(
  request: SourceStatementRetentionRequest,
): SourceStatementRetentionDecision {
  const missingControls = [
    request.explicitRetentionConsent ? undefined : requiredSourceFileControls[0],
    request.encryptedStorageAvailable ? undefined : requiredSourceFileControls[1],
    request.deletionControlsAvailable ? undefined : requiredSourceFileControls[2],
  ].filter((control): control is string => Boolean(control));

  if (missingControls.length > 0) {
    return {
      persistSourceFile: false,
      reason: `${request.sourceType.toUpperCase()} source files are not retained until all retention controls are present.`,
      requiredControls: missingControls,
    };
  }

  return {
    persistSourceFile: true,
    reason: `${request.sourceType.toUpperCase()} source file retention is allowed for this import.`,
    requiredControls: [],
  };
}

export function redactSensitiveLog(value: unknown) {
  const structuredRedaction = JSON.stringify(value, null, 2)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redacted]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[card-redacted]")
    .replace(/"sourceFilePath"\s*:\s*"[^"]+"/g, '"sourceFilePath": "[path-redacted]"')
    .replace(/"descriptionRaw"\s*:\s*"[^"]+"/g, '"descriptionRaw": "[description-redacted]"');

  return sanitizeParserLog(structuredRedaction);
}

export function buildEncryptionReadinessPlan(platform: EncryptionPlatform): EncryptionReadinessPlan {
  const baseSteps: EncryptionValidationStep[] = [
    {
      id: "ENC-001",
      description: "Verify the local database is encrypted at rest before enabling real-data mode.",
      requiredForRealData: true,
    },
    {
      id: "ENC-002",
      description: "Verify parser temp directories are removed after success, failure, and timeout paths.",
      requiredForRealData: true,
    },
    {
      id: "ENC-003",
      description: "Verify exports set sourceFilesIncluded=false and contain no source statement bytes.",
      requiredForRealData: true,
    },
  ];

  const platformTargets: Record<EncryptionPlatform, Pick<EncryptionReadinessPlan, "storageTarget" | "caveats">> = {
    darwin: {
      storageTarget: "SQLCipher database with keys protected by macOS Keychain",
      caveats: ["Native packaging must validate Keychain access before real-data mode."],
    },
    win32: {
      storageTarget: "SQLCipher database with keys protected by Windows Credential Manager or DPAPI",
      caveats: ["Installer and user profile boundaries must be validated on Windows."],
    },
    linux: {
      storageTarget: "SQLCipher database with keys protected by libsecret-compatible keyring",
      caveats: ["Headless Linux environments may lack a user keyring and should remain demo-only."],
    },
    web: {
      storageTarget: "Browser storage disabled for real financial data",
      caveats: ["Web builds should stay demo-only unless an encrypted storage design is approved."],
    },
    unknown: {
      storageTarget: "Unvalidated platform storage",
      caveats: ["Unknown platforms must remain demo-only until encryption validation passes."],
    },
  };

  const target = platformTargets[platform];
  const realDataModeAllowed = platform !== "web" && platform !== "unknown";

  return {
    platform,
    storageTarget: target.storageTarget,
    realDataModeAllowed,
    validationSteps: baseSteps,
    caveats: target.caveats,
  };
}
