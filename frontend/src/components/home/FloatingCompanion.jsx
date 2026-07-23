import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const FloatingCompanion = () => {
  const [isWagging, setIsWagging] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  // Random blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 4000);
    return () => clearInterval(blinkInterval);
  }, []);

  // Listen for custom events to trigger excitement
  useEffect(() => {
    const handleExcitement = () => {
      setIsWagging(true);
      setTimeout(() => setIsWagging(false), 2000);
    };
    window.addEventListener('dog-excite', handleExcitement);
    return () => window.removeEventListener('dog-excite', handleExcitement);
  }, []);

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 100 }}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '30px',
        zIndex: 1000,
        pointerEvents: 'none',
        width: '100px',
        height: '100px'
      }}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        {/* Simple Cute Dog SVG */}
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          {/* Tail */}
          <motion.path
            d="M 80 50 Q 100 20 90 10"
            fill="none"
            stroke="var(--orange)"
            strokeWidth="8"
            strokeLinecap="round"
            animate={isWagging ? { rotate: [0, 20, -10, 20, 0], transformOrigin: "80px 50px" } : { rotate: [0, 5, 0], transformOrigin: "80px 50px" }}
            transition={isWagging ? { duration: 0.4, repeat: 5 } : { duration: 3, repeat: Infinity }}
          />
          {/* Body */}
          <ellipse cx="50" cy="65" rx="35" ry="25" fill="var(--orange)" />
          {/* Head */}
          <circle cx="35" cy="40" r="25" fill="var(--orange)" />
          {/* Ears */}
          <path d="M 20 25 Q 10 0 25 15" fill="var(--brown)" />
          <path d="M 50 25 Q 60 0 45 15" fill="var(--brown)" />
          {/* Eyes */}
          <motion.ellipse cx="28" cy="35" rx="3" ry={isBlinking ? 0.5 : 3} fill="#fff" />
          <motion.ellipse cx="42" cy="35" rx="3" ry={isBlinking ? 0.5 : 3} fill="#fff" />
          {/* Nose */}
          <circle cx="35" cy="45" r="4" fill="var(--brown)" />
        </svg>
      </motion.div>
    </motion.div>
  );
};

export default FloatingCompanion;
