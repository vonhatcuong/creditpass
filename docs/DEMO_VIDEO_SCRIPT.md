# CreditPass — Demo video script (3–4 minutes)

Record the real flow on testnet. Show explorers to prove it is not a mock.

1. **(0:00) Hook.** "DeFi lending only works if you already have crypto. CreditPass proves your real
   credit history across chains — and lends against it. No oracle. No bridge."
2. **(0:15) The borrower builds history on Sepolia.** Show `npm run history:simulate`. Point at the
   `CollateralDeposited`, `RepaymentRecorded` and `IncomeReceived` transactions in the Sepolia
   explorer. Say: only this one contract emits history; the recorder restriction prevents self-attested data.
3. **(0:50) Attestcoin in action.** Start `npm run worker:start`. Show the log: waiting for
   attestation → proof generated → `passport updated on Creditcoin: 0x…`. Open the tx on the
   Creditcoin explorer and point at the verified transaction / queryId.
4. **(1:30) The verified passport.** `npm run inspect` (or the dashboard): score, tier, and a credit
   limit **larger than collateral**. Emphasize: every number traces to a proven event.
5. **(2:00) AI underwriting.** `npm run agent:underwrite`. Show the rationale it prints and the
   `LoanOpened` event with the decision hash. Explain that the pool re-checks the on-chain policy,
   so the agent can never exceed the verified limit.
6. **(2:40) Lender view.** Dashboard: pool liquidity, outstanding, loans table, decision URI.
7. **(3:10) Why Attestcoin.** 30 seconds on pull-based reads + continuity proofs, and why that is
   the only way to safely underwrite with cross-chain history.
8. **(3:40) Close.** Roadmap: mainnet/UTXO history, writability, portable passport, fiat rails.
   "CreditPass — proof, not a promise."

## Checklist during recording
- Explorer links visible for every on-chain step.
- Show the raw terminal output (don't cut the proof generation).
- One clean take of the AI decision → loan disbursal.
