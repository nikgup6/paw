import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const VerifiedBadge = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const badgeRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (badgeRef.current && !badgeRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Hide on profile page or quiz page
  if (location.pathname === '/profile' || location.pathname === '/quiz') {
    return null;
  }

  return (
    <div
      ref={badgeRef}
      className="verified-badge-container"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start'
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '15px',
              marginBottom: '15px',
              width: '320px',
              boxShadow: 'var(--shadow)',
              fontSize: '13px',
              lineHeight: 1.6,
              color: 'var(--text-soft)',
              fontFamily: "'Fredoka', sans-serif"
            }}
          >
            This recommendation is reviewed and validated using veterinary expertise, breed-specific data, and lifestyle compatibility factors.
            <br/><br/>
            Paw Buddy's recommendations are designed to help you find pets that fit your living space, activity level, budget, climate, and family needs.
            <br/><br/>
            While every pet is unique, these results are based on expert-reviewed criteria to provide reliable guidance.
          </motion.div>
        )}
      </AnimatePresence>

      <img 
        src="/verified.png" 
        alt="Verified" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '80px',
          height: '80px',
          cursor: 'pointer',
          objectFit: 'contain'
        }}
      />
    </div>
  );
};

export default VerifiedBadge;
