import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const Profile = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [buyRequests, setBuyRequests] = useState([]);
  const [petProfile, setPetProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchProfileData = async () => {
      try {
        // /api/buy/user/:id now requires the caller to BE that user (or an
        // admin) — it used to be openly readable by anyone who knew a user
        // id. Without this header every Profile page would 401 on its own
        // buy history.
        const authHeaders = { headers: { Authorization: `Bearer ${localStorage.getItem('pb_token') || ''}` } };
        const [quizRes, buyRes] = await Promise.all([
          axios.get(`${API_URL}/api/quiz/user/${user.id}`),
          axios.get(`${API_URL}/api/buy/user/${user.id}`, authHeaders)
        ]);
        setQuizzes(quizRes.data);
        setBuyRequests(buyRes.data);
        
        // Fetch pet profile if exists
        try {
          const petRes = await axios.get(`${API_URL}/api/pets/user/${user.id}`);
          if (petRes.data) {
            setPetProfile(petRes.data);
          }
        } catch (petErr) {
          // Pet profile might not exist yet, that's fine
          console.log("No pet profile registered yet.");
        }

      } catch (err) {
        console.error("Error fetching profile data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfileData();
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'var(--font-body-family)' }}>Loading Profile...</div>;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100dvh', padding: '20px', position: 'relative' }}>
      
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <img src="/logo.png" alt="Paw Buddy" style={{ width: '140px', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => navigate('/')} />

        <button 
          onClick={() => navigate('/')}
          style={{
            background: 'var(--orange)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '50px', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)',
            transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(255,107,43,0.3)'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateX(-2px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          ← Home
        </button>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'var(--font-body-family)' }}>
        
        {/* User Card */}
        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: 'var(--shadow)', marginBottom: '30px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '30px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--orange), var(--orange-light))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 'var(--weight-bold)' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)', color: 'var(--brown)', fontSize: '32px', margin: '0 0 10px 0' }}>{user.name}</h2>
            <p style={{ color: 'var(--text-soft)', margin: '5px 0' }}><strong>Mobile:</strong> {user.mobile}</p>
            <p style={{ color: 'var(--text-soft)', margin: '5px 0' }}><strong>City:</strong> {user.city}</p>
          </div>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '50px', fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', cursor: 'pointer', width: 'max-content' }}>Logout</button>
        </div>

        {/* Pet Profile Card Section */}
        {petProfile ? (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '15px', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', margin: 0, fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🐾 {petProfile.name}'s Profile
              </h3>
              <span style={{ background: 'var(--orange-pale)', color: 'var(--orange)', padding: '5px 15px', borderRadius: '50px', fontSize: '13px', fontWeight: 'var(--weight-bold)' }}>
                {petProfile.gender}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div>
                <span style={{ color: 'var(--text-soft)', fontSize: '13px', display: 'block' }}>Breed</span>
                <strong style={{ color: 'var(--brown)', fontSize: '16px' }}>{petProfile.breed}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-soft)', fontSize: '13px', display: 'block' }}>Date of Birth</span>
                <strong style={{ color: 'var(--brown)', fontSize: '16px' }}>{petProfile.dob}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-soft)', fontSize: '13px', display: 'block' }}>Age</span>
                <strong style={{ color: 'var(--brown)', fontSize: '16px' }}>{petProfile.age_display}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-soft)', fontSize: '13px', display: 'block' }}>Health Complications</span>
                <strong style={{ color: 'var(--brown)', fontSize: '16px' }}>{petProfile.health_complications}</strong>
              </div>
            </div>

            {/* Scanned Vaccines */}
            {petProfile.vaccines && petProfile.vaccines.length > 0 && (
              <div style={{ marginTop: '25px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', fontSize: '16px', marginBottom: '15px', borderBottom: '1px solid #EAE4DE', paddingBottom: '5px' }}>
                    💉 Vaccination History
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #EAE4DE' }}>
                        <th style={{ padding: '8px 5px', color: 'var(--brown)' }}>Vaccine</th>
                        <th style={{ padding: '8px 5px', color: 'var(--brown)' }}>Administered Date</th>
                        <th style={{ padding: '8px 5px', color: 'var(--brown)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {petProfile.vaccines.map((v, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F5F0EB' }}>
                          <td style={{ padding: '8px 5px', fontWeight: 'var(--weight-semibold)' }}>{v.name}</td>
                          <td style={{ padding: '8px 5px' }}>{v.date}</td>
                          <td style={{ padding: '8px 5px', color: '#27AE60', fontWeight: 'var(--weight-bold)' }}>{v.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', fontSize: '16px', marginBottom: '15px', borderBottom: '1px solid #EAE4DE', paddingBottom: '5px' }}>
                    📅 Upcoming Reminders
                  </h4>
                  <div>
                    {petProfile.reminders && petProfile.reminders.map((rem, idx) => (
                      <div 
                        key={idx} 
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px', background: rem.priority === 'High' ? '#FFF5F5' : rem.priority === 'Medium' ? '#FFFBEA' : '#F5FBFF',
                          borderLeft: `4px solid ${rem.priority === 'High' ? '#EB5757' : rem.priority === 'Medium' ? '#F2C94C' : '#2F80ED'}`,
                          borderRadius: '8px', marginBottom: '8px', fontSize: '13px'
                        }}
                      >
                        <div>
                          <strong style={{ color: 'var(--brown)' }}>{rem.vaccine}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-soft)' }}>Booster due</div>
                        </div>
                        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--brown)' }}>📅 {rem.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', marginBottom: '30px', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', marginBottom: '10px', fontSize: '20px' }}>🐾 Already a dog owner?</h3>
            <p style={{ color: 'var(--text-soft)', fontSize: '14px', maxWidth: '500px', margin: '0 auto 20px', lineHeight: 1.5 }}>
              Register your dog profile and upload vaccine certificates. Paw Buddy will automatically track vaccine schedules and send upcoming calendar reminders!
            </p>
            <button 
              onClick={() => navigate('/')} 
              style={{
                background: 'var(--orange)', color: 'white', border: 'none',
                padding: '10px 30px', borderRadius: '50px', fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '14px',
                boxShadow: 'var(--shadow)'
              }}
            >
              Get Started Now
            </button>
          </div>
        )}

        <div style={{ background: 'white', padding: '20px', borderRadius: '20px', boxShadow: 'var(--shadow)', marginBottom: '30px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
          <img src="/verified.png" alt="Verified" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
          <div style={{ color: 'var(--text-soft)', fontSize: '14px', lineHeight: 1.6, fontFamily: 'var(--font-body-family)', flex: '1 1 250px' }}>
            This recommendation is reviewed and validated using veterinary expertise, breed-specific data, and lifestyle compatibility factors.
            Paw Buddy's recommendations are designed to help you find pets that fit your living space, activity level, budget, climate, and family needs.
            While every pet is unique, these results are based on expert-reviewed criteria to provide reliable guidance.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
          
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', marginBottom: '20px', borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '10px' }}>Past Quizzes</h3>
            {quizzes.length > 0 ? quizzes.map((q, i) => (
              <div 
                key={i} 
                onClick={() => {
                  localStorage.setItem('pb_quiz_state', JSON.stringify({ answers: q.answers || {}, currentQ: 9 }));
                  navigate('/results');
                }}
                style={{ marginBottom: '15px', padding: '15px', background: 'var(--cream)', borderRadius: '15px', cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-soft)', marginBottom: '5px' }}>{new Date(q.created_at).toLocaleDateString()}</div>
                <div><strong>Top Matches:</strong> {'Matches saved, click here to view them'}</div>
              </div>
            )) : <p style={{ color: 'var(--text-soft)' }}>You haven't taken any quizzes yet.</p>}
          </div>

          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', marginBottom: '20px', borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '10px' }}>Buy Interests</h3>
            {buyRequests.length > 0 ? buyRequests.map((req, i) => (
              <div key={i} style={{ marginBottom: '15px', padding: '15px', background: 'var(--cream)', borderRadius: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <strong style={{ color: 'var(--orange)' }}>{req.breed_name}</strong>
                  <span style={{ background: req.status === 'NEW' ? '#fff3e0' : '#e8f5e9', color: req.status === 'NEW' ? '#ef6c00' : '#2e7d32', padding: '2px 8px', borderRadius: '50px', fontSize: '11px', fontWeight: 'var(--weight-bold)' }}>{req.status}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-soft)' }}><strong>Intent:</strong> {req.intent}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-soft)', marginTop: '5px' }}>{new Date(req.created_at).toLocaleDateString()}</div>
              </div>
            )) : <p style={{ color: 'var(--text-soft)' }}>You haven't submitted any buy requests.</p>}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
