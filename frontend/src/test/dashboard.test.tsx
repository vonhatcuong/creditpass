import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ScoreRing } from '../components/ScoreRing';
import { DashboardBody } from '../components/DashboardBody';

describe('dashboard', () => {
  it('renders score ring value', () => {
    render(<ScoreRing score={1000} tier={3} />);
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('renders passport + pool from profile', () => {
    render(
      <DashboardBody
        profile={{
          address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          collateralUsd: 5000_000000n,
          totalRepaidUsd: 1000_000000n,
          repaymentCount: 5,
          onTimeCount: 5,
          incomeUsd: 1500_000000n,
          lastBlockHeight: 0,
          exists: true,
        }}
        liquidity={1000000_000000n}
        outstanding={8400_000000n}
        loans={2}
      />,
    );
    expect(screen.getByText(/Verified Credit Passport/i)).toBeInTheDocument();
    expect(screen.getByText(/Lending Pool/i)).toBeInTheDocument();
  });
});
