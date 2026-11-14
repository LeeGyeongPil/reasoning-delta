import { UnknownProfileError } from './errors.js';
import type { ProfileName, ServerProfile } from './types.js';

/** Returns the profile unchanged (typed helper for user-defined profiles). */
export function defineProfile(profile: ServerProfile): ServerProfile {
  return profile;
}

const CHECKED = '2026-11-14';

/**
 * Built-in server profiles. Every send-back rule lists the page it comes from.
 * `verified: false` means the docs do not say how the server wants reasoning
 * in the next request, so the safe default is to remove it. Override with
 * `defineProfile()` once you have confirmed otherwise for your server.
 */
export const profiles: Record<ProfileName, ServerProfile> = {
  deepseek: {
    name: 'deepseek',
    read: {},
    // Without tools the field is ignored; with tools it must be passed back in every later request.
    sendBack: { field: 'reasoning_content', when: 'with-tools', details: false },
    verified: true,
    sources: ['https://api-docs.deepseek.com/guides/thinking_mode'],
    checked: CHECKED,
  },
  vllm: {
    name: 'vllm',
    read: {},
    sendBack: { field: null, when: 'never', details: false },
    verified: false,
    sources: ['https://docs.vllm.ai/en/latest/features/reasoning_outputs.html'],
    checked: CHECKED,
    notes:
      'Responses use `reasoning` (older versions: `reasoning_content`); the docs do not describe sending it back.',
  },
  llamacpp: {
    name: 'llamacpp',
    read: {},
    sendBack: { field: null, when: 'never', details: false },
    verified: false,
    sources: ['https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md'],
    checked: CHECKED,
    notes: '`--reasoning-format deepseek` puts reasoning in `reasoning_content`; `none` leaves tags in `content`.',
  },
  'llamacpp-legacy': {
    name: 'llamacpp-legacy',
    read: {},
    sendBack: { field: null, when: 'never', details: false },
    verified: false,
    sources: ['https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md'],
    checked: CHECKED,
    notes: '`--reasoning-format deepseek-legacy` keeps `<think>` in `content` and also fills `reasoning_content`.',
  },
  openrouter: {
    name: 'openrouter',
    read: {},
    // reasoning_details must be passed back unmodified and in order; plain text may go in `reasoning`.
    sendBack: { field: 'reasoning', when: 'always', details: true },
    verified: true,
    sources: ['https://openrouter.ai/docs/use-cases/reasoning-tokens'],
    checked: CHECKED,
  },
  ollama: {
    name: 'ollama',
    read: {},
    sendBack: { field: null, when: 'never', details: false },
    verified: false,
    sources: ['https://docs.ollama.com/api/openai-compatibility'],
    checked: CHECKED,
    notes: 'The docs do not name the delta field, so detection decides; reasoning is removed when sending back.',
  },
  'think-tag': {
    name: 'think-tag',
    read: { tagMode: 'leading' },
    sendBack: { field: null, when: 'never', details: false },
    verified: false,
    sources: ['https://docs.vllm.ai/en/latest/features/reasoning_outputs.html'],
    checked: CHECKED,
    notes: 'Reasoning arrives as <think> tags inside `content`; it is removed from history by default.',
  },
  strict: {
    name: 'strict',
    read: {},
    sendBack: { field: null, when: 'never', details: false },
    verified: true,
    sources: [],
    checked: CHECKED,
    notes:
      'Not a documented server rule: a conservative choice for servers that reject unknown message fields. Removes every reasoning field.',
  },
};

/** Resolve a profile name or object. Throws `UnknownProfileError` for an unknown name. */
export function resolveProfile(profile: ProfileName | ServerProfile): ServerProfile {
  if (typeof profile !== 'string') return profile;
  if (Object.prototype.hasOwnProperty.call(profiles, profile)) return profiles[profile];
  throw new UnknownProfileError(profile, Object.keys(profiles));
}
