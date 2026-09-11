import { TIERS } from '../lib/policy';

export function ScoreRing({ score, tier }: { score: number; tier: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(1000, Math.max(0, score)) / 1000) * c;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 flex-none">
        <svg width="132" height="132" className="-rotate-90">
          <circle cx="66" cy="66" r={r} stroke="#f0f0f0" strokeWidth="10" fill="none" />
          <circle
            cx="66"
            cy="66"
            r={r}
            stroke="#141414"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={String(c)}
            strokeDashoffset={String(off)}
            style={{ transition: 'stroke-dashoffset .5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <b className="text-3xl text-[#141414]">{score}</b>
          <span className="text-[11px] tracking-widest text-[#707070]">{TIERS[tier].toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
