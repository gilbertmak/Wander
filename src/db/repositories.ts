import { and, desc, eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type { DatabaseConnection } from "./client";
import {
  accounts,
  decisionTraces,
  expenseSnapshots,
  plannerProfiles,
  profiles,
  refundTimelines,
  rewardLedger,
  statementReconciliations,
  statementImports,
  transactionTrustScores,
  transactions,
} from "./schema";

export type Profile = InferSelectModel<typeof profiles>;
export type NewProfile = InferInsertModel<typeof profiles>;
export type NewPlannerProfile = InferInsertModel<typeof plannerProfiles>;
export type NewExpenseSnapshot = InferInsertModel<typeof expenseSnapshots>;
export type NewDecisionTrace = InferInsertModel<typeof decisionTraces>;
export type NewStatementImport = InferInsertModel<typeof statementImports>;
export type NewStatementReconciliation = InferInsertModel<typeof statementReconciliations>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type NewTransaction = InferInsertModel<typeof transactions>;
export type NewTransactionTrustScore = InferInsertModel<typeof transactionTrustScores>;
export type NewRefundTimeline = InferInsertModel<typeof refundTimelines>;
export type NewRewardLedgerEntry = InferInsertModel<typeof rewardLedger>;

export function createRepositories(connection: DatabaseConnection) {
  return {
    profiles: createProfileRepository(connection),
    plannerProfiles: createPlannerProfileRepository(connection),
    expenseSnapshots: createExpenseSnapshotRepository(connection),
    decisionTraces: createDecisionTraceRepository(connection),
    statementImports: createStatementImportRepository(connection),
    statementReconciliations: createStatementReconciliationRepository(connection),
    accounts: createAccountRepository(connection),
    transactions: createTransactionRepository(connection),
    transactionTrustScores: createTransactionTrustScoreRepository(connection),
    refundTimelines: createRefundTimelineRepository(connection),
    rewardLedger: createRewardLedgerRepository(connection),
  };
}

function createRefundTimelineRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewRefundTimeline) =>
      connection.db.insert(refundTimelines).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(refundTimelines)
        .where(eq(refundTimelines.profileId, profileId))
        .orderBy(desc(refundTimelines.calculatedAt))
        .all(),
    getByOriginalTransactionId: (originalTransactionId: string) =>
      connection.db
        .select()
        .from(refundTimelines)
        .where(eq(refundTimelines.originalTransactionId, originalTransactionId))
        .get(),
  };
}

function createDecisionTraceRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewDecisionTrace) =>
      connection.db.insert(decisionTraces).values(value).returning().get(),
    listForSourceRecord: (sourceRecordId: string) =>
      connection.db
        .select()
        .from(decisionTraces)
        .where(eq(decisionTraces.sourceRecordId, sourceRecordId))
        .orderBy(desc(decisionTraces.createdAt))
        .all(),
    listForModule: (profileId: string, sourceModule: string) =>
      connection.db
        .select()
        .from(decisionTraces)
        .where(
          and(
            eq(decisionTraces.profileId, profileId),
            eq(decisionTraces.sourceModule, sourceModule),
          ),
        )
        .orderBy(desc(decisionTraces.createdAt))
        .all(),
  };
}

function createProfileRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewProfile) => connection.db.insert(profiles).values(value).returning().get(),
    getById: (id: string) => connection.db.select().from(profiles).where(eq(profiles.id, id)).get(),
  };
}

function createPlannerProfileRepository(connection: DatabaseConnection) {
  return {
    upsert: (value: NewPlannerProfile) =>
      connection.db
        .insert(plannerProfiles)
        .values(value)
        .onConflictDoUpdate({
          target: plannerProfiles.profileId,
          set: value,
        })
        .returning()
        .get(),
    getByProfileId: (profileId: string) =>
      connection.db
        .select()
        .from(plannerProfiles)
        .where(eq(plannerProfiles.profileId, profileId))
        .get(),
  };
}

function createExpenseSnapshotRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewExpenseSnapshot) =>
      connection.db.insert(expenseSnapshots).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(expenseSnapshots)
        .where(eq(expenseSnapshots.profileId, profileId))
        .orderBy(desc(expenseSnapshots.periodEnd))
        .all(),
  };
}

function createStatementImportRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewStatementImport) =>
      connection.db.insert(statementImports).values(value).returning().get(),
    getByProfileAndHash: (profileId: string, sourceFileHash: string) =>
      connection.db
        .select()
        .from(statementImports)
        .where(
          and(
            eq(statementImports.profileId, profileId),
            eq(statementImports.sourceFileHash, sourceFileHash),
          ),
        )
        .get(),
  };
}

function createStatementReconciliationRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewStatementReconciliation) =>
      connection.db.insert(statementReconciliations).values(value).returning().get(),
    getByImportId: (statementImportId: string) =>
      connection.db
        .select()
        .from(statementReconciliations)
        .where(eq(statementReconciliations.statementImportId, statementImportId))
        .get(),
  };
}

function createAccountRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewAccount) => connection.db.insert(accounts).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db.select().from(accounts).where(eq(accounts.profileId, profileId)).all(),
  };
}

function createTransactionRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewTransaction) =>
      connection.db.insert(transactions).values(value).returning().get(),
    getByFingerprint: (profileId: string, transactionFingerprint: string) =>
      connection.db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.profileId, profileId),
            eq(transactions.transactionFingerprint, transactionFingerprint),
          ),
        )
        .get(),
    listReviewItems: (profileId: string) =>
      connection.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.profileId, profileId), eq(transactions.needsReview, true)))
        .orderBy(desc(transactions.postedDate))
        .all(),
  };
}

function createTransactionTrustScoreRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewTransactionTrustScore) =>
      connection.db.insert(transactionTrustScores).values(value).returning().get(),
    listForImport: (statementImportId: string) =>
      connection.db
        .select()
        .from(transactionTrustScores)
        .where(eq(transactionTrustScores.statementImportId, statementImportId))
        .all(),
    getByTransactionId: (transactionId: string) =>
      connection.db
        .select()
        .from(transactionTrustScores)
        .where(eq(transactionTrustScores.transactionId, transactionId))
        .get(),
  };
}

function createRewardLedgerRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewRewardLedgerEntry) =>
      connection.db.insert(rewardLedger).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db.select().from(rewardLedger).where(eq(rewardLedger.profileId, profileId)).all(),
  };
}
