import { describe, expect, it } from "vitest";
import { resolveLayout } from "../src/engine/resolver";
import { estimateTextWidth } from "../src/engine/text";
import { adSpec } from "../src/demo/adSpec";
import { customPresets, surfaces } from "../src/demo/surfaces";
import type {
  AdSpec,
  ResolvedLayout,
  SurfaceProfile,
} from "../src/engine/types";

const baseline = surfaces[0]!;
const surface = (
  width: number,
  height: number,
  rest: Partial<SurfaceProfile> = {},
): SurfaceProfile => ({
  ...baseline,
  id: "unseen",
  name: "Never seen before",
  width,
  height,
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  padding: 8,
  gap: 8,
  ...rest,
});

function assertInvariants(
  layout: ResolvedLayout,
  profile: SurfaceProfile,
  spec: AdSpec = adSpec,
) {
  expect(
    [layout.width, layout.height, ...Object.values(layout.usableBounds)].every(
      Number.isFinite,
    ),
  ).toBe(true);
  if (layout.status !== "resolved") {
    expect(layout.elements).toHaveLength(0);
    expect(layout.diagnostics.length).toBeGreaterThan(0);
    return;
  }
  const bounds = layout.usableBounds;
  expect(bounds).toEqual({
    x: profile.safeArea.left + profile.padding,
    y: profile.safeArea.top + profile.padding,
    width:
      profile.width -
      profile.safeArea.left -
      profile.safeArea.right -
      2 * profile.padding,
    height:
      profile.height -
      profile.safeArea.top -
      profile.safeArea.bottom -
      2 * profile.padding,
  });
  const textFloor = Math.max(
    profile.minTextSize,
    Math.ceil(profile.viewingDistance * 10),
  );
  expect(layout.effectiveMinTextSize).toBe(textFloor);
  for (const hidden of layout.elements.filter((element) => !element.visible)) {
    expect([hidden.x, hidden.y, hidden.width, hidden.height]).toEqual([
      0, 0, 0, 0,
    ]);
    expect(
      spec.elements.find((element) => element.id === hidden.id)?.optional,
    ).toBe(true);
  }
  const visible = layout.elements.filter((element) => element.visible);
  for (const element of visible) {
    expect(element.width).toBeGreaterThan(0);
    expect(element.height).toBeGreaterThan(0);
    expect(
      [element.x, element.y, element.width, element.height].every(
        Number.isFinite,
      ),
    ).toBe(true);
    expect(element.x).toBeGreaterThanOrEqual(bounds.x - 1e-7);
    expect(element.y).toBeGreaterThanOrEqual(bounds.y - 1e-7);
    expect(element.x + element.width).toBeLessThanOrEqual(
      bounds.x + bounds.width + 1e-7,
    );
    expect(element.y + element.height).toBeLessThanOrEqual(
      bounds.y + bounds.height + 1e-7,
    );
    const input = spec.elements.find((item) => item.id === element.id)!;
    expect(element.width).toBeGreaterThanOrEqual(input.constraints.minWidth);
    if (input.type === "image")
      expect(element.height).toBeGreaterThanOrEqual(input.minHeight);
    else {
      expect(element.fontSize).toBeGreaterThanOrEqual(
        layout.effectiveMinTextSize,
      );
      expect(element.fontSize).toBeGreaterThanOrEqual(
        input.typography.minFontSize,
      );
      expect(element.lines.length).toBeGreaterThan(0);
      expect(element.fontSize).toBeGreaterThanOrEqual(profile.minTextSize);
      const maxLines =
        element.variant === "compact" && input.type === "text"
          ? Math.min(2, input.typography.maxLines)
          : input.typography.maxLines;
      expect(element.lines.length).toBeLessThanOrEqual(maxLines);
      for (const line of element.lines) {
        expect(
          estimateTextWidth(
            line,
            element.fontSize!,
            input.typography.weight,
            spec.fontFamily,
          ),
        ).toBeLessThanOrEqual(
          element.width - 2 * element.contentPadding.horizontal + 1e-7,
        );
      }
      expect(
        element.lines.length * element.lineHeight! +
          2 * element.contentPadding.vertical,
      ).toBeLessThanOrEqual(element.height + 1e-7);
    }
    if (input.type === "button" && profile.touchOnly) {
      expect(element.width).toBeGreaterThanOrEqual(profile.minTapTarget);
      expect(element.height).toBeGreaterThanOrEqual(profile.minTapTarget);
      expect(element.truncated).toBe(false);
    }
  }
  for (let i = 0; i < visible.length; i++)
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i]!;
      const b = visible[j]!;
      const intersectionWidth =
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const intersectionHeight =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect(
        intersectionWidth <= 1e-7 || intersectionHeight <= 1e-7,
        `${a.id} overlaps ${b.id}`,
      ).toBe(true);
    }
  for (const required of spec.elements.filter((element) => !element.optional)) {
    expect(visible.some((element) => element.id === required.id)).toBe(true);
  }
}

