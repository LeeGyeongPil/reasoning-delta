/** Thrown by `fromSSE` when a `data:` payload is not valid JSON, or the body is not SSE at all. */
export class SSEParseError extends Error {
  readonly line: string;
  constructor(line: string, cause?: unknown, noEvents = false) {
    const shown = line.length > 120 ? line.slice(0, 117) + '...' : line;
    super(
      (noEvents ? 'The body has no SSE data: events: ' : 'Could not parse SSE data as JSON: ') +
        shown +
        '. Check that the response is a Chat Completions stream (stream: true) and not an error page.',
      cause === undefined ? undefined : { cause },
    );
    this.name = 'SSEParseError';
    this.line = line;
  }
}

/** Thrown when a profile name is not in the registry. */
export class UnknownProfileError extends Error {
  readonly profile: string;
  constructor(profile: string, known: string[]) {
    super(
      'Unknown profile "' +
        profile +
        '". Known profiles: ' +
        known.join(', ') +
        '. Pass a custom profile object created with defineProfile() instead.',
    );
    this.name = 'UnknownProfileError';
    this.profile = profile;
  }
}

/** Thrown when the server sends an error object inside the stream. */
export class StreamError extends Error {
  readonly detail: unknown;
  constructor(detail: unknown) {
    super('The server sent an error inside the stream: ' + JSON.stringify(detail));
    this.name = 'StreamError';
    this.detail = detail;
  }
}
