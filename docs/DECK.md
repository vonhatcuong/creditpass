# CreditPass — Deck outline (for PDF/whitepaper)

Target: 10–12 slides. Export to PDF and submit as the project deck.

1. **Title** — CreditPass: verified cross-chain credit on Creditcoin. Track: AI. Team.
2. **Problem** — DeFi lending requires crypto collateral; the $4.5T consumer-credit market runs on
   history, which does not exist on-chain. On-chain "scores" trust a centralized oracle.
3. **Insight** — Creditcoin's thesis is on-chain credit for emerging markets. Extend it:
   prove a borrower's real history on *any* chain and lend against it.
4. **Solution** — The Credit Passport: cross-chain history → cryptographically verified profile →
   under-collateralized loan. One-line flow diagram.
5. **Why Attestcoin (the moat)** — Pull-based reads, no source-chain integration, continuity proofs
   to genesis, no custodian. "Everyone proves a message; Attestcoin proves the history it came from."
6. **Live demo** — screenshots: Sepolia events → attestation dashboard → passport updated →
   AI decision → loan disbursed. Include explorer tx links.
7. **Architecture** — the diagram from the README; label the precompile `0x…FD2` and `AscBase`.
8. **Deep integration** — multiple event types, replay protection, emitter allow-list,
   receipt-status check, deterministic policy bound. (Scoring criterion: depth of Attestcoin usage.)
9. **AI underwriting** — passport as the only trusted input; agent writes a decision hash + rationale
   on-chain; the on-chain policy is the final authority. Verified-data, not vibes.
10. **Value to the Creditcoin ecosystem** — a reusable credit primitive (network effect), real users
    from emerging markets, demand for CTC gas and ATC attestation fees, a path through CEIP.
11. **Roadmap** — mainnet + Bitcoin history, writability, portable passport, Gluwa/Trugi fiat loop.
12. **Team & ask** — why us; what CEIP unlocks.

## Numbers to show

- Score/limit computed from verified inputs (show the policy table).
- A prime-tier borrower gets a limit **above** collateral → under-collateralized by construction.
- Test suite: 9 passing Foundry tests.
