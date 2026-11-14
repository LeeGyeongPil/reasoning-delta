import { describe, expect, it } from 'vitest';
import { messages, resolveLang, t } from '../src/i18n/index.js';
import { main } from '../src/cli/main.js';

async function cli(argv: string[], env: Record<string, string | undefined> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, env, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const HANGUL = /[가-힣]/;

describe('languages (AC-8)', () => {
  it('en and ko message key sets are identical', () => {
    expect(Object.keys(messages.ko).sort()).toEqual(Object.keys(messages.en).sort());
    for (const lang of ['en', 'ko'] as const) {
      for (const [key, value] of Object.entries(messages[lang])) {
        expect(value.length, lang + ':' + key).toBeGreaterThan(0);
      }
    }
  });

  it('placeholders match between languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(messages.en) as Array<keyof typeof messages.en>) {
      expect(ph(messages.ko[key]), key).toEqual(ph(messages.en[key]));
    }
  });

  it('--help prints in the requested language', async () => {
    const en = await cli(['--help', '--lang', 'en']);
    const ko = await cli(['--help', '--lang', 'ko']);
    expect(en.code).toBe(0);
    expect(ko.code).toBe(0);
    expect(en.out).not.toMatch(HANGUL);
    expect(ko.out).toMatch(HANGUL);
  });

  it('probe --fixture reasoning prints in the requested language', async () => {
    const en = await cli(['probe', '--fixture', 'reasoning', '--lang', 'en']);
    const ko = await cli(['probe', '--fixture', 'reasoning', '--lang', 'ko']);
    expect(en.code).toBe(0);
    expect(ko.code).toBe(0);
    expect(en.out).not.toMatch(HANGUL);
    expect(en.out).toContain('dialect: reasoning');
    expect(ko.out).toMatch(HANGUL);
    expect(ko.out).toContain('방언: reasoning');
  });

  it('precedence: --lang > REASONING_DELTA_LANG > LC_ALL > LC_MESSAGES > LANG > English', () => {
    expect(resolveLang('en', { REASONING_DELTA_LANG: 'ko', LANG: 'ko_KR.UTF-8' })).toBe('en');
    expect(resolveLang(undefined, { REASONING_DELTA_LANG: 'ko', LC_ALL: 'en_US.UTF-8' })).toBe('ko');
    expect(resolveLang(undefined, { REASONING_DELTA_LANG: 'en', LC_ALL: 'ko_KR.UTF-8' })).toBe('en');
    expect(resolveLang(undefined, { LC_ALL: 'ko_KR.UTF-8', LC_MESSAGES: 'en_US', LANG: 'en_US' })).toBe('ko');
    expect(resolveLang(undefined, { LC_MESSAGES: 'ko_KR', LANG: 'en_US' })).toBe('ko');
    expect(resolveLang(undefined, { LANG: 'ko_KR.UTF-8' })).toBe('ko');
    expect(resolveLang(undefined, { LANG: 'fr_FR.UTF-8' })).toBe('en');
    expect(resolveLang(undefined, {})).toBe('en');
  });

  it('the CLI follows the precedence end to end', async () => {
    const viaEnv = await cli(['--help'], { REASONING_DELTA_LANG: 'ko' });
    expect(viaEnv.out).toMatch(HANGUL);
    const flagWins = await cli(['--help', '--lang=en'], { REASONING_DELTA_LANG: 'ko', LANG: 'ko_KR.UTF-8' });
    expect(flagWins.out).not.toMatch(HANGUL);
    const viaLang = await cli(['--help'], { LANG: 'ko_KR.UTF-8' });
    expect(viaLang.out).toMatch(HANGUL);
    const fallback = await cli(['--help'], { LANG: 'C' });
    expect(fallback.out).not.toMatch(HANGUL);
  });

  it('errors are localized too', async () => {
    const ko = await cli(['probe', '--fixture', 'nope', '--lang', 'ko']);
    expect(ko.code).toBe(1);
    expect(ko.err).toMatch(HANGUL);
    const en = await cli(['probe', '--fixture', 'nope', '--lang', 'en']);
    expect(en.err).not.toMatch(HANGUL);
  });

  it('t() fills placeholders and keeps unknown ones visible', () => {
    expect(t('en', 'labelChars', { n: 3 })).toBe('3 chars');
    expect(t('ko', 'labelChars', { n: 3 })).toBe('3자');
    expect(t('en', 'labelChars')).toBe('{n} chars');
  });
});
