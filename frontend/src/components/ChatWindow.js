import React from 'react';

export default function ChatWindow({ messages }) {
  return (
    <div className="w-100" style={{ maxWidth: 700, margin: '32px auto 0', background: '#23272f', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', padding: 32, minHeight: 500, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
      <h3 className="mb-4 fw-bold text-white" style={{ fontSize: 22 }}>Centurion University Onboarding Chat</h3>
      <div className="flex-grow-1 d-flex flex-column gap-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === 'user' ? 'd-flex justify-content-end' : 'd-flex justify-content-start'}>
            <div className={msg.role === 'user' ? 'bg-secondary text-white' : 'bg-dark text-white'}
              style={{ borderRadius: 12, padding: '12px 18px', maxWidth: '80%', fontSize: 16, boxShadow: msg.role === 'user' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
