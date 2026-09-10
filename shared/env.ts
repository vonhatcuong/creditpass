import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = path.resolve(__dirname, '..');
const DEPLOYMENTS = path.join(ROOT, 'deployments.json');

/**
 * Loads `.env` and, if present, the `deployments.json` written by the deploy
 * scripts. Shell-exported variables always win over file values.
 */
export function loadEnv(): void {
  const shell = { ...process.env };

  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

  if (fs.existsSync(DEPLOYMENTS)) {
    const deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS, 'utf8')) as Record<string, string>;
    for (const [key, value] of Object.entries(deployments)) {
      if (value) process.env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(shell)) {
    if (value !== undefined) process.env[key] = value;
  }
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env var: ${key}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export function saveDeployment(key: string, value: string): void {
  let deployments: Record<string, string> = {};
  if (fs.existsSync(DEPLOYMENTS)) {
    deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS, 'utf8')) as Record<string, string>;
  }
  deployments[key] = value;
  fs.writeFileSync(DEPLOYMENTS, JSON.stringify(deployments, null, 2));
}

export const ROOT_DIR = ROOT;
