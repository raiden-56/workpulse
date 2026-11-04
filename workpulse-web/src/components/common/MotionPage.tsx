import { motion, useReducedMotion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

/** Page transition: fade + 8px rise, disabled when the user prefers reduced motion. */
export function MotionPage({ children }: PropsWithChildren) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -4 }}
      transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.16, ease: 'easeOut' as const } },
};

export function StaggerGroup({ children }: PropsWithChildren) {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={reduce ? undefined : staggerContainer} initial={reduce ? false : 'hidden'} animate="show" style={{ display: 'contents' }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: PropsWithChildren) {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={reduce ? undefined : staggerItem} style={{ height: '100%' }}>
      {children}
    </motion.div>
  );
}
