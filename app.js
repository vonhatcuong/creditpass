import { ethers } from 'https://esm.sh/ethers@6.17.0';
import { CONFIG } from './config.js';
import { TIERS, POLICY, usd, usd2, short, assess } from './policy.js';

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------
const ASC_ABI = [
  'function profileOf(address) view returns (uint256 collateralUsd, uint256 totalRepaidUsd, uint256 repaymentCount, uint256 onTimeCount, uint256 incomeUsd, uint64 lastBlockHeight, bool exists)',
  'event PassportUpdated(address indexed user, uint8 indexed action, uint256 amount, uint64 blockHeight)',
];

const POLICY_ABI = [
  'function assess((uint256,uint256,uint256,uint256,uint256,uint64,bool)) view returns (uint16, uint256, uint8)',
];

const POOL_ABI = [
  'function totalLiquidity() view returns (uint256)',
  'function totalOutstanding() view returns (uint256)',
  'function nextLoanId() view returns (uint256)',
  'function underwriter() view returns (address)',
  'function loans(uint256) view returns (address borrower, uint256 principal, uint256 owed, uint64 openedAt, bool active, bytes32 decisionHash, string rationaleURI)',
  'event LoanOpened(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 owed, uint16 verifiedScore, bytes32 decisionHash, string rationaleURI)',
  'event LoanRepaid(uint256 indexed loanId, uint256 amount)',
];

