"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  return <AnimatePresence mode="wait" initial={false}>
    <motion.div key={pathname} initial={reducedMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -4 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  </AnimatePresence>;
}
