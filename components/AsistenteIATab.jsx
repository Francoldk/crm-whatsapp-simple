import { useState, useRef, useEffect } from 'react';

export default function AsistenteIATab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'ai', text: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: 'Error: ' + (data.error || 'sin respuesta') }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Error de conexión' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>✨</span>
        <div>
          <strong style={styles.title}>Asistente Gemini</strong>
          <div style={styles.subtitle}>Consultas rápidas · CBM · PA · Redacción</div>
        </div>
      </div>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <div style={{ fontSize: '48px', opacity: 0.2 }}>💬</div>
            <div style={{ marginTop: '12px', color: '#64748b', fontSize: '13px' }}>
              Preguntame algo como:
            </div>
            <div style={styles.suggestions}>
              <button style={styles.suggestion} onClick={() => setInput('Calculame el CBM de una caja de 50x40x30 cm')}>
                Calculame el CBM de una caja de 50x40x30 cm
              </button>
              <button style={styles.suggestion} onClick={() => setInput('¿Cuál es la posición arancelaria de un motor eléctrico?')}>
                ¿Cuál es la PA de un motor eléctrico?
              </button>
              <button style={styles.suggestion} onClick={() => setInput('Redactame un mail para un proveedor en China pidiendo proforma')}>
                Redactar mail a proveedor
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user'
                ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                : 'rgba(30,41,59,0.8)',
              border: m.role === 'user'
                ? '1px solid rgba(139,92,246,0.4)'
                : '1px solid rgba(51,65,85,0.6)',
            }}
          >
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {m.text}
            </p>
          </div>
        ))}
        {loading && (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <span>Gemini pensando...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={styles.inputBar}>
        <input
          type="text"
          placeholder="Escribí tu consulta..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={styles.input}
          disabled={loading}
        />
        <button type="submit" style={styles.btnSend} disabled={!input.trim() || loading}>
          ➤
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(51,65,85,0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(15,23,42,0.6)',
  },
  icon: { fontSize: '24px' },
  title: { fontSize: '14px', color: '#f1f5f9' },
  subtitle: { fontSize: '11px', color: '#64748b' },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  suggestions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '16px',
    maxWidth: '400px',
  },
  suggestion: {
    padding: '10px 14px',
    background: 'rgba(30,41,59,0.6)',
    border: '1px solid rgba(51,65,85,0.6)',
    borderRadius: '8px',
    color: '#cbd5e1',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  bubble: {
    maxWidth: '70%',
    padding: '11px 15px',
    borderRadius: '14px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#64748b',
    fontSize: '12px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(139,92,246,0.2)',
    borderTopColor: '#8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  inputBar: {
    padding: '16px 20px',
    background: 'rgba(15,23,42,0.7)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(51,65,85,0.4)',
    display: 'flex',
    gap: '12px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    background: 'rgba(30,41,59,0.5)',
    border: '1px solid rgba(51,65,85,0.6)',
    borderRadius: '12px',
    color: '#e2e8f0',
    fontSize: '13.5px',
    outline: 'none',
  },
  btnSend: {
    width: '46px',
    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
  },
};