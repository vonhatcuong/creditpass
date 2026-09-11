import { describe, it, expect } from 'vitest';
import { assess } from '../lib/policy';

describe('assess mirrors CreditPolicy.sol', () => {
  it('scores 5 on-time + 5000 collateral + 1000 repaid + 1500 income', () => {
    const a = assess({
      collateralUsd: 5000e6,
      totalRepaidUsd: 1000e6,
      repaymentCount: 5,
      onTimeCount: 5,
      incomeUsd: 1500e6,
    });
    expect(a.score).toBe(1000);
    expect(a.tier).toBe(3);
  });

  it('clamps onTime above repaymentCount', () => {
    const a = assess({
      collateralUsd: 0,
      totalRepaidUsd: 0,
      repaymentCount: 2,
      onTimeCount: 99,
      incomeUsd: 0,
    });
    expect(a.components.onTime).toBeLessThanOrEqual(400);
  });
});