describe("required surfaces", () => {
  it.each(surfaces)(
    "$name resolves inside safe bounds with hard minimums and no overlap",
    (profile) => {
      const layout = resolveLayout(adSpec, profile);
      expect(layout.status, JSON.stringify(layout.diagnostics)).toBe(
        "resolved",
      );
      assertInvariants(layout, profile);
    },
  );

  it("recomposes into three distinct arrangements, rather than scaling one layout", () => {
    expect(
      surfaces.map((profile) => resolveLayout(adSpec, profile).composition),
    ).toEqual(["stack", "split", "inline", "split"]);
  });

  it("demonstrates degradation on the broadcast profile", () => {
    const layout = resolveLayout(adSpec, surfaces[2]!);
    expect(layout.status).toBe("resolved");
    expect(
      layout.elements.find((element) => element.id === "brand")?.visible,
    ).toBe(false);
    expect(
      layout.elements.find((element) => element.id === "headline")?.visible,
    ).toBe(true);
    expect(layout.effectiveMinTextSize).toBe(30);
    expect(
      layout.diagnostics.some((decision) => decision.code === "hidden"),
    ).toBe(true);
  });

  it("uses available image height during reduction without crossing the image minimum", () => {
    const layout = resolveLayout(adSpec, surfaces[2]!);
    const hero = layout.elements.find((element) => element.id === "hero")!;
    expect(hero.variant).toBe("reduced");
    expect(hero.height).toBe(layout.usableBounds.height);
    expect(hero.height).toBeGreaterThan(76);
    expect(
      layout.elements.find((element) => element.id === "headline")?.variant,
    ).toBe("full");
  });
});

