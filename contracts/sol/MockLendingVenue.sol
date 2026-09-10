// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {CreditHistorySource} from "./CreditHistorySource.sol";

/// @title MockLendingVenue
/// @notice A stand-in lending venue on the source chain. Borrowers borrow and repay here; every
///         repayment is relayed to CreditHistorySource, which becomes the provable on-chain
///         credit history that CreditPassportASC later consumes on Creditcoin.
/// @dev    This exists only so the demo produces credible repayment history. A production system
///         would instead point CreditHistorySource at a real lending protocol.
contract MockLendingVenue is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    CreditHistorySource public immutable source;

    mapping(address => uint256) public debt;
    mapping(address => uint256) public nextLoanId;

    event Borrowed(address indexed user, uint256 loanId, uint256 amount);
    event Repaid(address indexed user, uint256 loanId, uint256 amount, bool onTime);

    constructor(address token_, address source_) Ownable(msg.sender) {
        token = IERC20(token_);
        source = CreditHistorySource(source_);
    }

    /// @notice Borrow tokens from the venue. Creates a loan id for the caller.
    function borrow(uint256 amount) external returns (uint256 loanId) {
        require(amount > 0, "amount=0");
        loanId = nextLoanId[msg.sender]++;
        debt[msg.sender] += amount;
        token.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, loanId, amount);
    }

    /// @notice Repay a loan; emits a RepaymentRecorded event on the source contract for the proof.
    function repay(uint256 loanId, uint256 amount, bool onTime) external {
        require(amount > 0, "amount=0");
        require(debt[msg.sender] >= amount, "repay>debt");

        token.safeTransferFrom(msg.sender, address(this), amount);
        debt[msg.sender] -= amount;

        source.recordRepayment(msg.sender, loanId, amount, onTime);

        emit Repaid(msg.sender, loanId, amount, onTime);
    }
}
