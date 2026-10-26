import "./style.css";
import {
  SpaceColonizationTree,
  defaultConfig,
  defaultHabit,
  defaultPhenotype,
  flowerHangs,
  flowerPalettes,
  flowerStyles,
  leafStyles,
  leafWorldAngle,
  makeRandomHabit,
  stemPalettes,
  type BranchPattern,
  type BurnScar,
  type ColonizationConfig,
  type FlowerPalette,
  type FlowerStyle,
  type GrowthHabit,
  type LeafPalette,
  type LeafStyle,
  type StemPalette,
  type StemStyle,
  type TreePhenotype,
  leafPalettes,
} from "./colonization";
import { leafIsGroup, leafOutline, leafPresentedLength, leafPresentedWidth } from "./leafShape";
import { WoodCache, type StrandPt, type WoodStrand } from "./woodCache";
import { WebGLFoliage } from "./webglFoliage";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const foliageCanvas = document.createElement("canvas");
const foliage = new WebGLFoliage(foliageCanvas);
const ctx =
  canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    colorSpace: "srgb",
  }) ?? canvas.getContext("2d")!;
const fpsEl = document.querySelector<HTMLElement>("#stat-fps")!;
const nodesEl = document.querySelector<HTMLElement>("#stat-nodes")!;
const tipsEl = document.querySelector<HTMLElement>("#stat-tips")!;
const reseedBtn = document.querySelector<HTMLButtonElement>("#reseed")!;
const styleRandomBtn = document.querySelector<HTMLButtonElement>("#style-random")!;
const metaEl = document.querySelector<HTMLElement>(".meta")!;
const metaToggleBtn =
  document.querySelector<HTMLButtonElement>("#meta-toggle")!;
const plantModeEl = document.querySelector<HTMLInputElement>("#plant-mode")!;
const immortalModeEl =
  document.querySelector<HTMLInputElement>("#immortal-mode")!;
const randomizeBtn = document.querySelector<HTMLButtonElement>("#randomize")!;
const randomizeStyleBtn =
  document.querySelector<HTMLButtonElement>("#randomize-style")!;
const clearAllBtn = document.querySelector<HTMLButtonElement>("#clear-all")!;
const controlsEl = document.querySelector<HTMLElement>("#controls")!;
const controlsClose =
  document.querySelector<HTMLButtonElement>("#controls-close")!;
const controlsTitle = document.querySelector<HTMLElement>("#controls-title")!;
const growthSlidersEl = document.querySelector<HTMLElement>("#growth-sliders")!;
const timingSlidersEl = document.querySelector<HTMLElement>("#timing-sliders")!;
const windSlidersEl = document.querySelector<HTMLElement>("#wind-sliders")!;
const shapeSlidersEl = document.querySelector<HTMLElement>("#shape-sliders")!;
const leafSlidersEl = document.querySelector<HTMLElement>("#leaf-sliders")!;
const flowerSlidersEl = document.querySelector<HTMLElement>("#flower-sliders")!;
const flowerSlidersAdvEl = document.querySelector<HTMLElement>(
  "#flower-sliders-adv",
)!;
const treeTypeEl = document.querySelector<HTMLSelectElement>("#tree-type")!;
const stemStyleEl = document.querySelector<HTMLSelectElement>("#stem-style")!;
const stemPaletteEl =
  document.querySelector<HTMLSelectElement>("#stem-palette")!;
const leafStyleEl = document.querySelector<HTMLSelectElement>("#leaf-style")!;
const leafPaletteEl =
  document.querySelector<HTMLSelectElement>("#leaf-palette")!;
const leafStyleAltEl =
  document.querySelector<HTMLSelectElement>("#leaf-style-alt")!;
const leafPaletteAltEl =
  document.querySelector<HTMLSelectElement>("#leaf-palette-alt")!;
const flowerStyleEl =
  document.querySelector<HTMLSelectElement>("#flower-style")!;
const flowerPaletteEl =
  document.querySelector<HTMLSelectElement>("#flower-palette")!;
const randomThresholdEl =
  document.querySelector<HTMLInputElement>("#random-threshold")!;
const randomThresholdValEl = document.querySelector<HTMLElement>(
  "#random-threshold-val",
)!;

const MAX_TREES = 8;

/** Pieces released only when the simulation sheds a shoot — not by age fade. */
type FallingLeaf = {
  kind: "leaf";
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  length: number;
  width: number;
  tone: number;
  alpha: number;
  midrib: number;
  leafStyle: LeafStyle;
  leafPalette: LeafPalette;
};

type FallingFlower = {
  kind: "flower";
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
  petals: number;
  hue: number;
  alpha: number;
  flowerStyle: FlowerStyle;
  flowerPalette: FlowerPalette;
};

type FallingStem = {
  kind: "stem";
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  length: number;
  width: number;
  alpha: number;
  stemStyle: StemStyle;
  stemPalette: StemPalette;
};

type Falling = FallingLeaf | FallingFlower | FallingStem;
const falling: Falling[] = [];
/** Hard cap so shed storms can't leave a suspended debris cloud. */
const MAX_FALLING = 160;

type Flyer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
  orbit: number;
  tx: number;
  ty: number;
  retargetAt: number;
  /** Wander heading — drifts randomly for looser flight. */
  wander: number;
  /** Butterfly wing tint 0..1 (ignored for bees). */
  hue: number;
};

const bees: Flyer[] = [];
const butterflies: Flyer[] = [];
const MAX_BEES = 4;
const beesEnabled = true;

/** Soft dust / pollen motes — sparse air life, not weather. */
type Pollen = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  phase: number;
};
const pollen: Pollen[] = [];
const MAX_POLLEN = 42;

type TreeTypeId =
  | "custom"
  | "oliveGrove"
  | "copperMaple"
  | "seaWillow"
  | "jadeNeedle"
  | "autumnFan"
  | "chalkOrchard"
  | "citrusBough"
  | "mossLantern"
  | "wineThicket";

let dpr = 1;
let pulse = 0;
let styleLabel = "";
let plantMode = false;
let hideAttractors = true;
let activeTreeType: TreeTypeId = "custom";

/** Live params — sliders write here; trees read/patch from here. */
const liveConfig: ColonizationConfig = { ...defaultConfig };
const livePhenotype: TreePhenotype = { ...defaultPhenotype };
const liveHabit: GrowthHabit = { ...defaultHabit };
/** Simulation tick rate (steps per second). */
let liveStepHz = 12;
/**
 * Global wind — drives canopy sway and falling debris.
 * Direction: 0° = right, 90° = up, 180° = left, 270° = down.
 */
let windStrength = 0.45;
let windDirectionDeg = 18;
let windGust = 0.4;
/**
 * How wild Randomize / random spawn get (0 = stay near defaults, 1 = full extremes).
 */
let randomThreshold = 0.35;
const trees: SpaceColonizationTree[] = [];
/** Trees planted with Chosen settings stay linked to the panel. */
const panelLinked = new WeakSet<SpaceColonizationTree>();

type SpawnSource = "chosen" | "random";

function spawnSource(): SpawnSource {
  return "random";
}

function trimFalling(): void {
  if (falling.length > MAX_FALLING) {
    falling.splice(0, falling.length - MAX_FALLING);
  }
}

/** Unit wind in canvas space (y+ down). Gust modulates strength over time. */
function windForce(phase = 0): { x: number; y: number; speed: number } {
  const rad = (windDirectionDeg * Math.PI) / 180;
  const gust =
    1 +
    windGust *
      (0.55 * Math.sin(pulse * 0.9 + phase) +
        0.35 * Math.sin(pulse * 2.1 + phase * 1.3) +
        0.2 * Math.sin(pulse * 0.35));
  const speed = windStrength * Math.max(0.05, gust);
  // 0° → right, 90° → up
  return {
    x: Math.cos(rad) * speed,
    y: -Math.sin(rad) * speed,
    speed,
  };
}

function pushFallingLeaf(
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  tone: number,
  alpha: number,
  midrib: number,
  leafStyle: LeafStyle,
  leafPalette: LeafPalette,
): void {
  const w = windForce(angle);
  falling.push({
    kind: "leaf",
    x,
    y,
    // Velocities in px/sec — inherit wind, plus a little tumble.
    vx: w.x * 55 + (Math.random() - 0.5) * 50,
    vy: 45 + Math.random() * 80 + w.y * 40,
    angle,
    spin: (Math.random() - 0.5) * 4 + w.x * 0.8,
    length,
    width,
    tone,
    alpha,
    midrib,
    leafStyle,
    leafPalette,
  });
  trimFalling();
}

function pushFallingFlower(
  x: number,
  y: number,
  angle: number,
  size: number,
  petals: number,
  hue: number,
  alpha: number,
  flowerStyle: FlowerStyle,
  flowerPalette: FlowerPalette,
): void {
  const w = windForce(angle);
  falling.push({
    kind: "flower",
    x,
    y,
    vx: w.x * 48 + (Math.random() - 0.5) * 40,
    vy: 35 + Math.random() * 70 + w.y * 35,
    angle,
    spin: (Math.random() - 0.5) * 5 + w.x * 0.6,
    size,
    petals,
    hue,
    alpha,
    flowerStyle,
    flowerPalette,
  });
  trimFalling();
}

function pushFallingStem(s: BurnScar): void {
  const mx = (s.x1 + s.x2) * 0.5;
  const my = (s.y1 + s.y2) * 0.5;
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
  const w = windForce(mx * 0.01);
  falling.push({
    kind: "stem",
    x: mx,
    y: my,
    vx: w.x * 35 + (Math.random() - 0.5) * 70,
    vy: 65 + Math.random() * 100 + w.y * 25,
    angle: Math.atan2(s.y2 - s.y1, s.x2 - s.x1),
    spin: (Math.random() - 0.5) * 3 + w.x * 0.35,
    length: len,
    width: Math.max(1.2, s.width),
    alpha: 0.55,
    stemStyle: s.stemStyle,
    stemPalette: s.stemPalette,
  });
  trimFalling();
}

function stepFalling(dt: number, height: number): void {
  const sec = Math.min(0.05, dt / 1000);
  const w = windForce(0.7);
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i];
    const sail = f.kind === "leaf" ? 1 : f.kind === "flower" ? 0.85 : 0.4;
    const heavy = f.kind === "stem" ? 1.25 : 1;
    // Gravity + wind acceleration (leaves catch more air).
    f.vy += 520 * sec * heavy;
    f.vx += w.x * 210 * sail * sec;
    f.vy += w.y * 140 * sail * sec;
    // Light air drag — weaker when wind is strong so debris streams downwind.
    const damp = Math.pow(0.9 - Math.min(0.12, windStrength * 0.06), dt / 16);
    f.vx *= damp;
    // Flutter orthogonal to wind.
    f.vx +=
      Math.sin(f.y * 0.03 + f.angle + pulse) *
      (f.kind === "stem" ? 6 : 16) *
      sec;
    f.spin += w.x * sail * 0.4 * sec;
    f.x += f.vx * sec;
    f.y += f.vy * sec;
    f.angle += f.spin * sec;
    // Clear the screen in a couple of seconds — no suspended ghost canopy.
    f.alpha -= (f.kind === "stem" ? 0.35 : 0.45) * sec;
    if (
      f.y > height + 60 ||
      f.x < -80 ||
      f.x > innerWidth + 80 ||
      f.alpha < 0.03
    ) {
      falling.splice(i, 1);
    }
  }
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function pickBranching(): {
  name: BranchPattern;
  config: Partial<ColonizationConfig>;
} {
  return pick(branchingProfiles);
}

const leafShapeAspect: Record<
  LeafStyle,
  { len: number; wid: number; dens: number }
> = {
  oval: { len: 1, wid: 1, dens: 1 },
  lance: { len: 1.2, wid: 0.95, dens: 0.95 },
  teardrop: { len: 1.15, wid: 0.95, dens: 1 },
  needle: { len: 1.25, wid: 0.75, dens: 1.35 },
  round: { len: 0.85, wid: 1.15, dens: 0.9 },
  heart: { len: 1.05, wid: 1.1, dens: 0.95 },
  lobed: { len: 1.05, wid: 1.05, dens: 0.8 },
  fan: { len: 1.05, wid: 1.2, dens: 0.75 },
  sickle: { len: 1.25, wid: 0.9, dens: 1.05 },
  diamond: { len: 1.35, wid: 0.72, dens: 0.95 },
  spatulate: { len: 1.25, wid: 0.95, dens: 0.9 },
  arrow: { len: 1.2, wid: 0.9, dens: 1 },
  scallop: { len: 1.05, wid: 1.05, dens: 0.95 },
  trifoil: { len: 1.1, wid: 1.2, dens: 0.85 },
  spray: { len: 1.25, wid: 1.1, dens: 1 },
  bunch: { len: 1.15, wid: 1.2, dens: 1.05 },
  willow: { len: 1.85, wid: 0.55, dens: 1.35 },
  pinnate: { len: 1.3, wid: 1, dens: 0.75 },
  frond: { len: 1.3, wid: 1.05, dens: 0.75 },
};

/** Botanical look recipes — stems, leaves, and blossoms that belong together. */
type LookHarmony = {
  name: string;
  leafPalettes: LeafPalette[];
  leafStyles: LeafStyle[];
  flowerPalettes: FlowerPalette[];
  flowerStyles: FlowerStyle[];
  stemStyles: StemStyle[];
  stemPalettes: StemPalette[];
};

const lookHarmonies: LookHarmony[] = [
  {
    name: "mediterranean",
    leafPalettes: ["olive", "sage"],
    leafStyles: ["lance", "oval", "spatulate", "sickle"],
    flowerPalettes: ["ivoryGold", "creamCoral", "honeyDew", "butterAmber"],
    flowerStyles: ["star", "daisy", "cup"],
    stemStyles: ["smooth", "gnarled", "twiggy"],
    stemPalettes: ["oliveWood", "ash", "cedar"],
  },
  {
    name: "coastal",
    leafPalettes: ["seaGlass", "jade", "sage"],
    leafStyles: ["sickle", "lance", "needle", "teardrop", "willow"],
    flowerPalettes: ["skyMist", "snowBell", "honeyDew"],
    flowerStyles: ["bell", "tube", "cup", "catkin"],
    stemStyles: ["vine", "reed", "smooth"],
    stemPalettes: ["ash", "oliveWood", "paleBirch"],
  },
  {
    name: "evergreen",
    leafPalettes: ["jade", "moss", "olive"],
    leafStyles: ["needle", "lance", "spray", "arrow", "teardrop", "frond"],
    flowerPalettes: ["honeyDew", "ivoryGold", "citrusBloom"],
    flowerStyles: ["tube", "star", "daisy", "cone"],
    stemStyles: ["reed", "bamboo", "twiggy"],
    stemPalettes: ["cedar", "oliveWood", "charcoal"],
  },
  {
    name: "autumn",
    leafPalettes: ["autumn", "copper"],
    leafStyles: ["fan", "lobed", "heart", "scallop"],
    flowerPalettes: ["butterAmber", "softBrick", "peachApricot", "clayBlush"],
    flowerStyles: ["buttercup", "pom", "daisy"],
    stemStyles: ["gnarled", "smooth", "birch"],
    stemPalettes: ["walnut", "copperBark", "charcoal"],
  },
  {
    name: "orchard",
    leafPalettes: ["sage", "olive", "jade"],
    leafStyles: ["oval", "spatulate", "bunch", "round", "teardrop", "diamond"],
    flowerPalettes: ["snowBell", "blushRose", "creamCoral", "peachApricot"],
    flowerStyles: ["cup", "daisy", "buttercup"],
    stemStyles: ["smooth", "birch", "twiggy"],
    stemPalettes: ["ash", "paleBirch", "oliveWood"],
  },
  {
    name: "citrus",
    leafPalettes: ["jade", "olive"],
    leafStyles: ["diamond", "oval", "teardrop", "spatulate"],
    flowerPalettes: ["citrusBloom", "ivoryGold", "honeyDew", "creamCoral"],
    flowerStyles: ["daisy", "star", "cup"],
    stemStyles: ["smooth", "twiggy", "reed"],
    stemPalettes: ["oliveWood", "cedar", "ash"],
  },
  {
    name: "woodland",
    leafPalettes: ["moss", "olive", "sage"],
    leafStyles: ["scallop", "bunch", "round", "heart", "lobed", "trifoil", "pinnate"],
    flowerPalettes: ["clayBlush", "blushRose", "softBrick", "wineBerry"],
    flowerStyles: ["bell", "pom", "iris", "cup", "raceme"],
    stemStyles: ["gnarled", "vine", "twiggy"],
    stemPalettes: ["walnut", "charcoal", "cedar"],
  },
  {
    name: "wine",
    leafPalettes: ["copper", "autumn", "moss"],
    leafStyles: ["trifoil", "heart", "lobed", "fan"],
    flowerPalettes: ["wineBerry", "softBrick", "blushRose", "clayBlush"],
    flowerStyles: ["iris", "pom", "buttercup"],
    stemStyles: ["gnarled", "vine", "smooth"],
    stemPalettes: ["copperBark", "walnut", "charcoal"],
  },
  {
    name: "weeping",
    leafPalettes: ["sage", "olive", "seaGlass"],
    leafStyles: ["willow", "lance", "sickle"],
    flowerPalettes: ["ivoryGold", "honeyDew", "skyMist", "creamCoral"],
    flowerStyles: ["catkin", "raceme", "bell"],
    stemStyles: ["vine", "twiggy", "smooth"],
    stemPalettes: ["ash", "oliveWood", "walnut"],
  },
];

function pickHarmony(): LookHarmony {
  return pick(lookHarmonies);
}

function bestHarmonyFor(
  leafPalette?: LeafPalette,
  flowerPalette?: FlowerPalette,
  leafStyle?: LeafStyle,
  flowerStyle?: FlowerStyle,
): LookHarmony {
  if (leafPalette) {
    const withLeaf = lookHarmonies.filter((h) =>
      h.leafPalettes.includes(leafPalette),
    );
    if (withLeaf.length > 0) {
      const both = withLeaf.filter(
        (h) => !flowerPalette || h.flowerPalettes.includes(flowerPalette),
      );
      const pool = both.length > 0 ? both : withLeaf;
      // Prefer recipes that also match shape when possible.
      const shaped = pool.filter(
        (h) =>
          (!leafStyle || h.leafStyles.includes(leafStyle)) &&
          (!flowerStyle || h.flowerStyles.includes(flowerStyle)),
      );
      return pick(shaped.length > 0 ? shaped : pool);
    }
  }
  if (flowerPalette) {
    const withFlower = lookHarmonies.filter((h) =>
      h.flowerPalettes.includes(flowerPalette),
    );
    if (withFlower.length > 0) return pick(withFlower);
  }
  return pickHarmony();
}

function rollLookFromHarmony(
  h: LookHarmony,
): Pick<
  TreePhenotype,
  | "leafStyle"
  | "leafPalette"
  | "flowerStyle"
  | "flowerPalette"
  | "stemStyle"
  | "stemPalette"
> {
  return {
    leafStyle: pick(h.leafStyles),
    leafPalette: pick(h.leafPalettes),
    flowerStyle: pick(h.flowerStyles),
    flowerPalette: pick(h.flowerPalettes),
    stemStyle: pick(h.stemStyles),
    stemPalette: pick(h.stemPalettes),
  };
}

function applyHarmonyRest(
  ph: TreePhenotype,
  h: LookHarmony,
  keep: "leaf" | "flower" | "stem",
): void {
  if (keep !== "leaf") {
    ph.leafPalette = pick(h.leafPalettes);
    ph.leafStyle = pick(h.leafStyles);
  }
  if (keep !== "flower") {
    ph.flowerPalette = pick(h.flowerPalettes);
    ph.flowerStyle = pick(h.flowerStyles);
  }
  if (keep !== "stem") {
    ph.stemPalette = pick(h.stemPalettes);
    ph.stemStyle = pick(h.stemStyles);
  }
}

/**
 * Keep stem/leaf/flower combos botanical. `anchor` is preserved; the rest
 * is retuned. High random threshold can allow rare clashes when not forced.
 */
