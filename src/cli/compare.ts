import type { ChunkLike } from '../types.js';

export interface Reading {
  reasoning: string;
  text: string;
}

export type IssueKind =
  | 'reasoning-in-text'
  | 'tag-fragment'
  | 'reasoning-missing'
  | 'reasoning-duplicated'
  | 'text-differs'
  | 'reasoning-differs';

/**
 * A hand-rolled reader of the kind people write first: take the reasoning field if there is one,
 * pull complete `<think>…</think>` blocks out of each chunk, and strip complete tags per chunk.
 * It has no state between chunks, so tags cut across chunks and repeated reasoning get through.
 */
export function naiveRead(chunks: readonly ChunkLike[]): Reading {
  let reasoning = '';
  let text = '';
  for (const chunk of chunks) {
    const delta = chunk.choices?.find((c) => (c.index ?? 0) === 0)?.delta;
    if (!delta) continue;
    reasoning += delta.reasoning_content ?? delta.reasoning ?? '';
    let content = typeof delta.content === 'string' ? delta.content : '';
    content = content.replace(/<think>([\s\S]*?)<\/think>/g, (_all, inner: string) => {
      reasoning += inner;
      return '';
    });
    text += content.replace(/<\/?think>/g, '');
  }
  return { reasoning: reasoning.trim(), text: text.trim() };
}

const FRAGMENT = /<\/?(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?>?|(?:nk|ink|hink)>/g;

function count(haystack: string, needle: string): number {
  if (needle === '') return 0;
  return haystack.split(needle).length - 1;
}

/**
 * Differences between a reading and the expected reading. The counts are computed from the
 * strings, nothing is hard-coded per fixture.
 */
export function issuesOf(reading: Reading, expected: Reading): IssueKind[] {
  const issues: IssueKind[] = [];
  const fragments = (s: string): number => (s.match(FRAGMENT) ?? []).length;

  if (expected.reasoning !== '' && reading.text.includes(expected.reasoning)) {
    issues.push('reasoning-in-text');
  }
  if (fragments(reading.text) > fragments(expected.text)) issues.push('tag-fragment');
  if (expected.reasoning !== '' && reading.reasoning === '') issues.push('reasoning-missing');
  if (count(reading.reasoning, expected.reasoning) >= 2) issues.push('reasoning-duplicated');
  if (issues.length === 0) {
    if (reading.text !== expected.text) issues.push('text-differs');
    if (reading.reasoning !== expected.reasoning) issues.push('reasoning-differs');
  }
  return issues;
}
