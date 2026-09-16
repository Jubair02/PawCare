"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type HTMLMotionProps,
  type Transition,
  type Variants,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Shared motion primitives (landing page, auth, and any marketing-style surface).
 *
 * One easing curve, one distance scale and one viewport rule, shared by every
 * section so the page reads as a single motion language. Reduced motion is
 * handled globally by `MotionConfig reducedMotion="user"` in app/providers.tsx:
 * transforms are skipped for those users and only opacity fades remain.
 *
 * Everything here animates `opacity` and `transform` only (GPU-composited,
 * no layout work), and every scroll reveal runs once.
 */

/** Smooth, decelerating cubic-bezier — "easeOutQuint"-like, no bounce. */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Default reveal viewport: trigger once, when ~20% of the element is visible. */
export const VIEWPORT = { once: true, amount: 0.2 } as const;

export const DURATION = {
  fast: 0.2,
  base: 0.5,
  slow: 0.7,
} as const;

/** Translate distance in px for reveals — shorter on small screens. */
function useDistance(): number {
  return useIsMobile() ? 12 : 24;
}

/**
 * Fade-up variants. `custom` carries the translate distance so mobile and
 * desktop can share one variant object.
 */
export const fadeUp: Variants = {
  hidden: (distance: number = 24) => ({ opacity: 0, y: distance }),
  visible: { opacity: 1, y: 0 },
};

/** Parent container that staggers `fadeUp` children. */
export function staggerContainer(stagger = 0.08, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

// ---------- scroll reveal ----------

type RevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: React.ReactNode;
  /** Seconds to hold before the reveal starts. */
  delay?: number;
};

/**
 * Single-element scroll reveal (fade + slight upward translate).
 * Drop-in wrapper for section headings, banners, the footer, etc.
 */
export function Reveal({ children, delay = 0, className, ...rest }: RevealProps) {
  const distance = useDistance();
  return (
    <motion.div
      className={className}
      custom={distance}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ duration: DURATION.base, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerGroupProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: React.ReactNode;
  /** Seconds between each child. */
  stagger?: number;
  /** Seconds before the first child starts. */
  delay?: number;
};

/**
 * Container for a grid/list of `StaggerItem`s. Reveals once on scroll and
 * cascades its children. Layout classes (grid, gap…) go on this element.
 */
export function StaggerGroup({ children, stagger = 0.08, delay = 0, className, ...rest }: StaggerGroupProps) {
  const variants = useMemo(() => staggerContainer(stagger, delay), [stagger, delay]);
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Child of `StaggerGroup` (or of any parent driving `hidden`/`visible`). */
export function StaggerItem({ children, className, ...rest }: Omit<HTMLMotionProps<"div">, "children"> & { children: React.ReactNode }) {
  const distance = useDistance();
  return (
    <motion.div className={className} custom={distance} variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE }} {...rest}>
      {children}
    </motion.div>
  );
}

// ---------- hover micro-interactions ----------

const hoverTransition: Transition = { duration: DURATION.fast + 0.05, ease: EASE };

/**
 * Subtle card lift. Pointer hover only — touch input never triggers
 * `whileHover`, so mobile users are unaffected. Children can opt into the
 * same gesture with `variants={{ hover: … }}` (see `HoverIcon`).
 */
export function HoverLift({ children, className, ...rest }: Omit<HTMLMotionProps<"div">, "children"> & { children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      variants={{ hover: { y: -4, scale: 1.01 } }}
      whileHover="hover"
      transition={hoverTransition}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Icon tile that gently scales when its enclosing `HoverLift` is hovered. */
export function HoverIcon({ children, className, ...rest }: Omit<HTMLMotionProps<"div">, "children"> & { children: React.ReactNode }) {
  return (
    <motion.div className={className} variants={{ hover: { scale: 1.06 } }} transition={hoverTransition} {...rest}>
      {children}
    </motion.div>
  );
}

const MotionButtonBase = motion.create(Button);

/**
 * `Button` with press/hover feedback. Narrows the base `transition-all` to
 * colours and shadow so CSS transitions do not fight Framer's transform.
 */
export function MotionButton({ className, ...props }: React.ComponentProps<typeof MotionButtonBase>) {
  return (
    <MotionButtonBase
      className={cn("transition-[color,background-color,border-color,box-shadow,opacity]", className)}
      whileHover={{ y: -1, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
      {...props}
    />
  );
}

/** Plain text link/button with a hair of lift on hover and press feedback. */
export function MotionNavButton({ className, children, ...props }: HTMLMotionProps<"button">) {
  return (
    <motion.button
      type="button"
      className={className}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

// ---------- count-up ----------

const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Renders `value` and, when it is a plain number ("12", "4.9"), counts up to
 * it the first time it scrolls into view. Non-numeric strings ("—",
 * "09:00–17:00") render as-is. Writes go straight to the DOM through a motion
 * value, so the count never re-renders React.
 */
export function CountUp({ value, className, duration = 1.1 }: { value: string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();

  const numeric = NUMERIC.test(value);
  const target = numeric ? Number(value) : 0;
  const decimals = numeric ? (value.split(".")[1]?.length ?? 0) : 0;

  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => v.toFixed(decimals));

  useEffect(() => {
    if (!numeric) return;
    if (!inView || reduced) {
      mv.set(target);
      return;
    }
    const controls = animate(mv, target, { duration, ease: EASE });
    return () => controls.stop();
  }, [numeric, target, inView, reduced, duration, mv]);

  return (
    <motion.span ref={ref} className={className}>
      {numeric ? display : value}
    </motion.span>
  );
}
