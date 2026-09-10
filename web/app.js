import {
  Contract,
  JsonRpcProvider,
  formatUnits,
  parseUnits,
  keccak256,
  toUtf8Bytes,
} from 'https://esm.sh/ethers@6.17.0';
import { CONFIG } from './config.js';
import { TIERS, POLICY, usd, usd2, short, assess } from './policy.js';
import { SAMPLE } from './sample.js';
import { ASC_ABI, POLICY_ABI, POOL_ABI, TOKEN_ABI, SOURCE_ABI, VENUE_ABI } from './abis.js';
import * as wallet from './wallet.js';
import { toast, withTx } from './toast.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Read-side providers / contracts
// ---------------------------------------------------------------------------
let readProvider, sepProvider;
let ascRO, policyRO, poolRO, sourceRO;

const state = {
  profile: null,
  loans: [],
  activity: [],
  pool: null,
  configured: false,
  demo: false,
  wallet: { account: null, chainId: null },
};

const configured = () =>
  Boolean(CONFIG.addresses.passport && CONFIG.addresses.pool && CONFIG.addresses.policy);

function networkFor(chainId) {
  if (chainId === CONFIG.creditcoin.chainId) return 'creditcoin';
  if (chainId === CONFIG.sepolia.chainId) return 'sepolia';
  return null;
}

async function initRead() {
  readProvider = new JsonRpcProvider(CONFIG.creditcoin.rpc);
  ascRO = new Contract(CONFIG.addresses.passport, ASC_ABI, readProvider);
  policyRO = new Contract(CONFIG.addresses.policy, POLICY_ABI, readProvider);
  poolRO = new Contract(CONFIG.addresses.pool, POOL_ABI, readProvider);
  if (CONFIG.addresses.source) {
    sepProvider = new JsonRpcProvider(CONFIG.sepolia.rpc);
    sourceRO = new Contract(CONFIG.addresses.source, SOURCE_ABI, sepProvider);
  }
}

