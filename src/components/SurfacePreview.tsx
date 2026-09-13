import { useEffect, useRef, useState } from "react";
import type { AdSpec, ResolvedLayout, SurfaceProfile } from "../engine/types";
import { DomRenderer } from "../rendering/DomRenderer";

interface Props {
  spec: AdSpec;
  surface: SurfaceProfile;
  layout: ResolvedLayout;
  showBounds: boolean;
  comparison?: boolean;
  onInspect?: () => void;
  onAction: (href: string) => void;
}

export function SurfacePreview({
  spec,
  surface,
  layout,
  showBounds,
  comparison = false,
  onInspect,
  onAction,
}: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [actualSize, setActualSize] = useState(false);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale =
    layout.status === "resolved"
      ? actualSize && !comparison
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              (size.width - 48) / layout.width,
              (size.height - 48) / layout.height,
            ),
          )
      : 0;
  const degraded = layout.elements.filter(
    (element) => element.degradationLevel > 0,
  ).length;
  return (
    <article
      className={`surface-preview ${comparison ? "comparison-preview" : ""}`}
    >
      <div className="preview-heading">
        <div>
          <span className="eyebrow">
            {comparison ? "RESOLVED SURFACE" : "LIVE PREVIEW"}
          </span>
          <h2>{surface.name}</h2>
        </div>
        <div className="preview-tools">
          <span className="dimensions">
            {surface.width || "—"} × {surface.height || "—"}
          </span>
          {comparison ? (
            onInspect && (
              <button
                type="button"
                className="preview-size-button"
                onClick={onInspect}
              >
                Inspect
              </button>
            )
          ) : (
            <button
              type="button"
              className="preview-size-button"
              aria-pressed={actualSize}
              aria-label={
                actualSize
                  ? "Fit preview to workspace"
                  : "Inspect preview at actual size"
              }
              onClick={() => setActualSize((value) => !value)}
            >
              {actualSize ? "Fit" : "100%"}
            </button>
          )}
        </div>
      </div>
      <div
        className={`preview-stage ${actualSize && !comparison ? "actual-size" : ""}`}
        ref={stage}
      >
        {layout.status === "resolved" ? (
          <div
            className="scaled-frame"
            style={{
              width: layout.width * scale,
              height: layout.height * scale,
            }}
          >
            <div
              className="scale-origin"
              style={{ transform: `scale(${scale})` }}
            >
              <DomRenderer
                spec={spec}
                layout={layout}
                showBounds={showBounds}
                onAction={onAction}
              />
            </div>
          </div>
        ) : (
          <div className="resolution-error" role="status">
            <span className="error-symbol">!</span>
            <h3>
              {layout.status === "invalid"
                ? "Check your constraints"
                : "This surface needs more room"}
            </h3>
            <p>{layout.diagnostics.at(-1)?.message}</p>
            <span>No partial layout is rendered.</span>
          </div>
        )}
      </div>
      <div className="preview-footer">
        <span
          className={
            layout.status === "resolved" ? "status-dot" : "status-dot warning"
          }
        />
        <span>
          {layout.status === "resolved"
            ? `${layout.composition} composition`
            : `${layout.status} constraints`}
        </span>
        {degraded > 0 && (
          <span className="degradation-note">{degraded} adapted</span>
        )}
        <span className="scale-label">{Math.round(scale * 100)}% preview</span>
      </div>
    </article>
  );
}
