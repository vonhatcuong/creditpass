import { useEffect, useState } from 'react';
import { WalletProvider } from './lib/wallet';
import { applyLocalOverrides } from './lib/config';
import { ToastProvider, Toaster } from './components/Toaster';
import { Header, TABS, type Tab } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { FlowView } from './components/FlowView';
import { PolicyView } from './components/PolicyView';
import { LoansView } from './components/LoansView';
import { ActionsView } from './components/ActionsView';

function initialTab(): Tab {
  const h = location.hash.replace('#', '') as Tab;
  return (TABS as readonly string[]).includes(h) ? h : 'dashboard';
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [, setCfg] = useState(0);
  useEffect(() => {
    applyLocalOverrides().then((ok) => {
      if (ok) setCfg((n) => n + 1);
    });
  }, []);
  useEffect(() => {
    const onHash = () => setTab(initialTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <WalletProvider>
      <ToastProvider>
        <div className="min-h-screen bg-white text-[#141414]">
          <Header tab={tab} setTab={setTab} />
          <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'actions' && <ActionsView />}
            {tab === 'flow' && <FlowView />}
            {tab === 'policy' && <PolicyView />}
            {tab === 'loans' && <LoansView />}
          </main>
          {/* footer: full-width ink band with rounded top corners */}
          <footer className="rounded-t-[24px] bg-[#141414] text-white">
            <div className="mx-auto max-w-6xl px-5 py-12">
              <div className="text-[56px] font-semibold leading-none">CreditPass.</div>
              <p className="mt-2 text-[20px] font-light text-[#adadad]">
                Verified cross-chain credit, powered by the Attestcoin Protocol.
              </p>
              <div className="mt-8 flex flex-wrap gap-6 text-[14px] text-[#adadad]">
                <span>BUIDL CTC 2026 Fall · Track AI</span>
                <span>Creditcoin CC3 Testnet</span>
                <span>Ethereum Sepolia</span>
              </div>
            </div>
          </footer>
          <Toaster />
        </div>
      </ToastProvider>
    </WalletProvider>
  );
}
