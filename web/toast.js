// Lightweight toast notifications for transaction lifecycle feedback.

const container = () => document.getElementById('toasts');

export function toast(message, type = 'info', ttl = 5000) {
  const host = container();
  if (!host) return () => {};
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-msg"></span>`;
  el.querySelector('.toast-msg').textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  const close = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  };
  const timer = setTimeout(close, ttl);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    close();
  });
  return close;
}

/** Wraps a tx promise with pending/success/error toasts and returns the receipt. */
export async function withTx(label, txPromise, successMessage) {
  const pending = toast(`${label}…`, 'pending', 120000);
  try {
    const tx = await txPromise;
    pending();
    const submitted = toast(`${label}: submitted ${tx.hash.slice(0, 10)}…`, 'info', 6000);
    const receipt = await tx.wait();
    submitted();
    toast(successMessage || `${label} confirmed`, 'success');
    return receipt;
  } catch (error) {
    pending();
    const msg = error?.shortMessage || error?.reason || error?.message || String(error);
    toast(`${label} failed: ${msg}`, 'error', 8000);
    throw error;
  }
}