function constrainLook(
  ph: TreePhenotype,
  anchor: "leaf" | "flower" | "stem" | "any" = "any",
  force = false,
): void {
  if (!force && chanceAt(0.25)) return;

  const matched = lookHarmonies.some(
    (h) =>
      h.leafPalettes.includes(ph.leafPalette) &&
      h.flowerPalettes.includes(ph.flowerPalette) &&
      h.leafStyles.includes(ph.leafStyle) &&
      h.flowerStyles.includes(ph.flowerStyle) &&
      h.stemStyles.includes(ph.stemStyle) &&
      h.stemPalettes.includes(ph.stemPalette),
  );
  if (matched) return;

  if (anchor === "leaf") {
    const both = lookHarmonies.filter(
      (h) =>
        h.leafPalettes.includes(ph.leafPalette) &&
        h.leafStyles.includes(ph.leafStyle),
    );
    const h =
      both.length > 0
        ? pick(both)
        : bestHarmonyFor(ph.leafPalette, undefined, ph.leafStyle);
    applyHarmonyRest(ph, h, "leaf");
    return;
  }

  if (anchor === "flower") {
    const both = lookHarmonies.filter(
      (h) =>
        h.flowerPalettes.includes(ph.flowerPalette) &&
        h.flowerStyles.includes(ph.flowerStyle),
    );
    const h =
      both.length > 0
        ? pick(both)
        : bestHarmonyFor(
            undefined,
            ph.flowerPalette,
            undefined,
            ph.flowerStyle,
          );
    applyHarmonyRest(ph, h, "flower");
    return;
  }

  if (anchor === "stem") {
    const both = lookHarmonies.filter(
      (h) =>
        h.stemPalettes.includes(ph.stemPalette) &&
        h.stemStyles.includes(ph.stemStyle),
    );
    const h =
      both.length > 0
        ? pick(both)
        : (lookHarmonies.find((x) => x.stemPalettes.includes(ph.stemPalette)) ??
          pickHarmony());
    applyHarmonyRest(ph, h, "stem");
    return;
  }

  const look = rollLookFromHarmony(
    bestHarmonyFor(
      ph.leafPalette,
      ph.flowerPalette,
      ph.leafStyle,
      ph.flowerStyle,
    ),
  );
  Object.assign(ph, look);
}

type TreeKind = {
  id: Exclude<TreeTypeId, "custom">;
  branching: BranchPattern;
  phenotype: Partial<TreePhenotype> &
    Pick<
      TreePhenotype,
      | "leafStyle"
      | "leafPalette"
      | "flowerStyle"
      | "flowerPalette"
      | "stemStyle"
      | "stemPalette"
    >;
  habit?: Partial<GrowthHabit>;
};

const treeKinds: TreeKind[] = [
  {
    id: "oliveGrove",
    branching: "upright",
    phenotype: {
      leafStyle: "lance",
      leafPalette: "olive",
      flowerStyle: "star",
      flowerPalette: "ivoryGold",
      stemStyle: "smooth",
      stemPalette: "oliveWood",
      leafLength: 1.15,
      leafWidth: 0.95,
      leafDensity: 1,
      flowerSize: 0.85,
      flowerPetals: 0.4,
    },
  },
  {
    id: "copperMaple",
    branching: "open",
    phenotype: {
      leafStyle: "lobed",
      leafPalette: "copper",
      flowerStyle: "pom",
      flowerPalette: "softBrick",
      stemStyle: "gnarled",
      stemPalette: "copperBark",
      leafLength: 1.25,
      leafWidth: 1.2,
      leafDensity: 0.85,
      flowerSize: 0.75,
      flowerPetals: 0.35,
    },
    habit: { leanStrength: 0.28, fanSkew: 0.35 },
  },
  {
    id: "seaWillow",
    branching: "willow",
    phenotype: {
      leafStyle: "willow",
      leafPalette: "seaGlass",
      flowerStyle: "catkin",
      flowerPalette: "ivoryGold",
      stemStyle: "vine",
      stemPalette: "ash",
      leafLength: 1.75,
      leafWidth: 0.7,
      leafDensity: 1.4,
      flowerSize: 1.15,
      flowerPetals: 0.4,
    },
  },
  {
    id: "jadeNeedle",
    branching: "dense",
    phenotype: {
      leafStyle: "needle",
      leafPalette: "jade",
      flowerStyle: "cone",
      flowerPalette: "honeyDew",
      stemStyle: "bamboo",
      stemPalette: "cedar",
      leafLength: 1.25,
      leafWidth: 0.75,
      leafDensity: 1.4,
      flowerSize: 0.7,
      flowerPetals: 0.25,
    },
  },
  {
    id: "autumnFan",
    branching: "bushy",
    phenotype: {
      leafStyle: "fan",
      leafPalette: "autumn",
      flowerStyle: "buttercup",
      flowerPalette: "butterAmber",
      stemStyle: "gnarled",
      stemPalette: "walnut",
      leafLength: 1.2,
      leafWidth: 1.4,
      leafDensity: 0.85,
      flowerSize: 1.05,
      flowerPetals: 0.6,
    },
  },
  {
    id: "chalkOrchard",
    branching: "wand",
    phenotype: {
      leafStyle: "spatulate",
      leafPalette: "sage",
      flowerStyle: "cup",
      flowerPalette: "snowBell",
      stemStyle: "birch",
      stemPalette: "paleBirch",
      leafLength: 1.15,
      leafWidth: 0.95,
      leafDensity: 0.9,
      flowerSize: 1.15,
      flowerPetals: 0.7,
    },
  },
  {
    id: "citrusBough",
    branching: "open",
    phenotype: {
      leafStyle: "diamond",
      leafPalette: "jade",
      flowerStyle: "daisy",
      flowerPalette: "citrusBloom",
      stemStyle: "smooth",
      stemPalette: "oliveWood",
      leafLength: 1.3,
      leafWidth: 0.75,
      leafDensity: 1,
      flowerSize: 1.2,
      flowerPetals: 0.55,
    },
  },
  {
    id: "mossLantern",
    branching: "dense",
    phenotype: {
      leafStyle: "bunch",
      leafPalette: "moss",
      flowerStyle: "bell",
      flowerPalette: "clayBlush",
      stemStyle: "twiggy",
      stemPalette: "charcoal",
      leafLength: 1.25,
      leafWidth: 1.4,
      leafDensity: 1.45,
      flowerSize: 0.95,
      flowerPetals: 0.45,
    },
  },
  {
    id: "wineThicket",
    branching: "bushy",
    phenotype: {
      leafStyle: "trifoil",
      leafPalette: "copper",
      flowerStyle: "iris",
      flowerPalette: "wineBerry",
      stemStyle: "vine",
      stemPalette: "copperBark",
      leafLength: 1.1,
      leafWidth: 1.15,
      leafDensity: 1.05,
      flowerSize: 1.1,
      flowerPetals: 0.65,
    },
  },
];

const branchingProfiles: {
  name: BranchPattern;
  config: Partial<ColonizationConfig>;
}[] = [
  {
    name: "upright",
    config: {
      branchPattern: "upright",
      minDistance: 11,
      segmentLength: 12,
      maxDistance: 72,
      maxTips: 11,
      maxChildren: 2,
      branchSpread: 0.58,
      forkEvery: 2,
      tipForkChance: 0.4,
      inertia: 0.32,
      attractorCount: 150,
      cloudRadius: 100,
    },
  },
  {
    name: "wand",
    config: {
      branchPattern: "wand",
      minDistance: 12,
      segmentLength: 13,
      maxDistance: 78,
      maxTips: 8,
      maxChildren: 2,
      branchSpread: 0.48,
      forkEvery: 3,
      tipForkChance: 0.34,
      inertia: 0.4,
      attractorCount: 130,
      cloudRadius: 105,
    },
  },
  {
    name: "bushy",
    config: {
      branchPattern: "bushy",
      minDistance: 9,
      segmentLength: 10,
      maxDistance: 62,
      maxTips: 14,
      maxChildren: 2,
      branchSpread: 0.7,
      forkEvery: 2,
      tipForkChance: 0.46,
      inertia: 0.2,
      attractorCount: 170,
      cloudRadius: 90,
    },
  },
  {
    name: "willow",
    config: {
      branchPattern: "willow",
      minDistance: 10,
      segmentLength: 12,
      maxDistance: 85,
      maxTips: 12,
      maxChildren: 2,
      branchSpread: 0.64,
      forkEvery: 2,
      tipForkChance: 0.38,
      inertia: 0.45,
      attractorCount: 155,
      cloudRadius: 120,
    },
  },
  {
    name: "dense",
    config: {
      branchPattern: "dense",
      minDistance: 8,
      segmentLength: 9,
      maxDistance: 55,
      maxTips: 16,
      maxChildren: 3,
      branchSpread: 0.52,
      forkEvery: 1,
      tipForkChance: 0.5,
      inertia: 0.25,
      attractorCount: 180,
      cloudRadius: 75,
    },
  },
  {
    name: "open",
    config: {
      branchPattern: "open",
      minDistance: 13,
      segmentLength: 14,
      maxDistance: 90,
      maxTips: 10,
      maxChildren: 2,
      branchSpread: 0.72,
      forkEvery: 2,
      tipForkChance: 0.38,
      inertia: 0.36,
      attractorCount: 140,
      cloudRadius: 130,
    },
  },
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function snapStep(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

/**
 * Roll inside [min,max], centered on `center` (default mid).
 * `randomThreshold` shrinks the band and softens end-bias.
 * The high and low sides open on their own, so a center near the old
 * default can still reach a raised slider max without the floor coming along.
 */
function rollExtreme(
  min: number,
  max: number,
  step = 0,
  center?: number,
): number {
  const t = clamp(randomThreshold, 0, 1);
  const mid = clamp(center ?? (min + max) * 0.5, min, max);
  if (t <= 0.001) return clamp(snapStep(mid, step), min, max);

  const open = 0.12 + t * 0.88;
  const lo = mid - (mid - min) * open;
  const hi = mid + (max - mid) * open;

  let u = Math.random();
  // Only slam toward band edges when threshold is high.
  if (t > 0.55 && Math.random() < (t - 0.55) * 0.9) {
    u = Math.random() < 0.5 ? 0 : 1;
  } else if (t > 0.35 && Math.random() < (t - 0.35) * 0.7) {
    u = u < 0.5 ? u * u : 1 - (1 - u) * (1 - u);
  } else {
    // Mild: prefer center of the allowed band.
    u = (Math.random() + Math.random()) * 0.5;
  }

  let v = lo + u * (hi - lo);
  v = snapStep(v, step);
  return clamp(v, min, max);
}

/**
 * A random crown has to be able to fork. The slider floors still allow a
 * one-child chain, two tips, and a cloud that sits outside the pull radius;
 * those read as a single stroke. Lift just those combinations, and let the
 * raised slider tops through when the roll actually reached them.
 */
function harmonizeRandomGrowth(cfg: ColonizationConfig): void {
  cfg.maxChildren = clamp(Math.max(2, cfg.maxChildren), 2, 12);
  // Extra nodes have to become new tips. A big skeleton with a handful of
  // tips spends the surplus on long unbranched runs.
  const minTips = Math.min(84, Math.max(8, Math.round(cfg.maxNodes / 12)));
  cfg.maxTips = clamp(Math.max(cfg.maxTips, minTips), 8, 84);
  cfg.branchSpread = clamp(Math.max(0.4, cfg.branchSpread), 0.4, 1.45);
  cfg.tipForkChance = clamp(Math.max(0.32, cfg.tipForkChance), 0.32, 0.95);
  cfg.inertia = clamp(Math.min(0.58, cfg.inertia), 0.02, 0.58);
  cfg.forkEvery = clamp(Math.min(3, Math.round(cfg.forkEvery)), 1, 5);
  // Leaves have to keep up with the crown. A slow spawn leaves the new limbs bare.
  cfg.leafSpawnRate = clamp(Math.max(1, cfg.leafSpawnRate), 1, 2.2);
  cfg.leafGrowRate = clamp(Math.max(0.02, cfg.leafGrowRate), 0.02, 0.12);

  const reachGap = 36;
  if (cfg.maxDistance < cfg.minDistance + reachGap) {
    const raised = cfg.minDistance + reachGap;
    if (raised <= 180) cfg.maxDistance = raised;
    else cfg.minDistance = 180 - reachGap;
  }
  cfg.maxDistance = clamp(cfg.maxDistance, 24, 180);
  cfg.minDistance = clamp(
    Math.min(cfg.minDistance, cfg.maxDistance - reachGap),
    3,
    32,
  );

  const minNodes = Math.min(2100, Math.max(80, cfg.maxTips * 6));
  cfg.maxNodes =
    Math.round(clamp(Math.max(cfg.maxNodes, minNodes), 40, 2100) / 10) * 10;

  const cloudLo = clamp(cfg.maxDistance * 0.85, 30, 780);
  const cloudHi = clamp(Math.max(cloudLo, cfg.maxDistance * 3.2), 30, 780);
  cfg.cloudRadius =
    Math.round(clamp(cfg.cloudRadius, cloudLo, cloudHi) / 2) * 2;

  const attractLo = clamp(Math.round(cfg.maxTips * 8), 30, 1020);
  const attractHi = clamp(
    Math.max(attractLo, Math.round(cfg.cloudRadius * 1.6)),
    30,
    1020,
  );
  cfg.attractorCount =
    Math.round(clamp(cfg.attractorCount, attractLo, attractHi) / 5) * 5;
  cfg.attractorCount = clamp(cfg.attractorCount, 30, 1020);
}

/** Random crowns keep enough density to dress the outer branches, not only the interior. */
function harmonizeRandomFoliage(ph: TreePhenotype): void {
  ph.leafDensity = clamp(Math.max(1.15, ph.leafDensity), 1.15, 2.8);
  const minWid = Math.max(0.9, ph.leafLength * 0.7);
  ph.leafWidth = clamp(Math.max(ph.leafWidth, minWid), 0.9, 2.8);
}

function harmonizeRandomHabit(habit: GrowthHabit): void {
  habit.leftSpread = clamp(Math.max(habit.leftSpread, 0.55), 0.55, 2.4);
  habit.rightSpread = clamp(Math.max(habit.rightSpread, 0.55), 0.55, 2.4);
}

/** Chance gates that open more as threshold rises. */
function chanceAt(baseAtFull: number): boolean {
  return Math.random() < baseAtFull * clamp(randomThreshold, 0, 1);
}

/** Scale a multiplier jitter by threshold (1 = no change at t=0). */
function jitterMul(base: number, amp: number): number {
  const t = clamp(randomThreshold, 0, 1);
  return base * (1 + (Math.random() * 2 - 1) * amp * t);
}

/** A mark that already fills a lot of the crown. Random size stays nearer its natural scale. */
function bulkyLeaf(style: LeafStyle): boolean {
  return (
    leafIsGroup(style) ||
    style === "fan" ||
    style === "lobed" ||
    style === "heart" ||
    style === "round" ||
    style === "scallop" ||
    style === "trifoil"
  );
}

function showyFlower(style: FlowerStyle): boolean {
  return (
    style === "bell" ||
    style === "cup" ||
    style === "raceme" ||
    style === "catkin" ||
    style === "pom" ||
    style === "cone"
  );
}

type StyleNumbers = Pick<
  TreePhenotype,
  | "leafLength"
  | "leafWidth"
  | "leafDensity"
  | "flowerSize"
  | "flowerDensity"
  | "flowerPetals"
  | "stemGirth"
>;

/**
 * Keep a random look inside a band that matches the leaf.
 * Width follows that leaf's proportion. Big marks and showy flowers
 * get a lower ceiling. The sliders can still go further by hand.
 */
function fitStyleNumbers(
  leafStyle: LeafStyle,
  flowerStyle: FlowerStyle,
  guess: StyleNumbers,
): StyleNumbers {
  const aspect = leafShapeAspect[leafStyle];
  const bulky = bulkyLeaf(leafStyle);
  const leafLength = clamp(
    snapStep(guess.leafLength, 0.05),
    0.45,
    bulky ? 1.25 : 1.7,
  );
  const ratio = aspect.wid / Math.max(aspect.len, 0.2);
  const leafWidth = clamp(
    snapStep(leafLength * ratio * 0.82 + guess.leafWidth * 0.18, 0.05),
    0.6,
    bulky ? 1.25 : 1.55,
  );
  const leafDensity = clamp(
    snapStep(guess.leafDensity, 0.05),
    0.45,
    bulky ? 1.15 : 1.6,
  );
  const flowerMax =
    (showyFlower(flowerStyle) ? 1.15 : 1.4) * (leafLength > 1.3 ? 0.85 : 1);
  const flowerSize = clamp(
    snapStep(Math.min(guess.flowerSize, flowerMax), 0.05),
    0.4,
    flowerMax,
  );
  const flowerMaxDens = leafDensity > 1.15 ? 1.1 : 1.45;
  const flowerDensity = clamp(
    snapStep(Math.min(guess.flowerDensity, flowerMaxDens), 0.05),
    0.35,
    flowerMaxDens,
  );
  return {
    leafLength,
    leafWidth,
    leafDensity,
    flowerSize,
    flowerDensity,
    flowerPetals: clamp(snapStep(guess.flowerPetals, 0.05), 0, 1),
    stemGirth: clamp(snapStep(guess.stemGirth, 0.05), 0.75, 1.35),
  };
}

function pickPhenotype(): TreePhenotype {
  // Prefer curated kinds; remix looks inside a matching harmony.
  if (!chanceAt(0.55) || Math.random() < 0.55) {
    const kind = pick(treeKinds);
    const h = bestHarmonyFor(
      kind.phenotype.leafPalette,
      kind.phenotype.flowerPalette,
      kind.phenotype.leafStyle,
      kind.phenotype.flowerStyle,
    );
    const look = chanceAt(0.5)
      ? rollLookFromHarmony(h)
      : {
          leafStyle: kind.phenotype.leafStyle,
          leafPalette: kind.phenotype.leafPalette,
          flowerStyle: kind.phenotype.flowerStyle,
          flowerPalette: kind.phenotype.flowerPalette,
          stemStyle: kind.phenotype.stemStyle,
          stemPalette: kind.phenotype.stemPalette,
        };
    // Mild within-harmony jitter.
    if (chanceAt(0.35)) look.leafStyle = pick(h.leafStyles);
    if (chanceAt(0.35)) look.leafPalette = pick(h.leafPalettes);
    if (chanceAt(0.35)) look.flowerStyle = pick(h.flowerStyles);
    if (chanceAt(0.35)) look.flowerPalette = pick(h.flowerPalettes);
    if (chanceAt(0.35)) look.stemStyle = pick(h.stemStyles);
    if (chanceAt(0.35)) look.stemPalette = pick(h.stemPalettes);

    const s = leafShapeAspect[look.leafStyle];
    const baseLen = kind.phenotype.leafLength ?? s.len;
    const baseWid = kind.phenotype.leafWidth ?? s.wid;
    const baseDens = kind.phenotype.leafDensity ?? s.dens;
    const baseFlower = kind.phenotype.flowerSize ?? 1;
    const numbers = fitStyleNumbers(look.leafStyle, look.flowerStyle, {
      leafLength: jitterMul(baseLen, 0.4),
      leafWidth: jitterMul(baseWid, 0.3),
      leafDensity: jitterMul(baseDens, 0.3),
      flowerSize: jitterMul(baseFlower, 0.3),
      flowerDensity: jitterMul(kind.phenotype.flowerDensity ?? 1, 0.3),
      flowerPetals: rollExtreme(0.2, 0.85, 0.05, kind.phenotype.flowerPetals ?? 0.5),
      stemGirth: kind.phenotype.stemGirth ?? 1,
    });
    return {
      ...defaultPhenotype,
      ...kind.phenotype,
      ...look,
      ...numbers,
    };
  }

  const look = rollLookFromHarmony(pickHarmony());
  const s = leafShapeAspect[look.leafStyle];
  return {
    ...look,
    ...fitStyleNumbers(look.leafStyle, look.flowerStyle, {
      leafLength: s.len * (0.82 + Math.random() * 0.36),
      leafWidth: s.wid * (0.88 + Math.random() * 0.24),
      leafDensity: s.dens * (0.82 + Math.random() * 0.3),
      flowerSize: 0.8 + Math.random() * 0.5,
      flowerDensity: 0.65 + Math.random() * 0.6,
      flowerPetals: 0.2 + Math.random() * 0.6,
      stemGirth: 0.85 + Math.random() * 0.45,
    }),
  };
}

function applyTreeKind(kind: TreeKind, jitter = false): void {
  activeTreeType = kind.id;
  const cfg =
    branchingProfiles.find((p) => p.name === kind.branching)?.config ?? {};
  const keepImmortal = liveConfig.immortal;
  Object.assign(liveConfig, defaultConfig, cfg);
  liveConfig.immortal = keepImmortal;
  if (jitter) {
    const c = { ...defaultConfig, ...cfg };
    liveConfig.upwardBias = rollExtreme(0.02, 0.98, 0.01, c.upwardBias);
    liveConfig.segmentLength = rollExtreme(4, 28, 0.5, c.segmentLength);
    liveConfig.branchSpread = rollExtreme(0.15, 1.45, 0.01, c.branchSpread);
    liveConfig.tipForkChance = rollExtreme(0.02, 0.95, 0.01, c.tipForkChance);
    liveConfig.inertia = rollExtreme(0.02, 0.92, 0.01, c.inertia);
    liveConfig.maxTips = Math.round(rollExtreme(2, 84, 1, c.maxTips));
    liveConfig.maxNodes = Math.round(rollExtreme(40, 2100, 10, c.maxNodes));
    liveConfig.attractorCount = Math.round(
      rollExtreme(30, 1020, 5, c.attractorCount),
    );
    liveConfig.cloudRadius = rollExtreme(30, 780, 2, c.cloudRadius);
    liveConfig.minDistance = rollExtreme(3, 32, 0.5, c.minDistance);
    liveConfig.maxDistance = rollExtreme(24, 180, 1, c.maxDistance);
    liveConfig.maxChildren = Math.round(rollExtreme(1, 12, 1, c.maxChildren));
    liveConfig.forkEvery = Math.round(rollExtreme(1, 5, 1, c.forkEvery));
    randomizeTimingInto(liveConfig);
    harmonizeRandomGrowth(liveConfig);
  }
  Object.assign(livePhenotype, defaultPhenotype, kind.phenotype);
  if (jitter) {
    const h = bestHarmonyFor(
      kind.phenotype.leafPalette,
      kind.phenotype.flowerPalette,
      kind.phenotype.leafStyle,
      kind.phenotype.flowerStyle,
    );
    const look = chanceAt(0.55)
      ? rollLookFromHarmony(h)
      : {
          leafStyle: kind.phenotype.leafStyle,
          leafPalette: kind.phenotype.leafPalette,
          flowerStyle: kind.phenotype.flowerStyle,
          flowerPalette: kind.phenotype.flowerPalette,
          stemStyle: kind.phenotype.stemStyle,
          stemPalette: kind.phenotype.stemPalette,
        };
    if (chanceAt(0.4)) look.leafStyle = pick(h.leafStyles);
    if (chanceAt(0.4)) look.leafPalette = pick(h.leafPalettes);
    if (chanceAt(0.4)) look.flowerStyle = pick(h.flowerStyles);
    if (chanceAt(0.4)) look.flowerPalette = pick(h.flowerPalettes);
    if (chanceAt(0.4)) look.stemStyle = pick(h.stemStyles);
    if (chanceAt(0.4)) look.stemPalette = pick(h.stemPalettes);
    Object.assign(livePhenotype, look);
    const s = leafShapeAspect[livePhenotype.leafStyle];
    livePhenotype.leafLength = clamp(
      jitterMul(kind.phenotype.leafLength ?? s.len, 0.7),
      0.25,
      3.2,
    );
    livePhenotype.leafWidth = clamp(
      jitterMul(kind.phenotype.leafWidth ?? s.wid, 0.8),
      0.15,
      2.8,
    );
    livePhenotype.leafDensity = clamp(
      jitterMul(kind.phenotype.leafDensity ?? s.dens, 0.75),
      0.2,
      2.8,
    );
    livePhenotype.flowerSize = clamp(
      jitterMul(kind.phenotype.flowerSize ?? 1, 0.8),
      0.25,
      3,
    );
    livePhenotype.flowerPetals = rollExtreme(
      0,
      1,
      0.05,
      kind.phenotype.flowerPetals ?? 0.5,
    );
    harmonizeRandomFoliage(livePhenotype);
    if (
      livePhenotype.leafStyle !== kind.phenotype.leafStyle ||
      livePhenotype.flowerPalette !== kind.phenotype.flowerPalette ||
      chanceAt(0.55)
    ) {
      activeTreeType = "custom";
    }
  }
  if (kind.habit) Object.assign(liveHabit, kind.habit);
  syncLookSelects();
  rebuildSliders();
  applyLiveToAll();
}

function applyLiveToTree(t: SpaceColonizationTree): void {
  const prevFlowerSize = t.phenotype.flowerSize;
  const prevPetals = t.phenotype.flowerPetals;
  const prevLeafLength = t.phenotype.leafLength;
  const prevLeafWidth = t.phenotype.leafWidth;
  Object.assign(t.config, liveConfig);
  Object.assign(t.phenotype, livePhenotype);

  const lenRatio =
    prevLeafLength > 1e-6 ? livePhenotype.leafLength / prevLeafLength : 1;
  const widRatio =
    prevLeafWidth > 1e-6 ? livePhenotype.leafWidth / prevLeafWidth : 1;
  if (Math.abs(lenRatio - 1) > 1e-4 || Math.abs(widRatio - 1) > 1e-4) {
    for (const leaf of t.leaves) {
      leaf.length *= lenRatio;
      leaf.width *= widRatio;
    }
  }

  // Size / petal bias are baked into each blossom at spawn — retarget live ones.
  const sizeRatio =
    prevFlowerSize > 1e-6 ? livePhenotype.flowerSize / prevFlowerSize : 1;
  if (Math.abs(sizeRatio - 1) > 1e-4) {
    for (const f of t.flowers) f.size *= sizeRatio;
  }
  if (prevPetals !== livePhenotype.flowerPetals) {
    const petalBias = Math.floor(livePhenotype.flowerPetals * 2);
    for (const f of t.flowers) {
      const host = t.nodes[f.node];
      if (!host) continue;
      f.petals = 4 + ((f.node + host.birth + petalBias) % 3);
    }
  }
}

function applyLiveToAll(): void {
  for (const t of trees) applyLiveToTree(t);
}

function syncLookSelects(): void {
  treeTypeEl.value = activeTreeType;
  stemStyleEl.value = livePhenotype.stemStyle;
  stemPaletteEl.value = livePhenotype.stemPalette;
  leafStyleEl.value = livePhenotype.leafStyle;
  leafPaletteEl.value = livePhenotype.leafPalette;
  leafStyleAltEl.value = livePhenotype.leafStyle;
  leafPaletteAltEl.value = livePhenotype.leafPalette;
  flowerStyleEl.value = livePhenotype.flowerStyle;
  flowerPaletteEl.value = livePhenotype.flowerPalette;
  refreshCustomSelects();
}

/** Custom minimal dropdowns — keep native <select> for value + change events. */
type CustomSelect = {
  select: HTMLSelectElement;
  root: HTMLElement;
  trigger: HTMLButtonElement;
  menu: HTMLElement;
  refresh: () => void;
  close: () => void;
};

const customSelects: CustomSelect[] = [];

function closeAllCustomSelects(except?: CustomSelect): void {
  for (const cs of customSelects) {
    if (cs !== except) cs.close();
  }
  if (!customSelects.some((cs) => !cs.menu.hidden)) {
    controlsEl.classList.remove("select-open");
  }
}

function refreshCustomSelects(): void {
  for (const cs of customSelects) cs.refresh();
}

function positionCSelectMenu(trigger: HTMLElement, menu: HTMLElement): void {
  const r = trigger.getBoundingClientRect();
  const maxH = Math.min(280, window.innerHeight - r.bottom - 12);
  menu.style.position = "fixed";
  menu.style.left = `${Math.round(r.left)}px`;
  menu.style.top = `${Math.round(r.bottom + 4)}px`;
  menu.style.width = `${Math.round(r.width)}px`;
  menu.style.right = "auto";
  menu.style.maxHeight = `${Math.max(120, maxH)}px`;
}

const LOOK_SELECT_PREVIEW: Record<
  string,
  | "stemStyle"
  | "stemPalette"
  | "leafStyle"
  | "leafPalette"
  | "flowerStyle"
  | "flowerPalette"
> = {
  "stem-style": "stemStyle",
  "stem-palette": "stemPalette",
  "leaf-style": "leafStyle",
  "leaf-palette": "leafPalette",
  "leaf-style-alt": "leafStyle",
  "leaf-palette-alt": "leafPalette",
  "flower-style": "flowerStyle",
  "flower-palette": "flowerPalette",
};

/** Snapshot so option-hover previews can roll back if not committed. */
let lookHoverPreview: {
  selectId: string;
  phenotype: TreePhenotype;
  config: ColonizationConfig;
  habit: GrowthHabit;
  treeType: TreeTypeId;
} | null = null;

function beginLookHoverPreview(selectId: string): void {
  if (lookHoverPreview?.selectId === selectId) return;
  lookHoverPreview = {
    selectId,
    phenotype: { ...livePhenotype },
    config: { ...liveConfig },
    habit: { ...liveHabit },
    treeType: activeTreeType,
  };
}

function previewLookValue(select: HTMLSelectElement, value: string): void {
  beginLookHoverPreview(select.id);

  if (select.id === "tree-type") {
    if (value === "custom") {
      if (lookHoverPreview) {
        Object.assign(livePhenotype, lookHoverPreview.phenotype);
        Object.assign(liveConfig, lookHoverPreview.config);
        Object.assign(liveHabit, lookHoverPreview.habit);
      }
      applyLiveToAll();
      return;
    }
    const kind = treeKinds.find((k) => k.id === value);
    if (!kind) return;
    const cfg =
      branchingProfiles.find((p) => p.name === kind.branching)?.config ?? {};
    const keepImmortal = liveConfig.immortal;
    Object.assign(liveConfig, defaultConfig, cfg);
    liveConfig.immortal = keepImmortal;
    Object.assign(livePhenotype, defaultPhenotype, kind.phenotype);
    if (kind.habit) Object.assign(liveHabit, defaultHabit, kind.habit);
    applyLiveToAll();
    return;
  }

  const key = LOOK_SELECT_PREVIEW[select.id];
  if (!key) return;
  (livePhenotype as unknown as Record<string, string>)[key] = value;
  applyLiveToAll();
}

function endLookHoverPreview(commit: boolean): void {
  if (!lookHoverPreview) return;
  if (!commit) {
    Object.assign(livePhenotype, lookHoverPreview.phenotype);
    Object.assign(liveConfig, lookHoverPreview.config);
    Object.assign(liveHabit, lookHoverPreview.habit);
    activeTreeType = lookHoverPreview.treeType;
    applyLiveToAll();
  }
  lookHoverPreview = null;
}

function enhanceSelect(select: HTMLSelectElement): void {
  // Drop stale widgets from HMR / double-init so menus don't stack.
  const prev = select.parentElement?.querySelectorAll(":scope > .cselect");
  prev?.forEach((node) => node.remove());
  select.dataset.enhanced = "1";
  select.classList.add("cselect-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const root = document.createElement("div");
  root.className = "cselect";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "cselect-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.className = "cselect-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  const canPreview =
    select.id === "tree-type" || Boolean(LOOK_SELECT_PREVIEW[select.id]);

  const refresh = (): void => {
    const selected = select.selectedOptions[0];
    trigger.textContent = selected?.textContent?.trim() ?? "";
    for (const btn of menu.querySelectorAll<HTMLButtonElement>(
      ".cselect-option",
    )) {
      const on = btn.dataset.value === select.value;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-selected", String(on));
    }
  };

  const close = (): void => {
    endLookHoverPreview(false);
    root.classList.remove("open");
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    menu.style.position = "";
    menu.style.left = "";
    menu.style.top = "";
    menu.style.width = "";
    menu.style.right = "";
    menu.style.maxHeight = "";
    if (menu.parentElement !== root) root.appendChild(menu);
    if (customSelects.every((cs) => cs.menu.hidden)) {
      controlsEl.classList.remove("select-open");
    }
    refresh();
  };

  for (const opt of Array.from(select.options)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cselect-option";
    btn.setAttribute("role", "option");
    btn.dataset.value = opt.value;
    btn.textContent = opt.textContent?.trim() ?? opt.value;
    if (canPreview) {
      btn.addEventListener("pointerenter", () => {
        previewLookValue(select, opt.value);
        trigger.textContent = opt.textContent?.trim() ?? opt.value;
      });
    }
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      endLookHoverPreview(true);
      if (select.value !== opt.value) {
        select.value = opt.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        previewLookValue(select, opt.value);
        endLookHoverPreview(true);
        applyLiveToAll();
      }
      refresh();
      close();
    });
    menu.append(btn);
  }

  menu.addEventListener("pointerleave", () => {
    if (!canPreview || menu.hidden) return;
    endLookHoverPreview(false);
    refresh();
  });

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const willOpen = menu.hidden;
    closeAllCustomSelects();
    if (willOpen) {
      root.classList.add("open");
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      controlsEl.classList.add("select-open");
      document.body.appendChild(menu);
      positionCSelectMenu(trigger, menu);
      const selected = menu.querySelector<HTMLButtonElement>(
        ".cselect-option.selected",
      );
      if (selected) {
        const top = selected.offsetTop - menu.clientHeight * 0.35;
        menu.scrollTop = Math.max(0, top);
      }
    }
  });

  root.append(trigger, menu);
  select.insertAdjacentElement("afterend", root);

  const cs: CustomSelect = { select, root, trigger, menu, refresh, close };
  customSelects.push(cs);
  refresh();
}

