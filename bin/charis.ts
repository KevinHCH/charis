#!/usr/bin/env bun
import { main } from '../src/index';

main(process.argv.slice(2)).catch(err => {
  console.error('[charis] error:', err?.message || err);
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
