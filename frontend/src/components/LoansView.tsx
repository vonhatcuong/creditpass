import { useEffect, useState } from 'react';
import { CONFIG } from '../lib/config';
import { usdBig, short } from '../lib/format';
import { Card, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export interface Loan {
  id: number;
  borrower: string;
  principal: bigint;
  owed: bigint;
  active: boolean;
  decisionHash: string;
  rationaleURI: string;
}

const SAMPLE_LOANS: Loan[] = [
  { id: 1, borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', principal: 8000_000000n, owed: 8400_000000n, active: true, decisionHash: '0xa1', rationaleURI: 'ipfs://creditpass/demo-1' },
  { id: 2, borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', principal: 3000_000000n, owed: 0n, active: false, decisionHash: '0xb2', rationaleURI: 'ipfs://creditpass/demo-2' },
];

export function LoansView() {
  const configured = Boolean(CONFIG.addresses.pool);
  const [loans] = useState<Loan[]>(SAMPLE_LOANS);
  const [open, setOpen] = useState<Loan | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);

  return (
    <Card>
      <CardTitle>Loans</CardTitle>
      {!configured && <div className="mb-2 text-xs text-[#707070]">Demo preview — sample loans.</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[#707070]">
              <th className="border-b border-[#f3f3f3] px-2 py-2">#</th>
              <th className="border-b border-[#f3f3f3] px-2 py-2">Borrower</th>
              <th className="border-b border-[#f3f3f3] px-2 py-2">Principal</th>
              <th className="border-b border-[#f3f3f3] px-2 py-2">Owed</th>
              <th className="border-b border-[#f3f3f3] px-2 py-2">Status</th>
              <th className="border-b border-[#f3f3f3] px-2 py-2">Rationale / action</th>
            </tr>
          </thead>
          <tbody>
            {loans.slice().reverse().map((l) => (
              <tr key={l.id} className="cursor-pointer hover:bg-[#f3f3f3]" onClick={() => setOpen(l)}>
                <td className="border-b border-[#f3f3f3] px-2 py-2">{l.id}</td>
                <td className="border-b border-[#f3f3f3] px-2 py-2 font-mono">{short(l.borrower)}</td>
                <td className="border-b border-[#f3f3f3] px-2 py-2">{usdBig(l.principal)}</td>
                <td className="border-b border-[#f3f3f3] px-2 py-2">{usdBig(l.owed)}</td>
                <td className="border-b border-[#f3f3f3] px-2 py-2">
                  <Badge>{l.active ? 'Active' : 'Repaid'}</Badge>
                </td>
                <td className="border-b border-[#f3f3f3] px-2 py-2 font-mono text-xs">{l.rationaleURI}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div role="dialog" aria-modal="true" aria-label={`Loan ${open.id}`} className="w-full max-w-xl rounded-[24px] border border-[#f0f0f0] bg-white p-5">
            <div className="flex items-center justify-between">
              <b>Loan #{open.id} · decision</b>
              <button aria-label="Close" onClick={() => setOpen(null)} className="text-xl text-[#707070]">✕</button>
            </div>
            <div className="mt-3 flex justify-between py-1.5 text-sm"><span className="text-[#707070]">Borrower</span><span className="font-mono">{open.borrower}</span></div>
            <div className="mt-1 flex justify-between py-1.5 text-sm"><span className="text-[#707070]">Decision hash</span><span className="font-mono">{open.decisionHash}</span></div>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => setOpen(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
