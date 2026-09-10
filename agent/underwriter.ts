import fs from 'node:fs';
import path from 'node:path';
import { JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { loadEnv, requireEnv, ROOT_DIR } from '../shared/env';
import { attach } from '../shared/artifacts';

/**
 * CreditPass AI underwriting agent.
 *
 * Runs the autonomous underwriting loop:
 *   1. Reads the borrower's Credit Passport — data proven on Creditcoin by the
 *      Attestcoin Protocol, not reported by any oracle.
 *   2. Calls CreditPolicy.assess() for the on-chain verified score/limit/tier.
 *   3. Produces a decision + human-readable rationale (LLM if configured).
 *   4. Anchors the decision hash on-chain and triggers disbursement via
 *      CreditPool.underwrite().
 *
 * The agent can never exceed the on-chain limit: the pool re-checks the policy, so
 * the model is advisory and the verified math is the final authority.
 */

const USD = 10n ** 6n;
const fmt = (n: bigint) => `$${(Number(n) / 1e6).toLocaleString('en-US')}`;

async function main() {
  loadEnv();

  const ccRpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const borrowerKey = process.env.BORROWER_PRIVATE_KEY;
  const borrower = borrowerKey ? new Wallet(borrowerKey).address : new Wallet(requireEnv('DEPLOYER_PRIVATE_KEY')).address;

  const agentKey = process.env.AGENT_PRIVATE_KEY || requireEnv('DEPLOYER_PRIVATE_KEY');
  const agent = new Wallet(agentKey, new JsonRpcProvider(ccRpcUrl));

  const asc = attach('CreditPassportASC', requireEnv('CREDIT_PASSPORT_ASC_ADDRESS'), agent);
  const policy = attach('CreditPolicy', requireEnv('CREDIT_POLICY_ADDRESS'), agent);
  const pool = attach('CreditPool', requireEnv('CREDIT_POOL_ADDRESS'), agent);

  console.log(`Agent:    ${agent.address}`);
  console.log(`Borrower: ${borrower}`);

  const profile = await asc.profileOf(borrower);
  const [score, limit, tier] = await policy.assess(profile);

  console.log('\nVerified Credit Passport (proven cross-chain data):');
  console.log(`  collateral:    ${fmt(profile.collateralUsd)}`);
  console.log(`  total repaid:  ${fmt(profile.totalRepaidUsd)}`);
  console.log(`  repayments:    ${profile.repaymentCount} (on-time: ${profile.onTimeCount})`);
  console.log(`  income:        ${fmt(profile.incomeUsd)}`);
  console.log(`  -> score: ${score}/1000 | tier: ${tier} | verified limit: ${fmt(limit)}`);

  if (limit === 0n) {
    console.log('\nNot yet creditworthy. Build more verified history first.');
    return;
  }

  const amount = process.env.LOAN_AMOUNT ? BigInt(process.env.LOAN_AMOUNT) * USD : limit;
  const rationale = await buildRationale({ borrower, profile, score, limit, tier, amount });

  const decisionHash = keccak256(toUtf8Bytes(rationale));
  const uri = `ipfs://creditpass/${decisionHash.slice(2, 18)}`;
  writeRationale(decisionHash, rationale);

  console.log(`\nDecision: lend ${fmt(amount)} (verified limit ${fmt(limit)})`);
  console.log(`Rationale (${uri}):\n${indent(rationale)}`);

  const tx = await pool.underwrite(borrower, amount, decisionHash, uri);
  const receipt = await tx.wait();
  console.log(`\nLoan disbursed on Creditcoin: ${receipt.hash}`);
}

async function buildRationale(ctx: {
  borrower: string;
  profile: any;
  score: bigint;
  limit: bigint;
  tier: bigint;
  amount: bigint;
}): Promise<string> {
  const facts = {
    policy_version: 'creditpass-v1',
    borrower: ctx.borrower,
    verified_score: ctx.score.toString(),
    tier: ctx.tier.toString(),
    verified_limit_usd: (Number(ctx.limit) / 1e6).toString(),
    requested_usd: (Number(ctx.amount) / 1e6).toString(),
    verified_inputs: {
      collateral_usd: (Number(ctx.profile.collateralUsd) / 1e6).toString(),
      total_repaid_usd: (Number(ctx.profile.totalRepaidUsd) / 1e6).toString(),
      repayment_count: ctx.profile.repaymentCount.toString(),
      on_time_count: ctx.profile.onTimeCount.toString(),
      income_usd: (Number(ctx.profile.incomeUsd) / 1e6).toString(),
    },
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return [
      `Underwriting decision for ${ctx.borrower}`,
      `All inputs below were proven on Creditcoin by the Attestcoin Protocol (no oracle operator).`,
      `Verified score ${ctx.score}/1000 places the borrower in tier ${ctx.tier}.`,
      `Collateral ${fmt(ctx.profile.collateralUsd)}, ${ctx.profile.onTimeCount}/${ctx.profile.repaymentCount} on-time repayments, income ${fmt(ctx.profile.incomeUsd)}.`,
      `Decision: approve ${fmt(ctx.amount)} within the verified limit of ${fmt(ctx.limit)}.`,
      JSON.stringify(facts),
    ].join('\n');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are an on-chain credit underwriter. Given cryptographically verified inputs, produce a concise, decision-oriented rationale (3-5 sentences). Never exceed the verified limit.',
          },
          { role: 'user', content: JSON.stringify(facts) },
        ],
      }),
    });
    const json: any = await response.json();
    const text = json?.choices?.[0]?.message?.content;
    if (text) return `${text}\n\nVERIFIED_INPUTS\n${JSON.stringify(facts)}`;
  } catch (error: any) {
    console.warn(`LLM rationale failed (${error?.message}); using deterministic template.`);
  }

  return `Approve ${fmt(ctx.amount)} within verified limit ${fmt(ctx.limit)}. Score ${ctx.score}/1000, tier ${ctx.tier}. ${JSON.stringify(facts)}`;
}

function writeRationale(hash: string, rationale: string) {
  const dir = path.join(ROOT_DIR, 'web', 'rationales');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${hash}.txt`), rationale);
}

function indent(text: string) {
  return text
    .split('\n')
    .map((line) => `  | ${line}`)
    .join('\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
