// pages/index.js
import { useState, useEffect } from 'react';

export default function Home() {
  const [conversations, setConversations] = useState([]);
  const [currentConv, setCurrentConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Cargar conversaciones
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data);
    } catch (error) {
      console.error('Error cargando:', error);
      // Datos de ejemplo
      setConversations(getSampleData());
    }
  };

  const selectConversation = async (id) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setCurrentConv(data);
      setMessages(data.messages || []);
      
      // Marcar como leído
      if (data.unread) {
        await fetch(`/api/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: data.status })
        });
        loadConversations();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentConv) return;

    const tempMsg = {
      from: 'me',
      text: newMessage,
      time: new Date().toISOString()
    };

    setMessages([...messages, tempMsg]);
    setNewMessage('');

    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConv.id,
          text: newMessage
        })
      });
      loadConversations();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const createConversation = async (e) => {
    e.preventDefault();
    const form = e.target;
    const phone = form.phone.value;
    const name = form.name.value || phone;
    const message = form.message.value;

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, message })
      });
      const data = await res.json();
      setShowModal(false);
      loadConversations();
      selectConversation(data.id);
      form.reset();
    } catch (error) {
      alert('Error al crear conversación');
    }
  };

  const updateStatus = async (status) => {
    if (!currentConv) return;
    try {
      await fetch(`/api/conversations/${currentConv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadConversations();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="container">
      <header>
        <h1>📱 CRM WhatsApp</h1>
        <div className="header-actions">
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            ➕ Nuevo Chat
          </button>
          <span className="badge">🟢 Conectado</span>
        </div>
      </header>

      <div className="main-layout">
        {/* Lista de conversaciones */}
        <aside className="conversations-list">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div id="conversationsContainer">
            {filteredConversations.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${currentConv?.id === conv.id ? 'active' : ''}`}
                onClick={() => selectConversation(conv.id)}
              >
                <div className="info">
                  <span className="name">{conv.name}</span>
                  <span className="time">{formatTime(conv.date)}</span>
                </div>
                <div className="last-message">{conv.lastMessage}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span className="status-badge">{getStatusIcon(conv.status)} {conv.status}</span>
                  {conv.unread && <span className="unread">Nuevo</span>}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Panel de Chat */}
        <main className="chat-panel">
          {currentConv ? (
            <>
              <div className="chat-header">
                <div className="contact-info">
                  <span className="avatar">👤</span>
                  <div>
                    <h3>{currentConv.name}</h3>
                    <small>{currentConv.phone}</small>
                  </div>
                </div>
                <div className="contact-actions">
                  <select
                    value={currentConv.status}
                    onChange={(e) => updateStatus(e.target.value)}
                    className="status-select"
                  >
                    <option value="nuevo">🆕 Nuevo</option>
                    <option value="progreso">🔄 En Progreso</option>
                    <option value="calificado">✅ Calificado</option>
                    <option value="cliente">🌟 Cliente</option>
                    <option value="perdido">❌ Perdido</option>
                  </select>
                  <button className="btn btn-sm" onClick={() => alert('Lead creado!')}>
                    📋 Lead
                  </button>
                </div>
              </div>

              <div className="messages">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">💬</span>
                    <p>No hay mensajes aún</p>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.from}`}>
                      {msg.text}
                      <span className="time">{formatTime(msg.time)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="chat-input">
                <input
                  type="text"
                  placeholder="Escribe un mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} className="btn btn-primary">
                  📤 Enviar
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ margin: 'auto' }}>
              <span className="empty-icon">💬</span>
              <p>Selecciona una conversación</p>
            </div>
          )}
        </main>
      </div>

      {/* Modal para nuevo chat */}
      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>📞 Nuevo Contacto</h2>
            <form onSubmit={createConversation}>
              <input
                type="text"
                name="phone"
                placeholder="📱 Número (ej: +5491112345678)"
                required
              />
              <input
                type="text"
                name="name"
                placeholder="👤 Nombre (opcional)"
              />
              <textarea
                name="message"
                placeholder="💬 Primer mensaje..."
                rows="3"
              ></textarea>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  ➕ Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Funciones de utilidad
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function getStatusIcon(status) {
  const icons = {
    'nuevo': '🆕',
    'progreso': '🔄',
    'calificado': '✅',
    'cliente': '🌟',
    'perdido': '❌'
  };
  return icons[status] || '📌';
}

function getSampleData() {
  return [
    {
      id: '1',
      name: 'Juan Pérez',
      phone: '+5491112345678',
      lastMessage: 'Hola, ¿tienen stock?',
      status: 'nuevo',
      date: new Date().toISOString(),
      unread: true,
      messages: [
        { from: 'client', text: 'Hola, ¿tienen stock?', time: new Date(Date.now() - 3600000).toISOString() },
        { from: 'me', text: '¡Hola! Sí tenemos', time: new Date(Date.now() - 3500000).toISOString() }
      ]
    },
    {
      id: '2',
      name: 'María García',
      phone: '+5491123456789',
      lastMessage: 'Excelente, lo compro',
      status: 'cliente',
      date: new Date(Date.now() - 7200000).toISOString(),
      unread: false,
      messages: [
        { from: 'client', text: 'Me interesa', time: new Date(Date.now() - 7200000).toISOString() },
        { from: 'me', text: 'Perfecto', time: new Date(Date.now() - 7000000).toISOString() }
      ]
    }
  ];
}