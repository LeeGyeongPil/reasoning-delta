import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fixtureText } from './fixtures.js';

export interface MockServer {
  /** Base URL for fixture `name`: `${baseUrl(name)}/chat/completions` streams that fixture. */
  baseUrl(name: string): string;
  close(): Promise<void>;
}

/** 127.0.0.1 SSE server that replays a fixture a few bytes at a time. */
export async function startMockServer(bytesPerWrite: number): Promise<MockServer> {
  const server: Server = createServer((req, res) => {
    const match = /^\/([\w-]+)\/v1\/chat\/completions$/.exec(req.url ?? '');
    req.resume();
    if (req.method !== 'POST' || match === null) {
      res.writeHead(404).end();
      return;
    }
    let data: Buffer;
    try {
      data = Buffer.from(fixtureText(match[1]!), 'utf8');
    } catch {
      res.writeHead(404).end();
      return;
    }
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      let pos = 0;
      const next = (): void => {
        if (pos >= data.length) {
          res.end();
          return;
        }
        const ok = res.write(data.subarray(pos, pos + bytesPerWrite));
        pos += bytesPerWrite;
        if (ok) setImmediate(next);
        else res.once('drain', next);
      };
      next();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: (name) => 'http://127.0.0.1:' + port + '/' + name + '/v1',
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
