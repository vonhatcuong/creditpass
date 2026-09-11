# CreditPass Tailwind + shadcn Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `web/` static dashboard to a Vite + React + Tailwind + shadcn-style UI without breaking on-chain behavior.

**Architecture:** Keep all contract logic byte-for-byte: port `web/policy.js` math, `web/abis.js`, `web/config.js` to TS. New `frontend/` Vite app runs alongside legacy `web/` until cutover. Each chunk ships working UI with Vitest tests.

**Tech Stack:** Vite 6, React 18.3, TypeScript 5.9, Tailwind CSS 4 (@tailwindcss/vite), ethers 6.17 (reuse, no wagmi yet — YAGNI), Radix Slot/Tabs/Dialog/Slider, lucide-react, Vitest + Testing Library. Node 20+ (repo currently Node 25.9.0).

---

## File Structure (target)

Existing to preserve / port (read before touching):
- `web/index.html:1-234` — tab layout to replicate (dashboard/actions/flow/policy/loans)
- `web/app.js:1-792` — all loaders/renderers to port (loadProfile/loadPool/loadLoans/loadActivity/telemetry)
- `web/config.js:1-45` — network + addresses source of truth
- `web/wallet.js:1-92` — EIP-1193 layer (has listener-leak bug to fix)
- `web/policy.js:1-44` — pure math, must mirror `contracts/sol/CreditPolicy.sol` exactly
- `web/toast.js:1-44`, `web/sample.js:1-50`, `web/abis.js` — port as-is
- `package.json:7-19`, `tsconfig.json` — root scripts/tsconfig to extend

New files this plan creates:
- `frontend/package.json` — isolated Vite deps (does not touch root `dependencies`)
- `frontend/vite.config.ts` — react + tailwind plugins, proxy for `config.local.json`/`telemetry.json`
- `frontend/index.html` — Vite entry
- `frontend/src/index.css` — Tailwind + CSS vars mapped from `web/styles.css:1-17`
- `frontend/src/main.tsx`, `frontend/src/App.tsx` — entry + tab router (`#dashboard` hash compatible)
- `frontend/src/lib/config.ts` — port of `web/config.js` + `config.local.json` override
- `frontend/src/lib/policy.ts` — port of `web/policy.js` (usd/short/assess/TIERS/POLICY)
- `frontend/src/lib/contracts.ts` — ethers providers + `queryAll` chunk logic from `web/app.js:82-102`
- `frontend/src/lib/wallet.tsx` — fixed wallet context (single listener subscription)
- `frontend/src/lib/format.ts` — BigInt-safe usd formatting (fixes `Number()` overflow `web/app.js:109-115`)
- `frontend/src/components/ui/{button,card,badge,tabs,slider,dialog,skeleton}.tsx` — shadcn-style primitives
- `frontend/src/components/{Header,ScoreRing,PassportCard,PoolCard,ProofPipeline,ActivityFeed,PolicySimulator,LoanTable,ActionPanels,Toaster}.tsx`
- `frontend/src/hooks/{usePassport,usePool,useLoans,useActivity,useTelemetry}.ts`
- `frontend/src/test/{policy.test.ts,wallet.test.tsx,smoke.test.tsx}`

---

## Chunk 1: Scaffold — Vite app runs next to legacy web

### Task 1: Scaffold frontend package

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Write the failing smoke test**

```tsx
// frontend/src/test/smoke.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App shell', () => {
  it('renders CreditPass header', () => {
    render(<App />);
    expect(screen.getByText(/CreditPass/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=frontend 2>&1 | head -n 30` (or `npx vitest run src/test/smoke.test.tsx` inside `frontend/`)
Expected: FAIL with "Cannot find module '../App'" / "no such file".

- [ ] **Step 3: Create minimal implementation**

```json
// frontend/package.json
{
  "name": "creditpass-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 5173",
    "test": "vitest run"
  },
  "dependencies": {
    "ethers": "^6.17.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^14.2.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "5.9.3",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: { outDir: 'dist' },
});
```

```css
/* frontend/src/index.css */
@import "tailwindcss";
:root {
  --cp-bg: #070b11;
  --cp-panel: #111927;
  --cp-line: #22314a;
  --cp-text: #e8eef7;
  --cp-muted: #8ea1bc;
  --cp-accent: #4ade80;
  --cp-accent2: #38bdf8;
}
body { background: var(--cp-bg); color: var(--cp-text); }
```

