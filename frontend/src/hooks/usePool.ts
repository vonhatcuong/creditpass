import { useEffect, useState } from 'react';
import { JsonRpcProvider, Contract } from 'ethers';
import { CONFIG } from '../lib/config';
import { POOL_ABI } from '../lib/contracts';

export interface PoolState {
  liquidity: bigint;
  outstanding: bigint;
  nextLoanId: number;
  underwriter: string;
}

export function usePool() {
  const [pool, setPool] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!CONFIG.addresses.pool) {
        setLoading(false);
        return;
      }
      try {
        const provider = new JsonRpcProvider(CONFIG.creditcoin.rpc);
        const c = new Contract(CONFIG.addresses.pool, POOL_ABI, provider);
        const [liq, out, next, uw] = await Promise.all([
          c.totalLiquidity(),
          c.totalOutstanding(),
          c.nextLoanId(),
          c.underwriter(),
        ]);
        if (alive)
          setPool({ liquidity: BigInt(liq), outstanding: BigInt(out), nextLoanId: Number(next), underwriter: String(uw) });
      } catch {
        if (alive) setPool(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const t = setInterval(() => {
      // lightweight poll trigger via re-run: skip, parent refreshes on tab switch
    }, CONFIG.refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { pool, loading };
}
