#!/usr/bin/env python3
"""
Build the actor spritesheets from the Universal LPC Spritesheet Character
Generator, and the attribution file its licences require.

The LPC repo is ~1.5 GB, so we never clone it whole. Fetch only the layers this
script names:

    git clone --filter=blob:none --no-checkout --depth 1 \
      https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator.git lpc
    cd lpc
    git sparse-checkout set sheet_definitions palette_definitions \
      spritesheets/body/bodies/male \
      spritesheets/head/heads/human/male \
      spritesheets/beards/beard/basic \
      spritesheets/hat/pirate/tricorne/captain/adult \
      spritesheets/hat/pirate/tricorne/captain/skull/adult \
      spritesheets/hat/pirate/bandana/adult \
      spritesheets/facial/patches/eyepatch/right/adult \
      spritesheets/torso/clothes/longsleeve/longsleeve2_buttoned/male \
      spritesheets/torso/clothes/vest_open/male \
      spritesheets/legs/pantaloons/male \
      spritesheets/feet/boots/fold/male
    git checkout

Then:  python3 tools/build-actors.py <path-to-lpc-checkout>

Output is a 576x256 sheet per actor: 9 frames across, and four rows in LPC's
order — up, left, down, right. Frame 0 of each row is the standing pose; 1..8
are the walk cycle.
"""

from PIL import Image
from pathlib import Path
import json
import sys

# LPC's universal frame size, and the walk sheet's shape.
FRAME = 64
COLS = 9
ROWS = 4
SHEET = (FRAME * COLS, FRAME * ROWS)

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "art"
CREDITS_OUT = Path(__file__).resolve().parent.parent / "ART-CREDITS.md"


def hex_to_rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


def recolor(im, ramp_from, ramp_to):
    """
    LPC ships one base rendering per garment, drawn in a designated ramp, and
    recolours it by substituting that ramp for another index-by-index. Doing the
    same here is what lets us dress the cast from a handful of source PNGs.
    """
    lut = {
        hex_to_rgb(a): hex_to_rgb(b) for a, b in zip(ramp_from, ramp_to)
    }
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in lut:
                px[x, y] = lut[(r, g, b)] + (a,)
    return im


def detect_ramp(im, ramps, path):
    """
    Which ramp a base sheet was drawn in varies by asset — the garments here use
    `white`, but the bandana ships in `black`. Guessing wrong silently produces a
    layer that ignores its recolour, so read it off the pixels instead.
    """
    present = {px[:3] for px in im.get_flattened_data() if px[3] > 0}
    scored = sorted(
        ((sum(hex_to_rgb(c) in present for c in ramp), name)
         for name, ramp in ramps.items()),
        reverse=True,
    )
    hits, name = scored[0]
    if hits < 2:
        sys.exit(f"cannot identify the source ramp for {path}")
    return name


class Builder:
    def __init__(self, root: Path):
        self.root = root
        self.sheets = root / "spritesheets"
        pd = root / "palette_definitions"
        self.cloth = json.load(open(pd / "cloth" / "cloth_ulpc.json"))
        self.hair = json.load(open(pd / "hair" / "hair_ulpc.json"))
        self.used = []

    def layer(self, path, palette=None, dst=None):
        p = self.sheets / path
        if not p.exists():
            sys.exit(f"missing layer {p}\n(did the sparse-checkout include it?)")
        im = Image.open(p).convert("RGBA")
        if im.size != SHEET:
            sys.exit(f"{p} is {im.size}, expected {SHEET}")
        self.used.append(path)
        if palette is None:
            return im
        ramps = self.cloth if palette == "cloth" else self.hair
        return recolor(im, ramps[detect_ramp(im, ramps, path)], ramps[dst])

    def compose(self, name, layers):
        out = Image.new("RGBA", SHEET, (0, 0, 0, 0))
        for _, im in sorted(layers, key=lambda t: t[0]):
            out.alpha_composite(im)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        dest = OUT_DIR / f"{name}.png"
        out.save(dest)
        print(f"wrote {dest.relative_to(OUT_DIR.parent.parent)}  {out.size[0]}x{out.size[1]}")
        return out