```tsx
// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import '@testing-library/jest-dom/vitest';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

```tsx
// frontend/src/App.tsx (stub, full tabs come in Chunk 2)
export default function App() {
  return (
    <div className="min-h-screen bg-[#070b11] text-slate-100">
      <header className="border-b border-slate-800 p-4">CreditPass</header>
      <main className="p-4">scaffold</main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm install --prefix frontend
npx vitest run src/test/smoke.test.tsx --dir frontend
```
Expected: PASS (1 passed). Then `npx tsc --noEmit -p frontend` passes with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/index.css frontend/src/test/smoke.test.tsx
git commit -m "feat(frontend): scaffold Vite React Tailwind app alongside legacy web"
```

### Task 2: Port pure libs (policy/config/format) with tests

**Files:**
- Create: `frontend/src/lib/policy.ts`
- Create: `frontend/src/lib/config.ts`
- Create: `frontend/src/lib/format.ts`
- Test: `frontend/src/test/policy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/test/policy.test.ts
import { describe, it, expect } from 'vitest';
import { assess } from '../lib/policy';

describe('assess mirrors CreditPolicy.sol', () => {
  it('scores 5 on-time + 5000 collateral + 1000 repaid + 1500 income', () => {
    const a = assess({ collateralUsd: 5000e6, totalRepaidUsd: 1000e6, repaymentCount: 5, onTimeCount: 5, incomeUsd: 1500e6 });
    expect(a.score).toBe(1000);
    expect(a.tier).toBe(3);
  });
  it('clamps onTime above repaymentCount', () => {
    const a = assess({ collateralUsd: 0, totalRepaidUsd: 0, repaymentCount: 2, onTimeCount: 99, incomeUsd: 0 });
    expect(a.components.onTime).toBeLessThanOrEqual(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/policy.test.ts --dir frontend`
Expected: FAIL "Cannot find module '../lib/policy'".

- [ ] **Step 3: Write minimal implementation (port web/policy.js:1-44 exactly, BigInt-safe format separately)**

```ts
// frontend/src/lib/policy.ts — direct port of web/policy.js, no behavior change
export const TIERS = ['Unscored', 'Starter', 'Established', 'Prime'] as const;
export const POLICY = { POINTS_PER_ON_TIME: 80, MAX_REPAYMENT: 400, POINTS_PER_50_REPAID: 100, MAX_REPAID: 200, POINTS_PER_100_COLLATERAL: 50, MAX_COLLATERAL: 250, POINTS_PER_100_INCOME: 25, MAX_INCOME: 150, MIN_ELIGIBLE: 300 };
export const clamp = (v: number) => Math.max(0, Math.min(1000, Math.floor(v)));
export function assess(p: { collateralUsd: number; totalRepaidUsd: number; repaymentCount: number; onTimeCount: number; incomeUsd: number }) {
  const onTime = clamp(Math.min((p.onTimeCount || 0) * POLICY.POINTS_PER_ON_TIME, POLICY.MAX_REPAYMENT));
  const repaid = Math.min(Math.floor(((p.totalRepaidUsd || 0) * POLICY.POINTS_PER_50_REPAID) / (50 * 1e6)), POLICY.MAX_REPAID);
  const collateral = Math.min(Math.floor(((p.collateralUsd || 0) * POLICY.POINTS_PER_100_COLLATERAL) / (100 * 1e6)), POLICY.MAX_COLLATERAL);
  const income = Math.min(Math.floor(((p.incomeUsd || 0) * POLICY.POINTS_PER_100_INCOME) / (100 * 1e6)), POLICY.MAX_INCOME);
  const score = clamp(onTime + repaid + collateral + income);
  const tier = score >= 800 ? 3 : score >= 600 ? 2 : score >= 300 ? 1 : 0;
  let limit = 0;
  if (score >= POLICY.MIN_ELIGIBLE) {
    limit = Math.floor((p.collateralUsd || 0) / 2) + (score - POLICY.MIN_ELIGIBLE) * 20 * 1e6;
    const cap = (p.incomeUsd || 0) * 2 + (p.collateralUsd || 0);
    if (limit > cap) limit = cap;
  }
  return { score, tier, limit, components: { onTime, repaid, collateral, income } };
}
```

```ts
// frontend/src/lib/format.ts — BigInt-safe, fixes web/app.js:109-115 Number() overflow
export const short = (a?: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '—');
export const usd = (n: bigint | number) => '$' + (Number(n) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 });
export const usdBig = (n: bigint) => '$' + (n / 1_000_000n).toLocaleString('en-US');
```

```ts
// frontend/src/lib/config.ts — port web/config.js:11-45 + local override from web/app.js:55-68
export const CONFIG = {
  creditcoin: { key: 'creditcoin', name: 'Creditcoin CC3 Testnet', rpc: 'https://rpc.cc3-testnet.creditcoin.network', explorer: 'https://creditcoin-testnet.blockscout.com', chainId: 102031, nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 }, lookback: 40000, chunk: 4000 },
  sepolia: { key: 'sepolia', name: 'Ethereum Sepolia', rpc: 'https://ethereum-sepolia-rpc.publicnode.com', explorer: 'https://sepolia.etherscan.io', chainId: 11155111, nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, lookback: 4000, chunk: 2000 },
  addresses: { passport: '', policy: '', pool: '', usd: '', source: '', venue: '', collateral: '' },
  borrower: '', refreshMs: 15000,
} as const;
export async function applyLocalOverrides(cfg = CONFIG as any) {
  try {
    const res = await fetch('/config.local.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const o = await res.json();
    if (o.addresses) Object.assign(cfg.addresses, o.addresses);
    return true;
  } catch { return false; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/policy.test.ts --dir frontend`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/policy.ts frontend/src/lib/config.ts frontend/src/lib/format.ts frontend/src/test/policy.test.ts
git commit -m "feat(frontend): port policy math and config with tests"
```

---

## Chunk 2: Design system + app shell (header/tabs/toast/wallet)

### Task 3: shadcn-style primitives (button/card/badge/tabs/skeleton)

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/ui/skeleton.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/test/ui.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/button';
import { it, expect } from 'vitest';
import React from 'react';
it('renders button', () => { render(<Button>Connect</Button>); expect(screen.getByText('Connect')).toBeInTheDocument(); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/ui.test.tsx --dir frontend`
Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/ui/button.tsx
import React from 'react';
import { cn } from '../../lib/cn';
export function Button({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={cn('rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-45', className)} />;
}
// frontend/src/lib/cn.ts
export const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
```

Card/Badge/Skeleton follow same pattern (div with `rounded-2xl border border-slate-800 bg-slate-900/60` etc.). Keep Tailwind utilities only, no Radix yet.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/ui.test.tsx --dir frontend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui frontend/src/lib/cn.ts frontend/src/test/ui.test.tsx
git commit -m "feat(frontend): add shadcn-style primitives"
```

### Task 4: Wallet context (fix listener leak) + header + tabs + toaster

**Files:**
- Create: `frontend/src/lib/wallet.tsx`
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/components/Toaster.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/test/wallet.test.tsx`

Port from `web/wallet.js:32-53` but subscribe listeners once in `useEffect` (fixes duplicate `ethereum.on` on every `connect()`). Tabs replicate `web/index.html:25-31` with `role=tablist` + `aria-selected` (fixes a11y gap). Toaster uses `role=status aria-live=polite` (fixes `web/toast.js:5-25`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/test/wallet.test.tsx — connect wires single listener set
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { WalletProvider, useWallet } from '../lib/wallet';
import React from 'react';
describe('wallet', () => {
  it('exposes connect/disconnect', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: ({ children }: any) => <WalletProvider>{children}</WalletProvider> });
    expect(result.current.account).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/wallet.test.tsx --dir frontend`
Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/lib/wallet.tsx — single-subscription fix
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BrowserProvider } from 'ethers';
import { CONFIG } from './config';
type Net = typeof CONFIG.creditcoin | typeof CONFIG.sepolia;
const Ctx = createContext<{ account: string | null; chainId: number | null; connect(): Promise<void>; disconnect(): void; ensureChain(n: Net): Promise<void> }>({ account: null, chainId: null, connect: async () => {}, disconnect: () => {}, ensureChain: async () => {} });
export const useWallet = () => useContext(Ctx);
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth?.on) return;
    const onAcct = (a: string[]) => setAccount(a[0] || null);
    const onChain = (hex: string) => setChainId(Number(hex));
    eth.on('accountsChanged', onAcct);
    eth.on('chainChanged', onChain);
    return () => { eth.removeListener?.('accountsChanged', onAcct); eth.removeListener?.('chainChanged', onChain); };
  }, []);
  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('No wallet detected. Please install MetaMask.');
    const p = new BrowserProvider(eth);
    const accts: string[] = await p.send('eth_requestAccounts', []);
    setProvider(p); setAccount(accts[0] || null);
    setChainId(Number((await p.getNetwork()).chainId));
  }, []);
  const disconnect = useCallback(() => { setAccount(null); setChainId(null); setProvider(null); }, []);
  const ensureChain = useCallback(async (n: Net) => {
    const eth = (window as any).ethereum;
    const hex = '0x' + n.chainId.toString(16);
    try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }); }
    catch (e: any) {
      if (e?.code === 4902) await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: n.name, nativeCurrency: n.nativeCurrency, rpcUrls: [n.rpc], blockExplorerUrls: n.explorer ? [n.explorer] : [] }] });
      else throw e;
    }
    setChainId(n.chainId);
  }, []);
  return <Ctx.Provider value={{ account, chainId, connect, disconnect, ensureChain }}>{children}</Ctx.Provider>;
}
```

Header/Tabs/Toaster: Tailwind versions of `web/index.html:10-31` + `web/styles.css:40-86`. Tabs use hash routing (`#dashboard,#actions,#flow,#policy,#loans`) compatible with `web/app.js:712-722`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/wallet.test.tsx --dir frontend`
Expected: PASS. Manual: `npm run dev --prefix frontend`, open http://localhost:5173, header + 5 tabs render.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/wallet.tsx frontend/src/components/Header.tsx frontend/src/components/Toaster.tsx frontend/src/App.tsx frontend/src/test/wallet.test.tsx
git commit -m "feat(frontend): wallet context with single-subscription fix plus shell"
```

---

## Chunk 3: Dashboard — passport + score + pool (the demo core)

### Task 5: Data hooks (passport/pool with BigInt-safe parsing)

**Files:**
- Create: `frontend/src/lib/contracts.ts`
- Create: `frontend/src/hooks/usePassport.ts`
- Create: `frontend/src/hooks/usePool.ts`

Port loaders `web/app.js:104-135` but keep `bigint` (do not `Number(raw)`) — fixes overflow. Reuse `queryAll` chunk/backoff `web/app.js:82-102`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/test/contracts.test.ts
import { describe, it, expect } from 'vitest';
import { parseProfile } from '../lib/contracts';
describe('parseProfile', () => {
  it('keeps bigint for usd fields', () => {
    const p = parseProfile(['5000000000', '1000000000', '5', '5', '1500000000', '123', true] as any, '0xabc');
    expect(typeof p.collateralUsd).toBe('bigint');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/contracts.test.ts --dir frontend`
Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/contracts.ts (excerpt)
import { Contract, JsonRpcProvider } from 'ethers';
export function parseProfile(raw: any, address: string) {
  return { address, collateralUsd: BigInt(raw[0]), totalRepaidUsd: BigInt(raw[1]), repaymentCount: Number(raw[2]), onTimeCount: Number(raw[3]), incomeUsd: BigInt(raw[4]), lastBlockHeight: Number(raw[5]), exists: Boolean(raw[6]) };
}
export async function queryAll(contract: any, eventName: string, from: number, to: number, chunk: number) {
  const out: any[] = []; let size = chunk; let start = from;
  while (start <= to) {
    const end = Math.min(start + size - 1, to);
    try { out.push(...await contract.queryFilter(eventName, start, end)); start = end + 1; size = chunk; }
    catch { if (size > 100) size = Math.floor(size / 2); else { start = end + 1; size = chunk; } }
  }
  return out;
}
```

Hooks wrap `Contract` + `useEffect` polling at `CONFIG.refreshMs` (same as `web/app.js:789`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/contracts.test.ts --dir frontend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/contracts.ts frontend/src/hooks/usePassport.ts frontend/src/hooks/usePool.ts frontend/src/test/contracts.test.ts
git commit -m "feat(frontend): BigInt-safe contract hooks"
```

