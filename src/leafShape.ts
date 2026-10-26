import {
  leafLengthScale,
  leafStyles,
  leafWidthScale,
  type LeafStyle,
} from "./colonization";

/** A mark made of several leaflets. It has no single midrib. */
export function leafIsGroup(style: LeafStyle): boolean {
  return (
    style === "spray" ||
    style === "bunch" ||
    style === "needle" ||
    style === "pinnate" ||
    style === "frond"
  );
}

/**
 * Smallest width/length that still reads as a leaf.
 * Narrow styles stay narrower; none of them collapse into a hair.
 */
export function leafMinWidthRatio(style: LeafStyle): number {
  switch (style) {
    case "willow":
      return 0.26;
    case "needle":
    case "arrow":
      return 0.34;
    case "lance":
    case "sickle":
    case "spray":
      return 0.46;
    default:
      return 0.55;
  }
}

/** Width actually drawn. A stored whisker is opened up to the style's blade. */
export function leafPresentedWidth(
  style: LeafStyle,
  len: number,
  wid: number,
): number {
  const length = Math.abs(len) * leafLengthScale(style);
  return Math.max(wid * leafWidthScale(style), length * leafMinWidthRatio(style));
}

export function leafPresentedLength(style: LeafStyle, len: number): number {
  return len * leafLengthScale(style);
}

function traceLance(
  path: LeafTrace,
  ox: number,
  oy: number,
  rot: number,
  halfLen: number,
  halfWid: number,
): void {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pt = (x: number, y: number) => ({
    x: ox + x * c - y * s,
    y: oy + x * s + y * c,
  });
  const base = pt(-halfLen, 0);
  const up = pt(halfLen * 0.15, -halfWid);
  const tip = pt(halfLen, 0);
  const down = pt(halfLen * 0.15, halfWid);
  path.moveTo(base.x, base.y);
  path.quadraticCurveTo(up.x, up.y, tip.x, tip.y);
  path.quadraticCurveTo(down.x, down.y, base.x, base.y);
}

type LeafTrace = {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ): void;
  closePath(): void;
};

/**
 * Leaf silhouette in a space where half-length and half-width are both 1.
 * Drawn later with scale (len/2, wid/2). Each shape fills that box;
 * a blade's width is the width it was given.
 */
