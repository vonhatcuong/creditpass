import { useWallet } from '../lib/wallet';
import { short } from '../lib/format';
import { CONFIG } from '../lib/config';
import { Button } from './ui/button';

export const TABS = ['dashboard', 'actions', 'flow', 'policy', 'loans'] as const;
export type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  dashboard: 'Dashboard',
  actions: 'Actions',
  flow: 'Cross-chain Flow',
  policy: 'Policy Simulator',
  loans: 'Loans',
};

export function Header({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { account, chainId, connect, disconnect } = useWallet();
  const netName =
    chainId === CONFIG.creditcoin.chainId
      ? 'Creditcoin'
      : chainId === CONFIG.sepolia.chainId
        ? 'Sepolia'
        : 'Not connected';

  return (
    <div className="sticky top-3 z-20 px-4">
      {/* nav-pill: floating centered stadium in canvas-soft */}
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-2">
        <div className="mr-auto flex items-center gap-2">
          {/* app-icon-squircle logomark */}
          <div className="h-8 w-8 rounded-[30%] bg-[#141414]" />
          <span className="text-[16px] font-semibold text-[#141414]">CreditPass</span>
        </div>
        <nav role="tablist" aria-label="CreditPass views" className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                history.replaceState(null, '', `#${t}`);
              }}
              className={`rounded-full px-3 py-1.5 text-[14px] font-semibold ${
                tab === t ? 'bg-white text-[#141414]' : 'text-[#707070] hover:text-[#141414]'
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>
        <span className="hidden rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#707070] sm:inline">
          {netName}
        </span>
        <Button onClick={() => (account ? disconnect() : connect().catch(() => {}))}>
          {account ? short(account) : 'Join for free'}
        </Button>
      </div>
    </div>
  );
}