async function applyLocalOverrides() {
  try {
    const res = await fetch('./config.local.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const o = await res.json();
    if (o.addresses) Object.assign(CONFIG.addresses, o.addresses);
    if (o.creditcoin) Object.assign(CONFIG.creditcoin, o.creditcoin);
    if (o.sepolia) Object.assign(CONFIG.sepolia, o.sepolia);
    if (o.borrower) CONFIG.borrower = o.borrower;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------
async function blockTs(provider, n) {
  try {
    const b = await provider.getBlock(n);
    return b ? b.timestamp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function queryAll(contract, eventName, from, to, chunk) {
  const out = [];
  let size = chunk;
  let start = from;
  while (start <= to) {
    const end = Math.min(start + size - 1, to);
    try {
      const events = await contract.queryFilter(eventName, start, end);
      out.push(...events);
      start = end + 1;
      size = chunk;
    } catch {
      if (size > 100) size = Math.floor(size / 2);
      else {
        start = end + 1;
        size = chunk;
      }
    }
  }
  return out;
}

async function loadProfile() {
  const target = state.wallet.account || CONFIG.borrower || (await poolRO.underwriter());
  const raw = await ascRO.profileOf(target);
  const profile = {
    address: target,
    collateralUsd: Number(raw[0]),
    totalRepaidUsd: Number(raw[1]),
    repaymentCount: Number(raw[2]),
    onTimeCount: Number(raw[3]),
    incomeUsd: Number(raw[4]),
    lastBlockHeight: Number(raw[5]),
    exists: raw[6],
  };
  state.profile = profile;
  renderProfile(profile);
}

async function loadPool() {
  const [liquidity, outstanding, next, underwriter] = await Promise.all([
    poolRO.totalLiquidity(),
    poolRO.totalOutstanding(),
    poolRO.nextLoanId(),
    poolRO.underwriter(),
  ]);
  state.pool = { liquidity, outstanding, next: Number(next), underwriter };
  $('poolLiquidity').textContent = usd(liquidity);
  $('poolOutstanding').textContent = usd(outstanding);
  const util = Number(liquidity) > 0 ? (Number(outstanding) / Number(liquidity)) * 100 : 0;
  $('poolUtil').textContent = util.toFixed(1) + '%';
  $('poolUnderwriter').textContent = short(underwriter);
  $('statLoans').textContent = String(Number(next) - 1);
}

async function loadLoans() {
  const next = Number(await poolRO.nextLoanId());
  const loans = [];
  for (let i = 1; i < next; i++) {
    const l = await poolRO.loans(i);
    loans.push({
      id: i,
      borrower: l[0],
      principal: Number(l[1]),
      owed: Number(l[2]),
      openedAt: Number(l[3]),
      active: l[4],
      decisionHash: l[5],
      rationaleURI: l[6],
    });
  }
  state.loans = loans;
  renderLoans(loans);
}

async function loadActivity() {
  const items = [];
  if (sourceRO) {
    const head = await sepProvider.getBlockNumber();
    const from = Math.max(0, head - CONFIG.sepolia.lookback);
    const [coll, repay, income] = await Promise.all([
      queryAll(sourceRO, 'CollateralDeposited', from, head, CONFIG.sepolia.chunk),
      queryAll(sourceRO, 'RepaymentRecorded', from, head, CONFIG.sepolia.chunk),
      queryAll(sourceRO, 'IncomeReceived', from, head, CONFIG.sepolia.chunk),
    ]);
    for (const e of coll) items.push({ chain: 'sep', type: 'CollateralDeposited', amount: Number(e.args[1]), block: e.blockNumber, tx: e.transactionHash, address: e.args[0] });
    for (const e of repay) items.push({ chain: 'sep', type: 'RepaymentRecorded', amount: Number(e.args[2]), onTime: e.args[3], block: e.blockNumber, tx: e.transactionHash, address: e.args[0] });
    for (const e of income) items.push({ chain: 'sep', type: 'IncomeReceived', amount: Number(e.args[1]), block: e.blockNumber, tx: e.transactionHash, address: e.args[0] });
  }

  const ccHead = await readProvider.getBlockNumber();
  const ccFrom = Math.max(0, ccHead - CONFIG.creditcoin.lookback);
  const [passportUpdates, loansOpened, loansRepaid] = await Promise.all([
    queryAll(ascRO, 'PassportUpdated', ccFrom, ccHead, CONFIG.creditcoin.chunk),
    queryAll(poolRO, 'LoanOpened', ccFrom, ccHead, CONFIG.creditcoin.chunk),
    queryAll(poolRO, 'LoanRepaid', ccFrom, ccHead, CONFIG.creditcoin.chunk),
  ]);
  for (const e of passportUpdates) items.push({ chain: 'cc', type: 'PassportUpdated', action: Number(e.args[1]), amount: Number(e.args[2]), block: e.blockNumber, tx: e.transactionHash, address: e.args[0] });
  for (const e of loansOpened) items.push({ chain: 'cc', type: 'LoanOpened', loanId: Number(e.args[0]), amount: Number(e.args[2]), score: Number(e.args[4]), block: e.blockNumber, tx: e.transactionHash });
  for (const e of loansRepaid) items.push({ chain: 'cc', type: 'LoanRepaid', loanId: Number(e.args[0]), amount: Number(e.args[1]), block: e.blockNumber, tx: e.transactionHash });

  const uniqueBlocks = [...new Set(items.map((i) => i.block))].slice(0, 60);
  const tsMap = {};
  await Promise.all(uniqueBlocks.map(async (b) => {
    const provider = items.find((i) => i.block === b).chain === 'sep' ? sepProvider : readProvider;
    tsMap[b] = await blockTs(provider, b);
  }));
  for (const i of items) i.ts = tsMap[i.block] || 0;

  items.sort((a, b) => (b.ts - a.ts) || (b.block - a.block));
  state.activity = items;
  renderActivity(items);
  renderFlowCounts(items);
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------
function renderProfile(p) {
  const a = assess(p);
  $('statScore').textContent = `${a.score}/1000`;
  $('statLimit').textContent = usd(a.limit);
  $('statCollateral').textContent = usd(p.collateralUsd);
  $('borrowerAddr').textContent = short(p.address);
  $('profileBlock').textContent = p.lastBlockHeight ? `#${p.lastBlockHeight}` : 'not verified yet';

  $('pCollateral').textContent = usd(p.collateralUsd);
  $('pRepaid').textContent = usd(p.totalRepaidUsd);
  $('pRepayments').textContent = `${p.repaymentCount} (${p.onTimeCount} on-time)`;
  $('pIncome').textContent = usd(p.incomeUsd);
  $('pTier').innerHTML = `<span class="tag">${TIERS[a.tier]}</span>`;
  $('pLimit').textContent = usd(a.limit);

  const circumference = 2 * Math.PI * 56;
  $('ringArc').setAttribute('stroke-dasharray', String(circumference));
  $('ringArc').setAttribute('stroke-dashoffset', String(circumference - (a.score / 1000) * circumference));
  $('ringScore').textContent = String(a.score);
  $('ringTier').textContent = TIERS[a.tier].toUpperCase();

  renderBars($('breakdown'), a.components);
  $('bTotal').textContent = `${a.score}/1000`;
  state.assessment = a;
}

function renderBars(target, c) {
  const rows = [
    ['On-time repayments', c.onTime, POLICY.MAX_REPAYMENT],
    ['Amount repaid', c.repaid, POLICY.MAX_REPAID],
    ['Collateral', c.collateral, POLICY.MAX_COLLATERAL],
    ['Income', c.income, POLICY.MAX_INCOME],
  ];
  target.innerHTML = rows
    .map(
      ([label, val, max]) => `
    <div class="bar">
      <div class="top"><span class="k">${label}</span><span>${val} / ${max}</span></div>
      <div class="track"><div class="fill" style="width:${(val / max) * 100}%"></div></div>
    </div>`,
    )
    .join('');
}

function renderLoans(loans) {
  const body = $('loansBody');
  if (!loans.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No loans yet.</td></tr>';
    return;
  }
  const acct = state.wallet.account?.toLowerCase();
  body.innerHTML = loans
    .slice()
    .reverse()
    .map((l) => {
      const mine = acct && l.borrower.toLowerCase() === acct && l.active;
      return `
      <tr data-loan="${l.id}">
        <td>${l.id}</td>
        <td class="mono">${short(l.borrower)}</td>
        <td>${usd2(l.principal)}</td>
        <td>${usd2(l.owed)}</td>
        <td>${l.active ? '<span class="tag">verified</span>' : '—'}</td>
        <td><span class="tag ${l.active ? 'active' : 'repaid'}">${l.active ? 'Active' : 'Repaid'}</span></td>
        <td>${mine ? `<button class="btn tiny" data-repay="${l.id}">Repay</button>` : `<span class="mono">${l.rationaleURI || '—'}</span>`}</td>
      </tr>`;
    })
    .join('');

  body.querySelectorAll('tr[data-loan]').forEach((tr) =>
    tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-repay]')) return;
      showLoan(Number(tr.dataset.loan));
    }),
  );
  body.querySelectorAll('[data-repay]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRepay(Number(btn.dataset.repay));
    }),
  );
}

function renderActivity(items) {
  const feed = $('feed');
  if (!items.length) {
    feed.innerHTML = '<div class="empty">No activity found in the configured lookback window.</div>';
    return;
  }
  feed.innerHTML = items
    .map((i) => {
      const explorer = i.chain === 'sep' ? CONFIG.sepolia.explorer : CONFIG.creditcoin.explorer;
      const time = i.ts ? new Date(i.ts).toLocaleString() : `block #${i.block}`;
      const txLink = explorer
        ? `<a href="${explorer}/tx/${i.tx}" target="_blank" rel="noopener" class="mono">${i.tx.slice(0, 12)}…</a>`
        : `<span class="mono">${i.tx.slice(0, 12)}…</span>`;
      return `
      <div class="feed-item">
        <div class="chain ${i.chain === 'cc' ? 'cc' : 'sep'}">${i.chain === 'cc' ? 'Creditcoin' : 'Sepolia'}</div>
        <div class="desc">${describe(i)}<div class="meta">${time} · ${txLink}</div></div>
        <div class="amt">${i.amount != null ? usd(i.amount) : ''}</div>
      </div>`;
    })
    .join('');
}

function describe(i) {
  const who = i.address ? `<span class="mono">${short(i.address)}</span> ` : '';
  switch (i.type) {
    case 'CollateralDeposited': return `${who}<b>locked collateral</b> on Sepolia`;
    case 'RepaymentRecorded': return `${who}<b>repaid</b> on Sepolia ${i.onTime ? '<span class="accent">(on-time)</span>' : '<span class="warn">(late)</span>'}`;
    case 'IncomeReceived': return `${who}<b>received verified income</b> on Sepolia`;
    case 'PassportUpdated': return `${who}<b>passport updated</b> on Creditcoin · ${['collateral', 'repayment', 'income'][i.action]}`;
    case 'LoanOpened': return `<b>loan #${i.loanId} opened</b> · verified score ${i.score}`;
    case 'LoanRepaid': return `<b>loan #${i.loanId} repaid</b> on Creditcoin`;
    default: return i.type;
  }
}

function renderFlowCounts(items) {
  const count = (t) => items.filter((i) => i.type === t).length;
  $('cCollateral').textContent = `${count('CollateralDeposited')} events`;
  $('cRepay').textContent = `${count('RepaymentRecorded')} events`;
  $('cIncome').textContent = `${count('IncomeReceived')} events`;
  $('cPassport').textContent = `${count('PassportUpdated')} updates`;
  $('cLoans').textContent = `${count('LoanOpened')} loans`;
}

// ---------------------------------------------------------------------------
// Wallet UI + actions
// ---------------------------------------------------------------------------
function renderWallet(w) {
  state.wallet = w;
  const btn = $('connectBtn');
  if (w.account) {
    btn.textContent = short(w.account);
    btn.classList.add('connected');
    btn.title = 'Click to disconnect';
  } else {
    btn.textContent = 'Connect Wallet';
    btn.classList.remove('connected');
  }
  const net = w.chainId ? networkFor(w.chainId) : null;
  $('netName').textContent = net ? CONFIG[net].name : CONFIG.creditcoin.name;
  renderActions();
  if (configured() && w.account) refresh().catch(() => {});
}

function statusLine(text, kind = '') {
  return `<div class="status ${kind}">${text}</div>`;
}

function renderActions() {
  const host = $('actionsBody');
  if (!host) return;

  if (!configured()) {
    host.innerHTML = statusLine('Deploy the contracts and set <span class="mono">web/config.js</span> to enable on-chain actions.', 'warn');
    return;
  }
  if (!wallet.hasWallet()) {
    host.innerHTML = statusLine('No wallet detected. Install MetaMask to interact.', 'warn');
    return;
  }
  if (!state.wallet.account) {
    host.innerHTML = statusLine('Connect your wallet to borrow, lend or build history.');
    return;
  }

  const net = networkFor(state.wallet.chainId);
  const cc = CONFIG.creditcoin;
  const sep = CONFIG.sepolia;
  const isUnderwriter =
    state.wallet.account.toLowerCase() === (state.pool?.underwriter || '').toLowerCase();

  host.innerHTML = `
    <div class="act-grid">
      <section class="act-card">
        <h3>Creditcoin · lending</h3>
        ${net !== 'creditcoin'
          ? `<p class="help">Wallet is on ${net ? CONFIG[net].name : 'an unknown network'}.</p>
             <button class="btn" id="switchCC">Switch to ${cc.name}</button>`
          : isUnderwriter
            ? underwriterForm()
            : borrowerForm()}
      </section>
      <section class="act-card">
        <h3>Sepolia · build history</h3>
        ${net !== 'sepolia'
          ? `<p class="help">Wallet is on ${net ? CONFIG[net].name : 'an unknown network'}.</p>
             <button class="btn" id="switchSep">Switch to ${sep.name}</button>`
          : sourceForm()}
      </section>
    </div>`;

  bind('#switchCC', () => wallet.ensureChain(cc).catch(onErr));
  bind('#switchSep', () => wallet.ensureChain(sep).catch(onErr));
  bind('#depositCollateral', onDepositCollateral);
  bind('#recordRepayment', onRecordRepayment);
  bind('#requestLoan', onRequestLoan);
  bind('#underwrite', onUnderwrite);
}

function bind(sel, fn) {
  const el = document.querySelector(sel);
  if (el) el.addEventListener('click', fn);
}

const onErr = (e) => toast(e?.shortMessage || e?.message || String(e), 'error', 8000);

function borrowerForm() {
  const limit = state.assessment?.limit ?? 0;
  const eligible = limit > 0;
  return `
    <p class="help">Your verified limit: <b class="accent">${usd(limit)}</b></p>
    <label class="field">Amount (mUSD1)
      <input type="number" id="loanAmount" min="1" step="1" value="${eligible ? Math.min(Number(limit) / 1e6, 1000) : 0}" ${eligible ? '' : 'disabled'} />
    </label>
    ${eligible
      ? '<button class="btn" id="requestLoan">Request loan</button>'
      : '<p class="help warn">Not creditworthy yet — build verified history on Sepolia first.</p>'}`;
}

function underwriterForm() {
  return `
    <p class="help">You are the AI underwriter. Open a loan for a verified borrower.</p>
    <label class="field">Borrower address
      <input type="text" id="uwBorrower" placeholder="0x…" />
    </label>
    <label class="field">Amount (mUSD1)
      <input type="number" id="uwAmount" min="1" step="1" value="100" />
    </label>
    <button class="btn" id="underwrite">Underwrite & disburse</button>`;
}

function sourceForm() {
  return `
    <label class="field">Collateral (cUSD)
      <input type="number" id="collAmount" min="1" step="100" value="1000" />
    </label>
    <button class="btn" id="depositCollateral">Lock collateral</button>
    <hr class="soft" />
    <label class="field">Repayment amount (cUSD)
      <input type="number" id="repayAmount" min="1" step="50" value="200" />
    </label>
    <button class="btn" id="recordRepayment">Borrow & repay on-time</button>
    <p class="help">A background relayer proves these events on Creditcoin.</p>`;
}

async function ensureAllowance(tokenAddr, owner, spender, amount) {
  const signer = await wallet.getSigner();
  const token = new Contract(tokenAddr, TOKEN_ABI, signer);
  const current = await token.allowance(owner, spender);
  if (BigInt(current) < BigInt(amount)) {
    await withTx('Approve', token.approve(spender, (1n << 256n) - 1n), 'Approved');
  }
}

async function onDepositCollateral() {
  try {
    await wallet.ensureChain(CONFIG.sepolia);
    const amount = parseUnits($('collAmount').value || '0', 6);
    if (amount <= 0n) throw new Error('Enter an amount');
    const account = state.wallet.account;
    await ensureAllowance(CONFIG.addresses.collateral, account, CONFIG.addresses.source, amount);
    const signer = await wallet.getSigner();
    const source = new Contract(CONFIG.addresses.source, SOURCE_ABI, signer);
    await withTx('Lock collateral', source.depositCollateral(amount), 'Collateral locked on Sepolia');
    toast('Waiting for the relayer to prove it on Creditcoin…', 'info');
  } catch (e) {
    onErr(e);
  }
}

async function onRecordRepayment() {
  try {
    await wallet.ensureChain(CONFIG.sepolia);
    const amount = parseUnits($('repayAmount').value || '0', 6);
    if (amount <= 0n) throw new Error('Enter an amount');
    const account = state.wallet.account;
    const signer = await wallet.getSigner();
    const venue = new Contract(CONFIG.addresses.venue, VENUE_ABI, signer);
    await ensureAllowance(CONFIG.addresses.collateral, account, CONFIG.addresses.venue, amount);
    await withTx('Borrow', venue.borrow(amount), 'Borrowed on Sepolia');
    const loanId = await venue.nextLoanId(account);
    const loanIdPrev = BigInt(loanId) > 0n ? BigInt(loanId) - 1n : 0n;
    await withTx('Repay on-time', venue.repay(loanIdPrev, amount, true), 'Repayment recorded on Sepolia');
    toast('Waiting for the relayer to prove it on Creditcoin…', 'info');
  } catch (e) {
    onErr(e);
  }
}

function buildRationale(borrower, score, limit, amount) {
  const p = state.profile || {};
  return [
    'CreditPass AI underwriter decision',
    `borrower: ${borrower}`,
    `score: ${score}/1000`,
    `verified_limit_usd: ${(Number(limit) / 1e6).toFixed(2)}`,
    `requested_usd: ${(Number(amount) / 1e6).toFixed(2)}`,
    `inputs: collateral=$${(p.collateralUsd || 0) / 1e6}, repaid=$${(p.totalRepaidUsd || 0) / 1e6}, onTime=${p.onTimeCount || 0}, income=$${(p.incomeUsd || 0) / 1e6}`,
    'All inputs proven on Creditcoin via the Attestcoin Protocol.',
  ].join('\n');
}

async function onRequestLoan() {
  try {
    await wallet.ensureChain(CONFIG.creditcoin);
    const amount = parseUnits($('loanAmount').value || '0', 6);
    if (amount <= 0n) throw new Error('Enter an amount');
    const { score, limit } = state.assessment;
    if (amount > BigInt(limit)) throw new Error('Amount exceeds your verified limit');
    const signer = await wallet.getSigner();
    const pool = new Contract(CONFIG.addresses.pool, POOL_ABI, signer);
    const rationale = buildRationale(state.wallet.account, score, limit, amount);
    const decisionHash = keccak256(toUtf8Bytes(rationale));
    const uri = `ipfs://creditpass/${decisionHash.slice(2, 18)}`;
    await withTx('Request loan', pool.requestLoan(amount, decisionHash, uri), 'Loan disbursed');
    await refresh();
    toast('AI decision hash recorded on-chain', 'success');
  } catch (e) {
    onErr(e);
  }
}

async function onUnderwrite() {
  try {
    await wallet.ensureChain(CONFIG.creditcoin);
    const borrower = $('uwBorrower').value.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(borrower)) throw new Error('Invalid borrower address');
    const amount = parseUnits($('uwAmount').value || '0', 6);
    if (amount <= 0n) throw new Error('Enter an amount');
    const signer = await wallet.getSigner();
    const pool = new Contract(CONFIG.addresses.pool, POOL_ABI, signer);
    const [score, limit] = await pool.assessBorrower(borrower);
    if (amount > BigInt(limit)) throw new Error('Amount exceeds the borrower verified limit');
    const rationale = buildRationale(borrower, Number(score), limit, amount);
    const decisionHash = keccak256(toUtf8Bytes(rationale));
    await withTx('Underwrite', pool.underwrite(borrower, amount, decisionHash, `ipfs://creditpass/${decisionHash.slice(2, 18)}`), 'Loan opened');
    await refresh();
  } catch (e) {
    onErr(e);
  }
}

