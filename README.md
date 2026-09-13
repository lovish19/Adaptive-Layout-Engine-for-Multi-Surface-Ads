# Adaptive Layout Engine for Multi-Surface Ads

One declarative ad adapts to mobile, broadcast, kiosk, and unknown surfaces. A plain TypeScript resolver measures candidate arrangements, enforces hard constraints, and degrades lower-priority content until a valid layout fits. React provides the workbench and DOM renderer.

FORM 01 is a fictional headphone product. The example includes a headline, hero, CTA, branding, and price. The CTA opens product information; there is no checkout or backend.

## Demo

Live demo: [(https://adaptive-layout-engine-for-multi-su-green.vercel.app/)]

Development: `http://127.0.0.1:5173`. Production preview: `http://127.0.0.1:4173`.

## Setup

Use Node.js 22.12+ or Node 24 and npm. Verification used Node 24.

```sh
npm install
npm run dev
```

In another terminal:

```sh
npm run test
npm run typecheck
npm run lint
npm run build
npm run preview
```

`npm run test:watch` runs Vitest interactively. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`; no execution-policy change is needed. Fonts and images are local. No environment variables, API keys, or services are required.

For a static host such as Vercel, use build command `npm run build` and output directory `dist`. Deploy at the domain root. Subdirectory hosting would need Vite's `base` and root-relative asset URLs adjusted. Refreshing the root page needs no routing service.

## Usage

- Choose Mobile Portrait, Mobile Landscape, Broadcast Lower Third, or Square Kiosk. The inspector shows constraints, element outcomes, and ordered decisions.
- Select **All surfaces** to compare four resolutions of the same spec. **Inspect** opens one surface.
- Edit the headline to exercise wrapping and truncation. Empty required copy produces an error.
- Enable **Bounds**: orange marks usable space; blue marks element rectangles. **100%** shows native surface pixels with scrolling inside the preview; **Fit** restores the scaled view.
- Select **Custom Surface** to edit constraints. The signage, strip, and compact-card presets contain constraints only.
- **Export JSON** downloads the spec, profile, and result, or all four comparison results. Other changes stay in page state.

For the interview example, enter width `820`, height `310`, safe insets `18 / 24 / 18 / 24` (top/right/bottom/left), touch enabled, and a `48px` target. Leave padding at `12`, gap at `10`, text floor at `14`, and distance at `0.4`. The unchanged engine resolves it immediately.

Preview scaling is separate from resolution: a 60px kiosk target remains 60px in the output even when a thumbnail appears smaller.

## Architecture

```text
AdSpec + SurfaceProfile + TextMeasurer
                  ↓
             resolveLayout
                  ↓
      ResolvedLayout / explicit failure
                  ↓
             DOM renderer
```

| Location                   | Responsibility                                       |
| -------------------------- | ---------------------------------------------------- |
| `src/engine/types.ts`      | Domain, geometry, diagnostics, result types          |
| `src/engine/validation.ts` | Runtime input validation                             |
| `src/engine/text.ts`       | Wrapping, ellipsis, portable width estimates         |
| `src/engine/placement.ts`  | Stack/split/inline geometry and content padding      |
| `src/engine/resolver.ts`   | Hard floors, candidate order, degradation loop       |
| `src/demo/`                | One ad and seven constraint profiles/presets         |
| `src/rendering/`           | Browser text metrics and DOM rendering               |
| `src/components/`          | Preview, custom inputs, inspector                    |
| `src/App.tsx`              | Workbench state, comparison, export, CTA destination |

The engine imports no React or browser APIs. The renderer receives coordinates, dimensions, padding, fonts, and explicit lines. CSS media queries affect only the workbench. See [ARCHITECTURE.md](ARCHITECTURE.md) 
React/React DOM provide rendering. Two Fontsource packages provide local typography. Development dependencies supply TypeScript, Vite, Vitest, and linting; there is no external solver or component framework.

## Layout Resolution Algorithm

1. Validate numbers, content, typography, IDs, roles, colors, and URL forms. Malformed data returns `invalid`.
2. Subtract asymmetric safe insets and uniform padding. Non-positive usable space returns `unsatisfiable`.
3. Derive the text floor as `max(minTextSize, ceil(viewingDistance * 10))`, followed by element font minima. Both touch CTA dimensions respect `minTapTarget`.
4. Prefer stack below usable aspect ratio `0.8`, inline above `2.6`, and split otherwise. Try the preference and both alternatives before degrading content.
5. Derive current sizes from preferred values, minima, and degradation level. Preferred text widths grow when the surface raises typography. Measure line breaks/heights at each candidate width.
6. Attempt disjoint placement inside usable bounds. Return the first valid candidate.
7. If all candidates fail, advance the lowest-priority eligible element and repeat. Exhausting all variants returns an explicit failure with no renderable elements.

Diagnostics explain the numeric preference, minimum-size adjustments, degradation, wrapping/truncation, and fallback composition. Surface IDs and names never select a layout.

## Priority and Degradation

**1 is highest priority. Larger numbers degrade first; ties degrade in reverse declaration order.** Priority is separate from optionality: required content cannot be hidden.

| Variant | Behavior                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full    | Preferred font/image sizes; text can wrap within its declared line allowance.                                                                              |
| Reduced | Halfway toward minima. Image height also caps to usable height without crossing its minimum.                                                               |
| Compact | Minimum valid sizes; text gets at most two lines with a measured ellipsis when needed. CTA labels retain their declared line allowance and never truncate. |
| Hidden  | Optional elements only; zero geometry and an explicit decision.                                                                                            |

Each element exhausts its permitted levels before a more important element changes. For this ad: branding (3), price (2), then required CTA, hero, headline (all 1, reverse declaration order).

Broadcast intentionally forces degradation. Its 1920 × 240 surface leaves 1688 × 164 usable pixels with a 30px text floor. Branding/price are hidden, CTA is compact, hero is reduced, and headline retains its 58px preferred font.

## Type System

`AdElement` is a discriminated union with type-specific roles and fields. Images require source/alt and height constraints; text requires typography; buttons also require a destination and minimum height. `ResolvedLayout` is a `resolved | invalid | unsatisfiable` union. Results include explicit rectangles, lines, and content padding.

Strict mode, unchecked-index checks, and exact optional properties are enabled. Runtime validation covers JSON-shaped input and missing content. Valid specs require non-optional primary, hero, and action elements.

## Testing

Vitest independently checks usable bounds, positive finite geometry, pairwise non-overlap, text widths/heights, font and touch floors, required visibility, hidden geometry, priority changes, tie order, and input failures. Cases include 300 × 900, 900 × 300, 600 × 600, 1200 × 180, the exact interview profile, and 324 generated combinations. Impossible profiles must fail cleanly. Throwing ID/name getters prove the resolver does not access surface identity.

`tests/browser-check.js` checks actual DOM/text bounds, compositions, custom inputs, presets, errors, comparison, 100% inspection, label contrast, CTA, JSON export, and local assets. It executes inside a browser, separately from Vitest. With agent-browser and its browser installed:

```powershell
npx.cmd agent-browser open http://127.0.0.1:5173
Get-Content -Raw -Encoding UTF8 tests/browser-check.js | npx.cmd agent-browser eval --stdin
npx.cmd agent-browser close
```

On macOS/Linux, use `npx agent-browser` and `cat tests/browser-check.js` for the input pipe. The same script can target production port 4173. Browser automation is optional verification tooling, not an application dependency.

## Known Limitations

- Three generic arrangements do not cover arbitrary packing. `unsatisfiable` means no supported candidate fits, not that no imaginable layout exists.
- Degradation is greedy/discrete. Optional content is not restored after required content shrinks. Geometry thresholds can cause abrupt transitions.
- Split uses the first hero beside the remaining content; multi-hero mosaics and optimal reordering are not searched.
- Browser widths use canvas/Arial; height uses explicit line boxes. Node estimates can wrap differently. Long words split at code points; complex shaping, RTL, and grapheme clusters need further work.
- Distance-to-font conversion is a pixel-based heuristic; physical calibration needs display size and pixel density.
- Input is bounded to 30 elements, 10,000 characters per string, 20 declared lines, and general numeric values up to 1,000,000. Types are text/image/button. Images use `contain`; external-media failure handling belongs to the host application.

## Time Spent

Time spent: [FILL IN ACTUAL TIME BEFORE SUBMISSION]

## AI Assistance

OpenAI Codex generated and revised implementation code, tests, and documentation, and performed automated and browser verification. The product image was generated using OpenAI image generation. The submitter should record their own review and contributions before submission; human review is not claimed here.
