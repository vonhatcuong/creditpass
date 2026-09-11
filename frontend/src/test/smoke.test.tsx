import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../App';

describe('App shell', () => {
  it('renders CreditPass header', () => {
    render(<App />);
    expect(screen.getAllByText(/CreditPass/i).length).toBeGreaterThan(0);
  });
});
