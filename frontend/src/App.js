import React, { useState, useEffect } from 'react';
import axios from 'axios';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';

const sidebarLinks = [
  { name: 'Departments', info: 'Explore all academic departments.' },
  { name: 'Teachers', info: 'Meet your faculty and staff.' },
  { name: 'Buildings', info: 'Find your way around campus.' },
  { name: 'Hostels', info: 'Accommodation info for students.' },
  { name: 'Clubs & Activities', info: 'Join student clubs and events.' },
];

function App() {
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
    <div className="d-flex" style={{ height: '100vh', background: '#181a20' }}>
      <Sidebar />
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-end" style={{ background: '#181a20' }}>
        <ChatWindow messages={writing ? [...messages, { role: 'assistant', content: writingText }] : messages} />
        {user && (
          <ChatInput input={input} setInput={setInput} sendMessage={sendMessage} loading={loading || writing} />
        )}
        {!user && (
          <button onClick={handleLogin} className="btn btn-primary mb-4" style={{ fontSize: 16, margin: '0 auto 32px' }}>
            <i className="bi bi-google me-2"></i>Login with Google
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
