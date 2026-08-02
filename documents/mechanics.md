# HIP HOP PIRATES — Core Mechanics

**Status:** design draft v1 · **Scope:** systems only (story and world live in separate documents)

---

## 1. Premise

You are a pirate-radio DJ sailing the **Static Sea**, a chain of islands where music
is contraband and the airwaves are territory. You dig for lost records, sample the
world around you, and take over transmitter towers island by island — broadcasting
until the whole sea can hear you.

Every note you play is a flare in the dark. **THE HUSH**, a dreadnought that exists
to silence the sea, is listening for exactly that. The louder you get, the closer it
gets.

The pirate fantasy here isn't cutlasses and parrots. It's **pirate radio** — an
unlicensed signal, a crew, a boat, and a transmitter you're not supposed to have.

---

## 2. The three influences, and what we take from each

| From | What we take | What it becomes here |
| --- | --- | --- |
| **Minecraft** | Gather → craft → build, in a world that changes with the clock, where danger is a consequence of your own activity | Dig islands for buried wax, craft samples into tracks, upgrade your ship-studio. Night is when things get dangerous — because sound carries further over water at night. |
| **Pokémon** | Collect a huge roster, build a small team from it, turn-based duels, badge-gated progression | Collect **samples**, build a **kit** of records, duel other DJs, take towers to earn **Frequencies** |
| **Dueling DJs** | The actual combat verb | Battles are sets: two decks, a crossfader, and one crowd to win over |

The thing that makes it one game instead of three: **sound is the currency, the
weapon, and the danger, all at once.**

---

## 3. Core loop

```
       ┌─────────────────────────────────────────────┐
       │                                             │
  EXPLORE ──► COLLECT ──► CRAFT ──► BATTLE ──► CLAIM TOWER
  (sail,      (samples,   (loops,   (DJ sets)   (Frequency,
   dig)        wax)        tracks)               new region)
       │                                             │
       │            every step raises SIGNAL         │
       │                      ▼                      │
       └──────────  THE HUSH CLOSES IN  ◄────────────┘
                            │
                     GO QUIET / RUN / HIDE
```

You are always trading **progress** against **exposure**. Playing safe is slow.
Playing loud is fast and eventually gets you boarded.

---

## 4. Time — the 24-hour clock

A persistent world clock. It runs whenever the game is unpaused, including during
battles.

### 4.1 Rate

| Constant | Value | Note |
| --- | --- | --- |
| `GAME_MINUTES_PER_REAL_SECOND` | `1` | One real second = one game minute |
| Full day | **24 real minutes** | Tunable in one place; expect to slow this to 36–48 min once maps get bigger |

The clock persists in the save file. It does **not** reset on load — you come back
to the hour you left.

### 4.2 Phases

| Phase | Hours | Character |
| --- | --- | --- |
| **DAWN** | 05:00 – 08:59 | Safest window. The Hush resets its patrol. Markets restock. |
| **DAY** | 09:00 – 16:59 | Ordinary. Most NPCs available, smallest crowds, lowest payouts. |
| **DUSK** | 17:00 – 20:59 | Crowds build. Rare samples begin to appear. |
| **NIGHT** | 21:00 – 04:59 | Biggest crowds, best payouts, rarest samples — and **Signal gain is ×1.5** because sound carries over open water at night. |

### 4.3 What the clock actually drives

1. **Sample spawns.** Every sample has a time window. A church bell is a
   dawn sample; a foghorn is a night sample. Roughly 30% of the roster should be
   time-locked, so the collection can't be completed in one phase.
2. **Tides.** Two lows (≈03:00, ≈15:00) and two highs (≈09:00, ≈21:00), interpolated
   smoothly. **Low tide** opens sea caves, wrecks, and sandbars that let you walk
   between islands. **High tide** floods them — get caught inside a cave at rising
   tide and you're stuck until the next low. Tides are the single best
   exploration hook the clock gives us; use them heavily.
3. **NPC schedules.** Shops, crew members, and rival DJs keep hours. A vendor
   who only appears 02:00–04:00 is a better secret than a locked door.
