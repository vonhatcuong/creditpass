// Minimal contract interfaces used by the dApp (reads, writes and events).

export const ASC_ABI = [
  'function profileOf(address) view returns (uint256 collateralUsd, uint256 totalRepaidUsd, uint256 repaymentCount, uint256 onTimeCount, uint256 incomeUsd, uint64 lastBlockHeight, bool exists)',
  'event PassportUpdated(address indexed user, uint8 indexed action, uint256 amount, uint64 blockHeight)',
];

export const POLICY_ABI = [
  'function assess((uint256,uint256,uint256,uint256,uint256,uint64,bool)) view returns (uint16, uint256, uint8)',
  'function score((uint256,uint256,uint256,uint256,uint256,uint64,bool)) view returns (uint16)',
  'function creditLimit((uint256,uint256,uint256,uint256,uint256,uint64,bool)) view returns (uint256)',
];

export const POOL_ABI = [
  'function totalLiquidity() view returns (uint256)',
  'function totalOutstanding() view returns (uint256)',
  'function nextLoanId() view returns (uint256)',
  'function underwriter() view returns (address)',
  'function creditLimitOf(address) view returns (uint256)',
  'function assessBorrower(address) view returns (uint16, uint256, uint8)',
  'function loans(uint256) view returns (address borrower, uint256 principal, uint256 owed, uint64 openedAt, bool active, bytes32 decisionHash, string rationaleURI)',
  'function requestLoan(uint256 amount, bytes32 decisionHash, string rationaleURI) returns (uint256)',
  'function repayLoan(uint256 loanId, uint256 amount)',
  'function underwrite(address borrower, uint256 amount, bytes32 decisionHash, string rationaleURI) returns (uint256)',
  'event LoanOpened(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 owed, uint16 verifiedScore, bytes32 decisionHash, string rationaleURI)',
  'event LoanRepaid(uint256 indexed loanId, uint256 amount)',
];

export const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function mint(address to, uint256 amount)',
];

export const SOURCE_ABI = [
  'function depositCollateral(uint256 amount)',
  'event CollateralDeposited(address indexed user, uint256 amount, uint256 timestamp)',
  'event RepaymentRecorded(address indexed user, uint256 indexed loanId, uint256 amount, bool onTime)',
  'event IncomeReceived(address indexed user, uint256 amount, address token)',
];

export const VENUE_ABI = [
  'function borrow(uint256 amount) returns (uint256)',
  'function repay(uint256 loanId, uint256 amount, bool onTime)',
  'function nextLoanId(address) view returns (uint256)',
  'function debt(address) view returns (uint256)',
];
