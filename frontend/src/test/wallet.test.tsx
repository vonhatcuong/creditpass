import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { WalletProvider, useWallet } from '../lib/wallet';

describe('wallet', () => {
  it('exposes connect/disconnect', () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }: any) => <WalletProvider>{children}</WalletProvider>,
    });
    expect(result.current.account).toBeNull();
    expect(typeof result.current.connect).toBe('function');
  });
});
