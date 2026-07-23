import React, { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

const PremiumDogMascot = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWagging, setIsWagging] = useState(false);
  const [isTwitching, setIsTwitching] = useState(false);

  // Smooth mouse tracking
  const springConfig = { damping: 20, stiffness: 100 };
  const mouseX = useSpring(0, springConfig);
  const mouseY = useSpring(0, springConfig);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      // Normalize between -1 and 1
      const x = (clientX / window.innerWidth) * 2 - 1;
      const y = (clientY / window.innerHeight) * 2 - 1;
      setMousePosition({ x, y });
      mouseX.set(x);
      mouseY.set(y);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // Map mouse position to subtle head movements
  const headRotateX = useTransform(mouseY, [-1, 1], [-5, 5]);
  const headRotateY = useTransform(mouseX, [-1, 1], [-10, 10]);
  const eyeMoveX = useTransform(mouseX, [-1, 1], [-2, 2]);
  const eyeMoveY = useTransform(mouseY, [-1, 1], [-2, 2]);

  // Random animations
  useEffect(() => {
    // Blink
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 4000);

    // Ear Twitch
    const twitchInterval = setInterval(() => {
      if (Math.random() > 0.6) {
        setIsTwitching(true);
        setTimeout(() => setIsTwitching(false), 300);
      }
    }, 5000);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(twitchInterval);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '250px', height: '250px' }}>
      <motion.div
        animate={{ y: [0, -4, 0] }} // Breathing effect
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onHoverStart={() => setIsWagging(true)}
        onHoverEnd={() => setIsWagging(false)}
      >
        <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Tail */}
          <motion.path
            d="M 140 120 Q 180 80 160 50"
            fill="none"
            stroke="var(--orange)"
            strokeWidth="12"
            strokeLinecap="round"
            animate={isWagging ? { rotate: [0, 25, -15, 25, 0], transformOrigin: "140px 120px" } : { rotate: [0, 5, -2, 5, 0], transformOrigin: "140px 120px" }}
            transition={isWagging ? { duration: 0.3, repeat: Infinity } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Body */}
          <path d="M 60 160 C 60 100, 150 100, 150 160 Z" fill="var(--orange)" />
          
          {/* Head Container (Rotates with mouse) */}
          <motion.g
            style={{ 
              transformOrigin: "90px 110px",
              rotateX: headRotateX,
              rotateY: headRotateY
            }}
          >
            {/* Head Base */}
            <circle cx="90" cy="100" r="45" fill="var(--orange)" />
            
            {/* Left Ear (Twitches) */}
            <motion.path 
              d="M 55 75 Q 30 40 60 40 Q 75 40 75 65 Z" 
              fill="var(--brown)"
              animate={isTwitching ? { rotate: [0, -15, 0, -10, 0], transformOrigin: "65px 65px" } : { rotate: 0 }}
              transition={{ duration: 0.3 }}
            />
            
            {/* Right Ear */}
            <path d="M 125 75 Q 150 40 120 40 Q 105 40 105 65 Z" fill="var(--brown)" />

            {/* Snout Area */}
            <ellipse cx="90" cy="120" rx="25" ry="18" fill="var(--cream)" />
            <circle cx="90" cy="112" r="6" fill="var(--brown)" />

            {/* Eyes */}
            <motion.g style={{ x: eyeMoveX, y: eyeMoveY }}>
              <motion.ellipse 
                cx="75" cy="90" rx="5" ry={isBlinking ? 0.5 : 5} 
                fill="#fff" 
              />
              <circle cx="76" cy="90" r="2.5" fill="#000" />
              
              <motion.ellipse 
                cx="105" cy="90" rx="5" ry={isBlinking ? 0.5 : 5} 
                fill="#fff" 
              />
              <circle cx="104" cy="90" r="2.5" fill="#000" />
            </motion.g>
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
};

export default PremiumDogMascot;
