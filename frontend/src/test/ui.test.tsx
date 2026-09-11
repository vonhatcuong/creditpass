import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from '../components/ui/button';

it('renders button', () => {
  render(<Button>Connect</Button>);
  expect(screen.getByText('Connect')).toBeInTheDocument();
});
