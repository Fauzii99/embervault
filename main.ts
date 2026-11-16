// EMBERVAULT's entrypoint: it hands the game in. The game itself is this directory's game/ folder
// (static files a desktop browser loads offline, game/index.html at its root) and screenshots/ holds
// its 3 or 4 PNG/JPEG renders. This program resolves every path from its own location, refuses a
// broken entry before it writes anything, then copies game/ and screenshots/ into the output
// directory and writes dossier.json there with the vendored make.fun library.
//
//   paths()          the repository root (this file's directory) and the output directory
//   validate()       game/ and screenshots/ must exist, screenshots/ holding 3 or 4 files
//   copyEntry()      game/ recursively, screenshots/ when it is there
//   writeDossier()   buildDossier writes dossier.json; its size comes back
//   main()           validate, copy, write, then report on stdout
//
// The output directory is MAKEFUN_OUTPUT_DIR, or /output under the grader.
// Serve the game locally with `node serve.ts`; write an entry with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// vendor/makefun-game.ts is make.fun's library, MIT-licensed (see LICENSE); it is used unmodified.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import type { DossierCaps } from './vendor/makefun-game.ts';

const GAME_DIR = 'game';
const SCREENSHOTS_DIR = 'screenshots';
const DOSSIER_FILE = 'dossier.json';

/** The grader's own caps: only text_max_bytes shapes the bytes, the rest refuse what the scorer refuses. */
const CAPS: DossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

interface Paths {
  /** This module's directory: the repository root, wherever the working directory is. */
  readonly root: string;
  /** Where the entry is handed in. */
  readonly out: string;
}

interface Entry {
  readonly game: string;
  readonly screenshots: string;
  readonly screenshotCount: number;
}

/** The repository root from the module's own URL, and the output directory from the environment. */
function paths(): Paths {
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    out: process.env.MAKEFUN_OUTPUT_DIR ?? '/output',
  };
}

/** The directory at `path`, refusing a missing one or a file in its place. */
function requireDir(path: string, label: string): string {
  if (!existsSync(path)) throw new Error(`${label}: missing beside main.ts`);
  if (!statSync(path).isDirectory()) throw new Error(`${label}: not a directory`);
  return path;
}

/** The entry's two directories checked, and how many screenshots it holds: nothing is written until this passes. */
function validate(root: string): Entry {
  const game = requireDir(join(root, GAME_DIR), `${GAME_DIR}/`);
  const screenshots = requireDir(join(root, SCREENSHOTS_DIR), `${SCREENSHOTS_DIR}/`);
  const screenshotCount = readdirSync(screenshots, { withFileTypes: true }).filter((e) => e.isFile()).length;
  if (screenshotCount < 3 || screenshotCount > 4) {
    throw new Error(`${SCREENSHOTS_DIR}/: ${screenshotCount} files, an entry has 3 or 4`);
  }
  return { game, screenshots, screenshotCount };
}

/** game/ copied recursively, screenshots/ created and filled when the entry has one. */
function copyEntry(entry: Entry, out: string): void {
  mkdirSync(out, { recursive: true });
  cpSync(entry.game, join(out, GAME_DIR), { recursive: true });
  mkdirSync(join(out, SCREENSHOTS_DIR), { recursive: true });
  if (existsSync(entry.screenshots)) cpSync(entry.screenshots, join(out, SCREENSHOTS_DIR), { recursive: true });
}

/** dossier.json written from the copied entry, its byte size returned. */
function writeDossier(out: string): number {
  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, DOSSIER_FILE), dossier);
  return dossier.byteLength;
}

function main(): void {
  const { root, out } = paths();
  const entry = validate(root);
  copyEntry(entry, out);
  const dossierBytes = writeDossier(out);
  console.log(`entry: ${out}`);
  console.log(`screenshots: ${entry.screenshotCount}`);
  console.log(`${DOSSIER_FILE}: ${dossierBytes} bytes`);
}

try {
  main();
} catch (err) {
  console.error(`main.ts: ${(err as Error).message}`);
  process.exitCode = 1;
}
