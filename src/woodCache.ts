/**
 * Cached wood for one tree.
 *
 * Settled strands are stroked once and kept in a composite. A frame whose
 * geometry matches that bake is one blit. A strand that is still sprouting,
 * withering, or whose mass changed is restroked; the composite is rebuilt
 * from the other strands' sprites so the rest of the crown is not stroked
 * again.
 *
 * Sprites sit on the device-pixel grid and are blitted 1:1. Source-over is
 * associative, so stacking those sprites matches stroking the same capsules
 * straight onto the main canvas, including the darker joints where round
 * caps overlap.
 */

export type StrandPt = { x: number; y: number; w: number; a: number };

export type WoodStrand = {
  /** Node birth ids, rootward to tip. Stable across index remaps. */
  births: readonly number[];
  pts: readonly StrandPt[];
};

/** Subpixel bucket. Motion smaller than this does not change coverage. */
const POS_Q = 256;
/** Matches the 8-bit alpha the canvas already stores. */
const ALPHA_Q = 255;
/** CSS pixels of anti-alias fringe kept inside each sprite. */
const PAD_CSS = 2;
/** Extra device-pixel slack so a short grow does not reallocate. */
const SLACK_CSS = 32;

type StrokeCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

type Slot = {
  fill: string;
  quant: Int32Array;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  /** Device-pixel origin of `canvas` in the main canvas. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type DevRect = { x0: number; y0: number; x1: number; y1: number };

function birthKey(births: readonly number[]): string {
  let key = "";
  for (let i = 0; i < births.length; i++) {
    if (i > 0) key += ",";
    key += births[i];
  }
  return key;
}

function quantMatch(q: Int32Array, pts: readonly StrandPt[]): boolean {
  if (q.length !== pts.length * 4) return false;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) return false;
    const o = i * 4;
    if (q[o] !== Math.round(p.x * POS_Q)) return false;
    if (q[o + 1] !== Math.round(p.y * POS_Q)) return false;
    if (q[o + 2] !== Math.round(p.w * POS_Q)) return false;
    if (q[o + 3] !== Math.round(p.a * ALPHA_Q)) return false;
  }
  return true;
}

function quantizePts(pts: readonly StrandPt[]): Int32Array {
  const q = new Int32Array(pts.length * 4);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const o = i * 4;
    q[o] = Math.round(p.x * POS_Q);
    q[o + 1] = Math.round(p.y * POS_Q);
    q[o + 2] = Math.round(p.w * POS_Q);
    q[o + 3] = Math.round(p.a * ALPHA_Q);
  }
  return q;
}

function catmull(
  a: number,
  b: number,
  c: number,
  d: number,
  t: number,
  t2: number,
  t3: number,
): number {
  return (
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3)
  );
}

function strandPoint(
  pts: readonly StrandPt[],
  index: number,
): StrandPt | undefined {
  if (index < 0 || index >= pts.length) return undefined;
  return pts[index];
}

/**
 * Catmull-Rom capsules. One walker feeds both the stroke and its bounds so
 * the sprite cannot clip a curve the stroke actually draws.
 */
function forEachInk(
  pts: readonly StrandPt[],
  visit: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    alpha: number,
  ) => void,
): void {
  if (pts.length < 2) return;
  const samples = pts.length <= 3 ? 10 : 7;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = strandPoint(pts, Math.max(0, i - 1));
    const p1 = strandPoint(pts, i);
    const p2 = strandPoint(pts, i + 1);
    const p3 = strandPoint(pts, Math.min(pts.length - 1, i + 2));
    if (!p0 || !p1 || !p2 || !p3) continue;
    let prevX = p1.x;
    let prevY = p1.y;
    let prevW = p1.w;
    let prevA = p1.a;
    for (let s = 1; s <= samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = catmull(p0.x, p1.x, p2.x, p3.x, t, t2, t3);
      const y = catmull(p0.y, p1.y, p2.y, p3.y, t, t2, t3);
      const w = catmull(p0.w, p1.w, p2.w, p3.w, t, t2, t3);
      const a = catmull(p0.a, p1.a, p2.a, p3.a, t, t2, t3);
      const alpha = Math.max(0, Math.min(1, (prevA + a) * 0.5));
      const width = Math.max(0.35, (prevW + w) * 0.5);
      if (alpha >= 0.02) visit(prevX, prevY, x, y, width, alpha);
      prevX = x;
      prevY = y;
      prevW = w;
      prevA = a;
    }
  }
}

