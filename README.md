# SKYLANE: Archipelago Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/DLiiMaGaming/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/DLiiMaGaming/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

SKYLANE: Archipelago Courier — fly the Kestrel-9 through eight sky rings across seven islands, then land at Kestrel Field. A static offline flight game: throttle, pitch and roll, a dense HUD (airspeed, altitude, heading, vertical speed, gear, fuel, throttle, compass, attitude), ring scoring, and a full landing sequence. Everything runs in the browser from local files; no network needed.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 — Arrow keys / Shift fly the plane, rings score +500 each, land on the strip at Kestrel Field to finish the courier run.

## How the entry is built

- `game/` — the game itself (plain HTML + vanilla JS, no dependencies)
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library
- `screenshots/` — four real gameplay shots (1280×800)
- `vendor/makefun-game.ts` — the vendored make.fun dossier builder from the competition kit

## Reproduce the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The program runs twice with byte-identical output.
