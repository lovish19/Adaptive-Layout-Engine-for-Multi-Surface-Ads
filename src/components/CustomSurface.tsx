import type { SurfaceProfile } from "../engine/types";
import { customPresets } from "../demo/surfaces";

interface Props {
  surface: SurfaceProfile;
  onChange: (surface: SurfaceProfile) => void;
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

export function CustomSurface({ surface, onChange }: Props) {
  const update = <K extends keyof SurfaceProfile>(
    key: K,
    value: SurfaceProfile[K],
  ) => onChange({ ...surface, [key]: value });
  return (
    <section className="custom-editor" aria-label="Custom surface constraints">
      <label className="field-label" htmlFor="preset">
        Start from a preset
      </label>
      <select
        id="preset"
        value=""
        onChange={(event) => {
          const preset = customPresets.find(
            (item) => item.id === event.target.value,
          );
          if (preset)
            onChange({ ...preset, id: "custom", name: "Custom Surface" });
        }}
      >
        <option value="" disabled>
          Choose constraints…
        </option>
        {customPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
      <div className="field-grid">
        <NumberField
          label="Width (px)"
          value={surface.width}
          min={1}
          onChange={(value) => update("width", value)}
        />
        <NumberField
          label="Height (px)"
          value={surface.height}
          min={1}
          onChange={(value) => update("height", value)}
        />
      </div>
      <fieldset>
        <legend>Safe area (px)</legend>
        <div className="field-grid">
          {(["top", "right", "bottom", "left"] as const).map((edge) => (
            <NumberField
              key={edge}
              label={edge}
              value={surface.safeArea[edge]}
              onChange={(value) =>
                onChange({
                  ...surface,
                  safeArea: { ...surface.safeArea, [edge]: value },
                })
              }
            />
          ))}
        </div>
      </fieldset>
      <div className="field-grid">
        <NumberField
          label="Padding (px)"
          value={surface.padding}
          onChange={(value) => update("padding", value)}
        />
        <NumberField
          label="Gap (px)"
          value={surface.gap}
          onChange={(value) => update("gap", value)}
        />
        <NumberField
          label="Text floor (px)"
          value={surface.minTextSize}
          min={1}
          onChange={(value) => update("minTextSize", value)}
        />
        <NumberField
          label="Distance (m)"
          value={surface.viewingDistance}
          min={0.1}
          step={0.1}
          onChange={(value) => update("viewingDistance", value)}
        />
      </div>
      <label className="toggle-label">
        <input
          type="checkbox"
          checked={surface.touchOnly}
          onChange={(event) =>
            onChange({
              ...surface,
              touchOnly: event.target.checked,
              minTapTarget: event.target.checked
                ? Math.max(surface.minTapTarget, 44)
                : surface.minTapTarget,
            })
          }
        />
        Touch surface
      </label>
      <NumberField
        label="Minimum tap target (px)"
        value={surface.minTapTarget}
        onChange={(value) => update("minTapTarget", value)}
      />
      <p className="field-hint">
        Only constraints. The same resolver does the rest.
      </p>
    </section>
  );
}
