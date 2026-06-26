import { migration0001 } from "./0001_initial";
import { migration0002 } from "./0002_reconciliation_trust";
import { migration0003 } from "./0003_merchant_review_loop";

export const migrations = [migration0001, migration0002, migration0003] as const;
