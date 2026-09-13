import type { TextMeasurer } from "./types";

/** Portable fallback, deliberately conservative for Latin UI copy; not font-accurate. */
export const estimateTextWidth: TextMeasurer = (text, fontSize, weight) =>
  Array.from(text).reduce((width, character) => {
    const factor = /\s/.test(character)
      ? 0.3
      : /[ilI.,'!|]/.test(character)
        ? 0.3
        : /[MW@%]/.test(character)
          ? 0.9
          : character.codePointAt(0)! > 255
            ? 1
            : 0.58;
    return width + factor * fontSize * (weight >= 600 ? 1.04 : 1);
  }, 0);

export function wrapText(
  text: string,
  width: number,
  maxLines: number,
  truncate: boolean,
  measure: (text: string) => number,
): { lines: string[]; truncated: boolean } | null {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const joined = line ? `${line} ${word}` : word;
      if (measure(joined) <= width) {
        line = joined;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const character of Array.from(word)) {
        if (measure(character) > width) return null;
        if (measure(line + character) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  if (lines.length <= maxLines) return { lines, truncated: false };
  if (!truncate || measure("…") > width) return null;
  const visible = lines.slice(0, maxLines);
  let last = Array.from(visible[maxLines - 1] ?? "");
  while (last.length && measure(last.join("") + "…") > width)
    last = last.slice(0, -1);
  visible[maxLines - 1] = last.join("").trimEnd() + "…";
  return { lines: visible, truncated: true };
}
