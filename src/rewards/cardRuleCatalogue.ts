import { eq } from "drizzle-orm";

import type { DatabaseConnection } from "../db/client";
import { cardRules, cards, redemptionPrograms, seededDataVersions } from "../db/schema";

export const cardRuleCatalogueDataset = {
  id: "sg_card_rule_catalogue_2026_06",
  name: "sg_card_rule_catalogue",
  version: "2026.06",
  sourceUrl: "https://milelion.com/",
  verifiedAt: "2026-06-25",
} as const;

export type CardSeed = {
  id: string;
  issuer: string;
  cardName: string;
  network?: string;
  currency: string;
  isActive: boolean;
};

export type RedemptionProgramSeed = {
  id: string;
  issuer: string;
  programName: string;
  pointsName: string;
  milesConversionRatio: string;
  minimumTransferPoints: number;
  transferBlockPoints: number;
  feeMinor: number;
  sourceUrl: string;
  verifiedAt: string;
};

export type RuleFormulaJson = {
  kind: "mpd";
  milesPerDollar: number;
  rounding: {
    mode: "floor_per_transaction" | "aggregate_period";
    unitMinor: number;
  };
};

export type BonusFormulaJson = RuleFormulaJson & {
  capAmountMinor: number;
  capPeriod: "calendar_month" | "statement_month";
  excessMilesPerDollar: number;
};

export type EligibilityJson = {
  channels: Array<"online" | "contactless" | "offline">;
  categoryIds?: string[];
  merchantCategoryNotes?: string[];
  selectedCategoryCount?: number;
  excludedMccCodes?: string[];
  excludedNotes?: string[];
};

export type TransferRuleJson = {
  redemptionProgramId: string;
  pointsPerMile: number;
  minimumTransferPoints: number;
  transferBlockPoints: number;
};

export type CardRuleSeed = {
  id: string;
  cardId: string;
  ruleName: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceUrl: string;
  sourceType: "milelion_review";
  verifiedAt: string;
  capPeriod: "calendar_month" | "statement_month";
  capAmountMinor: number;
  baseFormula: RuleFormulaJson;
  bonusFormula: BonusFormulaJson;
  eligibility: EligibilityJson;
  exclusion: EligibilityJson;
  transferRule: TransferRuleJson;
};

const milelionUrls = {
  citiRewards: "https://milelion.com/2026/02/27/review-citi-rewards-credit-card/",
  dbsWomansWorld: "https://milelion.com/2025/08/09/review-dbs-womans-world-card/",
  hsbcRevolution: "https://milelion.com/2026/04/08/review-hsbc-revolution-card/",
  uobLadys: "https://milelion.com/2025/08/12/review-uob-ladys-card-ladys-solitaire/",
} as const;

export const cardSeeds: CardSeed[] = [
  {
    id: "card_citi_rewards",
    issuer: "Citibank",
    cardName: "Citi Rewards Card",
    network: "Mastercard",
    currency: "SGD",
    isActive: true,
  },
  {
    id: "card_dbs_womans_world",
    issuer: "DBS",
    cardName: "DBS Woman's World Card",
    network: "Mastercard",
    currency: "SGD",
    isActive: true,
  },
  {
    id: "card_hsbc_revolution",
    issuer: "HSBC",
    cardName: "HSBC Revolution Card",
    network: "Visa",
    currency: "SGD",
    isActive: true,
  },
  {
    id: "card_uob_ladys",
    issuer: "UOB",
    cardName: "UOB Lady's Card",
    network: "Visa",
    currency: "SGD",
    isActive: true,
  },
];

export const redemptionProgramSeeds: RedemptionProgramSeed[] = [
  program("program_citi_thankyou", "Citibank", "Citi ThankYou Rewards", "ThankYou Points", "25000:10000", 25_000, 25_000, milelionUrls.citiRewards),
  program("program_dbs_points", "DBS", "DBS Points", "DBS Points", "5000:10000", 5_000, 5_000, milelionUrls.dbsWomansWorld),
  program("program_hsbc_rewards", "HSBC", "HSBC Rewards", "HSBC Points", "25000:10000", 25_000, 25_000, milelionUrls.hsbcRevolution),
  program("program_uob_unidollars", "UOB", "UOB UNI$", "UNI$", "5000:10000", 5_000, 5_000, milelionUrls.uobLadys),
];

