import React from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('rounded-[24px] border border-[#f0f0f0] bg-white p-6', className)}
    />
  );
}

export function CardFeatured({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('rounded-[24px] bg-[#f3f3f3] p-6', className)} />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...props}
      className={cn('mb-3 text-[24px] font-semibold leading-[1.25] text-[#141414]', className)}
    />
  );
}