function enhanceAllSelects(): void {
  // Rebuild registry — Vite HMR can re-run this module.
  customSelects.length = 0;
  for (const el of controlsEl.querySelectorAll<HTMLSelectElement>("select")) {
    enhanceSelect(el);
  }
}

document.addEventListener("pointerdown", (e) => {
  const t = e.target as Node | null;
  if (!t) return;
  if (customSelects.some((cs) => cs.root.contains(t) || cs.menu.contains(t))) {
    return;
  }
  closeAllCustomSelects();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllCustomSelects();
});

const branchPatternLabel: Record<BranchPattern, string> = {
  upright: "erguido",
  wand: "vara",
  bushy: "mata",
  willow: "sauce",
  dense: "tupido",
  open: "abierto",
};

const stemStyleLabel: Record<string, string> = {
  smooth: "liso",
  gnarled: "nudoso",
  vine: "enredadera",
  reed: "junco",
  bamboo: "bambú",
  birch: "abedul",
  twiggy: "ramoso",
};

const stemPaletteLabel: Record<string, string> = {
  ash: "ceniza",
  walnut: "nogal",
  cedar: "cedro",
  oliveWood: "olivo",
  copperBark: "cobre",
  paleBirch: "abedul",
  charcoal: "carbón",
};

const leafStyleLabel: Record<string, string> = {
  oval: "ovalada",
  lance: "lanceolada",
  teardrop: "lágrima",
  needle: "aguja",
  round: "redonda",
  heart: "corazón",
  lobed: "lobulada",
  fan: "abanico",
  sickle: "en hoz",
  diamond: "puntiaguda",
  spatulate: "espatulada",
  arrow: "en flecha",
  scallop: "festoneada",
  trifoil: "trébol",
  spray: "ramillete",
  bunch: "manojo",
  willow: "sauce",
  pinnate: "compuesta",
  frond: "fronda",
};

const leafPaletteLabel: Record<string, string> = {
  olive: "olivo",
  sage: "salvia",
  jade: "jade",
  copper: "cobre",
  autumn: "otoño",
  seaGlass: "verde mar",
  moss: "musgo",
};

const flowerStyleLabel: Record<string, string> = {
  daisy: "margarita",
  cup: "copa",
  bell: "campana",
  star: "estrella",
  tube: "tubular",
  pom: "pompón",
  iris: "iris",
  buttercup: "ranúnculo",
  catkin: "amento",
  raceme: "racimo",
  cone: "cono",
};

const flowerPaletteLabel: Record<string, string> = {
  creamCoral: "coral",
  butterAmber: "ámbar",
  blushRose: "rosa",
  peachApricot: "durazno",
  ivoryGold: "marfil",
  softBrick: "terracota",
  snowBell: "nieve",
  citrusBloom: "limón",
  wineBerry: "vino",
  skyMist: "celeste",
  clayBlush: "arcilla",
  honeyDew: "miel",
};

function lookWord(table: Record<string, string>, key: string): string {
  return table[key] ?? key;
}

function updateStyleLabel(t?: SpaceColonizationTree): void {
  const lean = t?.habitLabel() ?? "—";
  const ph = t?.phenotype ?? livePhenotype;
  const pattern =
    branchPatternLabel[t?.config.branchPattern ?? liveConfig.branchPattern];
  styleLabel = `${pattern} · ${lean} · ${lookWord(stemPaletteLabel, ph.stemPalette)} ${lookWord(stemStyleLabel, ph.stemStyle)} · ${lookWord(leafPaletteLabel, ph.leafPalette)} ${lookWord(leafStyleLabel, ph.leafStyle)} · ${lookWord(flowerStyleLabel, ph.flowerStyle)} ${lookWord(flowerPaletteLabel, ph.flowerPalette)}`;
}

function createTreeAt(x: number, y: number): SpaceColonizationTree {
  const random = spawnSource() === "random";
  let config: ColonizationConfig;
  let phenotype: TreePhenotype;
  let habit: GrowthHabit;

  if (random) {
    const kind =
      !chanceAt(0.7) || Math.random() < 0.65 ? pick(treeKinds) : null;
    const branch = kind
      ? (branchingProfiles.find((p) => p.name === kind.branching) ??
        pickBranching())
      : pickBranching();
    const base = { ...defaultConfig, ...branch.config };
    config = {
      ...base,
      upwardBias: rollExtreme(0.02, 0.98, 0.01, base.upwardBias),
      segmentLength: rollExtreme(4, 28, 0.5, base.segmentLength),
      branchSpread: rollExtreme(0.15, 1.45, 0.01, base.branchSpread),
      tipForkChance: rollExtreme(0.02, 0.95, 0.01, base.tipForkChance),
      inertia: rollExtreme(0.02, 0.92, 0.01, base.inertia),
      maxTips: Math.round(rollExtreme(2, 84, 1, base.maxTips)),
      cloudRadius: rollExtreme(30, 780, 2, base.cloudRadius),
      attractorCount: Math.round(rollExtreme(30, 1020, 5, base.attractorCount)),
      forkEvery: Math.round(rollExtreme(1, 5, 1, base.forkEvery)),
    };
    randomizeTimingInto(config);
    harmonizeRandomGrowth(config);
    phenotype = pickPhenotype();
    if (kind) {
      const h = bestHarmonyFor(
        kind.phenotype.leafPalette,
        kind.phenotype.flowerPalette,
        kind.phenotype.leafStyle,
        kind.phenotype.flowerStyle,
      );
      const look = chanceAt(0.45)
        ? rollLookFromHarmony(h)
        : {
            leafStyle: kind.phenotype.leafStyle,
            leafPalette: kind.phenotype.leafPalette,
            flowerStyle: kind.phenotype.flowerStyle,
            flowerPalette: kind.phenotype.flowerPalette,
            stemStyle: kind.phenotype.stemStyle,
            stemPalette: kind.phenotype.stemPalette,
          };
      const s = leafShapeAspect[look.leafStyle];
      phenotype = {
        ...phenotype,
        ...kind.phenotype,
        ...look,
        leafLength: clamp(
          jitterMul(kind.phenotype.leafLength ?? s.len, 0.7),
          0.25,
          3.2,
        ),
        leafWidth: clamp(
          jitterMul(kind.phenotype.leafWidth ?? s.wid, 0.8),
          0.15,
          2.8,
        ),
        leafDensity: clamp(
          jitterMul(kind.phenotype.leafDensity ?? s.dens, 0.75),
          0.2,
          2.8,
        ),
        flowerSize: clamp(
          jitterMul(kind.phenotype.flowerSize ?? 1, 0.8),
          0.25,
          3,
        ),
        flowerPetals: rollExtreme(
          0,
          1,
          0.05,
          kind.phenotype.flowerPetals ?? 0.5,
        ),
      };
      constrainLook(phenotype, "any", true);
    }
    const rolled = makeRandomHabit();
    const t = clamp(randomThreshold, 0, 1);
    habit = {
      lean: rolled.lean * t,
      leanStrength:
        defaultHabit.leanStrength +
        (rolled.leanStrength - defaultHabit.leanStrength) * t,
      seedAngle:
        defaultHabit.seedAngle +
        (rolled.seedAngle - defaultHabit.seedAngle) * t,
      rootXFrac: rolled.rootXFrac,
      rootYFrac: rolled.rootYFrac,
      sideBias: rolled.sideBias * t,
      leftSpread:
        defaultHabit.leftSpread +
        (rolled.leftSpread - defaultHabit.leftSpread) * t,
      rightSpread:
        defaultHabit.rightSpread +
        (rolled.rightSpread - defaultHabit.rightSpread) * t,
      fanSkew: rolled.fanSkew * t,
    };
    harmonizeRandomHabit(habit);
    if (kind?.habit) {
      for (const key of Object.keys(kind.habit) as (keyof GrowthHabit)[]) {
        const v = kind.habit[key];
        if (v !== undefined) {
          habit[key] =
            (habit[key] as number) * (1 - t * 0.5) + v * (t * 0.5 + 0.5);
        }
      }
      harmonizeRandomHabit(habit);
    }
  } else {
    config = { ...liveConfig };
    phenotype = { ...livePhenotype };
    habit = { ...liveHabit };
  }

  if (random) harmonizeRandomFoliage(phenotype);
  const t = new SpaceColonizationTree({ x, y }, config, phenotype);
  t.resize(innerWidth, innerHeight);
  t.seedAt(x, y, habit);

  if (!random) {
    panelLinked.add(t);
    applyLiveToTree(t);
  } else {
    // Still follow panel style edits after spawn (random only picks the initial look).
    panelLinked.add(t);
  }
  return t;
}

function reseedSingle(): void {
  trees.length = 0;
  clearFalling();
  const t = createTreeAt(innerWidth * 0.5, innerHeight * 0.72);
  trees.push(t);
  updateStyleLabel(t);
}

function plantAt(clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * innerWidth;
  const y = ((clientY - rect.top) / rect.height) * innerHeight;
  if (trees.length >= MAX_TREES) trees.shift();
  const t = createTreeAt(x, y);
  trees.push(t);
  updateStyleLabel(t);
}

