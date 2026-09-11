import { CONFIG } from '../lib/config';
import { usePassport } from '../hooks/usePassport';
import { usePool } from '../hooks/usePool';
import { DashboardBody, DashboardSkeleton } from './DashboardBody';
import { Card } from './ui/card';

const DEMO_PROFILE = {
  address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  collateralUsd: 5000_000000n,
  totalRepaidUsd: 1000_000000n,
  repaymentCount: 5,
  onTimeCount: 5,
  incomeUsd: 1500_000000n,
  lastBlockHeight: 0,
  exists: true,
};

export function Dashboard() {
  const configured = Boolean(CONFIG.addresses.passport && CONFIG.addresses.pool);
  const { profile, loading: pLoading } = usePassport();
  const { pool, loading: poolLoading } = usePool();

  if (!configured) {
    return (
      <div>
        <div className="mb-4 rounded-[16px] bg-[#f3f3f3] p-4 text-sm text-[#707070]">
          <b className="text-[#141414]">Demo preview</b> — showing sample data. Deploy contracts and set addresses for live
          on-chain data.
        </div>
        <DashboardBody profile={DEMO_PROFILE} liquidity={1000000_000000n} outstanding={8400_000000n} loans={2} />
      </div>
    );
  }

  if (pLoading || poolLoading) return <DashboardSkeleton />;
  if (!profile || !pool)
    return (
      <Card>
        <div className="text-sm text-[#707070]">
          No passport found for this wallet yet. Build history on Sepolia first.
        </div>
      </Card>
    );
  return (
    <DashboardBody
      profile={profile}
      liquidity={pool.liquidity}
      outstanding={pool.outstanding}
      loans={Math.max(0, pool.nextLoanId - 1)}
    />
  );
}
