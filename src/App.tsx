import { useMemo, useRef, useState } from "react";
import { adSpec } from "./demo/adSpec";
import { customPresets, surfaces } from "./demo/surfaces";
import { resolveLayout } from "./engine/resolver";
import type { AdSpec, SurfaceProfile, TextMeasurer } from "./engine/types";
import { SurfacePreview } from "./components/SurfacePreview";
import { CustomSurface } from "./components/CustomSurface";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";

function SurfaceIcon({ width, height }: { width: number; height: number }) {
  const scale = 22 / Math.max(width, height);
  return (
    <span className="surface-icon" aria-hidden="true">
      <span
        style={{
          width: Math.max(5, width * scale),
          height: Math.max(5, height * scale),
        }}
      />
    </span>
  );
}

export function App({ measureText }: { measureText: TextMeasurer }) {
  const [selectedId, setSelectedId] = useState(surfaces[0]!.id);
  const [mode, setMode] = useState<"single" | "all">("single");
  const [showBounds, setShowBounds] = useState(false);
  const [headline, setHeadline] = useState(
    adSpec.elements.find(
      (element) => element.type === "text" && element.role === "primary",
    )!.text,
  );
  const [custom, setCustom] = useState<SurfaceProfile>({
    ...customPresets[2]!,
    id: "custom",
    name: "Custom Surface",
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const spec = useMemo<AdSpec>(
    () => ({
      ...adSpec,
      elements: adSpec.elements.map((element) =>
        element.type === "text" && element.role === "primary"
          ? { ...element, text: headline }
          : element,
      ),
    }),
    [headline],
  );
  const selected =
    selectedId === "custom"
      ? custom
      : surfaces.find((surface) => surface.id === selectedId)!;
  const layout = useMemo(
    () => resolveLayout(spec, selected, measureText),
    [spec, selected, measureText],
  );
  const comparisons = useMemo(
    () =>
      mode === "all"
        ? surfaces.map((surface) => ({
            surface,
            layout: resolveLayout(spec, surface, measureText),
          }))
        : [],
    [spec, mode, measureText],
  );
  const chooseSurface = (id: string) => {
    setSelectedId(id);
    setMode("single");
  };
  const onAction = (href: string) => {
    if (href === "#product-details") dialog.current?.showModal();
    else window.location.assign(href);
  };
  const exportLayout = () => {
    const result = mode === "all" ? comparisons : { surface: selected, layout };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ spec, result }, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `form-01-${mode === "all" ? "all-surfaces" : selected.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <a className="skip-link" href="#workbench">
        Skip to layout workbench
      </a>
      <header className="app-header">
        <a href="#" className="lab-brand" aria-label="Surface Lab home">
          <span className="lab-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          surface<span className="brand-light">lab</span>
        </a>
        <span className="header-caption">FRONTEND R&D / 001</span>
        <span className="engine-label">
          <span className="status-dot" />
          TypeScript constraint engine
        </span>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">EXPERIMENT 01 / MULTI-SURFACE ADS</p>
            <h1>One idea. Every surface.</h1>
            <p className="intro-copy">
              One ad specification. Multiple constrained surfaces. A layout that
              adapts.
            </p>
          </div>
          <div
            className="resolution-flow"
            aria-label="Ad specification to resolver to layout"
          >
            <span>
              <b>01</b> Ad spec
            </span>
            <i>→</i>
            <span>
              <b>02</b> Constraints
            </span>
            <i>→</i>
            <span className="flow-result">
              <b>03</b> Layout
            </span>
          </div>
        </section>
        <section
          className="workbench"
          id="workbench"
          aria-label="Adaptive Layout Engine"
        >
          <div className="workbench-toolbar">
            <div className="workbench-title">
              <span className="tiny-grid" aria-hidden="true">
                ▦
              </span>
              <h2>Adaptive Layout Engine</h2>
              <span className="version-tag">v1.0</span>
            </div>
            <div className="toolbar-actions">
              <div className="segmented" aria-label="Preview mode">
                <button
                  type="button"
                  aria-pressed={mode === "single"}
                  onClick={() => setMode("single")}
                >
                  Single surface
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "all"}
                  onClick={() => setMode("all")}
                >
                  All surfaces
                </button>
              </div>
              <label className="bounds-toggle">
                <input
                  type="checkbox"
                  checked={showBounds}
                  onChange={(event) => setShowBounds(event.target.checked)}
                />
                Bounds
              </label>
              <button
                className="export-button"
                type="button"
                onClick={exportLayout}
                title="Download the ad spec, constraints and resolved layout"
              >
                Export JSON <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
          <div
            className={`workbench-body ${mode === "all" ? "comparison-mode" : ""}`}
          >
            <aside className="controls" aria-label="Ad and surface controls">
              <section className="spec-summary">
                <p className="eyebrow">01 / AD SPECIFICATION</p>
                <div className="product-summary">
                  <img src="/headphones.png" alt="" />
                  <div>
                    <strong>FORM 01</strong>
                    <span>Quiet by design</span>
                    <small>CONCEPT CAMPAIGN</small>
                  </div>
                </div>
                <label className="field-label" htmlFor="headline">
                  Headline <span>editable</span>
                </label>
                <textarea
                  id="headline"
                  value={headline}
                  rows={2}
                  maxLength={1000}
                  onChange={(event) => setHeadline(event.target.value)}
                  spellCheck={false}
                />
                <div className="spec-meta">
                  <span>{spec.elements.length} elements</span>
                  <span>
                    {
                      spec.elements.filter((element) => !element.optional)
                        .length
                    }{" "}
                    required
                  </span>
                  <span>1 source</span>
                </div>
                <details className="spec-source">
                  <summary>
                    View declarative spec <span aria-hidden="true">↗</span>
                  </summary>
                  <pre>{JSON.stringify(spec, null, 2)}</pre>
                </details>
              </section>
              <section className="surface-controls">
                <p className="eyebrow">02 / TARGET SURFACE</p>
                <div className="surface-options">
                  {surfaces.map((surface) => (
                    <button
                      type="button"
                      key={surface.id}
                      aria-pressed={
                        selectedId === surface.id && mode === "single"
                      }
                      className="surface-option"
                      onClick={() => chooseSurface(surface.id)}
                    >
                      <SurfaceIcon
                        width={surface.width}
                        height={surface.height}
                      />
                      <span>
                        <strong>{surface.name.replace("Retail ", "")}</strong>
                        <small>
                          {surface.width} × {surface.height}
                        </small>
                      </span>
                      <span
                        className="selection-indicator"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                  <button
                    type="button"
                    className="surface-option custom-option"
                    aria-pressed={selectedId === "custom" && mode === "single"}
                    onClick={() => chooseSurface("custom")}
                  >
                    <span className="surface-icon" aria-hidden="true">
                      +
                    </span>
                    <span>
                      <strong>Custom Surface</strong>
                      <small>Try your own constraints</small>
                    </span>
                    <span className="selection-indicator" aria-hidden="true" />
                  </button>
                </div>
              </section>
              {selectedId === "custom" && mode === "single" ? (
                <CustomSurface surface={custom} onChange={setCustom} />
              ) : (
                <div className="constraint-note">
                  <span aria-hidden="true">↳</span>
                  <p>
                    Same content. Different constraints.
                    <br />
                    No surface-specific layouts.
                  </p>
                </div>
              )}
            </aside>
            <div className="preview-area">
              {mode === "single" ? (
                <SurfacePreview
                  spec={spec}
                  surface={selected}
                  layout={layout}
                  showBounds={showBounds}
                  onAction={onAction}
                />
              ) : (
                <>
                  <div className="comparison-heading">
                    <span className="eyebrow">
                      ONE SPECIFICATION / FOUR RESOLUTIONS
                    </span>
                    <h2>See the system adapt.</h2>
                    <p>
                      Each surface is resolved independently from the same
                      source.
                    </p>
                  </div>
                  <div className="comparison-grid">
                    {comparisons.map(({ surface, layout: result }) => (
                      <SurfacePreview
                        key={surface.id}
                        spec={spec}
                        surface={surface}
                        layout={result}
                        showBounds={showBounds}
                        comparison
                        onInspect={() => chooseSurface(surface.id)}
                        onAction={onAction}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {mode === "single" && (
              <DiagnosticsPanel
                spec={spec}
                surface={selected}
                layout={layout}
              />
            )}
          </div>
          <footer className="workbench-footer">
            <span>
              <span className="status-dot" />
              Deterministic resolution · DOM-independent core
            </span>
            <span>
              Preview is scaled to fit. Constraints use surface pixels.
            </span>
          </footer>
        </section>
        <footer className="page-footer">
          <span>
            Adaptive Layout Engine <span className="footer-divider">/</span>{" "}
            Frontend R&D
          </span>
          <span>Built around constraints, not breakpoints. by Lovish Singla</span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        id="product-details"
        className="product-dialog"
        aria-labelledby="product-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-content">
          <button
            type="button"
            className="dialog-close"
            aria-label="Close product details"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
          <img src="/headphones.png" alt="Ivory FORM 01 headphones" />
          <span className="eyebrow">THE DEMO CREATIVE</span>
          <h2 id="product-title">FORM 01</h2>
          <p>Less noise. More feeling.</p>
          <p>Over-ear headphones in warm ivory. Concept price: $249.</p>
          <p className="dialog-note">
            FORM is a fictional product created for this layout experiment. This
            panel is the ad’s CTA destination.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => dialog.current?.close()}
          >
            Back to the experiment
          </button>
        </div>
      </dialog>
    </>
  );
}
