import * as THREE from "three";
import type { ClothSim } from "./physics";
import { NOTICE_SUBSCRIBE_BUTTON, NOTICE_SUBSCRIBE_HINT } from "../rsvp-status";

/*
 * The sign-up field is printed into the cloth like the rest of the notice, so
 * the letters you type fold and swing with the fabric. A real <form> sits
 * over the printed field, invisible, and follows the cloth: the browser still
 * owns focus, typing, autofill, the phone keyboard, and screen readers, and
 * this file just mirrors that input's state into the artwork.
 */

/** Logical size of the artwork; compact textures scale down from this. */
export const ARTWORK_WIDTH = 1536;
export const ARTWORK_HEIGHT = 1280;
const INPUT = { x: 318, y: 960, w: 620, h: 96 };
const BUTTON = { x: 958, y: 960, w: 260, h: 96 };
const HINT_Y = 1128;
const PAD = 26;

export type FieldState = "idle" | "sending" | "done" | "error";

export interface SubscribeField {
  form: HTMLFormElement;
  input: HTMLInputElement;
  status: HTMLElement;
}

export function findSubscribeField(root: ParentNode): SubscribeField | null {
  const form = root.querySelector<HTMLFormElement>("[data-subscribe]");
  const input = form?.querySelector<HTMLInputElement>("input[name=email]");
  const status = form?.querySelector<HTMLElement>("[data-subscribe-status]");
  return form && input && status ? { form, input, status } : null;
}

function stitch(
  ctx: CanvasRenderingContext2D,
  rect: typeof INPUT,
  inset: number,
  color: string,
  width: number,
) {
  ctx.save();
  ctx.setLineDash([13, 8]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.strokeRect(
    rect.x + inset,
    rect.y + inset,
    rect.w - inset * 2,
    rect.h - inset * 2,
  );
  ctx.restore();
}

/** Paints the field in artwork coordinates; the caller has already scaled. */
export function drawSubscribeField(
  ctx: CanvasRenderingContext2D,
  field: SubscribeField,
  caretOn: boolean,
) {
  const { input, status } = field;
  const state = (field.form.dataset.state ?? "idle") as FieldState;
  const focused = document.activeElement === input;
  const baseline = INPUT.y + INPUT.h / 2 + 16;
  const innerWidth = INPUT.w - PAD * 2;

  // A slightly deeper cream panel, outlined in running stitches.
  ctx.fillStyle = "#f6ebd6";
  ctx.fillRect(INPUT.x, INPUT.y, INPUT.w, INPUT.h);
  stitch(
    ctx,
    INPUT,
    7,
    state === "error" ? "#a3392f" : focused ? "#48201e" : "#8f5147",
    focused ? 3.5 : 2.5,
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(INPUT.x + PAD - 4, INPUT.y, innerWidth + 8, INPUT.h);
  ctx.clip();
  ctx.textAlign = "left";
  const value = input.value;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? start;
  ctx.font = "48px Georgia, serif";
  const caretX = ctx.measureText(value.slice(0, end)).width;
  // Scroll long addresses the way a real input does: keep the caret in view.
  const scroll = focused ? Math.max(0, caretX - innerWidth + 6) : 0;
  const left = INPUT.x + PAD - scroll;
  if (value) {
    if (focused && start !== end) {
      const from = ctx.measureText(value.slice(0, start)).width;
      ctx.fillStyle = "#e7c7b5";
      ctx.fillRect(left + from, INPUT.y + 24, caretX - from, INPUT.h - 48);
    }
    ctx.fillStyle = "#48201e";
    ctx.fillText(value, left, baseline);
  } else {
    ctx.fillStyle = "#ab8d7f";
    ctx.font = "italic 44px Georgia, serif";
    ctx.fillText(input.placeholder, left, baseline);
  }
  if (focused && caretOn && state !== "sending" && !input.readOnly) {
    ctx.fillStyle = "#48201e";
    ctx.fillRect(left + caretX, INPUT.y + 22, 3, INPUT.h - 44);
  }
  ctx.restore();

  // A sewn-on patch for the button.
  ctx.fillStyle = state === "done" ? "#5f7a58" : "#8f5147";
  ctx.fillRect(BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h);
  stitch(ctx, BUTTON, 9, "#fff8e9aa", 2.5);
  ctx.fillStyle = "#fff8e9";
  ctx.textAlign = "center";
  ctx.font = "40px Georgia, serif";
  const label =
    state === "sending"
      ? "Sending…"
      : state === "done"
        ? "✓ Noted"
        : NOTICE_SUBSCRIBE_BUTTON;
  ctx.fillText(label, BUTTON.x + BUTTON.w / 2, baseline - 1);

  ctx.fillStyle =
    state === "error" ? "#a3392f" : state === "done" ? "#5f7a58" : "#8f5147";
  ctx.font = "italic 38px Georgia, serif";
  ctx.fillText(
    status.textContent?.trim() || NOTICE_SUBSCRIBE_HINT,
    ARTWORK_WIDTH / 2,
    HINT_Y,
  );
}

const corner = new THREE.Vector3();

/** World position of an artwork point on the current cloth, interpolated. */
function clothPoint(sim: ClothSim, x: number, y: number, out: THREE.Vector3) {
  const gx = (x / ARTWORK_WIDTH) * sim.segX;
  const gy = (y / ARTWORK_HEIGHT) * sim.segY;
  const x0 = Math.min(Math.floor(gx), sim.segX - 1);
  const y0 = Math.min(Math.floor(gy), sim.segY - 1);
  const fx = gx - x0;
  const fy = gy - y0;
  const p = sim.positions;
  out.set(0, 0, 0);
  for (const [dx, dy, w] of [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy],
  ]) {
    const i = ((y0 + dy) * sim.cols + x0 + dx) * 3;
    out.x += p[i] * w;
    out.y += p[i + 1] * w;
    out.z += p[i + 2] * w;
  }
  return out;
}

/**
 * Keeps the invisible form over the printed field, as the screen-space box
 * around its outline on the deformed cloth. A fold makes that box looser
 * than the print, which only means a slightly generous tap target.
 */
export function placeSubscribeField(
  field: SubscribeField,
  sim: ClothSim,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const right = BUTTON.x + BUTTON.w;
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 2; j++) {
      clothPoint(
        sim,
        INPUT.x + ((right - INPUT.x) * i) / 6,
        INPUT.y + (INPUT.h * j) / 2,
        corner,
      ).project(camera);
      const px = ((corner.x + 1) / 2) * width;
      const py = ((1 - corner.y) / 2) * height;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }
  // Custom properties rather than left/top, so the flat fallback card (after
  // a lost GPU context, say) simply ignores them.
  const style = field.form.style;
  style.setProperty("--field-x", `${minX}px`);
  style.setProperty("--field-y", `${minY}px`);
  style.setProperty("--field-w", `${maxX - minX}px`);
  style.setProperty("--field-h", `${maxY - minY}px`);
  // While the cloth is still bunched at the pins there is nothing to tap.
  field.form.toggleAttribute("data-folded", maxY - minY < 16);
}
