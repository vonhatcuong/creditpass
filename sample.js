// Sample data for the public demo preview (used when no contracts are configured).
// Numbers mirror a real local run: score 1000, limit $8,000 against $5,000 collateral.

const h = (s) => (s + '0'.repeat(64)).slice(0, 66);
const now = Date.now();

export const SAMPLE = {
  borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  underwriter: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  profile: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    collateralUsd: 5000e6,
    totalRepaidUsd: 1000e6,
    repaymentCount: 5,
    onTimeCount: 5,
    incomeUsd: 1500e6,
    lastBlockHeight: 0,
    exists: true,
  },
  pool: { liquidity: 1_000_000e6, outstanding: 8400e6, loans: 2 },
  loans: [
    { id: 1, borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', principal: 8000e6, owed: 8400e6, active: true, decisionHash: h('a1'), rationaleURI: 'ipfs://creditpass/demo-1' },
    { id: 2, borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', principal: 3000e6, owed: 0, active: false, decisionHash: h('b2'), rationaleURI: 'ipfs://creditpass/demo-2' },
  ],
  activity: [
    { chain: 'cc', type: 'LoanOpened', loanId: 1, amount: 8000e6, score: 1000, block: 42210, tx: h('c1'), ts: now - 2 * 60_000 },
    { chain: 'cc', type: 'PassportUpdated', action: 1, amount: 1000e6, block: 42190, tx: h('c2'), address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', ts: now - 14 * 60_000 },
    { chain: 'sep', type: 'RepaymentRecorded', amount: 200e6, onTime: true, block: 8851200, tx: h('c3'), address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', ts: now - 16 * 60_000 },
    { chain: 'sep', type: 'RepaymentRecorded', amount: 200e6, onTime: true, block: 8851180, tx: h('c4'), address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', ts: now - 18 * 60_000 },
    { chain: 'cc', type: 'PassportUpdated', action: 2, amount: 1500e6, block: 42150, tx: h('c5'), address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', ts: now - 24 * 60_000 },
    { chain: 'sep', type: 'IncomeReceived', amount: 1500e6, block: 8850900, tx: h('c6'), address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', ts: now - 27 * 60_000 },
    { chain: 'sep', type: 'RepaymentRecorded', amount: 200e6, onTime: true, block: 8850600, tx: h('c7'), address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', ts: now - 33 * 60_000 },
    { chain: 'sep', type: 'CollateralDeposited', amount: 5000e6, block: 8850000, tx: h('c8'), address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', ts: now - 40 * 60_000 },
  ],
};
