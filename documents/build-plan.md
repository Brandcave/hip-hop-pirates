# HIP HOP PIRATES — Build Plan

**Companion to:** [`mechanics.md`](./mechanics.md) · **Status:** plan v1

---

## How we're going to work

**Every milestone ends with something you can play.** Not a system that exists, not a
test that passes — a thing you can sit down with for two minutes that you couldn't do
the week before. If a milestone can't be described as "now you can ___", it's split
wrong.

Four rules that keep that true:

1. **Vertical, not horizontal.** Build one system end-to-end (data → logic → UI →
   feel) before starting the next. A half-finished clock plus a half-finished crafting
   system is worth less than a finished clock.
2. **`main` is always playable.** Half-built systems sit behind a flag in
   `src/data/flags.ts` and default to off.
3. **Content lives in data, not code.** New samples, records, maps, and NPCs should be
   new entries in `src/data/`, never new branches in a scene.
4. **Cut scope, not quality.** Fewer islands is fine. A battle that doesn't feel good
   is not.

---

## Milestones at a glance

| # | Milestone | Now you can... | Size |
| --- | --- | --- | --- |
| **0** | *Prototype (done)* | Walk an island, trigger encounters, fight a turn-based battle | — |
| **1** | The Clock | Watch the island move from dawn to night while you walk | S |
| **2** | Save & Continue | Close the tab and come back to the same hour, same spot | S |
| **3** | The Set | Win a DJ battle by taking the crowd, not by dealing damage | M |
| **4** | Sound | Actually hear the records you're playing, locked to the beat | M–L |
| **5** | Genres & Heat | Face the real decision: clean matchup, or keep the mix in tempo | M |
| **6** | Samples & the Crate | Build a kit out of sounds you found in the world | M |
| **7** | Signal & The Hush | Get hunted. Go quiet. Lose your crate and go get it back | M |
| **8** | Tides & Digging | Walk to another island at low tide and dig up buried wax | M |
| **9** | Crafting & the Ship | Make your own records and upgrade the boat | M |
| **10** | Sailing | Leave the first island | L |
| **11** | Towers & Crew | Take a tower, earn a Frequency, sail with a crew | L |
| **12** | Save v2 *(conditional)* | Multiple slots, bigger saves, maybe an account | M |

Sizes are relative, not calendar. S ≈ a sitting, M ≈ a few, L ≈ a chunk of work with
its own sub-plan.

---

## M0 — Where we are today

Shipped in the prototype:

- 4-colour Game Boy palette, integer pixel scaling, canvas fills the window
- Grid-locked overworld: collision, turn-in-place, ledge hops, camera follow
- Signs, NPCs, typewriter dialogue with paging, promise-based menus
- Tall-grass encounters with the flash transition
- Turn-based battle: type chart, HP bars, faint animation, FIGHT/RUN
- Map validation at boot; all art generated from source

This is a working skeleton of *a* Game Boy RPG. Milestones 1–7 turn it into *this*
game.

---

## M1 — The Clock

**Now you can:** walk around and watch the island go from dawn through day into
night, with the light actually changing.

The clock is first because tides, spawn tables, NPC schedules, crowd sizes, and Signal
all hang off it. Everything later is cheaper once it exists.

**Build**
- `src/engine/clock.ts` — a `GameClock` that advances with delta time, exposes
  `{ minutes, hour, phase, tideLevel }`, and lives in the Phaser registry
- Phase constants and the tuning knob (`GAME_MINUTES_PER_REAL_SECOND = 1`)
- A small always-on clock readout in the corner of the overworld
- **Phase palettes** — swap the 4-colour palette per phase (warm dawn, neutral day,
  amber dusk, cool night). We already regenerate all textures on palette change, so
  this is nearly free and it's the single biggest visual payoff available.
- `SLEEP` in the menu: advance to the next phase boundary

**Not yet:** tides affecting terrain, time-gated spawns, NPC schedules.

**Done when:** a full 24-minute day cycles smoothly, the palette shifts at each phase
boundary without a visible hitch, and sleeping works.

---

## M2 — Save & Continue

**Now you can:** close the tab mid-game and pick up exactly where you left off.

Deliberately early. It's cheap now, it gets expensive later, and it makes every
subsequent milestone testable without replaying from the start.

**Build**
- `src/save/schema.ts` — one `SaveState` type with a `version: number` field
- `src/save/storage.ts` — `save()` / `load()` / `clear()` against `localStorage`
- A migration chain: `migrations[from](state) → state`. One entry per schema bump,
  forever. This is the part that matters.
- Autosave on: entering a building, sleeping, finishing a battle. Plus manual SAVE.
- A title screen: **NEW GAME / CONTINUE**