4. **Crowd size.** Battle payouts and Heat gain scale with the hour.
5. **The Hush's patrol.** See below.

### 4.4 Time control

Players need *some* control or time-locked content becomes a chore:

- **Sleeping in your bunk** advances to the next phase boundary and lowers Signal.
- **A clock module** (mid-game ship upgrade) lets you skip to any phase for fuel.

Never let the player freeze time. The pressure is the point.

---

## 5. SIGNAL and THE HUSH

### 5.1 The idea

**THE HUSH** is an ironclad dreadnought under **Admiral Null**. It has no crowd to
win and no records to trade. It exists to triangulate unlicensed broadcasts and end
them. It is a real object in the world with a real position, not a scripted event.

It cannot be beaten in a fight for most of the game. It's weather with intent.

### 5.2 Signal (0–100)

A persistent world-level meter — how well The Hush has you located.

**Raises Signal**

| Action | Δ |
| --- | --- |
| Win a DJ battle | +8 |
| Broadcast from a tower | +15 |
| Each dig / mining action | +3 |
| Sailing under engine power | +1 per game-hour |
| *Night multiplier* | **×1.5 on all gains** |

**Lowers Signal**

| Action | Δ |
| --- | --- |
| Docked and idle | −1 per game-hour |
| Inside a cave / below deck | −3 per game-hour |
| Sailing under sail (slow, no engine) | −1 per game-hour |
| Sleeping to the next phase | −10 |
| Crossing a shallow at low tide | −15 (The Hush draws too much water to follow) |
| **Dawn reset** | Signal capped at 60 at 05:00 |

### 5.3 Thresholds

| Signal | State | What the player sees |
| --- | --- | --- |
| 0–24 | **QUIET** | Nothing. |
| 25–49 | **HEARD** | A horn on the horizon. Compass rose ticks toward The Hush. |
| 50–74 | **TRACKED** | The Hush appears on the world map and changes course toward your last known position. Music gets a low drone layer. |
| 75–99 | **HUNTED** | It enters your island's waters. Patrol skiffs spawn — these are ordinary DJ battles you *can* win, but each win adds Signal. |
| 100 | **BOARDED** | Forced encounter. See below. |

The key detail: The Hush tracks your **last known position**, not your live one. Going
quiet and moving is the counterplay. Standing still and going quiet is not enough.

### 5.4 Boarding

A special battle with an inverted win condition: you cannot take the crowd, you can
only **survive 8 turns** or **reach the gangway**. Losing costs you:

- Half your loose wax and materials
- A random third of your crate, dropped in a **spilled crate** at the boarding site

You respawn at your last docked port. The spilled crate persists in the world for
**one full game day** — go back and get it before the tide or a scavenger does. (This
is the Minecraft death-drop, and it should feel just as bad.)

Signal resets to 30 after a boarding. The Hush loses interest briefly. That's the
rhythm: pressure, release, pressure.

### 5.5 Late game

The Hush becomes beatable only after you hold enough Frequencies to broadcast on
every band at once — the final set is you versus the ship, with the entire sea as
your crowd.

---

## 6. DJ Battles

### 6.1 Frame

A battle is a **SET**. Two DJs, two decks, one crowd. Turn-based.

There are no hit points. There is **one shared CROWD METER**, a tug-of-war:

```
  OPPONENT ◄───────────────┼───────────────► YOU
  0                       50                      100
```

- Starts at 50 (or offset by venue/reputation).
- Your moves **pull** it right, theirs pull it left.
- **100 = you take the crowd (win). 0 = you get booed off (loss).**

One meter instead of two HP bars means every move matters twice — momentum swings
are the whole feel of a DJ duel.

### 6.2 The kit

You bring **8 records**. Each record has:

| Stat | Meaning |
| --- | --- |
| **Genre** | Type, for matchups (below) |
| **BPM** | Determines turn order; also tempo-matching |
| **Key** | For mixing bonuses/clashes |
| **Pull** | Base crowd movement (roughly 6–14) |
| **Grooves** | Times it can be played this set before it wears out (5–20) |

