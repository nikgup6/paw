import React, { useState, useEffect } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

// Helper for randomness
const randomRange = (min, max) => Math.random() * (max - min) + min;

const AnimatedPaw = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredFinger, setHoveredFinger] = useState(null);
  const shouldReduceMotion = useReducedMotion();
  
  const fingerControls = [useAnimation(), useAnimation(), useAnimation(), useAnimation()];

  // Entrance variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20, scale: shouldReduceMotion ? 1 : 0.95 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { duration: 0.5, ease: "easeOut" } 
    }
  };

  // Idle Animation Loop
  useEffect(() => {
    if (shouldReduceMotion) return;

    let isMounted = true;
    const animateFingers = async () => {
      // Wait for entrance animation to finish (approx 1.2s)
      await new Promise(r => setTimeout(r, 1200));

      while (isMounted) {
        if (!isHovered && hoveredFinger === null) {
          // Animate fingers sequentially
          for (let i = 0; i < 4; i++) {
            if (isHovered || hoveredFinger !== null || !isMounted) break;
            
            const lift = randomRange(-10, -14); 
            const rotation = (i < 2 ? -1 : 1) * randomRange(3, 5);
            const scale = randomRange(1.03, 1.05);
            const duration = randomRange(0.45, 0.65);

            // Start finger animation without awaiting to allow natural overlap if desired, 
            // but requirements say "pause then next", so we await.
            await fingerControls[i].start({
              y: [0, lift, 0],
              rotate: [0, rotation, 0],
              scale: [1, scale, 1],
              transition: { duration, ease: "easeInOut" }
            });

            if (isHovered || hoveredFinger !== null || !isMounted) break;
            
            // Delay before next finger
            const delay = randomRange(0.7, 1.0);
            await new Promise(r => setTimeout(r, delay * 1000));
          }

          // Pause after all 4 fingers
          if (!isHovered && hoveredFinger === null && isMounted) {
             await new Promise(r => setTimeout(r, randomRange(2000, 3000)));
          }
        } else {
           // Wait while hovered
           await new Promise(r => setTimeout(r, 500));
        }
      }
    };
    
    animateFingers();
    return () => { isMounted = false; };
  }, [isHovered, hoveredFinger, shouldReduceMotion, fingerControls]);

  // Container Hover: Sync Bounce
  const handleContainerHoverStart = () => {
    if (shouldReduceMotion) return;
    setIsHovered(true);
    
    // Interrupt idle and perform a subtle sync lift
    fingerControls.forEach((ctrl, i) => {
      ctrl.start({
        y: [0, -4, 0],
        rotate: [0, (i < 2 ? -2 : 2), 0],
        scale: [1, 1.02, 1],
        transition: { duration: 0.3, ease: "easeOut" }
      });
    });
  };

  const handleContainerHoverEnd = () => {
    setIsHovered(false);
  };

  // Individual Finger Hover
  const getFingerProps = (index) => ({
    onHoverStart: () => {
      if (shouldReduceMotion) return;
      setHoveredFinger(index);
      fingerControls[index].start({
        y: -8,
        rotate: index < 2 ? -4 : 4,
        scale: 1.05,
        filter: "drop-shadow(0px 10px 15px rgba(208, 92, 25, 0.2))",
        transition: { duration: 0.2, ease: "easeOut" }
      });
    },
    onHoverEnd: () => {
      if (shouldReduceMotion) return;
      setHoveredFinger(null);
      fingerControls[index].start({
        y: 0,
        rotate: 0,
        scale: 1,
        filter: "drop-shadow(0px 0px 0px rgba(208, 92, 25, 0))",
        transition: { duration: 0.2, ease: "easeIn" }
      });
    }
  });

  const floatTransition = (duration, delay) => ({
    y: {
      duration,
      delay,
      repeat: Infinity,
      repeatType: 'reverse',
      ease: 'easeInOut'
    }
  });

  return (
    <div 
      className="animated-paw-wrapper"
      onMouseEnter={handleContainerHoverStart}
      onMouseLeave={handleContainerHoverEnd}
    >
      <motion.div 
        className="paw-floating-container"
        animate={shouldReduceMotion ? {} : { y: [0, -3, 0] }} 
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div 
          className="paw-relative-box"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Paw Base */}
          <motion.img 
            src="/paw_base.png" 
            alt="Paw Base" 
            className="paw-part paw-base"
            variants={itemVariants}
          />

          {/* Fingers */}
          <motion.img 
            src="/finger_1.png" 
            alt="Finger 1" 
            className="paw-part finger-1"
            variants={itemVariants}
            animate={fingerControls[0]}
            {...getFingerProps(0)}
          />
          <motion.img 
            src="/finger_2.png" 
            alt="Finger 2" 
            className="paw-part finger-2"
            variants={itemVariants}
            animate={fingerControls[1]}
            {...getFingerProps(1)}
          />
          <motion.img 
            src="/finger_3.png" 
            alt="Finger 3" 
            className="paw-part finger-3"
            variants={itemVariants}
            animate={fingerControls[2]}
            {...getFingerProps(2)}
          />
          <motion.img 
            src="/finger_4.png" 
            alt="Finger 4" 
            className="paw-part finger-4"
            variants={itemVariants}
            animate={fingerControls[3]}
            {...getFingerProps(3)}
          />

        </motion.div>
      </motion.div>

      <style>{`
        .animated-paw-wrapper {
          width: 100%;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }
        
        .paw-floating-container {
          width: 100%;
          position: relative;
        }

        /* Reduced aspect ratio to be wider, preventing vertical stretching */
        .paw-relative-box {
          position: relative;
          width: 100%;
          padding-bottom: 70%; 
        }

        .paw-part {
          position: absolute;
          object-fit: contain;
          will-change: transform, opacity, filter;
          cursor: pointer;
        }

        /* Scaled up the paw base to 85% so text fits easily */
        .paw-base {
          width: 85%;
          bottom: 0%;
          left: 9%;
          pointer-events: none;
        }

        .finger-1 {
          width: 22%;
          bottom: 48%;
          left: 0%;
          transform-origin: center bottom;
        }

        .finger-2 {
          width: 23%;
          bottom: 75%;
          left: 20%;
          transform-origin: center bottom;
        }

        .finger-3 {
          width: 23%;
          bottom: 75%;
          right: 20%;
          transform-origin: center bottom;
        }

        .finger-4 {
          width: 22%;
          bottom: 48%;
          right: 0%;
          transform-origin: center bottom;
        }

        /* Dogs positioned above fingers */
        .dog-part {
          position: absolute;
          width: 17%;
          pointer-events: none;
          z-index: 0;
        }

        .dog-part img {
          width: 100%;
          height: auto;
          border-radius: 50%;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .dog-1 {
          bottom: 72%;
          left: 2.5%;
        }

        .dog-2 {
          bottom: 95%;
          left: 23%;
        }

        .dog-3 {
          bottom: 95%;
          right: 23%;
        }

        .dog-4 {
          bottom: 72%;
          right: 2.5%;
        }
      `}</style>
    </div>
  );
};

export default AnimatedPaw;
