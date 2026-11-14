#!/usr/bin/env node
import { main } from './cli/main.js';

const code = await main(process.argv.slice(2), process.env, {
  out: (line) => process.stdout.write(line + '\n'),
  err: (line) => process.stderr.write(line + '\n'),
});
process.exitCode = code;
