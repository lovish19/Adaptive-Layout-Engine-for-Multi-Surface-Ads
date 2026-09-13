import type { AdSpec, ResolvedLayout, SurfaceProfile } from "../engine/types";

const number = (value: number) =>
  Number.isFinite(value) ? Math.round(value * 10) / 10 : "—";

export function DiagnosticsPanel({
  spec,
  surface,
  layout,
}: {
  spec: AdSpec;
  surface: SurfaceProfile;
  layout: ResolvedLayout;
}) {
  const visible = layout.elements.filter((element) => element.visible).length;
  const changed = layout.elements.filter(
    (element) => element.degradationLevel > 0,
  ).length;
  const decisions = layout.diagnostics.filter(
    (item) => item.code !== "wrapped",
  );
  return (
    <aside className="inspector" aria-label="Resolution inspector">
      <div className="panel-heading">
        <span className="eyebrow">03 / RESOLUTION</span>
        <span
          className={`result-badge ${layout.status === "resolved" ? "" : "failed"}`}
        >
          {layout.status}
        </span>
      </div>
      <h2>
        {layout.status === "resolved"
          ? "A fit, with intent."
          : "Constraints don’t fit."}
      </h2>
      <p className="inspector-intro">
        {layout.status !== "resolved"
          ? "Adjust the inputs to find a valid layout."
          : changed
            ? "Content adapts in priority order to preserve the essentials."
            : "All content fits without degradation."}
      </p>
      <dl className="resolution-facts">
        <div>
          <dt>Composition</dt>
          <dd className="capitalize">{layout.composition ?? "None"}</dd>
        </div>
        <div>
          <dt>Visible elements</dt>
          <dd>
            {visible} / {spec.elements.length}
          </dd>
        </div>
        <div>
          <dt>Placement attempts</dt>
          <dd>{layout.attempts}</dd>
        </div>
      </dl>
      <section className="inspector-section">
        <h3>Surface constraints</h3>
        <dl className="constraint-facts">
          <div>
            <dt>Usable area</dt>
            <dd>
              {number(layout.usableBounds.width)} ×{" "}
              {number(layout.usableBounds.height)}
            </dd>
          </div>
          <div>
            <dt>Aspect ratio</dt>
            <dd>{number(surface.width / surface.height)} : 1</dd>
          </div>
          <div>
            <dt>
              Safe area <small>T R B L</small>
            </dt>
            <dd>
              {(["top", "right", "bottom", "left"] as const)
                .map((edge) => number(surface.safeArea[edge]))
                .join(" / ")}
            </dd>
          </div>
          <div>
            <dt>Padding / gap</dt>
            <dd>
              {number(surface.padding)} / {number(surface.gap)} px
            </dd>
          </div>
          <div>
            <dt>Text floor</dt>
            <dd>{number(layout.effectiveMinTextSize)} px</dd>
          </div>
          <div>
            <dt>Viewing distance</dt>
            <dd>{number(surface.viewingDistance)} m</dd>
          </div>
          <div>
            <dt>Tap target</dt>
            <dd>
              {surface.touchOnly
                ? `≥ ${number(surface.minTapTarget)} px`
                : "Non-touch"}
            </dd>
          </div>
        </dl>
      </section>
      <section className="inspector-section">
        <h3>
          Element outcomes <span>{changed} adapted</span>
        </h3>
        <ul className="element-outcomes">
          {spec.elements.map((element) => {
            const resolved = layout.elements.find(
              (item) => item.id === element.id,
            );
            return (
              <li key={element.id}>
                <span className="priority-mark">{element.priority}</span>
                <span className="outcome-name">
                  {element.id}
                  <small>
                    {resolved?.visible
                      ? element.type === "image"
                        ? `${number(resolved.width)} × ${number(resolved.height)} px`
                        : `${number(resolved.fontSize ?? 0)} px text`
                      : element.optional
                        ? "optional"
                        : "required"}
                  </small>
                </span>
                <span
                  className={`variant variant-${resolved?.variant ?? "none"}`}
                >
                  {resolved?.variant ?? "unplaced"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <details className="decision-trace" open>
        <summary>
          Decision trace <span>{decisions.length}</span>
        </summary>
        {decisions.length ? (
          <ol>
            {decisions.map((decision, index) => (
              <li key={index}>{decision.message}</li>
            ))}
          </ol>
        ) : (
          <p>Preferred composition fits. No degradation needed.</p>
        )}
      </details>
      <p className="inspector-note">
        1 = highest priority. Required content is never hidden.
      </p>
    </aside>
  );
}
