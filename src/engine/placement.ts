import type {
  AdElement,
  Composition,
  Rect,
  ResolvedElement,
  TextMeasurer,
  Variant,
} from "./types";
import { wrapText } from "./text";

export interface Item {
  element: AdElement;
  level: 0 | 1 | 2;
  width: number;
  minWidth: number;
  height: number;
  fontSize: number | null;
}

const variants: readonly Variant[] = ["full", "reduced", "compact"];

function measureItem(
  item: Item,
  width: number,
  measure: TextMeasurer,
  family: string,
): ResolvedElement | null {
  const { element, level } = item;
  if (width < item.minWidth) return null;
  const contentPadding =
    element.type === "button"
      ? { horizontal: 16, vertical: 10 }
      : element.type === "text"
        ? { horizontal: 2, vertical: 1 }
        : { horizontal: 0, vertical: 0 };
  const base = {
    id: element.id,
    x: 0,
    y: 0,
    width,
    height: item.height,
    visible: true,
    variant: variants[level]!,
    degradationLevel: level,
    fontSize: item.fontSize,
    lineHeight: null,
    contentPadding,
    lines: [],
    truncated: false,
  } satisfies ResolvedElement;
  if (element.type === "image") return base;
  const fontSize = item.fontSize!;
  const text = wrapText(
    element.text,
    width - contentPadding.horizontal * 2,
    level === 2 && element.type === "text"
      ? Math.min(2, element.typography.maxLines)
      : element.typography.maxLines,
    level === 2 && element.type === "text",
    (value) => measure(value, fontSize, element.typography.weight, family),
  );
  if (!text) return null;
  const lineHeight = fontSize * element.typography.lineHeight;
  return {
    ...base,
    ...text,
    lineHeight,
    height: Math.max(
      item.height,
      text.lines.length * lineHeight + contentPadding.vertical * 2,
    ),
  };
}

function stack(
  items: readonly Item[],
  bounds: Rect,
  gap: number,
  measure: TextMeasurer,
  family: string,
): ResolvedElement[] | null {
  const elements: ResolvedElement[] = [];
  for (const item of items) {
    const width =
      item.element.type === "text"
        ? bounds.width
        : Math.min(bounds.width, item.width);
    const element = measureItem(item, width, measure, family);
    if (!element) return null;
    elements.push(element);
  }
  const height =
    elements.reduce((total, element) => total + element.height, 0) +
    gap * Math.max(0, elements.length - 1);
  if (height > bounds.height) return null;
  let y = bounds.y + (bounds.height - height) / 2;
  return elements.map((element) => {
    const result = { ...element, x: bounds.x, y };
    if (
      items.find((item) => item.element.id === element.id)?.element.type ===
      "image"
    ) {
      result.x += (bounds.width - element.width) / 2;
    }
    y += element.height + gap;
    return result;
  });
}

export function place(
  composition: Composition,
  items: readonly Item[],
  bounds: Rect,
  gap: number,
  measure: TextMeasurer,
  family: string,
): ResolvedElement[] | null {
  if (composition === "stack")
    return stack(items, bounds, gap, measure, family);
  if (composition === "split") {
    const hero = items.find((item) => item.element.role === "hero");
    const content = items.filter((item) => item !== hero);
    if (!hero || !content.length) return null;
    const contentWidth = Math.max(...content.map((item) => item.width));
    if (hero.width + contentWidth + gap > bounds.width) return null;
    const extra = bounds.width - hero.width - contentWidth - gap;
    const heroBounds = { ...bounds, width: hero.width + extra * 0.5 };
    const contentBounds = {
      ...bounds,
      x: bounds.x + heroBounds.width + gap,
      width: contentWidth + extra * 0.5,
    };
    const image = measureItem(hero, heroBounds.width, measure, family);
    const rest = stack(content, contentBounds, gap, measure, family);
    if (!image || image.height > bounds.height || !rest) return null;
    return [
      {
        ...image,
        x: heroBounds.x,
        y: bounds.y + (bounds.height - image.height) / 2,
      },
      ...rest,
    ];
  }
  const total =
    items.reduce((sum, item) => sum + item.width, 0) +
    gap * Math.max(0, items.length - 1);
  if (total > bounds.width) return null;
  const grow = items.map((item) =>
    item.element.role === "primary" ? 2 : item.element.role === "hero" ? 1 : 0,
  );
  const growTotal = grow.reduce<number>((sum, value) => sum + value, 0) || 1;
  let x = bounds.x;
  const elements: ResolvedElement[] = [];
  for (const [index, item] of items.entries()) {
    const width =
      item.width + ((bounds.width - total) * grow[index]!) / growTotal;
    const element = measureItem(item, width, measure, family);
    if (!element || element.height > bounds.height) return null;
    elements.push({
      ...element,
      x,
      y: bounds.y + (bounds.height - element.height) / 2,
    });
    x += width + gap;
  }
  return elements;
}
