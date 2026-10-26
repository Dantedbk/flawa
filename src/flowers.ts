import type { FlowerPalette, FlowerStyle } from "./colonization";

export type FlowerRgb = {
  r: number;
  g: number;
  b: number;
  cr: number;
  cg: number;
  cb: number;
};

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${a})`;
}

/** Soft botanical petal — tip toward local -Y. */
function paintPetal(
  c: CanvasRenderingContext2D,
  len: number,
  wid: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
  opts: {
    tipLift?: number;
    notch?: number;
    curve?: number;
    vein?: boolean;
  } = {},
): void {
  const tipLift = Math.min(26, opts.tipLift ?? 22);
  const notch = opts.notch ?? 0;
  const curve = opts.curve ?? 0;
  const lean = curve * wid * 0.35;
  const detailed = len >= 7;

  c.beginPath();
  c.moveTo(lean * 0.15, len * 0.1);
  c.bezierCurveTo(
    wid * 0.62 + lean,
    len * 0.02,
    wid * 0.72 + lean * 0.5,
    -len * 0.42,
    lean * 0.4,
    -len * (0.92 - notch * 0.08),
  );
  if (notch > 0.05) {
    c.quadraticCurveTo(
      lean * 0.15,
      -len * (0.78 - notch * 0.05),
      -lean * 0.1,
      -len,
    );
    c.quadraticCurveTo(
      -lean * 0.2,
      -len * (0.78 - notch * 0.05),
      -lean * 0.4,
      -len * (0.92 - notch * 0.08),
    );
  }
  c.bezierCurveTo(
    -wid * 0.72 + lean * 0.5,
    -len * 0.42,
    -wid * 0.62 + lean,
    len * 0.02,
    lean * 0.15,
    len * 0.1,
  );
  c.closePath();

  if (detailed) {
    const grad = c.createLinearGradient(lean, len * 0.12, lean * 0.3, -len);
    grad.addColorStop(0, rgba(r - 28, g - 32, b - 22, alpha));
    grad.addColorStop(0.45, rgba(r - 4, g - 6, b - 3, alpha));
    grad.addColorStop(
      1,
      rgba(r + tipLift, g + tipLift * 0.7, b + tipLift * 0.4, alpha),
    );
    c.fillStyle = grad;
  } else {
    c.fillStyle = rgba(r, g, b, alpha);
  }
  c.fill();

  if (opts.vein !== false && detailed) {
    c.beginPath();
    c.moveTo(lean * 0.1, len * 0.02);
    c.quadraticCurveTo(lean * 0.35, -len * 0.4, lean * 0.15, -len * 0.78);
    c.strokeStyle = rgba(r - 35, g - 40, b - 30, alpha * 0.2);
    c.lineWidth = Math.max(0.35, len * 0.016);
    c.lineCap = "round";
    c.stroke();
  }
}

function paintStamenRing(
  c: CanvasRenderingContext2D,
  radius: number,
  count: number,
  cr: number,
  cg: number,
  cb: number,
  alpha: number,
  seed: number,
  antherScale = 1,
): void {
  const n = Math.min(count, radius < 3.5 ? 3 : 6);
  for (let i = 0; i < n; i++) {
    const a = seed * 1.7 + (i / count) * Math.PI * 2;
    const reach = radius * (0.55 + ((i * 11) % 5) * 0.06);
    const x1 = Math.cos(a) * radius * 0.15;
    const y1 = Math.sin(a) * radius * 0.15;
    const x2 = Math.cos(a) * reach;
    const y2 = Math.sin(a) * reach;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = rgba(cr - 10, cg - 15, cb - 5, alpha * 0.55);
    c.lineWidth = Math.max(0.35, radius * 0.06);
    c.lineCap = "round";
    c.stroke();
    c.beginPath();
    c.ellipse(
      x2,
      y2,
      radius * 0.12 * antherScale,
      radius * 0.09 * antherScale,
      a,
      0,
      Math.PI * 2,
    );
    c.fillStyle = rgba(cr + 45, cg + 30, cb + 8, alpha * 0.85);
    c.fill();
  }
}

function paintBloomHeart(
  c: CanvasRenderingContext2D,
  radius: number,
  cr: number,
  cg: number,
  cb: number,
  alpha: number,
  seed: number,
  kind: "disc" | "tuft" | "bowl" = "disc",
): void {
  const glow = c.createRadialGradient(0, 0, 0, 0, 0, radius * 1.2);
  glow.addColorStop(0, rgba(cr + 16, cg + 10, cb + 4, alpha * 0.4));
  glow.addColorStop(0.65, rgba(cr, cg, cb, alpha * 0.12));
  glow.addColorStop(1, rgba(cr, cg, cb, 0));
  c.beginPath();
  c.arc(0, 0, radius * 1.55, 0, Math.PI * 2);
  c.fillStyle = glow;
  c.fill();

  if (kind === "bowl") {
    const bowl = c.createRadialGradient(
      -radius * 0.2,
      -radius * 0.25,
      0,
      0,
      0,
      radius * 1.1,
    );
    bowl.addColorStop(0, rgba(cr + 35, cg + 25, cb + 10, alpha));
    bowl.addColorStop(0.55, rgba(cr, cg, cb, alpha));
    bowl.addColorStop(1, rgba(cr - 30, cg - 35, cb - 20, alpha * 0.95));
    c.beginPath();
    c.ellipse(0, radius * 0.05, radius, radius * 0.78, 0, 0, Math.PI * 2);
    c.fillStyle = bowl;
    c.fill();
  } else if (kind === "tuft") {
    c.beginPath();
    c.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
    c.fillStyle = rgba(cr - 15, cg - 20, cb - 10, alpha);
    c.fill();
    paintStamenRing(
      c,
      radius * 1.15,
      8 + (Math.abs(seed * 9) % 5),
      cr,
      cg,
      cb,
      alpha,
      seed,
      1.15,
    );
  } else {
    const disc = c.createRadialGradient(
      -radius * 0.25,
      -radius * 0.3,
      0,
      0,
      0,
      radius,
    );
    disc.addColorStop(0, rgba(cr + 40, cg + 28, cb + 12, alpha));
    disc.addColorStop(0.45, rgba(cr, cg, cb, alpha));
    disc.addColorStop(1, rgba(cr - 35, cg - 40, cb - 25, alpha));
    c.beginPath();
    c.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    c.fillStyle = disc;
    c.fill();

    const n = 6 + (Math.abs(seed * 13) % 5);
    for (let i = 0; i < n; i++) {
      const a = seed * 2.1 + (i / n) * Math.PI * 2;
      const d = radius * (0.2 + ((i * 7) % 4) * 0.1);
      c.beginPath();
      c.arc(
        Math.cos(a) * d,
        Math.sin(a) * d,
        radius * (0.06 + (i % 2) * 0.03),
        0,
        Math.PI * 2,
      );
      c.fillStyle = rgba(cr + 50, cg + 40, cb + 12, alpha * 0.65);
      c.fill();
    }
    paintStamenRing(
      c,
      radius * 0.95,
      5 + (Math.abs(seed * 5) % 3),
      cr,
      cg,
      cb,
      alpha * 0.9,
      seed + 1,
      0.85,
    );
  }
}

function paintSepals(
  c: CanvasRenderingContext2D,
  count: number,
  len: number,
  wid: number,
  alpha: number,
  twist = 0,
): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2 + twist;
    c.save();
    c.rotate(a);
    c.translate(0, -len * 0.08);
    c.beginPath();
    c.moveTo(0, len * 0.05);
    c.quadraticCurveTo(wid * 0.45, -len * 0.15, 0, -len * 0.55);
    c.quadraticCurveTo(-wid * 0.45, -len * 0.15, 0, len * 0.05);
    c.fillStyle = `rgba(72, 92, 68, ${alpha * 0.55})`;
    c.fill();
    c.restore();
  }
}

export function drawFlower(
  c: CanvasRenderingContext2D,
  style: FlowerStyle,
  x: number,
  y: number,
  angle: number,
  size: number,
  petals: number,
  hue: number,
  palette: FlowerPalette,
  alpha: number,
  sway: number,
): void {
  const { r, g, b, cr, cg, cb } = flowerColors(palette, hue);
  const s = Math.max(4, size);
  const seed = hue * 6.28 + petals * 0.7;

  c.save();
  c.translate(x, y);
  c.rotate(angle + sway);

  c.beginPath();
  c.ellipse(0, s * 0.14, s * 0.48, s * 0.2, 0, 0, Math.PI * 2);
  c.fillStyle = `rgba(36, 44, 34, ${0.11 * alpha})`;
  c.fill();

  const ring = (
    count: number,
    len: number,
    wid: number,
    orbit: number,
    twist = 0,
    tipLift = 30,
    notch = 0,
  ): void => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2 + twist;
      const jitter = Math.sin(seed + i * 1.7) * 0.04;
      const bend = Math.sin(seed * 1.3 + i * 2.1) * 0.55;
      c.save();
      c.rotate(a + jitter);
      c.translate(0, -orbit);
      paintPetal(
        c,
        len * (0.9 + ((i * 13 + 3) % 5) * 0.03),
        wid * (0.88 + ((i * 9) % 4) * 0.045),
        r,
        g,
        b,
        alpha,
        {
          tipLift: tipLift + (i % 3) * 4,
          notch,
          curve: bend,
          vein: true,
        },
      );
      c.restore();
    }
  };

  switch (style) {
    case "cup": {
      const n = Math.max(4, Math.min(6, petals));
      paintSepals(c, n, s * 0.55, s * 0.28, alpha, 0.2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        c.save();
        c.rotate(a);
        c.translate(0, -s * 0.06);
        c.rotate(Math.sin(seed + i) * 0.06);
        paintPetal(c, s * 0.78, s * 0.42, r, g, b, alpha, {
          tipLift: 18,
          notch: 0.15,
          curve: Math.sin(seed * 2 + i) * 0.35,
        });
        c.restore();
      }
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n;
        c.save();
        c.rotate(a);
        c.translate(0, -s * 0.02);
        paintPetal(
          c,
          s * 0.52,
          s * 0.3,
          Math.min(255, r + 18),
          Math.min(255, g + 12),
          Math.min(255, b + 8),
          alpha * 0.92,
          { tipLift: 22, vein: false },
        );
        c.restore();
      }
      paintBloomHeart(c, s * 0.18, cr, cg, cb, alpha, seed, "bowl");
      break;
    }
    case "bell": {
      paintSepals(c, 3, s * 0.4, s * 0.22, alpha * 0.8, 0);
      const skirt = c.createRadialGradient(
        0,
        -s * 0.15,
        s * 0.05,
        0,
        s * 0.15,
        s * 0.7,
      );
      skirt.addColorStop(0, rgba(r + 24, g + 14, b + 8, alpha));
      skirt.addColorStop(0.45, rgba(r, g, b, alpha));
      skirt.addColorStop(1, rgba(r - 20, g - 28, b - 18, alpha * 0.95));
      c.beginPath();
      c.moveTo(-s * 0.12, -s * 0.4);
      c.bezierCurveTo(-s * 0.22, -s * 0.15, -s * 0.55, s * 0.05, -s * 0.48, s * 0.38);
      c.quadraticCurveTo(-s * 0.2, s * 0.55, 0, s * 0.5);
      c.quadraticCurveTo(s * 0.2, s * 0.55, s * 0.48, s * 0.38);
      c.bezierCurveTo(s * 0.55, s * 0.05, s * 0.22, -s * 0.15, s * 0.12, -s * 0.4);
      c.quadraticCurveTo(0, -s * 0.28, -s * 0.12, -s * 0.4);
      c.closePath();
      c.fillStyle = skirt;
      c.fill();
      c.beginPath();
      c.ellipse(0, s * 0.05, s * 0.28, s * 0.22, 0, 0, Math.PI * 2);
      c.fillStyle = rgba(r - 35, g - 40, b - 28, alpha * 0.35);
      c.fill();
      for (let i = 0; i < 5; i++) {
        const a = seed + i * 1.3;
        c.beginPath();
        c.arc(
          Math.cos(a) * s * 0.12,
          s * 0.08 + Math.sin(a * 1.4) * s * 0.1,
          s * 0.035,
          0,
          Math.PI * 2,
        );
        c.fillStyle = rgba(cr - 10, cg - 20, cb - 5, alpha * 0.4);
        c.fill();
      }
      c.beginPath();
      c.ellipse(0, -s * 0.3, s * 0.13, s * 0.09, 0, 0, Math.PI * 2);
      const mouth = c.createRadialGradient(
        0,
        -s * 0.32,
        0,
        0,
        -s * 0.28,
        s * 0.14,
      );
      mouth.addColorStop(0, rgba(cr + 30, cg + 20, cb + 8, alpha));
      mouth.addColorStop(1, rgba(cr - 20, cg - 25, cb - 15, alpha));
      c.fillStyle = mouth;
      c.fill();
      break;
    }
    case "star": {
      const n = Math.max(5, Math.min(7, petals + 1));
      paintSepals(c, n, s * 0.45, s * 0.2, alpha * 0.7, Math.PI / n);
      ring(n, s * 0.88, s * 0.26, s * 0.04, 0, 38, 0.55);
      c.beginPath();
      c.arc(0, 0, s * 0.28, 0, Math.PI * 2);
      c.fillStyle = rgba(r + 20, g + 12, b + 8, alpha * 0.45);
      c.fill();
      paintBloomHeart(c, s * 0.16, cr, cg, cb, alpha, seed, "tuft");
      break;
    }
    case "tube": {
      paintSepals(c, 4, s * 0.5, s * 0.22, alpha * 0.75, 0.1);
      const throat = c.createLinearGradient(0, s * 0.5, 0, -s * 0.35);
      throat.addColorStop(0, rgba(r - 30, g - 35, b - 22, alpha));
      throat.addColorStop(0.55, rgba(r - 8, g - 10, b - 6, alpha));
      throat.addColorStop(1, rgba(r + 16, g + 10, b + 6, alpha));
      c.beginPath();
      c.moveTo(-s * 0.09, s * 0.48);
      c.bezierCurveTo(-s * 0.11, s * 0.15, -s * 0.1, -s * 0.05, -s * 0.08, -s * 0.18);
      c.lineTo(s * 0.08, -s * 0.18);
      c.bezierCurveTo(s * 0.1, -s * 0.05, s * 0.11, s * 0.15, s * 0.09, s * 0.48);
      c.closePath();
      c.fillStyle = throat;
      c.fill();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2 + 0.12;
        c.save();
        c.rotate(a);
        c.translate(0, -s * 0.28);
        paintPetal(c, s * 0.36, s * 0.28, r, g, b, alpha, {
          tipLift: 28,
          notch: 0.2,
          curve: Math.sin(seed + i) * 0.4,
        });
        c.restore();
      }
      c.beginPath();
      c.ellipse(0, -s * 0.2, s * 0.14, s * 0.09, 0, 0, Math.PI * 2);
      c.fillStyle = rgba(cr, cg, cb, alpha);
      c.fill();
      paintStamenRing(c, s * 0.22, 4, cr, cg, cb, alpha, seed, 0.9);
      break;
    }
    case "pom": {
      const layers = [
        { n: 10 + (petals % 3), len: 0.8, wid: 0.16, orbit: 0.05, twist: 0 },
        { n: 7, len: 0.55, wid: 0.18, orbit: 0.03, twist: 0.28 },
      ];
      for (const layer of layers) {
        for (let i = 0; i < layer.n; i++) {
          const a =
            (i / layer.n) * Math.PI * 2 - Math.PI / 2 + layer.twist + seed * 0.05;
          c.save();
          c.rotate(a);
          c.translate(0, -s * layer.orbit);
          paintPetal(
            c,
            s * layer.len * (0.92 + (i % 3) * 0.03),
            s * layer.wid,
            r + (i % 3) * 6,
            g + (i % 3) * 4,
            b + (i % 2) * 3,
            alpha * (0.78 + (i % 4) * 0.05),
            { tipLift: 20 + (i % 3) * 6, notch: 0.08, vein: false },
          );
          c.restore();
        }
      }
      paintBloomHeart(c, s * 0.15, cr, cg, cb, alpha, seed, "disc");
      break;
    }
    case "iris": {
      paintSepals(c, 3, s * 0.4, s * 0.25, alpha * 0.6, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        c.save();
        c.rotate(a);
        c.translate(0, -s * 0.08);
        paintPetal(c, s * 0.78, s * 0.34, r, g, b, alpha, {
          tipLift: 24,
          notch: 0.25,
          curve: 0.15,
        });
        c.restore();
      }
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2 + Math.PI / 3;
        c.save();
        c.rotate(a);
        c.translate(0, -s * 0.2);
        c.scale(1, 0.92);
        paintPetal(
          c,
          s * 0.58,
          s * 0.4,
          Math.max(0, r - 14),
          Math.max(0, g - 12),
          Math.max(0, b - 6),
          alpha * 0.95,
          { tipLift: 16, notch: 0.1, curve: 0.55 },
        );
        c.beginPath();
        c.moveTo(0, -s * 0.05);
        c.quadraticCurveTo(s * 0.04, -s * 0.25, 0, -s * 0.4);
        c.strokeStyle = rgba(cr + 30, cg + 10, cb, alpha * 0.35);
        c.lineWidth = s * 0.04;
        c.lineCap = "round";
        c.stroke();
        c.restore();
      }
      paintBloomHeart(c, s * 0.12, cr, cg, cb, alpha, seed, "tuft");
      break;
    }
    case "buttercup": {
      const n = Math.max(5, Math.min(7, petals + 1));
      paintSepals(c, n, s * 0.4, s * 0.24, alpha * 0.65, Math.PI / n);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2 + 0.08;
        c.save();
        c.rotate(a);
        c.translate(0, -s * 0.14);
        paintPetal(c, s * 0.52, s * 0.52, r, g, b, alpha, {
          tipLift: 40,
          notch: 0,
          curve: Math.sin(seed + i * 1.4) * 0.25,
          vein: false,
        });
        c.beginPath();
        c.ellipse(-s * 0.08, -s * 0.22, s * 0.08, s * 0.11, -0.4, 0, Math.PI * 2);
        c.fillStyle = rgba(r + 35, g + 28, b + 16, alpha * 0.22);
        c.fill();
        c.restore();
      }
      paintBloomHeart(c, s * 0.2, cr, cg, cb, alpha, seed, "disc");
      break;
    }
    default: {
      const n = Math.max(6, Math.min(10, petals + 2));
      paintSepals(c, Math.min(5, n), s * 0.38, s * 0.18, alpha * 0.55, 0.15);
      ring(n, s * 0.78, s * 0.3, s * 0.2, 0.03, 42, 0.12);
      ring(
        Math.max(5, n - 2),
        s * 0.48,
        s * 0.24,
        s * 0.1,
        Math.PI / n + 0.08,
        22,
        0,
      );
      c.beginPath();
      c.arc(0, 0, s * 0.28, 0, Math.PI * 2);
      c.fillStyle = rgba(r + 10, g + 6, b + 2, alpha * 0.4);
      c.fill();
      paintBloomHeart(c, s * 0.2, cr, cg, cb, alpha, seed, "disc");
    }
  }
  c.restore();
}

/** Keep palette helper here so main can stay thin; re-export via colors arg. */
export function flowerColors(
  palette: FlowerPalette,
  hue: number,
): FlowerRgb {
  let r: number, g: number, b: number, cr: number, cg: number, cb: number;
  switch (palette) {
    case "butterAmber":
      r = Math.round(235 - hue * 30);
      g = Math.round(200 - hue * 70);
      b = Math.round(110 - hue * 40);
      cr = Math.round(190 - hue * 20);
      cg = Math.round(130 - hue * 30);
      cb = Math.round(40 + hue * 10);
      break;
    case "blushRose":
      r = Math.round(220 - hue * 20);
      g = Math.round(150 - hue * 50);
      b = Math.round(145 - hue * 35);
      cr = Math.round(180 - hue * 15);
      cg = Math.round(100 - hue * 25);
      cb = Math.round(90 - hue * 10);
      break;
    case "peachApricot":
      r = Math.round(235 - hue * 25);
      g = Math.round(175 - hue * 55);
      b = Math.round(130 - hue * 50);
      cr = Math.round(195 - hue * 20);
      cg = Math.round(120 - hue * 35);
      cb = Math.round(70 + hue * 5);
      break;
    case "ivoryGold":
      r = Math.round(240 - hue * 25);
      g = Math.round(225 - hue * 45);
      b = Math.round(190 - hue * 70);
      cr = Math.round(200 - hue * 10);
      cg = Math.round(160 - hue * 30);
      cb = Math.round(80 + hue * 15);
      break;
    case "softBrick":
      r = Math.round(200 - hue * 35);
      g = Math.round(110 - hue * 40);
      b = Math.round(85 - hue * 25);
      cr = Math.round(160 - hue * 20);
      cg = Math.round(85 - hue * 25);
      cb = Math.round(55 + hue * 10);
      break;
    case "snowBell":
      r = Math.round(248 - hue * 18);
      g = Math.round(246 - hue * 16);
      b = Math.round(240 - hue * 28);
      cr = Math.round(210 - hue * 30);
      cg = Math.round(190 - hue * 40);
      cb = Math.round(120 + hue * 20);
      break;
    case "citrusBloom":
      r = Math.round(245 - hue * 20);
      g = Math.round(230 - hue * 55);
      b = Math.round(120 - hue * 50);
      cr = Math.round(210 - hue * 15);
      cg = Math.round(160 - hue * 40);
      cb = Math.round(50 + hue * 15);
      break;
    case "wineBerry":
      r = Math.round(170 - hue * 35);
      g = Math.round(55 - hue * 20);
      b = Math.round(70 - hue * 15);
      cr = Math.round(120 - hue * 20);
      cg = Math.round(40 - hue * 10);
      cb = Math.round(45 + hue * 10);
      break;
    case "skyMist":
      r = Math.round(175 - hue * 25);
      g = Math.round(200 - hue * 30);
      b = Math.round(210 - hue * 20);
      cr = Math.round(140 - hue * 20);
      cg = Math.round(155 - hue * 25);
      cb = Math.round(150 - hue * 15);
      break;
    case "clayBlush":
      r = Math.round(210 - hue * 30);
      g = Math.round(140 - hue * 40);
      b = Math.round(120 - hue * 35);
      cr = Math.round(165 - hue * 20);
      cg = Math.round(95 - hue * 25);
      cb = Math.round(75 + hue * 10);
      break;
    case "honeyDew":
      r = Math.round(225 - hue * 25);
      g = Math.round(230 - hue * 35);
      b = Math.round(160 - hue * 50);
      cr = Math.round(185 - hue * 15);
      cg = Math.round(170 - hue * 30);
      cb = Math.round(70 + hue * 15);
      break;
    default:
      r = Math.round(230 - hue * 40);
      g = Math.round(210 - hue * 110);
      b = Math.round(175 - hue * 90);
      cr = Math.round(200 - hue * 20);
      cg = Math.round(150 - hue * 40);
      cb = Math.round(70 + hue * 20);
  }
  return { r, g, b, cr, cg, cb };
}
