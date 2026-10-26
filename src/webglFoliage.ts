import { leafStyles, type FlowerStyle, type LeafStyle } from "./colonization";
import { leafPresentedLength, leafPresentedWidth, traceLeaf } from "./leafShape";

const MAX_LEAVES = 10_000;
const MAX_FLOWERS = 3_000;
const MAX_DOTS = 512;
/** posSize4 + rot2 + color4 + meta2 + extra4 = 16 */
const STRIDE = 16;
/** Quad padding so lobes past the unit box, and the outline’s antialiasing, stay inside. */
const LEAF_PAD = 1.5;
const LEAF_MASK_RES = 256;

const LEAF_STYLE: Record<LeafStyle, number> = {
  oval: 0,
  lance: 1,
  teardrop: 2,
  needle: 3,
  round: 4,
  heart: 5,
  lobed: 6,
  fan: 7,
  sickle: 8,
  diamond: 9,
  spatulate: 10,
  arrow: 11,
  scallop: 12,
  trifoil: 13,
  spray: 14,
  bunch: 15,
  willow: 16,
  pinnate: 17,
  frond: 18,
};

const FLOWER_STYLE: Record<FlowerStyle, number> = {
  daisy: 0,
  cup: 1,
  bell: 2,
  star: 3,
  tube: 4,
  pom: 5,
  iris: 6,
  buttercup: 7,
  catkin: 8,
  raceme: 9,
  cone: 10,
};

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_posSize;
layout(location=2) in vec2 a_rot;
layout(location=3) in vec4 a_color;
layout(location=4) in vec2 a_meta;
layout(location=5) in vec4 a_extra;

uniform vec2 u_res;

out vec2 v_uv;
out vec4 v_color;
out vec2 v_meta;
out vec4 v_extra;

void main() {
  vec2 local = a_corner * a_posSize.zw;
  vec2 world = a_posSize.xy + vec2(
    local.x * a_rot.x - local.y * a_rot.y,
    local.x * a_rot.y + local.y * a_rot.x
  );
  vec2 clip = (world / u_res) * 2.0 - 1.0;
  clip.y *= -1.0;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_corner;
  v_color = a_color;
  v_meta = a_meta;
  v_extra = a_extra;
}
`;

const LEAF_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_posSize;
layout(location=2) in vec2 a_rot;
layout(location=3) in vec4 a_color;
layout(location=4) in vec2 a_meta;
layout(location=5) in vec4 a_extra;

uniform vec2 u_res;
uniform float u_pad;

out vec2 v_uv;
out vec4 v_color;
out vec2 v_meta;
out vec4 v_extra;
out vec2 v_size;

void main() {
  vec2 local = a_corner * a_posSize.zw * u_pad;
  vec2 world = a_posSize.xy + vec2(
    local.x * a_rot.x - local.y * a_rot.y,
    local.x * a_rot.y + local.y * a_rot.x
  );
  vec2 clip = (world / u_res) * 2.0 - 1.0;
  clip.y *= -1.0;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_corner;
  v_color = a_color;
  v_meta = a_meta;
  v_extra = a_extra;
  v_size = a_posSize.zw;
}
`;

const LEAF_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_color;
in vec2 v_meta;
in vec4 v_extra;
in vec2 v_size;
out vec4 outColor;

uniform highp sampler2DArray u_mask;
uniform float u_pad;

