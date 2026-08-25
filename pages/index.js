import { useState } from 'react';

// Columnas del embudo configurables
const COLUMNS = [
  { id: 'entrante', label: 'ENTRANTE', color: '#ff9800' },
  { id: 'esperando', label: 'ESPERANDO', color: '#2196f3' },
  { id: 'producto', label: 'PRODUCTO', color: '#9c27b0' },
  { id: 'cotizado', label: 'COTIZADO', color: '#00bcd4' },
  { id: 'potencial', label: 'CLIENTE POTENCIAL', color: '#4caf50' },
  { id: 'venta', label: 'VENTA', color: '#8bc34a' },
  { id: 'perdido', label: 'LEAD PERDIDO', color: '#f44336' }
];

export default function KanbanCRM() {
  const [contacts, setContacts] = useState([
    {
      id: '1',
      name: 'Franco Pérez',
      phone: '+549351234567',
      status: 'entrante',
      lastMessage: 'Hola, quería consultar precios...',
      updatedAt: '10:30',
      messages: [
        { from: 'client', text: 'Hola, quería consultar precios...', time: '10:30' }
      ]
    },
    {
      id: '2',
      name: 'Distribuidora Norte',
      phone: '+549113456789',
      status: 'cotizado',
      lastMessage: 'Pasame la lista completa',
      updatedAt: '09:15',
      messages: [
        { from: 'client', text: 'Pasame la lista completa', time: '09:10' },
        { from: 'me', text: 'Ahí te envié el detalle en PDF', time: '09:15' }
      ]
    }
  ]);

  const [activeChat, setActiveChat] = useState(null);
  const [newMsgText, setNewMsgText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Cambiar estado/columna de un contacto
  const moveContact = (contactId, newStatus) => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus } : c));
    if (activeChat && activeChat.id === contactId) {
      setActiveChat(prev => ({ ...prev, status: newStatus }));
    }
  };

  // Enviar mensaje en el chat abierto
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMsgText.trim() || !activeChat) return;

    const newMsg = {
      from: 'me',
      text: newMsgText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedContacts = contacts.map(c => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          lastMessage: newMsgText,
          updatedAt: newMsg.time,
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    });

    setContacts(updatedContacts);
    setActiveChat(prev => ({
      ...prev,
      lastMessage: newMsgText,
      updatedAt: newMsg.time,
      messages: [...prev.messages, newMsg]
    }));
    setNewMsgText('');
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="crm-app">
      {/* Barra superior */}
      <header className="topbar">
        <div className="brand">
          <span className="logo-icon">📊</span>
          <h2>CRM WhatsApp Multi-Embudo</h2>
        </div>
        <div className="top-actions">
          <input 
            type="text" 
            placeholder="🔍 Buscar contacto o teléfono..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="btn-add">+ Nuevo Contacto</button>
        </div>
      </header>

      {/* Tablero Kanban */}
      <div className="kanban-board">
        {COLUMNS.map(col => {
          const colContacts = filteredContacts.filter(c => c.status === col.id);
          return (
            <div key={col.id} className="kanban-column">
              <div className="column-header" style={{ borderTopColor: col.color }}>
                <span className="col-title">{col.label}</span>
                <span className="col-count">{colContacts.length}</span>
              </div>

              <div className="column-cards">
                {colContacts.map(contact => (
                  <div 
                    key={contact.id} 
                    className="lead-card"
                    onClick={() => setActiveChat(contact)}
                  >
                    <div className="card-top">
                      <strong>{contact.name}</strong>
                      <span className="card-time">{contact.updatedAt}</span>
                    </div>
                    <div className="card-phone">{contact.phone}</div>
                    <div className="card-msg-preview">{contact.lastMessage}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ventana flotante de Chat */}
      {activeChat && (
        <div className="chat-modal-backdrop" onClick={() => setActiveChat(null)}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <div className="chat-modal-header">
              <div>
                <h3>{activeChat.name}</h3>
                <small>{activeChat.phone}</small>
              </div>
              <div className="chat-header-actions">
                <select 
                  value={activeChat.status} 
                  onChange={(e) => moveContact(activeChat.id, e.target.value)}
                  className="status-dropdown"
                >
                  {COLUMNS.map(col => (
                    <option key={col.id} value={col.id}>{col.label}</option>
                  ))}
                </select>
                <button className="close-btn" onClick={() => setActiveChat(null)}>✕</button>
              </div>
            </div>

            <div className="chat-modal-messages">
              {activeChat.messages.map((m, idx) => (
                <div key={idx} className={`msg-bubble ${m.from}`}>
                  <p>{m.text}</p>
                  <span className="msg-time">{m.time}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="chat-modal-footer">
              <input 
                type="text" 
                placeholder="Escribe un mensaje de WhatsApp..."
                value={newMsgText}
                onChange={(e) => setNewMsgText(e.target.value)}
              />
              <button type="submit">Enviar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}