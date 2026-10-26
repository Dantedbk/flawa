/**
 * Rooted space-colonization tree (Runions-style).
 *
 * Grows from a fixed root like a plant: tips chase attractors, forks stay
 * attached, the trunk never slides away. Over budget, only outer leaves are
 * shed (and burned) — structure remains a single branching tree.
 */

import { IndexGrid, betterRank } from "./indexGrid";

export type Vec2 = { x: number; y: number };

export type BranchTraits = {
  /** Chance this tip grows when attractors pull it (0.35–1). */
  growthChance: number;
  /** Base Y-fork probability for this tip (~0.12–0.65). */
  forkChance: number;
  /** Soft lifespan in ms — shed odds climb after this age. */
  lifeSpanMs: number;
  /** Multiplier on shed probability (0.35–1.8). */
  deathChance: number;
};

export type TreeNode = {
  x: number;
  y: number;
  parent: number | null;
  children: number[];
  dirX: number;
  dirY: number;
  birth: number;
  /** Wall-clock ms when this node sprouted (`performance.now()`). */
  bornAt: number;
  /** Cached descendant count (self included) for taper. */
  mass: number;
  /** 0→1 grow-in (length/opacity). */
  sprout: number;
  /** 0 = healthy; >0 fading out toward delete at 1. */
  wither: number;
} & BranchTraits;

export type Attractor = Vec2;

export type BurnScar = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bornAt: number;
  /** Stroke width when the shed segment falls. */
  width: number;
  stemStyle: StemStyle;
  stemPalette: StemPalette;
};

/** Leaflet frozen onto the burn layer when its twig dies. */
export type BurnLeaf = {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  tone: number;
  leafStyle: LeafStyle;
  leafPalette: LeafPalette;
  bornAt: number;
};

/** Blossom frozen onto the burn layer when its twig dies. */
export type BurnFlower = {
  x: number;
  y: number;
  angle: number;
  size: number;
  petals: number;
  /** Palette mix 0..1 */
  hue: number;
  flowerStyle: FlowerStyle;
  flowerPalette: FlowerPalette;
  bornAt: number;
};

/** Foliage attached to a twig/tip — drawn as a soft oval leaflet. */
export type Leaf = {
  node: number;
  /** -1 / +1 side of the branch. */
  side: number;
  /** Extra angle from the branch heading. */
  angle: number;
  length: number;
  width: number;
  phase: number;
  /** 0..1 sprout growth. */
  sprout: number;
  /** Olive tone mix 0..1 */
  tone: number;
  bornAt: number;
};

/** Sparse blossom on a tip or light twig. */
export type Flower = {
  node: number;
  angle: number;
  size: number;
  petals: number;
  phase: number;
  sprout: number;
  /** 0 cream → 1 coral */
  hue: number;
  bornAt: number;
};

export type ColonizationConfig = {
  minDistance: number;
  maxDistance: number;
  segmentLength: number;
  maxNodes: number;
  maxChildren: number;
  maxTips: number;
  attractorCount: number;
  cloudRadius: number;
  inertia: number;
  /** Half-angle (rad) of a Y-bifurcation from the tip heading. */
  branchSpread: number;
  /** Which crown architecture the fork and the following growth use. */
  branchPattern: BranchPattern;
  /** Unbranched segments before a tip is forced to split. The pattern adds to this. */
  forkEvery: number;
  /** Global fork tendency; blended with each tip’s own forkChance. */
  tipForkChance: number;
  /** How strongly headings bend toward the sky (canvas -Y). */
  upwardBias: number;
  /** Multiplier on tip shed probability. */
  shedRate: number;
  /** Scales rolled branch lifeSpanMs (decay timing). */
  lifeSpanScale: number;
  /** Scales rolled branch deathChance. */
  deathRate: number;
  /** When true, natural shedding never starts (manual cuts still work). */
  immortal: boolean;
  /** Leaf sprout growth per sim step. */
  leafGrowRate: number;
  /** Multiplier on per-step leaf spawn chance. */
  leafSpawnRate: number;
  /** Flower sprout growth per sim step. */
  flowerGrowRate: number;
  /** Multiplier on per-step flower spawn chance. */
  flowerSpawnRate: number;
  /** Extra chance to bud after a shed (0–1-ish). */
  resproutChance: number;
  /** How fast new stem segments grow in per step. */
  branchGrowRate: number;
  /** How fast marked stems fade out per step before falling. */
  branchFadeRate: number;
};

/**
 * How a tip splits. Numbers (spread, fork spacing) still apply;
 * the pattern chooses the shape of the split and how limbs keep growing.
 * - upright: trunk continues, limbs stay near horizontal
 * - wand: long leader, sparse short spurs
 * - bushy: equal forks, no lasting trunk
 * - willow: trunk rises, limbs hang
 * - dense: short runs and extra side twigs
 * - open: unequal forks, the trunk dissolves into limbs
 */
export type BranchPattern =
  | "upright"
  | "wand"
  | "bushy"
  | "willow"
  | "dense"
  | "open";

/** Visual + foliage personality, rolled once per reseed. */
export type LeafStyle =
  | "oval"
  | "lance"
  | "teardrop"
  | "needle"
  | "round"
  | "heart"
  | "lobed"
  | "fan"
  | "sickle"
  | "diamond"
  | "spatulate"
  | "arrow"
  | "scallop"
  | "trifoil"
  | "spray"
  | "bunch"
  | "willow"
  | "pinnate"
  | "frond";

export type LeafPalette =
  | "olive"
  | "sage"
  | "jade"
  | "copper"
  | "autumn"
  | "seaGlass"
  | "moss";

export type FlowerStyle =
  | "daisy"
  | "cup"
  | "bell"
  | "star"
  | "tube"
  | "pom"
  | "iris"
  | "buttercup"
  | "catkin"
  | "raceme"
  | "cone";

export type FlowerPalette =
  | "creamCoral"
  | "butterAmber"
  | "blushRose"
  | "peachApricot"
  | "ivoryGold"
  | "softBrick"
  | "snowBell"
  | "citrusBloom"
  | "wineBerry"
  | "skyMist"
  | "clayBlush"
  | "honeyDew";

export const flowerStyles: FlowerStyle[] = [
  "daisy",
  "cup",
  "bell",
  "star",
  "tube",
  "pom",
  "iris",
  "buttercup",
  "catkin",
  "raceme",
  "cone",
];

export const leafStyles: LeafStyle[] = [
  "oval",
  "lance",
  "teardrop",
  "needle",
  "round",
  "heart",
  "lobed",
  "fan",
  "sickle",
  "diamond",
  "spatulate",
  "arrow",
  "scallop",
  "trifoil",
  "spray",
  "bunch",
  "willow",
  "pinnate",
  "frond",
];

/** Extra length a style carries on top of the size slider. */
export function leafLengthScale(style: LeafStyle): number {
  switch (style) {
    case "willow":
      return 1.7;
    case "pinnate":
    case "frond":
      return 1.08;
    default:
      return 1;
  }
}

/** How much of the width slider this style keeps. A willow stays a ribbon. */
export function leafWidthScale(style: LeafStyle): number {
  switch (style) {
    case "willow":
      return 0.42;
    case "frond":
      return 1.02;
    case "pinnate":
      return 1;
    default:
      return 1;
  }
}

/** 0 stays on the shoot. 1 points straight down, the way a willow leaf hangs. */
export function leafDroop(style: LeafStyle): number {
  switch (style) {
    case "willow":
      return 0.86;
    case "frond":
      return 0.55;
    default:
      return 0;
  }
}

