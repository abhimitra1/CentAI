import React from 'react';

export default function ChatWindow({ messages, username }) {
  return (
    <div className="chat-window-container">
      <div className="chat-header">
        {username ? `Hi ${username}, Welcome to Centurion!` : 'Welcome to Centurion!'}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300 }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}