async function onRepay(loanId) {
  try {
    await wallet.ensureChain(CONFIG.creditcoin);
    const signer = await wallet.getSigner();
    const loan = await poolRO.loans(loanId);
    const owed = BigInt(loan[2]);
    if (owed <= 0n) throw new Error('Nothing to repay');
    await ensureAllowance(CONFIG.addresses.usd, state.wallet.account, CONFIG.addresses.pool, owed);
    const pool = new Contract(CONFIG.addresses.pool, POOL_ABI, signer);
    await withTx('Repay', pool.repayLoan(loanId, owed), 'Loan repaid');
    await refresh();
  } catch (e) {
    onErr(e);
  }
}

// ---------------------------------------------------------------------------
// Loan modal
// ---------------------------------------------------------------------------
async function showLoan(id) {
  const l = state.loans.find((x) => x.id === id);
  if (!l) return;
  $('modalTitle').textContent = `Loan #${l.id} · decision`;
  let rationale = null;
  try {
    const res = await fetch(`./rationales/${l.decisionHash}.txt`);
    if (res.ok) rationale = await res.text();
  } catch { /* ignore */ }
  $('modalBody').innerHTML = `
    <div class="row"><span class="k">Borrower</span><span class="v mono">${l.borrower}</span></div>
    <div class="row"><span class="k">Principal</span><span class="v">${usd2(l.principal)}</span></div>
    <div class="row"><span class="k">Owed (incl. 5%)</span><span class="v">${usd2(l.owed)}</span></div>
    <div class="row"><span class="k">Status</span><span class="v">${l.active ? 'Active' : 'Repaid'}</span></div>
    <div class="row"><span class="k">Decision hash</span><span class="v mono">${l.decisionHash}</span></div>
    <div class="row"><span class="k">Rationale URI</span><span class="v mono">${l.rationaleURI}</span></div>
    <h2 style="margin:18px 0 8px">Rationale</h2>
    <pre>${rationale ? escapeHtml(rationale) : 'Rationale not found locally. See ' + l.rationaleURI}</pre>`;
  $('modal').classList.add('show');
}

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------
function initSimulator() {
  const ids = ['sCollateral', 'sRepaid', 'sCount', 'sOnTime', 'sIncome'];
  const update = () => {
    const v = {
      collateralUsd: Number($('sCollateral').value) * 1e6,
      totalRepaidUsd: Number($('sRepaid').value) * 1e6,
      repaymentCount: Number($('sCount').value),
      onTimeCount: Math.min(Number($('sOnTime').value), Number($('sCount').value)),
      incomeUsd: Number($('sIncome').value) * 1e6,
    };
    $('lCollateral').textContent = usd(v.collateralUsd);
    $('lRepaid').textContent = usd(v.totalRepaidUsd);
    $('lCount').textContent = String(v.repaymentCount);
    $('lOnTime').textContent = String(v.onTimeCount);
    $('lIncome').textContent = usd(v.incomeUsd);
    const a = assess(v);
    $('simScore').textContent = `${a.score}/1000`;
    $('simTier').textContent = TIERS[a.tier];
    $('simEligible').innerHTML = a.score >= POLICY.MIN_ELIGIBLE ? '<span class="accent">Yes</span>' : '<span class="warn">Not yet (needs 300+)</span>';
    $('simLimit').textContent = usd(a.limit);
    $('simUnder').innerHTML = a.limit > v.collateralUsd ? '<span class="accent">Yes — limit exceeds collateral</span>' : '<span class="muted">No</span>';
    renderBars($('simBars'), a.components);
  };
  ids.forEach((id) => $(id).addEventListener('input', update));
  update();
}