function randomizeHabitPanel(): void {
  const rolled = makeRandomHabit();
  const t = clamp(randomThreshold, 0, 1);
  // Blend wild habit toward upright defaults when threshold is low.
  liveHabit.lean = rollExtreme(-1, 1, 0.05, rolled.lean * t);
  liveHabit.leanStrength = rollExtreme(
    0.02,
    0.95,
    0.01,
    defaultHabit.leanStrength +
      (rolled.leanStrength - defaultHabit.leanStrength) * t,
  );
  liveHabit.seedAngle = rollExtreme(
    -Math.PI * 0.98,
    -Math.PI * 0.02,
    0.01,
    defaultHabit.seedAngle + (rolled.seedAngle - defaultHabit.seedAngle) * t,
  );
  liveHabit.sideBias = rollExtreme(-1, 1, 0.05, rolled.sideBias * t);
  liveHabit.leftSpread = rollExtreme(
    0.2,
    2.4,
    0.05,
    defaultHabit.leftSpread + (rolled.leftSpread - defaultHabit.leftSpread) * t,
  );
  liveHabit.rightSpread = rollExtreme(
    0.2,
    2.4,
    0.05,
    defaultHabit.rightSpread +
      (rolled.rightSpread - defaultHabit.rightSpread) * t,
  );
  liveHabit.fanSkew = rollExtreme(-1, 1, 0.05, rolled.fanSkew * t);
  harmonizeRandomHabit(liveHabit);
  liveHabit.rootXFrac = defaultHabit.rootXFrac;
  liveHabit.rootYFrac = defaultHabit.rootYFrac;
}

function randomizeTimingInto(cfg: ColonizationConfig): void {
  const d = defaultConfig;
  cfg.shedRate = rollExtreme(0.08, 2.5, 0.05, d.shedRate);
  cfg.lifeSpanScale = rollExtreme(0.5, 4, 0.05, d.lifeSpanScale);
  cfg.deathRate = rollExtreme(0.1, 2, 0.05, d.deathRate);
  cfg.leafGrowRate = rollExtreme(0.005, 0.12, 0.005, d.leafGrowRate);
  cfg.leafSpawnRate = rollExtreme(0.1, 2.2, 0.05, d.leafSpawnRate);
  cfg.flowerGrowRate = rollExtreme(0.004, 0.1, 0.005, d.flowerGrowRate);
  cfg.flowerSpawnRate = rollExtreme(0.08, 2.5, 0.05, d.flowerSpawnRate);
  cfg.branchGrowRate = rollExtreme(0.05, 0.6, 0.01, d.branchGrowRate);
  cfg.branchFadeRate = rollExtreme(0.05, 0.6, 0.01, d.branchFadeRate);
  cfg.resproutChance = rollExtreme(0.05, 0.8, 0.05, d.resproutChance);
  liveStepHz = rollExtreme(6, 36, 1, 12);
}

function randomizeConfigWild(): void {
  const keepImmortal = liveConfig.immortal;
  const base = chanceAt(0.7) ? pickBranching().config : {};
  Object.assign(liveConfig, defaultConfig, base);
  liveConfig.immortal = keepImmortal;
  if (base.branchPattern === undefined) {
    liveConfig.branchPattern = pickBranching().name;
  }
  const c = liveConfig;
  liveConfig.segmentLength = rollExtreme(4, 28, 0.5, c.segmentLength);
  liveConfig.minDistance = rollExtreme(3, 32, 0.5, c.minDistance);
  liveConfig.maxDistance = rollExtreme(24, 180, 1, c.maxDistance);
  liveConfig.inertia = rollExtreme(0.02, 0.92, 0.01, c.inertia);
  liveConfig.branchSpread = rollExtreme(0.15, 1.45, 0.01, c.branchSpread);
  liveConfig.tipForkChance = rollExtreme(0.02, 0.95, 0.01, c.tipForkChance);
  liveConfig.upwardBias = rollExtreme(0.02, 0.98, 0.01, c.upwardBias);
  liveConfig.maxTips = Math.round(rollExtreme(2, 84, 1, c.maxTips));
  liveConfig.maxNodes = Math.round(rollExtreme(40, 2100, 10, c.maxNodes));
  liveConfig.attractorCount = Math.round(
    rollExtreme(30, 1020, 5, c.attractorCount),
  );
  liveConfig.cloudRadius = rollExtreme(30, 780, 2, c.cloudRadius);
  liveConfig.maxChildren = Math.round(rollExtreme(1, 12, 1, c.maxChildren));
  liveConfig.forkEvery = Math.round(rollExtreme(1, 5, 1, c.forkEvery));
  randomizeTimingInto(liveConfig);
  harmonizeRandomGrowth(liveConfig);
}

function randomizeWind(): void {
  windStrength = rollExtreme(0.05, 1.35, 0.05, 0.45);
  windDirectionDeg = rollExtreme(0, 360, 5, 18);
  windGust = rollExtreme(0.05, 0.95, 0.05, 0.4);
}

function randomizeParams(): void {
  randomizeHabitPanel();
  // Low threshold sticks to curated types; high opens free wild rolls.
  if (!chanceAt(0.65) || Math.random() < 0.55) {
    applyTreeKind(pick(treeKinds), true);
  } else {
    activeTreeType = "custom";
    randomizeConfigWild();
    Object.assign(livePhenotype, pickPhenotype());
    harmonizeRandomFoliage(livePhenotype);
    syncLookSelects();
    rebuildSliders();
    applyLiveToAll();
  }
  randomizeWind();
  rebuildSliders();
  // Full restart — wipe scene and grow a fresh tree with the new rolls.
  restartWorld();
}

/** Roll stem / leaf / flower look (and often a curated type) without wiping the scene. */
function randomizeStyleLook(): void {
  if (Math.random() < 0.6) {
    applyTreeKind(pick(treeKinds), false);
  } else {
    activeTreeType = "custom";
    Object.assign(livePhenotype, pickPhenotype());
    syncLookSelects();
    rebuildSliders();
    applyLiveToAll();
  }
  updateStyleLabel(trees[trees.length - 1]);
}

/**
 * New look on the living wood. Every style field moves, inside one palette
 * and inside the size that leaf can carry. Growth, habit, and wind stay.
 */
function randomizeFullStyle(): void {
  const look = rollLookFromHarmony(pickHarmony());
  const aspect = leafShapeAspect[look.leafStyle];
  Object.assign(
    livePhenotype,
    look,
    fitStyleNumbers(look.leafStyle, look.flowerStyle, {
      leafLength: aspect.len * (0.82 + Math.random() * 0.36),
      leafWidth: aspect.wid * (0.88 + Math.random() * 0.24),
      leafDensity: aspect.dens * (0.82 + Math.random() * 0.3),
      flowerSize: 0.8 + Math.random() * 0.5,
      flowerDensity: 0.65 + Math.random() * 0.6,
      flowerPetals: 0.2 + Math.random() * 0.6,
      stemGirth: 0.85 + Math.random() * 0.45,
    }),
  );
  applyLookChange();
  rebuildSliders();
  syncLeafToolMenu();
  syncFlowerToolMenu();
  syncGrowToolMenu();
}

function restartWorld(): void {
  trees.length = 0;
  clearFalling();
  acc = 0;
  // Always plant from the panel we just rolled — don't re-roll via spawn mode.
  const x = innerWidth * 0.5;
  const y = innerHeight * 0.72;
  const t = new SpaceColonizationTree(
    { x, y },
    { ...liveConfig },
    { ...livePhenotype },
  );
  t.resize(innerWidth, innerHeight);
  t.seedAt(x, y, { ...liveHabit });
  panelLinked.add(t);
  applyLiveToTree(t);
  trees.push(t);
  updateStyleLabel(t);
  resize();
}

type SliderDef = {
  key: string;
  label: string;
  /** Descriptive hover tip shown on the slider. */
  tip: string;
  min: number;
  max: number;
  step: number;
  target: "config" | "phenotype" | "habit" | "sim" | "wind";
  format?: (v: number) => string;
};

function windDirLabel(deg: number): string {
  const arrows = ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"];
  const i = ((Math.round(deg / 45) % 8) + 8) % 8;
  return `${arrows[i]} ${Math.round(deg)}°`;
}

function sideWord(v: number): string {
  if (v < -0.15) return "izq";
  if (v > 0.15) return "der";
  return "·";
}

const windSliderDefs: SliderDef[] = [
  {
    key: "strength",
    label: "Intensidad",
    tip: "Qué tan fuerte sopla sobre la copa y lo que se cae.",
    min: 0,
    max: 1.5,
    step: 0.05,
    target: "wind",
    format: (v) => v.toFixed(2),
  },
  {
    key: "direction",
    label: "Dirección",
    tip: "Hacia dónde sopla. 0° es la derecha, 90° es arriba.",
    min: 0,
    max: 360,
    step: 5,
    target: "wind",
    format: windDirLabel,
  },
  {
    key: "gust",
    label: "Ráfagas",
    tip: "Cuánto cambia el viento. Más alto, más irregular.",
    min: 0,
    max: 1,
    step: 0.05,
    target: "wind",
    format: (v) => v.toFixed(2),
  },
];

const growthSliderDefs: SliderDef[] = [
  {
    key: "segmentLength",
    label: "Largo de tramo",
    tip: "Cuánto avanza el tronco en cada paso.",
    min: 4,
    max: 28,
    step: 0.5,
    target: "config",
  },
  {
    key: "minDistance",
    label: "Separación",
    tip: "Qué tan juntas pueden crecer las ramas. Más bajo, más tupido.",
    min: 3,
    max: 32,
    step: 0.5,
    target: "config",
  },
  {
    key: "maxDistance",
    label: "Alcance",
    tip: "Hasta dónde llega una punta buscando por dónde seguir.",
    min: 24,
    max: 180,
    step: 1,
    target: "config",
  },
  {
    key: "inertia",
    label: "Inercia",
    tip: "Cuánto insiste la punta en seguir derecho.",
    min: 0.02,
    max: 0.92,
    step: 0.01,
    target: "config",
  },
  {
    key: "branchSpread",
    label: "Apertura",
    tip: "Qué tan abiertas salen las ramas al bifurcarse.",
    min: 0.15,
    max: 1.45,
    step: 0.01,
    target: "config",
  },
  {
    key: "tipForkChance",
    label: "Bifurcación",
    tip: "Qué tan seguido se abre una rama en dos.",
    min: 0.02,
    max: 0.95,
    step: 0.01,
    target: "config",
  },
  {
    key: "forkEvery",
    label: "Bifurcar cada",
    tip: "Cada cuántos tramos se abre una rama, sí o sí.",
    min: 1,
    max: 5,
    step: 1,
    target: "config",
  },
  {
    key: "upwardBias",
    label: "Hacia arriba",
    tip: "Cuánto prefiere subir en vez de abrirse a los lados.",
    min: 0.02,
    max: 0.98,
    step: 0.01,
    target: "config",
  },
  {
    key: "maxTips",
    label: "Puntas",
    tip: "Cuántas puntas pueden estar creciendo a la vez.",
    min: 2,
    max: 84,
    step: 1,
    target: "config",
  },
  {
    key: "maxNodes",
    label: "Tamaño",
    tip: "Hasta dónde puede llegar el árbol, en tramos.",
    min: 40,
    max: 2100,
    step: 10,
    target: "config",
  },
  {
    key: "attractorCount",
    label: "Guías",
    tip: "Cuántos puntos le marcan al árbol por dónde crecer.",
    min: 30,
    max: 1020,
    step: 5,
    target: "config",
  },
  {
    key: "cloudRadius",
    label: "Copa",
    tip: "Qué tan amplia es la zona hacia la que crece.",
    min: 30,
    max: 780,
    step: 2,
    target: "config",
  },
  {
    key: "maxChildren",
    label: "Ramas por nudo",
    tip: "Cuántas ramas pueden salir de un mismo punto.",
    min: 1,
    max: 12,
    step: 1,
    target: "config",
  },
];

const timingSliderDefs: SliderDef[] = [
  {
    key: "stepHz",
    label: "Velocidad",
    tip: "Qué tan rápido corre el crecimiento.",
    min: 6,
    max: 36,
    step: 1,
    target: "sim",
    format: (v) => `${Math.round(v)} Hz`,
  },
  {
    key: "shedRate",
    label: "Caída",
    tip: "Qué tan pronto se caen las hojas y las flores.",
    min: 0.08,
    max: 2.5,
    step: 0.05,
    target: "config",
  },
  {
    key: "lifeSpanScale",
    label: "Vida",
    tip: "Cuánto duran las ramas antes de marchitarse.",
    min: 0.5,
    max: 4,
    step: 0.05,
    target: "config",
  },
  {
    key: "deathRate",
    label: "Marchitarse",
    tip: "Qué tan rápido se apaga una rama al final de su vida.",
    min: 0.1,
    max: 2,
    step: 0.05,
    target: "config",
  },
  {
    key: "branchGrowRate",
    label: "Engrosar",
    tip: "Qué tan rápido aparece y se pone grueso un tramo nuevo.",
    min: 0.05,
    max: 0.6,
    step: 0.01,
    target: "config",
  },
  {
    key: "branchFadeRate",
    label: "Desvanecerse",
    tip: "Qué tan rápido desaparece una rama al cortarla o al morir.",
    min: 0.05,
    max: 0.6,
    step: 0.01,
    target: "config",
  },
  {
    key: "resproutChance",
    label: "Rebrotar",
    tip: "Qué tan seguido sale un brote nuevo después de un corte.",
    min: 0.05,
    max: 0.8,
    step: 0.05,
    target: "config",
  },
];

const shapeSliderDefs: SliderDef[] = [
  {
    key: "lean",
    label: "Inclinación",
    tip: "Si la planta se va a la izquierda, al centro o a la derecha.",
    min: -1,
    max: 1,
    step: 0.05,
    target: "habit",
    format: (v) => `${sideWord(v)} ${v.toFixed(2)}`,
  },
  {
    key: "leanStrength",
    label: "Cuánto se inclina",
    tip: "Qué tan fuerte empuja esa inclinación.",
    min: 0.02,
    max: 0.95,
    step: 0.01,
    target: "habit",
  },
  {
    key: "seedAngle",
    label: "Ángulo inicial",
    tip: "Hacia dónde sale el primer brote.",
    min: -Math.PI * 0.98,
    max: -Math.PI * 0.02,
    step: 0.01,
    target: "habit",
    format: (v) => `${Math.round(((v + Math.PI / 2) * 180) / Math.PI)}°`,
  },
  {
    key: "sideBias",
    label: "De lado",
    tip: "Si prefiere crecer más hacia un costado.",
    min: -1,
    max: 1,
    step: 0.05,
    target: "habit",
    format: (v) => `${sideWord(v)} ${v.toFixed(2)}`,
  },
  {
    key: "leftSpread",
    label: "A la izquierda",
    tip: "Qué tan ancha es la copa de ese lado.",
    min: 0.2,
    max: 2.4,
    step: 0.05,
    target: "habit",
  },
  {
    key: "rightSpread",
    label: "A la derecha",
    tip: "Qué tan ancha es la copa de ese lado.",
    min: 0.2,
    max: 2.4,
    step: 0.05,
    target: "habit",
  },
  {
    key: "fanSkew",
    label: "Copa ladeada",
    tip: "Corre el abanico de la copa hacia un lado.",
    min: -1,
    max: 1,
    step: 0.05,
    target: "habit",
    format: (v) => `${sideWord(v)} ${v.toFixed(2)}`,
  },
];

const leafSliderDefs: SliderDef[] = [
  {
    key: "leafLength",
    label: "Largo",
    tip: "Qué tan largas son las hojas.",
    min: 0.25,
    max: 3.2,
    step: 0.05,
    target: "phenotype",
  },
  {
    key: "leafWidth",
    label: "Ancho",
    tip: "Qué tan anchas son las hojas.",
    min: 0.6,
    max: 2.8,
    step: 0.05,
    target: "phenotype",
  },
  {
    key: "leafDensity",
    label: "Cantidad",
    tip: "Cuántas hojas salen en cada rama.",
    min: 0.2,
    max: 2.8,
    step: 0.05,
    target: "phenotype",
  },
  {
    key: "leafSpawnRate",
    label: "Brotan",
    tip: "Qué tan seguido salen hojas nuevas.",
    min: 0.1,
    max: 2.2,
    step: 0.05,
    target: "config",
  },
  {
    key: "leafGrowRate",
    label: "Crecen",
    tip: "Qué tan rápido una hoja llega a su tamaño.",
    min: 0.005,
    max: 0.12,
    step: 0.005,
    target: "config",
  },
];

const flowerSliderDefs: SliderDef[] = [
  {
    key: "flowerSize",
    label: "Tamaño",
    tip: "Qué tan grandes son las flores.",
    min: 0.25,
    max: 3,
    step: 0.05,
    target: "phenotype",
  },
  {
    key: "flowerDensity",
    label: "Cantidad",
    tip: "Cuántas puntas de afuera llevan flor.",
    min: 0.2,
    max: 2.8,
    step: 0.05,
    target: "phenotype",
  },
  {
    key: "flowerPetals",
    label: "Pétalos",
    tip: "Si las flores tienden a tener más pétalos o menos.",
    min: 0,
    max: 1,
    step: 0.05,
    target: "phenotype",
  },
];

const flowerAdvSliderDefs: SliderDef[] = [
  {
    key: "flowerSpawnRate",
    label: "Brotan",
    tip: "Qué tan seguido salen flores nuevas.",
    min: 0.08,
    max: 2.5,
    step: 0.05,
    target: "config",
  },
  {
    key: "flowerGrowRate",
    label: "Se abren",
    tip: "Qué tan rápido una flor se abre del todo.",
    min: 0.004,
    max: 0.1,
    step: 0.005,
    target: "config",
  },
];

function readParam(def: SliderDef): number {
  if (def.target === "sim") return liveStepHz;
  if (def.target === "wind") {
    if (def.key === "strength") return windStrength;
    if (def.key === "direction") return windDirectionDeg;
    return windGust;
  }
  if (def.target === "config") {
    return liveConfig[def.key as keyof ColonizationConfig] as number;
  }
  if (def.target === "habit") {
    return liveHabit[def.key as keyof GrowthHabit] as number;
  }
  return livePhenotype[def.key as keyof TreePhenotype] as number;
}

function writeParam(def: SliderDef, value: number): void {
  if (def.target === "sim") {
    liveStepHz = value;
  } else if (def.target === "wind") {
    if (def.key === "strength") windStrength = value;
    else if (def.key === "direction") windDirectionDeg = value;
    else windGust = value;
  } else if (def.target === "config") {
    (liveConfig as unknown as Record<string, number>)[def.key] = value;
    applyLiveToAll();
  } else if (def.target === "habit") {
    (liveHabit as unknown as Record<string, number>)[def.key] = value;
    // Shape applies on next spawn (chosen mode), not to living trees.
  } else {
    (livePhenotype as unknown as Record<string, number>)[def.key] = value;
    applyLiveToAll();
  }
}

/** Floating tip — mirrors native title placement (near cursor), no browser chrome. */
let sliderTipEl: HTMLDivElement | null = null;

function ensureSliderTip(): HTMLDivElement {
  if (!sliderTipEl) {
    sliderTipEl = document.createElement("div");
    sliderTipEl.className = "slider-tip";
    sliderTipEl.hidden = true;
    document.body.appendChild(sliderTipEl);
  }
  return sliderTipEl;
}