export function traceLeaf(path: LeafTrace, style: LeafStyle, hx: number, hy: number): void {
  switch (style) {
    case "lance":
      path.moveTo(-hx * 0.92, 0);
      path.bezierCurveTo(-hx * 0.25, -hy, hx * 0.2, -hy * 0.92, hx * 0.95, 0);
      path.bezierCurveTo(hx * 0.2, hy * 0.92, -hx * 0.25, hy, -hx * 0.92, 0);
      break;
    case "teardrop":
      path.moveTo(-hx * 0.85, 0);
      path.quadraticCurveTo(-hx * 0.2, -hy, hx * 0.15, -hy * 0.55);
      path.quadraticCurveTo(hx, 0, hx * 0.15, hy * 0.55);
      path.quadraticCurveTo(-hx * 0.2, hy, -hx * 0.85, 0);
      break;
    case "needle": {
      // A fascicle: three blades sharing the width, not one crushed line.
      const slots: [number, number, number, number][] = [
        [-0.36, -0.22, 0.88, 0.36],
        [0, 0, 1, 0.4],
        [0.36, 0.22, 0.88, 0.36],
      ];
      for (const [y, rot, len, blade] of slots) {
        traceLance(path, hx * 0.04, y * hy, rot, len * hx, blade * hy);
      }
      break;
    }
    case "round":
      path.ellipse(0, 0, hx * 0.85, hy * 0.95, 0, 0, Math.PI * 2);
      break;
    case "heart":
      path.moveTo(0, hy * 0.75);
      path.bezierCurveTo(
        hx * 0.95,
        hy * 0.15,
        hx * 0.85,
        -hy * 0.75,
        0,
        -hy * 0.2,
      );
      path.bezierCurveTo(
        -hx * 0.85,
        -hy * 0.75,
        -hx * 0.95,
        hy * 0.15,
        0,
        hy * 0.75,
      );
      break;
    case "lobed":
      path.moveTo(-hx * 0.15, hy * 0.85);
      path.quadraticCurveTo(-hx * 0.95, hy * 0.55, -hx * 0.7, 0);
      path.quadraticCurveTo(-hx * 1.05, -hy * 0.35, -hx * 0.35, -hy * 0.75);
      path.quadraticCurveTo(0, -hy * 1.05, hx * 0.35, -hy * 0.75);
      path.quadraticCurveTo(hx * 1.05, -hy * 0.35, hx * 0.7, 0);
      path.quadraticCurveTo(hx * 0.95, hy * 0.55, hx * 0.15, hy * 0.85);
      path.quadraticCurveTo(0, hy * 0.55, -hx * 0.15, hy * 0.85);
      break;
    case "fan":
      path.moveTo(-hx * 0.15, hy * 0.9);
      path.quadraticCurveTo(-hx * 0.2, hy * 0.2, -hx, -hy * 0.15);
      path.quadraticCurveTo(-hx * 0.55, -hy * 0.95, 0, -hy * 0.7);
      path.quadraticCurveTo(hx * 0.55, -hy * 0.95, hx, -hy * 0.15);
      path.quadraticCurveTo(hx * 0.2, hy * 0.2, hx * 0.15, hy * 0.9);
      path.quadraticCurveTo(0, hy * 0.55, -hx * 0.15, hy * 0.9);
      break;
    case "sickle":
      path.moveTo(-hx * 0.88, hy * 0.02);
      path.bezierCurveTo(-hx * 0.15, -hy, hx * 0.45, -hy * 0.95, hx * 0.92, -hy * 0.12);
      path.bezierCurveTo(hx * 0.55, hy * 0.2, hx * 0.05, hy * 0.95, -hx * 0.22, hy * 0.58);
      path.bezierCurveTo(-hx * 0.55, hy * 0.28, -hx * 0.72, hy * 0.12, -hx * 0.88, hy * 0.02);
      break;
    case "diamond":
      // Pointed blade. The shoulders stay angular; the sides bow so it is a leaf.
      path.moveTo(-hx * 0.78, 0);
      path.quadraticCurveTo(-hx * 0.12, -hy * 0.55, hx * 0.2, -hy);
      path.quadraticCurveTo(hx * 0.64, -hy * 0.36, hx, 0);
      path.quadraticCurveTo(hx * 0.64, hy * 0.36, hx * 0.2, hy);
      path.quadraticCurveTo(-hx * 0.12, hy * 0.55, -hx * 0.78, 0);
      break;
    case "spatulate":
      path.moveTo(-hx * 0.95, 0);
      path.quadraticCurveTo(-hx * 0.4, -hy * 0.35, hx * 0.1, -hy * 0.85);
      path.quadraticCurveTo(hx * 0.85, -hy * 0.55, hx * 0.9, 0);
      path.quadraticCurveTo(hx * 0.85, hy * 0.55, hx * 0.1, hy * 0.85);
      path.quadraticCurveTo(-hx * 0.4, hy * 0.35, -hx * 0.95, 0);
      break;
    case "arrow":
      path.moveTo(-hx * 0.95, 0);
      path.lineTo(-hx * 0.05, -hy * 0.78);
      path.lineTo(hx * 0.28, -hy);
      path.lineTo(hx, 0);
      path.lineTo(hx * 0.28, hy);
      path.lineTo(-hx * 0.05, hy * 0.78);
      path.closePath();
      break;
    case "scallop": {
      const lobes = 6;
      for (let i = 0; i <= lobes; i++) {
        const a0 = -Math.PI + (i / lobes) * Math.PI * 2;
        const a1 = -Math.PI + ((i + 0.5) / lobes) * Math.PI * 2;
        const x0 = Math.cos(a0) * hx * 0.82;
        const y0 = Math.sin(a0) * hy * 0.82;
        const x1 = Math.cos(a1) * hx * 1.05;
        const y1 = Math.sin(a1) * hy * 1.05;
        if (i === 0) path.moveTo(x0, y0);
        path.quadraticCurveTo(
          x1,
          y1,
          Math.cos(a0 + Math.PI / lobes) * hx * 0.82,
          Math.sin(a0 + Math.PI / lobes) * hy * 0.82,
        );
      }
      path.closePath();
      break;
    }
    case "spray": {
      // Five blades on one base. Each leaflet is wide enough to overlap the next.
      const fans = [-0.95, -0.48, 0, 0.48, 0.95];
      for (let i = 0; i < fans.length; i++) {
        const rot = fans[i] ?? 0;
        const halfLen = (i === 2 ? 0.9 : 0.78) * hx;
        const halfWid = (i === 2 ? 0.48 : 0.42) * hy;
        const ox = hx * 0.04;
        const oy = Math.sin(rot) * hy * 0.08;
        traceLance(path, ox, oy, rot, halfLen, halfWid);
      }
      break;
    }
    case "bunch": {
      // Overlapping leaflets packed into one clump.
      const spots: [number, number, number, number, number][] = [
        [0.06, 0, 0.55, 0.42, 0.15],
        [0.4, 0.26, 0.48, 0.36, 0.65],
        [0.4, -0.26, 0.48, 0.36, -0.65],
        [-0.26, 0.36, 0.44, 0.34, 1.05],
        [-0.26, -0.36, 0.44, 0.34, -1.05],
        [-0.46, 0, 0.4, 0.32, 0.05],
        [0.02, 0.46, 0.38, 0.3, 1.2],
        [0.02, -0.46, 0.38, 0.3, -1.2],
      ];
      for (const [x, y, rx, ry, rot] of spots) {
        path.ellipse(x * hx, y * hy, rx * hx, ry * hy, rot, 0, Math.PI * 2);
      }
      break;
    }
    case "willow":
      // Long ribbon. The width slider is squashed; the curve keeps it from a lance.
      path.moveTo(-hx * 0.98, hy * 0.02);
      path.bezierCurveTo(-hx * 0.4, -hy * 0.28, hx * 0.2, -hy * 0.62, hx * 0.98, -hy * 0.06);
      path.bezierCurveTo(hx * 0.28, hy * 0.42, -hx * 0.15, hy * 0.78, -hx * 0.98, hy * 0.02);
      break;
    case "pinnate": {
      // Ash / rowan: pairs of leaflets along one rachis, plus a terminal blade.
      const ranks = 5;
      for (let i = 0; i < ranks; i++) {
        const t = i / (ranks - 1);
        const ox = (-0.58 + t * 1.12) * hx;
        const reach = (0.32 + Math.sin(t * Math.PI) * 0.26) * hy;
        traceLance(path, ox, 0, -0.9, reach, hx * 0.1);
        traceLance(path, ox, 0, 0.9, reach, hx * 0.1);
      }
      traceLance(path, hx * 0.38, 0, 0, hx * 0.26, hy * 0.16);
      break;
    }
    case "frond": {
      // Fern or palm: pinnae along an arch, longest through the middle.
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const ox = (-0.78 + t * 1.62) * hx;
        const oy = -Math.sin(t * Math.PI) * hy * 0.16;
        const side = i % 2 === 0 ? 1 : -1;
        const rot = side * (1.05 - t * 0.28);
        const reach = (0.16 + Math.sin(t * Math.PI) * 0.46) * hy;
        traceLance(path, ox, oy, rot, reach, hx * 0.07);
      }
      break;
    }
    case "trifoil":
      path.moveTo(0, hy * 0.2);
      path.bezierCurveTo(hx * 0.15, hy * 0.95, hx * 1.05, hy * 0.55, hx * 0.55, 0);
      path.bezierCurveTo(
        hx * 1.05,
        -hy * 0.55,
        hx * 0.15,
        -hy * 0.95,
        0,
        -hy * 0.15,
      );
      path.bezierCurveTo(
        -hx * 0.15,
        -hy * 0.95,
        -hx * 1.05,
        -hy * 0.55,
        -hx * 0.55,
        0,
      );
      path.bezierCurveTo(
        -hx * 1.05,
        hy * 0.55,
        -hx * 0.15,
        hy * 0.95,
        0,
        hy * 0.2,
      );
      break;
    default:
      path.ellipse(0, 0, hx, hy, 0, 0, Math.PI * 2);
  }
}

const leafOutlines = new Map<LeafStyle, Path2D>();

export function leafOutline(style: LeafStyle): Path2D {
  let path = leafOutlines.get(style);
  if (!path) {
    path = new Path2D();
    traceLeaf(path, style, 1, 1);
    leafOutlines.set(style, path);
  }
  return path;
}

for (const style of leafStyles) leafOutline(style);
