"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";

/**
 * Client-side providers for the whole app.
 *
 * - `ThemeProvider` finally applies the `.dark` class. The dark palette existed
 *   in globals.css from the start but nothing ever switched it on.
 * - `MotionConfig reducedMotion="user"` makes every framer-motion animation in
 *   the app honour the OS "reduce motion" setting. CSS alone cannot do this,
 *   because framer-motion drives transforms from JavaScript.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