### Task 6: Dashboard UI (ScoreRing/PassportCard/PoolCard)

**Files:**
- Create: `frontend/src/components/ScoreRing.tsx`
- Create: `frontend/src/components/PassportCard.tsx`
- Create: `frontend/src/components/PoolCard.tsx`

Replicates `web/index.html:37-108` hero + grid. ScoreRing is SVG circle from `web/index.html:55-64` restyled with Tailwind + animated `stroke-dashoffset`. PoolCard adds skeleton loading (fixes `web/app.js:735-750` bare "loading…" pill). Mobile: `grid-cols-1 md:grid-cols-2`.

- [ ] **Step 1: Write the failing test**

```tsx
// render <ScoreRing score={1000}/> shows 1000; <PassportCard/> shows skeleton when loading
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/test/dashboard.test.tsx --dir frontend`, FAIL not found.
- [ ] **Step 3: Implement components** (port `renderProfile/renderBars` `web/app.js:200-242` to JSX + Tailwind bars).
- [ ] **Step 4: Run test to verify it passes** — PASS + manual `npm run dev`, compare against legacy `npx serve web` side-by-side.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): dashboard passport score pool UI"`

---

## Chunk 4: Flow + Policy + Loans + Actions

### Task 7: Cross-chain Flow (pipeline + feed)

