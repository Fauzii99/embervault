# EMBERVAULT — catch the fire, spend it back

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Fauzii99/embervault/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Fauzii99/embervault/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A one-screen bullet-hell with no gun: you catch enemy fire inside a vault arc and throw it back as a homing ring. Ten waves, three enemy types, and the Warden at the end.

Entry for make.fun's **“Make the best game”** bounty: <https://make.fun/bounty/best-game-01>.

## The mechanic

You have no weapon. The only damage you deal is enemy fire that you caught first.

Hold the vault key and a 124° arc opens in front of you, 126 px out from the player, aimed at the mouse. Enemy shots that enter that arc are swallowed and become shards, one per shot, orbiting you. While the vault is open you move at 60% speed and you cannot fire: holding is a defensive stance that costs you mobility.

Release and the whole ring leaves at once, fanned across about 0.13 radians, at 900 px/s, 2 damage each. Every shard in the volley homes on the nearest enemy with a limited turn rate (9 rad/s), so a release aimed roughly right still lands, and a release aimed at empty floor curves back into the fight.

The ring holds at most 16 shards. A full ring refuses the next catch: the shot dies and the catch is wasted, so a full ring is a standing loss until you spend it. That is the trade-off the game is built on — catch long enough to make the release worth it, but not so long that the vault, and your speed, are tied up while the arena fills.

Scoring: 10 per absorbed shot, 150 per kill multiplied by a combo bonus (combo caps at 40, so up to ×3), 500 per wave cleared, 4000 for the Warden.

## Run it

Plain static files, no build step.

- Open `game/index.html` directly in a desktop browser.
- Or serve it: `node serve.ts --port 8080`, then open <http://localhost:8080>.

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` or arrow keys | fly |
| hold left mouse, `Space` or `J` | open the vault |
| release | fire the ring |
| `R` or `Enter` | restart |

The vault aims at the mouse pointer; the pointer position is read every simulation step.

## What is in the game

**Ten waves.** Waves 1 to 9 spawn a shuffled mix from the roster table, one body every 0.55 s. Wave 10 is the Warden alone.

**Three enemy types:**

- **Spitter** — hangs back near 330 px and fires a single aimed shot at you; keeps its distance so you have to come to it.
- **Orbiter** — circles you at a fixed 210–290 px radius and fires a three-shot spread, so the pressure comes from an angle that keeps moving.
- **Lancer** — no gun at all; it drifts, then dashes at 540 px/s once you are inside 380 px, so it threatens your body rather than your dodging lane.

**The boss: the Warden.** 320 HP, sweeping side to side across the top of the arena, firing a 16-bullet ring every 1.2 s. Killing it ends the run as a win.

**Lives.** Three. A hit costs one and grants 1.5 s of invulnerability. At zero the run ends with “THE VAULT BREAKS”.

**Best score.** The best score of the session stays on the HUD and the end card across restarts. It is held in memory only; there is no storage and no save file, so a page reload starts it at zero.

**Score target.** There is no fixed score line to beat in this build; the target is the Warden at wave 10, and killing it ends the run as a win. The score is the run's record of how you got there, and the values above are what it is made of.

## How the entry is built

`node main.ts` validates the entry, then writes the output directory — `/output` by default, or wherever `MAKEFUN_OUTPUT_DIR` points:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It copies `game/` and `screenshots/` into that directory and writes `dossier.json` there with `buildDossier` from `vendor/makefun-game.ts`, then prints the output path, the screenshot count and the dossier size. It refuses before writing anything if `game/` is missing, or if `screenshots/` does not hold 3 or 4 files.

## Source layout

| File | Job |
|---|---|
| `game/index.html` | The page: one 1280×720 canvas, the screen-reader status line, the module entry. |
| `game/src/config.js` | Every tunable number: arena, palette, vault geometry, player feel, volley ballistics, scoring, shard cap, wave count, spawn table. |
| `game/src/world.js` | The simulation and nothing else: player, vault, shards, enemies, bullets, waves, boss, scoring, events. No DOM. |
| `game/src/loop.js` | The 120 Hz fixed-step loop, the phase machine, input wiring, status line, canvas fitting. |
| `game/src/input.js` | Keyboard and pointer intent only: movement flags and vault press/release events. |
| `game/src/render.js` | Every pixel: background, vault arc, shard ring, enemies, HUD, title and end cards. Reads state, never writes it. |
| `game/src/audio.js` | Web Audio cues built from oscillators and one noise buffer, created on the first gesture. |
| `game/src/random.js` | Seeded xorshift32, so a run and a screenshot scene replay identically. |
| `game/src/shots.js` | Deterministic screenshot scenes: an autopilot plays the real rules from a seed, then the state is posed. |
| `game/src/main.js` | Browser entry: live loop, or one frozen scene when `?shot=` is present. |
| `main.ts` | The entrypoint: validate, copy `game/` and `screenshots/`, write `dossier.json`, report. |
| `vendor/makefun-game.ts` | make.fun's library, vendored unchanged: `buildDossier` and the game-tree and reference readers. |

## Licence

MIT — see `LICENSE`.

`vendor/makefun-game.ts` is vendored unchanged under make.fun's MIT licence (Copyright (c) 2026 make.fun).
