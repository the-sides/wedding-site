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
  // Inspect the actual print canvas before it is uploaded as a GPU texture.
  // A smaller phone texture must still have cream paper behind every letter.
  await context.addInitScript(() => {
    const canvases: HTMLCanvasElement[] = [];
    (
      window as Window & { clothPrintCanvases?: HTMLCanvasElement[] }
    ).clothPrintCanvases = canvases;
    const createElement = document.createElement.bind(document);
    document.createElement = ((
      ...args: Parameters<typeof document.createElement>
    ) => {
      const element = createElement(...args);
      if (element instanceof HTMLCanvasElement) canvases.push(element);
      return element;
    }) as typeof document.createElement;
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const start = Date.now();
  await page.goto(url, { waitUntil: "load" });
  await page.locator(".cloth-stage.is-ready").waitFor();
  console.log(`Normal connection: cloth ready in ${Date.now() - start} ms.`);
  const printCorners = await page.evaluate(() => {
    const print = (
      window as Window & { clothPrintCanvases?: HTMLCanvasElement[] }
    ).clothPrintCanvases?.find(
      (canvas) => canvas.width === 1024 && canvas.height === 854,
    );
    if (!print) throw new Error("Phone print texture not found");
    const ctx = print.getContext("2d")!;
    return [
      [0, 0],
      [print.width - 1, 0],
      [0, print.height - 1],
      [print.width - 1, print.height - 1],
    ].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
  });
  assert.deepEqual(
    printCorners,
    Array.from({ length: 4 }, () => [255, 248, 233, 255]),
    "The cream paper must cover the entire phone texture, including the right and bottom edges",
  );
  console.log(
    "Phone artwork: all four texture corners have opaque cream paper.",
  );
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
  // Real reloads must release the previous context before starting another.
  for (let load = 0; load < 10; load++) {
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        "[data-cloth-canvas] canvas",
      )!;
      const gl = canvas.getContext("webgl2")!;
      window.addEventListener(
        "pagehide",
        () => {
          sessionStorage.setItem(
            "cloth-test-released",
            String(gl.isContextLost()),
          );
        },
        { once: true },
      );
    });
    await page.reload({ waitUntil: "load" });
    await page.locator(".cloth-stage.is-ready").waitFor();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("cloth-test-released")),
      "true",
      "Reload must release its previous GPU context",
    );
  }
  console.log(
    "10 successive reloads: every previous GPU context released, all new contexts rendered.",
  );
  const cached = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "[data-cloth-canvas] canvas",
    )!;
    const gl = canvas.getContext("webgl2")!;
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    return { released: gl.isContextLost(), removed: !canvas.isConnected };
  });
  assert.deepEqual(cached, { released: true, removed: true });
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await page.locator(".cloth-stage.is-ready").waitFor();
  assert.equal(await page.locator("[data-cloth-canvas] canvas").count(), 1);
  console.log(
    "Back/forward cache: GPU released while cached, one fresh renderer on return.",
  );
  assert.equal(
    await page.getByText("Graphics diagnostics", { exact: true }).count(),
    0,
  );
  await context.close();

  // Exercise the real first-render exception path, rather than just a lost
  // context after successful startup. It must release partial allocations.
  const failedContext = await browser.newContext({ ...devices["Pixel 7"] });
  await failedContext.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.drawElements;
    let first = true;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      if (first) {
        first = false;
        (
          window as Window & { failedClothContext?: WebGL2RenderingContext }
        ).failedClothContext = this;
        throw new Error("Test: first render failed");
      }
      return original.apply(this, args);
    };
  });
  const failed = await failedContext.newPage();
  const debugURL = new URL(url);
  debugURL.searchParams.set("cloth-debug", "1");
  await failed.goto(debugURL.href, { waitUntil: "load" });
  await failed.locator(".cloth-stage.is-unavailable").waitFor();
  assert.equal(
    await failed.evaluate(() =>
      (
        window as Window & { failedClothContext?: WebGL2RenderingContext }
      ).failedClothContext?.isContextLost(),
    ),
    true,
  );
  assert.equal(await failed.locator("[data-cloth-canvas] canvas").count(), 0);
  await failed.getByText("Graphics diagnostics", { exact: true }).click();
  assert.match(
    await failed.locator("details pre").innerText(),
    /initialization-failed/,
  );
  assert.match(
    await failed.locator("details pre").innerText(),
    /Test: first render failed/,
  );
  console.log(
    "Failed first render: partial GPU context released; opt-in phone report records the exact startup exception.",
  );
  await failedContext.close();

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

  // Backgrounding mid-reveal must not spend the reveal's animation budget:
  // hidden time is skipped on both the RAF and performance clocks, as when a
  // phone locks or switches apps while the cloth is still bunched up.
  const hiddenContext = await browser.newContext({ ...devices["Pixel 7"] });
  await hiddenContext.addInitScript(() => {
    const test = window as Window & {
      clothFrames?: number;
      clothSkipped?: number;
      clothHidden?: boolean;
    };
    test.clothFrames = 0;
    test.clothSkipped = 0;
    test.clothHidden = false;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => {
        test.clothFrames!++;
        callback(time + test.clothSkipped!);
      });
    const now = performance.now.bind(performance);
    performance.now = () => now() + test.clothSkipped!;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => test.clothHidden,
    });
  });
  const hidden = await hiddenContext.newPage();
  hidden.on("pageerror", (error) => errors.push(error.message));
  await hidden.goto(url, { waitUntil: "load" });
  await hidden.locator(".cloth-stage.is-ready").waitFor();
  await hidden.evaluate(() => {
    const test = window as Window & { clothHidden?: boolean };
    test.clothHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const framesBefore = await hidden.evaluate(() => {
    const test = window as Window & {
      clothFrames?: number;
      clothSkipped?: number;
      clothHidden?: boolean;
    };
    test.clothSkipped = 20_000;
    test.clothHidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    return test.clothFrames!;
  });
  await hidden.waitForTimeout(1500);
  const framesAfter = await hidden.evaluate(
    () => (window as Window & { clothFrames?: number }).clothFrames!,
  );
  assert.ok(
    framesAfter - framesBefore > 10,
    `The reveal must resume after 20 s in the background (${framesAfter - framesBefore} frames)`,
  );
  console.log(
    `20 s in the background mid-reveal: the cloth kept falling (${framesAfter - framesBefore} frames in 1.5 s).`,
  );
  await hiddenContext.close();

  // A failed script download cannot run the bundle's own catch handler, so
  // the announcement must be revealed by something outside that bundle.
  const offlineContext = await browser.newContext({ ...devices["Pixel 7"] });
  const offline = await offlineContext.newPage();
  await offline.route("**/_astro/*.js", (route) => route.abort("failed"));
  await offline.goto(url, { waitUntil: "load" });
  await offline.locator(".cloth-stage.is-unavailable").waitFor({
    timeout: 10_000,
  });
  assert.ok(
    (await offline
      .locator(".cloth-fallback")
      .evaluate((message) => message.getBoundingClientRect().width)) > 200,
    "Show the announcement when the cloth script cannot download",
  );
  console.log(
    "Cloth script download failed: the flat announcement is shown instead.",
  );
  await offlineContext.close();
  assert.deepEqual(errors, [], "No unexpected browser exceptions");
} finally {
  await browser.close();
}
