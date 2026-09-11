import fs from 'node:fs';
import path from 'node:path';

/**
 * Structured telemetry for the Attestcoin proof pipeline.
 *
 * Every source event moves through explicit stages:
 *   emitted -> attesting -> attested -> proved            (success)
 *   emitted -> attesting -> failed                        (error)
 *
 * The worker (and the local relayer) append to a JSON file that the dashboard polls,
 * so the proof progress is visible in real time instead of hidden in logs.
 */

export type Stage = 'emitted' | 'attesting' | 'attested' | 'proved' | 'failed';

export interface TelemetryEvent {
  id: string;
  type: string;
  user: string;
  amount: string;
  onTime?: boolean;
  sourceTx: string;
  sourceBlock: number;
  status: Stage;
  latestAttestedHeight?: number;
  creditcoinTx?: string | null;
  error?: string | null;
  history: { stage: Stage; at: string; note?: string }[];
}

export interface TelemetryData {
  updatedAt: string;
  chainKey: number;
  source: string;
  passport: string;
  latestAttestedHeight: number;
  events: TelemetryEvent[];
}

export class Telemetry {
  private data: TelemetryData;

  constructor(private file: string, meta: { chainKey: number; source: string; passport: string }) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.data = {
      updatedAt: new Date().toISOString(),
      chainKey: meta.chainKey,
      source: meta.source,
      passport: meta.passport,
      latestAttestedHeight: 0,
      events: [],
    };
    this.flush();
  }

  private find(id: string): TelemetryEvent | undefined {
    return this.data.events.find((e) => e.id === id);
  }

  private flush() {
    this.data.updatedAt = new Date().toISOString();
    this.data.events = this.data.events.slice(-200);
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  emitted(base: Omit<TelemetryEvent, 'status' | 'history'>): TelemetryEvent {
    let e = this.find(base.id);
    if (!e) {
      e = { ...base, status: 'emitted', history: [] };
      this.data.events.push(e);
    }
    this.push(e, 'emitted', `block ${base.sourceBlock}`);
    this.flush();
    return e;
  }

  attesting(id: string, latestAttestedHeight: number, targetHeight: number) {
    const e = this.find(id);
    if (!e) return;
    e.status = 'attesting';
    e.latestAttestedHeight = latestAttestedHeight;
    this.push(e, 'attesting', `attested ${latestAttestedHeight}/${targetHeight}`);
    this.data.latestAttestedHeight = latestAttestedHeight;
    this.flush();
  }

  attested(id: string, height: number) {
    const e = this.find(id);
    if (!e) return;
    e.status = 'attested';
    e.latestAttestedHeight = height;
    this.push(e, 'attested', `height ${height}`);
    this.flush();
  }

  proved(id: string, creditcoinTx: string) {
    const e = this.find(id);
    if (!e) return;
    e.status = 'proved';
    e.creditcoinTx = creditcoinTx;
    this.push(e, 'proved', creditcoinTx);
    this.flush();
  }

  failed(id: string, error: string) {
    const e = this.find(id);
    if (!e) return;
    e.status = 'failed';
    e.error = error;
    this.push(e, 'failed', error);
    this.flush();
  }

  setLatestAttestedHeight(height: number) {
    this.data.latestAttestedHeight = height;
    this.flush();
  }

  private push(e: TelemetryEvent, stage: Stage, note?: string) {
    e.history.push({ stage, at: new Date().toISOString(), note });
  }
}

/** Consistent structured logger: [time] [SCOPE] message key=value … */
export function log(scope: string, message: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString().slice(11, 19);
  const extra = data
    ? ' ' +
      Object.entries(data)
        .map(([k, v]) => `${k}=${v === undefined || v === null ? '-' : v}`)
        .join(' ')
    : '';
  console.log(`[${ts}] [${scope.padEnd(10)}] ${message}${extra}`);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