void main() {
  vec2 st = v_uv * 0.5 + 0.5;
  float cover = texture(u_mask, vec3(st, v_meta.x)).r;
  // One pixel of edge. The mask itself is a hard silhouette, and multisampling
  // the transparent canvas fringes that alpha, so the fade stays in the shader.
  float edge = clamp(fwidth(cover), 0.02, 0.45);
  cover = smoothstep(0.5 - edge, 0.5 + edge, cover);

  float len = v_size.x * 2.0;
  vec2 local = v_uv * v_size * u_pad;
  float x0 = -0.35 * len;
  float x1 = 0.4 * len;
  float span = max(x1 - x0, 1e-4);
  float t = clamp((local.x - x0) / span, 0.0, 1.0);
  float dist = length(local - vec2(mix(x0, x1, t), 0.0));
  float rw = max(fwidth(dist), 1e-4);
  float rib = 1.0 - smoothstep(v_meta.y - rw, v_meta.y + rw, dist);

  float fillA = v_color.a * cover;
  float ribA = v_extra.a * rib;
  float outA = ribA + fillA * (1.0 - ribA);
  if (outA < 1.0 / 255.0) discard;
  vec3 premul = v_extra.rgb * ribA + v_color.rgb * fillA * (1.0 - ribA);
  outColor = vec4(premul, outA);
}
`;

const FLOWER_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_color;
in vec2 v_meta;
in vec4 v_extra;
out vec4 outColor;

void main() {
  float style = v_meta.x;
  float petals = max(3.0, v_meta.y);
  vec3 center = v_extra.rgb;
  float coreA = v_extra.a;

  float r = length(v_uv);
  float ang = atan(v_uv.y, v_uv.x);
  float mask = 0.0;
  float core = 0.0;

  if (style < 0.5) {
    // daisy — fat filled petals
    float lobe = 0.62 + 0.38 * cos(ang * petals);
    mask = 1.0 - smoothstep(lobe * 0.72, lobe, r);
    core = 1.0 - smoothstep(0.2, 0.34, r);
  } else if (style < 1.5) {
    float lobe = 0.72 + 0.22 * cos(ang * petals);
    vec2 q = v_uv - vec2(0.0, -0.1);
    mask = 1.0 - smoothstep(lobe * 0.7, lobe, length(q));
    core = 1.0 - smoothstep(0.2, 0.34, length(v_uv - vec2(0.0, 0.08)));
  } else if (style < 2.5) {
    vec2 q = vec2(v_uv.x * 1.05, v_uv.y * 0.95 + 0.08);
    mask = 1.0 - smoothstep(0.55, 0.85, length(q * vec2(1.0, 0.8)));
    core = 1.0 - smoothstep(0.14, 0.26, length(v_uv - vec2(0.0, -0.3)));
  } else if (style < 3.5) {
    float n = petals + 1.0;
    float sector = abs(fract((ang / 6.2831853) * n + 0.5) - 0.5) * 2.0;
    float rad = mix(0.34, 0.92, pow(1.0 - sector, 0.85));
    mask = 1.0 - smoothstep(rad * 0.75, rad, r);
    core = 1.0 - smoothstep(0.18, 0.3, r);
  } else if (style < 4.5) {
    mask = 1.0 - smoothstep(0.4, 0.62, abs(v_uv.x) * 1.5 + abs(v_uv.y) * 0.5);
    core = 1.0 - smoothstep(0.14, 0.26, length(v_uv - vec2(0.0, -0.3)));
  } else if (style < 5.5) {
    float bumpy = 0.78 + 0.18 * cos(ang * 8.0);
    mask = 1.0 - smoothstep(bumpy * 0.72, bumpy, r);
    core = 1.0 - smoothstep(0.22, 0.36, r);
  } else if (style < 6.5) {
    float lobe = 0.7 + 0.25 * cos(ang * 3.0);
    mask = 1.0 - smoothstep(lobe * 0.72, lobe, r);
    core = 1.0 - smoothstep(0.16, 0.28, r);
  } else {
    float lobe = 0.66 + 0.32 * cos(ang * petals);
    mask = 1.0 - smoothstep(lobe * 0.72, lobe, r);
    core = 1.0 - smoothstep(0.2, 0.32, r);
  }

  float aPetal = v_color.a * mask;
  float aCore = coreA * core;
  float a = max(aPetal, aCore);
  if (a < 0.02) discard;

  vec3 rgb = mix(v_color.rgb, center, clamp(core * 1.15, 0.0, 1.0));
  outColor = vec4(rgb * a, a);
}
`;

