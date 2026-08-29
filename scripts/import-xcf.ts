/*
 * Slices a layered GIMP file into web assets plus a manifest the hero renders
 * from, so the composition can be edited in GIMP and re-imported rather than
 * re-hand-positioned in CSS:
 *
 *   bun scripts/import-xcf.ts art/walking.xcf
 *
 * Every visible layer becomes one file under `public/hero/`, and its position
 * on the canvas is recorded in `src/lib/hero-layers.ts`. Both are generated —
 * edit the `.xcf` and re-run, never the outputs.
 *
 * The point of the split is that a layer stays independently movable on the
 * page. `Hero.astro` positions each one against the same canvas box, so a
 * layer can be nudged, hinged or animated in CSS without disturbing any other,
 * and without the numbers drifting out of register with the artwork.
 *
 * ## Naming
 *
 * Layer names are the contract. A layer called `jaw` becomes `hero/jaw.png`
 * with the slug `jaw`, which is what the CSS hooks onto — so renaming a layer
 * in GIMP renames its asset and its handle. Keep them short and lowercase.
 *
 * ## On driving GIMP from a script
 *
 * GIMP 3 replaced the old Script-Fu-only batch interface with a real Python
 * API over GObject introspection, which is why the payload below is Python
 * rather than Scheme. Two things about it are not obvious:
 *
 *   - `gimp-console -idf` does not exit when the batch command finishes. It
 *     sits there until something calls the `gimp-quit` procedure, so the
 *     payload ends by doing exactly that. Without it this script hangs
 *     forever rather than failing, which is a far worse way to find out.
 *
 *   - Procedures are called by looking them up, filling a config object and
 *     running it — `Gimp.get_pdb().lookup_procedure(name)` then
 *     `create_config()`. The `pdb.gimp_*` calls from every GIMP 2 example on
 *     the internet do not exist any more.
 */

import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = process.argv[2] ?? "art/walking.xcf";
const ASSET_DIR = "public/hero";
const MANIFEST = "src/lib/hero-layers.ts";

/*
 * Runs inside GIMP, not inside Bun. It writes the asset files itself and
 * prints one JSON line to stderr for this script to pick back up — stderr
 * because GIMP writes its own startup chatter to stdout and mixing the two
 * would mean parsing around it.
 */
const payload = (xcf: string, outDir: string) => `
import json, sys, os, re
from gi.repository import Gimp, Gio

def run(name, **props):
    proc = Gimp.get_pdb().lookup_procedure(name)
    cfg = proc.create_config()
    for k, v in props.items():
        cfg.set_property(k.replace("_", "-"), v)
    return proc.run(cfg)

img = Gimp.file_load(Gimp.RunMode.NONINTERACTIVE,
                     Gio.File.new_for_path(${JSON.stringify(xcf)}))
W, H = img.get_width(), img.get_height()
layers = []

# GIMP hands back the stack topmost-first; reversing it puts the manifest in
# paint order, which is the order the hero renders in.
for layer in reversed(img.get_layers()):
    if not layer.get_visible():
        continue
    _, x, y = layer.get_offsets()
    w, h = layer.get_width(), layer.get_height()
    slug = re.sub(r"[^a-z0-9]+", "-", layer.get_name().lower().split(".")[0]).strip("-")

    # A layer with transparency has to stay PNG; anything fully opaque is
    # almost always the backdrop photo, where PNG costs several megabytes over
    # a JPEG nobody could tell apart.
    alpha = layer.has_alpha()
    ext = "png" if alpha else "jpg"
    path = os.path.join(${JSON.stringify(outDir)}, slug + "." + ext)

    # Exporting needs the layer alone in an image of its own size. Copying it
    # into a fresh canvas is what trims the transparent margin off, so the
    # asset is only as big as the artwork and the offsets below stay exact.
    tmp = Gimp.Image.new(w, h, img.get_base_type())
    copy = Gimp.Layer.new_from_drawable(layer, tmp)
    tmp.insert_layer(copy, None, 0)
    copy.set_offsets(0, 0)
    if alpha:
        run("file-png-export", run_mode=Gimp.RunMode.NONINTERACTIVE,
            image=tmp, file=Gio.File.new_for_path(path))
    else:
        run("file-jpeg-export", run_mode=Gimp.RunMode.NONINTERACTIVE,
            image=tmp, file=Gio.File.new_for_path(path), quality=0.82)

    layers.append({
        "slug": slug, "name": layer.get_name(), "src": "/hero/" + slug + "." + ext,
        "width": w, "height": h, "x": x, "y": y,
    })

print(json.dumps({"canvas": {"width": W, "height": H}, "layers": layers}),
      file=sys.stderr, flush=True)
run("gimp-quit", force=False)
`;