describe("priority and determinism", () => {
  it("exhausts an equal-priority element before the previous declaration and never hides required content", () => {
    const result = resolveLayout(adSpec, surface(20, 20));
    expect(result.status).toBe("unsatisfiable");
    const changes = result.diagnostics.filter((item) =>
      ["reduced", "compact", "hidden"].includes(item.code),
    );
    expect(changes.map((item) => `${item.elementId}:${item.code}`)).toEqual([
      "brand:reduced",
      "brand:compact",
      "brand:hidden",
      "price:reduced",
      "price:compact",
      "price:hidden",
      "cta:reduced",
      "cta:compact",
      "hero:reduced",
      "hero:compact",
      "headline:reduced",
      "headline:compact",
    ]);
  });

  it("changes the sacrifice order when priorities change, even for required low-priority content", () => {
    const spec: AdSpec = {
      ...adSpec,
      elements: adSpec.elements.map((element) =>
        element.id === "hero" ? { ...element, priority: 4 } : element,
      ),
    };
    const result = resolveLayout(spec, surface(20, 20));
    const changes = result.diagnostics.filter((item) =>
      ["reduced", "compact", "hidden"].includes(item.code),
    );
    expect(
      changes.slice(0, 3).map((item) => `${item.elementId}:${item.code}`),
    ).toEqual(["hero:reduced", "hero:compact", "brand:reduced"]);
    expect(
      changes.some(
        (item) => item.elementId === "hero" && item.code === "hidden",
      ),
    ).toBe(false);
  });

  it("does not access surface identity properties at all", () => {
    const profile = { ...baseline };
    Object.defineProperties(profile, {
      id: {
        get: () => {
          throw new Error("Surface identity accessed");
        },
      },
      name: {
        get: () => {
          throw new Error("Surface name accessed");
        },
      },
    });
    expect(resolveLayout(adSpec, profile)).toEqual(
      resolveLayout(adSpec, baseline),
    );
  });
  it("exhausts lower-priority options before degrading more important content", () => {
    for (const height of [800, 500, 300, 200, 100]) {
      const result = resolveLayout(adSpec, surface(390, height));
      const steps = result.diagnostics.filter((step) =>
        ["reduced", "compact", "hidden"].includes(step.code),
      );
      for (let i = 1; i < steps.length; i++)
        expect(steps[i]!.priority).toBeLessThanOrEqual(steps[i - 1]!.priority!);
      const firstPriorityOne = steps.findIndex((step) => step.priority === 1);
      if (firstPriorityOne >= 0) {
        const prior = steps.slice(0, firstPriorityOne);
        expect(
          prior.some(
            (step) => step.elementId === "brand" && step.code === "hidden",
          ),
        ).toBe(true);
        expect(
          prior.some(
            (step) => step.elementId === "price" && step.code === "hidden",
          ),
        ).toBe(true);
      }
    }
  });

  it("does not inspect a surface identity", () => {
    for (const profile of surfaces) {
      expect(
        resolveLayout(adSpec, {
          ...profile,
          id: "totally-unknown",
          name: "arbitrary",
        }),
      ).toEqual(resolveLayout(adSpec, profile));
    }
  });

  it("does not depend on element ids or mutate input", () => {
    const before = JSON.stringify({ adSpec, surfaces });
    const renamed: AdSpec = {
      ...adSpec,
      elements: adSpec.elements.map((element, i) => ({
        ...element,
        id: `x-${i}`,
      })),
    };
    for (const profile of surfaces) {
      const result = resolveLayout(renamed, profile);
      expect(result.status).toBe("resolved");
      assertInvariants(result, profile, renamed);
      expect(resolveLayout(adSpec, profile)).toEqual(
        resolveLayout(adSpec, profile),
      );
    }
    expect(JSON.stringify({ adSpec, surfaces })).toBe(before);
  });

  it("supports extra elements without adding a layout variant", () => {
    const extended: AdSpec = {
      ...adSpec,
      elements: [
        ...adSpec.elements,
        {
          ...adSpec.elements.find(
            (element) =>
              element.type === "text" && element.role === "secondary",
          )!,
          id: "description",
          text: "A little space for yourself.",
          priority: 4,
        },
      ],
    };
    for (const profile of surfaces)
      assertInvariants(resolveLayout(extended, profile), profile, extended);
  });
});

describe("unknown surfaces", () => {
  it.each(customPresets)(
    "$name resolves through the same algorithm",
    (profile) => {
      const result = resolveLayout(adSpec, profile);
      expect(result.status).toBe("resolved");
      assertInvariants(result, profile);
    },
  );

  it.each([
    surface(300, 900),
    surface(900, 300),
    surface(600, 600),
    surface(1200, 180),
    surface(6000, 180),
    surface(180, 4000),
    surface(280, 280),
    surface(950, 550, {
      safeArea: { left: 103, right: 7, top: 61, bottom: 29 },
    }),
    surface(1280, 720, {
      viewingDistance: 4,
      minTextSize: 36,
      minTapTarget: 72,
    }),
  ])("handles extreme/custom geometry $width × $height", (profile) => {
    const result = resolveLayout(adSpec, profile);
    expect(result.status).toBe("resolved");
    assertInvariants(result, profile);
  });

  it("resolves the exact 820 × 310 interview profile without a new engine branch", () => {
    const profile = surface(820, 310, {
      safeArea: { top: 18, right: 24, bottom: 18, left: 24 },
      minTapTarget: 48,
      touchOnly: true,
      padding: 12,
      gap: 10,
    });
    const result = resolveLayout(adSpec, profile);
    expect(result.status).toBe("resolved");
    expect(result.usableBounds).toEqual({
      x: 36,
      y: 30,
      width: 748,
      height: 250,
    });
    assertInvariants(result, profile);
  });

  it("handles fractional dimensions and zero gap without overlap", () => {
    const profile = surface(800.5, 450.25, {
      padding: 0,
      gap: 0,
      safeArea: { left: 11.25, top: 8.5, right: 3.75, bottom: 0 },
    });
    const result = resolveLayout(adSpec, profile);
    expect(result.status).toBe("resolved");
    assertInvariants(result, profile);
  });

  it("preserves invariants over 324 aspect ratios and deterministic generated constraints", () => {
    let resolved = 0;
    for (let w = 1; w <= 18; w++)
      for (let h = 1; h <= 18; h++) {
        const profile = surface(w * 97, h * 79, {
          safeArea: {
            top: w % 13,
            right: h % 17,
            bottom: h % 23,
            left: w % 19,
          },
          touchOnly: w % 2 === 0,
          minTapTarget: w % 2 === 0 ? 60 : 0,
          viewingDistance: 0.4 + (h % 4),
          minTextSize: 14 + (w % 3) * 6,
        });
        const layout = resolveLayout(adSpec, profile);
        assertInvariants(layout, profile);
        if (layout.status === "resolved") resolved++;
        expect(layout.attempts).toBeLessThanOrEqual(
          3 * (1 + 3 * adSpec.elements.length),
        );
      }
    expect(resolved).toBeGreaterThan(220);
  });

  it("reports impossible layouts instead of emitting partial or broken geometry", () => {
    for (const profile of [
      surface(20, 20),
      surface(200, 100, { minTapTarget: 150 }),
      surface(100, 100, { padding: 100 }),
      surface(100, 100, {
        safeArea: { top: 101, bottom: 0, left: 0, right: 0 },
      }),
    ]) {
      const result = resolveLayout(adSpec, profile);
      expect(result.status).toBe("unsatisfiable");
      assertInvariants(result, profile);
    }
  });
});

