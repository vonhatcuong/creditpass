# CreditPass Frontend (Vite + React + Tailwind)

New dashboard. Legacy static app stays in `web/` until cutover is verified.

## Develop

```bash
npm run dev:frontend      # http://localhost:5173 (from repo root)
npm run test:frontend
npm run build:frontend
```

Legacy:

```bash
npm run serve:legacy      # serves web/
```

## Local dev data

Copy live artifacts into `frontend/public/` so `/config.local.json` and
`/telemetry.json` resolve in dev and preview:

```bash
mkdir -p frontend/public
cp web/config.local.json frontend/public/config.local.json
cp web/telemetry.json frontend/public/telemetry.json
```

Or run `LOCAL_KEEP_ALIVE=1 npm run local:e2e` first, then copy the two files.

## Notes

- Policy math in `src/lib/policy.ts` mirrors `contracts/sol/CreditPolicy.sol` exactly.
- USD values stay `bigint` on-chain; only the simulator uses `number`.
- Wallet listeners subscribe once (`src/lib/wallet.tsx`) — fixes the duplicate-listener bug in `web/wallet.js`.
- Approvals are finite (exact amount), not infinite.
