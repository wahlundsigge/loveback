// Shared LoveBack design tokens — black/gold palette. Not a full design
// system rewrite of every screen; these exist so newly-touched code has a
// consistent scale to reach for instead of hand-picking another one-off
// number, and so the repeated "gold glow" shadow recipe (previously
// copy-pasted independently on ~6 different surfaces) has one source.

export const GOLD = "#C9A84C";
export const BG = "#080808";
export const SURFACE = "#101010";
export const BORDER = "#1E1C19";
export const BORDER_GOLD = "#2E2A18";
export const TEXT_MUTED = "#4A4035";
export const TEXT_FAINT = "#3A3530";

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 50,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

// Typography roles — built from an audit of every fontSize/weight/letterSpacing
// combo actually in use across the app (Pass 2). Each role below replaces a
// cluster of near-duplicate one-off values that were serving the same job
// (e.g. five different "list row name" sizes). Where a difference was doing
// real work (a hero card name vs. a list row name) it stays a separate role
// rather than being flattened into one number.
export const type = {
  /** Giant hero numbers/codes — wallet balance, duo invite code, splash wordmark. */
  display: { fontSize: 36, fontWeight: "900" as const, letterSpacing: 6 },
  /** Tab-root screen heading ("PLÅNBOK", "DUOS", "MATCHNINGAR"). */
  screenTitle: { fontSize: 20, fontWeight: "900" as const, letterSpacing: 4 },
  /** Stack-pushed screen heading (auth, onboarding step titles). */
  pageTitle: { fontSize: 28, fontWeight: "900" as const, letterSpacing: 1 },
  /** Eyebrow label introducing a group of content ("FOTON", "PREFERENSER"). */
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 2, textTransform: "uppercase" as const },
  /** Loud empty-state headline ("INGA MATCHNINGAR ÄN"). */
  emptyStateLabel: { fontSize: 11, fontWeight: "900" as const, letterSpacing: 4, textTransform: "uppercase" as const },
  /** Name/primary label of a list row or small card (a person, a transaction). */
  cardTitle: { fontSize: 16, fontWeight: "700" as const },
  /** Identity overlay when a card IS the screen's content (swipe card, duo card, own profile name). */
  heroTitle: { fontSize: 22, fontWeight: "800" as const, letterSpacing: 0.3 },
  /** Primary readable paragraph / sheet explanation text. */
  body: { fontSize: 14, fontWeight: "400" as const, lineHeight: 21 },
  /** Small form-field or stat label above/beside a value. */
  label: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.5 },
  /** Smallest text — timestamps, hints, tiny badges. */
  caption: { fontSize: 12, fontWeight: "400" as const },
};

/** The repeated gold "glow" shadow — cards, action buttons, toasts. */
export function glowShadow(opacity = 0.3, blur = 14) {
  return {
    shadowColor: GOLD,
    shadowOpacity: opacity,
    shadowRadius: blur,
    shadowOffset: { width: 0, height: 0 },
    elevation: Math.round(blur),
  } as const;
}