function showSliderTip(text: string, clientX: number, clientY: number): void {
  const el = ensureSliderTip();
  el.textContent = text;
  el.hidden = false;
  const pad = 14;
  let x = clientX + pad;
  let y = clientY + 18;
  // Keep on-screen once measured.
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = clientX - r.width - 8;
    if (y + r.height > window.innerHeight - 8) y = clientY - r.height - 8;
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, y)}px`;
  });
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function hideSliderTip(): void {
  if (sliderTipEl) sliderTipEl.hidden = true;
}

function bindSliderTip(host: HTMLElement, tip: string): void {
  host.addEventListener("pointerenter", (e) => {
    showSliderTip(tip, e.clientX, e.clientY);
  });
  host.addEventListener("pointermove", (e) => {
    if (sliderTipEl && !sliderTipEl.hidden) {
      showSliderTip(tip, e.clientX, e.clientY);
    }
  });
  host.addEventListener("pointerleave", () => {
    hideSliderTip();
  });
}

function buildSlider(def: SliderDef): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "slider";
  bindSliderTip(label, def.tip);
  const name = document.createElement("span");
  name.className = "label";
  name.textContent = def.label;
  const valueEl = document.createElement("span");
  valueEl.className = "value";
  const input = document.createElement("input");
  input.type = "range";
  input.dataset.param = def.key;
  input.min = String(def.min);
  input.max = String(def.max);
  input.step = String(def.step);
  const sync = (): void => {
    const v = Number(input.value);
    valueEl.textContent = def.format ? def.format(v) : String(v);
  };
  input.value = String(readParam(def));
  sync();
  input.addEventListener("input", () => {
    writeParam(def, Number(input.value));
    sync();
  });
  label.append(name, valueEl, input);
  return label;
}

function rebuildAdvancedSliders(): void {
  growthSlidersEl.replaceChildren(...growthSliderDefs.map(buildSlider));
  timingSlidersEl.replaceChildren(...timingSliderDefs.map(buildSlider));
  windSlidersEl.replaceChildren(...windSliderDefs.map(buildSlider));
  shapeSlidersEl.replaceChildren(...shapeSliderDefs.map(buildSlider));
  leafSlidersEl.replaceChildren(...leafSliderDefs.map(buildSlider));
  flowerSlidersEl.replaceChildren(...flowerSliderDefs.map(buildSlider));
  flowerSlidersAdvEl.replaceChildren(...flowerAdvSliderDefs.map(buildSlider));
}

function rebuildSliders(): void {
  rebuildAdvancedSliders();
}

function clearFalling(): void {
  falling.length = 0;
  bees.length = 0;
  butterflies.length = 0;
  pollen.length = 0;
}

function gatherFlyerTargets(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const tree of trees) {
    for (const fl of tree.flowers) {
      if (fl.sprout < 0.45) continue;
      const host = tree.nodes[fl.node];
      if (!host || host.wither > 0.4) continue;
      const grown = SpaceColonizationTree.ease(fl.sprout);
      const size = fl.size * (0.4 + 0.6 * grown);
      out.push({
        x: host.x + host.dirX * size * 0.2,
        y: host.y + host.dirY * size * 0.2,
      });
    }
  }
  if (out.length > 0) return out;
  // No blooms yet — hover the outer crown.
  for (const tree of trees) {
    for (const n of tree.nodes) {
      if (n.children.length > 0 || n.wither > 0) continue;
      if (n.sprout < 0.5) continue;
      out.push({ x: n.x, y: n.y });
    }
  }
  return out;
}

function spawnFlyerNear(
  target: { x: number; y: number },
  kind: "bee" | "butterfly",
): Flyer {
  const ang = Math.random() * Math.PI * 2;
  const dist =
    kind === "butterfly" ? 40 + Math.random() * 90 : 24 + Math.random() * 60;
  return {
    x: target.x + Math.cos(ang) * dist,
    y: target.y + Math.sin(ang) * dist,
    vx: (Math.random() - 0.5) * (kind === "butterfly" ? 18 : 28),
    vy: (Math.random() - 0.5) * (kind === "butterfly" ? 14 : 24),
    phase: Math.random() * Math.PI * 2,
    size:
      kind === "butterfly"
        ? 5.2 + Math.random() * 2.8
        : 2 + Math.random() * 1.2,
    orbit:
      kind === "butterfly" ? 22 + Math.random() * 38 : 14 + Math.random() * 28,
    tx: target.x,
    ty: target.y,
    retargetAt: 0,
    wander: Math.random() * Math.PI * 2,
    hue: Math.random(),
  };
}

function syncFlyerPopulation(
  list: Flyer[],
  want: number,
  kind: "bee" | "butterfly",
  now: number,
  targets: { x: number; y: number }[],
  retargetMin: number,
  retargetSpan: number,
): void {
  while (list.length < want) {
    list.push(
      spawnFlyerNear(targets[(Math.random() * targets.length) | 0]!, kind),
    );
  }
  while (list.length > want) list.pop();
  for (const f of list) {
    if (now < f.retargetAt) continue;
    // Often pick a fresh bloom; sometimes just drift to a nearby offset.
    if (Math.random() < 0.7) {
      const t = targets[(Math.random() * targets.length) | 0]!;
      f.tx = t.x + (Math.random() - 0.5) * 36;
      f.ty = t.y + (Math.random() - 0.5) * 36;
    } else {
      f.tx += (Math.random() - 0.5) * 70;
      f.ty += (Math.random() - 0.5) * 55;
    }
    f.retargetAt = now + retargetMin + Math.random() * retargetSpan;
  }
}

function syncBeePopulation(now: number): void {
  if (!beesEnabled || trees.length === 0) {
    bees.length = 0;
    butterflies.length = 0;
    return;
  }
  const targets = gatherFlyerTargets();
  if (targets.length === 0) {
    bees.length = 0;
    butterflies.length = 0;
    return;
  }
  let blooms = 0;
  for (const t of trees) blooms += t.flowers.length;
  // Quiet garden: a few bees with long gaps between visits.
  const wantBees = Math.min(
    MAX_BEES,
    blooms > 0
      ? Math.max(1, Math.min(3, 1 + Math.floor(blooms * 0.12)))
      : Math.min(1, trees.length),
  );
  syncFlyerPopulation(bees, wantBees, "bee", now, targets, 2800, 6200);
  // Butterflies parked for now.
  butterflies.length = 0;
}

function stepFlyer(
  f: Flyer,
  dt: number,
  opts: {
    seek: number;
    damp: number;
    windSail: number;
    orbitHz: number;
    wanderRate: number;
    jitter: number;
    maxSpeed: number;
  },
): void {
  const sec = Math.min(0.05, dt / 1000);
  const w = windForce(f.phase);
  // Meander the wander heading; bees twitch more, butterflies turn soft.
  f.wander +=
    (Math.sin(pulse * 0.7 + f.phase) * 0.4 + (Math.random() - 0.5) * 1.2) *
    opts.wanderRate *
    sec;
  const buzz = pulse * opts.orbitHz + f.phase;
  const ox =
    f.tx + Math.cos(buzz) * f.orbit * 0.55 + Math.cos(f.wander) * f.orbit * 0.7;
  const oy =
    f.ty +
    Math.sin(buzz * 0.9) * f.orbit * 0.4 +
    Math.sin(f.wander * 0.85) * f.orbit * 0.55;
  f.vx += (ox - f.x) * opts.seek * sec + w.x * opts.windSail * sec;
  f.vy += (oy - f.y) * opts.seek * sec + w.y * opts.windSail * 0.65 * sec;
  f.vx += Math.sin(pulse * 2.4 + f.phase * 2) * opts.jitter * sec;
  f.vy += Math.cos(pulse * 1.9 + f.phase) * opts.jitter * 0.85 * sec;
  f.vx *= Math.pow(opts.damp, dt / 16);
  f.vy *= Math.pow(opts.damp, dt / 16);
  const sp = Math.hypot(f.vx, f.vy);
  if (sp > opts.maxSpeed) {
    f.vx = (f.vx / sp) * opts.maxSpeed;
    f.vy = (f.vy / sp) * opts.maxSpeed;
  }
  f.x += f.vx * sec;
  f.y += f.vy * sec;
}

function stepBees(dt: number): void {
  for (const bee of bees) {
    stepFlyer(bee, dt, {
      seek: 0.7,
      damp: 0.95,
      windSail: 10,
      orbitHz: 1.05,
      wanderRate: 1.4,
      jitter: 12,
      maxSpeed: 36,
    });
  }
  for (const bf of butterflies) {
    stepFlyer(bf, dt, {
      seek: 0.55,
      damp: 0.96,
      windSail: 22,
      orbitHz: 0.55,
      wanderRate: 1.5,
      jitter: 10,
      maxSpeed: 32,
    });
  }
}

function butterflyColors(hue: number): { wing: string; body: string } {
  // Soft garden palette — peach, cream, sky, clay.
  let r: number, g: number, b: number;
  if (hue < 0.25) {
    r = 220;
    g = 150 + hue * 80;
    b = 120;
  } else if (hue < 0.5) {
    r = 230;
    g = 200;
    b = 140 + (hue - 0.25) * 80;
  } else if (hue < 0.75) {
    r = 150 + (hue - 0.5) * 40;
    g = 175;
    b = 200;
  } else {
    r = 190;
    g = 120 + (hue - 0.75) * 60;
    b = 110;
  }
  return {
    wing: `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`,
    body: "52, 44, 36",
  };
}

function mixRgb(rgb: string, toward: number, t: number): string {
  const parts = rgb.split(",").map((v) => Number(v.trim()));
  const r = Math.round(parts[0]! + (toward - parts[0]!) * t);
  const g = Math.round(parts[1]! + (toward - parts[1]!) * t);
  const b = Math.round(parts[2]! + (toward - parts[2]!) * t);
  return `${r}, ${g}, ${b}`;
}

function drawBee(c: CanvasRenderingContext2D, bee: Flyer): void {
  // Always horizontal — only flip so the head leads travel.
  const face = bee.vx >= 0 ? 1 : -1;
  const wing = 0.55 + 0.45 * Math.sin(pulse * 28 + bee.phase * 3);
  const s = bee.size;
  c.save();
  c.translate(bee.x, bee.y);
  c.scale(face, 1);
  c.fillStyle = `rgba(245, 242, 230, ${0.2 + wing * 0.25})`;
  c.beginPath();
  c.ellipse(-s * 0.1, -s * 0.9, s * 1.15, s * 0.5, -0.25, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(-s * 0.1, s * 0.9, s * 1.15, s * 0.5, 0.25, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(196, 148, 52, 0.88)";
  c.beginPath();
  c.ellipse(0, 0, s * 1.2, s * 0.62, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(36, 32, 24, 0.55)";
  c.lineWidth = Math.max(0.7, s * 0.28);
  c.beginPath();
  c.moveTo(-s * 0.1, -s * 0.4);
  c.lineTo(-s * 0.1, s * 0.4);
  c.stroke();
  c.fillStyle = "rgba(42, 38, 30, 0.8)";
  c.beginPath();
  c.arc(s * 0.8, 0, s * 0.36, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawButterfly(c: CanvasRenderingContext2D, bf: Flyer): void {
  // Emoji-style side profile — bold flat shapes like the reference.
  const face = bf.vx >= 0 ? 1 : -1;
  const flap = 0.5 + 0.5 * Math.sin(pulse * 5.2 + bf.phase);
  const { wing } = butterflyColors(bf.hue);
  const wingLite = mixRgb(wing, 255, 0.35);
  const wingDeep = mixRgb(wing, 40, 0.28);
  const s = bf.size * 1.35;

  c.save();
  c.translate(bf.x, bf.y);
  c.scale(face, 1);
  // Gentle dive matches the reference silhouette.
  c.rotate(-0.28);

  // --- Wings — emoji silhouette: tall scalloped forewing + round hindwing ---
  c.save();
  // Sit lower on the thorax (not perched on the top edge).
  c.translate(s * 0.02, s * 0.12);
  // Flap: wings rise / settle without changing the shape.
  c.rotate(-0.05 + flap * 0.22);

  // Hindwing (draw first): soft round lobe, tucked aft and a bit lower.
  c.fillStyle = `rgba(${wing}, 0.95)`;
  c.beginPath();
  c.ellipse(-s * 0.35, -s * 0.15, s * 0.55, s * 0.7, -0.35, 0, Math.PI * 2);
  c.fill();

  // Forewing: tall sail, scalloped outer rim like the reference.
  c.fillStyle = `rgba(${wing}, 0.98)`;
  c.beginPath();
  // Root at thorax.
  c.moveTo(s * 0.05, s * 0.05);
  // Smooth leading edge up toward the tip.
  c.bezierCurveTo(
    s * 0.25,
    -s * 0.55,
    s * 0.45,
    -s * 1.35,
    s * 0.55,
    -s * 1.85,
  );
  // Scalloped outer edge (three clear lobes).
  c.quadraticCurveTo(s * 0.85, -s * 2.05, s * 1.05, -s * 1.7);
  c.quadraticCurveTo(s * 1.25, -s * 1.45, s * 1.15, -s * 1.1);
  c.quadraticCurveTo(s * 1.3, -s * 0.85, s * 1.1, -s * 0.55);
  c.quadraticCurveTo(s * 0.95, -s * 0.3, s * 0.55, -s * 0.12);
  // Trailing edge back to the body.
  c.quadraticCurveTo(s * 0.25, -s * 0.02, s * 0.05, s * 0.05);
  c.closePath();
  c.fill();

  // Light highlight along the upper scallops.
  c.fillStyle = `rgba(${wingLite}, 0.9)`;
  c.beginPath();
  c.moveTo(s * 0.4, -s * 1.15);
  c.bezierCurveTo(s * 0.5, -s * 1.65, s * 0.7, -s * 1.95, s * 0.95, -s * 1.75);
  c.quadraticCurveTo(s * 0.85, -s * 1.45, s * 0.7, -s * 1.15);
  c.quadraticCurveTo(s * 0.55, -s * 1.0, s * 0.4, -s * 1.15);
  c.closePath();
  c.fill();

  // Darker inner fold near the thorax.
  c.fillStyle = `rgba(${wingDeep}, 0.5)`;
  c.beginPath();
  c.moveTo(s * 0.05, s * 0.02);
  c.quadraticCurveTo(s * 0.35, -s * 0.35, s * 0.28, -s * 0.85);
  c.quadraticCurveTo(s * 0.12, -s * 0.4, s * 0.05, s * 0.02);
  c.closePath();
  c.fill();

  c.restore();

  // --- Body: abdomen → thorax → head ---
  // Abdomen (golden orange)
  c.fillStyle = "rgba(220, 150, 55, 0.95)";
  c.beginPath();
  c.ellipse(-s * 0.48, s * 0.04, s * 0.55, s * 0.22, -0.12, 0, Math.PI * 2);
  c.fill();

  // Thorax (bright yellow)
  c.fillStyle = "rgba(240, 200, 55, 0.98)";
  c.beginPath();
  c.ellipse(s * 0.02, 0, s * 0.32, s * 0.26, 0, 0, Math.PI * 2);
  c.fill();

  // Head (charcoal)
  c.fillStyle = "rgba(55, 58, 68, 0.95)";
  c.beginPath();
  c.arc(s * 0.38, -s * 0.02, s * 0.18, 0, Math.PI * 2);
  c.fill();

  // Legs under thorax
  c.strokeStyle = "rgba(55, 58, 68, 0.85)";
  c.lineWidth = Math.max(0.9, s * 0.12);
  c.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const lx = s * (-0.08 + i * 0.12);
    c.beginPath();
    c.moveTo(lx, s * 0.18);
    c.quadraticCurveTo(lx - s * 0.05, s * 0.4, lx + s * 0.02, s * 0.55);
    c.stroke();
  }

  // Antennae from head
  c.lineWidth = Math.max(0.85, s * 0.1);
  c.beginPath();
  c.moveTo(s * 0.45, -s * 0.12);
  c.quadraticCurveTo(s * 0.55, -s * 0.55, s * 0.42, -s * 0.85);
  c.stroke();
  c.beginPath();
  c.moveTo(s * 0.5, -s * 0.1);
  c.quadraticCurveTo(s * 0.75, -s * 0.45, s * 0.72, -s * 0.75);
  c.stroke();

  c.restore();
}

function drawFlyers(): void {
  for (const bf of butterflies) drawButterfly(ctx, bf);
  for (const bee of bees) drawBee(ctx, bee);
}

function gatherPollenSources(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const tree of trees) {
    for (const fl of tree.flowers) {
      if (fl.sprout < 0.5) continue;
      const host = tree.nodes[fl.node];
      if (!host || host.wither > 0.35) continue;
      out.push({
        x: host.x + host.dirX * fl.size * 0.15,
        y: host.y + host.dirY * fl.size * 0.15,
      });
    }
    if (out.length >= 24) break;
  }
  if (out.length > 0) return out;
  for (const tree of trees) {
    for (const leaf of tree.leaves) {
      if (leaf.sprout < 0.55) continue;
      const host = tree.nodes[leaf.node];
      if (!host || host.wither > 0.35) continue;
      out.push({ x: host.x, y: host.y });
      if (out.length >= 16) return out;
    }
  }
  return out;
}

function spawnPollen(): void {
  if (pollen.length >= MAX_POLLEN || trees.length === 0) return;
  // Keep the air mostly empty — only a whisper of motes.
  if (Math.random() > 0.35) return;
  const sources = gatherPollenSources();
  if (sources.length === 0) return;
  const s = sources[(Math.random() * sources.length) | 0]!;
  const w = windForce(Math.random() * 3);
  const maxLife = 4.5 + Math.random() * 5.5;
  pollen.push({
    x: s.x + (Math.random() - 0.5) * 18,
    y: s.y + (Math.random() - 0.5) * 14,
    vx: w.x * 18 + (Math.random() - 0.5) * 12,
    vy: w.y * 10 - 6 - Math.random() * 10,
    life: maxLife,
    maxLife,
    size: 0.7 + Math.random() * 1.1,
    phase: Math.random() * Math.PI * 2,
  });
}

function stepPollen(dt: number): void {
  const sec = Math.min(0.05, dt / 1000);
  const w = windForce(1.1);
  spawnPollen();
  for (let i = pollen.length - 1; i >= 0; i--) {
    const p = pollen[i]!;
    p.life -= sec;
    if (p.life <= 0) {
      pollen.splice(i, 1);
      continue;
    }
    p.vx += w.x * 28 * sec + Math.sin(pulse * 1.4 + p.phase) * 6 * sec;
    p.vy +=
      w.y * 16 * sec +
      Math.cos(pulse * 1.1 + p.phase * 1.3) * 4 * sec +
      4 * sec;
    p.vx *= Math.pow(0.97, dt / 16);
    p.vy *= Math.pow(0.97, dt / 16);
    p.x += p.vx * sec;
    p.y += p.vy * sec;
  }
}

function drawPollen(): void {
  for (const p of pollen) {
    const t = p.life / p.maxLife;
    const fade = t < 0.2 ? t / 0.2 : t > 0.75 ? (1 - t) / 0.25 : 1;
    const a = 0.22 * fade;
    if (a < 0.02) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210, 196, 150, ${a})`;
    ctx.fill();
  }
}

function leafColors(
  palette: LeafPalette,
  tone: number,
): {
  fill: string;
  midrib: string;
  fillRgb: { r: number; g: number; b: number };
  midribRgb: { r: number; g: number; b: number };
} {
  const t = tone;
  let r: number, g: number, b: number, mr: number, mg: number, mb: number;
  switch (palette) {
    case "sage":
      r = Math.round(88 + t * 42);
      g = Math.round(110 + t * 38);
      b = Math.round(78 + t * 28);
      mr = 42;
      mg = 58;
      mb = 44;
      break;
    case "jade":
      r = Math.round(36 + t * 28);
      g = Math.round(118 + t * 45);
      b = Math.round(92 + t * 30);
      mr = 22;
      mg = 62;
      mb = 48;
      break;
    case "copper":
      r = Math.round(132 + t * 55);
      g = Math.round(78 + t * 28);
      b = Math.round(42 + t * 18);
      mr = 72;
      mg = 42;
      mb = 28;
      break;
    case "autumn":
      r = Math.round(168 + t * 50);
      g = Math.round(88 + t * 20 - t * t * 30);
      b = Math.round(38 + t * 12);
      mr = 96;
      mg = 48;
      mb = 28;
      break;
    case "seaGlass":
      r = Math.round(58 + t * 30);
      g = Math.round(118 + t * 40);
      b = Math.round(112 + t * 38);
      mr = 32;
      mg = 62;
      mb = 60;
      break;
    case "moss":
      r = Math.round(48 + t * 32);
      g = Math.round(72 + t * 36);
      b = Math.round(38 + t * 18);
      mr = 28;
      mg = 40;
      mb = 26;
      break;
    default: // olive
      r = Math.round(52 + t * 36);
      g = Math.round(78 + t * 28);
      b = Math.round(48 + t * 18);
      mr = 28;
      mg = 42;
      mb = 30;
  }
  return {
    fill: `${r}, ${g}, ${b}`,
    midrib: `${mr}, ${mg}, ${mb}`,
    fillRgb: { r, g, b },
    midribRgb: { r: mr, g: mg, b: mb },
  };
}

const leafColorCache = new Map<
  LeafPalette,
  Map<
    number,
    {
      fill: string;
      midrib: string;
      fillRgb: { r: number; g: number; b: number };
      midribRgb: { r: number; g: number; b: number };
    }
  >
>();

function cachedLeafColors(palette: LeafPalette, tone: number) {
  let byTone = leafColorCache.get(palette);
  if (!byTone) {
    byTone = new Map();
    leafColorCache.set(palette, byTone);
  }
  let colors = byTone.get(tone);
  if (!colors) {
    colors = leafColors(palette, tone);
    byTone.set(tone, colors);
  }
  return colors;
}

