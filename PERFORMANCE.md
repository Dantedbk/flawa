# Performance opportunities

The frame is Canvas2D. Colonization already runs slower than the display (default 12 Hz, slider up to 36 Hz). Pixel ratio is already capped at 2. The cost that tracks the garden is redrawing wood, leaves, and soft washes that are mostly unchanged from the previous frame.

Defaults that set the scale: up to 8 trees, 280 nodes, 1,200 leaves and 96 flowers per tree, 140 attractors. Sliders can push node count and step rate higher. Attractors are hidden by default.

Each item below keeps the current strokes, colors, and sway. `src/webglFoliage.ts` is listed separately because turning it on as it stands would change the picture.

## 1. Cache settled wood

`strokeFluidStrand` in `src/main.ts` is the heaviest draw. For every branch, every frame, it samples a Catmull-Rom spline (10 samples when the chain has 2–3 points, otherwise 7) and calls `beginPath` / `stroke` on each sample, with a new `strokeStyle` and `lineWidth`. A few hundred nodes become a few thousand strokes per tree per frame.

Wood does not move in the wind. A node’s position is fixed at birth. The only per-frame motion is the grow/retract blend in `drawFluidWood` while `sprout < 1` or `wither > 0`. `SpaceColonizationTree.structureRev` already increments when a segment is added, and the renderer never reads it.

Draw each tree’s branches into an offscreen canvas and blit it with one `drawImage`. Rebake a strand only when `structureRev` changes, the stem palette or width scale changes, the canvas resizes, or a node on that strand is still sprouting or withering. A mature crown costs one blit. A tip that is still growing redraws only its own strand, with the same Catmull samples, alphas, and widths as today.

While a strand does have to redraw, collapse each run of similar alpha into one tapered fill instead of one stroke per sample. Width still follows the spline. Split the run when alpha changes enough to see (on the order of a few hundredths). Overlapping round caps currently stack alpha at joints; a single ribbon does not, so joints get slightly cleaner rather than darker. Keep the per-sample strokes if that joint darkening has to stay pixel-identical.

## 2. Draw leaves from one outline per style

`drawLeaf` runs for every live leaf and every falling leaf. Each call does `save`, `translate`, `rotate`, rebuilds the silhouette in `leafPath` (quadratics, beziers, or an ellipse), `fill`, strokes a midrib, and `restore`. Leaf coordinates are all multiples of length and width, so the silhouette is a unit shape plus a transform.

Build one `Path2D` per `LeafStyle` in unit space (length 1, width 1). Each leaf becomes `setTransform` (position, angle, length, width, and the existing device-pixel scale) and a fill. Sway only changes the transform. The midrib stays a hairline in CSS pixels: stroke it after undoing the leaf scale, at the current 0.4 px (needle) or 0.6 px. Falling leaves use the same path.

`leafColors` depends only on palette and tone, both fixed for the life of a leaf. Store the `r, g, b` strings on the leaf instead of reallocating them every frame.

## 3. Reuse the soft washes

`drawCanopyMasses` builds a new radial gradient for every leaf cluster, every frame. Cluster centers move with the breeze. Color and strength do not: they come from palette, average tone, and average growth.

Create the gradient once in unit space, keyed by fill color and quantized strength. `translate` to the cluster and `scale` by its radii, then fill a unit circle. The ellipse still tracks the leaves. Canvas gradients follow the current transform at fill time, so one cached gradient covers every position.

`drawZenGroundGlow` builds two radial gradients per tree per frame for a mist that only depends on the tree center and the viewport. Cache those until the center moves or the window resizes.

## 4. Stop copying foliage arrays every frame

`tickTransitions` in `src/colonization.ts` runs on the display clock and always `filter`s `leaves` and `flowers`, even when every sprout is unchanged. That allocates two arrays per tree per frame and pressures GC, which shows up as hitches rather than a lower average frame rate.

Scan for a sprout that has fallen through the 0.02 cutoff, and allocate the filtered array only then. The keep rule stays the same.

## 5. Match the canvas foliage in the existing WebGL path

`src/webglFoliage.ts` is an instanced WebGL2 renderer (up to 10,000 leaves, 3,000 flowers, 512 dots, one draw per kind) and `main.ts` never imports it. `draw()` still paints every leaf and flower with Canvas2D. That is the largest remaining win after wood and leaf paths are cached, because sway still moves every leaf every frame, and a cached `Path2D` still fills once per leaf.

The shaders are simplified silhouettes (analytic ovals, hearts, petal lobes). They are not the bezier leaves in `leafPath` or the ellipse flowers in `drawFlower`. Shipping the current shaders would change the picture: minimum leaf half-extents, a different mask, and no per-style canvas outline.

Use this path only after the fragment shaders reproduce those outlines closely enough that a still frame matches. Wood, ground contact, canopy wash, and insects can stay on the 2D canvas and composite over or under the WebGL layer. Premultiplied alpha is already what the leaf shader outputs; the page background has to composite the same way it does now.

## 6. Spatial lookup for colonization

`step` scores every attractor against every unfinished node: about 140 attractors times the live tip set, each with a `hypot`, at 12–36 Hz. With the default caps this is smaller than the draw. It becomes the limiter when node count, attractor count, or `liveStepHz` are turned up, and it stacks across 8 trees.

A uniform grid (cell size = `maxDistance`) yields the same nearest and second-nearest tip, because any tip outside `maxDistance` is already discarded. Pull weights, click bias, and the per-tip pull cap stay as they are. This changes timing only if the grid ever returns a different winner; the cell query has to include every candidate the brute-force loop would have scored.

## Smaller, same picture

- **Flowers.** At most 96 per tree, but each blossom is several ellipses inside `save` / `restore`. A unit `Path2D` per style plus petal count, drawn with `setTransform`, removes that rebuild. Petal count changes the daisy and cup geometry, so key the cache by style and petal count.
- **Pollen.** At most 42 dots, each its own `arc` + fill. One path per quantized alpha is enough; they are not a frame problem.
- **Bees and butterflies.** A handful of paths. Leave them.

## Already in place

- Sim steps are decoupled from the display. Grow and fade run in `tickTransitions` so 12 Hz simulation does not stutter at 144 Hz.
- `devicePixelRatio` is capped at 2.
- The 2D context is created with `desynchronized: true`.
- Attractors are not drawn unless explicitly shown. When they are, batch every dot into one path.