Grooves are the PP analog, and they're thematically perfect: a record physically
wears out. Rare records tend to have *fewer* Grooves, not more.

### 6.3 Genre triangle (the type chart)

Five genres in a cycle. Each beats the next at **×1.5**; playing into the cycle
backwards is **×0.66**.

```
  BOOM BAP ──► FUNK ──► DUB ──► TRAP ──► SHANTY ──► BOOM BAP
```

| Matchup | Why |
| --- | --- |
| Boom Bap chops **Funk** | It's literally built out of it |
| Funk outgrooves **Dub** | A live pocket beats studio space |
| Dub drowns **Trap** | Echo swallows the hi-hats |
| Trap outguns **Shanty** | 808s over accordions |
| Shanty rallies against **Boom Bap** | A crowd singing as one beats one voice |

### 6.4 Actions

Four things you can do on a turn:

| Action | Effect |
| --- | --- |
| **DROP** | Play a record from your kit. The main move. Pull × genre × Heat. |
| **CUT** | A fast scratch. **Always resolves first** regardless of BPM. Low pull (2–4), but cancels a charging move and can break the opponent's Heat. |
| **FLIP** | Sample the opponent's last record and turn it back on them, at 0.75 pull — but it counts as **your** genre, so it can flip a bad matchup. Costs 1 Heat. Also the setup for BITE. |
| **HYPE** | No pull. +1 Heat, restore some Grooves, or buff your next DROP. The "status move" slot. |

**Turn order:** CUT first, then higher BPM. Ties go to the defending DJ.

### 6.5 Heat and mixing

**Heat** (0–5) is the combo system, and it's musical rather than arbitrary.

- Play a record whose **BPM is within 12%** of the current tempo *and* whose **key is
  compatible** → **+1 Heat**.
- Play one that clashes → **TRAINWRECK**: half pull, your Heat resets to 0, opponent
  gains +1 Heat.

| Heat | Multiplier |
| --- | --- |
| 0 | ×1.00 |
| 1 | ×1.15 |
| 2 | ×1.30 |
| 3 | ×1.50 |
| 4 | ×1.75 |
| 5 | ×2.00 |

At **Heat 5** you may spend it all on **THE DROP** — your signature track. Once per
set, big pull, unmissable, and the crowd animation should be the best-looking thing
in the game.

The tension this creates: your strongest counter-genre record is often the wrong BPM.
Do you take the clean matchup and lose your combo, or stay in tempo and eat a bad
matchup? That's the decision the whole battle system exists to produce.

### 6.6 BITE — how you collect

The capture mechanic. Ball, meet crate.

- Available when the opponent's crowd share is **≤ 25** and you have **FLIPped** at
  least one of their records this set.
- Costs a **blank wax** from your inventory.
- Success chance scales with how low they are, their record's rarity, and your
  current Heat.
- On success you take a **copy** of that record into your crate. The opponent keeps
  theirs — you bit their style, you didn't steal the vinyl.

Biting is deliberately *slower* than just winning. Completing the collection should
mean choosing the harder path in a fight you'd already won.

### 6.7 Losing a set