function drawLeaf(
  c: CanvasRenderingContext2D,
  style: LeafStyle,
  palette: LeafPalette,
  x: number,
  y: number,
  angle: number,
  len: number,
  wid: number,
  tone: number,
  alpha: number,
  midribAlpha: number,
): void {
  const { fill, midrib } = cachedLeafColors(palette, tone);
  const shownLen = leafPresentedLength(style, len);
  const drawnWid = leafPresentedWidth(style, len, wid);
  const hx = shownLen * 0.5;
  const hy = drawnWid * 0.5;
  const sx = hx;
  const sy = hy;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  if (sx > 0 && sy > 0) {
    c.setTransform(
      dpr * cos * sx,
      dpr * sin * sx,
      -dpr * sin * sy,
      dpr * cos * sy,
      dpr * x,
      dpr * y,
    );
    c.fillStyle = `rgba(${fill}, ${alpha})`;
    c.fill(leafOutline(style));
  }

  // A group is several leaflets. One vein across the whole mark would join them.
  if (!leafIsGroup(style)) {
    // Midrib stays in CSS pixels. The fill scale would squash its width.
    c.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * x, dpr * y);
    c.beginPath();
    c.moveTo(-shownLen * 0.35, 0);
    c.lineTo(shownLen * 0.4, 0);
    c.strokeStyle = `rgba(${midrib}, ${midribAlpha})`;
    c.lineWidth = 0.6;
    c.stroke();
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function pushGlLeaf(
  style: LeafStyle,
  palette: LeafPalette,
  x: number,
  y: number,
  angle: number,
  len: number,
  wid: number,
  tone: number,
  alpha: number,
  midribAlpha: number,
): void {
  const { fillRgb, midribRgb } = cachedLeafColors(palette, tone);
  const rib = leafIsGroup(style) ? 0 : midribAlpha;
  foliage.pushLeaf(
    style,
    x,
    y,
    angle,
    len,
    wid,
    fillRgb.r,
    fillRgb.g,
    fillRgb.b,
    alpha,
    midribRgb.r,
    midribRgb.g,
    midribRgb.b,
    rib,
  );
}

function blitFoliage(): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(foliageCanvas, 0, 0);
  ctx.restore();
}

function stampScars(tree: SpaceColonizationTree): void {
  // Shed pieces fall immediately — no lingering ghost twigs.
  for (const s of tree.takeScars()) pushFallingStem(s);
  for (const leaf of tree.takeBurnLeaves()) {
    pushFallingLeaf(
      leaf.x,
      leaf.y,
      leaf.angle,
      leaf.length,
      leaf.width,
      leaf.tone,
      0.4,
      0.14,
      leaf.leafStyle,
      leaf.leafPalette,
    );
  }
  for (const fl of tree.takeBurnFlowers()) {
    pushFallingFlower(
      fl.x,
      fl.y,
      fl.angle,
      fl.size,
      fl.petals,
      fl.hue,
      0.45,
      fl.flowerStyle,
      fl.flowerPalette,
    );
  }
}

function stemColors(palette: StemPalette): { fill: string; mark: string } {
  switch (palette) {
    case "walnut":
      return { fill: "52, 36, 28", mark: "32, 22, 18" };
    case "cedar":
      return { fill: "78, 52, 36", mark: "48, 32, 22" };
    case "oliveWood":
      return { fill: "58, 62, 42", mark: "36, 40, 28" };
    case "copperBark":
      return { fill: "92, 54, 40", mark: "62, 34, 26" };
    case "paleBirch":
      return { fill: "198, 188, 168", mark: "48, 44, 40" };
    case "charcoal":
      return { fill: "36, 40, 38", mark: "18, 20, 19" };
    default: // ash
      return { fill: "72, 70, 62", mark: "40, 40, 36" };
  }
}

type DrawCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function drawBranchSeg(
  c: DrawCtx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  alpha: number,
  palette: StemPalette = "oliveWood",
): void {
  const { fill } = stemColors(palette);
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = `rgba(${fill}, ${alpha})`;
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.stroke();
}

function flowerColors(
  palette: FlowerPalette,
  hue: number,
): { petal: string; center: string; anther: string } {
  // Each palette maps hue 0→1 within a botanical family.
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
    default: // creamCoral
      r = Math.round(230 - hue * 40);
      g = Math.round(210 - hue * 110);
      b = Math.round(175 - hue * 90);
      cr = Math.round(200 - hue * 20);
      cg = Math.round(150 - hue * 40);
      cb = Math.round(70 + hue * 20);
  }
  return {
    petal: `${r}, ${g}, ${b}`,
    center: `${cr}, ${cg}, ${cb}`,
    anther: `${Math.min(255, cr + 42)}, ${Math.min(255, cg + 30)}, ${Math.min(255, cb + 10)}`,
  };
}

/** Petal tip points to local -Y. halfW is the shoulder; notch pulls the tip in. */
function traceFlowerPetal(halfW: number, notch: number): Path2D {
  const path = new Path2D();
  path.moveTo(0, 0.1);
  path.bezierCurveTo(halfW, 0.02, halfW * 1.08, -0.46, halfW * 0.2, -0.88);
  path.quadraticCurveTo(0, -1 - notch, -halfW * 0.2, -0.88);
  path.bezierCurveTo(-halfW * 1.08, -0.46, -halfW, 0.02, 0, 0.1);
  path.closePath();
  return path;
}

const blossomPetal = traceFlowerPetal(0.46, 0.1);
const roundPetal = traceFlowerPetal(0.64, 0);
const narrowPetal = traceFlowerPetal(0.22, 0.02);
const cupPetal = traceFlowerPetal(0.52, 0.14);

const sepalPath = (() => {
  const path = new Path2D();
  path.moveTo(0, 0.06);
  path.quadraticCurveTo(0.4, -0.18, 0, -0.72);
  path.quadraticCurveTo(-0.4, -0.18, 0, 0.06);
  path.closePath();
  return path;
})();

const bellPath = (() => {
  const path = new Path2D();
  path.moveTo(-0.14, -0.46);
  path.bezierCurveTo(-0.2, -0.12, -0.58, 0.02, -0.52, 0.4);
  path.quadraticCurveTo(-0.22, 0.6, 0, 0.52);
  path.quadraticCurveTo(0.22, 0.6, 0.52, 0.4);
  path.bezierCurveTo(0.58, 0.02, 0.2, -0.12, 0.14, -0.46);
  path.quadraticCurveTo(0, -0.28, -0.14, -0.46);
  path.closePath();
  return path;
})();

function stampFlowerShape(
  c: CanvasRenderingContext2D,
  path: Path2D,
  ang: number,
  len: number,
  wid: number,
  orbit: number,
): void {
  c.save();
  c.rotate(ang + Math.PI / 2);
  c.translate(0, -orbit);
  c.scale(wid, len);
  c.fill(path);
  c.restore();
}

function stampStamens(
  c: CanvasRenderingContext2D,
  radius: number,
  count: number,
  disc: string,
  anther: string,
): void {
  c.beginPath();
  c.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
  c.fillStyle = disc;
  c.fill();
  c.fillStyle = anther;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    c.beginPath();
    c.arc(
      Math.cos(a) * radius,
      Math.sin(a) * radius,
      Math.max(0.45, radius * 0.22),
      0,
      Math.PI * 2,
    );
    c.fill();
  }
}

/** One open blossom: sepals, a ring of petals, a stamen heart. */
function drawOpenBloom(
  c: CanvasRenderingContext2D,
  size: number,
  count: number,
  petal: Path2D,
  petalLen: number,
  petalWid: number,
  fill: string,
  disc: string,
  anther: string,
  alpha: number,
  turn: number,
): void {
  c.fillStyle = `rgba(74, 96, 68, ${alpha * 0.55})`;
  for (let i = 0; i < count; i++) {
    stampFlowerShape(
      c,
      sepalPath,
      (i / count) * Math.PI * 2 + turn,
      size * 0.32,
      size * 0.14,
      size * 0.02,
    );
  }
  c.fillStyle = fill;
  for (let i = 0; i < count; i++) {
    stampFlowerShape(
      c,
      petal,
      (i / count) * Math.PI * 2 + turn,
      size * petalLen,
      size * petalWid,
      size * 0.05,
    );
  }
  stampStamens(c, size * 0.16, count, disc, anther);
}

/** Three small blossoms on one pedicel — how a twig actually flowers. */
function drawFlowerCluster(
  c: CanvasRenderingContext2D,
  size: number,
  petal: Path2D,
  petalLen: number,
  petalWid: number,
  fill: string,
  disc: string,
  anther: string,
  alpha: number,
  turn: number,
): void {
  const spots: [number, number, number][] = [
    [0, -0.2, 0.2],
    [-0.34, 0.18, -0.45],
    [0.32, 0.2, 0.5],
  ];
  const floret = size * 0.56;
  for (const [ox, oy, rot] of spots) {
    c.save();
    c.translate(ox * size, oy * size);
    c.rotate(rot);
    drawOpenBloom(
      c,
      floret,
      5,
      petal,
      petalLen,
      petalWid,
      fill,
      disc,
      anther,
      alpha,
      turn,
    );
    c.restore();
  }
}

function drawFlower(
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
  const { petal, center, anther } = flowerColors(palette, hue);
  const fill = `rgba(${petal}, ${alpha})`;
  const disc = `rgba(${center}, ${Math.min(1, alpha + 0.12)})`;
  const dot = `rgba(${anther}, ${Math.min(1, alpha + 0.08)})`;
  const turn = hue * 1.3;
  // Bells, catkins and racemes hang. The rest face out along the shoot.
  const pendant = style === "bell" || flowerHangs(style);
  const spin = pendant ? Math.sin(angle) * 0.22 + sway * 0.35 : angle + sway;

  c.save();
  c.translate(x, y);
  c.rotate(spin);

  c.beginPath();
  c.lineWidth = Math.max(0.7, size * 0.045);
  c.lineCap = "round";
  c.strokeStyle = `rgba(92, 74, 52, ${alpha * 0.4})`;
  if (style === "catkin" || style === "raceme") {
    c.moveTo(0, -size * 0.4);
    c.lineTo(0, 0);
  } else if (style === "bell") {
    c.moveTo(0, -size * 0.55);
    c.lineTo(0, -size * 0.08);
  } else {
    c.moveTo(-size * 0.48, 0);
    c.lineTo(-size * 0.02, 0);
  }
  c.stroke();

  switch (style) {
    case "cup": {
      // Magnolia / tulip tree — one bowl of broad tepals, a second rank inside.
      const n = 6 + (petals % 3);
      drawOpenBloom(
        c,
        size * 1.05,
        n,
        cupPetal,
        0.78,
        0.4,
        fill,
        disc,
        dot,
        alpha,
        turn,
      );
      c.fillStyle = fill;
      for (let i = 0; i < n; i++) {
        stampFlowerShape(
          c,
          cupPetal,
          ((i + 0.5) / n) * Math.PI * 2 + turn,
          size * 0.58,
          size * 0.28,
          size * 0.04,
        );
      }
      stampStamens(c, size * 0.14, n, disc, dot);
      break;
    }
    case "bell": {
      c.save();
      c.scale(size * 0.95, size * 1.05);
      c.fillStyle = fill;
      c.fill(bellPath);
      c.restore();
      c.beginPath();
      c.ellipse(0, size * 0.28, size * 0.24, size * 0.11, 0, 0, Math.PI * 2);
      c.fillStyle = disc;
      c.fill();
      break;
    }
    case "star":
      // Jasmine / citrus — a little cluster of narrow petals.
      drawFlowerCluster(
        c,
        size,
        narrowPetal,
        0.85,
        0.28,
        fill,
        disc,
        dot,
        alpha,
        turn,
      );
      break;
    case "tube": {
      c.save();
      c.scale(size * 0.72, size * 1.05);
      c.fillStyle = fill;
      c.fill(bellPath);
      c.restore();
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) / 2;
        c.save();
        c.translate(t * size * 0.2, size * 0.4);
        c.rotate(Math.PI + t * 0.3);
        c.fillStyle = fill;
        c.scale(size * 0.16, size * 0.18);
        c.fill(roundPetal);
        c.restore();
      }
      c.beginPath();
      c.ellipse(0, size * 0.3, size * 0.12, size * 0.07, 0, 0, Math.PI * 2);
      c.fillStyle = disc;
      c.fill();
      break;
    }
    case "pom": {
      // Mimosa / acacia — a puff of stamens, not a garden chrysanthemum.
      const n = 16 + (petals % 5);
      c.fillStyle = fill;
      for (let i = 0; i < n; i++) {
        const a = turn + (i / n) * Math.PI * 2;
        const ring = size * (0.16 + (i % 4) * 0.07);
        c.beginPath();
        c.moveTo(Math.cos(a) * ring * 0.25, Math.sin(a) * ring * 0.25);
        c.lineTo(Math.cos(a) * ring, Math.sin(a) * ring);
        c.strokeStyle = fill;
        c.lineWidth = Math.max(0.4, size * 0.035);
        c.stroke();
        c.beginPath();
        c.arc(
          Math.cos(a) * ring,
          Math.sin(a) * ring,
          size * 0.055,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      c.beginPath();
      c.arc(0, 0, size * 0.1, 0, Math.PI * 2);
      c.fillStyle = disc;
      c.fill();
      break;
    }
    case "iris": {
      // Orchid tree — one banner, two wings, a lip.
      c.fillStyle = `rgba(74, 96, 68, ${alpha * 0.45})`;
      stampFlowerShape(c, sepalPath, -Math.PI / 2, size * 0.3, size * 0.16, 0);
      c.fillStyle = fill;
      stampFlowerShape(c, cupPetal, -Math.PI / 2, size * 0.72, size * 0.42, size * 0.04);
      stampFlowerShape(c, blossomPetal, -Math.PI / 2 - 1.15, size * 0.62, size * 0.3, size * 0.02);
      stampFlowerShape(c, blossomPetal, -Math.PI / 2 + 1.15, size * 0.62, size * 0.3, size * 0.02);
      stampFlowerShape(c, roundPetal, Math.PI / 2, size * 0.5, size * 0.4, size * 0.06);
      stampStamens(c, size * 0.12, 5, disc, dot);
      break;
    }
    case "buttercup":
      drawOpenBloom(
        c,
        size,
        5,
        roundPetal,
        0.62,
        0.4,
        fill,
        disc,
        dot,
        alpha,
        turn,
      );
      break;
    case "catkin": {
      // Willow / birch: a dangling spike of scales.
      const n = 8 + (petals % 3);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const y = size * (0.04 + t * 1.25);
        const w = size * (0.11 + Math.sin(t * Math.PI) * 0.1);
        const side = i % 2 === 0 ? -1 : 1;
        c.beginPath();
        c.ellipse(side * w * 0.2, y, w * 0.85, size * 0.075, side * 0.45, 0, Math.PI * 2);
        c.fillStyle = i % 2 === 0 ? fill : disc;
        c.fill();
      }
      break;
    }
    case "raceme": {
      // Wisteria / laburnum: small blossoms down one hanging stalk.
      const n = 5 + (petals % 2);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(size * 0.12, size * 0.55, 0, size * 1.2);
      c.stroke();
      for (let i = 0; i < n; i++) {
        const t = (i + 0.35) / n;
        const y = size * t * 1.15;
        const x = Math.sin(t * 2.4) * size * 0.06;
        c.save();
        c.translate(x, y);
        c.rotate((i % 2 === 0 ? 0.35 : -0.35) + sway);
        drawOpenBloom(
          c,
          size * 0.32,
          4,
          blossomPetal,
          0.55,
          0.32,
          fill,
          disc,
          dot,
          alpha,
          turn + i * 0.4,
        );
        c.restore();
      }
      break;
    }
    case "cone": {
      // Pine / cypress: overlapping scales, tip along the shoot.
      const n = 7 + (petals % 3);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = size * (0.04 + t * 0.95);
        const w = size * (0.07 + Math.sin(t * Math.PI) * 0.18);
        c.beginPath();
        c.moveTo(x - size * 0.06, -w);
        c.lineTo(x + size * 0.16, 0);
        c.lineTo(x - size * 0.06, w);
        c.quadraticCurveTo(x + size * 0.02, 0, x - size * 0.06, -w);
        c.fillStyle = i % 2 === 0 ? fill : disc;
        c.fill();
      }
      break;
    }
    default:
      // Cherry / apple / hawthorn — five petals, three to a twig.
      drawFlowerCluster(
        c,
        size,
        blossomPetal,
        0.7,
        0.36,
        fill,
        disc,
        dot,
        alpha,
        turn,
      );
  }
  c.restore();
}

/** Walk single-child runs so limbs draw as continuous ribbons, not bricks. */
function forEachBranchStrand(
  tree: SpaceColonizationTree,
  visit: (chain: number[]) => void,
): void {
  const nodes = tree.nodes;
  if (nodes.length < 2) return;

  const walk = (firstChild: number): void => {
    const idxs: number[] = [];
    let i = firstChild;
    let guard = 0;
    while (guard++ < nodes.length) {
      idxs.push(i);
      const n = nodes[i];
      if (n.children.length !== 1) break;
      i = n.children[0]!;
    }
    const parent = nodes[firstChild]!.parent;
    const chain = parent === null ? idxs : [parent, ...idxs];
    if (chain.length >= 2) visit(chain);
    const end = idxs[idxs.length - 1]!;
    if (nodes[end]!.children.length >= 2) {
      for (const c of nodes[end]!.children) walk(c);
    }
  };

  for (const c of nodes[0]!.children) walk(c);
}

function stemWidthScale(style: StemStyle): number {
  switch (style) {
    case "vine":
      return 0.72;
    case "reed":
      return 0.65;
    case "bamboo":
      return 0.9;
    case "twiggy":
      return 0.55;
    default:
      return 1;
  }
}

/**
 * Foliage-only sway. Wood stays rigid so strand joints never split —
 * wind shows on leaf/flower angle and falling debris instead.
 */
function breezeAngle(phase: number, flex: number): number {
  const w = windForce(phase);
  const f = Math.max(0, flex);
  const lean = (w.x * 0.28 - w.y * 0.12) * f;
  return (
    lean +
    Math.sin(pulse * 0.55 + phase) * 0.12 * f * (0.35 + windGust) +
    Math.sin(pulse * 1.3 + phase * 0.65) * 0.06 * f * windGust
  );
}

function drawGroundPresence(c: DrawCtx, tree: SpaceColonizationTree): void {
  const x = tree.center.x;
  const y = tree.center.y;

  // Soft contact shadow — quiet grey disc, like the reference.
  c.beginPath();
  c.ellipse(x, y + 8, 52, 13, 0, 0, Math.PI * 2);
  c.fillStyle = "rgba(70, 78, 68, 0.06)";
  c.fill();

  c.beginPath();
  c.ellipse(x, y + 7, 30, 8, 0, 0, Math.PI * 2);
  c.fillStyle = "rgba(55, 62, 52, 0.1)";
  c.fill();

  // Whisper of soil where the stem meets ground — no moss mound.
  c.beginPath();
  c.ellipse(x, y + 1.5, 6.5, 2.8, 0, 0, Math.PI * 2);
  c.fillStyle = "rgba(42, 50, 40, 0.28)";
  c.fill();
}

/**
 * Canopy wash in a space where the outer radius is 1.
 * Drawn with a uniform scale of `rx`, so the falloff stays circular in CSS
 * pixels. The filled ellipse is squashed in this space (height 0.68).
 */
const canopyBlob = new Path2D();
canopyBlob.ellipse(0, 0, 1, 0.68, 0, 0, Math.PI * 2);

type CanopyWash = { epoch: number; gradient: CanvasGradient };
const canopyWashes = new Map<string, CanopyWash>();
let canopyEpoch = 0;

function beginCanopyWashes(): void {
  canopyEpoch++;
}

function endCanopyWashes(): void {
  for (const [key, wash] of canopyWashes) {
    if (wash.epoch !== canopyEpoch) canopyWashes.delete(key);
  }
}

function canopyWash(
  c: DrawCtx,
  fill: string,
  avgLife: number,
  rx: number,
): CanvasGradient {
  const a0 = 0.12 * avgLife;
  const a1 = 0.045 * avgLife;
  const key = `${fill}|${a0}|${a1}|${rx}`;
  const hit = canopyWashes.get(key);
  if (hit) {
    hit.epoch = canopyEpoch;
    return hit.gradient;
  }
  // Inner radius is 0.5 CSS pixels, independent of the cluster size.
  const gradient = c.createRadialGradient(0, 0, 0.5 / rx, 0, 0, 1);
  gradient.addColorStop(0, `rgba(${fill}, ${a0})`);
  gradient.addColorStop(0.55, `rgba(${fill}, ${a1})`);
  gradient.addColorStop(1, `rgba(${fill}, 0)`);
  canopyWashes.set(key, { epoch: canopyEpoch, gradient });
  return gradient;
}

