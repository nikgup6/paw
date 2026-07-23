import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/* Lightweight scroll-reveal: children fade + slide up the first time they
   enter the viewport. Honours prefers-reduced-motion (renders instantly). */
const Reveal = ({ children, y = 44, delay = 0, amount = 0.15, className, style }) => {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default Reveal;