// ---------------------------------------------------------------------------
// Sample preview
// ---------------------------------------------------------------------------
function renderSample() {
  state.demo = true;
  state.profile = SAMPLE.profile;
  state.loans = SAMPLE.loans;
  state.activity = SAMPLE.activity;
  state.assessment = assess(SAMPLE.profile);
  renderProfile(SAMPLE.profile);
  $('poolLiquidity').textContent = usd(SAMPLE.pool.liquidity);
  $('poolOutstanding').textContent = usd(SAMPLE.pool.outstanding);
  $('poolUtil').textContent = ((SAMPLE.pool.outstanding / SAMPLE.pool.liquidity) * 100).toFixed(1) + '%';
  $('poolUnderwriter').textContent = short(SAMPLE.underwriter);
  $('statLoans').textContent = String(SAMPLE.pool.loans);
  $('ascAddr').textContent = 'demo';
  $('poolAddr').textContent = 'demo';
  renderLoans(SAMPLE.loans);
  renderActivity(SAMPLE.activity);
  renderFlowCounts(SAMPLE.activity);
}

// ---------------------------------------------------------------------------
// Tabs / boot / refresh
// ---------------------------------------------------------------------------
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const activate = (name) => {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === name));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    history.replaceState(null, '', `#${name}`);
  };
  tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.view)));
  const hash = location.hash.replace('#', '');
  if (['dashboard', 'actions', 'flow', 'policy', 'loans'].includes(hash)) activate(hash);
}

