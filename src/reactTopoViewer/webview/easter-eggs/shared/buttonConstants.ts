/**
 * Shared button constants for Easter Egg modes
 */

/** Button visible state styles */
export const BTN_VISIBLE = { opacity: 1, transform: "translateY(0)" } as const;

/** Button hidden state styles */
export const BTN_HIDDEN = { opacity: 0, transform: "translateY(16px)" } as const;

/** Button transition */
export const BTN_TRANSITION = "all 0.5s ease";

/** Button backdrop blur value */
export const BTN_BLUR = "blur(10px)";
