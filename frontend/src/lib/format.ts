// BigInt-safe formatting. Fixes Number() overflow in web/app.js:109-115.

export const short = (a?: string) =>
  a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '—';

export const usd = (n: bigint | number) =>
  '$' + (Number(n) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const usdBig = (n: bigint) =>
  '$' + (n / 1_000_000n).toLocaleString('en-US');
