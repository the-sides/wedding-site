/** Uses an installed Chromium; set CHROMIUM_PATH if it is not /usr/bin/chromium. */
import assert from "node:assert/strict";
import { chromium, devices } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors: string[] = [];
try {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const start = Date.now();
  await page.goto(url, { waitUntil: "load" });
  await page.locator(".cloth-stage.is-ready").waitFor();
  console.log(`Normal connection: cloth ready in ${Date.now() - start} ms.`);
  assert.equal(
    requests.filter((request) =>
      /keepsakes|walking\.jpg|\.woff2?|react-dom/.test(request),
    ).length,
    0,
  );
  const background = await page
    .locator(".notice-background img")
    .evaluate((image) => {
      const img = image as HTMLImageElement;
      return {
        loaded: img.complete && img.naturalWidth > 0,
        width: img.naturalWidth,
      };
    });
  assert.ok(
    background.loaded && background.width >= 800,
    "Use a smooth, high-resolution phone backdrop",
  );

  // A lost WebGL context reproduces Chrome's white sad-canvas from the report.
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "[data-cloth-canvas] canvas",
    )!;
    const extension = canvas
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("The test requires WEBGL_lose_context");
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 1200);
  });
  await page.locator(".cloth-stage.is-unavailable").waitFor();
  const lostState = await page
    .locator("[data-cloth-stage]")
    .evaluate((stage) => ({
      ready: stage.classList.contains("is-ready"),
      canvasVisibility: getComputedStyle(
        stage.querySelector("[data-cloth-canvas]")!,
      ).visibility,
      messageWidth: stage
        .querySelector(".cloth-fallback")!
        .getBoundingClientRect().width,
    }));
  assert.equal(lostState.ready, false);
  assert.equal(
    lostState.canvasVisibility,
    "hidden",
    "Hide Chrome's broken GPU surface immediately",
  );
  assert.ok(
    lostState.messageWidth > 200,
    "Keep the announcement readable during GPU loss",
  );
  await page.locator(".cloth-stage.is-ready").waitFor({ timeout: 10_000 });
  assert.equal(await page.locator(".cloth-stage.is-unavailable").count(), 0);
  console.log(
    "Forced GPU context loss: broken canvas hidden, message readable, cloth restored.",
  );
  await context.close();

  const slowContext = await browser.newContext({ ...devices["Pixel 7"] });
  const slow = await slowContext.newPage();
  slow.on("pageerror", (error) => errors.push(error.message));
  const cdp = await slowContext.newCDPSession(slow);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: 32_000,
    uploadThroughput: 16_000,
    latency: 600,
  });
  const slowStart = Date.now();
  await slow.goto(url, { waitUntil: "commit", timeout: 30_000 });
  await slow.locator("[data-cloth-stage]").waitFor();
  assert.equal(
    await slow
      .locator(".cloth-fallback")
      .evaluate((message) => message.getBoundingClientRect().width),
    1,
    "No fallback flash while the script downloads",
  );
  await slow.locator(".cloth-stage.is-ready").waitFor({ timeout: 30_000 });
  console.log(
    `256 Kbps / 600 ms latency, cold cache: cloth ready in ${Date.now() - slowStart} ms, no fallback flash.`,
  );
  await slowContext.close();
  assert.deepEqual(errors, [], "No unexpected browser exceptions");
} finally {
  await browser.close();
}