export const cardRuleSeeds: CardRuleSeed[] = [
  {
    id: "rule_citi_rewards_2026_02",
    cardId: "card_citi_rewards",
    ruleName: "4 mpd online and selected retail",
    effectiveFrom: "2026-02-27",
    sourceUrl: milelionUrls.citiRewards,
    sourceType: "milelion_review",
    verifiedAt: cardRuleCatalogueDataset.verifiedAt,
    capPeriod: "statement_month",
    capAmountMinor: 100_000,
    baseFormula: mpdFormula(0.4, "floor_per_transaction", 100),
    bonusFormula: bonusFormula(4, 100_000, "statement_month", 0.4),
    eligibility: {
      channels: ["online", "offline"],
      merchantCategoryNotes: ["online transactions except travel and in-app mobile wallet payments", "department stores", "bags", "shoes", "clothes"],
      excludedNotes: ["travel", "in-app mobile wallet payments"],
    },
    exclusion: {
      channels: [],
      excludedMccCodes: ["6012", "9399"],
      excludedNotes: ["quasi-cash", "government services", "fees", "interest", "refunded spend"],
    },
    transferRule: transfer("program_citi_thankyou", 2.5, 25_000),
  },
  {
    id: "rule_dbs_womans_world_2025_08",
    cardId: "card_dbs_womans_world",
    ruleName: "4 mpd online spend",
    effectiveFrom: "2025-08-01",
    sourceUrl: milelionUrls.dbsWomansWorld,
    sourceType: "milelion_review",
    verifiedAt: cardRuleCatalogueDataset.verifiedAt,
    capPeriod: "calendar_month",
    capAmountMinor: 100_000,
    baseFormula: mpdFormula(0.4, "floor_per_transaction", 500),
    bonusFormula: bonusFormula(4, 100_000, "calendar_month", 0.4),
    eligibility: {
      channels: ["online"],
      merchantCategoryNotes: ["online spend"],
    },
    exclusion: {
      channels: [],
      excludedMccCodes: ["6012", "9399"],
      excludedNotes: ["contactless-only card-present spend", "quasi-cash", "government services", "fees", "interest", "refunded spend"],
    },
    transferRule: transfer("program_dbs_points", 0.5, 5_000),
  },
  {
    id: "rule_hsbc_revolution_2026_04",
    cardId: "card_hsbc_revolution",
    ruleName: "4 mpd regular bonus categories",
    effectiveFrom: "2026-04-01",
    sourceUrl: milelionUrls.hsbcRevolution,
    sourceType: "milelion_review",
    verifiedAt: cardRuleCatalogueDataset.verifiedAt,
    capPeriod: "calendar_month",
    capAmountMinor: 100_000,
    baseFormula: mpdFormula(0.4, "floor_per_transaction", 100),
    bonusFormula: bonusFormula(4, 100_000, "calendar_month", 0.4),
    eligibility: {
      channels: ["online", "contactless"],
      categoryIds: ["category_dining", "category_shopping", "category_transport"],
      merchantCategoryNotes: ["dining", "shopping", "transport and member clubs", "travel"],
    },
    exclusion: {
      channels: [],
      excludedMccCodes: ["6012", "6300", "9399"],
      excludedNotes: ["quasi-cash", "insurance", "government services", "fees", "interest", "refunded spend"],
    },
    transferRule: transfer("program_hsbc_rewards", 2.5, 25_000),
  },
  {
    id: "rule_uob_ladys_2025_08",
    cardId: "card_uob_ladys",
    ruleName: "4 mpd selected category",
    effectiveFrom: "2025-08-01",
    sourceUrl: milelionUrls.uobLadys,
    sourceType: "milelion_review",
    verifiedAt: cardRuleCatalogueDataset.verifiedAt,
    capPeriod: "calendar_month",
    capAmountMinor: 100_000,
    baseFormula: mpdFormula(0.4, "aggregate_period", 500),
    bonusFormula: bonusFormula(4, 100_000, "calendar_month", 0.4),
    eligibility: {
      channels: ["online", "offline", "contactless"],
      categoryIds: ["category_dining", "category_groceries", "category_transport"],
      selectedCategoryCount: 1,
      merchantCategoryNotes: ["user-selected bonus category", "dining", "travel", "supermarkets", "petrol"],
    },
    exclusion: {
      channels: [],
      excludedMccCodes: ["6012", "6300", "9399"],
      excludedNotes: ["quasi-cash", "insurance", "government services", "fees", "interest", "refunded spend"],
    },
    transferRule: transfer("program_uob_unidollars", 0.5, 5_000),
  },
];

export type SeedCardRuleCatalogueResult = {
  datasetName: string;
  datasetVersion: string;
  cardsSeeded: number;
  rulesSeeded: number;
  redemptionProgramsSeeded: number;
};