**Design note that saves us later:** the authoritative game state stays in memory.
Storage is a *serialization* concern, not an architecture concern — we snapshot to it,
we never query it during play. That's what makes swapping localStorage for IndexedDB
or a server a contained change instead of a rewrite. See §Persistence.

**Done when:** clock, position, map, and party survive a reload, and a deliberately
bumped schema version migrates an old save instead of discarding it.

---

## M3 — The Set

**Now you can:** win a DJ battle by pulling one shared crowd meter to 100.

The first milestone where it stops being a Pokémon clone.

**Build**
- Replace two HP bars with one **Crowd Meter** (0–100, starts at 50, tug-of-war)
- Replace `Monster` with `Record` — genre, BPM, key, pull, grooves
- Actions: **DROP**, **CUT** (always first), **HYPE**. FLIP waits for M5.
- **Grooves** replace PP; a record wears out
- Reskin the battle scene: two decks and a crossfader instead of two creatures
- Rename the game, retitle the build

**Not yet:** genre matchups, Heat, BITE, sound.

**Done when:** a set is winnable and losable, momentum visibly swings, and CUT is a
real tactical choice rather than a worse DROP.

---

## M4 — Sound

**Now you can:** hear it. Records play, layer, and stay locked to the beat.

This is the **highest-risk milestone in the project** and the one most likely to
change the design, which is why it comes before we build systems on top of it. A
music game whose music is an afterthought is a dead game.

Do a **timeboxed spike first**: can we schedule two loops from Web Audio, keep them
phase-locked over minutes, crossfade between them, and stay in sync with Phaser's
frame loop? Answer that before committing to the full milestone.

**Build**
- `src/audio/` — a Web Audio transport with a bar/beat clock, independent of Phaser's
  frame timing (never schedule audio off `requestAnimationFrame`)
- Loop playback with sample-accurate scheduling; crossfade between decks
- Records reference audio assets; BPM in data must match BPM in the file
- Battle actions land **on the next bar**, not instantly — this changes battle pacing
  and we need to feel it early
- A mute/duck path so the game is still playable silently

**Open risk:** if bar-locked actions make battles feel sluggish, we resolve actions
immediately and treat audio as a layer over the top. Decide this with hands on it.

**Done when:** playing three records in a row sounds like a mix rather than three
sounds, and it stays in time for five minutes straight.

---

## M5 — Genres & Heat

**Now you can:** face the decision the whole battle system exists to produce — take
the clean genre matchup, or keep the mix in tempo.

**Build**
- Five-genre cycle: Boom Bap → Funk → Dub → Trap → Shanty → Boom Bap (×1.5 / ×0.66)
- **Heat** 0–5 from BPM-within-12% and compatible key; **Trainwreck** on a clash
- **FLIP** (needs the second-turntable unlock)
- **THE DROP** finisher at Heat 5, with the best animation in the game
- Battle HUD: current tempo, current key, Heat pips

**Done when:** two players with the same kit can play noticeably differently, and a
trainwreck feels like a mistake you made rather than dice.

---

## M6 — Samples & the Crate

**Now you can:** catch sounds in the world and build your kit out of them.

**Build**
- Sample encounters replace tall-grass encounters: ambient sound sources placed in the
  world, each with a **time window** (first real payoff from M1)
- Catching with **blank wax** during a quiet moment
- **Crate** storage UI with limited capacity; kit selection (8 records)
- **BITE** in battle: FLIP their record, get them below 25, spend a wax
- Rarity tiers; ~30 samples to start

**Done when:** you can complete a run of the first island's daytime samples, and the
night list is visibly incomplete so you come back.

---

## M7 — Signal & The Hush

**Now you can:** get hunted, and lose something real.

**Build**
- **Signal** meter (0–100) with the gain/decay table from `mechanics.md`
- Threshold states: HEARD → TRACKED → HUNTED → BOARDED, with audio and UI tells
- The Hush as an actual entity with a position and a heading, moving on the clock,
  homing on your *last known* position
- Patrol skiff battles
- **Boarding**: survive-8-turns encounter, crate loss, **spilled crate** persisting in
  the world for one game day
- Respawn at last docked port

**Done when:** a player who ignores the horn loses records, goes and gets them back,
and changes how they play afterwards.

---

## M8 — Tides & Digging

**Now you can:** cross a sandbar at low tide and dig up something buried.

**Build**
- Tide curve driven by the clock; tiles that change passability with tide level
- Sea caves and a getting-stuck-at-high-tide consequence
- Tile digging with a tool, producing **wax / brass / salvage / tape**
- Digging raises Signal (+3), tying the Minecraft layer into the danger loop

**Done when:** there's a location reachable only in a specific tide-and-phase window,
and it's worth the trip.

---

## M9 — Crafting & the Ship

**Now you can:** make records instead of only finding them, and upgrade the boat.

