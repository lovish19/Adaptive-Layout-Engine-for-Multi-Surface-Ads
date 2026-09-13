import type { AdSpec, SurfaceProfile } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const number = (
  value: unknown,
  minimum = 0,
  maximum = 1_000_000,
): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum;
const positive = (value: unknown): value is number =>
  number(value) && value > 0;
const content = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 10_000;
const safeUrl = (value: unknown) =>
  content(value) && /^(https?:\/\/|\/(?!\/)|#|\.\/)/i.test(value);

/** Runtime boundary also covers callers loading specs from JSON. */
export function validateInput(spec: AdSpec, surface: SurfaceProfile): string[] {
  const errors: string[] = [];
  const rawSurface: unknown = surface;
  const rawSpec: unknown = spec;
  if (!record(rawSurface)) return ["Surface must be an object."];
  if (!positive(rawSurface.width) || !positive(rawSurface.height)) {
    errors.push(
      "Surface width and height must be finite, greater than zero, and at most 1,000,000px.",
    );
  }
  if (
    !record(rawSurface.safeArea) ||
    !["top", "right", "bottom", "left"].every(
      (edge) =>
        record(rawSurface.safeArea) && number(rawSurface.safeArea[edge]),
    )
  )
    errors.push("Safe-area insets must be finite, non-negative numbers.");
  for (const key of ["padding", "gap", "minTapTarget"]) {
    if (!number(rawSurface[key]))
      errors.push(`${key} must be finite and non-negative.`);
  }
  if (
    !positive(rawSurface.minTextSize) ||
    !positive(rawSurface.viewingDistance)
  ) {
    errors.push(
      "minTextSize and viewingDistance must be finite and greater than zero.",
    );
  }
  if (typeof rawSurface.touchOnly !== "boolean")
    errors.push("touchOnly must be a boolean.");
  if (rawSurface.touchOnly === true && !positive(rawSurface.minTapTarget)) {
    errors.push("Touch surfaces require a positive minTapTarget.");
  }
  if (!record(rawSpec))
    return [...errors, "Ad specification must be an object."];
  if (
    !content(rawSpec.id) ||
    !content(rawSpec.name) ||
    !content(rawSpec.fontFamily)
  ) {
    errors.push("Ad id, name, and fontFamily are required.");
  }
  if (
    !record(rawSpec.colors) ||
    !["background", "foreground", "action", "actionText"].every(
      (key) =>
        record(rawSpec.colors) &&
        typeof rawSpec.colors[key] === "string" &&
        /^#[0-9a-f]{6}$/i.test(rawSpec.colors[key]),
    )
  )
    errors.push("Ad colors must be six-digit hex colors.");
  if (
    !Array.isArray(rawSpec.elements) ||
    rawSpec.elements.length === 0 ||
    rawSpec.elements.length > 30
  ) {
    return [...errors, "Ad requires between 1 and 30 elements."];
  }
  const ids = new Set<string>();
  const requiredRoles = new Set<string>();
  rawSpec.elements.forEach((element: unknown, index: number) => {
    const label = `Element ${index + 1}`;
    if (!record(element)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    if (!content(element.id) || ids.has(element.id))
      errors.push(`${label} needs a unique, non-empty id.`);
    else ids.add(element.id);
    if (!positive(element.priority) || !Number.isInteger(element.priority)) {
      errors.push(
        `${label} priority must be a positive integer (1 is highest).`,
      );
    }
    if (typeof element.optional !== "boolean")
      errors.push(`${label} optional must be a boolean.`);
    if (
      !record(element.constraints) ||
      !positive(element.constraints.minWidth) ||
      !positive(element.constraints.idealWidth) ||
      element.constraints.minWidth > element.constraints.idealWidth
    ) {
      errors.push(`${label} widths must satisfy 0 < minWidth <= idealWidth.`);
    }
    const roles: Record<string, readonly string[]> = {
      text: ["primary", "secondary", "branding"],
      image: ["hero", "branding"],
      button: ["action"],
    };
    if (
      typeof element.type !== "string" ||
      typeof element.role !== "string" ||
      !Object.hasOwn(roles, element.type) ||
      !roles[element.type]?.includes(element.role)
    )
      errors.push(`${label} has an unsupported type/role combination.`);
    if (element.optional === false && typeof element.role === "string")
      requiredRoles.add(element.role);
    if (element.type === "image") {
      if (!safeUrl(element.src) || !content(element.alt))
        errors.push(`${label} needs an image source and alt text.`);
      if (
        !positive(element.minHeight) ||
        !positive(element.idealHeight) ||
        element.minHeight > element.idealHeight
      ) {
        errors.push(
          `${label} image heights must satisfy 0 < minHeight <= idealHeight.`,
        );
      }
    } else if (element.type === "text" || element.type === "button") {
      if (!content(element.text))
        errors.push(`${label} text is required (up to 10,000 characters).`);
      const t = element.typography;
      if (
        !record(t) ||
        !positive(t.minFontSize) ||
        !positive(t.idealFontSize) ||
        t.minFontSize > t.idealFontSize ||
        !number(t.lineHeight, 1, 3) ||
        !number(t.maxLines, 1, 20) ||
        !Number.isInteger(t.maxLines) ||
        ![400, 500, 600, 700].includes(t.weight as number)
      )
        errors.push(`${label} has invalid typography.`);
      if (
        element.type === "button" &&
        (!positive(element.minHeight) || !safeUrl(element.href))
      ) {
        errors.push(
          `${label} needs a positive button minHeight and a safe relative or HTTP(S) href.`,
        );
      }
    }
  });
  for (const role of ["primary", "hero", "action"]) {
    if (!requiredRoles.has(role))
      errors.push(`Ad needs a non-optional ${role} element.`);
  }
  return errors;
}