/** Same capsules the wood used to stroke directly onto the main canvas. */
function strokeFluidStrand(
  c: StrokeCtx,
  pts: readonly StrandPt[],
  fill: string,
): void {
  c.lineCap = "round";
  c.lineJoin = "round";
  forEachInk(pts, (x1, y1, x2, y2, width, alpha) => {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = `rgba(${fill}, ${alpha})`;
    c.lineWidth = width;
    c.stroke();
  });
}

function strokeBounds(
  pts: readonly StrandPt[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  forEachInk(pts, (x1, y1, x2, y2, width) => {
    const r = width * 0.5;
    minX = Math.min(minX, x1 - r, x2 - r);
    minY = Math.min(minY, y1 - r, y2 - r);
    maxX = Math.max(maxX, x1 + r, x2 + r);
    maxY = Math.max(maxY, y1 + r, y2 + r);
    any = true;
  });
  if (!any) return null;
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function snapRect(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  dpr: number,
): DevRect | null {
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }
  const x0 = Math.floor(minX * dpr);
  const y0 = Math.floor(minY * dpr);
  const x1 = Math.max(x0 + 1, Math.ceil(maxX * dpr));
  const y1 = Math.max(y0 + 1, Math.ceil(maxY * dpr));
  return { x0, y0, x1, y1 };
}

function createLayer(
  bmpW: number,
  bmpH: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (bmpW < 1 || bmpH < 1) return null;
  const canvas = document.createElement("canvas");
  canvas.width = bmpW;
  canvas.height = bmpH;
  const ctx =
    canvas.getContext("2d", { alpha: true, colorSpace: "srgb" }) ??
    canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  return { canvas, ctx };
}

function drawDirect(
  dest: CanvasRenderingContext2D,
  strands: readonly WoodStrand[],
  fill: string,
): void {
  for (const strand of strands) strokeFluidStrand(dest, strand.pts, fill);
}

export class WoodCache {
  private dpr = 0;
  private unsupported = false;
  private sprites = new Map<string, Slot>();
  private order: string[] = [];
  private composite: HTMLCanvasElement | null = null;
  private compositeCtx: CanvasRenderingContext2D | null = null;
  private compX0 = 0;
  private compY0 = 0;
  private compW = 0;
  private compH = 0;

  /**
   * `dest` is the main canvas context, still in CSS pixels (scaled by `dpr`).
   * The blit switches to device pixels for the copy, then restores that transform.
   * `zoom` rebakes at the sharper scale and shifts the copy so the view stays centered.
   */
  render(
    dest: CanvasRenderingContext2D,
    strands: readonly WoodStrand[],
    fill: string,
    dpr: number,
    zoom = 1,
  ): void {
    const bake = dpr * zoom;
    if (!(dpr > 0) || !Number.isFinite(bake)) {
      drawDirect(dest, strands, fill);
      return;
    }
    if (this.unsupported) {
      drawDirect(dest, strands, fill);
      return;
    }
    if (this.dpr !== bake) {
      this.dpr = bake;
      this.sprites = new Map();
      this.order = [];
      this.composite = null;
      this.compositeCtx = null;
    }

    const order: string[] = [];
    const next = new Map<string, Slot>();
    let dirty = false;

    for (const strand of strands) {
      if (strand.pts.length < 2) continue;
      const key = birthKey(strand.births);
      order.push(key);
      let slot = this.sprites.get(key);
      const same =
        slot !== undefined &&
        slot.fill === fill &&
        quantMatch(slot.quant, strand.pts);
      if (!same) {
        if (!slot) {
          slot = {
            fill: "",
            quant: new Int32Array(0),
            canvas: null,
            ctx: null,
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 0,
          };
        }
        if (!this.bake(slot, strand.pts, fill, this.dpr)) {
          this.unsupported = true;
          this.sprites = new Map();
          this.order = [];
          this.composite = null;
          this.compositeCtx = null;
          drawDirect(dest, strands, fill);
          return;
        }
        dirty = true;
      }
      if (slot) next.set(key, slot);
    }

    if (next.size !== this.sprites.size) dirty = true;
    if (!dirty && order.length === this.order.length) {
      for (let i = 0; i < order.length; i++) {
        if (order[i] !== this.order[i]) {
          dirty = true;
          break;
        }
      }
    } else if (order.length !== this.order.length) {
      dirty = true;
    }

    this.sprites = next;
    this.order = order;

    if (dirty && !this.rebuildComposite()) {
      this.unsupported = true;
      this.sprites = new Map();
      this.order = [];
      this.composite = null;
      this.compositeCtx = null;
      drawDirect(dest, strands, fill);
      return;
    }
    this.blit(dest, zoom);
  }

  private bake(
    slot: Slot,
    pts: readonly StrandPt[],
    fill: string,
    dpr: number,
  ): boolean {
    slot.fill = fill;
    slot.quant = quantizePts(pts);
    const bounds = strokeBounds(pts);
    if (!bounds) {
      slot.canvas = null;
      slot.ctx = null;
      return true;
    }
    const tight = snapRect(
      bounds.minX - PAD_CSS,
      bounds.minY - PAD_CSS,
      bounds.maxX + PAD_CSS,
      bounds.maxY + PAD_CSS,
      dpr,
    );
    if (!tight) {
      slot.canvas = null;
      slot.ctx = null;
      return true;
    }
    const fits =
      slot.canvas !== null &&
      slot.ctx !== null &&
      slot.x0 <= tight.x0 &&
      slot.y0 <= tight.y0 &&
      slot.x1 >= tight.x1 &&
      slot.y1 >= tight.y1;
    if (!fits) {
      const slack = Math.ceil(SLACK_CSS * dpr);
      const x0 = tight.x0 - slack;
      const y0 = tight.y0 - slack;
      const x1 = tight.x1 + slack;
      const y1 = tight.y1 + slack;
      const layer = createLayer(x1 - x0, y1 - y0);
      if (!layer) return false;
      slot.canvas = layer.canvas;
      slot.ctx = layer.ctx;
      slot.x0 = x0;
      slot.y0 = y0;
      slot.x1 = x1;
      slot.y1 = y1;
    }
    const ctx = slot.ctx;
    const canvas = slot.canvas;
    if (!ctx || !canvas) return false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, -slot.x0, -slot.y0);
    strokeFluidStrand(ctx, pts, fill);
    return true;
  }

  private rebuildComposite(): boolean {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const visible: Slot[] = [];
    for (const key of this.order) {
      const slot = this.sprites.get(key);
      if (!slot?.canvas) continue;
      visible.push(slot);
      if (slot.x0 < x0) x0 = slot.x0;
      if (slot.y0 < y0) y0 = slot.y0;
      if (slot.x1 > x1) x1 = slot.x1;
      if (slot.y1 > y1) y1 = slot.y1;
    }
    if (visible.length === 0) {
      this.composite = null;
      this.compositeCtx = null;
      this.compW = 0;
      this.compH = 0;
      return true;
    }
    const bmpW = x1 - x0;
    const bmpH = y1 - y0;
    if (
      !this.composite ||
      !this.compositeCtx ||
      this.compX0 !== x0 ||
      this.compY0 !== y0 ||
      this.compW !== bmpW ||
      this.compH !== bmpH
    ) {
      const layer = createLayer(bmpW, bmpH);
      if (!layer) return false;
      this.composite = layer.canvas;
      this.compositeCtx = layer.ctx;
      this.compX0 = x0;
      this.compY0 = y0;
      this.compW = bmpW;
      this.compH = bmpH;
    }
    const ctx = this.compositeCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.compW, this.compH);
    for (const slot of visible) {
      if (!slot.canvas) continue;
      ctx.drawImage(slot.canvas, slot.x0 - x0, slot.y0 - y0);
    }
    return true;
  }

  private blit(dest: CanvasRenderingContext2D, zoom: number): void {
    if (!this.composite || this.compW === 0 || this.compH === 0) return;
    const ox = (dest.canvas.width / 2) * (1 - zoom);
    const oy = (dest.canvas.height / 2) * (1 - zoom);
    dest.save();
    dest.setTransform(1, 0, 0, 1, ox, oy);
    dest.imageSmoothingEnabled = false;
    dest.drawImage(this.composite, this.compX0, this.compY0);
    dest.restore();
  }
}
