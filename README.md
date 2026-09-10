# CreditPass — Verified cross-chain credit on Creditcoin

> **A portable credit passport that turns a borrower's real on-chain history — proven on Creditcoin by the Attestcoin Protocol — into under-collateralized credit. No oracle operator. No bridge. No trusted middleman.**

Built for **BUIDL CTC 2026 Fall** · Track: **AI** (#AI Agents · #Onchain Decisioning · #Verified Data)

---

## The problem

DeFi lending only works for people who already have crypto collateral. The 4.5-trillion-dollar consumer credit market runs on *credit history*, and on-chain there is no such thing. Credit bureaus are centralized; on-chain "credit scores" today are proprietary oracles that ask you to **trust one company's API**.

Creditcoin's founding thesis is on-chain credit for emerging markets. CreditPass is that thesis extended cross-chain.

## The solution

CreditPass lets a borrower **prove** their real history on any chain and turn it into credit on Creditcoin:

1. The borrower builds history on Ethereum Sepolia — locking collateral, repaying loans on time through a lending venue.
2. An off-chain worker proves those events on Creditcoin using the **Attestcoin Protocol readability**. The Block Prover precompile verifies the Merkle + continuity proof **inside the transaction**.
3. `CreditPassportASC` decodes the proven events and writes a **verified Credit Passport** (collateral, repayment streak, income).
4. An **AI underwriting agent** reads the passport — its only trusted input — and autonomously opens a loan from `CreditPool`. The on-chain `CreditPolicy` is the final authority, so the agent can never exceed the verified limit.

## Why Attestcoin is the core, not a checkbox

Attestcoin's unique capability is exactly what a credit protocol needs:

- **Pull-based reads with no source-chain integration.** We can prove repayment events that already happened, on a chain Attestcoin has never touched. No sender contract, no permission, no BD conversation.
- **Continuity proofs anchored to genesis.** A message can be signed correctly and still reference a forked block. Attestcoin proves the *history the event came from*, which is what makes attested credit data safe to lend against.
- **No custodian.** Attestcoin carries proofs, never assets.

Depth of integration (verified in `docs/ATTESTCOIN_INTEGRATION.md`): multiple distinct event types, block-prover precompile verification, replay protection, emitter allow-listing, receipt-status checks, and a proof-driven state machine.

## Architecture

```
Ethereum Sepolia (source chain)                     Creditcoin CC3 Testnet (execution)
────────────────────────────                        ──────────────────────────────────
 CreditHistorySource                                 CreditPassportASC  (ASC, inherits ASCBase)
  emit CollateralDeposited                            └─ Block Prover precompile 0x…FD2
  emit RepaymentRecorded        proof                 CreditPolicy   (deterministic underwriting)
  emit IncomeReceived     ───────────────▶            CreditPool     (lending liquidity + loans)
 MockLendingVenue                                     Mock USD1
        │                                                     ▲
        │ events                                              │ underwrite()
        ▼                                                     │
  Off-chain worker ── wait attestation → ProofBuilder ──► AI underwriting agent
                     (Merkle + continuity proof)          (reads passport, writes decision hash)
```

## Repository layout

```
contracts/sol/
  TestToken.sol            mintable ERC20 (collateral on Sepolia, Mock USD1 on Creditcoin)
  CreditHistorySource.sol  source-chain events (minimal logic, per Attestcoin best practice)
  MockLendingVenue.sol     produces credible repayment history
  CreditPassTypes.sol      CreditProfile + ICreditPassport
  CreditPassportASC.sol    Attestcoin Smart Contract - verifies proofs, stores the passport
  CreditPolicy.sol         transparent score / limit / tier
  CreditPool.sol           lending pool, gated by the verified passport
scripts/                   deploy (Sepolia + Creditcoin), simulate history, inspect
worker/                    off-chain readability worker (Attestcoin proof submission)
agent/                     AI underwriting agent
web/                       static dashboard (no build step)
test/                      Foundry tests (policy, source chain, pool, ASC)
docs/                      integration summary, deck outline, demo script
```

## Quickstart

Requirements: [Foundry](https://getfoundry.sh/), Node 20+, npm. Testnet CTC from the [Creditcoin Discord faucet](https://discord.gg/Gu43zTfmtc); Sepolia ETH from any faucet.

```bash
cp .env.example .env      # fill SOURCE_CHAIN_RPC_URL, DEPLOYER_PRIVATE_KEY, BORROWER_PRIVATE_KEY
npm install
forge build && forge test # 9 passing tests

# 1. deploy source-chain stack (Sepolia)
npm run deploy:source
# 2. deploy Creditcoin stack + authorize the source + seed liquidity
npm run deploy:creditcoin
# 3. generate borrower history on Sepolia (collateral + 5 on-time repayments + income)
npm run history:simulate
# 4. prove that history on Creditcoin  (leave running; takes a few minutes per event)
npm run worker:start
# 5. in another terminal: inspect the verified passport
npm run inspect
# 6. run the AI underwriter (disburses a loan within the verified limit)
npm run agent:underwrite
# 7. dashboard (fill web/config.js first with the deployed addresses)
npm run serve
```

## Dashboard

`web/` is a dependency-light static app (ethers from a CDN, no build step):

- **Dashboard** — verified passport, transparent score breakdown, pool state, live links.
- **Cross-chain Flow** — chronological feed merging Sepolia events and their proven consequences on Creditcoin.
- **Policy Simulator** — drag collateral / repayments / income to see the exact on-chain score & limit (works without any wallet or deployment).
- **Loans** — every loan with the AI underwriter's on-chain decision hash and rationale.

Set `web/config.js` (the deploy scripts also write `deployments.json`).

## Tests

```
forge test
# 10 tests: policy scoring/limits, source-chain recording, recorder gating,
#            pool limit enforcement, underwriter role, ASC authorization
```

## Track & roadmap

- **Now:** readability-only MVP; verified history → underwriting → loan on Creditcoin testnet.
- **Next:** add Ethereum mainnet history (chainKey 3) and Bitcoin UTXO reads; write to source chains via Attestcoin **writability**; make the Credit Passport a portable, queryable primitive any Creditcoin dApp can consume; connect Gluwa's fiat rails (Trugi/NGN) so emerging-market users on-ramp, repay, and build provable credit.

## Team

<!-- fill in: names, roles, bio, links -->

## License

MIT
