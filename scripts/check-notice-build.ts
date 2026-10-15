/** Run after `bun run build`: catch hidden page resources returning in notice mode. */
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { NOTICE_ONLY } from "../site.config";

if (!NOTICE_ONLY) {
  console.log("Notice-only build checks skipped: the full site is enabled.");
  process.exit(0);
}

const root = ".vercel/output/static";
let clothScript = "";
for (const route of ["", "rsvp", "schedule", "venue", "extras", "notice"]) {
  const html = readFileSync(join(root, route, "index.html"), "utf8");
  assert.match(
    html,
    /data-cloth-stage/,
    `${route || "/"}: announcement missing`,
  );
  assert.doesNotMatch(
    html,
    /keepsakes\/|walking\.jpg|\.woff2?|@font-face|<video|<astro-island|Wedding pages|Nothing yet/,
    `${route || "/"}: original page or its assets rendered behind the notice`,
  );
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(
    scripts.length,
    1,
    `${route || "/"}: load only the cloth script`,
  );
  clothScript ||= scripts[0];
  assert.equal(
    scripts[0],
    clothScript,
    "Every page must use the same notice entry point",
  );
  assert.doesNotMatch(
    html,
    /<link[^>]*rel="stylesheet"/,
    "Notice styles must stay inline without site CSS or fonts",
  );
}

for (const size of ["desktop", "mobile"]) {
  assert.ok(
    statSync(join(root, `notice-background-${size}.webp`)).size < 8192,
    "Keep the compressed background under 8 KB",
  );
}
const scriptBytes = gzipSync(readFileSync(join(root, clothScript))).byteLength;
assert.ok(
  scriptBytes < 180_000,
  `Cloth script grew beyond its compressed budget: ${scriptBytes} bytes`,
);
console.log(
  `Notice-only build passed: all six routes, no site media/fonts/React; cloth JS ${Math.round(scriptBytes / 1024)} KB gzip.`,
);
