// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {CreditProfile, CreditTier, ICreditPassport} from "./CreditPassTypes.sol";
import {CreditPolicy} from "./CreditPolicy.sol";

/// @title CreditPool
/// @notice Lending pool on Creditcoin. Lenders supply stablecoin liquidity; borrowers draw loans
///         underwritten by their verified Credit Passport. The AI underwriting agent submits a
///         decision (hash + rationale URI) which is recorded on-chain, but the pool enforces the
///         deterministic CreditPolicy so the agent can never exceed the verified limit.
contract CreditPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usd;
    ICreditPassport public passport;
    CreditPolicy public policy;

    /// @notice AI underwriting agent allowed to open a loan on behalf of a borrower.
    address public underwriter;

    uint256 public constant INTEREST_BPS = 500; // 5% flat, for the demo

    struct Loan {
        address borrower;
        uint256 principal;
        uint256 owed;
        uint64 openedAt;
        bool active;
        bytes32 decisionHash;
        string rationaleURI;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId = 1;

    mapping(address => uint256) public lpBalance;
    uint256 public totalLiquidity;
    uint256 public totalOutstanding;

    event LiquidityDeposited(address indexed lp, uint256 amount);
    event LiquidityWithdrawn(address indexed lp, uint256 amount);
    event UnderwriterUpdated(address indexed underwriter);
    event LoanOpened(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint256 owed,
        uint16 verifiedScore,
        bytes32 decisionHash,
        string rationaleURI
    );
    event LoanRepaid(uint256 indexed loanId, uint256 amount);

    constructor(address usd_, address passport_, address policy_) Ownable(msg.sender) {
        require(usd_ != address(0) && passport_ != address(0) && policy_ != address(0), "zero addr");
        usd = IERC20(usd_);
        passport = ICreditPassport(passport_);
        policy = CreditPolicy(policy_);
    }

    function setPassport(address passport_) external onlyOwner {
        passport = ICreditPassport(passport_);
    }

    function setPolicy(address policy_) external onlyOwner {
        policy = CreditPolicy(policy_);
    }

    /// @notice Set the AI underwriting agent permitted to open loans for borrowers.
    function setUnderwriter(address underwriter_) external onlyOwner {
        underwriter = underwriter_;
        emit UnderwriterUpdated(underwriter_);
    }

    /// @notice Lenders supply stablecoin liquidity to the pool.
    function depositLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        usd.safeTransferFrom(msg.sender, address(this), amount);
        lpBalance[msg.sender] += amount;
        totalLiquidity += amount;
        emit LiquidityDeposited(msg.sender, amount);
    }

    function withdrawLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= lpBalance[msg.sender], "bad amount");
        require(usd.balanceOf(address(this)) >= totalOutstanding + amount, "liquidity locked");
        lpBalance[msg.sender] -= amount;
        totalLiquidity -= amount;
        usd.safeTransfer(msg.sender, amount);
        emit LiquidityWithdrawn(msg.sender, amount);
    }

    /// @notice Preview the verified credit limit for a borrower.
    function creditLimitOf(address borrower) external view returns (uint256) {
        return policy.creditLimit(passport.profileOf(borrower));
    }

    function assessBorrower(address borrower)
        external
        view
        returns (uint16 score, uint256 limit, CreditTier tier)
    {
        return policy.assess(passport.profileOf(borrower));
    }

    /// @notice Draw a loan for yourself. `decisionHash` and `rationaleURI` are the AI agent's
    ///         recorded decision; the amount is still bounded by the on-chain verified policy.
    function requestLoan(uint256 amount, bytes32 decisionHash, string calldata rationaleURI)
        external
        nonReentrant
        returns (uint256 loanId)
    {
        return _openLoan(msg.sender, amount, decisionHash, rationaleURI);
    }

    /// @notice Open a loan on behalf of a borrower. Only the AI underwriting agent may call this.
    function underwrite(
        address borrower,
        uint256 amount,
        bytes32 decisionHash,
        string calldata rationaleURI
    ) external nonReentrant returns (uint256 loanId) {
        require(msg.sender == underwriter, "not underwriter");
        require(borrower != address(0), "borrower=0");
        return _openLoan(borrower, amount, decisionHash, rationaleURI);
    }

    function _openLoan(
        address borrower,
        uint256 amount,
        bytes32 decisionHash,
        string calldata rationaleURI
    ) private returns (uint256 loanId) {
        require(amount > 0, "amount=0");

        (uint16 verifiedScore, uint256 limit,) = policy.assess(passport.profileOf(borrower));
        require(limit > 0, "not creditworthy yet");
        require(amount <= limit, "exceeds verified credit limit");
        require(usd.balanceOf(address(this)) >= amount, "insufficient pool liquidity");

        uint256 owed = amount + (amount * INTEREST_BPS) / 10_000;
        loanId = nextLoanId++;

        loans[loanId] = Loan({
            borrower: borrower,
            principal: amount,
            owed: owed,
            openedAt: uint64(block.timestamp),
            active: true,
            decisionHash: decisionHash,
            rationaleURI: rationaleURI
        });

        totalOutstanding += owed;
        usd.safeTransfer(borrower, amount);

        emit LoanOpened(loanId, borrower, amount, owed, verifiedScore, decisionHash, rationaleURI);
    }

    /// @notice Repay a loan (partial or full).
    function repayLoan(uint256 loanId, uint256 amount) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.active, "loan inactive");
        require(msg.sender == loan.borrower, "not borrower");
        require(amount > 0 && amount <= loan.owed, "bad amount");

        usd.safeTransferFrom(msg.sender, address(this), amount);
        loan.owed -= amount;
        totalOutstanding -= amount;

        if (loan.owed == 0) {
            loan.active = false;
        }

        emit LoanRepaid(loanId, amount);
    }
}
