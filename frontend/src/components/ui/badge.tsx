import React from 'react';
import { cn } from '../../lib/cn';

// badge-popular is the ONLY blue element: accent fill, white label.
export function BadgePopular({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn('inline-block rounded-full bg-[#0066ff] px-2.5 py-0.5 text-[12px] font-semibold text-white', className)}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn('inline-block rounded-full bg-[#f3f3f3] px-2.5 py-0.5 text-[12px] font-semibold text-[#141414]', className)}
    />
  );
}

// badge-overlay: translucent gray pill over photography.
export function BadgeOverlay({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn('inline-block rounded-full bg-[rgba(115,115,115,0.56)] px-2.5 py-0.5 text-[12px] font-semibold text-white', className)}
    />
  );
}
