/** Where the reasoning of a stream was found. */
export type Dialect = 'reasoning_content' | 'reasoning' | 'think_tag' | 'legacy_both' | 'none';

export type Warning = 'stray-close-tag' | 'unclosed-tag' | 'alias-mismatch';

export type ProfileName =
  | 'deepseek'
  | 'vllm'
  | 'llamacpp'
  | 'llamacpp-legacy'
  | 'openrouter'
  | 'ollama'
  | 'think-tag'
  | 'strict';

export type TagMode = 'leading' | 'anywhere' | 'off';

/** Structural subset of an OpenAI-compatible streaming tool call delta. */
export interface ToolCallDeltaLike {
  index?: number;
  id?: string | null;
  type?: string;
  function?: { name?: string | null; arguments?: string | null } | null;
}

/** Structural subset of `chat.completion.chunk` `delta` (extra fields are tolerated). */
export interface DeltaLike {
  role?: string | null;
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
  reasoning_details?: unknown[] | null;
  tool_calls?: ToolCallDeltaLike[] | null;
  [key: string]: unknown;
}

/** Structural subset of a `chat.completion.chunk` object (the openai SDK type fits). */
export interface ChunkLike {
  choices?: Array<{
    index?: number;
    delta?: DeltaLike | null;
    finish_reason?: string | null;
  }> | null;
  usage?: unknown;
  error?: unknown;
  [key: string]: unknown;
}

export type ReasoningEvent =
  | { type: 'reasoning'; text: string; source: 'field' | 'tag' }
  | { type: 'text'; text: string }
  | { type: 'tool_call_delta'; index: number; id?: string; name?: string; arguments?: string }
  | { type: 'reasoning_details'; details: unknown[] }
  | {
      type: 'done';
      dialect: Dialect;
      finishReason: string | null;
      warnings: Warning[];
      usage?: unknown;
    };

export interface NormalizeOptions {
  /** A profile name, a custom profile, or `'auto'` (default) to rely on detection only. */
  profile?: ProfileName | ServerProfile | 'auto';
  /** Tag names that wrap reasoning inside `content`. Default `['think', 'reasoning', 'thought']`. */
  tags?: string[];
  /**
   * `'leading'` (default): a tag is only recognised before the first visible answer character.
   * `'anywhere'`: recognised at any point. `'off'`: tags are plain text.
   */
  tagMode?: TagMode;
  /** The opening tag is missing from the stream (some chat templates add it to the prompt). */
  startInReasoning?: boolean;
  /** Which choice to follow. Default 0. */
  choiceIndex?: number;
}

export interface ToolCallTurn {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

export interface AssistantTurn {
  content: string;
  reasoning: string;
  reasoningDetails?: unknown[];
  toolCalls: ToolCallTurn[];
  finishReason: string | null;
  dialect: Dialect;
  warnings: Warning[];
  usage?: unknown;
}

/** Read hints applied by a profile (explicit options win). */
export interface ProfileRead {
  tags?: string[];
  tagMode?: TagMode;
  startInReasoning?: boolean;
}

/** How reasoning is written back into the next request's assistant messages. */
export interface SendBackRule {
  /** Field to write plain reasoning into, or `null` to remove it. */
  field: 'reasoning_content' | 'reasoning' | null;
  /** `with-tools`: only when the history contains tool calls. */
  when: 'always' | 'with-tools' | 'never';
  /** Keep `reasoning_details` unchanged. */
  details: boolean;
}

export interface ServerProfile {
  name: string;
  read: ProfileRead;
  sendBack: SendBackRule;
  /** `false` when the send-back rule is a conservative default, not confirmed by the server docs. */
  verified: boolean;
  sources: string[];
  /** Date (YYYY-MM-DD) the rule was checked against the sources. */
  checked: string;
  notes?: string;
}

/** Structural subset of a chat message. Unknown fields are kept as they are. */
export interface MessageLike {
  role: string;
  content?: unknown;
  tool_calls?: unknown;
  reasoning_content?: string | null;
  reasoning?: string | null;
  reasoning_details?: unknown[] | null;
  reasoningDetails?: unknown[] | null;
  [key: string]: unknown;
}

export type SegmentKind = 'reasoning' | 'text';

export interface Segment {
  kind: SegmentKind;
  text: string;
}
