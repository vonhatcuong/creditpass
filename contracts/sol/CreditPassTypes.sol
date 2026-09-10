// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Verified credit profile derived exclusively from Attestcoin-proven cross-chain events.
///         All monetary fields are denominated in USD with 6 decimals.
struct CreditProfile {
    uint256 collateralUsd;
    uint256 totalRepaidUsd;
    uint256 repaymentCount;
    uint256 onTimeCount;
    uint256 incomeUsd;
    uint64 lastBlockHeight;
    bool exists;
}

/// @notice Tier assigned by the underwriting policy.
enum CreditTier {
    Unscored, // score < 300, not eligible
    Starter, // 300 - 599
    Established, // 600 - 799
    Prime // 800 - 1000
}

/// @notice Read-only view used by lending contracts to consume a passport.
interface ICreditPassport {
    function profileOf(address user) external view returns (CreditProfile memory);
}
