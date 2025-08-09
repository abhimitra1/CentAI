import React, { useState, useEffect } from 'react';
import { Typewriter } from 'react-simple-typewriter';
import logo from './images/CentAI_logo_light.png';
import axios from 'axios';

const sidebarLinks = [
  { name: 'Departments', info: 'Explore all academic departments.' },
  { name: 'Teachers', info: 'Meet your faculty and staff.' },
  { name: 'Buildings', info: 'Find your way around campus.' },
  { name: 'Hostels', info: 'Accommodation info for students.' },
  { name: 'Clubs & Activities', info: 'Join student clubs and events.' },
];

function App() {
  const chatWindowRef = React.useRef(null);
  const handleLogout = () => {
    localStorage.removeItem('centai_token');
    localStorage.removeItem('centai_chat'); // Clear chat history on logout
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setMessages([
      {
        role: 'system',
        content: ''
      }
    ]);
  };
  const [user, setUser] = useState(null);
  const SYSTEM_PROMPT = `You are CentAI, the official Centurion University onboarding assistant. Only answer questions in the context of Centurion University, its departments, teachers, buildings, hostels, clubs, and student life. Do not provide information about other universities or general topics unless they relate to Centurion University. If the user asks for a summary, recap, or requests to complete the conversation, provide a full summary or completion of the entire chat so far.`;

  // Load chat from localStorage if available
  const getInitialMessages = () => {
    const saved = localStorage.getItem('centai_chat');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [
          {
            role: 'system',
            content: ''
          }
        ];
      }
    }
    return [
      {
        role: 'system',
        content: ''
      }
    ];
  };
  const [messages, setMessages] = useState(getInitialMessages());
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
      // Manual character-by-character writing effect
      setWriting(true);
      const reply = ' ' + (res.data.reply || '');
      setWritingText('');
      let i = 0;
      const typeWriter = () => {
        setWritingText(prev => prev + reply[i]);
        i++;
        if (i < reply.length) {
          setTimeout(typeWriter, 20);
        } else {
          setWriting(false);
          setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        }
      };
      if (reply.length > 0) typeWriter();
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

  // Scroll chat window to bottom when messages or writing change
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages, writingText, writing]);

  // Save chat to localStorage on every update
  useEffect(() => {
    localStorage.setItem('centai_chat', JSON.stringify(messages));
  }, [messages]);

  // Show greeting and welcome only if no user messages yet
  const showWelcome = messages.filter(m => m.role === 'user').length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#181a20] to-[#23272f] font-sfpro text-[17px]">
      <header className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 bg-gradient-to-r from-[#181a20] to-[#23272f] shadow-md rounded-b-2xl">
        <div className="flex items-center">
          <img src={logo} alt="CentAI Logo" className="h-10 mr-4 rounded-xl shadow-sm" />
        </div>
        {user ? (
          <button onClick={handleLogout} className="px-5 py-2 rounded-xl bg-[#23272f] text-white font-medium shadow hover:bg-[#2c2f36] transition border border-[#333] focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ fontSize: 16 }}>
            Logout
          </button>
        ) : (
          <button onClick={handleLogin} className="px-5 py-2 rounded-xl bg-white text-gray-900 font-medium shadow hover:bg-gray-200 transition border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ fontSize: 16 }}>
            Login with Google
          </button>
        )}
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: '100%', position: 'relative' }}>
        <div className="w-full h-full fixed inset-0 bg-gradient-to-br from-[#23272f] to-[#181a20] rounded-none shadow-none flex flex-col border-none z-10" style={{ minHeight: '100vh' }}>
          {/* Centered greeting and welcome message, hidden after first user message */}
          {showWelcome && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none pt-32 md:pt-40">
              <h3 className="font-semibold text-2xl text-white tracking-tight text-center mb-6 px-4">
                {user?.name ? `Hi ${user.name}, Welcome to Centurion!` : 'Welcome to Centurion!'}
              </h3>
              <div className="bg-[#181a20] rounded-2xl shadow-lg px-6 py-6 text-white text-lg font-normal text-center max-w-md mx-auto border border-[#23272f]">
                I am CentAI— your Centurion University onboarding assistant! I answer only about Centurion University: departments, teachers, hostels, clubs, and student life. For anything else, I’ll politely redirect you. Ask me anything about Centurion University!
              </div>
            </div>
          )}
          <div ref={chatWindowRef} className="flex flex-col justify-end gap-8 flex-grow overflow-y-auto px-4 md:px-10 pb-6" style={{ height: 'calc(100vh - 120px - 90px)' }}>
            {messages.filter(m => m.content && m.content.trim() !== '').map((msg, idx) => (
              <div key={idx} className={msg.role === 'user' ? 'flex justify-end mb-3' : 'flex justify-start mb-3'}>
                <div className={msg.role === 'user'
                  ? 'rounded-2xl px-6 py-4 max-w-[80%] text-lg font-medium shadow bg-gradient-to-r from-blue-500 to-blue-700 text-white border border-blue-700 break-words backdrop-blur-md'
                  : 'rounded-2xl px-6 py-4 max-w-[80%] text-lg font-normal shadow bg-gradient-to-r from-[#23272f] to-[#181a20] text-white border border-[#23272f] break-words backdrop-blur-md'}>
                  {msg.role === 'assistant' ? (
                    <span style={{ whiteSpace: 'pre-line' }}>{msg.content}</span>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {writing && (
              <div className={'flex justify-start mb-3'}>
                <div className='rounded-2xl px-6 py-4 max-w-[80%] text-lg font-normal shadow bg-gradient-to-r from-[#23272f] to-[#181a20] text-white border border-[#23272f] break-words backdrop-blur-md'>
                  <span style={{ whiteSpace: 'pre-line' }}>{writingText}<span className="animate-pulse">|</span></span>
                </div>
              </div>
            )}
          </div>
          {user && (
            <div className="w-full px-2 md:px-10 pb-4 md:pb-6" style={{ position: 'sticky', bottom: 0, zIndex: 20 }}>
              <div className="flex items-center gap-2 md:gap-4 bg-[#23272f] rounded-xl shadow-2xl px-3 md:px-6 py-3 md:py-4 border border-[#333]" style={{ boxShadow: '0 8px 32px 0 rgba(0,0,0,0.25)' }}>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask me anything about Centurion University..."
                  className="flex-1 rounded-xl bg-[#23272f] text-white border-none px-3 md:px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder-gray-400"
                  disabled={loading || writing}
                />
                <button
                  onClick={sendMessage}
                  className={`rounded-xl px-4 md:px-6 py-3 text-lg font-semibold transition shadow ${loading || writing || !input.trim() ? 'bg-[#23272f] text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  disabled={loading || writing || !input.trim()}
                  style={{ minWidth: '56px' }}
                >{(loading || writing) ? <span className="animate-spin inline-block mr-2">⏳</span> : <span className="inline-block mr-2">➤</span>} Send</button>
              </div>
            </div>
          )}
        </div>
      </main>
      <footer className="w-full text-center py-4 text-gray-400 text-lg bg-transparent relative font-sfpro">
        Powered by CentAI
      </footer>
    </div>
  );
}

export default App;
