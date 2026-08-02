# SPRITE

A Game Boy-style top-down RPG in the browser. Renders in full colour with
DMG-sized pixels, filling the whole window: one game pixel is blown up by a
whole-number factor taken from the window height, and the framebuffer is made as
many game pixels wide and tall as fit. A wide window therefore shows more world
rather than a stretched or letterboxed 160×144 image.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
```

**Controls** — Arrows/WASD move · `Z` confirm · `X` cancel · `M` menu · `F` fullscreen

## What's in the proof of concept

- Grid-locked overworld movement with turn-in-place, tile collision, and ledges
  you can hop down but not climb back up
- A camera that follows the player and clamps to the map edges
- Signs, NPCs that turn to face you, and a typewriter dialogue box with paging
- Wild encounters in tall grass, with the stuttering flash transition
- Turn-based battles: speed-ordered turns, a type chart, damage variance, HP bar
  drain, faint animations, and a FIGHT/RUN menu
- Full-colour theme plus four hardware-style monochrome ones — DMG green,
  Pocket grey, SGB, Ice (menu → COLOR), persisted to localStorage

## Stack, and why

| Choice | Reason |
| --- | --- |
| **Phaser 3** | The most complete 2D web game framework: scene stack, tweens, tilemaps, audio, input, asset pipeline. Everything a full RPG eventually needs, already solved. |
| **TypeScript** | An RPG becomes a large pile of data (species, moves, maps, scripts). Types are what keep that data honest as it grows. |
| **Vite** | Instant dev server, trivial static build. Deploy `dist/` anywhere. |
| **Canvas-generated art** | No binary assets yet, so themes can be swapped at runtime and every sprite is diffable in git. Designed to be replaced (see below). |

Deliberately *not* used: a physics engine (grid movement needs none), React (the
game owns the canvas), or a bundled asset pipeline (not yet needed).

## Architecture

```
src/
  engine/       constants (resolution, timings), input latching
  gfx/          themes/colour, pixel-art helpers, bitmap font, tiles, actors,
                creatures, and the single asset-building entry point
  data/         maps, species, moves — pure data, no rendering
  ui/           CanvasLayer (immediate-mode HUD surface), Dialog
  scenes/       Boot (build assets) → World (overworld) → Battle
```

Three ideas hold it together:

**All textures come from one function.** `gfx/assets.ts` builds every texture for
the active theme. That's why theme swapping is just "regenerate and restart",
and it's the single seam you replace when real artwork arrives.

**Data is separate from rendering.** `data/maps.ts` describes a map as characters
plus a legend; `data/species.ts` and `data/moves.ts` are plain tables. Adding a
creature is one object. `validateMap()` runs at boot and refuses to load a map
with a ragged row, a ledge with nowhere to land, or a sign on a walkable tile.

**Game flow is written as async functions.** Dialogue and menus return promises,
so a battle turn reads top-to-bottom instead of being scattered across a state
machine:

```ts
await dialog.say(`WILD ${enemy.name} APPEARED!`);
const action = await dialog.choose(['FIGHT', 'RUN'], false, 'WHAT WILL ... DO?');
```

**Input is latched, not sampled.** Key presses are recorded from `keydown` events
and consumed on the next frame, so a tap that starts and ends between two frames
still registers. Polling `key.isDown` alone silently drops fast taps.

## Replacing the placeholder art

Everything visual is generated from source, which is right for a prototype and
wrong for a real game. The swap points, in order of payoff:

1. **Tiles** — draw a tileset PNG, load it as a spritesheet, and point
   `TILES[ch].key` at frame indices. `gfx/tiles.ts` art strings go away; the
   `solid` / `encounter` / `ledge` flags stay exactly as they are.
2. **Maps** — build them in [Tiled](https://www.mapeditor.org/), export JSON, and
   switch `buildMapTexture()` for a real Phaser tilemap. That also gets you
   offscreen culling and multiple layers (so the player can walk behind things).
3. **Characters and creatures** — author in Aseprite, export spritesheets, and
   replace `buildActorTextures()` / the creature builders. Animation keys don't
   change.
4. **Font** — the 5×7 bitmap font in `gfx/font.ts` can stay; it's already the
   right shape. Widen glyphs there if you want a different typeface.

## Roadmap to a real game

Roughly in dependency order:

- **Map warps and multiple maps** — the plumbing exists (`registry.mapId`,
  per-map spawns); doors need to become warp objects.
- **Save/load** — serialise `registry` (party, position, flags) to localStorage.
  Everything mutable already lives there.
- **Party and inventory** — the battle already reads `party[0]`; add switching,
  items, and catching.
- **Progression** — EXP, levelling, evolution, move learning.
- **Trainers and scripted events** — an event/flag system, line-of-sight triggers,
  cutscene scripting (the async dialogue helpers extend naturally to this).
- **Audio** — chiptune music and SFX via Phaser's sound manager. This is the
  single biggest jump in "feels like a real game" per hour spent.
- **Touch controls** — a virtual D-pad; only `engine/input.ts` changes.
- **Bundle size** — Phaser is ~330 kB gzipped. A custom Phaser build dropping
  unused systems roughly halves it.

## Notes

- The game pauses when the tab is hidden; that's Phaser's default and matches
  handheld behaviour.
- `window.game` is exposed in dev builds for poking at scenes from the console.