**Files:**
- Create: `frontend/src/components/ProofPipeline.tsx`
- Create: `frontend/src/components/ActivityFeed.tsx`
- Create: `frontend/src/hooks/useActivity.ts`

Port `web/app.js:157-195,328-394` (telemetry stages Emit→Attest→Prove→Verify + feed). Fix: responsive `feed-item` grid (`web/styles.css:173` cramped on 360px → `grid-cols-[72px_1fr] sm:grid-cols-[96px_1fr_auto]`), horizontal scroll not needed. Empty states with illustration text (not bare "No activity").

Steps: test `proofPipeline.test.tsx` (proved → 4 done chips; failed → error chip) → FAIL → implement → PASS → commit.

### Task 8: Policy Simulator + Loans + Actions

**Files:**
- Create: `frontend/src/components/PolicySimulator.tsx`
- Create: `frontend/src/components/LoanTable.tsx`
- Create: `frontend/src/components/ActionPanels.tsx`

- PolicySimulator: port sliders `web/index.html:161-180` + `web/app.js:659-684` to Radix Slider with `<label htmlFor>` (fixes a11y), live `assess()` from Chunk 1.
- LoanTable: port `web/app.js:244-281` + `web/index.html:204-208` but wrap in `overflow-x-auto` (fixes `web/styles.css:151-155` mobile overflow), row click opens Dialog (port `showLoan` `web/app.js:633-652`), Repay button only for own active loans, partial-repay input deferred (document as follow-up, keep full-owed to match contract).
- ActionPanels: port `borrowerForm/underwriterForm/sourceForm` `web/app.js:478-515` + tx handlers `526-628` with `withTx`-equivalent toaster + finite `approve(amount)` instead of infinite (fixes `web/app.js:517-524`).

