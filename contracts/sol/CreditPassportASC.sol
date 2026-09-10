// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {ASCBase} from "@gluwa/asc-contracts/contracts/readability/ASCBase.sol";
import {CreditProfile, ICreditPassport} from "./CreditPassTypes.sol";

/// @title CreditPassportASC
/// @notice Attestcoin Smart Contract that turns Attestcoin-proven cross-chain events into a
///         verified Credit Passport on Creditcoin.
/// @dev    The proof is verified synchronously by the Block Prover precompile (`0xFD2`) inside
///         `ASCBase.execute`, which also enforces one-time processing (replay protection). This
///         contract then validates the proved transaction's success status and emitter and updates
///         the borrower's profile. No oracle operator is trusted anywhere in the path.
contract CreditPassportASC is Ownable, ASCBase, ICreditPassport {
    enum Action {
        CollateralDeposited, // 0
        RepaymentRecorded, // 1
        IncomeReceived // 2
    }

    bytes32 public constant COLLATERAL_EVENT_SIGNATURE =
        keccak256("CollateralDeposited(address,uint256,uint256)");
    bytes32 public constant REPAYMENT_EVENT_SIGNATURE =
        keccak256("RepaymentRecorded(address,uint256,uint256,bool)");
    bytes32 public constant INCOME_EVENT_SIGNATURE =
        keccak256("IncomeReceived(address,uint256,address)");

    /// @notice Source-chain contracts authorized to feed the passport. Any log from another
    ///         emitter is rejected, so a borrower cannot deploy a look-alike contract and prove it.
    mapping(address => bool) public authorizedSources;

    mapping(address => CreditProfile) private _profiles;

    event SourceAuthorizationUpdated(address indexed source, bool allowed);
    event PassportUpdated(address indexed user, Action indexed action, uint256 amount, uint64 blockHeight);

    error UnauthorizedSource(address emitter);
    error MalformedEvent();

    constructor() Ownable(msg.sender) {}

    function setAuthorizedSource(address source, bool allowed) external onlyOwner {
        require(source != address(0), "source=0");
        authorizedSources[source] = allowed;
        emit SourceAuthorizationUpdated(source, allowed);
    }

    /// @inheritdoc ICreditPassport
    function profileOf(address user) external view returns (CreditProfile memory) {
        return _profiles[user];
    }

    /// @dev Called by `ASCBase.execute` after the proof has been verified and deduplicated.
    function _processAndEmitEvent(
        uint8 action,
        bytes32, // queryId - unused
        bytes memory encodedTransaction
    ) internal override {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "unsupported tx type");

        // The precompile proves inclusion + continuity but NOT success: we must check status.
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 1, "source tx failed");

        if (action == uint8(Action.CollateralDeposited)) {
            _applyCollateral(receipt);
        } else if (action == uint8(Action.RepaymentRecorded)) {
            _applyRepayment(receipt);
        } else if (action == uint8(Action.IncomeReceived)) {
            _applyIncome(receipt);
        } else {
            revert("invalid action");
        }
    }

    function _applyCollateral(EvmV1Decoder.ReceiptFields memory receipt) private {
        EvmV1Decoder.LogEntry[] memory logs =
            EvmV1Decoder.getLogsByEventSignature(receipt, COLLATERAL_EVENT_SIGNATURE);
        if (logs.length == 0) revert MalformedEvent();
        EvmV1Decoder.LogEntry memory log = logs[0];
        _requireAuthorized(log);

        if (log.topics.length != 2 || log.data.length != 64) revert MalformedEvent();
        address user = _topicToAddress(log.topics[1]);
        (uint256 amount,) = abi.decode(log.data, (uint256, uint256));

        CreditProfile storage p = _profiles[user];
        p.exists = true;
        p.collateralUsd += amount;
        p.lastBlockHeight = uint64(block.number);

        emit PassportUpdated(user, Action.CollateralDeposited, amount, uint64(block.number));
    }

    function _applyRepayment(EvmV1Decoder.ReceiptFields memory receipt) private {
        EvmV1Decoder.LogEntry[] memory logs =
            EvmV1Decoder.getLogsByEventSignature(receipt, REPAYMENT_EVENT_SIGNATURE);
        if (logs.length == 0) revert MalformedEvent();
        EvmV1Decoder.LogEntry memory log = logs[0];
        _requireAuthorized(log);

        if (log.topics.length != 3 || log.data.length != 64) revert MalformedEvent();
        address user = _topicToAddress(log.topics[1]);
        (uint256 amount, bool onTime) = abi.decode(log.data, (uint256, bool));

        CreditProfile storage p = _profiles[user];
        p.exists = true;
        p.totalRepaidUsd += amount;
        p.repaymentCount += 1;
        if (onTime) {
            p.onTimeCount += 1;
        }
        p.lastBlockHeight = uint64(block.number);

        emit PassportUpdated(user, Action.RepaymentRecorded, amount, uint64(block.number));
    }

    function _applyIncome(EvmV1Decoder.ReceiptFields memory receipt) private {
        EvmV1Decoder.LogEntry[] memory logs =
            EvmV1Decoder.getLogsByEventSignature(receipt, INCOME_EVENT_SIGNATURE);
        if (logs.length == 0) revert MalformedEvent();
        EvmV1Decoder.LogEntry memory log = logs[0];
        _requireAuthorized(log);

        if (log.topics.length != 2 || log.data.length != 64) revert MalformedEvent();
        address user = _topicToAddress(log.topics[1]);
        (uint256 amount,) = abi.decode(log.data, (uint256, address));

        CreditProfile storage p = _profiles[user];
        p.exists = true;
        p.incomeUsd += amount;
        p.lastBlockHeight = uint64(block.number);

        emit PassportUpdated(user, Action.IncomeReceived, amount, uint64(block.number));
    }

    function _requireAuthorized(EvmV1Decoder.LogEntry memory log) private view {
        if (!authorizedSources[log.address_]) revert UnauthorizedSource(log.address_);
    }

    function _topicToAddress(bytes32 topic) private pure returns (address) {
        return address(uint160(uint256(topic)));
    }
}