function bindCopy() {
  document.querySelectorAll('.copy').forEach((el) =>
    el.addEventListener('click', () => {
      const map = { asc: CONFIG.addresses.passport, pool: CONFIG.addresses.pool };
      navigator.clipboard?.writeText(map[el.dataset.copy] || '');
      el.textContent = 'copied';
      setTimeout(() => (el.textContent = 'copy'), 1200);
    }),
  );
}

async function refresh() {
  if (!configured()) return;
  $('refreshSpin').style.display = 'inline-block';
  $('refreshText').textContent = 'refreshing…';
  try {
    await Promise.all([loadProfile(), loadPool(), loadLoans(), loadActivity()]);
    renderActions();
    $('refreshText').textContent = 'live · ' + new Date().toLocaleTimeString();
  } catch (error) {
    console.error(error);
    $('netDot').classList.add('off');
    $('refreshText').textContent = 'error: ' + (error.shortMessage || error.message);
  } finally {
    $('refreshSpin').style.display = 'none';
  }
}

async function boot() {
  await applyLocalOverrides();
  initTabs();
  initSimulator();
  bindCopy();
  $('modalClose').addEventListener('click', () => $('modal').classList.remove('show'));
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').classList.remove('show'); });

  $('connectBtn').addEventListener('click', async () => {
    try {
      if (state.wallet.account) {
        wallet.disconnect();
        toast('Wallet disconnected', 'info');
      } else {
        await wallet.connect();
        toast('Wallet connected', 'success');
      }
    } catch (e) {
      onErr(e);
    }
  });
  wallet.onChange(renderWallet);

  if (!configured()) {
    renderSample();
    $('configNotice').style.display = 'block';
    $('configNotice').innerHTML =
      '<b>Demo preview</b> — showing sample data. Deploy the contracts and set <span class="mono">web/config.js</span> ' +
      'for live on-chain data and wallet actions. The <b>Policy Simulator</b> uses the real on-chain formula.';
    $('refreshText').textContent = 'demo data';
    $('netName').textContent = 'Demo preview';
    return;
  }

  await initRead();
  renderWallet({ account: null, chainId: null });
  await refresh();
  setInterval(refresh, CONFIG.refreshMs);
}

boot();
