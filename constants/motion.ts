// Shared motion system — every spring/timing value used for gestures and
// transitions across the app should come from here instead of being
// hand-picked per screen. The goal isn't variety, it's the opposite: that
// every card, sheet, press and page transition feels like it was tuned by
// the same person in one sitting.

/** Press feedback (Touchable) — the fastest tier, barely-there. */
export const DURATION_FAST = 120;
/** Standard content transitions — photo paging, tab/sheet content swaps. */
export const DURATION_NORMAL = 200;
/** Bigger, more deliberate moves — card fly-off, sheet dismiss, modal exit. */
export const DURATION_EMPHASIZED = 280;

/** Default press-scale timings (used by components/Touchable.tsx). */
export const PRESS_SCALE_IN = 90;
export const PRESS_SCALE_OUT = 150;

/**
 * Snappy settle — cards resetting after an under-threshold drag, sheets
 * springing back from a cancelled dismiss. Tight and quick, no overshoot.
 */
export const SPRING_SNAPPY = { damping: 20, stiffness: 300, mass: 0.5 } as const;

/**
 * Gentler settle — used where a slightly softer landing reads as more
 * "physical" (sheet open, bigger surfaces). Still no bounce.
 */
export const SPRING_GENTLE = { damping: 22, stiffness: 220, mass: 0.6 } as const;

/** Distance/velocity thresholds shared by every drag-to-decide gesture
 *  (swipe cards, photo paging, sheet dismiss) so they all take a flick
 *  as seriously as a long drag, by the same margins. */
export const VELOCITY_THRESHOLD = 800;
export const PHOTO_VELOCITY_THRESHOLD = 700;
