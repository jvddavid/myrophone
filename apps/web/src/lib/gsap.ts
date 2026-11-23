import { gsap } from "gsap";

/**
 * Centralized GSAP entry point. Components must import from here, never from "gsap".
 */
export { gsap };

/** True when the visitor asked the system to reduce motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
