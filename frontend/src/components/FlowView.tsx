import { useEffect, useState } from 'react';
import { CONFIG } from '../lib/config';
import { ProofPipeline, ActivityFeed, type PipeEvent, type FeedItem } from './FlowParts';
import { Card, CardTitle } from './ui/card';

const SAMPLE_PIPE: PipeEvent[] = [
  { id: 'e4', type: 'CollateralDeposited', user: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', amount: '5000000000', sourceTx: '0xd5', creditcoinTx: '0xd6', status: 'proved' },
  { id: 'e3', type: 'RepaymentRecorded', user: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', amount: '200000000', sourceTx: '0xd3', creditcoinTx: '0xd4', status: 'proved' },
  { id: 'e1', type: 'IncomeReceived', user: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', amount: '1500000000', sourceTx: '0xd1', status: 'attesting' },
];

const SAMPLE_FEED: FeedItem[] = [
  { chain: 'cc', type: 'LoanOpened', block: 42210, tx: '0xc1', label: 'Loan #1 opened · verified score 1000', amount: 8000_000000 },
  { chain: 'sep', type: 'RepaymentRecorded', block: 8851200, tx: '0xc3', label: 'Repaid on Sepolia (on-time)', amount: 200_000000 },
  { chain: 'sep', type: 'CollateralDeposited', block: 8850000, tx: '0xc8', label: 'Locked collateral on Sepolia', amount: 5000_000000 },
];

const STAGE_IDX = { emitted: 0, attesting: 1, attested: 2, proved: 3, failed: 1 } as const;

// segmented-control stepper: canvas-soft stadium track, white pill = done/active.
function Stepper({ events, loans }: { events: PipeEvent[]; loans: number }) {
  const atLeast = (n: number) => events.filter((e) => (STAGE_IDX[e.status] ?? 0) >= n).length;
  const steps = [
    { label: 'Emit', sub: 'Sepolia event', count: events.length },
    { label: 'Attest', sub: 'Attestors agree', count: atLeast(1) },
    { label: 'Prove', sub: 'Proof submitted', count: atLeast(2) },
    { label: 'Verify', sub: 'Precompile 0xFD2', count: events.filter((e) => e.status === 'proved').length },
    { label: 'Act', sub: 'Loan opened', count: loans },
  ];
  const firstTodo = steps.findIndex((s) => s.count === 0);
  const active = firstTodo === -1 ? steps.length - 1 : firstTodo;
  return (
    <div role="list" aria-label="Proof progress" className="flex flex-col gap-1 rounded-[24px] bg-[#f3f3f3] p-1.5 sm:flex-row sm:rounded-full">
      {steps.map((s, i) => {
        const on = i <= active && (s.count > 0 || i === active);
        return (
          <div
            key={s.label}
            role="listitem"
            className={`flex-1 rounded-[16px] px-4 py-2.5 text-center sm:rounded-full ${on ? 'bg-white' : ''}`}
          >
            <div className={`text-[14px] font-semibold ${on ? 'text-[#141414]' : 'text-[#adadad]'}`}>
              {s.label}
            </div>
            <div className={`text-[12px] ${on ? 'text-[#707070]' : 'text-[#adadad]'}`}>
              {s.count > 0 ? `${s.count} × ${s.sub.toLowerCase()}` : s.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FlowView() {
  const configured = Boolean(CONFIG.addresses.passport && CONFIG.addresses.pool);
  const [events, setEvents] = useState<PipeEvent[]>(SAMPLE_PIPE);
  const [feed, setFeed] = useState<FeedItem[]>(SAMPLE_FEED);

  useEffect(() => {
    if (configured) {
      fetch('/telemetry.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.events) setEvents(d.events.slice().reverse().slice(0, 12));
        })
        .catch(() => {});
    }
  }, [configured]);

  const loans = feed.filter((f) => f.type === 'LoanOpened').length;

  return (
    <div>
      {/* Centered lockup: 652 heading, 300 light subtitle, terminal period. */}
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <div className="text-[14px] text-[#707070]">Cross-chain flow.</div>
        <h2 className="mt-2 text-[44px] font-semibold leading-none text-[#141414]">
          From Sepolia event to Creditcoin credit.
        </h2>
        <p className="mt-3 text-[20px] font-light leading-[1.38] text-[#707070]">
          Every repayment is attested, proven, and verified on-chain before it becomes credit.
        </p>
      </div>

      <Stepper events={events} loans={loans} />

      <Card className="mb-4 mt-8">
        <CardTitle>Proof pipeline.</CardTitle>
        <p className="-mt-2 mb-4 text-[14px] text-[#707070]">
          Each source event travels Emit → Attest → Prove → Verify.
        </p>
        {!configured && <div className="mb-2 text-xs text-[#707070]">Demo preview — sample telemetry.</div>}
        <ProofPipeline events={events} />
      </Card>
      <Card>
        <CardTitle>Live cross-chain activity.</CardTitle>
        <p className="-mt-2 mb-4 text-[14px] text-[#707070]">
          Sepolia events and their proven consequences on Creditcoin, newest first.
        </p>
        <ActivityFeed items={feed} />
      </Card>
    </div>
  );
}
