// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {CreditProfile, CreditTier} from "./CreditPassTypes.sol";

/// @title CreditPolicy
/// @notice Transparent, deterministic underwriting policy. Turns a verified Credit Passport into a
///         credit score, a credit limit and a tier. Every input is a value that was proven on
///         Creditcoin by the Attestcoin Protocol; nothing here trusts an off-chain data source.
/// @dev    The AI agent may *recommend* a decision, but the pool enforces this policy on-chain, so
///         the safety bound cannot be bypassed by the agent.
contract CreditPolicy is Ownable {
    /// @notice USD amounts use 6 decimals.
    uint256 public constant UNIT = 1e6;

    uint256 public constant POINTS_PER_ON_TIME = 80; // capped at 400
    uint256 public constant MAX_REPAYMENT_POINTS = 400;
    uint256 public constant POINTS_PER_50_USD_REPAID = 100; // capped at 200
    uint256 public constant MAX_REPAID_POINTS = 200;
    uint256 public constant POINTS_PER_100_USD_COLLATERAL = 50; // capped at 250
    uint256 public constant MAX_COLLATERAL_POINTS = 250;
    uint256 public constant POINTS_PER_100_USD_INCOME = 25; // capped at 150
    uint256 public constant MAX_INCOME_POINTS = 150;
    uint256 public constant SCORE_MIN_ELIGIBLE = 300;

    event PolicyParamsUpdated();

    constructor() Ownable(msg.sender) {}

    /// @notice Score a verified profile on a 0-1000 scale.
    function score(CreditProfile memory p) public pure returns (uint16) {
        uint256 s;

        uint256 repaymentPoints = p.onTimeCount * POINTS_PER_ON_TIME;
        if (repaymentPoints > MAX_REPAYMENT_POINTS) repaymentPoints = MAX_REPAYMENT_POINTS;
        s += repaymentPoints;

        uint256 repaidPoints = (p.totalRepaidUsd * POINTS_PER_50_USD_REPAID) / (50 * UNIT);
        if (repaidPoints > MAX_REPAID_POINTS) repaidPoints = MAX_REPAID_POINTS;
        s += repaidPoints;

        uint256 collateralPoints = (p.collateralUsd * POINTS_PER_100_USD_COLLATERAL) / (100 * UNIT);
        if (collateralPoints > MAX_COLLATERAL_POINTS) collateralPoints = MAX_COLLATERAL_POINTS;
        s += collateralPoints;

        uint256 incomePoints = (p.incomeUsd * POINTS_PER_100_USD_INCOME) / (100 * UNIT);
        if (incomePoints > MAX_INCOME_POINTS) incomePoints = MAX_INCOME_POINTS;
        s += incomePoints;

        if (s > 1000) s = 1000;
        return uint16(s);
    }

    /// @notice Map a score to a tier.
    function tierOf(uint16 s) public pure returns (CreditTier) {
        if (s >= 800) return CreditTier.Prime;
        if (s >= 600) return CreditTier.Established;
        if (s >= 300) return CreditTier.Starter;
        return CreditTier.Unscored;
    }

    /// @notice Underwrite a profile into a credit limit in USD (6 decimals).
    /// @dev    Under-collateralized by design: verified history unlocks a limit above collateral.
    function creditLimit(CreditProfile memory p) public pure returns (uint256) {
        uint16 s = score(p);
        if (s < SCORE_MIN_ELIGIBLE) return 0;

        // base: 50% of collateral + $20 per score point above the eligibility floor
        uint256 limit = (p.collateralUsd * 50) / 100 + uint256(s - SCORE_MIN_ELIGIBLE) * 20 * UNIT;

        // serviceability cap: debt cannot exceed 2x verified income plus collateral
        uint256 cap = p.incomeUsd * 2 + p.collateralUsd;
        if (limit > cap) limit = cap;

        return limit;
    }

    /// @notice One-shot assessment for on-chain consumers.
    function assess(CreditProfile memory p)
        external
        pure
        returns (uint16 s, uint256 limit, CreditTier tier)
    {
        s = score(p);
        limit = creditLimit(p);
        tier = tierOf(s);
    }
}
