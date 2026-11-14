import { describe, expect, it } from 'vitest';
import { expected, runFixture } from './helpers/fixtures.js';

describe('field dialects (AC-1)', () => {
  const cases: Array<[string, string]> = [
    ['reasoning-content', 'reasoning_content'],
    ['reasoning', 'reasoning'],
    ['alias-both', 'reasoning_content'],
  ];

  for (const [name, dialect] of cases) {
    it(name + ' normalizes to the expected strings and dialect ' + dialect, async () => {
      const r = await runFixture(name);
      expect(r.reasoning).toBe('Let me add 2 and 2.');
      expect(r.text).toBe('The answer is 4.');
      expect(r.done.type === 'done' && r.done.dialect).toBe(dialect);
      expect(r.done.type === 'done' && r.done.warnings).toEqual([]);
    });

    it(name + ' emits the reasoning only once', async () => {
      const r = await runFixture(name);
      const fieldEvents = r.events.filter((e) => e.type === 'reasoning');
      expect(fieldEvents.map((e) => (e.type === 'reasoning' ? e.text : '')).join('')).toBe(
        'Let me add 2 and 2.',
      );
      expect(fieldEvents.every((e) => e.type === 'reasoning' && e.source === 'field')).toBe(true);
    });
  }

  it('every fixture in expected.json matches its documented outcome', async () => {
    for (const [name, want] of Object.entries(expected)) {
      const r = await runFixture(name);
      expect(r.reasoning, name).toBe(want.reasoning);
      expect(r.text, name).toBe(want.text);
      expect(r.done.type === 'done' && r.done.dialect, name).toBe(want.dialect);
    }
  });
});