describe("runtime input boundary", () => {
  it.each([
    { width: 0 },
    { height: -1 },
    { width: NaN },
    { width: Infinity },
    { width: 1e10 },
    { minTapTarget: -1 },
    { touchOnly: true, minTapTarget: 0 },
    { gap: -5 },
    { padding: NaN },
    { viewingDistance: 0 },
    { minTextSize: -1 },
    { safeArea: { ...baseline.safeArea, left: -1 } },
  ])("rejects invalid surface numbers: %j", (invalid) => {
    const result = resolveLayout(adSpec, { ...baseline, ...invalid });
    expect(result.status).toBe("invalid");
    expect(result.elements).toEqual([]);
  });

  it("rejects missing content, unsafe URLs, duplicate ids and unsupported element types", () => {
    const malformed = [
      null,
      {},
      { ...adSpec, elements: [] },
      {
        ...adSpec,
        elements: adSpec.elements.filter(
          (element) => element.role !== "action",
        ),
      },
      { ...adSpec, elements: [...adSpec.elements, adSpec.elements[0]] },
      {
        ...adSpec,
        elements: [
          { ...adSpec.elements[0], type: "video" },
          ...adSpec.elements.slice(1),
        ],
      },
      {
        ...adSpec,
        elements: [
          { ...adSpec.elements[0], text: "" },
          ...adSpec.elements.slice(1),
        ],
      },
      {
        ...adSpec,
        elements: adSpec.elements.map((element) =>
          element.type === "button"
            ? { ...element, href: "javascript:alert(1)" }
            : element,
        ),
      },
    ];
    for (const input of malformed)
      expect(resolveLayout(input as AdSpec, baseline).status).toBe("invalid");
    expect(
      resolveLayout(adSpec, null as unknown as SurfaceProfile).status,
    ).toBe("invalid");
  });

  it("reports broken text adapters without crashing", () => {
    for (const measure of [
      () => NaN,
      () => -1,
      () => 0,
      () => {
        throw new Error("adapter failed");
      },
    ]) {
      const result = resolveLayout(adSpec, baseline, measure);
      expect(result.status).toBe("invalid");
      expect(result.diagnostics.at(-1)?.message).toContain(
        "Text measurement failed",
      );
    }
  });
});

describe("explanation of hard floors and composition", () => {
  it("reports numeric composition preference and the actual typography and tap floors", () => {
    const profile = surfaces[3]!;
    const result = resolveLayout(adSpec, profile);
    expect(
      result.diagnostics.find((item) => item.code === "composition-preference")
        ?.message,
    ).toContain("1.00 prefers split");
    expect(
      result.diagnostics.find((item) => item.code === "tap-minimum")?.message,
    ).toContain("60 × 60");
    expect(
      result.diagnostics.find(
        (item) => item.code === "text-minimum" && item.elementId === "cta",
      )?.message,
    ).toContain("20px");
  });
});