export function seedCardRuleCatalogue(connection: DatabaseConnection): SeedCardRuleCatalogueResult {
  connection.sqlite.transaction(() => {
    for (const card of cardSeeds) {
      connection.db
        .insert(cards)
        .values(card)
        .onConflictDoUpdate({
          target: cards.id,
          set: {
            issuer: card.issuer,
            cardName: card.cardName,
            network: card.network,
            currency: card.currency,
            isActive: card.isActive,
          },
        })
        .run();
    }

    for (const redemptionProgram of redemptionProgramSeeds) {
      connection.db
        .insert(redemptionPrograms)
        .values(redemptionProgram)
        .onConflictDoUpdate({
          target: redemptionPrograms.id,
          set: redemptionProgram,
        })
        .run();
    }

    for (const rule of cardRuleSeeds) {
      connection.db
        .insert(cardRules)
        .values(toCardRuleInsert(rule))
        .onConflictDoUpdate({
          target: cardRules.id,
          set: toCardRuleInsert(rule),
        })
        .run();
    }

    connection.db
      .insert(seededDataVersions)
      .values({
        id: cardRuleCatalogueDataset.id,
        datasetName: cardRuleCatalogueDataset.name,
        datasetVersion: cardRuleCatalogueDataset.version,
        sourceUrl: cardRuleCatalogueDataset.sourceUrl,
        verifiedAt: cardRuleCatalogueDataset.verifiedAt,
      })
      .onConflictDoUpdate({
        target: seededDataVersions.id,
        set: {
          datasetName: cardRuleCatalogueDataset.name,
          datasetVersion: cardRuleCatalogueDataset.version,
          sourceUrl: cardRuleCatalogueDataset.sourceUrl,
          verifiedAt: cardRuleCatalogueDataset.verifiedAt,
        },
      })
      .run();
  })();

  return {
    datasetName: cardRuleCatalogueDataset.name,
    datasetVersion: cardRuleCatalogueDataset.version,
    cardsSeeded: cardSeeds.length,
    rulesSeeded: cardRuleSeeds.length,
    redemptionProgramsSeeded: redemptionProgramSeeds.length,
  };
}

export function getCardRuleSeedById(id: string): CardRuleSeed | undefined {
  return cardRuleSeeds.find((rule) => rule.id === id);
}

export function getSeededCardRuleVersion(connection: DatabaseConnection) {
  return connection.db
    .select()
    .from(seededDataVersions)
    .where(eq(seededDataVersions.id, cardRuleCatalogueDataset.id))
    .get();
}

function program(
  id: string,
  issuer: string,
  programName: string,
  pointsName: string,
  milesConversionRatio: string,
  minimumTransferPoints: number,
  transferBlockPoints: number,
  sourceUrl: string,
): RedemptionProgramSeed {
  return {
    id,
    issuer,
    programName,
    pointsName,
    milesConversionRatio,
    minimumTransferPoints,
    transferBlockPoints,
    feeMinor: 2_725,
    sourceUrl,
    verifiedAt: cardRuleCatalogueDataset.verifiedAt,
  };
}

function mpdFormula(
  milesPerDollar: number,
  mode: RuleFormulaJson["rounding"]["mode"],
  unitMinor: number,
): RuleFormulaJson {
  return {
    kind: "mpd",
    milesPerDollar,
    rounding: { mode, unitMinor },
  };
}

function bonusFormula(
  milesPerDollar: number,
  capAmountMinor: number,
  capPeriod: BonusFormulaJson["capPeriod"],
  excessMilesPerDollar: number,
): BonusFormulaJson {
  return {
    ...mpdFormula(milesPerDollar, "floor_per_transaction", 100),
    capAmountMinor,
    capPeriod,
    excessMilesPerDollar,
  };
}

function transfer(
  redemptionProgramId: string,
  pointsPerMile: number,
  minimumTransferPoints: number,
): TransferRuleJson {
  return {
    redemptionProgramId,
    pointsPerMile,
    minimumTransferPoints,
    transferBlockPoints: minimumTransferPoints,
  };
}

function toCardRuleInsert(rule: CardRuleSeed) {
  return {
    id: rule.id,
    cardId: rule.cardId,
    ruleName: rule.ruleName,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    sourceUrl: rule.sourceUrl,
    sourceType: rule.sourceType,
    verifiedAt: rule.verifiedAt,
    capPeriod: rule.capPeriod,
    capAmountMinor: rule.capAmountMinor,
    baseFormulaJson: JSON.stringify(rule.baseFormula),
    bonusFormulaJson: JSON.stringify(rule.bonusFormula),
    eligibilityJson: JSON.stringify(rule.eligibility),
    exclusionJson: JSON.stringify(rule.exclusion),
    transferRuleJson: JSON.stringify(rule.transferRule),
  };
}
