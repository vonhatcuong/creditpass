import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PolicyView } from '../components/PolicyView';
import { LoansView } from '../components/LoansView';

describe('policy + loans', () => {
  it('renders labeled sliders', () => {
    render(<PolicyView />);
    expect(screen.getByLabelText(/Proven collateral/i)).toBeInTheDocument();
    expect(screen.getByText(/Credit limit/i)).toBeInTheDocument();
  });

  it('renders loans table with scroll wrapper', () => {
    const { container } = render(<LoansView />);
    expect(screen.getAllByText(/Loans/i).length).toBeGreaterThan(0);
    expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument();
  });
});
