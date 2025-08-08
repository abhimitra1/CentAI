import React from 'react';

export default function ChatInput({ input, setInput, sendMessage, loading }) {
  return (
    <div className="w-100 d-flex align-items-center" style={{ maxWidth: 700, margin: '0 auto 32px', gap: 12 }}>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendMessage()}
        placeholder="Ask me anything about Centurion University..."
        className="form-control form-control-lg bg-dark text-white border-secondary"
        style={{ flex: 1, borderRadius: 12 }}
        disabled={loading}
      />
      <button
        onClick={sendMessage}
        className="btn btn-success btn-lg"
        style={{ borderRadius: 12 }}
        disabled={loading || !input.trim()}
      >{loading ? <i className="bi bi-arrow-repeat"></i> : <i className="bi bi-send"></i>}</button>
    </div>
  );
}
