import { useState } from 'react';
import { assess, POLICY, TIERS } from '../lib/policy';
import { usd } from '../lib/format';
import { Card, CardTitle } from './ui/card';

export function PolicyView() {
  const [collateral, setCollateral] = useState(5000);
  const [repaid, setRepaid] = useState(1000);
  const [count, setCount] = useState(5);
  const [onTime, setOnTime] = useState(5);
  const [income, setIncome] = useState(1500);

  const v = {
    collateralUsd: collateral * 1e6,
    totalRepaidUsd: repaid * 1e6,
    repaymentCount: count,
    onTimeCount: Math.min(onTime, count),
    incomeUsd: income * 1e6,
  };
  const a = assess(v);

  const slider = (
    id: string,
    label: string,
    val: string,
    input: React.ReactNode,
  ) => (
    <div className="my-3.5">
      <label htmlFor={id} className="mb-1.5 flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="text-[#141414]">{val}</span>
      </label>
      {input}
    </div>
  );

  const cls = 'w-full accent-[#141414]';

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card>
        <CardTitle>Policy simulator</CardTitle>
        {slider('sCollateral', 'Proven collateral', usd(v.collateralUsd), <input id="sCollateral" type="range" min={0} max={20000} step={100} value={collateral} onChange={(e) => setCollateral(Number(e.target.value))} className={cls} />)}
        {slider('sRepaid', 'Total repaid', usd(v.totalRepaidUsd), <input id="sRepaid" type="range" min={0} max={10000} step={50} value={repaid} onChange={(e) => setRepaid(Number(e.target.value))} className={cls} />)}
        {slider('sCount', 'Repayments made', String(count), <input id="sCount" type="range" min={0} max={10} step={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className={cls} />)}
        {slider('sOnTime', 'On-time repayments', String(v.onTimeCount), <input id="sOnTime" type="range" min={0} max={10} step={1} value={onTime} onChange={(e) => setOnTime(Number(e.target.value))} className={cls} />)}
        {slider('sIncome', 'Proven income', usd(v.incomeUsd), <input id="sIncome" type="range" min={0} max={10000} step={100} value={income} onChange={(e) => setIncome(Number(e.target.value))} className={cls} />)}
      </Card>
      <Card>
        <CardTitle>Result</CardTitle>
        <div className="flex justify-between py-2"><span className="text-[#707070]">Score</span><b className="text-[#141414]">{a.score}/1000</b></div>
        <div className="flex justify-between py-2"><span className="text-[#707070]">Tier</span><span>{TIERS[a.tier]}</span></div>
        <div className="flex justify-between py-2">
          <span className="text-[#707070]">Eligible</span>
          {a.score >= POLICY.MIN_ELIGIBLE ? <span className="text-[#141414]">Yes</span> : <span className="text-[#707070]">Not yet (needs 300+)</span>}
        </div>
        <div className="flex justify-between py-2"><span className="text-[#707070]">Credit limit</span><b className="text-[#141414]">{usd(a.limit)}</b></div>
        <div className="flex justify-between py-2">
          <span className="text-[#707070]">Undercollateralized?</span>
          {a.limit > v.collateralUsd ? <span className="text-[#141414]">Yes — limit exceeds collateral</span> : <span className="text-[#707070]">No</span>}
        </div>
        <p className="mt-3 text-xs text-[#707070]">
          Score = on-time (max 400) + repaid (max 200) + collateral (max 250) + income (max 150).
        </p>
      </Card>
    </div>
  );
}
