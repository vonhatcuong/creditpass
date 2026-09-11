import { useState } from 'react';
import { Contract, parseUnits, keccak256, toUtf8Bytes } from 'ethers';
import { CONFIG } from '../lib/config';
import { POOL_ABI, TOKEN_ABI, SOURCE_ABI, VENUE_ABI } from '../lib/contracts';
import { useWallet } from '../lib/wallet';
import { useToasts } from './Toaster';
import { Card, CardTitle } from './ui/card';
import { Button } from './ui/button';

async function ensureAllowance(
  tokenAddr: string,
  owner: string,
  spender: string,
  amount: bigint,
  getSigner: () => Promise<any>,
  push: (m: string, k?: any) => void,
) {
  const signer = await getSigner();
  const token = new Contract(tokenAddr, TOKEN_ABI, signer);
  const current: bigint = BigInt(await token.allowance(owner, spender));
  if (current < amount) {
    // Finite approve (exact amount) — fixes infinite approve in web/app.js:517-524.
    push('Approve…', 'pending');
    const tx = await token.approve(spender, amount);
    await tx.wait();
    push('Approved', 'success');
  }
}

export function ActionsView() {
  const configured = Boolean(CONFIG.addresses.passport && CONFIG.addresses.pool);
  const { account, chainId, ensureChain, getSigner } = useWallet();
  const { push } = useToasts();
  const [loanAmount, setLoanAmount] = useState('100');
  const [collAmount, setCollAmount] = useState('1000');

  if (!configured)
    return (
      <Card>
        <div className="rounded-[16px] bg-[#f3f3f3] p-4 text-sm text-[#707070]">
          Deploy the contracts and set addresses to enable on-chain actions.
        </div>
      </Card>
    );
  if (!account)
    return (
      <Card>
        <div className="text-sm text-[#141414]">Connect your wallet to borrow, lend or build history.</div>
      </Card>
    );

  const onCC = () => ensureChain(CONFIG.creditcoin).catch((e: any) => push(e?.message || String(e), 'error'));
  const onSep = () => ensureChain(CONFIG.sepolia).catch((e: any) => push(e?.message || String(e), 'error'));

  const onRequestLoan = async () => {
    try {
      await ensureChain(CONFIG.creditcoin);
      const amount = parseUnits(loanAmount || '0', 6);
      if (amount <= 0n) throw new Error('Enter an amount');
      const signer = await getSigner();
      const pool = new Contract(CONFIG.addresses.pool, POOL_ABI, signer);
      const rationale = `CreditPass request\nborrower: ${account}\namount: ${amount.toString()}`;
      const hash = keccak256(toUtf8Bytes(rationale));
      push('Request loan…', 'pending');
      const tx = await pool.requestLoan(amount, hash, `ipfs://creditpass/${hash.slice(2, 18)}`);
      await tx.wait();
      push('Loan disbursed', 'success');
    } catch (e: any) {
      push(e?.shortMessage || e?.message || String(e), 'error');
    }
  };

  const onDeposit = async () => {
    try {
      await ensureChain(CONFIG.sepolia);
      const amount = parseUnits(collAmount || '0', 6);
      if (amount <= 0n) throw new Error('Enter an amount');
      await ensureAllowance(CONFIG.addresses.collateral, account, CONFIG.addresses.source, amount, getSigner, push);
      const signer = await getSigner();
      const source = new Contract(CONFIG.addresses.source, SOURCE_ABI, signer);
      push('Lock collateral…', 'pending');
      const tx = await source.depositCollateral(amount);
      await tx.wait();
      push('Collateral locked on Sepolia', 'success');
    } catch (e: any) {
      push(e?.shortMessage || e?.message || String(e), 'error');
    }
  };

  const onBorrowRepay = async () => {
    try {
      await ensureChain(CONFIG.sepolia);
      const amount = parseUnits(collAmount || '0', 6);
      const signer = await getSigner();
      const venue = new Contract(CONFIG.addresses.venue, VENUE_ABI, signer);
      await ensureAllowance(CONFIG.addresses.collateral, account, CONFIG.addresses.venue, amount, getSigner, push);
      push('Borrow…', 'pending');
      await (await venue.borrow(amount)).wait();
      const nextId: bigint = BigInt(await venue.nextLoanId(account));
      const prev = nextId > 0n ? nextId - 1n : 0n;
      push('Repay on-time…', 'pending');
      await (await venue.repay(prev, amount, true)).wait();
      push('Repayment recorded on Sepolia', 'success');
    } catch (e: any) {
      push(e?.shortMessage || e?.message || String(e), 'error');
    }
  };

  const onSepolia = chainId === CONFIG.sepolia.chainId;
  const onCCChain = chainId === CONFIG.creditcoin.chainId;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardTitle>Creditcoin · lending</CardTitle>
        {!onCCChain ? (
          <div>
            <p className="text-sm text-[#707070]">Wallet is not on Creditcoin.</p>
            <div className="mt-2"><Button onClick={onCC}>Switch to {CONFIG.creditcoin.name}</Button></div>
          </div>
        ) : (
          <div>
            <label htmlFor="loanAmount" className="text-sm text-[#707070]">
              Amount (mUSD1)
              <input id="loanAmount" type="number" min={1} value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className="mt-1 block w-full rounded-[16px] bg-[#f0f0f0] p-2.5 text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#141414]" />
            </label>
            <div className="mt-3"><Button onClick={onRequestLoan}>Request loan</Button></div>
          </div>
        )}
      </Card>
      <Card>
        <CardTitle>Sepolia · build history</CardTitle>
        {!onSepolia ? (
          <div>
            <p className="text-sm text-[#707070]">Wallet is not on Sepolia.</p>
            <div className="mt-2"><Button onClick={onSep}>Switch to {CONFIG.sepolia.name}</Button></div>
          </div>
        ) : (
          <div>
            <label htmlFor="collAmount" className="text-sm text-[#707070]">
              Collateral (cUSD)
              <input id="collAmount" type="number" min={1} value={collAmount} onChange={(e) => setCollAmount(e.target.value)} className="mt-1 block w-full rounded-[16px] bg-[#f0f0f0] p-2.5 text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#141414]" />
            </label>
            <div className="mt-3 flex gap-2">
              <Button onClick={onDeposit}>Lock collateral</Button>
              <Button onClick={onBorrowRepay}>Borrow &amp; repay on-time</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
