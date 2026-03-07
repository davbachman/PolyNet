Original prompt: Build an app that lets the user choose a platonic solid. After chooising they should see their choice in 3D. The user should then have an "unfold" button. Once selecting that they should see an animation of the solid unfolding to its net.

## Progress log
- Scaffolded a Vite + React + TypeScript app in `/Users/davidbachman/Documents/PolyNet`.
- Installed runtime dependencies: `three`, `@react-three/fiber`, `@react-three/drei`.
- Installed test dependency: `vitest` and added `npm test` / `npm run test:watch` scripts.
- Implemented core modules and interfaces:
  - `src/types.ts`
  - `src/data/solids.ts`
  - `src/geometry/adjacency.ts`
  - `src/geometry/unfoldTree.ts`
  - `src/geometry/transforms.ts`
  - `src/geometry/math.ts`
  - `src/state/useUnfoldController.ts`
  - `src/scene/PolyhedronMesh.tsx`
  - `src/scene/SolidScene.tsx`
  - `src/ui/SolidSelector.tsx`
  - `src/ui/UnfoldButton.tsx`
  - `src/test/geometry.test.ts`
- Replaced starter app with PolyNet UI + 3D canvas + unfold/fold controls.
- Added global hooks `window.render_game_to_text` and `window.advanceTime(ms)`.

## TODO / validation
- Run `npm run build` and `npm test` and fix any type/test issues.
- Run browser-based interaction validation for selector, unfold/fold animation, and no console errors.
- Run Playwright client loop and inspect screenshots + text output for behavior checks.

## Validation results
- `npm run build` passed (production build created under `dist/`).
- `npm test` passed (`src/test/geometry.test.ts`, 9 tests).
- Playwright client validation run:
  - Command: `node $HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:4173 --click-selector '#unfold-btn' --actions-json '{"steps":[{"buttons":[],"frames":120}]}' --iterations 1 --pause-ms 250 --screenshot-dir /Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v2`
  - Output artifacts:
    - screenshot: `/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v2/shot-0.png`
    - state: `/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v2/state-0.json`
  - Captured text state confirms successful unfold on cube: `{"solidId":"cube","state":"unfolded","progress":1,"animating":false,"rootFace":4,"treeEdgesCount":5}`
  - No error JSON files were emitted in the clean run directory.

## Remaining suggestions
- Add an optional in-app debug panel for current unfold tree metadata (root + parent map) to inspect random net variance over successive unfolds.
- Consider code-splitting or adjusting chunk strategy if bundle size warning becomes important.
- Refactored unfold controller to satisfy strict React hook lint rules (removed render-time ref mutation and effect-time reset pattern).
- Re-ran validation after refactor:
  - `npm run lint` passed.
  - `npm run build` passed.
  - `npm test` passed.
  - Playwright capture re-run at `/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v3` with state output `{"solidId":"cube","state":"unfolded","progress":1,"animating":false,"rootFace":0,"treeEdgesCount":5}` and no error files.

## Update: Head-on unfold view
- Added automatic camera orientation during unfold so the selected unfold root face ends up head-on at `progress=1`.
- Camera now interpolates from the current folded-view direction to the root-face normal direction as unfold progress increases.
- Orbit controls are enabled only in the folded state so unfolded nets remain head-on as requested.
- Files updated:
  - `/Users/davidbachman/Documents/PolyNet/src/App.tsx`
  - `/Users/davidbachman/Documents/PolyNet/src/scene/SolidScene.tsx`

## Re-validation
- `npm run lint` passed.
- `npm run build` passed.
- `npm test` passed.
- Playwright unfold capture confirms head-on final net:
  - screenshot: `/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v4/shot-0.png`
  - state: `/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v4/state-0.json`
  - no errors file emitted.

## Update: Auto-fit and pan during unfold
- Added geometry-bound framing utilities in `/Users/davidbachman/Documents/PolyNet/src/geometry/math.ts`:
  - `computeFaceCloudBoundingSphere(...)`
  - `solidCentroid(...)`
  - `BoundingSphereData`
- `App.tsx` now computes:
  - folded bounds from the selected solid
  - unfolded bounds from progress=1 face transforms for the current random unfold tree
  - passes both to the scene camera controller
- Reworked `/Users/davidbachman/Documents/PolyNet/src/scene/SolidScene.tsx` camera ticker:
  - blends camera target (pan) from current folded target to unfolded-net center
  - blends camera distance (rescale) from current folded distance to fitted unfolded distance based on viewport FOV/aspect
  - keeps head-on orientation behavior from previous update
  - preserves user-controlled folded camera as the baseline at unfold start (no fighting while folded)

## Re-validation
- `npm run lint` passed.
- `npm run build` passed.
- `npm test` passed.
- Playwright unfold capture (`/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v5`) confirms final net is centered and fully inside view with no error file emitted.

