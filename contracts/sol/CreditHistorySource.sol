// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title CreditHistorySource
/// @notice Source-chain (Ethereum Sepolia) contract that emits the minimal, unambiguous events
///         the CreditPassportASC proves and consumes on Creditcoin.
/// @dev    Following the Attestcoin best practice: logic on the source chain is kept to a minimum.
///         The contract only moves collateral and emits events with all data the ASC needs.
///         Repayment/income events are restricted to authorized recorders (e.g. a lending venue)
///         so a borrower cannot self-attest fabricated repayment history.
contract CreditHistorySource is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;

    /// @notice Addresses allowed to record repayment and income history (e.g. MockLendingVenue).
    mapping(address => bool) public recorders;

    /// @notice Emitted when a borrower locks collateral on the source chain.
    event CollateralDeposited(address indexed user, uint256 amount, uint256 timestamp);

    /// @notice Emitted when a repayment is made through an authorized venue.
    event RepaymentRecorded(address indexed user, uint256 indexed loanId, uint256 amount, bool onTime);

    /// @notice Emitted when verified income is received by a user.
    event IncomeReceived(address indexed user, uint256 amount, address token);

    event RecorderUpdated(address indexed recorder, bool allowed);

    constructor(address collateralToken_) Ownable(msg.sender) {
        require(collateralToken_ != address(0), "collateral=0");
        collateralToken = IERC20(collateralToken_);
    }

    function setRecorder(address recorder, bool allowed) external onlyOwner {
        require(recorder != address(0), "recorder=0");
        recorders[recorder] = allowed;
        emit RecorderUpdated(recorder, allowed);
    }

    /// @notice Lock collateral as USD-denominated credit backing. User-initiated and permissionless.
    function depositCollateral(uint256 amount) external {
        require(amount > 0, "amount=0");
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount, block.timestamp);
    }

    /// @notice Record a loan repayment. Restricted to authorized lending venues.
    function recordRepayment(address user, uint256 loanId, uint256 amount, bool onTime) external {
        require(recorders[msg.sender], "not recorder");
        require(user != address(0), "user=0");
        require(amount > 0, "amount=0");

        emit RepaymentRecorded(user, loanId, amount, onTime);
    }

    /// @notice Record verified income. Restricted to authorized recorders.
    function recordIncome(address user, uint256 amount, address token) external {
        require(recorders[msg.sender], "not recorder");
        require(user != address(0), "user=0");
        require(amount > 0, "amount=0");

        emit IncomeReceived(user, amount, token);
    }
}
