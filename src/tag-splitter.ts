import type { Segment, SegmentKind, TagMode, Warning } from './types.js';

export const DEFAULT_TAGS: readonly string[] = ['think', 'reasoning', 'thought'];

export interface TagSplitterOptions {
  /** Tag names (without angle brackets). Default `['think', 'reasoning', 'thought']`. */
  tags?: readonly string[];
  /** Default `'leading'`. */
  mode?: TagMode;
  /** Start inside a reasoning block (the opening tag is not in the stream). */
  startInReasoning?: boolean;
}

type Phase = 'start' | 'reasoning' | 'text';

/**
 * Splits streamed text into reasoning and answer parts by `<think>`-style tags.
 *
 * It is safe at any chunk boundary: a tail that could still become a tag
 * (`<`, `<th`, `</thi`) is held back until the next chunk (or `end()`) decides.
 * Whitespace right after an opening tag and right after a closing tag is dropped.
 */
export class TagSplitter {
  /** Warnings found so far (`stray-close-tag`, `unclosed-tag`). */
  readonly warnings: Warning[] = [];

  private readonly mode: TagMode;
  private readonly openTags: string[];
  private readonly closeTags: string[];
  private phase: Phase;
  private closeTargets: string[];
  private buf = '';
  private trimNext = false;
  private found = false;
  private total = 0;

  constructor(options: TagSplitterOptions = {}) {
    const names = options.tags ?? DEFAULT_TAGS;
    this.mode = options.mode ?? 'leading';
    this.openTags = names.map((n) => '<' + n + '>');
    this.closeTags = names.map((n) => '</' + n + '>');
    this.closeTargets = this.closeTags;
    this.phase = options.startInReasoning === true && this.mode !== 'off' ? 'reasoning' : 'start';
    if (this.mode === 'anywhere' && this.phase === 'start') this.phase = 'text';
  }

  /** True once a reasoning block was opened (or closed) in this stream. */
  get foundReasoning(): boolean {
    return this.found;
  }

  /** Feed the next piece of `content`. Returns what can be decided now. */
  push(text: string): Segment[] {
    if (this.mode === 'off') return text.length > 0 ? [{ kind: 'text', text }] : [];
    this.total += text.length;
    this.buf += text;
    return this.drain(false);
  }

  /** Call once when the stream ends. Flushes the held tail. */
  end(): Segment[] {
    if (this.mode === 'off') return [];
    return this.drain(true);
  }

  private warn(w: Warning): void {
    if (!this.warnings.includes(w)) this.warnings.push(w);
  }

  private drain(final: boolean): Segment[] {
    const out: Segment[] = [];
    const emit = (kind: SegmentKind, text: string): void => {
      if (text.length === 0) return;
      if (kind === 'reasoning') this.found = true;
      const last = out[out.length - 1];
      if (last !== undefined && last.kind === kind) last.text += text;
      else out.push({ kind, text });
    };

    for (;;) {
      if (this.trimNext) {
        this.buf = this.buf.replace(/^\s+/, '');
        if (this.buf.length === 0) break;
        this.trimNext = false;
      }

      if (this.phase === 'reasoning') {
        const hit = firstHit(this.buf, this.closeTargets);
        if (hit !== null) {
          emit('reasoning', this.buf.slice(0, hit.index));
          this.buf = this.buf.slice(hit.index + hit.tag.length);
          this.phase = 'text';
          this.trimNext = true;
          this.found = true;
          continue;
        }
        if (final) {
          emit('reasoning', this.buf);
          if (this.total > 0) this.warn('unclosed-tag');
          this.buf = '';
          break;
        }
        const hold = heldTail(this.buf, this.closeTargets);
        emit('reasoning', this.buf.slice(0, this.buf.length - hold));
        this.buf = this.buf.slice(this.buf.length - hold);
        break;
      }

      if (this.phase === 'start') {
        const s = this.buf.replace(/^\s+/, '');
        if (s.length === 0) {
          if (final) emit('text', this.buf);
          if (final) this.buf = '';
          break;
        }
        const opened = this.openTags.find((t) => s.startsWith(t));
        if (opened !== undefined) {
          const name = opened.slice(1, -1);
          this.closeTargets = ['</' + name + '>'];
          this.buf = s.slice(opened.length);
          this.phase = 'reasoning';
          this.trimNext = true;
          this.found = true;
          continue;
        }
        if (!final && this.openTags.some((t) => t.startsWith(s))) break;
        this.phase = 'text';
        continue;
      }

      // phase === 'text'
      const watchOpen = this.mode === 'anywhere';
      const opens = watchOpen ? firstHit(this.buf, this.openTags) : null;
      const closes = firstHit(this.buf, this.closeTags);
      if (opens !== null && (closes === null || opens.index < closes.index)) {
        emit('text', this.buf.slice(0, opens.index));
        const name = opens.tag.slice(1, -1);
        this.closeTargets = ['</' + name + '>'];
        this.buf = this.buf.slice(opens.index + opens.tag.length);
        this.phase = 'reasoning';
        this.trimNext = true;
        this.found = true;
        continue;
      }
      if (final) {
        if (this.closeTags.some((t) => this.buf.includes(t))) this.warn('stray-close-tag');
        emit('text', this.buf);
        this.buf = '';
        break;
      }
      const hold = heldTail(this.buf, watchOpen ? [...this.openTags, ...this.closeTags] : this.closeTags);
      const ready = this.buf.slice(0, this.buf.length - hold);
      if (this.closeTags.some((t) => ready.includes(t))) this.warn('stray-close-tag');
      emit('text', ready);
      this.buf = this.buf.slice(this.buf.length - hold);
      break;
    }
    return out;
  }
}

/** Earliest occurrence of any tag in `s`. */
function firstHit(s: string, tags: readonly string[]): { index: number; tag: string } | null {
  let best: { index: number; tag: string } | null = null;
  for (const tag of tags) {
    const index = s.indexOf(tag);
    if (index !== -1 && (best === null || index < best.index)) best = { index, tag };
  }
  return best;
}

/** Length of the longest tail of `s` that is a proper prefix of one of `tags`. */
function heldTail(s: string, tags: readonly string[]): number {
  let longest = 0;
  for (const tag of tags) {
    const max = Math.min(s.length, tag.length - 1);
    for (let k = max; k > longest; k--) {
      if (s.endsWith(tag.slice(0, k))) {
        longest = k;
        break;
      }
    }
  }
  return longest;
}