function wrapPi(delta: number): number {
  let d = delta;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Shoot angle, pulled toward straight down when the leaf hangs. */
export function leafWorldAngle(
  style: LeafStyle,
  shoot: number,
  local: number,
  sway: number,
): number {
  const along = shoot + local + sway;
  const droop = leafDroop(style);
  if (droop === 0) return along;
  const hung = Math.PI / 2 + local * 0.28 + sway;
  return along + wrapPi(hung - along) * droop;
}

/** A blossom that drops under the twig instead of facing along it. */
export function flowerHangs(style: FlowerStyle): boolean {
  return style === "catkin" || style === "raceme";
}

export const leafPalettes: LeafPalette[] = [
  "olive",
  "sage",
  "jade",
  "copper",
  "autumn",
  "seaGlass",
  "moss",
];

export const flowerPalettes: FlowerPalette[] = [
  "creamCoral",
  "butterAmber",
  "blushRose",
  "peachApricot",
  "ivoryGold",
  "softBrick",
  "snowBell",
  "citrusBloom",
  "wineBerry",
  "skyMist",
  "clayBlush",
  "honeyDew",
];

export type StemStyle =
  | "smooth"
  | "gnarled"
  | "vine"
  | "reed"
  | "bamboo"
  | "birch"
  | "twiggy";

export type StemPalette =
  | "ash"
  | "walnut"
  | "cedar"
  | "oliveWood"
  | "copperBark"
  | "paleBirch"
  | "charcoal";

export const stemStyles: StemStyle[] = [
  "smooth",
  "gnarled",
  "vine",
  "reed",
  "bamboo",
  "birch",
  "twiggy",
];

export const stemPalettes: StemPalette[] = [
  "ash",
  "walnut",
  "cedar",
  "oliveWood",
  "copperBark",
  "paleBirch",
  "charcoal",
];

export type TreePhenotype = {
  leafStyle: LeafStyle;
  leafPalette: LeafPalette;
  /** Scales spawned leaflet length. */
  leafLength: number;
  /** Scales spawned leaflet width. */
  leafWidth: number;
  /** Relative density of leaflets on tips. */
  leafDensity: number;
  flowerStyle: FlowerStyle;
  flowerPalette: FlowerPalette;
  /** Scales blossom size. */
  flowerSize: number;
  /** Share of outer tips that carry a blossom. */
  flowerDensity: number;
  /** Petal count bias 0..1 → fewer / more. */
  flowerPetals: number;
  stemStyle: StemStyle;
  stemPalette: StemPalette;
  /** Draw thickness of the wood, independent of segment length. */
  stemGirth: number;
};

export const defaultPhenotype: TreePhenotype = {
  leafStyle: "oval",
  leafPalette: "olive",
  leafLength: 1,
  leafWidth: 1,
  leafDensity: 1,
  flowerStyle: "daisy",
  flowerPalette: "creamCoral",
  flowerSize: 1,
  flowerDensity: 2,
  flowerPetals: 0.5,
  stemStyle: "smooth",
  stemPalette: "oliveWood",
  stemGirth: 1,
};

export const defaultConfig: ColonizationConfig = {
  minDistance: 11,
  maxDistance: 70,
  segmentLength: 12,
  maxNodes: 280,
  maxChildren: 2,
  maxTips: 24,
  attractorCount: 140,
  cloudRadius: 95,
  inertia: 0.4,
  branchSpread: 0.52,
  branchPattern: "open",
  forkEvery: 2,
  tipForkChance: 0.4,
  upwardBias: 0.48,
  shedRate: 0.28 / 3,
  lifeSpanScale: 2.4,
  deathRate: 0.32 / 3,
  immortal: false,
  leafGrowRate: 0.016 / 3,
  leafSpawnRate: 0.32 / 3,
  flowerGrowRate: (0.012 / 3) * 2,
  flowerSpawnRate: (0.28 / 3) * 2,
  resproutChance: 0.2,
  /** Per sim-step at ~12Hz; applied every frame via wall-clock scaling. */
  branchGrowRate: 0.32 / 3,
  branchFadeRate: 0.3 / 3,
};

function normalize(x: number, y: number): Vec2 {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function rollBranchTraits(
  parent: BranchTraits | null,
  lifeSpanScale = 1,
  deathRate = 1,
): BranchTraits {
  // Sometimes inherit with jitter so siblings feel related; else fresh roll.
  if (parent && Math.random() < 0.55) {
    return {
      growthChance: clamp(
        parent.growthChance + (Math.random() - 0.5) * 0.28,
        0.35,
        1,
      ),
      forkChance: clamp(
        parent.forkChance + (Math.random() - 0.5) * 0.22,
        0.12,
        0.65,
      ),
      lifeSpanMs: clamp(
        parent.lifeSpanMs * (0.65 + Math.random() * 0.8) * lifeSpanScale,
        4_000,
        220_000,
      ),
      deathChance: clamp(
        (parent.deathChance + (Math.random() - 0.5) * 0.45) * deathRate,
        0.15,
        2.8,
      ),
    };
  }
  return {
    growthChance: 0.38 + Math.random() * 0.62,
    forkChance: 0.14 + Math.random() * 0.42,
    lifeSpanMs: clamp(
      (8_000 + Math.random() * 110_000) * lifeSpanScale,
      4_000,
      220_000,
    ),
    deathChance: clamp((0.35 + Math.random() * 1.4) * deathRate, 0.15, 2.8),
  };
}

function angleBetween(a: Vec2, b: Vec2): number {
  return Math.acos(clamp(a.x * b.x + a.y * b.y, -1, 1));
}

/** Cap how sharply a tip may bend in one step — cuts zigzag “polyline” growth. */
function limitTurn(from: Vec2, toward: Vec2, maxRad: number): Vec2 {
  const ang = angleBetween(from, toward);
  if (ang <= maxRad || ang < 1e-4) return toward;
  const t = maxRad / ang;
  // Slerp-ish blend on the unit circle.
  return normalize(
    from.x * (1 - t) + toward.x * t,
    from.y * (1 - t) + toward.y * t,
  );
}

function splitClusters(
  origin: Vec2,
  samples: Vec2[],
  forkAngle: number,
): { primary: Vec2; secondary: Vec2 | null } {
  if (samples.length === 0) return { primary: { x: 1, y: 0 }, secondary: null };

  const dirs = samples.map((s) => normalize(s.x - origin.x, s.y - origin.y));
  let mx = 0;
  let my = 0;
  for (const d of dirs) {
    mx += d.x;
    my += d.y;
  }
  let primary = normalize(mx, my);

  let pX = 0;
  let pY = 0;
  let pN = 0;
  let sX = 0;
  let sY = 0;
  let sN = 0;
  for (const d of dirs) {
    if (angleBetween(d, primary) <= forkAngle) {
      pX += d.x;
      pY += d.y;
      pN++;
    } else {
      sX += d.x;
      sY += d.y;
      sN++;
    }
  }

  if (pN === 0 && sN > 0) {
    return { primary: normalize(sX, sY), secondary: null };
  }

  primary = pN > 0 ? normalize(pX, pY) : primary;
  const secondary =
    sN >= 2 && angleBetween(primary, normalize(sX, sY)) >= forkAngle
      ? normalize(sX, sY)
      : null;
  return { primary, secondary };
}

/** Per-reseed lean / silhouette — breaks left-right mirror fans. */
export type GrowthHabit = {
  /** Preferred horizontal lean, -1 left … +1 right. */
  lean: number;
  leanStrength: number;
  seedAngle: number;
  rootXFrac: number;
  rootYFrac: number;
  /** Prefer peeling laterals to this side (-1 left, +1 right). */
  sideBias: number;
  leftSpread: number;
  rightSpread: number;
  /** Skews the sky attractor fan toward one side. */
  fanSkew: number;
};

export function makeRandomHabit(): GrowthHabit {
  const side = Math.random() < 0.5 ? -1 : 1;
  const strong = Math.random() < 0.7;
  const wild = Math.random() < 0.35;
  const habit: GrowthHabit = {
    lean:
      side *
      (wild
        ? 0.7 + Math.random() * 0.3
        : strong
          ? 0.45 + Math.random() * 0.55
          : 0.1 + Math.random() * 0.4),
    leanStrength: wild
      ? 0.45 + Math.random() * 0.5
      : 0.12 + Math.random() * 0.55,
    seedAngle:
      -Math.PI * 0.5 +
      side * (0.2 + Math.random() * (wild ? 1.2 : strong ? 0.95 : 0.5)) +
      (Math.random() - 0.5) * (wild ? 0.55 : 0.3),
    rootXFrac: clamp(0.5 + side * (0.04 + Math.random() * 0.28), 0.18, 0.82),
    rootYFrac: 0.58 + Math.random() * 0.22,
    sideBias:
      side * (wild ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.8),
    leftSpread: wild
      ? 0.35 + Math.random() * 1.85
      : 0.45 + Math.random() * 1.35,
    rightSpread: wild
      ? 0.35 + Math.random() * 1.85
      : 0.45 + Math.random() * 1.35,
    fanSkew:
      side * (wild ? 0.5 + Math.random() * 0.5 : 0.15 + Math.random() * 0.85),
  };
  if (Math.random() < 0.4) {
    const tmp = habit.leftSpread;
    habit.leftSpread = habit.rightSpread;
    habit.rightSpread = tmp;
  }
  // Occasional reverse lean vs side bias for odd silhouettes.
  if (Math.random() < 0.25) habit.sideBias *= -1;
  return habit;
}

export const defaultHabit: GrowthHabit = {
  lean: 0,
  leanStrength: 0.22,
  seedAngle: -Math.PI * 0.5,
  rootXFrac: 0.5,
  rootYFrac: 0.72,
  sideBias: 0,
  leftSpread: 1,
  rightSpread: 1,
  fanSkew: 0,
};

export class SpaceColonizationTree {
  readonly center: Vec2;
  /** Mutable — UI sliders patch fields live. */
  config: ColonizationConfig;
  /** Mutable — UI selects patch fields live. */
  phenotype: TreePhenotype;
  nodes: TreeNode[] = [];
  attractors: Attractor[] = [];
  leaves: Leaf[] = [];
  flowers: Flower[] = [];
  /** Cached in `recomputeMass` — avoid rescanning every draw/step. */
  maxMass = 1;
  /** Bumps on topology change — renderer uses this to rebake GPU wood layers. */
  structureRev = 0;

  private birthCounter = 0;
  private width = 0;
  private height = 0;
  private pad = 40;
  private pendingScars: BurnScar[] = [];
  private pendingBurnLeaves: BurnLeaf[] = [];
  private pendingBurnFlowers: BurnFlower[] = [];
  private readonly maxLeaves = 8000;
  private readonly maxFlowers = 96;
  /** Consecutive steps with no growth — softly raises shed chance. */
  private stallSteps = 0;
  /** After a wither finishes, bud replacements on the next settle. */
  private pendingResprout = 0;
  /** Birth id of the tip currently grown by clicks (−1 = none). */
  private clickTipBirth = -1;
  /** Birth id of the shoot root for the active click bush (−1 = none). */
  private clickShootRootBirth = -1;
  /** Remaining sim steps where the click tip gets growth priority. */
  private clickEnergy = 0;
  /**
   * Autonomous tips pay one per sim step and extend when this reaches the cost.
   * A click pays the whole cost, so the grow tool stays immediate.
   */
  private branchExtendCredit = 9;
  private static readonly BRANCH_EXTEND_COST = 10;
  /** Let click-driven growth briefly ignore maxNodes. */
  private clickIgnoreCap = false;
  /** Open tips / junctions, cell = max influence distance. */
  private readonly attractorGrid = new IndexGrid();
  /** Every node, cell = attractor clearance radius. */
  private readonly bodyGrid = new IndexGrid();
  private habit: GrowthHabit = {
    lean: 0,
    leanStrength: 0.2,
    seedAngle: -Math.PI * 0.5,
    rootXFrac: 0.5,
    rootYFrac: 0.72,
    sideBias: 0,
    leftSpread: 1,
    rightSpread: 1,
    fanSkew: 0,
  };

  constructor(
    center: Vec2,
    config: Partial<ColonizationConfig> = {},
    phenotype: Partial<TreePhenotype> = {},
  ) {
    this.center = { ...center };
    this.config = { ...defaultConfig, ...config };
    this.phenotype = { ...defaultPhenotype, ...phenotype };
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.syncRootToCanvas();
  }

  /** Always index 0 while the tree is alive — fixed botanical root. */
  rootIndex(): number {
    return 0;
  }

  /** Habit label for UI (lean direction). */
  habitLabel(): string {
    const side =
      this.habit.lean < -0.15
        ? "a la izquierda"
        : this.habit.lean > 0.15
          ? "a la derecha"
          : "al centro";
    return side;
  }

  /**
   * Ctrl+click: cut off the branch beyond the hit segment (soft wilt → fall).
   */
  cutAt(x: number, y: number, hitRadius = 48): boolean {
    if (this.nodes.length < 2) return false;
    const hit = this.nearestBranchHit(x, y);
    if (!hit || hit.dist > hitRadius) return false;

    // Sever the distal side of the segment — never the root.
    let cutRoot = hit.child;
    if (cutRoot <= 0) return false;
    // If the child is already a thick trunk fork point, prefer cutting the
    // thinner of child vs walking to a tip from the nearer endpoint.
    const nearParent =
      Math.hypot(x - this.nodes[hit.parent]!.x, y - this.nodes[hit.parent]!.y) <
      Math.hypot(x - this.nodes[hit.child]!.x, y - this.nodes[hit.child]!.y);
    if (
      nearParent &&
      hit.parent > 0 &&
      this.nodes[hit.parent]!.children.length >= 2
    ) {
      // Clicked near a junction: cut the hit child limb only.
      cutRoot = hit.child;
    }

    const doomed = this.collectSubtree(cutRoot);
    if (doomed.length === 0) return false;

    // Soft tip→base wilt so the cut reads as a living plant, not a delete flash.
    doomed.sort((a, b) => this.depth(b) - this.depth(a));
    for (let k = 0; k < doomed.length; k++) {
      const n = this.nodes[doomed[k]!]!;
      if (n.wither > 0) continue;
      n.wither = 0.04 + Math.min(0.55, k * 0.05);
    }

    // Drop click focus if we cut the nurtured shoot.
    if (this.clickTipBirth >= 0) {
      const tip = this.resolveClickTip();
      if (
        tip < 0 ||
        doomed.includes(tip) ||
        this.subtreeContainsBirth(doomed, this.clickShootRootBirth)
      ) {
        this.clickTipBirth = -1;
        this.clickShootRootBirth = -1;
        this.clickEnergy = 0;
      }
    }

    console.log("[cutAt] wilting", doomed.length, "nodes from", cutRoot);
    return true;
  }

  /**
   * Shift+click: place a flower on the nearest wood / tip.
   */
  addFlowerAt(x: number, y: number, hitRadius = 48): boolean {
    if (this.nodes.length < 2) return false;

    let host = this.nearestLivingTip(x, y, 44);
    if (host < 0) {
      const hit = this.nearestBranchHit(x, y);
      if (!hit || hit.dist > hitRadius) return false;
      // Prefer the distal node of the segment.
      host = hit.child;
      if (this.nodes[host]!.wither > 0.5) host = hit.parent;
    }
    if (host <= 0) return false;
    const n = this.nodes[host]!;
    if (n.wither > 0.55) return false;

    // Manual blooms ignore maxFlowers and never evict existing flowers.
    const tip = n.children.length === 0;
    const petalBias = Math.floor(this.phenotype.flowerPetals * 2);
    this.flowers.push({
      node: host,
      angle: Math.random() * Math.PI * 2,
      size:
        (tip ? 10 + Math.random() * 5 : 8 + Math.random() * 3.5) *
        this.phenotype.flowerSize,
      petals: 4 + ((host + n.birth + petalBias) % 3),
      phase: Math.random() * Math.PI * 2,
      sprout: 0.45 + Math.random() * 0.2,
      hue: Math.random(),
      bornAt: performance.now(),
    });
    console.log("[addFlowerAt] flower on node", host);
    return true;
  }

  /**
   * Alt+drag: stamp a burst of leaves on the nearest wood.
   * Returns how many leaves were added.
   */
  paintLeavesAt(x: number, y: number, hitRadius = 56): number {
    if (this.nodes.length < 2) return 0;
    const hit = this.nearestBranchHit(x, y);
    let host = -1;
    if (hit && hit.dist <= hitRadius) {
      host = hit.child > 0 ? hit.child : hit.parent;
    } else {
      host = this.nearestLivingTip(x, y, hitRadius);
    }
    if (host <= 0) return 0;
    if (this.nodes[host]!.wither > 0.6) return 0;

    // Sprinkle on the hit node + a couple neighbors along the shoot.
    const hosts = [host];
    const n = this.nodes[host]!;
    if (n.parent !== null && n.parent > 0) hosts.push(n.parent);
    for (const c of n.children) hosts.push(c);
    if (n.parent !== null) {
      const p = this.nodes[n.parent]!;
      for (const c of p.children) {
        if (c !== host) hosts.push(c);
      }
    }

    // Manual paint ignores maxLeaves and never evicts existing foliage.
    let added = 0;
    const burst = 3 + ((Math.random() * 3) | 0);
    for (let k = 0; k < burst; k++) {
      const h = hosts[(Math.random() * hosts.length) | 0]!;
      const hn = this.nodes[h]!;
      if (hn.wither > 0.55) continue;
      const tip = hn.children.length === 0;
      const side = Math.random() < 0.5 ? -1 : 1;
      const fan = tip ? 0.25 + Math.random() * 0.7 : 0.4 + Math.random() * 0.45;
      const size = this.sproutLeafSize(tip);
      this.leaves.push({
        node: h,
        side,
        angle: side * fan + (Math.random() - 0.5) * 0.3,
        length: size.length,
        width: size.width,
        phase: Math.random() * Math.PI * 2,
        sprout: 0.55 + Math.random() * 0.35,
        tone: Math.random(),
        bornAt: performance.now(),
      });
      added++;
    }
    return added;
  }

  /** Full descendant set of a node (including itself). */
  private collectSubtree(root: number): number[] {
    if (root <= 0 || root >= this.nodes.length) return [];
    const out: number[] = [];
    const stack = [root];
    const seen = new Set<number>();
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (seen.has(idx) || idx <= 0) continue;
      seen.add(idx);
      out.push(idx);
      for (const c of this.nodes[idx]!.children) stack.push(c);
    }
    return out;
  }

  /** True if (x,y) is near wood or an active click shoot (for drag start). */
  hitsInteractable(x: number, y: number, hitRadius = 48): boolean {
    const tip = this.resolveClickTip();
    if (tip >= 0) {
      const tn = this.nodes[tip]!;
      if (Math.hypot(x - tn.x, y - tn.y) < 120) return true;
      if (this.isOnClickShoot(x, y, hitRadius + 16)) return true;
    }
    if (this.nearestLivingTip(x, y, 40) >= 0) return true;
    const hit = this.nearestBranchHit(x, y);
    return !!hit && hit.dist <= hitRadius;
  }

  /**
   * Lock interaction to the limb under (x,y) so drag steers *that* branch,
   * not some other tip of the plant.
   */
  claimBranchAt(x: number, y: number, hitRadius = 52): boolean {
    if (this.nodes.length < 2) return false;

    const tipNear = this.nearestLivingTip(x, y, 38);
    if (tipNear >= 0) {
      this.clickTipBirth = this.nodes[tipNear]!.birth;
      this.clickShootRootBirth = this.limbRootBirth(tipNear);
      this.energizeClickTip(tipNear);
      console.log("[claim] tip", tipNear);
      return true;
    }

    const hit = this.nearestBranchHit(x, y);
    if (!hit || hit.dist > hitRadius) return false;

    const limb = hit.child > 0 ? hit.child : hit.parent;
    if (limb <= 0) return false;
    this.clickShootRootBirth = this.nodes[limb]!.birth;

    const tips = this.tipsInSubtree(limb);
    if (tips.length === 0) {
      if (this.nodes[limb]!.children.length === 0) {
        this.clickTipBirth = this.nodes[limb]!.birth;
        this.energizeClickTip(limb);
        console.log("[claim] limb tip", limb);
        return true;
      }
      return false;
    }
    tips.sort((a, b) => this.depth(b) - this.depth(a));
    const tip = tips[0]!;
    this.clickTipBirth = this.nodes[tip]!.birth;
    this.energizeClickTip(tip);
    console.log("[claim] limb", limb, "tip", tip, "tips", tips.length);
    return true;
  }

  /** Walk up a short way to a fork so we claim a twig, not the whole tree. */
  private limbRootBirth(from: number): number {
    let i: number | null = from;
    let shoot = from;
    let steps = 0;
    let guard = 0;
    while (i !== null && guard++ < this.nodes.length && steps < 8) {
      const n: TreeNode = this.nodes[i]!;
      const p = n.parent;
      if (p === null || p === 0) break;
      if (this.nodes[p]!.children.length >= 2) {
        shoot = i;
        break;
      }
      shoot = i;
      i = p;
      steps++;
    }
    return this.nodes[shoot]!.birth;
  }

  private tipsInSubtree(root: number): number[] {
    const tips: number[] = [];
    const stack = [root];
    const seen = new Set<number>();
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (seen.has(idx) || idx <= 0) continue;
      seen.add(idx);
      const n = this.nodes[idx]!;
      if (n.wither > 0.55) continue;
      if (n.children.length === 0) {
        tips.push(idx);
        continue;
      }
      for (const c of n.children) stack.push(c);
    }
    return tips;
  }

  /**
   * Drag-steer: slowly fill a branching bush toward (x, y) — not a whisker.
   */
  steerToward(x: number, y: number): boolean {
    if (this.resolveClickShootRoot() < 0 && this.resolveClickTip() < 0) {
      if (!this.claimBranchAt(x, y)) return false;
    }
    this.ensureClickShootRoot();
    return this.bushToward(x, y);
  }

  private subtreeContainsBirth(indices: number[], birth: number): boolean {
    if (birth < 0) return false;
    for (const i of indices) {
      if (this.nodes[i]?.birth === birth) return true;
    }
    return false;
  }

  private ensureClickShootRoot(): void {
    if (this.clickShootRootBirth >= 0) {
      for (let i = 0; i < this.nodes.length; i++) {
        if (this.nodes[i]!.birth === this.clickShootRootBirth) return;
      }
      this.clickShootRootBirth = -1;
    }
    const tip = this.resolveClickTip();
    if (tip < 0) return;
    this.clickShootRootBirth = this.limbRootBirth(tip);
  }

  private resolveClickShootRoot(): number {
    if (this.clickShootRootBirth < 0) return -1;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i]!.birth === this.clickShootRootBirth) return i;
    }
    this.clickShootRootBirth = -1;
    return -1;
  }

  /** All living tips belonging to the active click bush. */
  private collectClickBushTips(): number[] {
    const root = this.resolveClickShootRoot();
    const tips: number[] = [];
    if (root < 0) {
      const t = this.resolveClickTip();
      return t >= 0 ? [t] : [];
    }
    const stack = [root];
    const seen = new Set<number>();
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (seen.has(idx)) continue;
      seen.add(idx);
      const n = this.nodes[idx]!;
      if (n.wither > 0.55) continue;
      if (n.children.length === 0) {
        tips.push(idx);
        continue;
      }
      for (const c of n.children) stack.push(c);
    }
    return tips;
  }

  /**
   * Grow a leafy, forking thicket aimed toward the pointer — slow and bushy.
   */
  private bushToward(aimX: number, aimY: number): boolean {
    const tips = this.collectClickBushTips();
    if (tips.length === 0) return false;

    this.seedBushAttractors(tips, aimX, aimY);
    this.clickIgnoreCap = true;

    // Prefer tips that already face the drag, then nearer tips — so left-drag
    // picks a tip that can turn left instead of a crowded upward one.
    tips.sort((a, b) => {
      const na = this.nodes[a]!;
      const nb = this.nodes[b]!;
      const toA = normalize(aimX - na.x, aimY - na.y);
      const toB = normalize(aimX - nb.x, aimY - nb.y);
      const alignA = na.dirX * toA.x + na.dirY * toA.y;
      const alignB = nb.dirX * toB.x + nb.dirY * toB.y;
      const distA = Math.hypot(na.x - aimX, na.y - aimY);
      const distB = Math.hypot(nb.x - aimX, nb.y - aimY);
      // Openness: fewer nearby nodes toward the aim = better.
      const openA = this.opennessToward(a, toA);
      const openB = this.opennessToward(b, toB);
      return openB - openA || alignB - alignA || distA - distB;
    });
    if (tips.length > 2) {
      const lead = tips[0]!;
      const rest = tips.slice(1);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = rest[i]!;
        rest[i] = rest[j]!;
        rest[j] = tmp;
      }
      tips.length = 0;
      tips.push(lead, ...rest);
    }

    const budget = Math.min(3, Math.max(1, 1 + ((tips.length / 2) | 0)));
    let grew = false;

    for (let t = 0; t < budget; t++) {
      const cur = tips[t]!;
      if (cur < 0 || cur >= this.nodes.length) continue;
      const n = this.nodes[cur]!;
      if (n.children.length > 0 || n.wither > 0.5) continue;

      this.energizeClickTip(cur);
      const toAim = normalize(aimX - n.x, aimY - n.y);
      if (this.growTipToward(cur, toAim, t === 0)) {
        grew = true;
      }
    }

    // Crowded tips often can't extend — peel a fresh lateral into open space.
    if (!grew || Math.random() < 0.45) {
      if (this.peelTowardAim(aimX, aimY)) grew = true;
    }

    this.clickIgnoreCap = false;
    this.clickEnergy = Math.max(this.clickEnergy, 22);
    this.nudgeFoliageOnClickShoot();
    for (const tip of tips.slice(0, 5)) {
      if (tip < 0 || tip >= this.nodes.length) continue;
      const prev = this.clickTipBirth;
      this.clickTipBirth = this.nodes[tip]!.birth;
      this.nudgeFoliageOnClickShoot();
      this.clickTipBirth = prev;
    }
    this.updateFoliage();
    if (Math.random() < 0.4) this.updateFlowers();
    return grew || tips.length > 0;
  }

  /** How clear the space is in a direction (higher = more room to grow). */
  private opennessToward(nodeIndex: number, dir: Vec2): number {
    const n = this.nodes[nodeIndex]!;
    const reach = this.config.segmentLength * 3.5;
    let penalty = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      if (i === nodeIndex) continue;
      const o = this.nodes[i]!;
      const dx = o.x - n.x;
      const dy = o.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-3 || d > reach) continue;
      const toward = (dx / d) * dir.x + (dy / d) * dir.y;
      if (toward < 0.15) continue;
      penalty += (1 - d / reach) * toward;
    }
    return 1 / (1 + penalty * 3);
  }

  /** Extend / fork a tip toward `toAim`, retrying angles and looser packing. */
  private growTipToward(cur: number, toAim: Vec2, lead: boolean): boolean {
    const n = this.nodes[cur]!;
    const stepLen = this.config.segmentLength;
    const aimPull = lead ? 0.82 : 0.68;
    const base = normalize(
      n.dirX * (1 - aimPull) + toAim.x * aimPull,
      n.dirY * (1 - aimPull) + toAim.y * aimPull,
    );
    const fans = lead
      ? [0, 0.25, -0.25, 0.5, -0.5, 0.85, -0.85]
      : [0, 0.35, -0.35, 0.7, -0.7];

    for (const fan of fans) {
      let heading = this.rotate(base, fan);
      heading = this.biasHabit(this.biasUpward(heading, 0.06));
      heading = limitTurn({ x: n.dirX, y: n.dirY }, heading, 0.95);

      const run = this.unbranchedRun(cur);
      const wantFork = run >= 1 || Math.random() < 0.7;
      if (wantFork) {
        if (
          this.tryYFork(cur, heading, stepLen) ||
          this.trySideBranch(cur, heading, stepLen)
        ) {
          const host = this.nodes[cur]!;
          if (host.children.length > 0) {
            let best = host.children[0]!;
            let bestDot = -2;
            for (const c of host.children) {
              const cn = this.nodes[c]!;
              const dot = cn.dirX * toAim.x + cn.dirY * toAim.y;
              if (dot > bestDot) {
                bestDot = dot;
                best = c;
              }
            }
            this.clickTipBirth = this.nodes[best]!.birth;
          }
          return true;
        }
      }

      if (this.tryGrow(cur, heading, stepLen)) {
        this.clickTipBirth = this.nodes[this.nodes.length - 1]!.birth;
        return true;
      }
      // Dense wood: force a looser click child toward the open aim.
      if (
        this.placeClickChild(cur, heading, stepLen, {
          maxTurn: 1.2,
          minSep: this.config.segmentLength * 0.22,
          skipSiblingsForSep: true,
          minSiblingAngle: 0.28,
          checkSelfCross: false,
        })
      ) {
        this.clickTipBirth = this.nodes[this.nodes.length - 1]!.birth;
        return true;
      }
    }
    return false;
  }

  /**
   * When tips are boxed in, sprout a new lateral from the claimed limb
   * aimed at the pointer (into empty space).
   */
  private peelTowardAim(aimX: number, aimY: number): boolean {
    const root = this.resolveClickShootRoot();
    if (root < 0) return false;
    const maxChild = this.config.maxChildren;
    const hosts: number[] = [];
    const stack = [root];
    const seen = new Set<number>();
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (seen.has(idx) || idx <= 0) continue;
      seen.add(idx);
      const n = this.nodes[idx]!;
      if (n.wither <= 0.45 && n.children.length < maxChild) hosts.push(idx);
      for (const c of n.children) stack.push(c);
    }
    if (hosts.length === 0) return false;

    hosts.sort((a, b) => {
      const na = this.nodes[a]!;
      const nb = this.nodes[b]!;
      const toA = normalize(aimX - na.x, aimY - na.y);
      const toB = normalize(aimX - nb.x, aimY - nb.y);
      return this.opennessToward(b, toB) - this.opennessToward(a, toA);
    });

    const stepLen = this.config.segmentLength;
    for (const host of hosts.slice(0, 6)) {
      const n = this.nodes[host]!;
      const toAim = normalize(aimX - n.x, aimY - n.y);
      // Side peel strongly toward the drag.
      for (const side of [1, -1]) {
        let heading = this.rotate(
          toAim,
          side * this.config.branchSpread * 0.35,
        );
        heading = normalize(
          toAim.x * 0.75 + heading.x * 0.25,
          toAim.y * 0.75 + heading.y * 0.25,
        );
        heading = this.biasUpward(heading, 0.05);
        if (
          this.placeClickChild(host, heading, stepLen, {
            maxTurn: 1.45,
            minSep: this.config.segmentLength * 0.2,
            skipSiblingsForSep: true,
            minSiblingAngle: 0.3,
            checkSelfCross: false,
          })
        ) {
          const grown = this.nodes.length - 1;
          this.clickTipBirth = this.nodes[grown]!.birth;
          console.log("[peel] lateral from", host, "toward aim");
          return true;
        }
      }
    }
    return false;
  }

  /** Attractor cloud biased toward the drag aim, with enough width for forks. */
  private seedBushAttractors(tips: number[], aimX: number, aimY: number): void {
    const { minDistance, segmentLength, cloudRadius } = this.config;
    const origins = tips.slice(0, 4);
    for (const tip of origins) {
      const n = this.nodes[tip]!;
      const toAim = normalize(aimX - n.x, aimY - n.y);
      const baseAng = Math.atan2(
        n.dirY * 0.18 + toAim.y * 0.82,
        n.dirX * 0.18 + toAim.x * 0.82,
      );
      for (let k = 0; k < 9; k++) {
        // Narrower cone than before — still wide enough to branch.
        const ang = baseAng + (Math.random() - 0.5) * 1.05;
        const r =
          minDistance * 0.85 +
          Math.random() * Math.max(segmentLength * 4.2, cloudRadius * 0.6);
        const ax = n.x + Math.cos(ang) * r;
        const ay = n.y + Math.sin(ang) * r;
        if (
          ax < this.pad ||
          ay < this.pad ||
          ax > this.width - this.pad ||
          ay > this.height - this.pad
        ) {
          continue;
        }
        if (this.nodes[0] && ay > this.nodes[0].y) continue;
        this.attractors.push({ x: ax, y: ay });
      }
    }
  }

  /**
   * Click interaction: start or select a shoot, then let the normal sim
   * develop it (forks, leaves, flowers) — not a forced thin whisker.
   */
  sproutAt(x: number, y: number, hitRadius = 48): boolean {
    if (this.nodes.length < 2) {
      console.log("[sproutAt] skip — too few nodes", this.nodes.length);
      return false;
    }

    let tip = this.resolveClickTip();
    if (tip >= 0) {
      const tn = this.nodes[tip]!;
      const nearTip = Math.hypot(x - tn.x, y - tn.y) < 120;
      const onShoot = this.isOnClickShoot(x, y, hitRadius + 16);
      if (nearTip || onShoot) {
        const ok = this.developClickShoot(tip, x, y, "nurture");
        console.log("[sproutAt] develop active shoot", { tip, ok });
        return ok;
      }
    }

    // Adopt a nearby living tip and develop it.
    const adopt = this.nearestLivingTip(x, y, 40);
    if (adopt >= 0) {
      this.clickTipBirth = this.nodes[adopt]!.birth;
      this.clickShootRootBirth = this.nodes[adopt]!.birth;
      const ok = this.developClickShoot(adopt, x, y, "nurture");
      console.log("[sproutAt] adopt tip", adopt, ok);
      return ok;
    }

    const hit = this.nearestBranchHit(x, y);
    if (!hit) {
      console.log("[sproutAt] no segments");
      return false;
    }
    console.log("[sproutAt] nearest", {
      dist: Math.round(hit.dist * 10) / 10,
      hitRadius,
      parent: hit.parent,
      child: hit.child,
    });
    if (hit.dist > hitRadius) return false;

    // Clicking the active shoot wood → keep developing that tip.
    tip = this.resolveClickTip();
    if (tip >= 0 && this.nodeOnClickShoot(hit.parent)) {
      const ok = this.developClickShoot(tip, x, y, "nurture");
      console.log("[sproutAt] develop (hit own shoot)", ok);
      return ok;
    }

    const maxChild = this.config.maxChildren;
    const order = [hit.parent, hit.child];
    let i: number | null = hit.parent;
    let guard = 0;
    while (i !== null && guard++ < 12) {
      if (!order.includes(i)) order.push(i);
      i = this.nodes[i]!.parent;
    }

    for (const idx of order) {
      const n = this.nodes[idx]!;
      if (n.wither > 0.55) continue;
      if (n.children.length >= maxChild) continue;
      if (this.nodeOnClickShoot(idx)) continue;
      if (this.growClickShoot(idx, x, y, hit.px, hit.py)) {
        tip = this.resolveClickTip();
        if (tip >= 0) this.developClickShoot(tip, x, y, "nurture");
        console.log("[sproutAt] new shoot from host", idx);
        return true;
      }
    }
    console.log("[sproutAt] hit wood but grow failed", { order, maxChild });
    return false;
  }

  /** Find the live tip of the click-grown shoot, if any. */
  private resolveClickTip(): number {
    if (this.clickTipBirth < 0) return -1;
    let found = -1;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i]!.birth === this.clickTipBirth) {
        found = i;
        break;
      }
    }
    if (found < 0) {
      this.clickTipBirth = -1;
      return -1;
    }
    let guard = 0;
    while (
      this.nodes[found]!.children.length === 1 &&
      guard++ < this.nodes.length
    ) {
      found = this.nodes[found]!.children[0]!;
    }
    const tip = this.nodes[found]!;
    if (tip.wither > 0.7) {
      this.clickTipBirth = -1;
      return -1;
    }
    // After a fork, follow one child so we keep nurturing a tip.
    if (tip.children.length > 1) {
      const pick = tip.children[(Math.random() * tip.children.length) | 0]!;
      let t = pick;
      let g = 0;
      while (this.nodes[t]!.children.length === 1 && g++ < this.nodes.length) {
        t = this.nodes[t]!.children[0]!;
      }
      if (
        this.nodes[t]!.children.length === 0 &&
        this.nodes[t]!.wither <= 0.7
      ) {
        this.clickTipBirth = this.nodes[t]!.birth;
        return t;
      }
      this.clickTipBirth = -1;
      return -1;
    }
    this.clickTipBirth = tip.birth;
    return found;
  }

  private nearestLivingTip(x: number, y: number, radius: number): number {
    let best = -1;
    let bestD = radius;
    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i]!;
      if (n.children.length !== 0 || n.wither > 0.4) continue;
      const d = Math.hypot(x - n.x, y - n.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private nodeOnClickShoot(index: number): boolean {
    const tip = this.resolveClickTip();
    if (tip < 0) return false;
    let i: number | null = tip;
    let guard = 0;
    while (i !== null && guard++ < this.nodes.length) {
      if (i === index) return true;
      const n: TreeNode = this.nodes[i]!;
      const p: number | null = n.parent;
      if (p === null) return false;
      if (this.nodes[p]!.children.length >= 2) return p === index;
      i = p;
    }
    return false;
  }

  private isOnClickShoot(x: number, y: number, radius: number): boolean {
    const tip = this.resolveClickTip();
    if (tip < 0) return false;
    let i: number | null = tip;
    let guard = 0;
    while (i !== null && guard++ < this.nodes.length) {
      const n: TreeNode = this.nodes[i]!;
      if (Math.hypot(x - n.x, y - n.y) <= radius) return true;
      const p: number | null = n.parent;
      if (p === null) break;
      const parent = this.nodes[p]!;
      const dx = n.x - parent.x;
      const dy = n.y - parent.y;
      const len2 = dx * dx + dy * dy;
      let t = 0;
      if (len2 > 1e-6) {
        t = clamp(((x - parent.x) * dx + (y - parent.y) * dy) / len2, 0, 1);
      }
      const px = parent.x + dx * t;
      const py = parent.y + dy * t;
      if (Math.hypot(x - px, y - py) <= radius) return true;
      if (parent.children.length >= 2) break;
      i = p;
    }
    return false;
  }

  /** Wake a tip: boost traits, seed attractors, grow/fork via normal sim rules. */
  private developClickShoot(
    tip: number,
    aimX?: number,
    aimY?: number,
    _mode: "nurture" | "steer" = "nurture",
  ): boolean {
    tip = this.resolveClickTip();
    if (tip < 0) return false;
    this.ensureClickShootRoot();

    this.energizeClickTip(tip);
    this.seedDevelopAttractors(tip, aimX, aimY, false);

    const stepLen = this.config.segmentLength;
    this.clickIgnoreCap = true;

    for (let pulse = 0; pulse < 3; pulse++) {
      const cur = this.resolveClickTip();
      if (cur < 0) break;
      const n = this.nodes[cur]!;
      let heading: Vec2 = { x: n.dirX, y: n.dirY };
      if (aimX !== undefined && aimY !== undefined) {
        const toAim = normalize(aimX - n.x, aimY - n.y);
        const fwd = toAim.x * heading.x + toAim.y * heading.y;
        if (fwd > 0.2) {
          heading = normalize(
            heading.x * 0.78 + toAim.x * 0.22,
            heading.y * 0.78 + toAim.y * 0.22,
          );
        }
      }
      heading = this.biasHabit(
        this.biasUpward(this.avoidBody(cur, heading), 0.32),
      );
      heading = limitTurn({ x: n.dirX, y: n.dirY }, heading, 0.4);

      const run = this.unbranchedRun(cur);
      const wantFork = run >= 2 || Math.random() < 0.5 + n.forkChance * 0.35;

      if (wantFork) {
        if (
          this.tryYFork(cur, heading, stepLen) ||
          this.trySideBranch(cur, heading, stepLen)
        ) {
          this.resolveClickTip();
          break;
        }
      }
      if (this.tryGrow(cur, heading, stepLen)) {
        this.clickTipBirth = this.nodes[this.nodes.length - 1]!.birth;
      }
    }

    this.clickIgnoreCap = false;
    this.clickEnergy = Math.max(this.clickEnergy, 20);
    this.nudgeFoliageOnClickShoot();
    this.updateFoliage();
    this.updateFlowers();
    return true;
  }

  private energizeClickTip(tip: number): void {
    const n = this.nodes[tip]!;
    n.growthChance = clamp(Math.max(n.growthChance, 0.92) + 0.05, 0.5, 1);
    n.forkChance = clamp(Math.max(n.forkChance, 0.42) + 0.08, 0.2, 0.75);
    n.lifeSpanMs = Math.max(n.lifeSpanMs, 55_000 * this.config.lifeSpanScale);
    n.deathChance = Math.min(n.deathChance, 0.35);
    n.wither = 0;
    // Also wake a few ancestors so the shoot reads as living wood.
    let p = n.parent;
    let g = 0;
    while (p !== null && g++ < 6) {
      const a = this.nodes[p]!;
      a.growthChance = clamp(a.growthChance + 0.04, 0.4, 1);
      a.deathChance = Math.min(a.deathChance, 0.55);
      p = a.parent;
    }
  }

  private seedDevelopAttractors(
    tip: number,
    aimX?: number,
    aimY?: number,
    strongAim = false,
  ): void {
    const n = this.nodes[tip]!;
    let baseAng = Math.atan2(n.dirY, n.dirX);
    if (aimX !== undefined && aimY !== undefined) {
      const toAim = normalize(aimX - n.x, aimY - n.y);
      const w = strongAim ? 0.85 : 0.35;
      if (strongAim || toAim.x * n.dirX + toAim.y * n.dirY > 0.15) {
        baseAng = Math.atan2(
          n.dirY * (1 - w) + toAim.y * w,
          n.dirX * (1 - w) + toAim.x * w,
        );
      }
    }
    const { minDistance, segmentLength, cloudRadius } = this.config;
    const count = strongAim ? 10 : 14;
    const cone = strongAim ? 0.55 : 1.1;
    for (let k = 0; k < count; k++) {
      const ang = baseAng + (Math.random() - 0.5) * cone;
      const r =
        minDistance * 1.1 +
        Math.random() * Math.max(segmentLength * 3.2, cloudRadius * 0.5);
      const ax = n.x + Math.cos(ang) * r;
      const ay = n.y + Math.sin(ang) * r;
      if (
        ax < this.pad ||
        ay < this.pad ||
        ax > this.width - this.pad ||
        ay > this.height - this.pad
      ) {
        continue;
      }
      if (this.nodes[0] && ay > this.nodes[0].y) continue;
      this.attractors.push({ x: ax, y: ay });
    }
  }

  /** Nudge leaves/flowers onto the active click shoot so it doesn't stay bare. */
  private nudgeFoliageOnClickShoot(): void {
    const tip = this.resolveClickTip();
    if (tip < 0) return;
    const chain: number[] = [];
    let i: number | null = tip;
    let guard = 0;
    while (i !== null && guard++ < 10) {
      chain.push(i);
      const n: TreeNode = this.nodes[i]!;
      const parentIdx: number | null = n.parent;
      if (parentIdx === null) break;
      if (this.nodes[parentIdx]!.children.length >= 2 && i !== tip) break;
      i = parentIdx;
    }

    const dens = this.phenotype.leafDensity;
    for (const idx of chain) {
      const n = this.nodes[idx]!;
      if (n.wither > 0 || n.sprout < 0.5) continue;
      const onTip = n.children.length === 0;
      const have = this.leaves.filter((l) => l.node === idx).length;
      const want = onTip
        ? Math.max(3, Math.round(5 * dens))
        : Math.max(1, Math.round(2 * dens));
      for (let k = have; k < want; k++) {
        if (this.leaves.length >= this.maxLeaves) break;
        if (Math.random() > (onTip ? 0.85 : 0.55)) continue;
        const side = Math.random() < 0.5 ? -1 : 1;
        const size = this.sproutLeafSize(onTip);
        this.leaves.push({
          node: idx,
          side,
          angle: side * (0.35 + Math.random() * 0.55),
          length: size.length,
          width: size.width,
          phase: Math.random() * Math.PI * 2,
          sprout: 0.2 + Math.random() * 0.25,
          tone: Math.random(),
          bornAt: performance.now(),
        });
      }
    }

    const tipNode = this.nodes[tip]!;
    if (
      tipNode.children.length === 0 &&
      this.flowers.length < this.maxFlowers &&
      !this.flowers.some((f) => f.node === tip) &&
      Math.random() < 0.55 * this.config.flowerSpawnRate
    ) {
      const petalBias = Math.floor(this.phenotype.flowerPetals * 2);
      this.flowers.push({
        node: tip,
        angle: Math.random() * Math.PI * 2,
        size: (9 + Math.random() * 5) * this.phenotype.flowerSize,
        petals: 4 + ((tip + tipNode.birth + petalBias) % 3),
        phase: Math.random() * Math.PI * 2,
        sprout: 0.15 + Math.random() * 0.2,
        hue: Math.random(),
        bornAt: performance.now(),
      });
    }
  }

  /** Closest point on any live parent→child segment. */
  nearestBranchHit(
    x: number,
    y: number,
  ): {
    parent: number;
    child: number;
    dist: number;
    px: number;
    py: number;
  } | null {
    let best: {
      parent: number;
      child: number;
      dist: number;
      px: number;
      py: number;
    } | null = null;

    for (let i = 1; i < this.nodes.length; i++) {
      const child = this.nodes[i]!;
      if (child.parent === null) continue;
      if (child.wither > 0.9) continue;
      const parent = this.nodes[child.parent]!;
      const dx = child.x - parent.x;
      const dy = child.y - parent.y;
      const len2 = dx * dx + dy * dy;
      let t = 0;
      if (len2 > 1e-6) {
        t = clamp(((x - parent.x) * dx + (y - parent.y) * dy) / len2, 0, 1);
      }
      const px = parent.x + dx * t;
      const py = parent.y + dy * t;
      const raw = Math.hypot(x - px, y - py);
      // Thicker wood is easier to hit.
      const taper = Math.sqrt(child.mass / Math.max(1, this.maxMass));
      const dist = Math.max(0, raw - (6 + taper * 14));
      if (!best || dist < best.dist) {
        best = { parent: child.parent, child: i, dist, px, py };
      }
    }
    return best;
  }

  /**
   * Force a visible side bud. Normal `tryGrow` rejects mid-branch forks because
   * turn limiting collapses the heading into the existing child.
   */
  private growClickShoot(
    host: number,
    aimX: number,
    aimY: number,
    hitX: number,
    hitY: number,
  ): boolean {
    const n = this.nodes[host]!;
    const step = this.config.segmentLength;
    const along = { x: n.dirX, y: n.dirY };

    // Side of the branch the click sits on (fallback: habit / random).
    const fromHit = { x: aimX - hitX, y: aimY - hitY };
    let side = Math.sign(fromHit.x * -along.y + fromHit.y * along.x);
    if (side === 0) {
      side =
        Math.random() < 0.5 + Math.abs(this.habit.sideBias) * 0.3
          ? Math.sign(this.habit.sideBias) || (Math.random() > 0.5 ? 1 : -1)
          : Math.random() > 0.5
            ? 1
            : -1;
    }

    // Aim: clear spur away from existing children, with a pull toward the click.
    const toAim = normalize(aimX - n.x, aimY - n.y);
    const spreads = [
      this.config.branchSpread * 1.05,
      this.config.branchSpread * 1.35,
      this.config.branchSpread * 0.75,
      0.95,
      1.25,
      0.55,
    ];

    for (const spread of spreads) {
      for (const s of [side, -side]) {
        let heading = this.rotate(along, spread * s);
        // Nudge toward the click if it's clearly off the wood.
        if (Math.hypot(aimX - hitX, aimY - hitY) > 6) {
          heading = normalize(
            heading.x * 0.7 + toAim.x * 0.3,
            heading.y * 0.7 + toAim.y * 0.3,
          );
        }
        heading = this.biasHabit(this.biasUpward(heading, 0.28));
        // Soft body avoid — don't let it kill the fork.
        const avoided = this.avoidBody(host, heading);
        heading = normalize(
          heading.x * 0.65 + avoided.x * 0.35,
          heading.y * 0.65 + avoided.y * 0.35,
        );
        if (this.tryGrowFork(host, heading, step)) {
          const grown = this.nodes.length - 1;
          this.clickTipBirth = this.nodes[grown]!.birth;
          this.clickShootRootBirth = this.nodes[grown]!.birth;
          return true;
        }
      }
    }
    return false;
  }

  /** Place a fork child with looser constraints than sim growth. */
  private tryGrowFork(
    parentIndex: number,
    heading: Vec2,
    step: number,
  ): boolean {
    return this.placeClickChild(parentIndex, heading, step, {
      maxTurn: 1.35,
      minSep: this.config.segmentLength * 0.28,
      skipSiblingsForSep: true,
      minSiblingAngle: 0.38,
      checkSelfCross: false,
    });
  }

  private placeClickChild(
    parentIndex: number,
    heading: Vec2,
    step: number,
    opts: {
      maxTurn: number;
      minSep: number;
      skipSiblingsForSep: boolean;
      minSiblingAngle: number;
      checkSelfCross: boolean;
    },
  ): boolean {
    const parent = this.nodes[parentIndex]!;
    if (parent.children.length >= this.config.maxChildren) return false;

    let turned = limitTurn(
      { x: parent.dirX, y: parent.dirY },
      heading,
      opts.maxTurn,
    );
    let hx = turned.x;
    let hy = turned.y;
    if (hy > 0.65) {
      turned = this.biasUpward({ x: hx, y: hy }, 0.55);
      hx = turned.x;
      hy = turned.y;
    }

    const heldClick = this.holdAboveRoot(parent, hx, hy, step);
    if (!heldClick) return false;
    hx = heldClick.hx;
    hy = heldClick.hy;
    let x = heldClick.x;
    let y = heldClick.y;
    if (this.width > 0 && this.height > 0) {
      if (
        x < this.pad ||
        y < this.pad ||
        x > this.width - this.pad ||
        y > this.height - this.pad
      ) {
        const nx = clamp(x, this.pad, this.width - this.pad);
        const ny = clamp(y, this.pad, this.height - this.pad);
        const bounced = normalize(nx - parent.x, ny - parent.y);
        // Don't accept a bounce that doubles back hard.
        if (bounced.x * parent.dirX + bounced.y * parent.dirY < 0.2) {
          return false;
        }
        hx = bounced.x;
        hy = bounced.y;
        const heldBounce = this.holdAboveRoot(parent, hx, hy, step);
        if (!heldBounce) return false;
        hx = heldBounce.hx;
        hy = heldBounce.hy;
        x = heldBounce.x;
        y = heldBounce.y;
      }
    }

    for (let i = 0; i < this.nodes.length; i++) {
      if (i === parentIndex) continue;
      if (opts.skipSiblingsForSep && parent.children.includes(i)) continue;
      if (
        Math.hypot(x - this.nodes[i]!.x, y - this.nodes[i]!.y) < opts.minSep
      ) {
        return false;
      }
    }

    if (opts.checkSelfCross) {
      // Reject steps that pass near recent ancestors (stops figure-eight curls).
      let a: number | null = parent.parent;
      let guard = 0;
      while (a !== null && guard++ < 14) {
        const an = this.nodes[a]!;
        if (Math.hypot(x - an.x, y - an.y) < step * 0.85) return false;
        a = an.parent;
      }
    }

    for (const ci of parent.children) {
      const sib = this.nodes[ci]!;
      const toSib = normalize(sib.x - parent.x, sib.y - parent.y);
      if (angleBetween(toSib, { x: hx, y: hy }) < opts.minSiblingAngle) {
        return false;
      }
    }

    const traits = rollBranchTraits(
      parent,
      this.config.lifeSpanScale,
      this.config.deathRate,
    );
    // Click buds start vigorous so they develop like the rest of the plant.
    traits.growthChance = clamp(Math.max(traits.growthChance, 0.9), 0.5, 1);
    traits.forkChance = clamp(Math.max(traits.forkChance, 0.4), 0.2, 0.7);
    traits.lifeSpanMs = Math.max(
      traits.lifeSpanMs,
      60_000 * this.config.lifeSpanScale,
    );
    traits.deathChance = Math.min(traits.deathChance, 0.4);
    const index = this.nodes.length;
    this.nodes.push({
      x,
      y,
      parent: parentIndex,
      children: [],
      dirX: hx,
      dirY: hy,
      birth: this.birthCounter++,
      bornAt: performance.now(),
      mass: 1,
      sprout: 0.42 + Math.random() * 0.12,
      wither: 0,
      ...traits,
    });
    parent.children.push(index);
    this.structureRev++;
    this.recomputeMass();
    return true;
  }

  reset(habit?: GrowthHabit): void {
    this.habit = habit ? { ...habit } : makeRandomHabit();
    this.syncRootToCanvas();
    this.beginGrowth();
  }

  /**
   * Plant at a canvas point. Pass a habit to use chosen shape; omit to roll random.
   */
  seedAt(x: number, y: number, habit?: GrowthHabit): void {
    if (habit) this.habit = { ...habit };
    else this.habit = makeRandomHabit();
    if (this.width > 0 && this.height > 0) {
      this.habit.rootXFrac = clamp(x / this.width, 0.05, 0.95);
      this.habit.rootYFrac = clamp(y / this.height, 0.05, 0.95);
    }
    this.syncRootToCanvas();
    this.beginGrowth();
  }

  private beginGrowth(): void {
    const dir = {
      x: Math.cos(this.habit.seedAngle),
      y: Math.sin(this.habit.seedAngle),
    };
    this.birthCounter = 0;
    const now = performance.now();
    // Root: durable, eager grower — laterals roll their own shorter lives.
    this.nodes = [
      {
        x: this.center.x,
        y: this.center.y,
        parent: null,
        children: [],
        dirX: dir.x,
        dirY: dir.y,
        birth: this.birthCounter++,
        bornAt: now,
        mass: 1,
        growthChance: 0.92 + Math.random() * 0.08,
        forkChance: 0.28 + Math.random() * 0.2,
        lifeSpanMs: clamp(
          (90_000 + Math.random() * 80_000) * this.config.lifeSpanScale,
          8_000,
          280_000,
        ),
        deathChance: clamp(
          (0.2 + Math.random() * 0.25) * this.config.deathRate,
          0.08,
          1.5,
        ),
        sprout: 1,
        wither: 0,
      },
    ];
    this.attractors = [];
    this.leaves = [];
    this.flowers = [];
    this.pendingScars = [];
    this.pendingBurnLeaves = [];
    this.pendingBurnFlowers = [];
    this.stallSteps = 0;
    this.pendingResprout = 0;
    this.clickTipBirth = -1;
    this.clickShootRootBirth = -1;
    this.clickEnergy = 0;
    this.clickIgnoreCap = false;
    this.structureRev++;
    this.sproutStems();
    this.refillAttractors(true);
  }

  private syncRootToCanvas(): void {
    if (this.width <= 0 || this.height <= 0) return;
    this.center.x = this.width * this.habit.rootXFrac;
    this.center.y = this.height * this.habit.rootYFrac;
    if (this.nodes.length > 0) {
      this.nodes[0].x = this.center.x;
      this.nodes[0].y = this.center.y;
    }
  }

  takeScars(): BurnScar[] {
    if (this.pendingScars.length === 0) return [];
    const out = this.pendingScars;
    this.pendingScars = [];
    return out;
  }

  takeBurnLeaves(): BurnLeaf[] {
    if (this.pendingBurnLeaves.length === 0) return [];
    const out = this.pendingBurnLeaves;
    this.pendingBurnLeaves = [];
    return out;
  }

  takeBurnFlowers(): BurnFlower[] {
    if (this.pendingBurnFlowers.length === 0) return [];
    const out = this.pendingBurnFlowers;
    this.pendingBurnFlowers = [];
    return out;
  }

  /** Smootherstep for grow/fade visuals (shared with renderer). */
  static ease(t: number): number {
    const x = clamp(t, 0, 1);
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  tips(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].children.length === 0) out.push(i);
    }
    return out;
  }

  /** Depth from root (0 = root). */
  depth(index: number): number {
    let d = 0;
    let i: number | null = index;
    let guard = 0;
    while (i !== null && guard++ < this.nodes.length) {
      if (this.nodes[i].parent === null) return d;
      i = this.nodes[i].parent;
      d++;
    }
    return d;
  }

  /**
   * How far the clear stem rises before the crown algorithm takes over.
   * Counted in segments so a short step still builds a visible trunk.
   */
  private boleSegments(): number {
    const step = Math.max(4, this.config.segmentLength);
    const pattern = this.config.branchPattern;
    const target =
      pattern === "wand"
        ? 150
        : pattern === "upright"
          ? 120
          : pattern === "willow"
            ? 100
            : pattern === "open"
              ? 72
              : pattern === "dense"
                ? 52
                : 40;
    return clamp(Math.round(target / step), 3, 14);
  }

  /** Shrubs leave the ground as several stems. The other patterns keep one trunk. */
  private stemCount(): number {
    return this.config.branchPattern === "bushy" ? 3 : 1;
  }

  private inBole(index: number): boolean {
    return this.depth(index) < this.boleSegments();
  }

  /** Ease the stem upward. The crown keeps the heading it already had. */
  private boleHeading(heading: Vec2, prev: Vec2): Vec2 {
    const raised = this.biasHabit(this.biasUpward(heading, 0.65));
    return limitTurn(prev, raised, 0.26);
  }

  private sproutStems(): void {
    if (this.stemCount() <= 1 || this.nodes.length === 0) return;
    const root = this.nodes[0];
    if (!root) return;
    const base = { x: root.dirX, y: root.dirY };
    const step = this.config.segmentLength;
    for (const angle of [-0.75, 0, 0.75]) {
      const dir = this.biasHabit(this.biasUpward(this.rotate(base, angle), 0.2));
      this.tryGrow(0, dir, step, { maxTurn: 0.95 });
    }
  }

  private unfinished(): number[] {
    const { maxChildren, maxTips } = this.config;
    // Sprout is visual-only — gating sim growth here stalled tips and
    // burned CPU on attractor refill without advancing the crown.
    let livingTips = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.isGrowingTip(i)) livingTips++;
    }
    const allowJunctions = livingTips < maxTips;
    const out: number[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.wither > 0) continue; // fading — no new growth
      if (n.children.length >= maxChildren) continue;
      if (n.children.length === 0 && this.limbRests(i)) continue;
      if (n.children.length === 0 || allowJunctions) out.push(i);
    }
    return out;
  }

  step(): void {
    // Keep the botanical root pinned to the fixed center.
    if (this.nodes.length > 0) {
      this.nodes[0].x = this.center.x;
      this.nodes[0].y = this.center.y;
      this.nodes[0].parent = null;
    }

    const { minDistance, maxDistance, segmentLength, inertia, maxChildren } =
      this.config;

    this.recomputeMass();
    // Grow/fade runs every animation frame (see `tickTransitions`) so it
    // stays smooth even when sim steps are much slower than display Hz.

    if (this.clickEnergy > 0) this.clickEnergy--;

    // Shed by chance (farther / fuller → likelier), same spirit as fork rolls.
    this.maybeShedBranches();

    this.branchExtendCredit +=
      this.clickEnergy > 0
        ? SpaceColonizationTree.BRANCH_EXTEND_COST
        : 1;
    if (this.branchExtendCredit < SpaceColonizationTree.BRANCH_EXTEND_COST) {
      this.updateFoliage();
      this.updateFlowers();
      return;
    }
    this.branchExtendCredit -= SpaceColonizationTree.BRANCH_EXTEND_COST;

    const candidates = this.unfinished();
    if (candidates.length === 0) {
      this.stallSteps++;
      this.refillAttractors(false);
      this.recomputeMass();
      this.updateFoliage();
      this.updateFlowers();
      return;
    }

    // At the node cap, nothing in the pull loop can grow (it breaks on the
    // first tip). Scoring every attractor first was pure work. Click energy
    // still ignores the cap, so that path keeps the full search.
    const atCap =
      this.nodes.length >= this.config.maxNodes && this.clickEnergy <= 0;

    // Share the crown: deep runaway tips are handicapped; lagging tips preferred.
    // Cap how many attractors one tip may claim so growth can't monopile.
    const clickTip = this.clickEnergy > 0 ? this.resolveClickTip() : -1;
    const bushTips =
      this.clickEnergy > 0 ? new Set(this.collectClickBushTips()) : null;
    const tipDepth = new Map<number, number>();
    let avgTipDepth = 0;
    const maxPullsPerTip = 3;

    const pulls = new Map<number, Vec2[]>();
    if (!atCap) {
      let depthSum = 0;
      for (const i of candidates) {
        const d = this.depth(i);
        tipDepth.set(i, d);
        depthSum += d;
      }
      avgTipDepth = depthSum / Math.max(1, candidates.length);
      this.fillAttractorGrid(candidates, maxDistance);
      for (const a of this.attractors) {
        let best = -1;
        let bestScore = Infinity;
        let second = -1;
        let secondScore = Infinity;
        this.attractorGrid.visit(a.x, a.y, (i) => {
          const n = this.nodes[i];
          if (!n) return;
          const dist = Math.hypot(a.x - n.x, a.y - n.y);
          if (dist > maxDistance) return;
          const depth = tipDepth.get(i) ?? 0;
          const lead = Math.max(0, depth - avgTipDepth);
          const lag = Math.max(0, avgTipDepth - depth);
          // Effective distance: punish leaders, reward tips that fell behind.
          let score = (dist * (1 + 0.65 * lead)) / (1 + 0.55 * lag);
          // Click-nurtured bush tips claim attractors eagerly while energized.
          if (this.clickEnergy > 0 && bushTips?.has(i)) score *= 0.32;
          else if (this.clickEnergy > 0 && i === clickTip) score *= 0.28;
          if (betterRank(score, i, bestScore, best)) {
            second = best;
            secondScore = bestScore;
            best = i;
            bestScore = score;
          } else if (betterRank(score, i, secondScore, second)) {
            second = i;
            secondScore = score;
          }
        });
        if (best < 0) continue;
        let target = best;
        const have = pulls.get(best)?.length ?? 0;
        if (have >= maxPullsPerTip && second >= 0) {
          const have2 = pulls.get(second)?.length ?? 0;
          if (have2 < maxPullsPerTip) target = second;
          else continue;
        } else if (have >= maxPullsPerTip) {
          continue;
        }
        const list = pulls.get(target) ?? [];
        list.push(a);
        pulls.set(target, list);
      }
    }

    let leafCount = this.growingTipCount();
    let grew = 0;
    const { branchSpread } = this.config;

    // Grow lagging tips first so a long worm can't keep outrunning the rest.
    const pullOrder = [...pulls.keys()].sort(
      (a, b) => (tipDepth.get(a) ?? 0) - (tipDepth.get(b) ?? 0),
    );

    for (const index of pullOrder) {
      const samples = pulls.get(index);
      if (!samples || samples.length === 0) continue;
      if (this.nodes.length >= this.config.maxNodes && this.clickEnergy <= 0) {
        break;
      }
      const node = this.nodes[index];
      if (node.children.length >= maxChildren) continue;

      // Only tips start new forks; one-child junctions may still open a side.
      const isTip = node.children.length === 0;
      const openingSide = node.children.length === 1;
      if (openingSide && leafCount >= this.config.maxTips) continue;

      const { primary } = splitClusters(node, samples, branchSpread);
      const prev = { x: node.dirX, y: node.dirY };
      let heading = normalize(
        node.dirX * inertia + primary.x * (1 - inertia),
        node.dirY * inertia + primary.y * (1 - inertia),
      );
      // Soft body avoid — full strength reads as frantic dodging.
      const avoided = this.avoidBody(index, heading);
      heading = normalize(
        heading.x * 0.72 + avoided.x * 0.28,
        heading.y * 0.72 + avoided.y * 0.28,
      );
      heading = this.biasHabit(
        this.biasUpward(heading, this.config.upwardBias * 0.85),
      );
      heading = limitTurn(prev, heading, 0.38);

      if (openingSide) {
        if (this.inBole(index)) continue;
        if (Math.random() > node.growthChance) continue;
        const childIndex = node.children[0];
        const child =
          childIndex === undefined ? undefined : this.nodes[childIndex];
        if (!child) continue;
        const trunk = normalize(child.x - node.x, child.y - node.y);
        // True lateral branch — not a parallel worm beside the existing child.
        const prefer =
          Math.random() < 0.5 + Math.abs(this.habit.sideBias) * 0.3
            ? Math.sign(this.habit.sideBias || 1)
            : -Math.sign(this.habit.sideBias || 1);
        let side = this.biasHabit(
          this.biasUpward(
            this.avoidBody(index, this.rotate(heading, branchSpread * prefer)),
            0.38,
          ),
        );
        const pattern = this.config.branchPattern;
        if (
          pattern === "willow" ||
          pattern === "upright" ||
          pattern === "wand"
        ) {
          side = this.limbHeading(side, prev);
        }
        const placement =
          pattern === "willow"
            ? { droop: true, maxTurn: 0.95 }
            : pattern === "upright" || pattern === "wand"
              ? { maxTurn: 0.95 }
              : undefined;
        if (angleBetween(trunk, side) < branchSpread * 0.85) continue;
        if (this.tryGrow(index, side, segmentLength, placement)) {
          grew++;
          leafCount++;
        }
        continue;
      }

      if (!isTip) continue;

      if (this.inBole(index)) {
        if (this.tryGrow(index, this.boleHeading(heading, prev), segmentLength)) {
          grew++;
        }
        continue;
      }

      const pattern = this.config.branchPattern;
      const leader = this.continuesLeader(index);
      if (!leader) heading = this.limbHeading(heading, prev);

      // Per-tip growth chance — sluggish tips often skip a beat.
      if (Math.random() > node.growthChance) continue;

      const run = this.unbranchedRun(index);
      const { forkP, mustBranch } = this.forkUrge(node, run, leader);
      const wantFork = mustBranch || Math.random() < forkP;

      if (wantFork) {
        const tipRoom =
          leafCount < this.config.maxTips ||
          mustBranch ||
          (this.clickEnergy > 0 &&
            (index === clickTip || !!bushTips?.has(index)));
        if (!tipRoom && !mustBranch) continue;
        if (this.tryPatternFork(index, heading, segmentLength)) {
          grew++;
          leafCount = this.growingTipCount();
        } else if (
          tipRoom &&
          this.trySideBranch(index, heading, segmentLength)
        ) {
          // Pattern split blocked — still peel off one lateral instead of a worm.
          grew++;
          leafCount++;
        }
        // Must-branch and still blocked: skip extend (no longer spines).
      } else {
        const droop = pattern === "willow" && !leader;
        const wide =
          !leader &&
          (pattern === "upright" || pattern === "wand" || pattern === "willow");
        if (
          this.tryGrow(
            index,
            heading,
            segmentLength,
            wide ? { droop, maxTurn: 0.4 } : undefined,
          )
        ) {
          grew++;
        }
      }
    }

    if (grew === 0) {
      this.unstickTips(segmentLength);
      this.stallSteps++;
    } else {
      this.stallSteps = 0;
    }

    // Kill / influence only against open tips — classic SCA and far cheaper
    // than scanning every node for every attractor.
    const open = this.unfinished();
    const kill2 = minDistance * minDistance;
    const infl2 = maxDistance * maxDistance;
    this.fillAttractorGrid(open, maxDistance);
    let kept = 0;
    for (let ai = 0; ai < this.attractors.length; ai++) {
      const a = this.attractors[ai];
      if (!a) continue;
      let killed = false;
      let nearOpen = false;
      this.attractorGrid.visit(a.x, a.y, (i) => {
        if (killed) return false;
        const n = this.nodes[i];
        if (!n) return;
        const dx = a.x - n.x;
        const dy = a.y - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= kill2) {
          killed = true;
          return false;
        }
        if (d2 <= infl2) nearOpen = true;
      });
      if (!killed && nearOpen) this.attractors[kept++] = a;
    }
    this.attractors.length = kept;

    this.refillAttractors(false);
    this.recomputeMass();
    this.updateFoliage();
    this.updateFlowers();
  }

  /**
   * Distance along the parent chain to the nearest living tip.
   * 0 = tip itself; higher = deeper toward the trunk.
   */
  private tipDistanceField(maxDist = 8): Int16Array {
    const dist = new Int16Array(this.nodes.length);
    dist.fill(32000);
    for (let t = 0; t < this.nodes.length; t++) {
      const tip = this.nodes[t];
      if (tip.children.length > 0 || tip.wither > 0) continue;
      let i: number | null = t;
      let d = 0;
      while (i !== null && i !== 0 && d <= maxDist) {
        if (d < dist[i]!) dist[i] = d;
        i = this.nodes[i]!.parent;
        d++;
      }
    }
    return dist;
  }

  /**
   * Leaves already on the tree keep the size they had when they sprouted.
   * Lift the short ones up to the current length setting so a thin crown
   * fills in without waiting to be replanted. Longer leaves stay as they are.
   */
  private liftShortLeaves(): void {
    const minLen = 14 * this.phenotype.leafLength;
    if (!(minLen > 0)) return;
    for (const leaf of this.leaves) {
      if (leaf.length >= minLen) continue;
      const scale = minLen / Math.max(leaf.length, 1e-4);
      leaf.length = minLen;
      leaf.width *= scale;
    }
  }

  /** How many leaves this node should carry at the current density. */
  private leafQuota(nodeIndex: number, dens: number, tipDist: number): number {
    const n = this.nodes[nodeIndex];
    if (!n) return 0;
    if (n.children.length === 0) {
      return Math.max(3, Math.round((6 + ((nodeIndex + n.birth) % 3)) * dens));
    }
    if (tipDist <= 1) {
      return Math.max(2, Math.round((3 + ((nodeIndex + n.birth) % 2)) * dens));
    }
    return Math.max(1, Math.round((1.6 + dens * 0.5) * Math.min(1.4, dens)));
  }

  /** Drop leaves past the density quota so a lower setting thins the crown. */
  private trimLeavesToQuota(dens: number, tipDist: Int16Array): void {
    const seen = new Map<number, number>();
    const kept: typeof this.leaves = [];
    for (const leaf of this.leaves) {
      const n = this.nodes[leaf.node];
      if (!n) continue;
      if (n.wither > 0) {
        kept.push(leaf);
        continue;
      }
      const quota = this.leafQuota(leaf.node, dens, tipDist[leaf.node] ?? 99);
      const used = seen.get(leaf.node) ?? 0;
      if (used >= quota) continue;
      seen.set(leaf.node, used + 1);
      kept.push(leaf);
    }
    this.leaves = kept;
  }

  private updateFoliage(): void {
    const maxMass = this.maxMass;
    this.liftShortLeaves();
    // Grow/wilt advances in `tickTransitions` (per frame).

    const dens = this.phenotype.leafDensity;
    // Lush plants dress more of each shoot; sparse ones stay tip-tufted.
    const canopyReach = Math.min(7, 2 + Math.floor(dens * 1.6));
    const keepReach = canopyReach + 1;
    const tipDist = this.tipDistanceField(keepReach);
    let maxDepth = 1;
    let tipCount = 0;
    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.children.length === 0 && n.wither <= 0) tipCount++;
      const d = this.depth(i);
      if (d > maxDepth) maxDepth = d;
    }

    // One share per terminal branch, plus a little for the shoot behind it.
    // A fixed pool fills the interior and leaves the outer limbs bare.
    const perTip = Math.max(3, Math.round(4 * dens));
    const perBehind = Math.max(1, Math.round(1.5 * dens));
    const behindNodes = Math.min(canopyReach, 4);
    const leafCap = Math.min(
      this.maxLeaves,
      Math.max(64, tipCount * (perTip + perBehind * behindNodes)),
    );

    // Shed foliage that no longer sits in the canopy zone (after growth thickens wood).
    this.leaves = this.leaves.filter((leaf) => {
      if (leaf.node <= 0 || leaf.node >= this.nodes.length) return false;
      const n = this.nodes[leaf.node];
      if (n.wither > 0) return true; // let tickTransitions wilt these
      const td = tipDist[leaf.node]!;
      if (td > keepReach) return false;
      if (n.children.length >= 2) return false;
      if (n.mass / maxMass > 0.28 && n.children.length > 0) return false;
      return true;
    });
    this.trimLeavesToQuota(dens, tipDist);

    const counts = new Map<number, number>();
    for (const leaf of this.leaves) {
      counts.set(leaf.node, (counts.get(leaf.node) ?? 0) + 1);
    }

    // Branches that stick out the farthest, not the ones with the most segments.
    const root = this.nodes[0];
    const reachOf = (i: number): number => {
      const n = this.nodes[i];
      if (!n || !root) return 0;
      const dx = n.x - root.x;
      const dy = n.y - root.y;
      return dx * dx + dy * dy;
    };
    const tips: number[] = [];
    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.children.length > 0 || n.wither > 0 || n.sprout <= 0.02) continue;
      if (this.depth(i) < 3) continue;
      tips.push(i);
    }
    tips.sort((a, b) => reachOf(b) - reachOf(a));

    const reclaimInward = (): boolean => {
      let worst = -1;
      let worstReach = Infinity;
      for (let li = 0; li < this.leaves.length; li++) {
        const host = this.leaves[li]?.node;
        if (host === undefined) continue;
        const n = this.nodes[host];
        if (!n) continue;
        if (n.children.length === 0 && (counts.get(host) ?? 0) <= perTip) continue;
        const r = reachOf(host);
        if (r < worstReach) {
          worstReach = r;
          worst = li;
        }
      }
      if (worst < 0) return false;
      const host = this.leaves[worst]?.node;
      if (host === undefined) return false;
      this.leaves.splice(worst, 1);
      counts.set(host, Math.max(0, (counts.get(host) ?? 1) - 1));
      return true;
    };

    let tipShort = false;
    for (const i of tips) {
      const have = counts.get(i) ?? 0;
      if (have >= perTip) continue;
      tipShort = true;
      if (this.leaves.length >= leafCap && !reclaimInward()) break;
      this.placeLeaf(i, have, true);
      counts.set(i, have + 1);
    }
    // Hold the rest of the budget until every terminal branch has its share.
    if (tipShort) return;

    let shootShort = false;
    if (this.leaves.length < leafCap) {
      for (const tip of tips) {
        let i = this.nodes[tip]?.parent ?? null;
        let guard = 0;
        while (i !== null && i !== 0 && guard < behindNodes) {
          const n = this.nodes[i];
          if (!n || n.wither > 0) break;
          if (n.children.length >= 2) break;
          if (n.children.length > 0 && n.mass / maxMass > 0.28) break;
          guard++;
          if (n.sprout <= 0.02) {
            i = n.parent;
            continue;
          }
          const have = counts.get(i) ?? 0;
          if (have < perBehind) {
            shootShort = true;
            if (this.leaves.length < leafCap) {
              this.placeLeaf(i, have, false);
              counts.set(i, have + 1);
            }
          }
          i = n.parent;
        }
      }
    }
    if (shootShort || this.leaves.length >= leafCap) return;

    type Cand = { i: number; score: number; tip: boolean; want: number };
    const cands: Cand[] = [];

    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const tipReady = n.children.length === 0 ? 0.02 : 0.72;
      if (n.wither > 0 || n.sprout < tipReady) continue;
      const td = tipDist[i]!;
      if (td > canopyReach) continue;
      const depth = this.depth(i);
      if (depth < 3) continue;
      const thin = 1 - Math.min(1, n.mass / maxMass);
      const tip = n.children.length === 0;
      const distal = depth / maxDepth;
      // Inner crown wood: skip unless it's a true tip.
      if (!tip && (thin < 0.72 || distal < 0.28)) continue;
      if (tip && distal < 0.22) continue;
      // Fork shoulders stay woody.
      if (n.children.length >= 2) continue;

      let score =
        (tip ? 1.65 : td === 1 ? 0.95 : 0.55 / (1 + td * 0.35)) +
        (2.8 - Math.min(td, 2.8)) * 0.45 +
        thin * 1.15 +
        distal * 1.05;
      if (n.mass / maxMass > 0.18 && !tip) score *= 0.35;

      const want = this.leafQuota(i, dens, td);

      if ((counts.get(i) ?? 0) >= want) continue;
      cands.push({ i, score, tip, want });
    }

    if (cands.length === 0) return;

    const attempts = Math.min(
      120,
      10 +
        tipCount * 4 +
        Math.floor(dens * 18) +
        Math.floor(this.config.leafSpawnRate * 12),
    );
    const spawnMul = Math.min(2.6, dens * 1.15) * this.config.leafSpawnRate;

    for (let a = 0; a < attempts; a++) {
      if (this.leaves.length >= leafCap) break;

      let total = 0;
      const eligible: Cand[] = [];
      for (const c of cands) {
        const have = counts.get(c.i) ?? 0;
        if (have >= c.want) continue;
        if (this.nodes[c.i]!.wither > 0) continue;
        eligible.push(c);
        total += c.score * c.score;
      }
      if (eligible.length === 0 || total <= 0) break;

      let r = Math.random() * total;
      let pick = eligible[0]!;
      for (const c of eligible) {
        r -= c.score * c.score;
        if (r <= 0) {
          pick = c;
          break;
        }
      }

      const have = counts.get(pick.i) ?? 0;
      const chance = Math.min(
        0.95,
        (pick.tip ? 0.82 : pick.score > 1.0 ? 0.55 : 0.32) * spawnMul,
      );
      if (Math.random() > chance) continue;

      this.placeLeaf(pick.i, have, pick.tip);
      counts.set(pick.i, have + 1);
    }
  }

  /** Pixel size of a new leaf before it is drawn. Broad enough to read on the twig. */
  private sproutLeafSize(tip: boolean): { length: number; width: number } {
    const length = tip ? 14 + Math.random() * 7 : 10 + Math.random() * 5;
    const width = tip ? 10 + Math.random() * 6 : 7 + Math.random() * 4;
    return {
      length: length * this.phenotype.leafLength,
      width: width * this.phenotype.leafWidth,
    };
  }

  /** Cluster around a tip; keep twig leaves flatter along the shoot. */
  private placeLeaf(nodeIndex: number, have: number, tip: boolean): void {
    const side = have % 2 === 0 ? 1 : -1;
    const fan = tip ? 0.16 + have * 0.14 : 0.38 + (have % 4) * 0.14;
    const size = this.sproutLeafSize(tip);
    this.leaves.push({
      node: nodeIndex,
      side,
      angle: side * (fan + Math.random() * 0.2),
      length: size.length,
      width: size.width,
      phase: Math.random() * Math.PI * 2,
      sprout: 0.08 + Math.random() * 0.12,
      tone: Math.random(),
      bornAt: performance.now(),
    });
  }

  /** Outer tips, and the thin segment just behind them, that can hold a blossom. */
  private bloomCandidates(): { i: number; score: number; tip: boolean }[] {
    const maxMass = this.maxMass;
    const tipDist = this.tipDistanceField();
    let maxDepth = 1;
    for (let i = 1; i < this.nodes.length; i++) {
      const d = this.depth(i);
      if (d > maxDepth) maxDepth = d;
    }

    const cands: { i: number; score: number; tip: boolean }[] = [];
    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (!n || n.wither > 0 || n.sprout < 0.82) continue;
      const td = tipDist[i] ?? 99;
      if (td > 1) continue;
      const tip = n.children.length === 0;
      if (!tip && td !== 1) continue;
      const depth = this.depth(i);
      if (depth < 5) continue;
      const distal = depth / maxDepth;
      if (distal < 0.5) continue;
      const thin = 1 - Math.min(1, n.mass / maxMass);
      if (!tip && thin < 0.9) continue;
      const score =
        (tip ? 1.5 : 0.45) + thin * 0.8 + distal * 0.9 + (tip ? 0.4 : 0);
      cands.push({ i, score, tip });
    }
    return cands;
  }

  private sproutFlower(nodeIndex: number, tip: boolean): void {
    const n = this.nodes[nodeIndex];
    if (!n || this.flowers.length >= this.maxFlowers) return;
    const petalBias = Math.floor(this.phenotype.flowerPetals * 2);
    this.flowers.push({
      node: nodeIndex,
      angle: Math.random() * Math.PI * 2,
      size:
        (tip ? 9 + Math.random() * 5 : 7 + Math.random() * 3.2) *
        this.phenotype.flowerSize,
      petals: 4 + ((nodeIndex + n.birth + petalBias) % 3),
      phase: Math.random() * Math.PI * 2,
      sprout: 0.12 + Math.random() * 0.15,
      hue: Math.random(),
      bornAt: performance.now(),
    });
  }

  /** Blossoms on the outer crown. Density sets how many of those tips bloom. */
  private updateFlowers(): void {
    const hosts = this.bloomCandidates();
    if (hosts.length === 0) return;

    const dens = this.phenotype.flowerDensity ?? 1;
    const fraction = Math.min(1, Math.max(0.05, dens / 2.8));
    const target = Math.min(
      this.maxFlowers,
      Math.round(hosts.length * fraction),
    );
    const scoreOf = new Map(hosts.map((h) => [h.i, h.score]));

    if (this.flowers.length > target) {
      const ranked = this.flowers.map((flower, index) => ({
        index,
        score: scoreOf.get(flower.node) ?? -1,
      }));
      ranked.sort((a, b) => b.score - a.score);
      const keep = new Set(ranked.slice(0, target).map((row) => row.index));
      this.flowers = this.flowers.filter((_, index) => keep.has(index));
    }

    const occupied = new Set(this.flowers.map((flower) => flower.node));
    const open = hosts
      .filter((host) => !occupied.has(host.i))
      .sort((a, b) => b.score - a.score);
    const room = Math.min(
      target - this.flowers.length,
      Math.max(1, Math.ceil(this.config.flowerSpawnRate * 4)),
    );
    for (let k = 0; k < room && k < open.length; k++) {
      const host = open[k];
      if (!host) break;
      this.sproutFlower(host.i, host.tip);
    }
  }

  /** How many single-child steps sit between this tip and the last fork. */
  private unbranchedRun(tipIndex: number): number {
    let run = 0;
    let i: number | null = tipIndex;
    let guard = 0;
    while (i !== null && guard++ < this.nodes.length) {
      const node: TreeNode = this.nodes[i];
      if (node.parent === null) break;
      const parent: TreeNode = this.nodes[node.parent];
      run++;
      if (parent.children.length >= 2) break;
      i = node.parent;
    }
    return run;
  }

  private rotate(v: Vec2, angle: number): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return normalize(v.x * c - v.y * s, v.x * s + v.y * c);
  }

  /** Canvas Y grows down — pull headings toward -Y (sky / canopy). */
  private biasUpward(heading: Vec2, strength = this.config.upwardBias): Vec2 {
    return normalize(heading.x, heading.y - strength);
  }

  /**
   * A step may hang, but its end stays on the root's line or above it.
   * A tip already below climbs back. Canvas Y grows downward.
   */
  private holdAboveRoot(
    parent: TreeNode,
    hx: number,
    hy: number,
    step: number,
  ): { hx: number; hy: number; x: number; y: number } | null {
    const root = this.nodes[0];
    if (!root || !(step > 0)) return null;
    const len = Math.hypot(hx, hy);
    if (len < 1e-6) return null;
    hx /= len;
    hy /= len;
    const floor = root.y;
    const side = hx < 0 ? -1 : 1;

    if (parent.y > floor) {
      const ny = -Math.min(1, (parent.y - floor) / step);
      const nx = side * Math.sqrt(Math.max(0, 1 - ny * ny));
      return {
        hx: nx,
        hy: ny,
        x: parent.x + nx * step,
        y: parent.y + ny * step,
      };
    }

    const endY = parent.y + hy * step;
    if (endY <= floor) {
      return { hx, hy, x: parent.x + hx * step, y: endY };
    }

    const ny = Math.min(1, Math.max(0, (floor - parent.y) / step));
    const nx = side * Math.sqrt(Math.max(0, 1 - ny * ny));
    return {
      hx: nx,
      hy: ny,
      x: parent.x + nx * step,
      y: parent.y + ny * step,
    };
  }

  /** Pull headings toward this reseed's preferred lean. */
  private biasHabit(heading: Vec2): Vec2 {
    return normalize(
      heading.x + this.habit.lean * this.habit.leanStrength,
      heading.y,
    );
  }

  /** The child that stays closest to its parent's direction. */
  private isPreferredChild(parent: TreeNode, childIndex: number): boolean {
    let best = -1;
    let bestDot = -2;
    for (const c of parent.children) {
      const child = this.nodes[c];
      if (!child) continue;
      const dot = child.dirX * parent.dirX + child.dirY * parent.dirY;
      if (dot > bestDot) {
        bestDot = dot;
        best = c;
      }
    }
    return best === childIndex;
  }

  /**
   * True while this shoot is still the trunk.
   * A limb stays a limb for its whole length, including the straight run after it leaves.
   */
  private continuesLeader(tipIndex: number): boolean {
    let i: number | null = tipIndex;
    let guard = 0;
    while (i !== null && guard++ < this.nodes.length) {
      const node: TreeNode | undefined = this.nodes[i];
      if (!node || node.parent === null) return true;
      const parent: TreeNode | undefined = this.nodes[node.parent];
      if (!parent) return true;
      if (parent.children.length >= 2 && !this.isPreferredChild(parent, i)) {
        return false;
      }
      i = node.parent;
    }
    return true;
  }

  /** Segments from this tip back to where its shoot left the trunk. */
  private limbSpan(tipIndex: number): number {
    let span = 0;
    let i: number | null = tipIndex;
    let guard = 0;
    while (i !== null && guard++ < this.nodes.length) {
      const node: TreeNode | undefined = this.nodes[i];
      if (!node || node.parent === null) break;
      const parent: TreeNode | undefined = this.nodes[node.parent];
      if (!parent) break;
      span++;
      if (parent.children.length >= 2 && !this.isPreferredChild(parent, i)) {
        return span;
      }
      i = node.parent;
    }
    return span;
  }

  /**
   * Upright and wand limbs stop after a short run so the trunk can keep
   * making new ones, instead of a few shoots running out to the node cap.
   */
  private limbRests(index: number): boolean {
    const pattern = this.config.branchPattern;
    if (pattern !== "upright" && pattern !== "wand") return false;
    if (this.continuesLeader(index)) return false;
    const every = Math.max(1, Math.round(this.config.forkEvery));
    const cap = pattern === "wand" ? Math.max(3, every) : every + 4;
    return this.limbSpan(index) >= cap;
  }

  /** A finished spur still ends in a node, but it no longer uses a tip slot. */
  private isGrowingTip(index: number): boolean {
    const n = this.nodes[index];
    if (!n || n.children.length > 0 || n.wither > 0) return false;
    return !this.limbRests(index);
  }

  private growingTipCount(): number {
    let count = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.isGrowingTip(i)) count++;
    }
    return count;
  }

  /**
   * Hold a non-leader limb in the pattern's posture.
   * Applied after the attractor heading so the sky pull cannot erase it.
   */
  private limbHeading(heading: Vec2, prev: Vec2): Vec2 {
    const pattern = this.config.branchPattern;
    const side = Math.sign(heading.x) || Math.sign(prev.x) || 1;
    // Flat limbs for a trunked tree; hanging limbs for willow.
    if (pattern === "upright" || pattern === "wand") {
      return limitTurn(prev, normalize(side, -0.22), 0.34);
    }
    if (pattern === "willow") {
      return limitTurn(prev, normalize(side * 0.55, 0.84), 0.32);
    }
    return heading;
  }

  /** How soon this tip should split, given the crown pattern and whether it leads. */
  private forkUrge(
    node: TreeNode,
    run: number,
    leader: boolean,
  ): { forkP: number; mustBranch: boolean } {
    const pattern = this.config.branchPattern;
    const every = Math.max(1, Math.round(this.config.forkEvery));
    // The slider is the internode. Patterns only nudge it by a segment or two.
    let maxStraight = every + (node.birth % 2);
    if (pattern === "wand" && !leader) maxStraight += 1;
    else if (pattern === "dense" || pattern === "bushy") {
      maxStraight = Math.max(1, every);
    }
    let forkP = Math.min(
      0.92,
      this.config.tipForkChance * 0.8 + node.forkChance * 0.4 + run * 0.1,
    );
    if (pattern === "bushy") forkP = Math.min(0.94, forkP + 0.12);
    else if (pattern === "dense") forkP = Math.min(0.95, forkP + 0.18);
    if (pattern === "wand" && !leader) forkP *= 0.7;
    return { forkP, mustBranch: run >= maxStraight };
  }

  /** Trunk keeps going; one (or two) limbs leave it. */
  private tryLeaderAndLateral(
    parentIndex: number,
    heading: Vec2,
    step: number,
    lateral: number,
    droop: boolean,
    bothSides: boolean,
  ): boolean {
    const parent = this.nodes[parentIndex];
    if (!parent || parent.children.length >= this.config.maxChildren)
      return false;
    const before = parent.children.length;
    this.tryGrow(parentIndex, heading, step);
    const prefer = this.habit.sideBias >= 0 ? 1 : -1;
    const first =
      Math.random() < 0.5 + Math.abs(this.habit.sideBias) * 0.35
        ? prefer
        : -prefer;
    const signs = bothSides ? [first, -first] : [first];
    for (const sign of signs) {
      if (parent.children.length >= this.config.maxChildren) break;
      let dir = this.rotate(heading, sign * lateral);
      const pattern = this.config.branchPattern;
      if (droop) {
        dir = normalize(sign * 0.55, 0.84);
      } else if (pattern === "upright" || pattern === "wand") {
        dir = normalize(sign, -0.22);
      } else {
        dir = this.biasUpward(dir, 0.06);
      }
      dir = this.biasHabit(this.avoidBody(parentIndex, dir));
      const leave =
        droop || pattern === "upright" || pattern === "wand" ? 0.72 : 1.15;
      this.tryGrow(parentIndex, dir, step, {
        maxTurn: leave,
        droop,
      });
    }
    return parent.children.length > before;
  }

  /** Two limbs, neither of them a continuation of the trunk. */
  private tryUnequalFork(
    parentIndex: number,
    heading: Vec2,
    step: number,
  ): boolean {
    const spread = Math.max(0.45, this.config.branchSpread);
    const narrow = Math.max(0.7, spread * 1.05);
    const wide = Math.max(1.15, spread * 1.7);
    const sign = Math.random() < 0.5 ? 1 : -1;
    // Neither arm continues the trunk, so the crown opens instead of rising as a mast.
    const a = this.biasHabit(this.rotate(heading, sign * narrow));
    const b = this.biasHabit(this.rotate(heading, -sign * wide));
    if (
      !this.canPlace(parentIndex, a, step) ||
      !this.canPlace(parentIndex, b, step)
    ) {
      return false;
    }
    const okA = this.tryGrow(parentIndex, a, step, { maxTurn: 1.4 });
    const okB = this.tryGrow(parentIndex, b, step, { maxTurn: 1.4 });
    if (okA && okB) return true;
    if (okA !== okB) this.undoLastChild(parentIndex);
    return false;
  }

  /** Split this tip in the shape its crown pattern asks for. */
  private tryPatternFork(
    parentIndex: number,
    heading: Vec2,
    step: number,
  ): boolean {
    const spread = Math.max(0.45, this.config.branchSpread);
    switch (this.config.branchPattern) {
      case "upright":
        return this.tryLeaderAndLateral(
          parentIndex,
          heading,
          step,
          spread * 1.25,
          false,
          false,
        );
      case "wand":
        return this.tryLeaderAndLateral(
          parentIndex,
          heading,
          step,
          spread * 0.9,
          false,
          false,
        );
      case "willow":
        return this.tryLeaderAndLateral(
          parentIndex,
          heading,
          step,
          spread * 1.05,
          true,
          false,
        );
      case "dense":
        return this.tryLeaderAndLateral(
          parentIndex,
          heading,
          step,
          Math.max(0.7, spread * 0.85),
          false,
          true,
        );
      case "open":
        if (
          Math.random() < 0.72 &&
          this.tryUnequalFork(parentIndex, heading, step)
        ) {
          return true;
        }
        return this.tryLeaderAndLateral(
          parentIndex,
          heading,
          step,
          spread * 1.5,
          false,
          false,
        );
      case "bushy":
        return this.tryYFork(parentIndex, heading, step);
      default:
        return this.tryYFork(parentIndex, heading, step);
    }
  }

  /** Place both arms of a Y, or neither — never a one-sided worm stub. */
  private tryYFork(parentIndex: number, heading: Vec2, step: number): boolean {
    const base = this.config.branchSpread;
    const spreads = [
      { l: base * this.habit.leftSpread, r: base * this.habit.rightSpread },
      {
        l: base * this.habit.leftSpread * 0.85,
        r: base * this.habit.rightSpread * 1.15,
      },
      {
        l: base * this.habit.leftSpread * 1.2,
        r: base * this.habit.rightSpread * 0.85,
      },
      {
        l: base * this.habit.leftSpread * 1.35,
        r: base * this.habit.rightSpread * 1.1,
      },
    ];
    for (const sp of spreads) {
      const left = this.biasHabit(
        this.biasUpward(
          this.avoidBody(parentIndex, this.rotate(heading, -sp.l)),
          0.32,
        ),
      );
      const right = this.biasHabit(
        this.biasUpward(
          this.avoidBody(parentIndex, this.rotate(heading, sp.r)),
          0.32,
        ),
      );
      if (
        !this.canPlace(parentIndex, left, step) ||
        !this.canPlace(parentIndex, right, step)
      ) {
        continue;
      }
      const a = this.tryGrow(parentIndex, left, step);
      const b = this.tryGrow(parentIndex, right, step);
      if (a && b) return true;
      // Roll back a one-sided spur (always the last pushed node).
      if (a !== b) this.undoLastChild(parentIndex);
    }
    return false;
  }

  /** Single lateral peel — used when a full Y won't fit. */
  private trySideBranch(
    parentIndex: number,
    heading: Vec2,
    step: number,
  ): boolean {
    const parent = this.nodes[parentIndex];
    if (parent.children.length >= this.config.maxChildren) return false;
    // Prefer the habit's favored side, with some randomness.
    const prefer = this.habit.sideBias >= 0 ? 1 : -1;
    const side =
      Math.random() < 0.5 + Math.abs(this.habit.sideBias) * 0.35
        ? prefer
        : -prefer;
    const scale = side < 0 ? this.habit.leftSpread : this.habit.rightSpread;
    const spreads = [
      this.config.branchSpread * 1.1 * scale,
      this.config.branchSpread * 1.35 * scale,
      this.config.branchSpread * 0.9 * scale,
    ];
    for (const spread of spreads) {
      const dir = this.biasHabit(
        this.biasUpward(
          this.avoidBody(parentIndex, this.rotate(heading, side * spread)),
          0.36,
        ),
      );
      if (this.tryGrow(parentIndex, dir, step)) return true;
    }
    return false;
  }

  private undoLastChild(parentIndex: number): void {
    const parent = this.nodes[parentIndex];
    const spur = parent.children.pop();
    if (spur === undefined) return;
    if (spur === this.nodes.length - 1) {
      this.nodes.pop();
      return;
    }
    // Fallback if order was disturbed.
    parent.children.push(spur);
    this.deleteIndices([spur]);
  }

  private canPlace(parentIndex: number, heading: Vec2, step: number): boolean {
    const parent = this.nodes[parentIndex];
    const held = this.holdAboveRoot(parent, heading.x, heading.y, step);
    if (!held) return false;
    const x = held.x;
    const y = held.y;
    heading = { x: held.hx, y: held.hy };
    if (
      x < this.pad ||
      y < this.pad ||
      x > this.width - this.pad ||
      y > this.height - this.pad
    ) {
      return false;
    }
    const minSep = this.config.segmentLength * 0.45;
    for (let i = 0; i < this.nodes.length; i++) {
      if (i === parentIndex) continue;
      if (Math.hypot(x - this.nodes[i].x, y - this.nodes[i].y) < minSep) {
        return false;
      }
    }
    for (const ci of parent.children) {
      const sib = this.nodes[ci];
      const toSib = normalize(sib.x - parent.x, sib.y - parent.y);
      if (angleBetween(toSib, heading) < 0.5) return false;
    }
    return true;
  }

  private unstickTips(step: number): void {
    // Stuck tips: a soft chance to shed one distal shoot (never guaranteed).
    if (Math.random() < 0.12) this.maybeShedBranches();
    const tips = this.tips().sort(
      (a, b) => this.nodes[b].birth - this.nodes[a].birth,
    );
    for (const i of tips.slice(0, 3)) {
      if (this.nodes.length + 2 > this.config.maxNodes) break;
      if (i >= this.nodes.length) continue;
      const n = this.nodes[i];
      if (!n || n.children.length !== 0) continue;
      if (this.inBole(i)) {
        this.tryGrow(
          i,
          this.boleHeading({ x: n.dirX, y: n.dirY }, { x: n.dirX, y: n.dirY }),
          step,
        );
        continue;
      }
      const heading = this.biasHabit(
        this.biasUpward({ x: n.dirX, y: n.dirY }, 0.4),
      );
      this.tryYFork(i, heading, step);
    }
    this.attractors = [];
    this.refillAttractors(true);
  }

  private avoidBody(selfIndex: number, heading: Vec2): Vec2 {
    const self = this.nodes[selfIndex];
    if (!self) return heading;
    const range = this.config.segmentLength * 2.5;
    let x = heading.x;
    let y = heading.y;
    for (let i = 0; i < this.nodes.length; i++) {
      if (i === selfIndex || i === self.parent) continue;
      const n = this.nodes[i];
      const dx = self.x - n.x;
      const dy = self.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-3 || d > range) continue;
      const w = (1 - d / range) ** 2 * 0.85;
      x += (dx / d) * w;
      y += (dy / d) * w;
    }
    return normalize(x, y);
  }

  private tryGrow(
    parentIndex: number,
    heading: Vec2,
    step: number,
    placement?: { maxTurn?: number; droop?: boolean },
  ): boolean {
    if (!this.clickIgnoreCap && this.nodes.length >= this.config.maxNodes) {
      return false;
    }
    const parent = this.nodes[parentIndex];
    if (!parent) return false;
    const childCap =
      parentIndex === 0
        ? Math.max(this.config.maxChildren, this.stemCount())
        : this.config.maxChildren;
    if (parent.children.length >= childCap) return false;

    const prev = { x: parent.dirX, y: parent.dirY };
    const maxTurn = placement?.maxTurn ?? 0.4;
    let turned = limitTurn(prev, { x: heading.x, y: heading.y }, maxTurn);
    let hx = turned.x;
    let hy = turned.y;
    // Prefer canopy: bend or refuse steps that point strongly downward.
    // A hanging limb (willow) is allowed to keep its droop.
    if (!placement?.droop && hy > 0.08) {
      if (hy > 0.55 && Math.random() < 0.75) return false;
      if (Math.random() < 0.7) {
        const bent = this.biasUpward({ x: hx, y: hy }, 0.4 + hy * 0.45);
        turned = limitTurn(prev, bent, 0.45);
        hx = turned.x;
        hy = turned.y;
      }
    }
    // Tiny organic wobble — keep bends gentle so limbs read continuous.
    const wobble = (Math.random() - 0.5) * 0.035;
    turned = this.rotate({ x: hx, y: hy }, wobble);
    hx = turned.x;
    hy = turned.y;
    let x = parent.x + hx * step;
    let y = parent.y + hy * step;

    if (
      x < this.pad ||
      y < this.pad ||
      x > this.width - this.pad ||
      y > this.height - this.pad
    ) {
      const nx = clamp(x, this.pad, this.width - this.pad);
      const ny = clamp(y, this.pad, this.height - this.pad);
      const bounced = normalize(nx - parent.x, ny - parent.y);
      hx = bounced.x;
      hy = bounced.y;
      x = parent.x + hx * step;
      y = parent.y + hy * step;
    }

    const held = this.holdAboveRoot(parent, hx, hy, step);
    if (!held) return false;
    hx = held.hx;
    hy = held.hy;
    x = held.x;
    y = held.y;
    if (
      x < this.pad ||
      y < this.pad ||
      x > this.width - this.pad ||
      y > this.height - this.pad
    ) {
      return false;
    }

    const minSep = this.config.segmentLength * 0.45;
    for (let i = 0; i < this.nodes.length; i++) {
      if (i === parentIndex) continue;
      if (Math.hypot(x - this.nodes[i].x, y - this.nodes[i].y) < minSep) {
        return false;
      }
    }

    for (const ci of parent.children) {
      const sib = this.nodes[ci];
      const toSib = normalize(sib.x - parent.x, sib.y - parent.y);
      if (angleBetween(toSib, { x: hx, y: hy }) < 0.5) return false;
    }

    const traits = rollBranchTraits(
      parent,
      this.config.lifeSpanScale,
      this.config.deathRate,
    );
    const index = this.nodes.length;
    this.nodes.push({
      x,
      y,
      parent: parentIndex,
      children: [],
      dirX: hx,
      dirY: hy,
      birth: this.birthCounter++,
      bornAt: performance.now(),
      mass: 1,
      sprout: 0.12 + Math.random() * 0.08,
      wither: 0,
      ...traits,
    });
    parent.children.push(index);
    this.structureRev++;
    return true;
  }

  /** Same keep rule the per-frame foliage filter used to apply unconditionally. */
  private foliageStillLive(node: number, sprout: number): boolean {
    return node >= 0 && node < this.nodes.length && sprout > 0.02;
  }

  /**
   * Grow or wilt foliage, and replace the array only when one of them has
   * fallen through the cutoff or lost its host. Survivors keep their order.
   */
  private advanceFoliage<T extends { node: number; sprout: number }>(
    items: T[],
    grow: number,
    fade: number,
  ): T[] {
    let shed = false;
    for (const item of items) {
      if (item.node >= 0 && item.node < this.nodes.length) {
        const host = this.nodes[item.node];
        if (host.wither > 0) {
          item.sprout = Math.max(0, item.sprout - fade);
        } else if (item.sprout < 1) {
          item.sprout = Math.min(1, item.sprout + grow);
        }
      }
      if (!this.foliageStillLive(item.node, item.sprout)) shed = true;
    }
    if (!shed) return items;
    return items.filter((item) =>
      this.foliageStillLive(item.node, item.sprout),
    );
  }

  /**
   * Advance stem grow-in / fade-out on the display clock (not sim ticks).
   * `dtMs` is frame delta; rates are authored as “per step at 12Hz”.
   */
  tickTransitions(dtMs: number): void {
    const scale = (Math.min(48, Math.max(0, dtMs)) / 1000) * 12;
    if (scale <= 0) return;

    const grow = this.config.branchGrowRate * scale;
    const fade = this.config.branchFadeRate * scale;
    const doomed: number[] = [];

    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.wither > 0) {
        // Ease-in fade — starts soft, finishes cleanly.
        n.wither = Math.min(1, n.wither + fade * (0.7 + n.wither * 0.55));
        if (n.wither >= 1) doomed.push(i);
      } else if (n.sprout < 1) {
        // Ease-out grow — quick start, smooth settle.
        n.sprout = Math.min(1, n.sprout + grow * (1.2 - n.sprout * 0.4));
      }
    }

    // Keep foliage in sync with the same clock so leaves don’t step.
    const leafGrow = this.config.leafGrowRate * scale;
    const leafFade = Math.min(0.12, this.config.branchFadeRate * 0.55) * scale;
    this.leaves = this.advanceFoliage(this.leaves, leafGrow, leafFade);

    const flowerGrow = this.config.flowerGrowRate * scale;
    const flowerFade = leafFade;
    this.flowers = this.advanceFoliage(this.flowers, flowerGrow, flowerFade);

    if (doomed.length > 0) {
      this.deleteIndices(doomed);
      const buds = this.pendingResprout;
      this.pendingResprout = 0;
      for (let k = 0; k < buds; k++) this.encourageStemSprout();
    }
  }

  private fillAttractorGrid(
    indices: readonly number[],
    cellSize: number,
  ): void {
    this.attractorGrid.begin(cellSize);
    for (const i of indices) {
      const n = this.nodes[i];
      if (!n) continue;
      this.attractorGrid.add(i, n.x, n.y);
    }
  }

  private fillBodyGrid(cellSize: number): void {
    this.bodyGrid.begin(cellSize);
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (!n) continue;
      this.bodyGrid.add(i, n.x, n.y);
    }
  }

  /** True when some node is strictly inside `radius` of (x, y). */
  private blockedByBody(x: number, y: number, radius: number): boolean {
    const r2 = radius * radius;
    let blocked = false;
    this.bodyGrid.visit(x, y, (i) => {
      const n = this.nodes[i];
      if (!n) return;
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy < r2) {
        blocked = true;
        return false;
      }
    });
    return blocked;
  }

  /**
   * Crown field: attractors mostly above / outward from tips so growth
   * reads as a canopy, not a ground scribble.
   */
  private refillAttractors(openBias: boolean): void {
    const need = this.config.attractorCount - this.attractors.length;
    if (need <= 0) return;

    const tips = this.tips();
    if (tips.length === 0) return;

    const { minDistance, cloudRadius, segmentLength } = this.config;
    let added = 0;
    const attempts = need * 12;

    // Seed clouds around lagging tips more often than deep leaders.
    const depths = tips.map((i) => this.depth(i));
    const maxD = Math.max(...depths, 1);
    const weights = depths.map((d) => {
      const lag = (maxD - d + 1) / (maxD + 1);
      return Math.pow(lag, 1.6) + 0.08;
    });
    let weightSum = 0;
    for (const w of weights) weightSum += w;

    const pickTip = (): number => {
      let r = Math.random() * weightSum;
      for (let t = 0; t < tips.length; t++) {
        r -= weights[t]!;
        if (r <= 0) return tips[t]!;
      }
      return tips[tips.length - 1]!;
    };

    const spread = this.config.branchSpread;
    const clearR = minDistance * 0.9;
    this.fillBodyGrid(clearR);
    for (let n = 0; n < attempts && added < need; n++) {
      const tip = this.nodes[pickTip()];
      const base = Math.atan2(tip.dirY, tip.dirX);

      // Skyward fan, skewed by habit so the crown isn't a mirror.
      let angle: number;
      const roll = Math.random();
      const skew = this.habit.fanSkew * 0.85;
      if (roll < 0.55 || openBias) {
        angle = -Math.PI * 0.5 + skew + (Math.random() - 0.5) * 1.2;
      } else if (roll < 0.85) {
        const side =
          Math.random() < 0.5 + this.habit.sideBias * 0.3
            ? Math.sign(this.habit.sideBias || 1)
            : -Math.sign(this.habit.sideBias || 1);
        angle = base + side * spread + (Math.random() - 0.5) * 0.3;
        angle = angle * 0.5 + (-Math.PI * 0.5 + skew) * 0.5;
      } else {
        angle = base + skew * 0.4 + (Math.random() - 0.5) * 0.65;
      }

      const r =
        minDistance * 1.2 +
        Math.random() * Math.max(segmentLength, cloudRadius - minDistance);
      const x = tip.x + Math.cos(angle) * r;
      const y = tip.y + Math.sin(angle) * r;

      if (
        x < this.pad ||
        y < this.pad ||
        x > this.width - this.pad ||
        y > this.height - this.pad
      ) {
        continue;
      }
      // Mostly discard attractors that sit clearly below the tip.
      if (y > tip.y + r * 0.2 && Math.random() < 0.82) continue;
      if (y > this.nodes[0].y) continue;

      if (this.blockedByBody(x, y, clearR)) continue;

      this.attractors.push({ x, y });
      added++;
    }
  }

  /** Heaviest-child path from the root — the visual “main stem”. */
  private mainStemPath(): number[] {
    if (this.nodes.length === 0) return [];
    const path = [0];
    let i = 0;
    let guard = 0;
    while (guard++ < this.nodes.length) {
      const kids = this.nodes[i].children;
      if (kids.length === 0) break;
      let best = kids[0];
      for (const c of kids) {
        if (this.nodes[c].mass > this.nodes[best].mass) best = c;
      }
      path.push(best);
      i = best;
    }
    return path;
  }

  /**
   * Chance-based shed: each tip rolls independently (like tipForkChance).
   * Farther, thinner, lateral tips win more often; fullness / stall only
   * raise the odds — they never force a drop.
   */
  private maybeShedBranches(): void {
    if (this.config.immortal) return;
    if (this.nodes.length < 20) return;
    const tips = this.tips().filter((i) => i > 0);
    if (tips.length < 2) return;

    const stem = new Set(this.mainStemPath());
    let maxDepth = 1;
    for (const tip of tips) {
      const d = this.depth(tip);
      if (d > maxDepth) maxDepth = d;
    }
    const maxMass = this.maxMass;
    const nodePressure = clamp(
      this.nodes.length / Math.max(1, this.config.maxNodes),
      0,
      1.25,
    );
    const tipPressure = clamp(
      tips.length / Math.max(1, this.config.maxTips),
      0,
      1.25,
    );
    const stallBoost = clamp(this.stallSteps / 100, 0, 1);

    // Random order so the same tip isn't always favored.
    for (let n = tips.length - 1; n > 0; n--) {
      const j = (Math.random() * (n + 1)) | 0;
      const tmp = tips[n]!;
      tips[n] = tips[j]!;
      tips[j] = tmp;
    }

    const now = performance.now();
    for (const tip of tips) {
      const n = this.nodes[tip];
      if (n.wither > 0 || n.sprout < 0.85) continue;
      const d = this.depth(tip);
      if (d < 4) continue;
      const distal = (d / maxDepth) ** 2;
      const thin = 1 - Math.min(1, n.mass / maxMass);
      const lateral = stem.has(tip) ? 0.22 : 1;
      // Per-branch lifespan: young tips cling on; past lifeSpanMs they shed faster.
      const ageT = (now - n.bornAt) / Math.max(1, n.lifeSpanMs);
      const ageBoost =
        ageT < 1
          ? 0.25 + 0.75 * ageT * ageT
          : 1.15 + Math.min(2.2, (ageT - 1) * 1.4);
      const p =
        ((0.003 + 0.018 * distal * thin) * lateral +
          0.012 * nodePressure * distal * lateral +
          0.01 * tipPressure * distal +
          0.014 * stallBoost * distal * lateral) *
        n.deathChance *
        ageBoost *
        this.config.shedRate;

      if (Math.random() < p) {
        this.killDistalAndResprout(tip);
        return;
      }
    }
  }

  /**
   * Begin fading a distal shoot; delete + resprout happen when wither finishes.
   */
  private killDistalAndResprout(tipIndex: number): void {
    if (tipIndex <= 0 || tipIndex >= this.nodes.length) return;
    if (this.nodes[tipIndex].children.length > 0) return;
    if (this.nodes[tipIndex].wither > 0) return;

    const maxMass = this.maxMass;
    const extreme =
      this.depth(tipIndex) >= 8 && this.nodes[tipIndex].mass / maxMass < 0.12;
    // Sometimes clip a short spur, sometimes a whole thin cluster.
    const takeCluster = extreme && Math.random() < 0.65;
    const chain = takeCluster
      ? this.collectExtremeSubtree(tipIndex)
      : this.collectDistalShoot(tipIndex);
    if (chain.length === 0) return;

    // Soft tip→base wilt wave.
    chain.sort((a, b) => this.depth(b) - this.depth(a));
    for (let k = 0; k < chain.length; k++) {
      const n = this.nodes[chain[k]!];
      if (n.wither > 0) continue;
      n.wither = 0.015 + k * 0.07;
    }

    let buds = 1;
    if (Math.random() < this.config.resproutChance) buds++;
    if (Math.random() < this.config.resproutChance * 0.45) buds++;
    this.pendingResprout += buds;
  }

  /** Tip + single-child ancestors up to (but not into) a fork or the stem. */
  private collectDistalShoot(tipIndex: number): number[] {
    const stem = new Set(this.mainStemPath());
    const chain: number[] = [];
    let i: number | null = tipIndex;
    let guard = 0;
    while (i !== null && i !== 0 && guard++ < this.nodes.length) {
      // Keep the main stem intact — only clip its very tip if selected.
      if (stem.has(i) && chain.length > 0) break;
      chain.push(i);
      const parentIdx: number | null = this.nodes[i].parent;
      if (parentIdx === null || parentIdx === 0) break;
      const p = this.nodes[parentIdx];
      if (p.children.length >= 2) break;
      if (stem.has(parentIdx)) break;
      i = parentIdx;
      if (chain.length >= 2) break;
    }
    return chain;
  }

  /**
   * Whole thin distal cluster (including small Y-forks) above thicker wood.
   * This is the “extreme stem” the canopy sheds when growth stalls.
   */
  private collectExtremeSubtree(tipIndex: number): number[] {
    const maxMass = this.maxMass;
    const stem = new Set(this.mainStemPath());
    let i: number | null = tipIndex;
    let shedRoot = tipIndex;
    let guard = 0;

    while (i !== null && i !== 0 && guard++ < this.nodes.length) {
      const cur: number = i;
      if (stem.has(cur)) break;
      if (this.nodes[cur].mass / maxMass >= 0.08) break;
      if (this.depth(cur) < 6) break;
      shedRoot = cur;
      const parentIdx: number | null = this.nodes[cur].parent;
      if (parentIdx === null || parentIdx === 0) break;
      if (stem.has(parentIdx)) break;
      const parent = this.nodes[parentIdx];
      if (parent.mass / maxMass >= 0.08) break;
      // Stop before a fork that still feeds a much heavier sibling.
      if (parent.children.length >= 2) {
        const heavierOther = parent.children.some(
          (c) => c !== cur && this.nodes[c].mass > this.nodes[cur].mass * 2.2,
        );
        if (heavierOther) break;
      }
      i = parentIdx;
    }

    // Collect the full distal cluster — never truncate, or leftovers float.
    const out: number[] = [];
    const stack = [shedRoot];
    const seen = new Set<number>();
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (seen.has(idx) || idx <= 0) continue;
      seen.add(idx);
      out.push(idx);
      for (const c of this.nodes[idx].children) stack.push(c);
    }
    return out;
  }

  /**
   * After a distal death, roll a weighted resprout: hosts closer to the
   * start stem (root / lower main trunk) are far more likely to bud.
   */
  private encourageStemSprout(): void {
    this.recomputeMass();
    if (this.nodes.length < 2) return;

    const maxChild = this.config.maxChildren;
    const stem = this.mainStemPath();
    const stemIndex = new Map<number, number>();
    for (let s = 0; s < stem.length; s++) stemIndex.set(stem[s]!, s);

    const hosts: number[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].children.length >= maxChild) continue;
      hosts.push(i);
    }
    if (hosts.length === 0) return;

    // Weight ∝ closeness to start stem — steep falloff with depth / stem index.
    let total = 0;
    const weights = new Array<number>(hosts.length);
    for (let h = 0; h < hosts.length; h++) {
      const i = hosts[h]!;
      const d = this.depth(i);
      const onStem = stemIndex.has(i);
      const si = stemIndex.get(i) ?? stem.length;
      const depthW = 1 / Math.pow(d + 1, 2.4);
      const stemW = onStem
        ? 1 / Math.pow(si + 1, 1.6)
        : 0.12 / Math.pow(d + 1, 1.2);
      // Root itself can open a side shoot; slight extra pull for the first trunk nodes.
      const baseBoost = i === 0 ? 1.35 : si <= 3 ? 1.2 : 1;
      const w = Math.max(0.0001, depthW * (0.35 + stemW) * baseBoost);
      weights[h] = w;
      total += w;
    }

    let pick = Math.random() * total;
    let host = hosts[0]!;
    for (let h = 0; h < hosts.length; h++) {
      pick -= weights[h]!;
      if (pick <= 0) {
        host = hosts[h]!;
        break;
      }
    }

    const n = this.nodes[host];
    const side = Math.random() > 0.5 ? 1 : -1;
    const spread =
      this.config.branchSpread * (0.85 + Math.random() * 0.45) * side;
    const prefer =
      Math.random() < 0.5 + Math.abs(this.habit.sideBias) * 0.3
        ? Math.sign(this.habit.sideBias || side)
        : side;
    let heading = this.rotate(
      { x: n.dirX, y: n.dirY },
      Math.abs(spread) * prefer,
    );
    heading = this.biasHabit(
      this.biasUpward(this.avoidBody(host, heading), 0.48),
    );

    const baseAng = Math.atan2(heading.y, heading.x);
    const { minDistance, segmentLength, cloudRadius } = this.config;
    // More attractors when budding near the start stem.
    const nearBase = this.depth(host) <= 4;
    const attractorN = nearBase ? 12 : 7;
    for (let k = 0; k < attractorN; k++) {
      const ang = baseAng + (Math.random() - 0.5) * (nearBase ? 0.95 : 0.7);
      const r =
        minDistance * 1.15 +
        Math.random() *
          Math.max(segmentLength * 2, cloudRadius * (nearBase ? 0.55 : 0.35));
      const x = n.x + Math.cos(ang) * r;
      const y = n.y + Math.sin(ang) * r;
      if (
        x < this.pad ||
        y < this.pad ||
        x > this.width - this.pad ||
        y > this.height - this.pad
      ) {
        continue;
      }
      if (y > this.nodes[0].y) continue;
      this.attractors.push({ x, y });
    }

    // Near the start stem, always try an immediate bud; farther hosts are chancier.
    const sproutChance = clamp(1.15 - this.depth(host) * 0.12, 0.25, 1);
    const tipRoom =
      this.tips().length < this.config.maxTips || this.depth(host) <= 3;
    if (
      n.children.length < maxChild &&
      tipRoom &&
      Math.random() < sproutChance
    ) {
      this.tryGrow(host, heading, segmentLength);
    }
  }

  private recomputeMass(): void {
    for (const n of this.nodes) n.mass = 1;
    // Post-order: process higher indices first (children born after parents).
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const p = this.nodes[i].parent;
      if (p !== null) this.nodes[p].mass += this.nodes[i].mass;
    }
    let max = 1;
    for (const n of this.nodes) if (n.mass > max) max = n.mass;
    this.maxMass = max;
  }

  private deleteIndices(indices: number[]): void {
    const remove = new Set<number>();
    for (const i of indices) {
      if (i > 0 && i < this.nodes.length) remove.add(i);
    }
    // Cascade via children (BFS) — same orphan-safety as scanning parents.
    const queue = [...remove];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]!;
      for (const c of this.nodes[i].children) {
        if (!remove.has(c)) {
          remove.add(c);
          queue.push(c);
        }
      }
    }
    if (remove.size === 0) return;
    this.structureRev++;

    const maxMass = this.maxMass;
    const doomed = [...remove];

    for (const i of doomed) {
      const n = this.nodes[i];
      if (n.parent !== null && !remove.has(n.parent)) {
        const p = this.nodes[n.parent];
        const t = Math.sqrt(n.mass / maxMass);
        this.pendingScars.push({
          x1: p.x,
          y1: p.y,
          x2: n.x,
          y2: n.y,
          bornAt: n.bornAt,
          width: 1.1 + t * 6.5,
          stemStyle: this.phenotype.stemStyle,
          stemPalette: this.phenotype.stemPalette,
        });
        // Occasional dried leaflet — avoid debris storms on big sheds.
        if (doomed.length <= 4 && Math.random() < 0.4) {
          this.scatterBurnLeavesOnSegment(p.x, p.y, n.x, n.y, 1);
        }
      }
    }

    // Freeze living foliage on doomed hosts onto the burn layer.
    for (const leaf of this.leaves) {
      if (!remove.has(leaf.node)) continue;
      if (leaf.node <= 0 || leaf.node >= this.nodes.length) continue;
      const host = this.nodes[leaf.node];
      const base = Math.atan2(host.dirY, host.dirX);
      const ang = leafWorldAngle(this.phenotype.leafStyle, base, leaf.angle, 0);
      const grown = Math.max(0.35, leaf.sprout);
      const len = leaf.length * (0.35 + 0.65 * grown);
      const shownLen = len * leafLengthScale(this.phenotype.leafStyle);
      this.pendingBurnLeaves.push({
        x: host.x + Math.cos(ang) * shownLen * 0.55,
        y: host.y + Math.sin(ang) * shownLen * 0.55,
        angle: ang,
        length: len,
        width: leaf.width * (0.4 + 0.6 * grown),
        tone: leaf.tone,
        leafStyle: this.phenotype.leafStyle,
        leafPalette: this.phenotype.leafPalette,
        bornAt: leaf.bornAt,
      });
    }

    for (const flower of this.flowers) {
      if (!remove.has(flower.node)) continue;
      if (flower.node <= 0 || flower.node >= this.nodes.length) continue;
      const host = this.nodes[flower.node];
      const grown = Math.max(0.4, flower.sprout);
      this.pendingBurnFlowers.push({
        x: host.x + host.dirX * 3,
        y: host.y + host.dirY * 3,
        angle: flower.angle,
        size: flower.size * grown,
        petals: flower.petals,
        hue: flower.hue,
        flowerStyle: this.phenotype.flowerStyle,
        flowerPalette: this.phenotype.flowerPalette,
        bornAt: flower.bornAt,
      });
    }

    // Detach doomed nodes from surviving parents before compacting.
    for (const i of doomed) {
      const n = this.nodes[i];
      if (n.parent !== null && !remove.has(n.parent)) {
        const p = this.nodes[n.parent];
        p.children = p.children.filter((c) => c !== i);
      }
    }

    const remap = new Map<number, number>();
    const next: TreeNode[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (remove.has(i)) continue;
      remap.set(i, next.length);
      next.push(this.nodes[i]);
    }

    for (const n of next) {
      if (n.parent !== null) {
        const mapped = remap.get(n.parent);
        // Survivors must keep a living parent; cascade above guarantees this.
        n.parent = mapped === undefined ? null : mapped;
      }
      n.children = n.children
        .filter((c) => !remove.has(c))
        .map((c) => remap.get(c)!)
        .filter((c) => c !== undefined);
    }

    // Ensure root stays index 0.
    if (next.length > 0) {
      next[0].parent = null;
    }

    this.nodes = next;
    this.rebuildChildren();

    // Remap foliage onto surviving hosts; burned ones already stamped.
    this.leaves = this.leaves
      .filter((l) => !remove.has(l.node))
      .map((l) => ({ ...l, node: remap.get(l.node)! }))
      .filter((l) => l.node !== undefined);

    this.flowers = this.flowers
      .filter((f) => !remove.has(f.node))
      .map((f) => ({ ...f, node: remap.get(f.node)! }))
      .filter((f) => f.node !== undefined);
  }

  /** A few dried leaflets along a scar so bare dead twigs still read as canopy. */
  private scatterBurnLeavesOnSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    count: number,
  ): void {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    for (let k = 0; k < count; k++) {
      const t = 0.25 + Math.random() * 0.55;
      const side = k % 2 === 0 ? 1 : -1;
      const leafAng = ang + side * (0.6 + Math.random() * 0.55);
      const len = 4.5 + Math.random() * 3.5;
      const mx = x1 + (x2 - x1) * t;
      const my = y1 + (y2 - y1) * t;
      this.pendingBurnLeaves.push({
        x: mx + Math.cos(leafAng) * len * 0.45,
        y: my + Math.sin(leafAng) * len * 0.45,
        angle: leafAng,
        length: len,
        width: 2.2 + Math.random() * 1.4,
        tone: Math.random(),
        leafStyle: this.phenotype.leafStyle,
        leafPalette: this.phenotype.leafPalette,
        bornAt: performance.now(),
      });
    }
    // Occasional dried blossom on the scar.
    if (Math.random() < 0.12) {
      const t = 0.4 + Math.random() * 0.3;
      this.pendingBurnFlowers.push({
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t,
        angle: Math.random() * Math.PI * 2,
        size: 6 + Math.random() * 4,
        petals: 4 + ((count + Math.floor(x1)) % 3),
        hue: Math.random(),
        flowerStyle: this.phenotype.flowerStyle,
        flowerPalette: this.phenotype.flowerPalette,
        bornAt: performance.now(),
      });
    }
  }

  private rebuildChildren(): void {
    for (const n of this.nodes) n.children = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const p = this.nodes[i].parent;
      if (p !== null) this.nodes[p].children.push(i);
    }
  }
}