def build(root: Path):
    b = Builder(root)

    # The captain: black skull tricorne, eyepatch, maroon vest over a white
    # shirt, navy pantaloons, leather boots.
    b.compose(
        "player",
        [
            (10, b.layer("body/bodies/male/walk.png")),
            (20, b.layer("legs/pantaloons/male/walk.png", "cloth", "navy")),
            (25, b.layer("feet/boots/fold/male/walk.png", "cloth", "leather")),
            (35, b.layer("torso/clothes/longsleeve/longsleeve2_buttoned/male/walk.png")),
            (45, b.layer("torso/clothes/vest_open/male/walk/maroon.png")),
            (100, b.layer("head/heads/human/male/walk.png")),
            (110, b.layer("beards/beard/basic/walk.png", "hair", "dark_brown")),
            (115, b.layer("facial/patches/eyepatch/right/adult/walk/black.png")),
            (130, b.layer("hat/pirate/tricorne/captain/adult/walk/black.png")),
            (131, b.layer("hat/pirate/tricorne/captain/skull/adult/walk/black.png")),
        ],
    )

    # A crewmate, distinguishable at a glance: red bandana instead of the hat,
    # no eyepatch, forest vest, charcoal legs.
    b.compose(
        "npc",
        [
            (10, b.layer("body/bodies/male/walk.png")),
            (20, b.layer("legs/pantaloons/male/walk.png", "cloth", "charcoal")),
            (25, b.layer("feet/boots/fold/male/walk.png", "cloth", "brown")),
            (35, b.layer("torso/clothes/longsleeve/longsleeve2_buttoned/male/walk.png")),
            (45, b.layer("torso/clothes/vest_open/male/walk/forest.png")),
            (100, b.layer("head/heads/human/male/walk.png")),
            (120, b.layer("hat/pirate/bandana/adult/walk.png", "cloth", "red")),
        ],
    )

    write_credits(root, b.used)


def write_credits(root: Path, used):
    """
    CC-BY-SA 3.0 and OGA-BY 3.0 both require attribution, so the credits are
    generated from the same definitions the art came from rather than written by
    hand — that way they cannot drift from what is actually in the sheets.
    """
    defs = list((root / "sheet_definitions").rglob("*.json"))
    entries = {}
    for d in defs:
        try:
            data = json.load(open(d))
        except json.JSONDecodeError:
            continue
        paths = [
            v.get("male", "")
            for k, v in data.items()
            if k.startswith("layer_") and isinstance(v, dict)
        ]
        if not any(u.startswith(p) for p in paths if p for u in used):
            continue
        for c in data.get("credits", []):
            entries[(data["name"], c["file"])] = c

    lines = [
        "# Art credits",
        "",
        "Character art is assembled from the [Universal LPC Spritesheet Character",
        "Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)",
        "by `tools/build-actors.py`.",
        "",
        "**These assets are licensed CC-BY-SA 3.0 / GPL 3.0 / OGA-BY 3.0.** The",
        "share-alike terms carry over: derivative character art in this project must be",
        "distributed under the same terms, with the credits below kept intact.",
        "",
    ]
    for (name, file), c in sorted(entries.items()):
        lines.append(f"### {name}")
        lines.append("")
        lines.append(f"- Files: `{file}`")
        lines.append(f"- Licences: {', '.join(c['licenses'])}")
        lines.append(f"- Authors: {', '.join(c['authors'])}")
        if c.get("notes"):
            lines.append(f"- Notes: {c['notes']}")
        for u in c.get("urls", []):
            lines.append(f"- {u}")
        lines.append("")

    CREDITS_OUT.write_text("\n".join(lines))
    print(f"wrote {CREDITS_OUT.name}  ({len(entries)} credited sources)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(Path(sys.argv[1]).resolve())
