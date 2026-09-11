import { useState } from 'react';
import type { CreditProfile } from '../lib/contracts';

export type PipeStatus = 'emitted' | 'attesting' | 'attested' | 'proved' | 'failed';
export interface PipeEvent {
  id: string;
  type: string;
  user: string;
  amount?: string;
  sourceTx: string;
  creditcoinTx?: string;
  status: PipeStatus;
  error?: string;
}

const STAGES = ['Emit', 'Attest', 'Prove', 'Verify'];
const IDX: Record<PipeStatus, number> = { emitted: 0, attesting: 1, attested: 2, proved: 3, failed: 1 };

function spacedType(t: string) {
  return t.replace(/([A-Z])/g, ' $1').trim();
}

function StagePills({ status }: { status: PipeStatus }) {
  const idx = IDX[status] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((label, i) => {
        // Segmented-control language: completed/active = white pill, rest = muted on track.
        // Proved = ink pills (polarity = finality). No color anywhere.
        let cls = 'text-[#adadad]';
        if (status === 'proved') cls = 'bg-[#141414] text-white';
        else if (status === 'failed')
          cls = i < idx ? 'bg-[#141414] text-white' : i === idx ? 'bg-white border border-[#e0e0e0] text-[#141414]' : cls;
        else if (i < idx) cls = 'bg-[#141414] text-white';
        else if (i === idx) cls = 'bg-white border border-[#e0e0e0] text-[#141414]';
        return (
          <span key={label} className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${cls}`}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

// faq-row: full-width canvas-soft bar, rounded-sm, chevron, expands to stage detail.
export function ProofPipeline({ events }: { events: PipeEvent[] }) {
  const [openId, setOpenId] = useState<string | null>(events[0]?.id ?? null);
  if (!events.length)
    return (
      <div className="text-sm text-[#707070]">
        No proof activity yet. Emit events on Sepolia (Actions tab) to watch the pipeline.
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {events.slice(0, 12).map((e) => {
        const open = openId === e.id;
        return (
          <div key={e.id} className="rounded-[16px] bg-[#f3f3f3]">
            <button
              onClick={() => setOpenId(open ? null : e.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              {/* app-icon-squircle motif: 30%-radius tile with the event initial */}
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[30%] bg-[#141414] text-[14px] font-semibold text-white">
                {spacedType(e.type).charAt(0)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold text-[#141414]">
                  {spacedType(e.type)}
                </span>
                <span className="block font-mono text-[12px] text-[#707070]">
                  {e.user.slice(0, 6)}…{e.user.slice(-4)}
                </span>
              </span>
              <span className="ml-auto flex flex-none items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-semibold capitalize text-[#141414]">
                  {e.status}
                </span>
                <span className={`text-[#707070] transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
              </span>
            </button>
            {open && (
              <div className="px-4 pb-4 pl-[60px]">
                <StagePills status={e.status} />
                <div className="mt-2 font-mono text-[12px] text-[#707070]">
                  Sepolia {e.sourceTx.slice(0, 10)}… → Creditcoin {e.creditcoinTx ? e.creditcoinTx.slice(0, 10) + '…' : '—'}
                </div>
                {e.error && <div className="mt-1 text-[12px] text-[#707070]">{e.error}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface FeedItem {
  chain: 'cc' | 'sep';
  type: string;
  amount?: bigint | number;
  block: number;
  tx: string;
  label: string;
}

// compare-table: rows divided by canvas-soft rules, chain as pill-soft.
export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (!items.length)
    return <div className="text-sm text-[#707070]">No activity found in the configured lookback window.</div>;
  return (
    <div>
      {items.map((i, k) => (
        <div key={`${i.tx}-${k}`} className="grid grid-cols-[72px_1fr] items-center gap-3 border-b border-[#f3f3f3] py-3 last:border-0 sm:grid-cols-[96px_1fr_auto]">
          <div className="rounded-full bg-[#f3f3f3] px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#141414]">
            {i.chain === 'cc' ? 'Creditcoin' : 'Sepolia'}
          </div>
          <div className="text-[16px] text-[#141414]">
            <b className="font-semibold">{i.label}</b>
            <div className="mt-0.5 font-mono text-[12px] text-[#707070]">
              block #{i.block} · {i.tx.slice(0, 12)}…
            </div>
          </div>
          <div className="text-[16px] font-semibold tabular-nums text-[#141414]">
            {i.amount != null ? `$${(Number(i.amount) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

export type { CreditProfile };
