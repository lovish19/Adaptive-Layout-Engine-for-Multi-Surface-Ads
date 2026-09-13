import type {
  AdSpec,
  Composition,
  Diagnostic,
  Rect,
  ResolvedElement,
  ResolvedLayout,
  SurfaceProfile,
  TextMeasurer,
} from "./types";
import { validateInput } from "./validation";
import { estimateTextWidth } from "./text";
import { place } from "./placement";
import type { Item } from "./placement";

const zeroBounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
const interpolate = (ideal: number, minimum: number, level: number) =>
  level === 0 ? ideal : level === 1 ? (ideal + minimum) / 2 : minimum;

export function resolveLayout(
  spec: AdSpec,
  surface: SurfaceProfile,
  measureText: TextMeasurer = estimateTextWidth,
): ResolvedLayout {
  const diagnostics: Diagnostic[] = [];
  let bounds = zeroBounds;
  let attempts = 0;
  let effectiveMinTextSize = 0;
  const failure = (
    status: "invalid" | "unsatisfiable",
    message: string,
  ): ResolvedLayout => ({
    status,
    composition: null,
    width:
      Number.isFinite(surface?.width) && surface.width > 0
        ? Math.min(surface.width, 1_000_000)
        : 0,
    height:
      Number.isFinite(surface?.height) && surface.height > 0
        ? Math.min(surface.height, 1_000_000)
        : 0,
    usableBounds: bounds,
    elements: [],
    attempts,
    effectiveMinTextSize,
    diagnostics: [
      ...diagnostics,
      {
        code: status === "invalid" ? "invalid-input" : "unsatisfiable",
        message,
      },
    ],
  });
  const errors = validateInput(spec, surface);
  if (errors.length) return failure("invalid", errors.join(" "));
  const { safeArea, padding, gap } = surface;
  const width = surface.width - safeArea.left - safeArea.right - padding * 2;
  const height = surface.height - safeArea.top - safeArea.bottom - padding * 2;
  if (width <= 0 || height <= 0)
    return failure(
      "unsatisfiable",
      "Safe area and padding leave no usable space.",
    );
  bounds = {
    x: safeArea.left + padding,
    y: safeArea.top + padding,
    width,
    height,
  };
  // A demo policy in CSS pixels, not a physical display calibration.
  effectiveMinTextSize = Math.max(
    surface.minTextSize,
    Math.ceil(10 * surface.viewingDistance),
  );
  if (effectiveMinTextSize > surface.minTextSize)
    diagnostics.push({
      code: "readability-floor",
      message: `Viewing distance raises the text floor to ${effectiveMinTextSize}px.`,
    });
  const ratio = width / height;
  const preferred: Composition =
    ratio < 0.8 ? "stack" : ratio > 2.6 ? "inline" : "split";
  const compositions = [
    preferred,
    ...(["stack", "split", "inline"] as const).filter(
      (value) => value !== preferred,
    ),
  ];
  diagnostics.push({
    code: "composition-preference",
    message: `Usable aspect ratio ${ratio.toFixed(2)} prefers ${preferred}. Candidate order: ${compositions.join(" → ")}.`,
  });
  for (const element of spec.elements) {
    if (
      element.type !== "image" &&
      effectiveMinTextSize > element.typography.idealFontSize
    ) {
      diagnostics.push({
        code: "text-minimum",
        elementId: element.id,
        message: `${element.id}: the surface text floor raises the preferred font from ${element.typography.idealFontSize}px to ${effectiveMinTextSize}px.`,
      });
    }
    if (
      element.type === "button" &&
      surface.touchOnly &&
      (surface.minTapTarget > element.minHeight ||
        surface.minTapTarget > element.constraints.minWidth)
    ) {
      diagnostics.push({
        code: "tap-minimum",
        elementId: element.id,
        message: `${element.id}: touch interaction requires a target of at least ${surface.minTapTarget} × ${surface.minTapTarget}px.`,
      });
    }
  }
  const levels = spec.elements.map(() => 0 as 0 | 1 | 2 | 3);
  const order = spec.elements
    .map((element, index) => ({ element, index }))
    .sort(
      (a, b) => b.element.priority - a.element.priority || b.index - a.index,
    );
  const cache = new Map<string, number>();
  const measure: TextMeasurer = (text, fontSize, weight, family) => {
    const key = JSON.stringify([text, fontSize, weight, family]);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const result = measureText(text, fontSize, weight, family);
    if (
      !Number.isFinite(result) ||
      result < 0 ||
      (text.length > 0 && result === 0)
    ) {
      throw new Error(
        "Text measurement must return a finite positive width for non-empty text.",
      );
    }
    cache.set(key, result);
    return result;
  };
  try {
    // Each pass either resolves or consumes one of at most three levels per element.
    for (;;) {
      const items: Item[] = [];
      spec.elements.forEach((element, index) => {
        const level = levels[index]!;
        if (level === 3) return;
        const floor =
          element.type === "image"
            ? null
            : Math.max(effectiveMinTextSize, element.typography.minFontSize);
        const fontSize =
          element.type === "image"
            ? null
            : interpolate(
                Math.max(element.typography.idealFontSize, floor!),
                floor!,
                level,
              );
        const tapFloor =
          element.type === "button" && surface.touchOnly
            ? surface.minTapTarget
            : 0;
        const minWidth = Math.max(element.constraints.minWidth, tapFloor);
        const textScale =
          element.type === "image"
            ? 1
            : fontSize! /
              interpolate(
                element.typography.idealFontSize,
                element.typography.minFontSize,
                level,
              );
        items.push({
          element,
          level,
          minWidth,
          fontSize,
          width: Math.max(
            minWidth,
            interpolate(
              element.constraints.idealWidth,
              element.constraints.minWidth,
              level,
            ) * textScale,
          ),
          height:
            element.type === "image"
              ? level === 0
                ? element.idealHeight
                : Math.max(
                    element.minHeight,
                    Math.min(
                      height,
                      interpolate(
                        element.idealHeight,
                        element.minHeight,
                        level,
                      ),
                    ),
                  )
              : element.type === "button"
                ? Math.max(element.minHeight, tapFloor)
                : 0,
        });
      });
      for (const composition of compositions) {
        attempts++;
        const placed = place(
          composition,
          items,
          bounds,
          gap,
          measure,
          spec.fontFamily,
        );
        if (!placed) continue;
        if (composition !== preferred)
          diagnostics.push({
            code: "repositioned",
            message: `${preferred} could not fit; recomposed as ${composition} before reducing more content.`,
          });
        const elements = spec.elements.map((element): ResolvedElement => {
          const result = placed.find((item) => item.id === element.id);
          if (!result)
            return {
              id: element.id,
              ...zeroBounds,
              visible: false,
              variant: "hidden",
              degradationLevel: 3,
              fontSize: null,
              lineHeight: null,
              contentPadding: { horizontal: 0, vertical: 0 },
              lines: [],
              truncated: false,
            };
          if (result.truncated)
            diagnostics.push({
              code: "truncated",
              elementId: element.id,
              priority: element.priority,
              message: `${element.id}: shortened to ${result.lines.length} lines with an ellipsis.`,
            });
          else if (result.lines.length > 1)
            diagnostics.push({
              code: "wrapped",
              elementId: element.id,
              priority: element.priority,
              message: `${element.id}: set on ${result.lines.length} measured lines.`,
            });
          return result;
        });
        return {
          status: "resolved",
          width: surface.width,
          height: surface.height,
          usableBounds: bounds,
          composition,
          elements,
          diagnostics,
          attempts,
          effectiveMinTextSize,
        };
      }
      const next = order.find(
        ({ element, index }) => levels[index]! < (element.optional ? 3 : 2),
      );
      if (!next)
        return failure(
          "unsatisfiable",
          "Required content cannot fit at its minimum sizes in any supported composition. Increase the usable area or relax the constraints.",
        );
      const level = (levels[next.index]! + 1) as 1 | 2 | 3;
      levels[next.index] = level;
      const code = (["reduced", "compact", "hidden"] as const)[level - 1]!;
      diagnostics.push({
        code,
        elementId: next.element.id,
        priority: next.element.priority,
        message: `${next.element.id} → ${code}: no composition fits ${Math.round(width)} × ${Math.round(height)}px; priority ${next.element.priority}${level === 3 ? ", optional content removed" : ""}.`,
      });
    }
  } catch (error) {
    return failure(
      "invalid",
      `Text measurement failed: ${error instanceof Error ? error.message : "unknown adapter error"}`,
    );
  }
}
