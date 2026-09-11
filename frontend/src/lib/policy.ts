// Direct port of web/policy.js — must mirror contracts/sol/CreditPolicy.sol exactly.
// No behavior change in this migration; BigInt-safe formatting lives in format.ts.

export const TIERS = ['Unscored', 'Starter', 'Established', 'Prime'] as const;

export const POLICY = {
  POINTS_PER_ON_TIME: 80,
  MAX_REPAYMENT: 400,
  POINTS_PER_50_REPAID: 100,
  MAX_REPAID: 200,
  POINTS_PER_100_COLLATERAL: 50,
  MAX_COLLATERAL: 250,
  POINTS_PER_100_INCOME: 25,
  MAX_INCOME: 150,
  MIN_ELIGIBLE: 300,
};

export const clamp = (v: number) => Math.max(0, Math.min(1000, Math.floor(v)));

export interface ProfileInput {
  collateralUsd: number;
  totalRepaidUsd: number;
  repaymentCount: number;
  onTimeCount: number;
  incomeUsd: number;
}

export function assess(p: ProfileInput) {
  const onTime = clamp(Math.min((p.onTimeCount || 0) * POLICY.POINTS_PER_ON_TIME, POLICY.MAX_REPAYMENT));
  const repaid = Math.min(
    Math.floor(((p.totalRepaidUsd || 0) * POLICY.POINTS_PER_50_REPAID) / (50 * 1e6)),
    POLICY.MAX_REPAID,
  );
  const collateral = Math.min(
    Math.floor(((p.collateralUsd || 0) * POLICY.POINTS_PER_100_COLLATERAL) / (100 * 1e6)),
    POLICY.MAX_COLLATERAL,
  );
  const income = Math.min(
    Math.floor(((p.incomeUsd || 0) * POLICY.POINTS_PER_100_INCOME) / (100 * 1e6)),
    POLICY.MAX_INCOME,
  );
  const score = clamp(onTime + repaid + collateral + income);

  const tier = score >= 800 ? 3 : score >= 600 ? 2 : score >= 300 ? 1 : 0;
  let limit = 0;
  if (score >= POLICY.MIN_ELIGIBLE) {
    limit = Math.floor((p.collateralUsd || 0) / 2) + (score - POLICY.MIN_ELIGIBLE) * 20 * 1e6;
    const cap = (p.incomeUsd || 0) * 2 + (p.collateralUsd || 0);
    if (limit > cap) limit = cap;
  }
  return { score, tier, limit, components: { onTime, repaid, collateral, income } };
}
