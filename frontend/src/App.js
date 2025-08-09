import React, { useState, useEffect, useRef, useCallback } from 'react';
import logo from './images/CentAI_logo_light.png';
import axios from 'axios';
import './ChatWindow.css';

function App() {
  const messagesEndRef = useRef(null);
  const chatWindowRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem('centai_token');
    localStorage.removeItem('centai_chat');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setMessages([{ role: 'system', content: '' }]);
  };

  const [user, setUser] = useState(null);
  const SYSTEM_PROMPT = `You are CentAI, the official Centurion University onboarding assistant. Only answer questions in the context of Centurion University, its departments, teachers, buildings, hostels, clubs, and student life. Do not provide information about other universities or general topics unless they relate to Centurion University. If the user asks for a summary, recap, or requests to complete the conversation, provide a full summary or completion of the entire chat so far.`;

  const getInitialMessages = () => {
    const saved = localStorage.getItem('centai_chat');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [{ role: 'system', content: '' }];
      }
    }
    return [{ role: 'system', content: '' }];
  };

  const [messages, setMessages] = useState(getInitialMessages());
  const [writing, setWriting] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    // Use relative URL in production, fallback to localhost in development
    const authUrl = process.env.NODE_ENV === 'production'
      ? '/api/auth-google'
      : 'http://localhost:5001/auth/google';
    window.location.href = authUrl;
  };

  const setAxiosAuth = () => {
    const token = localStorage.getItem('centai_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const fetchUser = useCallback(async () => {
    try {
      setAxiosAuth();
      // Use relative URL in production, fallback to localhost in development
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/api/user'
        : 'http://localhost:5001/api/user';
      const res = await axios.get(apiUrl);
      setUser(res.data);
      console.log('User fetched successfully');
    } catch (error) {
      console.log('Error fetching user:', error.message);
      // Silently handle 401 and 404 errors - just means the user is not logged in
      setUser(null);
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    const inputToSend = input;
    setInput('');
    try {
      const history = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.filter(m => m.role !== 'system'),
        { role: 'user', content: inputToSend }
      ];
      setAxiosAuth();
      // Use relative URL in production, fallback to localhost in development
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/api/chat'
        : 'http://localhost:5001/api/chat';
      const res = await axios.post(apiUrl, { message: inputToSend, history });
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
    const hash = window.location.hash;
    const m = hash.match(/#token=([^&]+)/);
    if (m && m[1]) {
      localStorage.setItem('centai_token', m[1]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setAxiosAuth();
    fetchUser();
  }, [fetchUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, writingText, writing]);

  useEffect(() => {
    localStorage.setItem('centai_chat', JSON.stringify(messages));
  }, [messages]);

  const showWelcome = messages.filter(m => m.role === 'user').length === 0;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gradient-to-br from-[#181a20] to-[#23272f] font-sfpro text-[17px]">
      {/* Header - Fixed at top */}
      <div className="bg-gradient-to-r from-[#181a20] to-[#23272f] border-b border-gray-800 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={logo} alt="CentAI Logo" className="h-10 rounded-xl shadow-sm" />
            <div>
              <h3 className="font-semibold text-white text-lg">CentAI</h3>
              <p className="text-xs text-blue-400">Centurion University Assistant</p>
            </div>
          </div>
          <div>
            {user ? (
              <button
                onClick={handleLogout}
                className="px-5 py-2 rounded-xl bg-[#23272f] text-white font-medium shadow hover:bg-[#2c2f36] transition border border-[#333] focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ fontSize: 16 }}
              >
                Logout
              </button>
            ) : (
              <button
                onClick={handleLogin}
                className="px-5 py-2 rounded-xl bg-white text-gray-900 font-medium shadow hover:bg-gray-200 transition border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ fontSize: 16 }}
              >
                Login with Google
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area - Scrollable */}
      <div ref={chatWindowRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28">
        {showWelcome && (
          <div className="flex flex-col items-center justify-center space-y-4 pt-10">
            <h3 className="font-semibold text-2xl text-white tracking-tight text-center mb-2 px-4">
              {user?.name ? `Hi ${user.name}, Welcome to Centurion!` : 'Welcome to Centurion!'}
            </h3>
            <div className="bg-[#181a20] rounded-2xl shadow-lg px-6 py-6 text-white text-lg font-normal text-center max-w-md mx-auto border border-[#23272f]">
              Hello! I'm CentAI, your Centurion University assistant. I can help you with everything about our university - from departments and faculty to hostels and student activities. What can I tell you about Centurion University today?
            </div>
          </div>
        )}

        {messages.filter(m => m.content && m.content.trim() !== '').map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={msg.role === 'user'
              ? 'max-w-[80%] rounded-2xl px-4 py-4 text-lg font-medium shadow bg-gradient-to-r from-blue-500 to-blue-700 text-white border border-blue-700 break-words backdrop-blur-md'
              : 'max-w-[80%] rounded-2xl px-4 py-4 text-lg font-normal shadow bg-gradient-to-r from-[#23272f] to-[#181a20] text-white border border-[#23272f] break-words backdrop-blur-md'}>
              {msg.role === 'assistant' ? (
                <div className="formatted-content" style={{ whiteSpace: 'pre-line' }}>
                  {msg.content.split('\n\n').map((paragraph, i) => {
                    // Handle headings
                    if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                      return <h3 key={i} className="font-bold text-xl mt-2 mb-3">{paragraph.replace(/\*\*/g, '')}</h3>;
                    }
                    // Handle subheadings
                    else if (paragraph.includes('**') && paragraph.trim().startsWith('*')) {
                      // For list items with bold text
                      return <p key={i} className="my-1" dangerouslySetInnerHTML={{
                        __html: paragraph.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                      }} />;
                    }
                    // Handle numbered lists
                    else if (/^\d+\.\s/.test(paragraph)) {
                      return <p key={i} className="ml-4 my-1">{paragraph}</p>;
                    }
                    // Regular paragraph with potential bold formatting
                    else {
                      return <p key={i} className="my-2" dangerouslySetInnerHTML={{
                        __html: paragraph.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                      }} />;
                    }
                  })}
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {writing && (
          <div className={'flex justify-start'}>
            <div className='rounded-2xl px-4 py-4 max-w-[80%] text-lg font-normal shadow bg-gradient-to-r from-[#23272f] to-[#181a20] text-white border border-[#23272f] break-words backdrop-blur-md'>
              <div className="formatted-content" style={{ whiteSpace: 'pre-line' }}>
                {writingText}
                <span className="animate-pulse">|</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input - Fixed at bottom */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#181a20] border-t border-gray-800 px-4 py-3 shadow-lg mb-8">
          <div className="max-w-2xl mx-auto flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask me anything about Centurion University..."
              className="flex-1 bg-[#23272f] text-white border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading || writing}
            />
            <button
              onClick={sendMessage}
              className={`rounded-xl px-4 py-2 transition-colors duration-200 ${
                loading || writing || !input.trim()
                  ? 'bg-[#23272f] text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              disabled={loading || writing || !input.trim()}
            >
              {(loading || writing)
                ? <span className="animate-spin inline-block mr-2">⏳</span>
                : <span className="inline-block mr-2">➤</span>
              } Send
            </button>
          </div>
        </div>
      )}

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-1 text-center text-xs text-gray-400 border-t border-gray-800 z-10">
        Developed By: <a href="https://abhimitra.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Abhi Mitra</a>
      </div>
    </div>
  );
}

export default App;
