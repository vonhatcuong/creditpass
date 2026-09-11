import { Contract, JsonRpcProvider } from 'ethers';
import { CONFIG } from './config';

export const ASC_ABI = [
  'function profileOf(address) view returns (uint256 collateralUsd, uint256 totalRepaidUsd, uint256 repaymentCount, uint256 onTimeCount, uint256 incomeUsd, uint64 lastBlockHeight, bool exists)',
  'event PassportUpdated(address indexed user, uint8 indexed action, uint256 amount, uint64 blockHeight)',
];

export const POOL_ABI = [
  'function totalLiquidity() view returns (uint256)',
  'function totalOutstanding() view returns (uint256)',
  'function nextLoanId() view returns (uint256)',
  'function underwriter() view returns (address)',
  'function assessBorrower(address) view returns (uint16, uint256, uint8)',
  'function loans(uint256) view returns (address borrower, uint256 principal, uint256 owed, uint64 openedAt, bool active, bytes32 decisionHash, string rationaleURI)',
  'function requestLoan(uint256 amount, bytes32 decisionHash, string rationaleURI) returns (uint256)',
  'function repayLoan(uint256 loanId, uint256 amount)',
  'function underwrite(address borrower, uint256 amount, bytes32 decisionHash, string rationaleURI) returns (uint256)',
  'event LoanOpened(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 owed, uint16 verifiedScore, bytes32 decisionHash, string rationaleURI)',
  'event LoanRepaid(uint256 indexed loanId, uint256 amount)',
];

export const TOKEN_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
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
];

export interface CreditProfile {
  address: string;
  collateralUsd: bigint;
  totalRepaidUsd: bigint;
  repaymentCount: number;
  onTimeCount: number;
  incomeUsd: bigint;
  lastBlockHeight: number;
  exists: boolean;
}

export function parseProfile(raw: any, address: string): CreditProfile {
  return {
    address,
    collateralUsd: BigInt(raw[0]),
    totalRepaidUsd: BigInt(raw[1]),
    repaymentCount: Number(raw[2]),
    onTimeCount: Number(raw[3]),
    incomeUsd: BigInt(raw[4]),
    lastBlockHeight: Number(raw[5]),
    exists: Boolean(raw[6]),
  };
}

export async function queryAll(contract: any, eventName: string, from: number, to: number, chunk: number) {
  const out: any[] = [];
  let size = chunk;
  let start = from;
  while (start <= to) {
    const end = Math.min(start + size - 1, to);
    try {
      out.push(...(await contract.queryFilter(eventName, start, end)));
      start = end + 1;
      size = chunk;
    } catch {
      if (size > 100) size = Math.floor(size / 2);
      else {
        start = end + 1;
        size = chunk;
      }
    }
  }
  return out;
}

export function getContracts() {
  if (!CONFIG.addresses.passport || !CONFIG.addresses.pool) return null;
  const provider = new JsonRpcProvider(CONFIG.creditcoin.rpc);
  const asc = new Contract(CONFIG.addresses.passport, ASC_ABI, provider);
  const pool = new Contract(CONFIG.addresses.pool, POOL_ABI, provider);
  return { provider, asc, pool };
}
