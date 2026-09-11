import { describe, it, expect } from 'vitest';
import { parseProfile } from '../lib/contracts';

describe('parseProfile', () => {
  it('keeps bigint for usd fields', () => {
    const p = parseProfile(
      ['5000000000', '1000000000', '5', '5', '1500000000', '123', true] as any,
      '0xabc',
    );
    expect(typeof p.collateralUsd).toBe('bigint');
    expect(p.collateralUsd).toBe(5000000000n);
    expect(p.repaymentCount).toBe(5);
  });
});
