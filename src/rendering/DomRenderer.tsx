import type { CSSProperties } from "react";
import type { AdSpec, ResolvedLayout } from "../engine/types";

interface Props {
  spec: AdSpec;
  layout: ResolvedLayout;
  showBounds: boolean;
  onAction: (href: string) => void;
}

export function DomRenderer({ spec, layout, showBounds, onAction }: Props) {
  if (layout.status !== "resolved") return null;
  return (
    <div
      className={`ad-canvas ${showBounds ? "show-bounds" : ""}`}
      role="group"
      aria-label={spec.name}
      data-composition={layout.composition}
      style={{
        width: layout.width,
        height: layout.height,
        background: spec.colors.background,
        color: spec.colors.foreground,
        fontFamily: spec.fontFamily,
      }}
    >
      {layout.elements
        .filter((element) => element.visible)
        .map((resolved) => {
          const element = spec.elements.find(
            (item) => item.id === resolved.id,
          )!;
          const style: CSSProperties = {
            position: "absolute",
            left: resolved.x,
            top: resolved.y,
            width: resolved.width,
            height: resolved.height,
            fontSize: resolved.fontSize ?? undefined,
            lineHeight: resolved.lineHeight
              ? `${resolved.lineHeight}px`
              : undefined,
            fontWeight:
              element.type === "image" ? undefined : element.typography.weight,
          };
          const lines = (
            <span
              className="ad-lines"
              aria-hidden={resolved.truncated || undefined}
            >
              {resolved.lines.map((line, index) => (
                <span
                  key={index}
                  style={{ height: resolved.lineHeight ?? undefined }}
                >
                  {line || "\u00a0"}
                </span>
              ))}
            </span>
          );
          return (
            <div
              key={element.id}
              className={`ad-element ad-${element.type}`}
              style={style}
              data-element={element.id}
              data-variant={resolved.variant}
            >
              {element.type === "image" ? (
                <img src={element.src} alt={element.alt} draggable={false} />
              ) : element.type === "button" ? (
                <a
                  href={element.href}
                  style={{
                    background: spec.colors.action,
                    color: spec.colors.actionText,
                    padding: `${resolved.contentPadding.vertical}px ${resolved.contentPadding.horizontal}px`,
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    onAction(element.href);
                  }}
                >
                  {lines}
                </a>
              ) : (
                <div
                  className="ad-text-content"
                  style={{
                    padding: `${resolved.contentPadding.vertical}px ${resolved.contentPadding.horizontal}px`,
                  }}
                >
                  {lines}
                  {resolved.truncated && (
                    <span className="sr-only">{element.text}</span>
                  )}
                </div>
              )}
              {showBounds && (
                <span className="element-tag" aria-hidden="true">
                  {element.id} · P{element.priority}
                </span>
              )}
            </div>
          );
        })}
      {showBounds && (
        <div
          className="usable-bounds"
          aria-hidden="true"
          style={{
            left: layout.usableBounds.x,
            top: layout.usableBounds.y,
            width: layout.usableBounds.width,
            height: layout.usableBounds.height,
          }}
        />
      )}
    </div>
  );
}