const SOURCE_ABI = [
  'event CollateralDeposited(address indexed user, uint256 amount, uint256 timestamp)',
  'event RepaymentRecorded(address indexed user, uint256 indexed loanId, uint256 amount, bool onTime)',
  'event IncomeReceived(address indexed user, uint256 amount, address token)',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Providers & state
// ---------------------------------------------------------------------------
let ccProvider, sepProvider, asc, policy, pool, source;
let state = { profile: null, loans: [], activity: [], configured: false };
const blockTsCache = new Map();

function configured() {
  return Boolean(CONFIG.addresses.passport && CONFIG.addresses.pool && CONFIG.addresses.policy);
}

async function initContracts() {
  ccProvider = new ethers.JsonRpcProvider(CONFIG.creditcoin.rpc);
  asc = new ethers.Contract(CONFIG.addresses.passport, ASC_ABI, ccProvider);
  policy = new ethers.Contract(CONFIG.addresses.policy, POLICY_ABI, ccProvider);
  pool = new ethers.Contract(CONFIG.addresses.pool, POOL_ABI, ccProvider);
  if (CONFIG.addresses.source) {
    sepProvider = new ethers.JsonRpcProvider(CONFIG.sepolia.rpc);
    source = new ethers.Contract(CONFIG.addresses.source, SOURCE_ABI, sepProvider);
  }
}

async function blockTs(provider, n) {
  if (blockTsCache.has(n)) return blockTsCache.get(n);
  try {
    const b = await provider.getBlock(n);
    const t = b ? b.timestamp * 1000 : 0;
    blockTsCache.set(n, t);
    return t;
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
    } catch (error) {
      if (size > 100) { size = Math.floor(size / 2); } else { start = end + 1; size = chunk; }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------
async function loadProfile() {
  const borrower = CONFIG.borrower || (await pool.underwriter());
  const raw = await asc.profileOf(borrower);
  const profile = {
    address: borrower,
    collateralUsd: Number(raw[0]),
    totalRepaidUsd: Number(raw[1]),
    repaymentCount: Number(raw[2]),
    onTimeCount: Number(raw[3]),
    incomeUsd: Number(raw[4]),
    lastBlockHeight: Number(raw[5]),
    exists: raw[6],
  };
  state.profile = profile;

  const onchain = await policy.assess([raw[0], raw[1], raw[2], raw[3], raw[4], raw[5], raw[6]]);
  profile.onchainScore = Number(onchain[0]);
  profile.onchainLimit = Number(onchain[1]);
  profile.onchainTier = Number(onchain[2]);
  renderProfile(profile);
}

async function loadPool() {
  const [liquidity, outstanding, next, underwriter] = await Promise.all([
    pool.totalLiquidity(), pool.totalOutstanding(), pool.nextLoanId(), pool.underwriter(),
  ]);
  $('poolLiquidity').textContent = usd(liquidity);
  $('poolOutstanding').textContent = usd(outstanding);
  const util = Number(liquidity) > 0 ? (Number(outstanding) / Number(liquidity)) * 100 : 0;
  $('poolUtil').textContent = util.toFixed(1) + '%';
  $('poolUnderwriter').textContent = short(underwriter);
  $('statLoans').textContent = String(Number(next) - 1);
}

async function loadLoans() {
  const next = Number(await pool.nextLoanId());
  const loans = [];
  for (let i = 1; i < next; i++) {
    const l = await pool.loans(i);
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
  const chainKey = 'sep';

  if (source) {
    const head = await sepProvider.getBlockNumber();
    const from = Math.max(0, head - CONFIG.sepolia.lookback);
    const [coll, repay, income] = await Promise.all([
      queryAll(source, 'CollateralDeposited', from, head, CONFIG.sepolia.chunk),
      queryAll(source, 'RepaymentRecorded', from, head, CONFIG.sepolia.chunk),
      queryAll(source, 'IncomeReceived', from, head, CONFIG.sepolia.chunk),
    ]);
    for (const e of coll) items.push({ chain: chainKey, type: 'CollateralDeposited', amount: Number(e.args[1]), block: e.blockNumber, tx: e.transactionHash, address: e.args[0] });
    for (const e of repay) items.push({ chain: chainKey, type: 'RepaymentRecorded', amount: Number(e.args[2]), onTime: e.args[3], block: e.blockNumber, tx: e.transactionHash, address: e.args[0] });
    for (const e of income) items.push({ chain: chainKey, type: 'IncomeReceived', amount: Number(e.args[1]), block: e.blockNumber, tx: e.transactionHash, address: e.args[0] });
  }

  const ccHead = await ccProvider.getBlockNumber();
  const ccFrom = Math.max(0, ccHead - CONFIG.creditcoin.lookback);
  const [passportUpdates, loansOpened, loansRepaid] = await Promise.all([
    queryAll(asc, 'PassportUpdated', ccFrom, ccHead, CONFIG.creditcoin.chunk),
    queryAll(pool, 'LoanOpened', ccFrom, ccHead, CONFIG.creditcoin.chunk),
    queryAll(pool, 'LoanRepaid', ccFrom, ccHead, CONFIG.creditcoin.chunk),
  ]);
  for (const e of passportUpdates) items.push({ chain: 'cc', type: 'PassportUpdated', action: Number(e.args[1]), amount: Number(e.args[2]), block: e.blockNumber, tx: e.transactionHash, address: e.args[0] });
  for (const e of loansOpened) items.push({ chain: 'cc', type: 'LoanOpened', loanId: Number(e.args[0]), amount: Number(e.args[2]), score: Number(e.args[4]), block: e.blockNumber, tx: e.transactionHash });
  for (const e of loansRepaid) items.push({ chain: 'cc', type: 'LoanRepaid', loanId: Number(e.args[0]), amount: Number(e.args[1]), block: e.blockNumber, tx: e.transactionHash });

  // Resolve timestamps for unique blocks (cached, parallel, bounded).
  const uniqueBlocks = [...new Set(items.map((i) => i.block))].slice(0, 60);
  await Promise.all(uniqueBlocks.map(async (b) => {
    const provider = items.find((i) => i.block === b).chain === 'sep' ? sepProvider : ccProvider;
    await blockTs(provider, b);
  }));
  for (const i of items) {
    const provider = i.chain === 'sep' ? sepProvider : ccProvider;
    i.ts = blockTsCache.get(i.block) || 0;
  }

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

  // ring
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (a.score / 1000) * circumference;
  $('ringArc').setAttribute('stroke-dasharray', String(circumference));
  $('ringArc').setAttribute('stroke-dashoffset', String(offset));
  $('ringScore').textContent = String(a.score);
  $('ringTier').textContent = TIERS[a.tier].toUpperCase();

  renderBars($('breakdown'), a.components, a.score, true);
  $('bTotal').textContent = `${a.score}/1000`;

  // sanity note if on-chain assessment differs from local math
  if (typeof p.onchainScore === 'number' && p.onchainScore !== a.score) {
    $('configNotice').style.display = 'block';
    $('configNotice').textContent = `Note: on-chain score ${p.onchainScore} differs from local model ${a.score}. Re-check CONFIG/POLICY.`;
  }
}

function renderBars(target, c, total, showTotal) {
  const rows = [
    ['On-time repayments', c.onTime, POLICY.MAX_REPAYMENT],
    ['Amount repaid', c.repaid, POLICY.MAX_REPAID],
    ['Collateral', c.collateral, POLICY.MAX_COLLATERAL],
    ['Income', c.income, POLICY.MAX_INCOME],
  ];
  target.innerHTML = rows.map(([label, val, max]) => `
    <div class="bar">
      <div class="top"><span class="k">${label}</span><span>${val} / ${max}</span></div>
      <div class="track"><div class="fill" style="width:${(val / max) * 100}%"></div></div>
    </div>`).join('');
}

function renderLoans(loans) {
  const body = $('loansBody');
  if (!loans.length) { body.innerHTML = '<tr><td colspan="7" class="empty">No loans yet.</td></tr>'; return; }
  body.innerHTML = loans.slice().reverse().map((l) => `
    <tr data-loan="${l.id}">
      <td>${l.id}</td>
      <td class="mono">${short(l.borrower)}</td>
      <td>${usd2(l.principal)}</td>
      <td>${usd2(l.owed)}</td>
      <td>${l.active ? '<span class="tag">verified</span>' : '—'}</td>
      <td><span class="tag ${l.active ? 'active' : 'repaid'}">${l.active ? 'Active' : 'Repaid'}</span></td>
      <td class="mono">${l.rationaleURI || '—'}</td>
    </tr>`).join('');
  body.querySelectorAll('tr[data-loan]').forEach((tr) => {
    tr.addEventListener('click', () => showLoan(Number(tr.dataset.loan)));
  });
}

function renderActivity(items) {
  const feed = $('feed');
  if (!items.length) { feed.innerHTML = '<div class="empty">No activity found in the configured lookback window.</div>'; return; }
  feed.innerHTML = items.map((i) => {
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
  }).join('');
}

function describe(i) {
  const who = i.address ? `<span class="mono">${short(i.address)}</span> ` : '';
  switch (i.type) {
    case 'CollateralDeposited': return `${who}<b>locked collateral</b> on Sepolia`;
    case 'RepaymentRecorded': return `${who}<b>repaid</b> on Sepolia ${i.onTime ? '<span class="accent">(on-time)</span>' : '<span class="warn">(late)</span>'}`;
    case 'IncomeReceived': return `${who}<b>received verified income</b> on Sepolia`;
    case 'PassportUpdated': return `${who}<b>passport updated</b> on Creditcoin · ${['collateral', 'repayment', 'income'][i.action]}`;
    case 'LoanOpened': return `<b>AI underwrote loan #${i.loanId}</b> · verified score ${i.score}`;
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
// Loan modal
// ---------------------------------------------------------------------------
async function showLoan(id) {
  const l = state.loans.find((x) => x.id === id);
  if (!l) return;
  $('modalTitle').textContent = `Loan #${l.id} · AI decision`;
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
    <pre>${rationale ? escapeHtml(rationale) : 'Rationale not found locally. Set up agent/rationales or fetch ' + l.rationaleURI}</pre>`;
  $('modal').classList.add('show');
}

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * Optional local-devnet overrides written by `npm run local:e2e` (LOCAL_KEEP_ALIVE=1).
 * Merges web/config.local.json over CONFIG when it exists.
 */
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
// Policy simulator
// ---------------------------------------------------------------------------
function initSimulator() {
  const inputs = ['sCollateral', 'sRepaid', 'sCount', 'sOnTime', 'sIncome'];
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
    $('simEligible').innerHTML = a.score >= POLICY.MIN_ELIGIBLE
      ? '<span class="accent">Yes</span>' : '<span class="warn">Not yet (needs 300+)</span>';
    $('simLimit').textContent = usd(a.limit);
    $('simUnder').innerHTML = a.limit > v.collateralUsd
      ? '<span class="accent">Yes — limit exceeds collateral</span>' : '<span class="muted">No</span>';
    renderBars($('simBars'), a.components, a.score, true);
  };
  inputs.forEach((id) => $(id).addEventListener('input', update));
  update();
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
  if (['dashboard', 'flow', 'policy', 'loans'].includes(hash)) activate(hash);
}

function bindCopy() {
  document.querySelectorAll('.copy').forEach((el) => {
    el.addEventListener('click', () => {
      const map = { asc: CONFIG.addresses.passport, pool: CONFIG.addresses.pool };
      navigator.clipboard?.writeText(map[el.dataset.copy] || '');
      el.textContent = 'copied';
      setTimeout(() => (el.textContent = 'copy'), 1200);
    });
  });
}

async function refresh() {
  $('refreshSpin').style.display = 'inline-block';
  $('refreshText').textContent = 'refreshing…';
  try {
    await Promise.all([loadProfile(), loadPool(), loadLoans(), loadActivity()]);
    $('netDot').classList.remove('off');
    $('refreshText').textContent = 'live · updated ' + new Date().toLocaleTimeString();
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
  $('netName').textContent = CONFIG.creditcoin.name;
  $('ccLink').href = CONFIG.creditcoin.explorer;
  $('sepLink').href = CONFIG.sepolia.explorer;
  initTabs();
  initSimulator();
  bindCopy();
  $('modalClose').addEventListener('click', () => $('modal').classList.remove('show'));
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').classList.remove('show'); });

  if (!configured()) {
    $('configNotice').style.display = 'block';
    $('configNotice').innerHTML =
      'Dashboard not configured yet. Deploy the contracts, then fill <span class="mono">web/config.js</span> ' +
      '(or copy addresses from <span class="mono">deployments.json</span>). The Policy Simulator below works without any deployment.';
    $('refreshText').textContent = 'waiting for config';
    return;
  }

  await initContracts();
  await refresh();
  setInterval(refresh, CONFIG.refreshMs);
}

boot();