/** Soft volume behind tip leaf tufts. */
function drawCanopyMasses(c: DrawCtx, tree: SpaceColonizationTree): void {
  type Cluster = {
    sx: number;
    sy: number;
    n: number;
    life: number;
    tone: number;
  };
  const clusters = new Map<number, Cluster>();
  const palette = tree.phenotype.leafPalette;

  for (const leaf of tree.leaves) {
    let idx = leaf.node;
    if (idx <= 0 || idx >= tree.nodes.length) continue;
    let host = tree.nodes[idx]!;
    if (host.wither > 0.5) continue;

    // Walk down a short single-child run to the tip this leaf belongs to.
    let tipIdx = idx;
    let guard = 0;
    while (tree.nodes[tipIdx]!.children.length === 1 && guard++ < 4) {
      tipIdx = tree.nodes[tipIdx]!.children[0]!;
    }
    const tip = tree.nodes[tipIdx]!;
    if (tip.children.length > 0 || tip.wither > 0) continue;

    const hostLife =
      SpaceColonizationTree.ease(host.sprout) *
      SpaceColonizationTree.ease(1 - host.wither);
    const grown = SpaceColonizationTree.ease(leaf.sprout);
    const life = grown * hostLife;
    if (life < 0.18) continue;

    const flex = 0.75 + grown * 0.35;
    const base = Math.atan2(host.dirY, host.dirX);
    const sway =
      breezeAngle(leaf.phase, flex) + Math.sin(pulse * 1.3 + leaf.phase) * 0.08;
    const ang = leafWorldAngle(tree.phenotype.leafStyle, base, leaf.angle, sway);
    const len = leaf.length * (0.45 + 0.55 * grown) * (0.55 + 0.45 * hostLife);
    const reach = leafPresentedLength(tree.phenotype.leafStyle, len);
    const lx = host.x + Math.cos(ang) * reach * 0.42;
    const ly = host.y + Math.sin(ang) * reach * 0.42;

    let cl = clusters.get(tipIdx);
    if (!cl) {
      cl = { sx: 0, sy: 0, n: 0, life: 0, tone: 0 };
      clusters.set(tipIdx, cl);
    }
    cl.sx += lx;
    cl.sy += ly;
    cl.n++;
    cl.life += life;
    cl.tone += leaf.tone;
  }

  for (const cl of clusters.values()) {
    if (cl.n < 3) continue;
    const cx = cl.sx / cl.n;
    const cy = cl.sy / cl.n;
    const avgLife = cl.life / cl.n;
    const { fill } = cachedLeafColors(palette, cl.tone / cl.n);
    const rx = 4.5 + cl.n * 1.15;
    const g = canopyWash(c, fill, avgLife, rx);
    c.save();
    c.translate(cx, cy);
    c.scale(rx, rx);
    c.fillStyle = g;
    c.fill(canopyBlob);
    c.restore();
  }
}

const woodCaches = new WeakMap<SpaceColonizationTree, WoodCache>();

/** Draw positions for one limb. Wind does not move these; grow and wither do. */
function strandPoints(
  tree: SpaceColonizationTree,
  chain: readonly number[],
  wScale: number,
): StrandPt[] {
  const maxMass = tree.maxMass;
  const pts: StrandPt[] = [];
  for (const idx of chain) {
    const n = tree.nodes[idx];
    if (!n) break;
    const t = Math.sqrt(n.mass / maxMass);
    let life = 1;
    let x = n.x;
    let y = n.y;
    if (n.parent !== null) {
      const parent = tree.nodes[n.parent];
      if (!parent) break;
      const grow = SpaceColonizationTree.ease(n.sprout);
      const fade = SpaceColonizationTree.ease(1 - n.wither);
      life = grow * fade;
      // Soft extend / retract — stay mostly connected to the parent joint.
      const reach =
        n.wither > 0
          ? 1 - SpaceColonizationTree.ease(n.wither) * 0.4
          : 0.88 + 0.12 * grow;
      x = parent.x + (n.x - parent.x) * reach;
      y = parent.y + (n.y - parent.y) * reach;
    }
    if (life < 0.015 && pts.length > 0) break;
    pts.push({
      x,
      y,
      w: (1.05 + t * 13.5) * wScale * (0.4 + 0.6 * life),
      a: (0.42 + t * 0.4) * life,
    });
  }
  return pts;
}

function chainBirths(
  tree: SpaceColonizationTree,
  chain: readonly number[],
): number[] {
  const births: number[] = [];
  for (const idx of chain) {
    const n = tree.nodes[idx];
    if (!n) break;
    births.push(n.birth);
  }
  return births;
}

function drawFluidWood(
  c: CanvasRenderingContext2D,
  tree: SpaceColonizationTree,
): void {
  const { fill } = stemColors(tree.phenotype.stemPalette);
  const wScale =
    stemWidthScale(tree.phenotype.stemStyle) *
    (tree.phenotype.stemGirth || 1);
  const strands: WoodStrand[] = [];
  forEachBranchStrand(tree, (chain) => {
    const pts = strandPoints(tree, chain, wScale);
    if (pts.length < 2) return;
    strands.push({ births: chainBirths(tree, chain), pts });
  });
  let cache = woodCaches.get(tree);
  if (!cache) {
    cache = new WoodCache();
    woodCaches.set(tree, cache);
  }
  cache.render(c, strands, fill, dpr);
}

function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = innerWidth;
  const h = innerHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  foliage.resize(w, h, dpr);

  for (const t of trees) t.resize(w, h);
}

/** Reused so the crown's back-to-front order does not allocate every frame. */
const leafDrawOrder: number[] = [];

/** Inner leaves and the far face of a twig draw first. */
function leafStackKey(tree: SpaceColonizationTree, index: number): number {
  const leaf = tree.leaves[index];
  const host = leaf ? tree.nodes[leaf.node] : undefined;
  if (!leaf || !host) return 0;
  const dx = host.x - tree.center.x;
  const dy = host.y - tree.center.y;
  return dx * dx + dy * dy + (leaf.side > 0 ? 640 : 0);
}

/**
 * 0 sits deep in the crown, 1 sits on the outside face.
 * Used only to open the rear leaves a little.
 */
function leafFacing(tree: SpaceColonizationTree, index: number): number {
  const leaf = tree.leaves[index];
  const host = leaf ? tree.nodes[leaf.node] : undefined;
  if (!leaf || !host) return 1;
  const dx = host.x - tree.center.x;
  const dy = host.y - tree.center.y;
  const dist2 = dx * dx + dy * dy;
  const outward = dist2 / (dist2 + 70 * 70);
  const face = leaf.side > 0 ? 1 : 0;
  return outward * 0.75 + face * 0.25;
}

