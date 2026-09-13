export type Size = { width: number; height: number };
export type Rect = Size & { x: number; y: number };
export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export interface Constraints {
  idealWidth: number;
  minWidth: number;
}

interface ElementBase {
  id: string;
  /** 1 is highest priority. Equal priorities degrade in reverse spec order. */
  priority: number;
  optional: boolean;
  constraints: Constraints;
}

export interface Typography {
  idealFontSize: number;
  minFontSize: number;
  lineHeight: number;
  weight: 400 | 500 | 600 | 700;
  maxLines: number;
}

export type AdElement =
  | (ElementBase & {
      type: "text";
      role: "primary" | "branding" | "secondary";
      text: string;
      typography: Typography;
    })
  | (ElementBase & {
      type: "image";
      role: "hero" | "branding";
      src: string;
      alt: string;
      idealHeight: number;
      minHeight: number;
    })
  | (ElementBase & {
      type: "button";
      role: "action";
      text: string;
      typography: Typography;
      minHeight: number;
      href: string;
    });

export interface AdSpec {
  id: string;
  name: string;
  fontFamily: string;
  elements: readonly AdElement[];
  colors: {
    background: string;
    foreground: string;
    action: string;
    actionText: string;
  };
}

export interface SurfaceProfile extends Size {
  id: string;
  name: string;
  safeArea: Insets;
  padding: number;
  gap: number;
  minTapTarget: number;
  minTextSize: number;
  /** Metres; raises the readability floor above the supplied minimum if needed. */
  viewingDistance: number;
  touchOnly: boolean;
}

export type Variant = "full" | "reduced" | "compact" | "hidden";
export type Composition = "stack" | "split" | "inline";
export type DiagnosticCode =
  | "invalid-input"
  | "unsatisfiable"
  | "composition-preference"
  | "text-minimum"
  | "tap-minimum"
  | "readability-floor"
  | "repositioned"
  | "reduced"
  | "compact"
  | "hidden"
  | "wrapped"
  | "truncated";

export interface Diagnostic {
  code: DiagnosticCode;
  message: string;
  elementId?: string;
  priority?: number;
}

export interface ResolvedElement extends Rect {
  id: string;
  visible: boolean;
  variant: Variant;
  degradationLevel: 0 | 1 | 2 | 3;
  fontSize: number | null;
  lineHeight: number | null;
  contentPadding: { horizontal: number; vertical: number };
  /** Explicit lines: renderer must not independently reflow text. */
  lines: readonly string[];
  truncated: boolean;
}

interface LayoutBase extends Size {
  usableBounds: Rect;
  elements: readonly ResolvedElement[];
  diagnostics: readonly Diagnostic[];
  attempts: number;
  effectiveMinTextSize: number;
}

export type ResolvedLayout =
  | (LayoutBase & { status: "resolved"; composition: Composition })
  | (LayoutBase & { status: "invalid" | "unsatisfiable"; composition: null });

export type TextMeasurer = (
  text: string,
  fontSize: number,
  weight: number,
  family: string,
) => number;
