import type { TextMeasurer } from "../engine/types";
import { estimateTextWidth } from "../engine/text";

export function createBrowserMeasurer(): TextMeasurer {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return estimateTextWidth;
  return (text, size, weight, family) => {
    context.font = `${weight} ${size}px ${family}`;
    return context.measureText(text).width;
  };
}
