import { migration0001 } from "./0001_initial";
import { migration0002 } from "./0002_reconciliation_trust";

export const migrations = [migration0001, migration0002] as const;