const scriptPath = `/tmp/xcf-import-${process.pid}.py`;
await mkdir(ASSET_DIR, { recursive: true });
await writeFile(scriptPath, payload(resolve(source), resolve(ASSET_DIR)));

console.error(`Reading ${source} …`);

// GIMP writes the manifest to stderr and its own startup chatter to stdout,
// so only stderr is captured here; `stdio` lets stdout fall on the floor.
let output = "";
try {
  output = execFileSync(
    "gimp-console",
    [
      "-idf",
      "--batch-interpreter",
      "python-fu-eval",
      "-b",
      `exec(open(${JSON.stringify(scriptPath)}).read())`,
    ],
    { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 },
  );
} catch (error) {
  // A non-zero exit is not automatically fatal: GIMP returns one for the
  // plug-ins it fails to load at startup, long before it reads the payload.
  // What matters is whether the manifest line came out.
  output = String((error as { stderr?: Buffer }).stderr ?? "");
}
await rm(scriptPath, { force: true });

const line = output.split("\n").find((l) => l.startsWith('{"canvas"'));

if (!line) {
  console.error(output);
  throw new Error("GIMP produced no manifest — see its output above.");
}

type Layer = {
  slug: string;
  name: string;
  src: string;
  width: number;
  height: number;
  x: number;
  y: number;
};
const { canvas, layers } = JSON.parse(line) as {
  canvas: { width: number; height: number };
  layers: Layer[];
};

/*
 * Geometry is emitted as percentages of the canvas, not pixels. The hero
 * scales its canvas to cover whatever viewport it lands on, so a pixel offset
 * would only be right at one width; a percentage is right at every width and
 * needs no JavaScript to stay that way.
 */
const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(4)}%`;

const module = `// GENERATED by \`bun scripts/import-xcf.ts ${source}\` — do not edit.
//
// Source of truth is ${source}. Change the artwork there, re-run the import,
// and commit both this file and the assets under public/hero/.

export type HeroLayer = {
  /** Slug from the GIMP layer name; the handle CSS and markup hook onto. */
  slug: string;
  /** The layer name as it reads in GIMP, for anyone diffing the two. */
  name: string;
  src: string;
  /** Position and width as percentages of the canvas, in paint order. */
  left: string;
  top: string;
  width: string;
};

/** Intrinsic size of the GIMP canvas; the hero uses it as an aspect ratio. */
export const HERO_CANVAS = { width: ${canvas.width}, height: ${canvas.height} };

export const HERO_LAYERS: HeroLayer[] = [
${layers
  .map(
    (l) => `  {
    slug: ${JSON.stringify(l.slug)},
    name: ${JSON.stringify(l.name)},
    src: ${JSON.stringify(l.src)},
    left: ${JSON.stringify(pct(l.x, canvas.width))},
    top: ${JSON.stringify(pct(l.y, canvas.height))},
    width: ${JSON.stringify(pct(l.width, canvas.width))},
  },`,
  )
  .join("\n")}
];
`;

await writeFile(MANIFEST, module);

console.error(
  `\n${canvas.width}x${canvas.height} canvas, ${layers.length} layers:\n` +
    layers
      .map((l) => `  ${l.src}  ${l.width}x${l.height} at ${l.x},${l.y}`)
      .join("\n") +
    `\n\nWrote ${MANIFEST}. Run \`bunx prettier --write ${MANIFEST}\` if it looks off.`,
);
