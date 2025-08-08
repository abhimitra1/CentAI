
  import React, { useState, useEffect } from 'react';
  import logo from './images/CentAI_logo_light.png';
  import axios from 'axios';
  import 'bootstrap/dist/css/bootstrap.min.css';
  import 'bootstrap-icons/font/bootstrap-icons.css';

const sidebarLinks = [
  { name: 'Departments', info: 'Explore all academic departments.' },
  { name: 'Teachers', info: 'Meet your faculty and staff.' },
  { name: 'Buildings', info: 'Find your way around campus.' },
  { name: 'Hostels', info: 'Accommodation info for students.' },
  { name: 'Clubs & Activities', info: 'Join student clubs and events.' },
];

function App() {
  const handleLogout = () => {
    localStorage.removeItem('centai_token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };
  const [user, setUser] = useState(null);
  const SYSTEM_PROMPT = `You are CentAI, the official Centurion University onboarding assistant. Only answer questions in the context of Centurion University of Technology and Management (CUTM), its departments, teachers, buildings, hostels, clubs, and student life. Do not provide information about other universities or general topics unless they relate to Centurion University.`;

  const [messages, setMessages] = useState([
    {
      role: 'system',
      content:
        '\n\n🎓 Welcome to CentAI — your Centurion University onboarding assistant! I answer only about Centurion University: departments, teachers, hostels, clubs, and student life. For anything else, I’ll politely redirect you. Ask me anything about Centurion University!'
    }
  ]);
  // Removed duplicate input and loading state declarations
  const [writing, setWriting] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    window.location.href = 'http://localhost:5001/auth/google';
  };

  // Helper to set axios auth header from stored token
  const setAxiosAuth = () => {
    const token = localStorage.getItem('centai_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const fetchUser = async () => {
    try {
  setAxiosAuth();
  const res = await axios.get('http://localhost:5001/api/user');
      setUser(res.data);
    } catch {
      setUser(null);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    try {
      // Always send system prompt + chat history
      const history = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.filter(m => m.role !== 'system'),
        { role: 'user', content: input }
      ];
  setAxiosAuth();
  const res = await axios.post('http://localhost:5001/api/chat', { message: input, history });
      // Writing effect
      setWriting(true);
      let reply = res.data.reply || '';
      let i = 0;
      setWritingText('');
      const typeWriter = () => {
        if (i === 0 && reply.length > 0) {
          setWritingText(reply[0]);
          i = 1;
          setTimeout(typeWriter, 12);
          return;
        }
        if (i < reply.length) {
          setWritingText(prev => prev + reply[i]);
          i++;
          setTimeout(typeWriter, 12);
        } else {
          setWriting(false);
          setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        }
      };
      typeWriter();
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
      setWriting(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Capture token from hash on first load
    const hash = window.location.hash;
    const m = hash.match(/#token=([^&]+)/);
    if (m && m[1]) {
      localStorage.setItem('centai_token', m[1]);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setAxiosAuth();
    fetchUser();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#181a20', display: 'flex', flexDirection: 'column' }}>
  <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', background: '#222', boxShadow: '0 2px 8px #111', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={logo} alt="CentAI Logo" style={{ height: 40, marginRight: 12 }} />
          <span style={{ fontWeight: 700, fontSize: 22, color: '#fff' }}></span>
        </div>
        {user ? (
          <button onClick={handleLogout} className="btn btn-outline-light" style={{ fontSize: 16 }}>
            <i className="bi bi-box-arrow-right me-2"></i>Logout
          </button>
        ) : (
          <button onClick={handleLogin} className="btn btn-light" style={{ fontSize: 16, color: '#222' }}>
            <i className="bi bi-google me-2"></i>Login with Google
          </button>
        )}
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: '100%', position: 'relative' }}>
        <div className="w-100" style={{ maxWidth: 700, margin: '32px auto 0', background: '#23272f', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', padding: 32, minHeight: 500, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
          <h3 className="mb-4 fw-bold text-white" style={{ fontSize: 22 }}>
            {user?.name ? `Hi ${user.name}, Welcome to Centurion!` : 'Welcome to Centurion!'}
          </h3>
          <div className="flex-grow-1 d-flex flex-column" style={{ gap: 24 }}>
            {(writing ? [...messages, { role: 'assistant', content: writingText }] : messages).map((msg, idx) => (
              <div key={idx} className={msg.role === 'user' ? 'd-flex justify-content-end' : 'd-flex justify-content-start'} style={{ marginBottom: 12 }}>
                <div className={msg.role === 'user' ? 'bg-secondary text-white' : 'bg-dark text-white'}
                  style={{ borderRadius: 12, padding: '16px 22px', maxWidth: '80%', fontSize: 16, boxShadow: msg.role === 'user' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>
        {user && (
          <div style={{ position: 'sticky', bottom: 0, width: '100%', background: 'rgba(24,26,32,0.95)', zIndex: 10, boxShadow: '0 -2px 8px #111' }}>
            <div className="w-100 d-flex align-items-center" style={{ maxWidth: 700, margin: '0 auto', gap: 12, padding: '12px 0' }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask me anything about Centurion University..."
                className="form-control form-control-lg bg-dark text-white border-secondary"
                style={{ flex: 1, borderRadius: 12 }}
                disabled={loading || writing}
              />
              <button
                onClick={sendMessage}
                className="btn btn-success btn-lg"
                style={{ borderRadius: 12 }}
                disabled={loading || writing || !input.trim()}
              >{(loading || writing) ? <i className="bi bi-arrow-repeat"></i> : <i className="bi bi-send"></i>}</button>
            </div>
          </div>
        )}
      </main>
      <footer style={{ width: '100%', textAlign: 'center', padding: '1rem 0', color: '#aaa', fontSize: 16, background: 'transparent', position: 'sticky', bottom: 0, zIndex: 9 }}>
        Powered by CentAI
      </footer>
    </div>
  );
}

export default App;
