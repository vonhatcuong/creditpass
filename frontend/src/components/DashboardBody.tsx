import { assess, TIERS, POLICY } from '../lib/policy';
import { usd, usdBig, short } from '../lib/format';
import type { CreditProfile } from '../lib/contracts';
import { Card, CardFeatured, CardTitle } from './ui/card';
import { Badge, BadgePopular } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { ScoreRing } from './ScoreRing';

function Bars({ c }: { c: { onTime: number; repaid: number; collateral: number; income: number } }) {
  const rows: [string, number, number][] = [
    ['On-time repayments', c.onTime, POLICY.MAX_REPAYMENT],
    ['Amount repaid', c.repaid, POLICY.MAX_REPAID],
    ['Collateral', c.collateral, POLICY.MAX_COLLATERAL],
    ['Income', c.income, POLICY.MAX_INCOME],
  ];
  return (
    <div>
      {rows.map(([label, val, max]) => (
        <div key={label} className="my-2.5">
          <div className="mb-1 flex justify-between text-[13px]">
            <span className="text-[#707070]">{label}</span>
            <span>
              {val} / {max}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#f3f3f3]">
            <div
              className="h-full rounded-full bg-[#141414]"
              style={{ width: `${(val / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardBody({
  profile,
  liquidity,
  outstanding,
  loans,
}: {
  profile: CreditProfile;
  liquidity: bigint;
  outstanding: bigint;
  loans: number;
}) {
  const a = assess({
    collateralUsd: Number(profile.collateralUsd),
    totalRepaidUsd: Number(profile.totalRepaidUsd),
    repaymentCount: profile.repaymentCount,
    onTimeCount: profile.onTimeCount,
    incomeUsd: Number(profile.incomeUsd),
  });
  const util = liquidity > 0n ? (Number((outstanding * 1000n) / liquidity) / 10).toFixed(1) + '%' : '0%';
  return (
    <div>
      <div className="mb-5 grid items-center gap-5 md:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="text-[56px] font-semibold leading-none text-[#141414]">
            Credit from history you can prove.
          </h2>
          <p className="mt-3 text-[20px] font-light leading-[1.38] text-[#707070]">
            Real activity on another chain, proven on Creditcoin by the Attestcoin Protocol.
          </p>
          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <div className="text-xl font-semibold text-[#141414]">{a.score}/1000</div>
              <div className="text-xs text-[#707070]">Credit score</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-[#141414]">{usd(a.limit)}</div>
              <div className="text-xs text-[#707070]">Verified limit</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-[#141414]">{usdBig(profile.collateralUsd)}</div>
              <div className="text-xs text-[#707070]">Proven collateral</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-[#141414]">{loans}</div>
              <div className="text-xs text-[#707070]">Loans opened</div>
            </div>
          </div>
        </div>
        <CardFeatured>
          <ScoreRing score={a.score} tier={a.tier} />
          <div className="mt-3 text-xs text-[#707070]">Passport holder</div>
          <div className="font-mono text-sm text-[#141414]">{short(profile.address)}</div>
          <div className="mt-2 text-xs text-[#707070]">Passport last updated at block</div>
          <div className="font-mono text-sm text-[#141414]">
            {profile.lastBlockHeight ? `#${profile.lastBlockHeight}` : 'not verified yet'}
          </div>
        </CardFeatured>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Verified Credit Passport</CardTitle>
          <div className="flex justify-between border-b border-[#f3f3f3] py-2">
            <span className="text-[#707070]">Proven collateral</span>
            <span>{usdBig(profile.collateralUsd)}</span>
          </div>
          <div className="flex justify-between border-b border-[#f3f3f3] py-2">
            <span className="text-[#707070]">Total repaid</span>
            <span>{usdBig(profile.totalRepaidUsd)}</span>
          </div>
          <div className="flex justify-between border-b border-[#f3f3f3] py-2">
            <span className="text-[#707070]">Repayments (on-time)</span>
            <span>
              {profile.repaymentCount} ({profile.onTimeCount} on-time)
            </span>
          </div>
          <div className="flex justify-between border-b border-[#f3f3f3] py-2">
            <span className="text-[#707070]">Proven income</span>
            <span>{usdBig(profile.incomeUsd)}</span>
          </div>
          <div className="flex justify-between border-b border-[#f3f3f3] py-2">
            <span className="text-[#707070]">Tier</span>
            {a.tier === 3 ? <BadgePopular>Prime</BadgePopular> : <Badge>{TIERS[a.tier]}</Badge>}
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#707070]">Verified credit limit</span>
            <span className="text-xl font-semibold text-[#141414]">{usd(a.limit)}</span>
          </div>
        </Card>
        <Card>
          <CardTitle>Score breakdown</CardTitle>
          <Bars c={a.components} />
          <div className="mt-2 flex justify-between">
            <span className="text-[#707070]">Total</span>
            <b>{a.score}/1000</b>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Lending Pool</CardTitle>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex justify-between py-2">
            <span className="text-[#707070]">Total liquidity</span>
            <span>{usdBig(liquidity)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#707070]">Outstanding</span>
            <span>{usdBig(outstanding)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#707070]">Utilization</span>
            <span>{util}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