## Update: Large centered folded start + progressive pan/scale on unfold
- Root cause fixed: folded camera was initialized with `[d, d, d]`, which placed the camera farther than intended and made the starting solid too small.
- Reworked `/Users/davidbachman/Documents/PolyNet/src/scene/SolidScene.tsx`:
  - folded start now uses a normalized direction vector and a true radial distance so the initial polyhedron is large and centered
  - unfold animation now blends from folded framing to unfolded framing with:
    - progressive target pan (to net center)
    - progressive distance rescale (fit net in viewport)
    - progressive orientation blend to head-on final view
- Folded state keeps target centered while controls are active.

## Re-validation
- `npm run lint` passed.
- `npm run build` passed.
- `npm test` passed.
- Playwright screenshots:
  - folded (large + centered): `/Users/davidbachman/Documents/PolyNet/output/web-game/folded-v2/shot-0.png`
  - unfolded (head-on + centered + fit): `/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v6/shot-0.png`
  - state: `/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v6/state-0.json`
  - no errors file emitted.

## Update: Added remaining platonic solids
- Added `tetrahedron` and `icosahedron` to `SolidId` in `/Users/davidbachman/Documents/PolyNet/src/types.ts`.
- Extended `/Users/davidbachman/Documents/PolyNet/src/data/solids.ts`:
  - Added canonical icosahedron vertex/face constants.
  - Added `TETRAHEDRON` solid definition.
  - Added `ICOSAHEDRON` solid definition.
  - Kept dodeca generation using shared icosa constants.
  - Updated `SOLID_MAP` and selector options to include all five solids.
- Expanded geometry tests in `/Users/davidbachman/Documents/PolyNet/src/test/geometry.test.ts` to include tetrahedron and icosahedron adjacency/tree/transform invariants.

## Re-validation
- `npm run lint` passed.
- `npm run build` passed.
- `npm test` passed (`15` tests).
- Playwright unfold run passed (`/Users/davidbachman/Documents/PolyNet/output/web-game/unfold-v7`), state confirms successful unfold and no error file emitted.

## Update: Auto-rescale when switching models
- Updated `/Users/davidbachman/Documents/PolyNet/src/App.tsx` to pass `solidId` into `SolidScene`.
- Updated `/Users/davidbachman/Documents/PolyNet/src/scene/SolidScene.tsx` camera ticker:
  - detects `solidId` changes
  - performs a short switch reframe animation in folded mode
  - lerps camera target to folded model center and distance to folded fit distance so the whole new solid is visible
- Preserves existing unfold camera choreography (progressive pan/scale + head-on final net).

## Re-validation
- `npm run lint` passed.
- `npm run build` passed.
- `npm test` passed (`15` tests).
- Web game Playwright client regression runs remained error-free; direct dropdown selection automation is limited with this client, so switch reframe was verified via code path and static checks.

## Update: Plane-based convex truncation
- Replaced truncation implementation in `/Users/davidbachman/Documents/PolyNet/src/geometry/modelOps.ts` with a geometric plane-cut method per your specification:
  - For each vertex, compute a direction from the average of incoming unit edge vectors.
  - Build a truncation plane orthogonal to that line and offset from the vertex by slider-controlled distance.
  - Truncate only vertices that are convex with respect to that plane (`all incident faces meet the plane` check).
  - Intersect incident edges with the plane, cut incident faces, and patch each truncated vertex hole with a cap polygon.
- Added compaction/remapping of used vertices after truncation so resulting meshes stay clean for downstream adjacency/unfold logic.

## Test updates
- Updated `/Users/davidbachman/Documents/PolyNet/src/test/modelOps.test.ts` truncation expectations to verify polygon topology:
  - Truncated cube: `6` octagons + `8` triangles.
  - Truncated tetrahedron: `4` hexagons + `4` triangles.

## Re-validation
- `npm run test -- --run` passed (`21` tests).
- `npm run lint` passed.
- `npm run build` passed.
- Playwright web-game client check:
  - command clicked `#truncate-btn` and captured state/screenshot.
  - screenshot: `/Users/davidbachman/Documents/PolyNet/output/web-game/truncate-plane-v1/shot-0.png`
  - state: `/Users/davidbachman/Documents/PolyNet/output/web-game/truncate-plane-v1/state-0.json`
  - state confirms truncation step active: `{"type":"truncate","amount":0.2}`
  - no `errors-0.json` emitted.

## Notes
- The truncation slider remains `[0, 0.49]` and is interpreted as a fraction of each vertex's shortest incident edge length for stable intersections.
- Non-convex vertices are intentionally skipped during truncation.

## Update: Repeatable operation pipeline
- Reworked operation state so steps are now an ordered list of operation instances, each with its own `id`, `type`, and `amount`.
- Updated `/Users/davidbachman/Documents/PolyNet/src/App.tsx`:
  - Removed single-instance operation state (`operationOrder`, `stellateAmount`, `truncateAmount`).
  - Added append behavior so each click on `Stellate`/`Truncate` creates a new step.
  - Slider changes now target a specific step by `id`.
  - Model generation now applies all steps in order, enabling repeated/mixed chains (e.g. stellate -> truncate -> stellate).
  - `modelKey` now includes per-step ids/types/amounts to ensure unfold state resets correctly when sequence changes.
