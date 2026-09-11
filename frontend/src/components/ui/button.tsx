import React from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'outline' | 'soft';

export function Button({
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'rounded-full px-4 text-[16px] font-semibold leading-[1.38] transition disabled:cursor-not-allowed disabled:opacity-45 min-h-[44px]';
  const styles: Record<Variant, string> = {
    // button-primary: ink fill, white label. Never blue.
    primary: 'bg-[#141414] text-white hover:bg-[#262626]',
    // button-outline: white fill, ink label, hairline border.
    outline: 'bg-white text-[#141414] border border-[#e0e0e0] hover:border-[#141414]',
    // button-pill-soft: canvas-soft tint fill, no border.
    soft: 'bg-[#f3f3f3] text-[#141414] hover:bg-[#e0e0e0]',
  };
  return <button {...props} className={cn(base, styles[variant], className)} />;
}