Steps per component: failing test → FAIL → implement → PASS (`npx vitest run`) → commit each (`feat(frontend): policy simulator`, `feat(frontend): loans table`, `feat(frontend): action panels`).

---

## Chunk 5: Cutover, polish, docs

### Task 9: Cutover + regression + docs

**Files:**
- Modify: `package.json` (add `dev:frontend`, `build:frontend`, keep `serve` for legacy until verified)
- Modify: `frontend/vite.config.ts` (serve `config.local.json`, `telemetry.json`, `rationales/*` from `web/` during dev via `publicDir` symlink or `server.fs`)
- Create: `frontend/README.md`
- Modify: `docs/DEMO_VIDEO_SCRIPT.md` if routes changed (hash routes unchanged, no update needed otherwise)

- [ ] **Step 1: Write the failing e2e check**

```bash
# legacy still passes
forge test
# new frontend builds + tests
npm run build --prefix frontend && npm run test --prefix frontend
```

Expected initially: FAIL on build (missing env) — then fix `frontend/.env.example` + `publicDir`.

- [ ] **Step 2: Run to verify it fails** — record output.
- [ ] **Step 3: Implement cutover**

```json
// root package.json additions (do not delete web scripts yet)
{ "scripts": { "dev:frontend": "npm run dev --prefix frontend", "build:frontend": "npm run build --prefix frontend", "serve:legacy": "npx --yes serve web" } }
```

Verify: `LOCAL_KEEP_ALIVE=1 npm run local:e2e` then point `frontend/src/lib/config.ts` at `config.local.json`, confirm passport → loan flow renders in new UI.

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
forge test
npm run build --prefix frontend
npm run test --prefix frontend
```
Expected: `forge: 13 passed`, `vite build: built in Xs`, `vitest: all passed`.

- [ ] **Step 5: Commit**

```bash
git add package.json frontend/README.md
git commit -m "chore(frontend): cutover scripts and docs, legacy web retained"
```

---

## Verification checklist (run before claiming done — @superpowers:verification-before-completion)

- `forge build && forge test` — 13 passing, untouched contracts
- `npx tsc --noEmit -p frontend` — no type errors
- `npm run build --prefix frontend` — Vite build succeeds
- `npm run test --prefix frontend` — all Vitest suites pass
- Manual: `npm run local:e2e` + `npm run dev:frontend` — dashboard shows same score/limit as legacy `npx serve web` for same `config.local.json`
- A11y spot-check: tabs have `aria-selected`, sliders labeled, dialog closes on Esc, toasts have `role=status`

## Out of scope (YAGNI — do not add in this plan)

- Switching ethers → wagmi/viem, adding RainbowKit (keep `wallet.tsx`)
- On-chain contract fixes (multi-loan cap, accounting) — separate plan
- Backend indexer/subgraph for activity (keep direct RPC `queryFilter`)
- i18n Vietnamese, dark/light toggle beyond CSS vars, PWA
