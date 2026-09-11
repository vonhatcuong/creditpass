import { useEffect, useState } from 'react';
import { JsonRpcProvider, Contract } from 'ethers';
import { CONFIG } from '../lib/config';
import { ASC_ABI, parseProfile, type CreditProfile } from '../lib/contracts';
import { useWallet } from '../lib/wallet';

export function usePassport() {
  const { account } = useWallet();
  const [profile, setProfile] = useState<CreditProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!CONFIG.addresses.passport) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const provider = new JsonRpcProvider(CONFIG.creditcoin.rpc);
        const asc = new Contract(CONFIG.addresses.passport, ASC_ABI, provider);
        const target = account || CONFIG.borrower;
        if (!target) {
          if (alive) setProfile(null);
          return;
        }
        const raw = await asc.profileOf(target);
        if (alive) setProfile(parseProfile(raw, target));
      } catch {
        if (alive) setProfile(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [account]);

  return { profile, loading };
}
