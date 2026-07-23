import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";


const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [buyRequests, setBuyRequests] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [anonymousVisitors, setAnonymousVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'users', 'buy_requests', 'leads', 'anonymous'
  const [cityFilter, setCityFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, usersRes, buyRes, leadsRes, feedbackRes, anonRes] = await Promise.all([
          axios.get(`${API_URL}/api/admin/dashboard`),
          axios.get(`${API_URL}/api/admin/users${cityFilter ? `?city=${encodeURIComponent(cityFilter)}` : ''}`),
          axios.get(`${API_URL}/api/buy`),
          axios.get(`${API_URL}/api/admin/leads`),
          axios.get(`${API_URL}/api/feedback`),
          axios.get(`${API_URL}/api/admin/anonymous-visitors`)
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data);
        setBuyRequests(buyRes.data);
        setLeads(leadsRes.data);
        setFeedbacks(feedbackRes.data);
        setAnonymousVisitors(anonRes.data);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [cityFilter]);

  const data = [
    { name: 'Users', count: stats?.users || 0 },
    { name: 'Quizzes', count: stats?.quiz_completions || 0 },
    { name: 'Feedback', count: stats?.feedback || 0 },
    { name: 'Buy Requests', count: stats?.buy_requests || 0 },
    { name: 'Anon Visitors', count: stats?.anonymous_visitors || 0 },
  ];

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: "'Fredoka', sans-serif" }}>Loading Dashboard...</div>;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100dvh', padding: '20px', position: 'relative' }}>
      
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <img src="/logo.png" alt="Paw Buddy" style={{ width: '140px', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => navigate('/')} />

        <button 
          onClick={() => navigate('/')}
          style={{
            background: 'var(--orange)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '50px', cursor: 'pointer',
            fontFamily: "'Fredoka', sans-serif", fontWeight: 600,
            transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(255,107,43,0.3)'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateX(-2px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          ← Home
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: "'Fredoka', sans-serif" }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 className="text-h2" style={{ color: 'var(--brown)', fontWeight: 800, margin: 0 }}>Dashboard</h2>
            <p style={{ color: 'var(--text-soft)', margin: '5px 0 0 0' }}>Monitor Paw Buddy platform activity in real-time.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('overview')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'overview' ? 'var(--orange)' : 'white', color: activeTab === 'overview' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Overview</button>
            <button onClick={() => setActiveTab('users')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'users' ? 'var(--orange)' : 'white', color: activeTab === 'users' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Users</button>
            <button onClick={() => setActiveTab('buy_requests')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'buy_requests' ? 'var(--orange)' : 'white', color: activeTab === 'buy_requests' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Buy Requests</button>
            <button onClick={() => setActiveTab('leads')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'leads' ? 'var(--orange)' : 'white', color: activeTab === 'leads' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Leads</button>
            <button onClick={() => setActiveTab('feedback')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'feedback' ? 'var(--orange)' : 'white', color: activeTab === 'feedback' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Feedback</button>
            <button onClick={() => setActiveTab('anonymous')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'anonymous' ? 'var(--orange)' : 'white', color: activeTab === 'anonymous' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Visitors (Anon)</button>
          </div>
        </div>
        
        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              {[
                { label: 'Total Users', val: stats?.users || 0 },
                { label: 'Quizzes Taken', val: stats?.quiz_completions || 0 },
                { label: 'Anon Visitors', val: stats?.anonymous_visitors || 0 },
                { label: 'Buy Requests', val: stats?.buy_requests || 0 },
                { label: 'Feedback Items', val: stats?.feedback || 0 }
              ].map((item, i) => (
                <div key={i} style={{ 
                  background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid white',
                  padding: '25px', borderRadius: '20px', boxShadow: 'var(--shadow)', textAlign: 'center',
                  transition: 'transform 0.3s ease'
                }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <h4 style={{ color: 'var(--text-soft)', marginBottom: '10px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.label}</h4>
                  <p style={{ fontSize: '42px', fontWeight: '800', color: 'var(--orange)', margin: 0 }}>{item.val}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', height: '400px' }}>
                <h3 style={{ marginBottom: '20px', color: 'var(--brown)' }}>Platform Analytics</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--orange-pale)' }} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" fill="var(--orange)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          </>
        )}

        {activeTab === 'users' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--brown)', margin: 0 }}>All Users</h3>
              <input 
                type="text" 
                placeholder="Filter by city..." 
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                style={{ padding: '10px 15px', borderRadius: '10px', border: '1px solid #ddd', fontFamily: "'Fredoka', sans-serif", width: '250px' }}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '10px 0', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '10px 0', fontWeight: 600 }}>Mobile</th>
                    <th style={{ padding: '10px 0', fontWeight: 600 }}>City</th>
                    <th style={{ padding: '10px 0', fontWeight: 600 }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length > 0 ? users.map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 500 }}>{u.name}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{u.mobile}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{u.city}</td>
                      <td style={{ padding: '15px 0' }}>
                        <span style={{ 
                          background: u.role === 'ADMIN' ? 'var(--orange-pale)' : '#e8f5e9', 
                          color: u.role === 'ADMIN' ? 'var(--orange)' : '#2e7d32', 
                          padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 
                        }}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'buy_requests' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--brown)' }}>Buy / Adoption Requests</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Mobile</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>City</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Breed</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Intent</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {buyRequests.length > 0 ? buyRequests.map((req, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 500 }}>{req.user_name}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{req.mobile}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{req.city}</td>
                      <td style={{ padding: '15px 0', fontWeight: 600, color: 'var(--orange)' }}>{req.breed_name}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{req.intent}</td>
                      <td style={{ padding: '15px 0' }}>
                        <span style={{ background: req.status === 'NEW' ? '#fff3e0' : '#e8f5e9', color: req.status === 'NEW' ? '#ef6c00' : '#2e7d32', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No buy requests yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <h3 style={{ marginBottom: '5px', color: 'var(--brown)' }}>Inactive Leads</h3>
            <p style={{ color: 'var(--text-soft)', marginBottom: '20px' }}>Users who registered but have not completed the quiz.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Mobile</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>City</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Quiz Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length > 0 ? leads.map((lead, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 500 }}>{lead.name}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{lead.mobile}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{lead.city}</td>
                      <td style={{ padding: '15px 0' }}>
                        <span style={{ background: '#ffebee', color: '#c62828', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
                          {lead.quiz_status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No inactive leads found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--brown)' }}>User Feedback</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '15px 0', fontWeight: 600, width: '20%' }}>User</th>
                    <th style={{ padding: '15px 0', fontWeight: 600, width: '20%' }}>Rating</th>
                    <th style={{ padding: '15px 0', fontWeight: 600, width: '40%' }}>Comment</th>
                    <th style={{ padding: '15px 0', fontWeight: 600, width: '20%' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.length > 0 ? feedbacks.map((fb, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 500 }}>{fb.user_name || 'Anonymous'}</td>
                      <td style={{ padding: '15px 0', color: '#FFD700', fontSize: '18px', minWidth: '100px' }}>{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)', whiteSpace: 'pre-wrap' }}>{fb.comment || '-'}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)', fontSize: '13px' }}>{new Date(fb.created_at).toLocaleDateString()}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No feedback received yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'anonymous' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <h3 style={{ marginBottom: '5px', color: 'var(--brown)' }}>Anonymous Visitors</h3>
            <p style={{ color: 'var(--text-soft)', marginBottom: '20px' }}>Users who explored the site without logging in.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Visitor ID</th>
                    <th style={{ padding: '15px 0', fontWeight: 600 }}>Time of Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {anonymousVisitors.length > 0 ? anonymousVisitors.map((anon, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 500, fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-soft)' }}>{anon.visitor_id}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-color)' }}>
                        {anon.visited_at ? new Date(anon.visited_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="2" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No anonymous visitors tracked yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
