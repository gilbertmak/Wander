import { migration0001 } from "./0001_initial";
import { migration0002 } from "./0002_reconciliation_trust";
import { migration0003 } from "./0003_merchant_review_loop";
import { migration0004 } from "./0004_decision_traces";
import { migration0005 } from "./0005_refund_timelines";
import { migration0006 } from "./0006_miles_leakage";

export const migrations = [
  migration0001,
  migration0002,
  migration0003,
  migration0004,
  migration0005,
  migration0006,
] as const;
