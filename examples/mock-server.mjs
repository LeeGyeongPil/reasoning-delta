// Tiny local SSE server used by the examples. It replays a bundled practice-mock fixture
// (synthesized from documented formats, not a recording of a real server) a few bytes at a time,
// so tags and multi-byte characters really do get cut between network chunks.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const fixtureDir = new URL('../fixtures/', import.meta.url);

/** Start the server on 127.0.0.1 (random port). Returns `{ baseUrl, close }`. */
export async function startMock(fixture, bytesPerWrite = 3) {
  const data = readFileSync(new URL(fixture + '.sse', fixtureDir));
  const server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      let pos = 0;
      const next = () => {
        if (pos >= data.length) return res.end();
        res.write(data.subarray(pos, pos + bytesPerWrite));
        pos += bytesPerWrite;
        setTimeout(next, 5);
      };
      next();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

/** Print events: reasoning dimmed, answer plain. */
export function printEvent(ev) {
  if (ev.type === 'reasoning') process.stdout.write(`\x1b[2m${ev.text}\x1b[0m`);
  else if (ev.type === 'text') process.stdout.write(ev.text);
  else if (ev.type === 'done') {
    process.stdout.write(`\n[done: dialect=${ev.dialect} finish=${ev.finishReason} warnings=${ev.warnings.join(',') || 'none'}]\n`);
  }
}