const DOT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_color;
in vec2 v_meta;
in vec4 v_extra;
out vec4 outColor;

void main() {
  float m = 1.0 - smoothstep(0.82, 0.96, length(v_uv));
  float a = v_color.a * m;
  if (a < 0.08) discard;
  vec3 rgb = v_color.rgb * mix(0.75, 1.0, m);
  outColor = vec4(rgb * a, a);
}
`;

/**
 * A cleared WebGL canvas must stay transparent when drawn onto the page.
 * Mobile Chrome often presents that clear as opaque black, which covers the wash.
 */
function webglClearStaysTransparent(source: HTMLCanvasElement): boolean {
  const gl = source.getContext("webgl2");
  if (!gl) return false;
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!ctx) return false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1, 1);
  ctx.drawImage(source, 0, 0, 1, 1);
  const px = ctx.getImageData(0, 0, 1, 1).data;
  return px[0] > 250 && px[1] > 250 && px[2] > 250;
}

/** One coverage layer per leaf style, rasterized from the canvas outlines. */
function bakeLeafMask(gl: WebGL2RenderingContext): WebGLTexture {
  const res = LEAF_MASK_RES;
  const pad = LEAF_PAD;
  const canvas = document.createElement("canvas");
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext("2d", { alpha: true, colorSpace: "srgb" });
  if (!ctx) throw new Error("leaf mask context missing");

  const scale = res / (2 * pad);
  const layers = leafStyles.length;
  const bytes = new Uint8Array(res * res * layers);

  for (const style of leafStyles) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, res, res);
    ctx.setTransform(scale, 0, 0, scale, res / 2, res / 2);
    ctx.fillStyle = "#fff";
    const path = new Path2D();
    traceLeaf(path, style, 1, 1);
    ctx.fill(path);

    const alpha = ctx.getImageData(0, 0, res, res).data;
    const base = LEAF_STYLE[style] * res * res;
    for (let i = 0; i < res * res; i++) bytes[base + i] = alpha[i * 4 + 3];
  }

  const tex = gl.createTexture();
  if (!tex) throw new Error("leaf mask texture missing");
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texImage3D(
    gl.TEXTURE_2D_ARRAY,
    0,
    gl.R8,
    res,
    res,
    layers,
    0,
    gl.RED,
    gl.UNSIGNED_BYTE,
    bytes,
  );
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  return tex;
}

type Program = {
  prog: WebGLProgram;
  uRes: WebGLUniformLocation;
};

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) ?? "shader error";
    gl.deleteShader(sh);
    throw new Error(info);
  }
  return sh;
}

function link(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): Program {
  const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) ?? "link error";
    gl.deleteProgram(prog);
    throw new Error(info);
  }
  const uRes = gl.getUniformLocation(prog, "u_res");
  if (!uRes) throw new Error("u_res missing");
  return { prog, uRes };
}

/** Instanced WebGL2 foliage (leaves, flowers, pollen). */
export class WebGLFoliage {
  readonly ok: boolean;
  readonly failReason: string | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private leafProg: Program | null = null;
  private flowerProg: Program | null = null;
  private dotProg: Program | null = null;
  private vaoLeaf: WebGLVertexArrayObject | null = null;
  private vaoFlower: WebGLVertexArrayObject | null = null;
  private vaoDot: WebGLVertexArrayObject | null = null;
  private leafBuf: WebGLBuffer | null = null;
  private flowerBuf: WebGLBuffer | null = null;
  private dotBuf: WebGLBuffer | null = null;
  private leafMask: WebGLTexture | null = null;
  private leafPadLoc: WebGLUniformLocation | null = null;
  private leafMaskLoc: WebGLUniformLocation | null = null;

  private leafData = new Float32Array(MAX_LEAVES * STRIDE);
  private flowerData = new Float32Array(MAX_FLOWERS * STRIDE);
  private dotData = new Float32Array(MAX_DOTS * STRIDE);
  private leafCount = 0;
  private flowerCount = 0;
  private dotCount = 0;
  private cssW = 1;
  private cssH = 1;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      // MSAA on a transparent canvas fringes bright edges around soft alpha.
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      this.ok = false;
      return;
    }
    this.gl = gl;
    try {
      if ("drawingBufferColorSpace" in canvas) {
        canvas.drawingBufferColorSpace = "srgb";
      }
      this.leafProg = link(gl, LEAF_VERT, LEAF_FRAG);
      this.flowerProg = link(gl, VERT, FLOWER_FRAG);
      this.dotProg = link(gl, VERT, DOT_FRAG);
      this.leafPadLoc = gl.getUniformLocation(this.leafProg.prog, "u_pad");
      this.leafMaskLoc = gl.getUniformLocation(this.leafProg.prog, "u_mask");
      if (!this.leafPadLoc || !this.leafMaskLoc) {
        throw new Error("leaf mask uniforms missing");
      }
      this.leafMask = bakeLeafMask(gl);
      this.vaoLeaf = this.makeVao("leaf");
      this.vaoFlower = this.makeVao("flower");
      this.vaoDot = this.makeVao("dot");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      if (!webglClearStaysTransparent(canvas)) {
        throw new Error("WebGL clear composites as black");
      }
      this.ok = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.failReason = message;
      console.warn("WebGL foliage init failed, falling back to Canvas2D", e);
      this.ok = false;
      this.gl = null;
    }
  }

  private makeVao(kind: "leaf" | "flower" | "dot"): WebGLVertexArrayObject {
    const gl = this.gl!;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const inst = gl.createBuffer()!;
    if (kind === "leaf") this.leafBuf = inst;
    else if (kind === "flower") this.flowerBuf = inst;
    else this.dotBuf = inst;

    const max =
      kind === "leaf" ? MAX_LEAVES : kind === "flower" ? MAX_FLOWERS : MAX_DOTS;
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, max * STRIDE * 4, gl.DYNAMIC_DRAW);

    const stride = STRIDE * 4;

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);

    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(3, 1);

    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 40);
    gl.vertexAttribDivisor(4, 1);

    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 48);
    gl.vertexAttribDivisor(5, 1);

    gl.bindVertexArray(null);
    return vao;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    if (!this.gl || !this.ok) return;
    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    this.cssW = cssW;
    this.cssH = cssH;
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  begin(): void {
    this.leafCount = 0;
    this.flowerCount = 0;
    this.dotCount = 0;
  }

  hasLeaves(): boolean {
    return this.leafCount > 0;
  }

  pushLeaf(
    style: LeafStyle,
    x: number,
    y: number,
    angle: number,
    len: number,
    wid: number,
    r: number,
    g: number,
    b: number,
    alpha: number,
    mr: number,
    mg: number,
    mb: number,
    midribAlpha: number,
  ): void {
    if (this.leafCount >= MAX_LEAVES) return;
    const hx = leafPresentedLength(style, len) * 0.5;
    const hy = leafPresentedWidth(style, len, wid) * 0.5;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(angle) ||
      !(hx > 0) ||
      !(hy > 0)
    ) {
      return;
    }
    const i = this.leafCount * STRIDE;
    const d = this.leafData;
    d[i] = x;
    d[i + 1] = y;
    d[i + 2] = hx;
    d[i + 3] = hy;
    d[i + 4] = Math.cos(angle);
    d[i + 5] = Math.sin(angle);
    d[i + 6] = r / 255;
    d[i + 7] = g / 255;
    d[i + 8] = b / 255;
    d[i + 9] = Math.min(1, Math.max(0, alpha));
    d[i + 10] = LEAF_STYLE[style];
    d[i + 11] = 0.3;
    d[i + 12] = mr / 255;
    d[i + 13] = mg / 255;
    d[i + 14] = mb / 255;
    d[i + 15] = Math.min(1, Math.max(0, midribAlpha));
    this.leafCount++;
  }

  pushFlower(
    style: FlowerStyle,
    x: number,
    y: number,
    angle: number,
    size: number,
    petals: number,
    pr: number,
    pg: number,
    pb: number,
    alpha: number,
    cr: number,
    cg: number,
    cb: number,
  ): void {
    if (this.flowerCount >= MAX_FLOWERS) return;
    const i = this.flowerCount * STRIDE;
    const d = this.flowerData;
    const s = Math.max(3.5, size);
    d[i] = x;
    d[i + 1] = y;
    d[i + 2] = s;
    d[i + 3] = s;
    d[i + 4] = Math.cos(angle);
    d[i + 5] = Math.sin(angle);
    d[i + 6] = pr / 255;
    d[i + 7] = pg / 255;
    d[i + 8] = pb / 255;
    d[i + 9] = alpha;
    d[i + 10] = FLOWER_STYLE[style] ?? 0;
    d[i + 11] = petals;
    d[i + 12] = cr / 255;
    d[i + 13] = cg / 255;
    d[i + 14] = cb / 255;
    d[i + 15] = Math.min(1, alpha + 0.15);
    this.flowerCount++;
  }

  pushPollen(x: number, y: number, size: number, alpha: number): void {
    if (this.dotCount >= MAX_DOTS) return;
    const i = this.dotCount * STRIDE;
    const d = this.dotData;
    const s = Math.max(0.4, size);
    d[i] = x;
    d[i + 1] = y;
    d[i + 2] = s;
    d[i + 3] = s;
    d[i + 4] = 1;
    d[i + 5] = 0;
    d[i + 6] = 210 / 255;
    d[i + 7] = 196 / 255;
    d[i + 8] = 150 / 255;
    d[i + 9] = alpha;
    d[i + 10] = 0;
    d[i + 11] = 0;
    d[i + 12] = 0;
    d[i + 13] = 0;
    d[i + 14] = 0;
    d[i + 15] = 0;
    this.dotCount++;
  }

  flush(): void {
    const gl = this.gl;
    if (!gl || !this.ok) return;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (
      this.leafCount > 0 &&
      this.leafProg &&
      this.vaoLeaf &&
      this.leafBuf &&
      this.leafMask &&
      this.leafPadLoc &&
      this.leafMaskLoc
    ) {
      gl.useProgram(this.leafProg.prog);
      gl.uniform2f(this.leafProg.uRes, this.cssW, this.cssH);
      gl.uniform1f(this.leafPadLoc, LEAF_PAD);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.leafMask);
      gl.uniform1i(this.leafMaskLoc, 0);
      gl.bindVertexArray(this.vaoLeaf);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.leafBuf);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.leafData.subarray(0, this.leafCount * STRIDE),
      );
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.leafCount);
    }

    if (
      this.flowerCount > 0 &&
      this.flowerProg &&
      this.vaoFlower &&
      this.flowerBuf
    ) {
      gl.useProgram(this.flowerProg.prog);
      gl.uniform2f(this.flowerProg.uRes, this.cssW, this.cssH);
      gl.bindVertexArray(this.vaoFlower);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.flowerBuf);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.flowerData.subarray(0, this.flowerCount * STRIDE),
      );
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.flowerCount);
    }

    if (this.dotCount > 0 && this.dotProg && this.vaoDot && this.dotBuf) {
      gl.useProgram(this.dotProg.prog);
      gl.uniform2f(this.dotProg.uRes, this.cssW, this.cssH);
      gl.bindVertexArray(this.vaoDot);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dotBuf);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.dotData.subarray(0, this.dotCount * STRIDE),
      );
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.dotCount);
    }

    gl.bindVertexArray(null);
  }
}
