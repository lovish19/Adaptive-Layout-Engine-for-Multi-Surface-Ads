import { expect, it } from "vitest";
import { estimateTextWidth, wrapText } from "../src/engine/text";

const measure = (text: string) => Array.from(text).length * 10;

it("wraps words, respects explicit newlines and measures long unbroken content", () => {
  expect(
    wrapText("Less noise.\nMore feeling.", 130, 4, false, measure)?.lines,
  ).toEqual(["Less noise.", "More feeling."]);
  expect(wrapText("extraordinarily", 50, 4, false, measure)?.lines).toEqual([
    "extra",
    "ordin",
    "arily",
  ]);
});

it("only truncates when explicitly allowed, including the width of the ellipsis", () => {
  expect(wrapText("one two three four", 70, 1, false, measure)).toBeNull();
  const result = wrapText("one two three four", 70, 1, true, measure);
  expect(result?.truncated).toBe(true);
  expect(result?.lines[0]?.endsWith("…")).toBe(true);
  expect(measure(result!.lines[0]!)).toBeLessThanOrEqual(70);
});

it("rejects widths too narrow for even one character and handles empty paragraphs", () => {
  expect(wrapText("abc", 5, 1, true, measure)).toBeNull();
  expect(wrapText("a\n\nb", 30, 3, false, measure)?.lines).toEqual([
    "a",
    "",
    "b",
  ]);
});

it("estimates different glyph widths and scales consistently with font size", () => {
  expect(estimateTextWidth("WWW", 20, 400, "Arial")).toBeGreaterThan(
    estimateTextWidth("iii", 20, 400, "Arial"),
  );
  expect(estimateTextWidth("hello", 40, 400, "Arial")).toBeCloseTo(
    2 * estimateTextWidth("hello", 20, 400, "Arial"),
  );
});
