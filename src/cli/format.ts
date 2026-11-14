import { t } from '../i18n/index.js';
import type { Lang, MessageKey } from '../i18n/index.js';
import type { Dialect } from '../types.js';
import type { ProbeResult } from './probe.js';

function issuesText(lang: Lang, n: number): string {
  return t(lang, n === 1 ? 'issueOne' : 'issues', { n });
}

function warningTexts(lang: Lang, r: ProbeResult): string[] {
  return r.warnings.map((w) => w + ': ' + t(lang, ('warn.' + w) as MessageKey));
}

function optionsText(r: ProbeResult): string {
  const parts: string[] = [];
  if (r.options.startInReasoning) parts.push('startInReasoning');
  if (r.options.tagMode) parts.push('tagMode=' + r.options.tagMode);
  if (r.options.tags) parts.push('tags=' + r.options.tags.join(','));
  return parts.join(', ');
}

/** One line per fixture, used for `--fixture all`. */
export function formatRow(lang: Lang, r: ProbeResult, width: number): string {
  const cols = [
    r.name.padEnd(width),
    t(lang, 'labelDialect') + ' ' + r.dialect,
    t(lang, 'labelReasoning') + ' ' + t(lang, 'labelChars', { n: r.reasoning.length }),
    t(lang, 'labelText') + ' ' + t(lang, 'labelChars', { n: r.text.length }),
  ];
  if (r.naiveIssues && r.normalizedIssues) {
    cols.push(t(lang, 'naive') + ': ' + issuesText(lang, r.naiveIssues.length));
    cols.push(t(lang, 'normalized') + ': ' + issuesText(lang, r.normalizedIssues.length));
  }
  if (r.warnings.length > 0) cols.push(t(lang, 'labelWarnings') + ' ' + r.warnings.join(','));
  return cols.join(' | ');
}

/** Multi-line report for a single fixture or a live endpoint. */
export function formatDetail(lang: Lang, r: ProbeResult): string {
  const lines: string[] = [];
  lines.push(t(lang, r.mode === 'real' ? 'labelModel' : 'labelFixture') + ': ' + r.name);
  lines.push(t(lang, 'labelDialect') + ': ' + r.dialect);
  lines.push(t(lang, 'labelReasoning') + ': ' + t(lang, 'labelChars', { n: r.reasoning.length }));
  lines.push(t(lang, 'labelText') + ': ' + t(lang, 'labelChars', { n: r.text.length }));
  const opts = optionsText(r);
  if (opts) lines.push(t(lang, 'labelOptions') + ': ' + opts);
  if (r.firstReasoningMs !== undefined) {
    lines.push(t(lang, 'labelFirstReasoning') + ': ' + t(lang, 'labelMs', { n: r.firstReasoningMs }));
  }
  if (r.firstTextMs !== undefined) {
    lines.push(t(lang, 'labelFirstText') + ': ' + t(lang, 'labelMs', { n: r.firstTextMs }));
  }
  if (r.finishReason) lines.push(t(lang, 'labelFinish') + ': ' + r.finishReason);
  const warnings = warningTexts(lang, r);
  lines.push(t(lang, 'labelWarnings') + ': ' + (warnings.length === 0 ? t(lang, 'labelNone') : ''));
  for (const w of warnings) lines.push('  - ' + w);
  const strayClose = r.dialect === 'none' && r.warnings.includes('stray-close-tag');
  lines.push(
    t(lang, 'labelRecommended') +
      ': ' +
      t(lang, strayClose ? 'recommend.stray' : (('recommend.' + r.dialect) as MessageKey)),
  );
  if (r.naiveIssues && r.normalizedIssues) {
    lines.push(t(lang, 'naive') + ': ' + issuesText(lang, r.naiveIssues.length));
    for (const k of r.naiveIssues) lines.push('  - ' + t(lang, ('issue.' + k) as MessageKey));
    lines.push(t(lang, 'normalized') + ': ' + issuesText(lang, r.normalizedIssues.length));
    for (const k of r.normalizedIssues) lines.push('  - ' + t(lang, ('issue.' + k) as MessageKey));
  }
  return lines.join('\n');
}

export function toJson(r: ProbeResult): Record<string, unknown> {
  return {
    name: r.name,
    mode: r.mode,
    dialect: r.dialect satisfies Dialect,
    reasoning: r.reasoning,
    text: r.text,
    warnings: r.warnings,
    finishReason: r.finishReason,
    options: r.options,
    firstReasoningMs: r.firstReasoningMs ?? null,
    firstTextMs: r.firstTextMs ?? null,
    naiveIssues: r.naiveIssues ?? null,
    normalizedIssues: r.normalizedIssues ?? null,
  };
}
