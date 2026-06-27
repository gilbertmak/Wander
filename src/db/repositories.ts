import { and, desc, eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type { DatabaseConnection } from "./client";
import {
  accounts,
  advisorInsights,
  assetLiabilityAccounts,
  cardPeriodSummaries,
  cpfAccounts,
  decisionTraces,
  expenseSnapshots,
  financialGoals,
  healthcareAssumptions,
  incomeStreams,
  milesLeakageItems,
  plannerProfiles,
  plannedPurchases,
  propertyProfiles,
  projectionRuns,
  projectionYears,
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
export type NewIncomeStream = InferInsertModel<typeof incomeStreams>;
export type NewAssetLiabilityAccount = InferInsertModel<typeof assetLiabilityAccounts>;
export type NewCpfAccount = InferInsertModel<typeof cpfAccounts>;
export type NewPropertyProfile = InferInsertModel<typeof propertyProfiles>;
export type NewHealthcareAssumption = InferInsertModel<typeof healthcareAssumptions>;
export type NewFinancialGoal = InferInsertModel<typeof financialGoals>;
export type NewProjectionRun = InferInsertModel<typeof projectionRuns>;
export type NewProjectionYear = InferInsertModel<typeof projectionYears>;
export type NewAdvisorInsight = InferInsertModel<typeof advisorInsights>;
export type NewDecisionTrace = InferInsertModel<typeof decisionTraces>;
export type NewStatementImport = InferInsertModel<typeof statementImports>;
export type NewStatementReconciliation = InferInsertModel<typeof statementReconciliations>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type NewCardPeriodSummary = InferInsertModel<typeof cardPeriodSummaries>;
export type NewTransaction = InferInsertModel<typeof transactions>;
export type NewTransactionTrustScore = InferInsertModel<typeof transactionTrustScores>;
export type NewRefundTimeline = InferInsertModel<typeof refundTimelines>;
export type NewMilesLeakageItem = InferInsertModel<typeof milesLeakageItems>;
export type NewPlannedPurchase = InferInsertModel<typeof plannedPurchases>;
export type NewRewardLedgerEntry = InferInsertModel<typeof rewardLedger>;

export function createRepositories(connection: DatabaseConnection) {
  return {
    profiles: createProfileRepository(connection),
    plannerProfiles: createPlannerProfileRepository(connection),
    expenseSnapshots: createExpenseSnapshotRepository(connection),
    incomeStreams: createIncomeStreamRepository(connection),
    assetLiabilityAccounts: createAssetLiabilityAccountRepository(connection),
    cpfAccounts: createCpfAccountRepository(connection),
    propertyProfiles: createPropertyProfileRepository(connection),
    healthcareAssumptions: createHealthcareAssumptionRepository(connection),
    financialGoals: createFinancialGoalRepository(connection),
    projectionRuns: createProjectionRunRepository(connection),
    projectionYears: createProjectionYearRepository(connection),
    advisorInsights: createAdvisorInsightRepository(connection),
    decisionTraces: createDecisionTraceRepository(connection),
    statementImports: createStatementImportRepository(connection),
    statementReconciliations: createStatementReconciliationRepository(connection),
    accounts: createAccountRepository(connection),
    cardPeriodSummaries: createCardPeriodSummaryRepository(connection),
    transactions: createTransactionRepository(connection),
    transactionTrustScores: createTransactionTrustScoreRepository(connection),
    refundTimelines: createRefundTimelineRepository(connection),
    milesLeakageItems: createMilesLeakageItemRepository(connection),
    plannedPurchases: createPlannedPurchaseRepository(connection),
    rewardLedger: createRewardLedgerRepository(connection),
  };
}

function createIncomeStreamRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewIncomeStream) =>
      connection.db.insert(incomeStreams).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(incomeStreams)
        .where(eq(incomeStreams.profileId, profileId))
        .orderBy(desc(incomeStreams.createdAt))
        .all(),
  };
}

function createAssetLiabilityAccountRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewAssetLiabilityAccount) =>
      connection.db.insert(assetLiabilityAccounts).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(assetLiabilityAccounts)
        .where(eq(assetLiabilityAccounts.profileId, profileId))
        .orderBy(desc(assetLiabilityAccounts.createdAt))
        .all(),
  };
}

function createCpfAccountRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewCpfAccount) =>
      connection.db.insert(cpfAccounts).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(cpfAccounts)
        .where(eq(cpfAccounts.profileId, profileId))
        .orderBy(desc(cpfAccounts.asOfDate))
        .all(),
  };
}

function createPropertyProfileRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewPropertyProfile) =>
      connection.db.insert(propertyProfiles).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(propertyProfiles)
        .where(eq(propertyProfiles.profileId, profileId))
        .orderBy(desc(propertyProfiles.createdAt))
        .all(),
  };
}

function createHealthcareAssumptionRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewHealthcareAssumption) =>
      connection.db.insert(healthcareAssumptions).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(healthcareAssumptions)
        .where(eq(healthcareAssumptions.profileId, profileId))
        .orderBy(desc(healthcareAssumptions.createdAt))
        .all(),
  };
}

function createFinancialGoalRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewFinancialGoal) =>
      connection.db.insert(financialGoals).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(financialGoals)
        .where(eq(financialGoals.profileId, profileId))
        .orderBy(desc(financialGoals.priority), desc(financialGoals.createdAt))
        .all(),
  };
}

function createProjectionRunRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewProjectionRun) =>
      connection.db.insert(projectionRuns).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(projectionRuns)
        .where(eq(projectionRuns.profileId, profileId))
        .orderBy(desc(projectionRuns.calculatedAt))
        .all(),
  };
}

function createProjectionYearRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewProjectionYear) =>
      connection.db.insert(projectionYears).values(value).returning().get(),
    listForRun: (projectionRunId: string) =>
      connection.db
        .select()
        .from(projectionYears)
        .where(eq(projectionYears.projectionRunId, projectionRunId))
        .orderBy(projectionYears.yearIndex)
        .all(),
  };
}

function createAdvisorInsightRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewAdvisorInsight) =>
      connection.db.insert(advisorInsights).values(value).returning().get(),
    listOpenForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(advisorInsights)
        .where(and(eq(advisorInsights.profileId, profileId), eq(advisorInsights.status, "open")))
        .orderBy(desc(advisorInsights.createdAt))
        .all(),
  };
}

function createPlannedPurchaseRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewPlannedPurchase) =>
      connection.db.insert(plannedPurchases).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(plannedPurchases)
        .where(eq(plannedPurchases.profileId, profileId))
        .orderBy(desc(plannedPurchases.plannedDate))
        .all(),
  };
}

function createCardPeriodSummaryRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewCardPeriodSummary) =>
      connection.db.insert(cardPeriodSummaries).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(cardPeriodSummaries)
        .where(eq(cardPeriodSummaries.profileId, profileId))
        .orderBy(desc(cardPeriodSummaries.periodEnd))
        .all(),
  };
}

function createMilesLeakageItemRepository(connection: DatabaseConnection) {
  return {
    create: (value: NewMilesLeakageItem) =>
      connection.db.insert(milesLeakageItems).values(value).returning().get(),
    listForProfile: (profileId: string) =>
      connection.db
        .select()
        .from(milesLeakageItems)
        .where(eq(milesLeakageItems.profileId, profileId))
        .orderBy(desc(milesLeakageItems.createdAt))
        .all(),
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
