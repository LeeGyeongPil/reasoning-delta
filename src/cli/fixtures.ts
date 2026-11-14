import { readFileSync, readdirSync } from 'node:fs';
import type { NormalizeOptions } from '../types.js';

const dir = new URL('../../fixtures/', import.meta.url);

export interface FixtureInfo {
  reasoning: string;
  text: string;
  dialect: string;
  mimics: string;
  options?: NormalizeOptions;
}

/** Documented expected outcome of each bundled fixture. */
export function expectedOutcomes(): Record<string, FixtureInfo> {
  return JSON.parse(readFileSync(new URL('expected.json', dir), 'utf8')) as Record<string, FixtureInfo>;
}

export function fixtureNames(): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sse'))
    .map((f) => f.slice(0, -4))
    .sort();
}

export function readFixture(name: string): string {
  return readFileSync(new URL(name + '.sse', dir), 'utf8');
}