**Build**
- `samples ×2–4 → loop → record` crafting, with the loop locking BPM and key
- Workbench UI below deck
- Ship modules: second turntable (unlocks FLIP), bigger crate, fog machine, sonar,
  sail rig, clock module, transmitter

**Done when:** a player-crafted record can beat a found record of the same rarity, and
the module choices are genuinely contested by slot pressure.

---

## M10 — Sailing

**Now you can:** leave the first island.

The first genuinely large milestone; it gets its own sub-plan when we reach it.

**Build**
- World map / sea navigation, ship as an overworld entity
- Multiple island maps, warps, per-island spawn and encounter tables
- Transmitter range gating which islands are reachable
- Sailing under sail vs. engine (the Signal tradeoff becomes a travel decision)

**Done when:** three islands feel like different places, not reskins.

---

## M11 — Towers, Frequencies & Crew

**Now you can:** take a tower, earn a Frequency, and sail with a crew of four.

**Build**
- Tower DJs as designed boss fights with authored kits
- **Frequencies** gating range, crowd size, and one new battle verb each
- Crew: up to 4 DJs, each with their own kit; switching mid-set
- Light affinity: crew react to the hour, your genre, and whether you run

**Done when:** the first three Frequencies each change how battles are played, not
just the numbers.

---

## Persistence — the honest recommendation

You floated Docker or SQLite. My recommendation: **not yet, and probably not for a
long time.** Here's the reasoning and the trigger conditions.

### Phase 1 — `localStorage` (M2, now)

A single versioned JSON blob. ~5 MB limit, synchronous, zero setup. A save containing
the clock, position, flags, party, crate, and Signal is a few kilobytes — we are three
orders of magnitude from the ceiling.

### Phase 2 — IndexedDB (when Phase 1 pinches)

Move when *any* of these become true:

- Save exceeds ~1 MB (a large crate, per-tile world edits from digging)
- We want multiple save slots
- We want to cache audio buffers or generated textures alongside the save

Use the `idb` wrapper. Because §M2 kept storage behind `save()`/`load()`, this is a
contained change — the same `SaveState`, a different backend.

### Phase 3 — a server with SQLite (only if triggered)

A server buys exactly one thing: **state that doesn't live on the player's machine.**
Add it only when you actually need that. Triggers:

- Accounts / cross-device saves ("play on my laptop and my desktop")
- Leaderboards, shared charts, or any global "who's on top of the airwaves"
- Multiplayer DJ battles
- Saves must survive a browser cache clear
- Cheating starts to matter

When one of those lands: **Node + SQLite** (`better-sqlite3` locally; libSQL/Turso if
hosted) is the right pick — a single file, no daemon, no schema ceremony, trivially
backed up. Postgres is over-provisioned until we have concurrent writers.

**Docker is not part of the answer to "how do I save."** SQLite is a file; it needs no
container. Reach for Docker when there's a *service* worth reproducing across machines
— and even then, only once there's more than one machine.

### The rule that makes all of this cheap

Whatever the backend:

- **Game state is authoritative in memory.** We never query storage during play.
- **One `SaveState` type, one `version` field, one migration chain**, from M2 onward.
- Anything a player earns is in `SaveState` from the day it exists — never bolted on.

Get those three right in M2 and every later persistence decision is a swap, not a
rewrite.

---

## Cross-cutting tracks

Things that don't get their own milestone but need attention throughout:

| Track | When | Note |
| --- | --- | --- |
| **Art replacement** | Rolling | Tiles → Tiled maps → characters, per `README.md`. Do it per-milestone, not as a big-bang art pass. |
| **Content authoring** | From M6 | Once samples and records are data, adding content shouldn't need an engineer. Consider a JSON schema + a validation script. |
| **Performance** | From M10 | `buildMapTexture()` bakes whole maps; it needs to become a real tilemap before the world gets big. |
| **Input** | From M3 | Gamepad and touch both route through `engine/input.ts` only. |
| **Bundle size** | Before launch | Phaser is ~330 kB gzipped; a custom build roughly halves it. |

---

## What we are explicitly not building yet

Naming these keeps them from creeping in:

- Multiplayer of any kind
- Procedurally generated islands (hand-authored until we know what a good island is)
- A story/quest scripting engine (dialogue trees are enough through M11)
- Achievements, cosmetics, meta-progression
- Mobile-specific UI (input abstraction now, layout later)

---

## Definition of shippable

A milestone is done when all of these are true:

- [ ] You can play the new thing from a fresh boot without dev-console help
- [ ] It survives a save/load round trip
- [ ] It works at a small window and a large one
- [ ] Nothing earlier regressed (walk the island, win a set, load a save)
- [ ] New content is data, not code
- [ ] `mechanics.md` matches what actually got built — including where we changed our
      minds

That last one matters most. The design document is only useful if it's true.
