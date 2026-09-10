// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {TestToken} from "../contracts/sol/TestToken.sol";
import {CreditHistorySource} from "../contracts/sol/CreditHistorySource.sol";
import {MockLendingVenue} from "../contracts/sol/MockLendingVenue.sol";
import {CreditPolicy} from "../contracts/sol/CreditPolicy.sol";
import {CreditPool} from "../contracts/sol/CreditPool.sol";
import {CreditPassportASC} from "../contracts/sol/CreditPassportASC.sol";
import {CreditProfile, CreditTier, ICreditPassport} from "../contracts/sol/CreditPassTypes.sol";

/// @notice Test double for the passport, so the pool can be tested without the precompile.
contract MockPassport is ICreditPassport {
    mapping(address => CreditProfile) internal profiles;

    function set(address user, CreditProfile memory p) external {
        profiles[user] = p;
    }

    function profileOf(address user) external view returns (CreditProfile memory) {
        return profiles[user];
    }
}

contract CreditPassTest is Test {
    address internal alice = address(0xA11CE);
    address internal lp = address(0x11D);

    function _profile(
        uint256 collateral,
        uint256 totalRepaid,
        uint256 repayCount,
        uint256 onTime,
        uint256 income
    ) internal pure returns (CreditProfile memory) {
        return CreditProfile({
            collateralUsd: collateral * 1e6,
            totalRepaidUsd: totalRepaid * 1e6,
            repaymentCount: repayCount,
            onTimeCount: onTime,
            incomeUsd: income * 1e6,
            lastBlockHeight: 0,
            exists: true
        });
    }

    function testPolicyUnscoredHasNoLimit() public {
        CreditPolicy policy = new CreditPolicy();
        CreditProfile memory p = _profile(0, 0, 0, 0, 0);
        (uint16 s, uint256 limit, CreditTier tier) = policy.assess(p);
        assertEq(s, 0);
        assertEq(limit, 0);
        assertEq(uint8(tier), uint8(CreditTier.Unscored));
    }

    function testPolicyScoringIsGradual() public {
        CreditPolicy policy = new CreditPolicy();

        // $100 collateral = 50 points (not saturated).
        (uint16 s1,,) = policy.assess(_profile(100, 0, 0, 0, 0));
        assertEq(s1, 50);

        // 1 on-time repayment = 80 points.
        (uint16 s2,,) = policy.assess(_profile(0, 0, 1, 1, 0));
        assertEq(s2, 80);

        // $50 repaid = 100 points.
        (uint16 s3,,) = policy.assess(_profile(0, 50, 0, 0, 0));
        assertEq(s3, 100);
    }

    function testPolicyPrimeUnlocksUndercollateralizedCredit() public {
        CreditPolicy policy = new CreditPolicy();
        // $5,000 collateral, $1,000 repaid, 4 on-time repayments, $1,500 income
        CreditProfile memory p = _profile(5000, 1000, 4, 4, 1500);
        (uint16 s, uint256 limit, CreditTier tier) = policy.assess(p);

        assertGe(s, 300);
        assertEq(uint8(tier), uint8(CreditTier.Prime));
        // Prime borrower can draw more than collateral -> under-collateralized.
        assertGt(limit, p.collateralUsd);
    }

    function testPolicyServiceabilityCap() public {
        CreditPolicy policy = new CreditPolicy();
        // Huge collateral but tiny income: cap = 2*income + collateral still applies.
        CreditProfile memory p = _profile(100, 0, 0, 0, 0);
        (, uint256 limit,) = policy.assess(p);
        assertLe(limit, p.collateralUsd);
    }

    function testSourceChainRecordsHistory() public {
        TestToken col = new TestToken("Credit Collateral", "cCOL", 18);
        CreditHistorySource source = new CreditHistorySource(address(col));
        MockLendingVenue venue = new MockLendingVenue(address(col), address(source));

        source.setRecorder(address(venue), true);
        col.mint(alice, 1_000 ether);
        col.mint(address(venue), 1_000 ether);

        // Alice locks collateral.
        vm.startPrank(alice);
        col.approve(address(source), 500 ether);
        source.depositCollateral(500 ether);
        // Alice borrows and repays through the venue.
        venue.borrow(100 ether);
        col.approve(address(venue), 100 ether);
        venue.repay(0, 100 ether, true);
        vm.stopPrank();

        assertEq(venue.debt(alice), 0);
    }

    function testSourceOnlyRecorderCanRecord() public {
        TestToken col = new TestToken("Credit Collateral", "cCOL", 18);
        CreditHistorySource source = new CreditHistorySource(address(col));

        vm.prank(alice);
        vm.expectRevert("not recorder");
        source.recordRepayment(alice, 1, 100, true);
    }

    function testPoolEnforcesVerifiedLimit() public {
        TestToken usd = new TestToken("Mock USD1", "mUSD1", 6);
        MockPassport passport = new MockPassport();
        CreditPolicy policy = new CreditPolicy();
        CreditPool pool = new CreditPool(address(usd), address(passport), address(policy));

        usd.mint(lp, 1_000_000e6);
        vm.prank(lp);
        usd.approve(address(pool), type(uint256).max);
        vm.prank(lp);
        pool.depositLiquidity(1_000_000e6);

        // Alice has no passport -> no loan.
        vm.prank(alice);
        vm.expectRevert("not creditworthy yet");
        pool.requestLoan(100e6, keccak256("no"), "");

        // Alice gets a verified profile.
        passport.set(alice, _profile(5000, 1000, 4, 4, 1500));

        uint256 limit = pool.creditLimitOf(alice);
        assertGt(limit, 0);

        // Borrowing above the limit fails.
        vm.prank(alice);
        vm.expectRevert("exceeds verified credit limit");
        pool.requestLoan(limit + 1, keccak256("over"), "");

        // Borrowing within the limit succeeds.
        vm.prank(alice);
        uint256 loanId = pool.requestLoan(limit, keccak256("ai-decision"), "ipfs://rationale");
        assertEq(pool.nextLoanId(), loanId + 1);
        assertEq(usd.balanceOf(alice), limit);
    }

    function testPoolUnderwriterOpensLoanForBorrower() public {
        TestToken usd = new TestToken("Mock USD1", "mUSD1", 6);
        MockPassport passport = new MockPassport();
        CreditPolicy policy = new CreditPolicy();
        CreditPool pool = new CreditPool(address(usd), address(passport), address(policy));

        usd.mint(lp, 1_000_000e6);
        vm.prank(lp);
        usd.approve(address(pool), type(uint256).max);
        vm.prank(lp);
        pool.depositLiquidity(1_000_000e6);

        passport.set(alice, _profile(5000, 1000, 4, 4, 1500));
        pool.setUnderwriter(address(this));

        uint256 limit = pool.creditLimitOf(alice);
        uint256 loanId = pool.underwrite(alice, limit, keccak256("ai-decision"), "ipfs://rationale");
        assertEq(pool.nextLoanId(), loanId + 1);
        assertEq(usd.balanceOf(alice), limit);
    }

    function testPoolUnderwriterOnly() public {
        TestToken usd = new TestToken("Mock USD1", "mUSD1", 6);
        MockPassport passport = new MockPassport();
        CreditPolicy policy = new CreditPolicy();
        CreditPool pool = new CreditPool(address(usd), address(passport), address(policy));

        passport.set(alice, _profile(5000, 1000, 4, 4, 1500));
        vm.prank(alice);
        vm.expectRevert("not underwriter");
        pool.underwrite(alice, 1e6, keccak256("x"), "");
    }

    function testAscDefaultsAndAuthorization() public {
        CreditPassportASC asc = new CreditPassportASC();
        CreditProfile memory p = asc.profileOf(alice);
        assertFalse(p.exists);

        asc.setAuthorizedSource(address(0xBEEF), true);
        assertTrue(asc.authorizedSources(address(0xBEEF)));
    }

    function testAscLocalModeDisabledByDefault() public {
        CreditPassportASC asc = new CreditPassportASC();
        vm.expectRevert(CreditPassportASC.LocalModeDisabled.selector);
        asc.applyLocalEvent(0, alice, 5000e6, false);
    }

    function testAscLocalModeRecordsSharedState() public {
        CreditPassportASC asc = new CreditPassportASC();
        asc.setLocalMode(true);

        asc.applyLocalEvent(0, alice, 5000e6, false); // collateral
        asc.applyLocalEvent(1, alice, 200e6, true); // repayment (on-time)
        asc.applyLocalEvent(2, alice, 1500e6, false); // income

        CreditProfile memory p = asc.profileOf(alice);
        assertTrue(p.exists);
        assertEq(p.collateralUsd, 5000e6);
        assertEq(p.totalRepaidUsd, 200e6);
        assertEq(p.repaymentCount, 1);
        assertEq(p.onTimeCount, 1);
        assertEq(p.incomeUsd, 1500e6);
    }

    function testAscLocalModeOwnerOnly() public {
        CreditPassportASC asc = new CreditPassportASC();
        vm.prank(alice);
        vm.expectRevert();
        asc.setLocalMode(true);
    }
}