function drawTree(
  tree: SpaceColonizationTree,
  _cssW: number,
  _cssH: number,
): void {
  const maxMass = tree.maxMass;
  const leafStyle = tree.phenotype.leafStyle;
  const leafPalette = tree.phenotype.leafPalette;
  const flowerStyle = tree.phenotype.flowerStyle;
  const palette = tree.phenotype.flowerPalette;

  drawGroundPresence(ctx, tree);

  if (!hideAttractors) {
    ctx.fillStyle = "rgba(36, 53, 40, 0.14)";
    for (const a of tree.attractors) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawFluidWood(ctx, tree);
  drawCanopyMasses(ctx, tree);

  const glLeaves = foliage.ok;
  if (glLeaves) foliage.begin();
  const leafCount = tree.leaves.length;
  leafDrawOrder.length = leafCount;
  for (let i = 0; i < leafCount; i++) leafDrawOrder[i] = i;
  if (leafCount > 1) {
    leafDrawOrder.sort((a, b) => leafStackKey(tree, a) - leafStackKey(tree, b));
  }
  for (let order = 0; order < leafCount; order++) {
    const leafIndex = leafDrawOrder[order];
    if (leafIndex === undefined) continue;
    const leaf = tree.leaves[leafIndex];
    if (!leaf) continue;
    const host = tree.nodes[leaf.node];
    if (!host) continue;
    const hostLife =
      SpaceColonizationTree.ease(host.sprout) *
      SpaceColonizationTree.ease(1 - host.wither);
    const grown = SpaceColonizationTree.ease(leaf.sprout);
    const flex = 0.7 + grown * 0.45;
    const base = Math.atan2(host.dirY, host.dirX);
    const sway =
      breezeAngle(leaf.phase, flex) +
      Math.sin(pulse * 1.35 + leaf.phase) * 0.07;
    const ang = leafWorldAngle(tree.phenotype.leafStyle, base, leaf.angle, sway);
    const grownSpan = 0.45 + 0.55 * grown;
    const len = leaf.length * grownSpan * (0.5 + 0.5 * hostLife);
    const wid = leaf.width * grownSpan * (0.5 + 0.5 * hostLife);
    const reach = leafPresentedLength(tree.phenotype.leafStyle, len);
    const x = host.x + Math.cos(ang) * reach * 0.42;
    const y = host.y + Math.sin(ang) * reach * 0.42;
    // Rear of the crown gives a little. The outside face stays nearly solid.
    const veil = 0.74 + 0.18 * leafFacing(tree, leafIndex);
    const alpha = (0.62 + grown * 0.34) * hostLife * veil;
    const midribAlpha = (0.15 + grown * 0.2) * hostLife * veil;
    if (glLeaves) {
      pushGlLeaf(
        leafStyle,
        leafPalette,
        x,
        y,
        ang,
        len,
        wid,
        leaf.tone,
        alpha,
        midribAlpha,
      );
    } else {
      drawLeaf(
        ctx,
        leafStyle,
        leafPalette,
        x,
        y,
        ang,
        len,
        wid,
        leaf.tone,
        alpha,
        midribAlpha,
      );
    }
  }
  if (glLeaves && foliage.hasLeaves()) {
    foliage.flush();
    blitFoliage();
  }

  for (const fl of tree.flowers) {
    const host = tree.nodes[fl.node];
    if (!host) continue;
    const hostLife =
      SpaceColonizationTree.ease(host.sprout) *
      SpaceColonizationTree.ease(1 - host.wither);
    const grown = SpaceColonizationTree.ease(fl.sprout);
    const size = fl.size * (0.4 + 0.6 * grown) * (0.55 + 0.45 * hostLife);
    const flex = 0.65 + grown * 0.4;
    const sway =
      breezeAngle(fl.phase, flex) + Math.sin(pulse * 1.15 + fl.phase) * 0.05;
    const shoot = Math.atan2(host.dirY, host.dirX);
    const hangs = flowerHangs(flowerStyle);
    drawFlower(
      ctx,
      flowerStyle,
      hangs ? host.x : host.x + host.dirX * size * 0.35,
      hangs ? host.y : host.y + host.dirY * size * 0.35,
      hangs ? shoot * 0.12 : shoot + (fl.angle - Math.PI) * 0.28,
      size,
      fl.petals,
      fl.hue,
      palette,
      (0.55 + grown * 0.35) * hostLife,
      sway,
    );
  }

  // Soft growing tips instead of bright orange buds.
  for (const n of tree.nodes) {
    if (n.children.length > 0) continue;
    const life =
      SpaceColonizationTree.ease(n.sprout) *
      SpaceColonizationTree.ease(1 - n.wither);
    if (life < 0.12) continue;
    const t = Math.sqrt(n.mass / maxMass);
    ctx.beginPath();
    ctx.arc(n.x, n.y, (1.1 + t * 0.8) * (0.6 + 0.4 * life), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(70, 96, 72, ${(0.28 + Math.sin(pulse * 1.2 + n.birth) * 0.08) * life})`;
    ctx.fill();
  }
}

type ZenGlow = {
  cx: number;
  cy: number;
  r: number;
  pool: CanvasGradient;
  mist: CanvasGradient;
};

const zenGlows = new WeakMap<SpaceColonizationTree, ZenGlow>();

function zenGlow(c: DrawCtx, tree: SpaceColonizationTree, r: number): ZenGlow {
  const cx = tree.center.x;
  const cy = tree.center.y;
  const cached = zenGlows.get(tree);
  if (cached && cached.cx === cx && cached.cy === cy && cached.r === r) {
    return cached;
  }

  const poolY = cy + 3;
  const pool = c.createRadialGradient(cx, poolY, 0, cx, poolY, r * 0.3);
  pool.addColorStop(0, "rgba(36, 53, 40, 0.05)");
  pool.addColorStop(0.45, "rgba(58, 74, 58, 0.016)");
  pool.addColorStop(1, "rgba(223, 232, 223, 0)");

  const mistY = cy - r * 0.1;
  const mist = c.createRadialGradient(
    cx,
    mistY,
    r * 0.015,
    cx,
    mistY,
    r * 0.42,
  );
  mist.addColorStop(0, "rgba(186, 202, 186, 0.1)");
  mist.addColorStop(0.35, "rgba(196, 212, 196, 0.04)");
  mist.addColorStop(0.7, "rgba(223, 232, 223, 0.012)");
  mist.addColorStop(1, "rgba(223, 232, 223, 0)");

  const next: ZenGlow = { cx, cy, r, pool, mist };
  zenGlows.set(tree, next);
  return next;
}

/** Pale ink-wash halo — garden mist, not a spotlight oval. */
function drawZenGroundGlow(
  c: DrawCtx,
  tree: SpaceColonizationTree,
  w: number,
  h: number,
): void {
  const r = Math.min(w, h);
  const glow = zenGlow(c, tree, r);
  const cx = glow.cx;
  const cy = glow.cy;

  // Shallow ground pool — wide, barely there.
  const poolY = cy + 3;
  c.fillStyle = glow.pool;
  c.beginPath();
  c.ellipse(cx, poolY, r * 0.32, r * 0.09, 0, 0, Math.PI * 2);
  c.fill();

  // Soft upward breath — round, diffuse, sage wash.
  const mistY = cy - r * 0.1;
  c.fillStyle = glow.mist;
  c.beginPath();
  c.ellipse(cx, mistY, r * 0.36, r * 0.34, 0, 0, Math.PI * 2);
  c.fill();
}

function draw(): void {
  const w = innerWidth;
  const h = innerHeight;

  ctx.clearRect(0, 0, w, h);

  for (const tree of trees) {
    drawZenGroundGlow(ctx, tree, w, h);
  }

  beginCanopyWashes();
  for (const tree of trees) drawTree(tree, w, h);
  endCanopyWashes();
  drawPollen();
  drawFlyers();

  let glBatch = false;
  const flushGlBatch = (): void => {
    if (!glBatch) return;
    if (foliage.hasLeaves()) {
      foliage.flush();
      blitFoliage();
    }
    glBatch = false;
  };
  for (const f of falling) {
    if (f.kind === "leaf" && foliage.ok) {
      if (!glBatch) {
        foliage.begin();
        glBatch = true;
      }
      pushGlLeaf(
        f.leafStyle,
        f.leafPalette,
        f.x,
        f.y,
        f.angle,
        f.length,
        f.width,
        f.tone,
        f.alpha,
        f.midrib,
      );
    } else if (f.kind === "leaf") {
      drawLeaf(
        ctx,
        f.leafStyle,
        f.leafPalette,
        f.x,
        f.y,
        f.angle,
        f.length,
        f.width,
        f.tone,
        f.alpha,
        f.midrib,
      );
    } else if (f.kind === "flower") {
      flushGlBatch();
      drawFlower(
        ctx,
        f.flowerStyle,
        f.x,
        f.y,
        f.angle,
        f.size,
        f.petals,
        f.hue,
        f.flowerPalette,
        f.alpha,
        0,
      );
    } else {
      flushGlBatch();
      const hx = Math.cos(f.angle) * f.length * 0.5;
      const hy = Math.sin(f.angle) * f.length * 0.5;
      drawBranchSeg(
        ctx,
        f.x - hx,
        f.y - hy,
        f.x + hx,
        f.y + hy,
        f.width,
        0.4 * f.alpha,
        f.stemPalette,
      );
    }
  }
  flushGlBatch();
}

let acc = 0;
let fpsFrames = 0;
let fpsWindowStart = 0;
let fpsDisplay = 0;
let statsAcc = 0;

function countWord(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function updateHud(dt: number): void {
  statsAcc += dt;
  if (statsAcc < 250) return;
  statsAcc = 0;

  fpsEl.textContent = `${fpsDisplay} fps`;

  let nodes = 0;
  let tips = 0;
  let leaves = 0;
  let flowers = 0;
  for (const t of trees) {
    nodes += t.nodes.length;
    for (let i = 0; i < t.nodes.length; i++) {
      if (t.nodes[i].children.length === 0) tips++;
    }
    leaves += t.leaves.length;
    flowers += t.flowers.length;
  }
  nodesEl.textContent = `${countWord(trees.length, "árbol", "árboles")} · ${countWord(nodes, "tramo", "tramos")} · ${styleLabel}`;
  const flyerBits: string[] = [];
  if (bees.length > 0) flyerBits.push(countWord(bees.length, "abeja", "abejas"));
  if (butterflies.length > 0) {
    flyerBits.push(countWord(butterflies.length, "mariposa", "mariposas"));
  }
  const flyerBit = flyerBits.length ? ` · ${flyerBits.join(" · ")}` : "";
  tipsEl.textContent = `${countWord(tips, "punta", "puntas")} · ${countWord(leaves, "hoja", "hojas")} · ${countWord(flowers, "flor", "flores")}${flyerBit}`;
}

function frame(now: number): void {
  if (!frame.prev) frame.prev = now;
  const dt = Math.min(48, now - frame.prev);
  frame.prev = now;
  acc += dt;
  pulse = now * 0.004;

  fpsFrames++;
  if (!fpsWindowStart) fpsWindowStart = now;
  const elapsed = now - fpsWindowStart;
  if (elapsed >= 500) {
    fpsDisplay = Math.round((fpsFrames * 1000) / elapsed);
    fpsFrames = 0;
    fpsWindowStart = now;
  }

  const stepMs = 1000 / Math.max(8, liveStepHz);
  while (acc >= stepMs) {
    for (const tree of trees) {
      tree.step();
      stampScars(tree);
    }
    acc -= stepMs;
  }

  // Stem/leaf grow-fade on the display clock — avoids 12Hz stutter at 144fps.
  for (const tree of trees) {
    tree.tickTransitions(dt);
    stampScars(tree);
  }

  stepFalling(dt, innerHeight);
  syncBeePopulation(now);
  stepBees(dt);
  stepPollen(dt);
  draw();
  updateHud(dt);
  requestAnimationFrame(frame);
}
frame.prev = 0;

function setPlantMode(on: boolean): void {
  plantMode = on;
  plantModeEl.checked = on;
  canvas.classList.toggle("plant-mode", on);
}

function setMetaCollapsed(collapsed: boolean): void {
  metaEl.classList.toggle("collapsed", collapsed);
  metaToggleBtn.textContent = collapsed ? "<<" : ">>";
  metaToggleBtn.setAttribute(
    "aria-label",
    collapsed ? "Mostrar los números" : "Ocultar los números",
  );
  metaToggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

metaToggleBtn.addEventListener("click", () => {
  setMetaCollapsed(!metaEl.classList.contains("collapsed"));
});
setMetaCollapsed(true);

reseedBtn.addEventListener("click", () => {
  randomizeParams();
});

styleRandomBtn.addEventListener("click", () => {
  randomizeFullStyle();
});

clearAllBtn.addEventListener("click", () => {
  trees.length = 0;
  clearFalling();
  updateStyleLabel();
});

immortalModeEl.addEventListener("change", () => {
  liveConfig.immortal = immortalModeEl.checked;
  applyLiveToAll();
  if (liveConfig.immortal) {
    for (const tree of trees) {
      for (const n of tree.nodes) {
        if (n.wither > 0 && n.wither < 1) n.wither = 0;
      }
    }
  }
});

randomizeBtn.addEventListener("click", () => {
  randomizeParams();
});

randomizeStyleBtn.addEventListener("click", () => {
  randomizeStyleLook();
});

function syncRandomThresholdUi(): void {
  randomThreshold = Number(randomThresholdEl.value);
  randomThresholdValEl.textContent = `${Math.round(randomThreshold * 100)}%`;
}

randomThresholdEl.addEventListener("input", () => {
  syncRandomThresholdUi();
});

const randomThresholdSlider = document.querySelector<HTMLElement>(
  "#random-threshold-slider",
);
if (randomThresholdSlider) {
  bindSliderTip(
    randomThresholdSlider,
    "Qué tan lejos se va el azar de lo habitual. Bajo, cambia poco. Alto, se va a los extremos.",
  );
}

plantModeEl.addEventListener("change", () => {
  setPlantMode(plantModeEl.checked);
});

const PANEL_TITLES: Record<string, string> = {
  mode: "Modo",
  grow: "Crecimiento",
  timing: "Tiempo",
  shape: "Forma",
  look: "Estilo",
  leaves: "Hojas",
  bloom: "Flores",
  wind: "Viento",
};

function openControlsPanel(id: string | null): void {
  const next = id ?? "";
  controlsEl.dataset.open = next;
  controlsTitle.textContent = next
    ? (PANEL_TITLES[next] ?? "Ajustes")
    : "Ajustes";

  for (const btn of controlsEl.querySelectorAll<HTMLButtonElement>(
    ".rail-btn",
  )) {
    const on = btn.dataset.panel === next && next !== "";
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", String(on));
  }
  for (const panel of controlsEl.querySelectorAll<HTMLElement>(
    ".controls-panel",
  )) {
    const on = panel.dataset.panel === next && next !== "";
    panel.classList.toggle("active", on);
    panel.hidden = !on;
  }
}

for (const btn of controlsEl.querySelectorAll<HTMLButtonElement>(".rail-btn")) {
  btn.addEventListener("click", () => {
    const id = btn.dataset.panel ?? "";
    const cur = controlsEl.dataset.open ?? "";
    openControlsPanel(cur === id ? null : id);
  });
}

controlsClose.addEventListener("click", () => {
  openControlsPanel(null);
});

treeTypeEl.addEventListener("change", () => {
  const id = treeTypeEl.value as TreeTypeId;
  if (id === "custom") {
    activeTreeType = "custom";
    return;
  }
  const kind = treeKinds.find((k) => k.id === id);
  if (kind) {
    applyTreeKind(kind);
    updateStyleLabel(trees[trees.length - 1]);
  }
});

stemStyleEl.addEventListener("change", () => {
  activeTreeType = "custom";
  livePhenotype.stemStyle = stemStyleEl.value as StemStyle;
  treeTypeEl.value = "custom";
  refreshCustomSelects();
  applyLiveToAll();
  updateStyleLabel(trees[trees.length - 1]);
});

stemPaletteEl.addEventListener("change", () => {
  activeTreeType = "custom";
  livePhenotype.stemPalette = stemPaletteEl.value as StemPalette;
  treeTypeEl.value = "custom";
  refreshCustomSelects();
  applyLiveToAll();
  updateStyleLabel(trees[trees.length - 1]);
});

leafStyleEl.addEventListener("change", () => {
  activeTreeType = "custom";
  livePhenotype.leafStyle = leafStyleEl.value as LeafStyle;
  leafStyleAltEl.value = leafStyleEl.value;
  treeTypeEl.value = "custom";
  refreshCustomSelects();
  applyLiveToAll();
  updateStyleLabel(trees[trees.length - 1]);
});

leafPaletteEl.addEventListener("change", () => {
  activeTreeType = "custom";
  livePhenotype.leafPalette = leafPaletteEl.value as LeafPalette;
  leafPaletteAltEl.value = leafPaletteEl.value;
  treeTypeEl.value = "custom";
  refreshCustomSelects();
  applyLiveToAll();
  updateStyleLabel(trees[trees.length - 1]);
});

leafStyleAltEl.addEventListener("change", () => {
  leafStyleEl.value = leafStyleAltEl.value;
  leafStyleEl.dispatchEvent(new Event("change", { bubbles: true }));
});

leafPaletteAltEl.addEventListener("change", () => {
  leafPaletteEl.value = leafPaletteAltEl.value;
  leafPaletteEl.dispatchEvent(new Event("change", { bubbles: true }));
});

flowerStyleEl.addEventListener("change", () => {
  activeTreeType = "custom";
  livePhenotype.flowerStyle = flowerStyleEl.value as FlowerStyle;
  treeTypeEl.value = "custom";
  refreshCustomSelects();
  applyLiveToAll();
  updateStyleLabel(trees[trees.length - 1]);
});

flowerPaletteEl.addEventListener("change", () => {
  activeTreeType = "custom";
  livePhenotype.flowerPalette = flowerPaletteEl.value as FlowerPalette;
  treeTypeEl.value = "custom";
  refreshCustomSelects();
  applyLiveToAll();
  updateStyleLabel(trees[trees.length - 1]);
});

function canvasPoint(
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * innerWidth,
    y: ((clientY - rect.top) / rect.height) * innerHeight,
  };
}

/** Stage gestures: click develop, drag steer, alt-drag leaves, ctrl cut, shift flower. */
type StageTool = "grow" | "leaves" | "cut" | "flower";
type Gesture = "grow" | "leaves" | "cut" | "bloom";

type GrowDrag = {
  tree: SpaceColonizationTree;
  startX: number;
  startY: number;
  pointerId: number;
  dragging: boolean;
  primed: boolean;
  lastGrowMs: number;
  mode: "grow" | "leaves";
};

let growDrag: GrowDrag | null = null;
const DRAG_THRESHOLD = 10;
const STEER_INTERVAL_MS = 130;
const LEAF_PAINT_INTERVAL_MS = 22;

const toolCursor = document.querySelector<HTMLElement>("#tool-cursor")!;
const toolButtons =
  document.querySelectorAll<HTMLButtonElement>("#tools .tool-btn");
let stageTool: StageTool | null = null;
let toolPointerX = 0;
let toolPointerY = 0;
let toolPointerSeen = false;

function endGrowDrag(): void {
  if (!growDrag) return;
  canvas.classList.remove("steering");
  canvas.classList.remove("painting-leaves");
  try {
    canvas.releasePointerCapture(growDrag.pointerId);
  } catch {
    /* already released */
  }
  growDrag = null;
}

function syncToolCursor(): void {
  if (!toolPointerSeen || stageTool === null) {
    toolCursor.hidden = true;
    return;
  }
  const onStage =
    document.elementFromPoint(toolPointerX, toolPointerY) === canvas;
  toolCursor.style.setProperty("--x", `${toolPointerX}px`);
  toolCursor.style.setProperty("--y", `${toolPointerY}px`);
  toolCursor.hidden = !onStage;
}

function trackToolPointer(clientX: number, clientY: number): void {
  toolPointerX = clientX;
  toolPointerY = clientY;
  toolPointerSeen = true;
  syncToolCursor();
}

const leafToolMenu = document.querySelector<HTMLElement>("#leaf-tool-menu")!;
const leafSizeInput = document.querySelector<HTMLInputElement>("#leaf-size")!;
const leafSizeReadout = document.querySelector<HTMLElement>("#leaf-size-readout")!;
const leafDensityInput = document.querySelector<HTMLInputElement>("#leaf-density-tool")!;
const leafDensityReadout = document.querySelector<HTMLElement>("#leaf-density-readout")!;
const leafStyleRandomBtn =
  document.querySelector<HTMLButtonElement>("#leaf-style-random")!;
const leafPaletteRandomBtn =
  document.querySelector<HTMLButtonElement>("#leaf-palette-random")!;

function formatToolNumber(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** How large the current leaves are relative to their shape. */
function currentLeafScale(): number {
  const aspect = leafShapeAspect[livePhenotype.leafStyle];
  const lenScale = livePhenotype.leafLength / aspect.len;
  const widScale = livePhenotype.leafWidth / aspect.wid;
  return (lenScale + widScale) / 2;
}

function syncPanelSlider(key: string, value: number): void {
  const shown = formatToolNumber(value);
  for (const input of document.querySelectorAll<HTMLInputElement>(
    `#controls input[data-param="${key}"]`,
  )) {
    input.value = shown;
    const valueEl = input.parentElement?.querySelector(".value");
    if (valueEl) valueEl.textContent = shown;
  }
}

function syncLeafToolMenu(): void {
  const scale = Math.min(
    Number(leafSizeInput.max),
    Math.max(Number(leafSizeInput.min), currentLeafScale()),
  );
  leafSizeInput.value = String(scale);
  leafSizeReadout.textContent = formatToolNumber(scale);
  leafDensityInput.value = String(livePhenotype.leafDensity);
  leafDensityReadout.textContent = formatToolNumber(livePhenotype.leafDensity);
}

function applyLookChange(): void {
  activeTreeType = "custom";
  treeTypeEl.value = "custom";
  syncLookSelects();
  refreshCustomSelects();
  applyLiveToAll();
  updateStyleLabel(trees[trees.length - 1]);
}

function randomizeLeafStyle(): void {
  livePhenotype.leafStyle = pick(leafStyles);
  applyLookChange();
  syncLeafToolMenu();
}

function randomizeLeafPalette(): void {
  livePhenotype.leafPalette = pick(leafPalettes);
  applyLookChange();
}

let leafSizeBasis: { len: number; wid: number; scale: number } | null = null;

leafSizeInput.addEventListener("pointerdown", () => {
  leafSizeBasis = {
    len: livePhenotype.leafLength,
    wid: livePhenotype.leafWidth,
    scale: Number(leafSizeInput.value),
  };
});

leafSizeInput.addEventListener("input", () => {
  const basis = leafSizeBasis ?? {
    len: livePhenotype.leafLength,
    wid: livePhenotype.leafWidth,
    scale: Number(leafSizeInput.value) || 1,
  };
  const next = Number(leafSizeInput.value);
  const ratio = basis.scale > 1e-6 ? next / basis.scale : 1;
  livePhenotype.leafLength = clamp(basis.len * ratio, 0.25, 3.2);
  livePhenotype.leafWidth = clamp(basis.wid * ratio, 0.6, 2.8);
  leafSizeReadout.textContent = formatToolNumber(next);
  applyLiveToAll();
  syncPanelSlider("leafLength", livePhenotype.leafLength);
  syncPanelSlider("leafWidth", livePhenotype.leafWidth);
});

leafDensityInput.addEventListener("input", () => {
  const next = Number(leafDensityInput.value);
  livePhenotype.leafDensity = clamp(next, 0.2, 2.8);
  leafDensityReadout.textContent = formatToolNumber(livePhenotype.leafDensity);
  applyLiveToAll();
  syncPanelSlider("leafDensity", livePhenotype.leafDensity);
});

leafStyleRandomBtn.addEventListener("click", () => {
  randomizeLeafStyle();
});

leafPaletteRandomBtn.addEventListener("click", () => {
  randomizeLeafPalette();
});

const flowerToolMenu = document.querySelector<HTMLElement>("#flower-tool-menu")!;
const flowerSizeInput = document.querySelector<HTMLInputElement>("#flower-size")!;
const flowerSizeReadout = document.querySelector<HTMLElement>("#flower-size-readout")!;
const flowerDensityInput =
  document.querySelector<HTMLInputElement>("#flower-density-tool")!;
const flowerDensityReadout = document.querySelector<HTMLElement>(
  "#flower-density-readout",
)!;
const flowerStyleRandomBtn =
  document.querySelector<HTMLButtonElement>("#flower-style-random")!;
const flowerPaletteRandomBtn =
  document.querySelector<HTMLButtonElement>("#flower-palette-random")!;

function syncFlowerToolMenu(): void {
  flowerSizeInput.value = String(livePhenotype.flowerSize);
  flowerSizeReadout.textContent = formatToolNumber(livePhenotype.flowerSize);
  flowerDensityInput.value = String(livePhenotype.flowerDensity);
  flowerDensityReadout.textContent = formatToolNumber(
    livePhenotype.flowerDensity,
  );
}

function randomizeFlowerStyle(): void {
  livePhenotype.flowerStyle = pick(flowerStyles);
  applyLookChange();
}

function randomizeFlowerPalette(): void {
  livePhenotype.flowerPalette = pick(flowerPalettes);
  applyLookChange();
}

flowerSizeInput.addEventListener("input", () => {
  const next = clamp(Number(flowerSizeInput.value), 0.25, 3);
  livePhenotype.flowerSize = next;
  flowerSizeReadout.textContent = formatToolNumber(next);
  applyLiveToAll();
  syncPanelSlider("flowerSize", next);
});

flowerDensityInput.addEventListener("input", () => {
  const next = clamp(Number(flowerDensityInput.value), 0.2, 2.8);
  livePhenotype.flowerDensity = next;
  flowerDensityReadout.textContent = formatToolNumber(next);
  applyLiveToAll();
  syncPanelSlider("flowerDensity", next);
});

flowerStyleRandomBtn.addEventListener("click", () => {
  randomizeFlowerStyle();
});

flowerPaletteRandomBtn.addEventListener("click", () => {
  randomizeFlowerPalette();
});

function stretchLivingWood(ratio: number): void {
  if (!(ratio > 0) || Math.abs(ratio - 1) < 1e-4) return;
  for (const tree of trees) {
    const root = tree.nodes[0];
    if (!root) continue;
    const ox = root.x;
    const oy = root.y;
    for (let i = 1; i < tree.nodes.length; i++) {
      const n = tree.nodes[i];
      if (!n) continue;
      n.x = ox + (n.x - ox) * ratio;
      n.y = oy + (n.y - oy) * ratio;
    }
    for (const attractor of tree.attractors) {
      attractor.x = ox + (attractor.x - ox) * ratio;
      attractor.y = oy + (attractor.y - oy) * ratio;
    }
  }
}

const growToolMenu = document.querySelector<HTMLElement>("#grow-tool-menu")!;
const growGirthInput = document.querySelector<HTMLInputElement>("#grow-girth")!;
const growGirthReadout = document.querySelector<HTMLElement>("#grow-girth-readout")!;
const growLengthInput = document.querySelector<HTMLInputElement>("#grow-length")!;
const growLengthReadout = document.querySelector<HTMLElement>("#grow-length-readout")!;
const woodColorRandomBtn =
  document.querySelector<HTMLButtonElement>("#wood-color-random")!;

function syncGrowToolMenu(): void {
  const girth = livePhenotype.stemGirth || 1;
  growGirthInput.value = String(girth);
  growGirthReadout.textContent = formatToolNumber(girth);
  const len = liveConfig.segmentLength;
  growLengthInput.value = String(len);
  growLengthReadout.textContent = formatToolNumber(len);
}

function applyGrowthGirth(girth: number): void {
  livePhenotype.stemGirth = clamp(girth, 0.45, 1.7);
  growGirthReadout.textContent = formatToolNumber(livePhenotype.stemGirth);
  applyLiveToAll();
}

function applyGrowthLength(nextLen: number): void {
  const prevLen = liveConfig.segmentLength;
  const ratio = prevLen > 1e-6 ? nextLen / prevLen : 1;
  stretchLivingWood(ratio);
  liveConfig.segmentLength = nextLen;
  liveConfig.minDistance = clamp(liveConfig.minDistance * ratio, 3, 32);
  liveConfig.maxDistance = clamp(liveConfig.maxDistance * ratio, 24, 180);
  liveConfig.cloudRadius = clamp(
    Math.round((liveConfig.cloudRadius * ratio) / 2) * 2,
    30,
    780,
  );
  growLengthReadout.textContent = formatToolNumber(nextLen);
  applyLiveToAll();
  syncPanelSlider("segmentLength", liveConfig.segmentLength);
  syncPanelSlider("minDistance", liveConfig.minDistance);
  syncPanelSlider("maxDistance", liveConfig.maxDistance);
  syncPanelSlider("cloudRadius", liveConfig.cloudRadius);
}

/** Another bark color. Length and thickness stay. */
function randomizeWoodColor(): void {
  livePhenotype.stemPalette = pick(stemPalettes);
  applyLookChange();
}

growGirthInput.addEventListener("input", () => {
  applyGrowthGirth(Number(growGirthInput.value));
});

growLengthInput.addEventListener("input", () => {
  applyGrowthLength(clamp(Number(growLengthInput.value), 4, 28));
});

woodColorRandomBtn.addEventListener("click", () => {
  randomizeWoodColor();
});

/** Upper tool panels (Crecer, Hojas, Flor). Off until the menus are wanted again. */
const toolMenusEnabled = false;

function setStageTool(next: StageTool | null): void {
  stageTool = next;
  canvas.classList.toggle("tool-armed", next !== null);
  if (next) toolCursor.dataset.tool = next;
  else delete toolCursor.dataset.tool;
  for (const btn of toolButtons) {
    const on = btn.dataset.tool === next;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    if (
      btn.dataset.tool === "grow" ||
      btn.dataset.tool === "leaves" ||
      btn.dataset.tool === "flower"
    ) {
      btn.setAttribute(
        "aria-expanded",
        toolMenusEnabled && on ? "true" : "false",
      );
    }
  }
  growToolMenu.hidden = !toolMenusEnabled || next !== "grow";
  leafToolMenu.hidden = !toolMenusEnabled || next !== "leaves";
  flowerToolMenu.hidden = !toolMenusEnabled || next !== "flower";
  if (toolMenusEnabled && next === "grow") syncGrowToolMenu();
  if (toolMenusEnabled && next === "leaves") syncLeafToolMenu();
  if (toolMenusEnabled && next === "flower") syncFlowerToolMenu();
  syncToolCursor();
}

for (const btn of toolButtons) {
  btn.addEventListener("click", () => {
    const id = btn.dataset.tool;
    if (id !== "grow" && id !== "leaves" && id !== "cut" && id !== "flower") {
      return;
    }
    setStageTool(stageTool === id ? null : id);
  });
}

window.addEventListener(
  "pointermove",
  (e) => {
    trackToolPointer(e.clientX, e.clientY);
  },
  { passive: true },
);

document.documentElement.addEventListener("pointerleave", () => {
  toolCursor.hidden = true;
});

/** Keys still override a latched tool. Otherwise the armed tool is the gesture. */
function gestureFor(e: PointerEvent): Gesture {
  if (e.ctrlKey || e.metaKey) return "cut";
  if (e.shiftKey) return "bloom";
  if (e.altKey) return "leaves";
  if (stageTool === "cut") return "cut";
  if (stageTool === "flower") return "bloom";
  if (stageTool === "leaves") return "leaves";
  return "grow";
}

function applyClickGesture(kind: "cut" | "bloom", x: number, y: number): void {
  for (let i = trees.length - 1; i >= 0; i--) {
    const tree = trees[i]!;
    if (kind === "cut" && tree.cutAt(x, y)) {
      console.log("[cut] ok on tree", i);
      return;
    }
    if (kind === "bloom" && tree.addFlowerAt(x, y)) {
      console.log("[flower] ok on tree", i);
      return;
    }
  }
  console.log(kind === "cut" ? "[cut] miss" : "[flower] miss");
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest?.("#controls, #tools")) return;

  const { x, y } = canvasPoint(e.clientX, e.clientY);
  const gesture = gestureFor(e);
  console.log("[click]", {
    x: Math.round(x),
    y: Math.round(y),
    trees: trees.length,
    gesture,
    tool: stageTool,
  });

  if (gesture === "cut" || gesture === "bloom") {
    e.preventDefault();
    applyClickGesture(gesture, x, y);
    return;
  }

  // Leaf tool, or Alt+drag / Alt+click: paint leaves on wood.
  if (gesture === "leaves") {
    e.preventDefault();
    for (let i = trees.length - 1; i >= 0; i--) {
      const tree = trees[i]!;
      if (!tree.hitsInteractable(x, y)) continue;
      growDrag = {
        tree,
        startX: x,
        startY: y,
        pointerId: e.pointerId,
        dragging: false,
        primed: true,
        lastGrowMs: 0,
        mode: "leaves",
      };
      tree.paintLeavesAt(x, y);
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("painting-leaves");
      return;
    }
    return;
  }

  // Start a potential grow / drag on wood.
  for (let i = trees.length - 1; i >= 0; i--) {
    const tree = trees[i]!;
    if (!tree.hitsInteractable(x, y)) continue;
    growDrag = {
      tree,
      startX: x,
      startY: y,
      pointerId: e.pointerId,
      dragging: false,
      primed: false,
      lastGrowMs: 0,
      mode: "grow",
    };
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  if (plantMode) plantAt(e.clientX, e.clientY);
});

canvas.addEventListener("pointermove", (e) => {
  if (!growDrag || e.pointerId !== growDrag.pointerId) return;
  const { x, y } = canvasPoint(e.clientX, e.clientY);
  const dist = Math.hypot(x - growDrag.startX, y - growDrag.startY);

  if (growDrag.mode === "leaves") {
    if (dist >= DRAG_THRESHOLD) growDrag.dragging = true;
    const now = performance.now();
    if (now - growDrag.lastGrowMs < LEAF_PAINT_INTERVAL_MS) return;
    growDrag.lastGrowMs = now;
    growDrag.tree.paintLeavesAt(x, y);
    return;
  }

  if (!growDrag.dragging && dist >= DRAG_THRESHOLD) {
    growDrag.dragging = true;
    canvas.classList.add("steering");
    // Claim the grabbed limb, then grow a bush toward the pointer.
    growDrag.tree.claimBranchAt(growDrag.startX, growDrag.startY);
    growDrag.primed = true;
    growDrag.tree.steerToward(x, y);
    growDrag.lastGrowMs = performance.now();
    console.log("[steer] drag start");
    return;
  }

  if (!growDrag.dragging) return;
  const now = performance.now();
  if (now - growDrag.lastGrowMs < STEER_INTERVAL_MS) return;
  growDrag.lastGrowMs = now;
  growDrag.tree.steerToward(x, y);
});

canvas.addEventListener("pointerup", (e) => {
  if (!growDrag || e.pointerId !== growDrag.pointerId) return;
  const { x, y } = canvasPoint(e.clientX, e.clientY);
  const drag = growDrag;

  if (drag.mode === "leaves") {
    drag.tree.paintLeavesAt(x, y);
    console.log("[leaves] paint end");
    endGrowDrag();
    return;
  }

  if (!drag.dragging) {
    // Simple click — claim that limb, then nurture it.
    if (
      drag.tree.claimBranchAt(drag.startX, drag.startY) &&
      drag.tree.sproutAt(drag.startX, drag.startY)
    ) {
      console.log("[sprout] ok");
    } else if (drag.tree.sproutAt(drag.startX, drag.startY)) {
      console.log("[sprout] ok");
    } else {
      console.log("[sprout] miss — no branch hit");
      if (plantMode) plantAt(e.clientX, e.clientY);
    }
  } else {
    drag.tree.steerToward(x, y);
    console.log("[steer] drag end");
  }
  endGrowDrag();
});

canvas.addEventListener("pointercancel", (e) => {
  if (!growDrag || e.pointerId !== growDrag.pointerId) return;
  endGrowDrag();
});

window.addEventListener("resize", resize);

rebuildSliders();
enhanceAllSelects();
syncLookSelects();
syncRandomThresholdUi();
reseedSingle();
resize();
requestAnimationFrame(frame);
