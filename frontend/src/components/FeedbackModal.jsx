import React, { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const FeedbackModal = ({ isOpen, onClose, user }) => {
  const [ratings, setRatings] = useState({ q1: 0, q2: 0, q3: 0 });
  const [hoverRatings, setHoverRatings] = useState({ q1: 0, q2: 0, q3: 0 });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleRating = (q, val) => setRatings(prev => ({ ...prev, [q]: val }));
  const handleHover = (q, val) => setHoverRatings(prev => ({ ...prev, [q]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (ratings.q1 === 0 || ratings.q2 === 0 || ratings.q3 === 0) {
      alert('Please rate all questions first!');
      return;
    }
    setLoading(true);
    
    const avgRating = Math.round((ratings.q1 + ratings.q2 + ratings.q3) / 3);
    const detailedComment = `Accuracy: ${ratings.q1}/5 | UI: ${ratings.q2}/5 | Info: ${ratings.q3}/5\n\n${comment}`;

    try {
      await axios.post(`${API_URL}/api/feedback`, {
        user_id: user?.id || null,
        user_name: user?.name || 'Anonymous',
        rating: avgRating,
        comment: detailedComment
      });
      setSuccess(true);
    } catch (err) {
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const StarRow = ({ label, qKey }) => (
    <div style={{ marginBottom: '15px' }}>
      <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: 'var(--brown)', fontWeight: 600 }}>{label}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRating(qKey, star)}
            onMouseEnter={() => handleHover(qKey, star)}
            onMouseLeave={() => handleHover(qKey, 0)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: (hoverRatings[qKey] || ratings[qKey]) >= star ? '#FFD700' : '#EAE4DE',
              transition: 'color 0.2s, transform 0.2s',
              transform: (hoverRatings[qKey] || ratings[qKey]) >= star ? 'scale(1.1)' : 'scale(1)',
              padding: 0
            }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px', fontFamily: "'Fredoka', sans-serif" }}>
      <div className="glass-panel" style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '440px', maxHeight: '90dvh', overflowY: 'auto', position: 'relative', animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'var(--cream)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        
        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>🐾</div>
            <h3 style={{ color: 'var(--orange)', marginBottom: '10px' }}>Thank You!</h3>
            <p style={{ color: 'var(--text-soft)' }}>Your feedback helps us make Paw Buddy better for everyone.</p>
            <button onClick={onClose} style={{ marginTop: '20px', padding: '12px 30px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ color: 'var(--brown)', marginBottom: '10px', fontSize: '22px' }}>How was your experience?</h3>
            <p style={{ color: 'var(--text-soft)', fontSize: '14px', marginBottom: '20px' }}>Rate your experience to help us improve.</p>
            
            <StarRow label="How accurate were your breed recommendations?" qKey="q1" />
            <StarRow label="How easy was it to use the platform?" qKey="q2" />
            <StarRow label="How helpful was the breed information?" qKey="q3" />

            <p style={{ margin: '15px 0 5px 0', fontSize: '14px', color: 'var(--brown)', fontWeight: 600 }}>Any additional comments?</p>
            <textarea 
              placeholder="Tell us what you loved or what we can do better..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #EAE4DE', minHeight: '80px', resize: 'vertical', fontFamily: "'Fredoka', sans-serif", fontSize: '14px', outline: 'none', marginBottom: '15px' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--orange)'}
              onBlur={(e) => e.target.style.borderColor = '#EAE4DE'}
            />

            <button 
              onClick={handleSubmit} 
              disabled={loading}
              style={{ width: '100%', padding: '14px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.3s' }}
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
