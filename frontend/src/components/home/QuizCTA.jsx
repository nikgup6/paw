import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { clearQuizState } from '../../utils/quizState';

const QuizCTA = ({ user }) => {
  const navigate = useNavigate();

  return (
    <section className="quiz-section">
      {/* Background blobs */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="quiz-blob"
      />
      
      <div className="glass-panel quiz-panel">
        <motion.h2 
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="quiz-title"
        >
          Ready to meet your <span style={{ color: 'var(--orange)' }}>pawfect match?</span>
        </motion.h2>
        
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="quiz-desc"
        >
          Answer a few quick questions and we'll help you find the puppy meant for you.
        </motion.p>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            window.dispatchEvent(new Event('dog-excite'));
            // Login removed — always start the quiz, no account required.
            clearQuizState();
            navigate('/quiz?reset=1', { state: { reset: true } });
          }}
          className="quiz-btn"
        >
          Start the Journey
        </motion.button>
        
        <style>
          {`
            .quiz-section {
              position: relative;
              padding: 120px 20px;
              background: var(--cream);
              overflow: hidden;
              display: flex;
              justify-content: center;
            }
            .quiz-blob {
              position: absolute;
              top: -50%;
              left: -10%;
              width: 600px;
              height: 600px;
              background: radial-gradient(circle, rgba(255,107,43,0.15) 0%, transparent 70%);
              border-radius: 50%;
            }
            .quiz-panel {
              max-width: 800px;
              width: 100%;
              padding: 60px 40px;
              text-align: center;
              position: relative;
              z-index: 10;
              background: rgba(255,255,255,0.8);
            }
            .quiz-title {
              font-family: 'Fredoka', sans-serif;
              font-size: var(--font-hero);
              color: var(--brown);
              margin-bottom: 20px;
              letter-spacing: -1px;
            }
            .quiz-desc {
              font-family: var(--font-body-family);
              font-size: 20px;
              color: var(--text-soft);
              margin-bottom: 40px;
            }
            .quiz-btn {
              padding: 20px 50px;
              background: var(--orange);
              color: white;
              border: none;
              border-radius: 50px;
              font-family: var(--font-display);
              font-size: 22px;
              font-weight: 700;
              cursor: pointer;
              box-shadow: 0 0 0 0 rgba(245, 124, 0, 0.7);
              animation: pulse 2s infinite;
            }
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(255, 107, 43, 0.7); }
              70% { box-shadow: 0 0 0 20px rgba(255, 107, 43, 0); }
              100% { box-shadow: 0 0 0 0 rgba(255, 107, 43, 0); }
            }

            @media (max-width: 768px) {
              .quiz-section {
                padding: 60px 20px;
              }
              .quiz-panel {
                padding: 40px 20px;
              }
              .quiz-title {
                font-size: 32px;
              }
              .quiz-desc {
                font-size: 16px;
                margin-bottom: 30px;
              }
              .quiz-btn {
                padding: 16px 32px;
                font-size: 18px;
              }
              .quiz-blob {
                width: 400px;
                height: 400px;
              }
            }
          `}
        </style>
      </div>
    </section>
  );
};

export default QuizCTA;