You get booed off, lose the venue's payout, and take a small Signal *reduction*
(nobody's listening to you). Losing is cheap. Getting boarded is not. Keep those
consequences far apart so the player learns which one to actually fear.

---

## 7. Samples, wax, and the crate

Your collection has two tiers:

- **SAMPLES** — raw sound. Caught in the world with a **blank wax** during a quiet
  moment: a bell buoy, a gull, a market argument, thunder, a stranger humming. Every
  sample has a time window and a location type. These are the "wild encounters."
- **RECORDS** — playable in battle. Crafted from samples (below), bought, dug up, or
  BITten from another DJ.

**The crate** is your storage — deliberately limited early, upgradeable on the ship.
Deciding what to leave behind is part of the game.

Rarity tiers: **Common / Pressed / White Label / Master / One-Of-One**. One-Of-Ones
are unique world items; if you lose one in a boarding, it's genuinely gone unless you
recover the spilled crate.

---

## 8. Crafting and the ship (the Minecraft layer)

### 8.1 Materials

| Material | Source | Used for |
| --- | --- | --- |
| **Wax** | Digging, shops | Blank records for catching and crafting |
| **Brass** | Wrecks, sea caves | Horns, needles, mixer upgrades |
| **Salvage** | Shipwrecks, low-tide flats | Ship modules |
| **Tape** | Traders, tower vaults | Storing loops, save-scumming a mix |

### 8.2 Crafting chain

```
  SAMPLE ×2–4  ──►  LOOP  ──►  RECORD
                      +wax      +brass
```

A **loop** locks in a BPM and key. A **record** combines loops and inherits genre
from the dominant loop. This is where the player authors their own kit rather than
just finding it — the Minecraft half of the promise.

### 8.3 The ship

Your ship is your base and your studio. Modules, each occupying a slot:

| Module | Effect |
| --- | --- |
| **Second turntable** | Unlocks FLIP |
| **Bigger crate** | +storage |
| **Fog machine** | −Signal while sailing |
| **Sonar** | Shows The Hush's heading at Signal ≥ 25 |
| **Sail rig** | Slow travel with no Signal gain |
| **Clock module** | Skip to a chosen phase |
| **Transmitter** | Broadcast range — gates which islands you can reach |

Ship upgrades should mostly buy **safety and range**, not raw power. Power comes from
records; the ship is how you survive long enough to use them.

---

## 9. Crew and progression

- **Crew:** up to 4 DJs/MCs, each carrying their own 8-record kit. Party mechanics.
  Crew members have opinions about the hour, the genre you play, and whether you run
  from fights — light affinity system, not a full relationship sim.
- **Towers:** each island has a transmitter tower held by a resident DJ. Beat them to
  claim a **FREQUENCY** (badge analog).
- **Frequencies** gate: transmitter range (which islands you can sail to), max crowd
  size, and one new battle verb each (e.g. the 3rd Frequency unlocks HYPE variants).

Target for the full game: **9 Frequencies**, then The Hush.

---

## 10. How it all interlocks

Worth stating plainly, because this is the test any new mechanic has to pass:

1. **The clock** decides what you can collect and where you can walk (tides).
2. **Collecting and battling** is the only way to progress — and both raise **Signal**.
3. **Signal** summons **The Hush**, which takes your collection away.
4. Losing your collection sends you back to **collecting**, at a different hour.

Every system feeds the next one. If a proposed feature doesn't touch that ring,
it probably belongs in a different game.

---

## 11. Open questions

- **Rhythm input?** Should DROP involve a timing press for bonus Pull, or stay purely
  tactical? Timing adds feel but hurts accessibility and makes long sets tiring.
  *Leaning: optional timing press for a small bonus, off by default.*
- **Key compatibility** — full Camelot wheel, or a simplified 4-way group? *Leaning:
  simplified, with the wheel as an option for players who want it.*
- **Does the crowd meter drift** toward the centre each turn? Would prevent stalling
  but weakens comeback moments.
- **Multiple crowd meters** in crew battles (2v2), or one shared meter? Shared is
  cleaner and more chaotic.
- **How punishing is a boarding, really?** The one-third crate loss may be too harsh
  for a first playthrough. Consider scaling it to difficulty.
- **Persistent world time in multiplayer**, if we ever get there.

---

## 12. What the prototype already covers

The current build is a mechanical skeleton, not this game yet. Mapping:

| Prototype | Becomes |
| --- | --- |
| Grid overworld, collision, ledges | Island exploration; ledges become dock edges and rock shelves |
| Wild encounters in tall grass | Sample encounters, gated by phase and tide |
| Turn-based battle, two HP bars | Rewrite to one shared **Crowd Meter** |
| Type chart (grass/fire/rock) | The five-genre cycle |
| Move PP | **Grooves** |
| Party in the registry | Crew of 4 |
| — | **Clock, tides, Signal, The Hush, crafting, ship modules — all new** |

The two changes with the widest blast radius, and therefore the ones to do first:

1. **The world clock**, because tides, spawns, schedules, and Signal all hang off it.
2. **The crowd meter**, because it replaces the core of the battle scene rather than
   extending it.