- Updated `/Users/davidbachman/Documents/PolyNet/src/ui/OperationSidebar.tsx`:
  - `OperationStep` now includes `id`.
  - Sidebar renders each operation instance with a unique key and slider id.
  - Slider callbacks now include the step id so each repeated operation can be edited independently.

## Test updates
- Expanded `/Users/davidbachman/Documents/PolyNet/src/test/modelOps.test.ts` with repeatability coverage:
  - repeated stellation test,
  - repeated truncation test,
  - mixed sequence test (`stellate -> truncate -> stellate`).

## Re-validation
- `npm run test -- --run` passed (`24` tests).
- `npm run lint` passed.
- `npm run build` passed.
- Playwright web-game client checks:
  - repeated stellate run: `/Users/davidbachman/Documents/PolyNet/output/web-game/repeat-ops-stellate-v1/state-0.json`
    - state confirms multiple stellate steps present.
  - repeated truncate run: `/Users/davidbachman/Documents/PolyNet/output/web-game/repeat-ops-truncate-v1/state-0.json`
    - state confirms multiple truncate steps present.

## Update: Export OBJ and unfolded PNG buttons
- Added model export utility module: `/Users/davidbachman/Documents/PolyNet/src/export/modelExport.ts`
  - `buildObjText(solid, matrices)` builds OBJ text from current face transforms.
  - `exportObjFile(...)` downloads an `.obj` file using browser blob download.
  - `exportUnfoldedPng(...)` computes a fully unfolded face layout (`progress=1`) from a tree, projects it to 2D, renders to offscreen canvas, and downloads `.png`.
- Updated `/Users/davidbachman/Documents/PolyNet/src/App.tsx`:
  - Added toolbar buttons:
    - `#export-obj-btn` (`Export OBJ`)
    - `#export-png-btn` (`Export Unfolded PNG`)
  - OBJ export uses current transformed model matrices (folded/unfolding/unfolded pose as currently shown).
  - PNG export uses unfolded net geometry; if no current tree exists it attempts `generateRandomTree`, falling back to identity tree on failure.
  - Export filenames include base solid + operation steps + phase/timestamp.
- Updated `/Users/davidbachman/Documents/PolyNet/src/styles.css`:
  - `controls-row` now wraps.
  - Added `.export-btn` width tuning so toolbar remains usable.
- Added unit tests in `/Users/davidbachman/Documents/PolyNet/src/test/export.test.ts`:
  - verifies OBJ vertex/face line counts.
  - verifies OBJ coordinates respect provided face matrices.

## Re-validation
- `npm run test -- --run` passed (`26` tests).
- `npm run lint` passed.
- `npm run build` passed.
- Playwright web-game client checks passed with no emitted `errors-0.json`:
  - `/Users/davidbachman/Documents/PolyNet/output/web-game/export-obj-v1/state-0.json`
  - `/Users/davidbachman/Documents/PolyNet/output/web-game/export-png-v1/state-0.json`
- Note: the headless Playwright capture client does not persist browser download artifacts into workspace by default, so export click behavior was validated via no-error runtime and code-path verification.

## Update: Overlap-aware unfolding strategy
- Reworked unfold tree selection in `/Users/davidbachman/Documents/PolyNet/src/geometry/unfoldTree.ts`:
  - Added candidate-tree search over multiple randomized spanning trees.
  - Added geometric overlap scoring for unfolded layouts:
    - flatten faces at `progress=1`,
    - project to a 2D basis aligned with root-face normal,
    - compute pairwise convex polygon intersection area,
    - ignore parent-child hinge neighbors,
    - sum positive overlap areas as a score.
  - `generateRandomTree(...)` now returns the best (lowest-overlap) candidate and exits early on near-zero overlap.
- Added and exported `computeTreeOverlapScore(...)` for diagnostics/tests.
- Added helper geometry routines in `unfoldTree.ts` for polygon clipping/intersection and projected-face bounding boxes.

## Test updates
- Extended `/Users/davidbachman/Documents/PolyNet/src/test/geometry.test.ts`:
  - Added seeded RNG helper.
  - Added overlap-aware tests for all five base solids, asserting generated trees have very low overlap score.

## Re-validation
- `npm run test -- --run` passed (`31` tests).
- `npm run lint` passed.
- `npm run build` passed.
- Playwright unfold runtime check:
  - screenshot: `/Users/davidbachman/Documents/PolyNet/output/web-game/non-overlap-unfold-v1/shot-0.png`
  - state: `/Users/davidbachman/Documents/PolyNet/output/web-game/non-overlap-unfold-v1/state-0.json`
  - no `errors-0.json` emitted.
  - visual inspection confirms a non-overlapping cube net in this run.

## Notes
- This is a best-candidate search strategy, not a formal proof-based non-overlap solver; for highly transformed/high-face-count models it still minimizes overlap and falls back gracefully.
