/**
 * Production bundle for VSIX: two Node CJS entrypoints, vscode host API external.
 * Run after `npm ci`; used by vscode:prepublish (vsce package).
 */
import * as esbuild from 'esbuild';
import { rmSync } from 'node:fs';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  legalComments: 'none',
};

rmSync('dist', { recursive: true, force: true });

await esbuild.build({
  ...common,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  external: ['vscode'],
});

await esbuild.build({
  ...common,
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
});
