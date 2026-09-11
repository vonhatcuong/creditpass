import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProofPipeline } from '../components/FlowParts';

describe('pipeline', () => {
  it('marks all stages done when proved', () => {
    render(
      <ProofPipeline
        events={[{ id: '1', type: 'RepaymentRecorded', user: '0x1234567890123456789012345678901234567890', sourceTx: '0xabc', status: 'proved' }]}
      />,
    );
    expect(screen.getByText('Verify')).toBeInTheDocument();
  });

  it('shows error stage when failed', () => {
    render(
      <ProofPipeline
        events={[{ id: '2', type: 'IncomeReceived', user: '0x1234567890123456789012345678901234567890', sourceTx: '0xdef', status: 'failed', error: 'proof rejected' }]}
      />,
    );
    expect(screen.getByText('proof rejected')).toBeInTheDocument();
  });
});
