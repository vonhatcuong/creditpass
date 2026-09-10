# CreditPass × Attestcoin Protocol — Technical Integration Summary

This document is the required **Attestcoin Protocol Integration Summary**. It explains what is
integrated, where the code lives, how the proof flow works, and why the integration is a *core
feature* of CreditPass rather than an add-on.

## 1. What Attestcoin does for CreditPass

CreditPass is a credit passport for **undercollateralized lending**. The entire product premise is
that a borrower's history comes from chains other than Creditcoin. That history must be trusted
enough to lend real money against. CreditPass uses Attestcoin **readability** to convert that
off-chain (other-chain) history into facts that are *proven on-chain*, with no trusted oracle
operator and without deploying anything on the source chain.

Without Attestcoin there is no product: there is no other way to safely accept cross-chain repayment
history as loan collateral.

## 2. Scope

- Uses **Attestcoin Readability** only (the capability live at the time of building). Writability is
  not used; nothing in the MVP needs to write back to a source chain.
- Source chain: **Ethereum Sepolia (`chainKey = 1`)**, the native testnet supported by the SDK.
- Execution chain: **Creditcoin CC3 Testnet**.
- No token bridge, no custodian, no oracle middleware.

## 3. On-chain components and where they are

| Component | Network | File | Role |
|---|---|---|---|
| `CreditHistorySource` | Sepolia | `contracts/sol/CreditHistorySource.sol` | Emits the provable events. Minimal logic, by design. |
| `MockLendingVenue` | Sepolia | `contracts/sol/MockLendingVenue.sol` | Produces credible repayment history via an authorized recorder. |
| `CreditPassportASC` | Creditcoin | `contracts/sol/CreditPassportASC.sol` | The **Attestcoin Smart Contract**. Verifies proofs and stores the passport. |
| `CreditPolicy` | Creditcoin | `contracts/sol/CreditPolicy.sol` | Deterministic underwriting from the verified passport. |
| `CreditPool` | Creditcoin | `contracts/sol/CreditPool.sol` | Lends against the verified limit. |

## 4. Proved events (the readability surface)

`CreditHistorySource` emits three unambiguous, purpose-named events (following the Attestcoin
best-practice guidance to avoid generic events such as `Transfer`):

```solidity
event CollateralDeposited(address indexed user, uint256 amount, uint256 timestamp);
event RepaymentRecorded(address indexed user, uint256 indexed loanId, uint256 amount, bool onTime);
event IncomeReceived(address indexed user, uint256 amount, address token);
```

All data the ASC needs (`user`, `amount`, `onTime`) is carried in the event topics/data, so the
worker only has to follow a single contract address.

## 5. End-to-end flow

1. **User transaction (Sepolia).** The borrower locks collateral and repays loans through
   `MockLendingVenue`, which calls `CreditHistorySource.recordRepayment(...)`.
2. **Attestation (background).** Attestors observe Sepolia, reach quorum and post signed
   attestations on Creditcoin — independently of CreditPass.
3. **Proof generation (worker).** `worker/worker.ts` detects the event, waits for the block to be
   attested, and asks the Proof Builder service for a **Merkle inclusion proof + continuity proof**
   (`@gluwa/usc-sdk`, `shared/proof.ts`).
4. **Verification (on-chain, in the same transaction).** The worker calls
   `CreditPassportASC.execute(action, chainKey, blockHeight, encodedTransaction, merkleRoot,
   siblings, lowerEndpointDigest, continuityRoots)`. `ASCBase.execute` calls the **Block Prover
   precompile at `0xFD2`**, which verifies Merkle + continuity synchronously and emits
   `TransactionVerified`.
5. **Decode + state update.** `_processAndEmitEvent` decodes the proven transaction bytes with
   `EvmV1Decoder`, extracts the event, and updates the borrower's `CreditProfile`.
6. **Underwriting.** The AI agent reads `profileOf(borrower)`, calls `CreditPolicy.assess(...)`, and
   calls `CreditPool.underwrite(...)`. The pool re-checks the policy on-chain.

## 6. Security properties implemented

| Property | Where | Notes |
|---|---|---|
| **Inclusion + continuity proof** | `ASCBase.execute` → precompile `0xFD2` | Proves the tx is in a block that belongs to the attested history. |
| **Replay protection** | `ASCBase.processedQueries[queryId]` | Each proved transaction is processed exactly once. |
| **Emitter allow-list** | `CreditPassportASC.authorizedSources` | Rejects look-alike contracts. A malicious contract that emits a fake `RepaymentRecorded` cannot update the passport. |
| **Receipt-status check** | `_processAndEmitEvent` | The precompile proves *inclusion*, not *success*. CreditPass requires `receiptStatus == 1`, so a reverted source transaction can never mint credit history. |
| **Strict event shape** | `_apply*` | Topic count and data length are validated before decoding, so malformed events cannot corrupt the profile. |
| **Deterministic safety bound** | `CreditPolicy` | The AI agent is advisory: `CreditPool` enforces the verified limit, so a bad model output cannot exceed what the proofs justify. |

## 7. Constant addresses (Creditcoin CC3 Testnet)

| Name | Value |
|---|---|
| Block Prover precompile | `0x0000000000000000000000000000000000000FD2` |
| Chain Info precompile | `0x0000000000000000000000000000000000000fd3` |
| EVM V1 Decoder library | `0x04B9ae8562D8Cc5bbbBbBB759080dDC30B56D18B` |
| Proof Builder API | `https://proof-gen-api.cc3-testnet.creditcoin.network` |
| Creditcoin RPC | `https://rpc.cc3-testnet.creditcoin.network` |

## 8. Why this is a *core* feature, not a checkbox

- The product's only trusted input is the verified passport. Remove Attestcoin and CreditPass cannot
  underwrite at all — there is no fallback oracle.
- The passport is updated **only** through proven events; there is no admin path that writes credit
  history.
- The integration exercises the protocol end-to-end (attestation → proof → precompile → decode →
  state), across multiple event types, with real security controls, rather than a single hard-coded
  example event.

## 9. Honest limitations / next steps

- The MVP is single-source-chain (Sepolia) and readability-only. Writability, Bitcoin UTXO reads and
  multi-chain history are the natural next steps.
- The demo uses a mock lending venue on the source chain to produce repayment history; a production
  deployment would point `CreditHistorySource` at real lending protocols and restrict recorders
  accordingly.
- `CreditPolicy` weights are fixed for clarity; a production system would govern them and add
  on-chain risk controls.
