import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

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
  const [contacts, setContacts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Cargar contactos
  useEffect(() => {
    fetchContacts();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data) setContacts(data);
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Cargar mensajes del chat activo
  useEffect(() => {
    if (!activeChat) return;

    fetchMessages(activeChat.id);

    const msgChannel = supabase
      .channel(`chat-${activeChat.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `contact_id=eq.${activeChat.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [activeChat]);

  const fetchMessages = async (contactId) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data);
  };

  // 3. Mover estado en el embudo
  const moveContact = async (contactId, newStatus) => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus } : c));
    if (activeChat && activeChat.id === contactId) {
      setActiveChat(prev => ({ ...prev, status: newStatus }));
    }

    await supabase
      .from('contacts')
      .update({ status: newStatus })
      .eq('id', contactId);
  };

  // 4. Crear contacto manual
  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!newPhone.trim()) return;

    setLoading(true);
    try {
      const payload = {
        name: newName.trim() || newPhone.trim(),
        phone: newPhone.trim(),
        status: 'entrante',
        last_message: 'Nuevo contacto agregado'
      };

      const { data, error } = await supabase
        .from('contacts')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        setShowNewContactModal(false);
        setNewName('');
        setNewPhone('');
        fetchContacts();
        setActiveChat(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 5. Enviar mensaje (texto y/o imagen)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMsgText.trim() && !selectedFile) || !activeChat) return;

    let imageUrl = null;
    const textToSend = newMsgText;
    const fileToSend = selectedFile;

    // Limpiar campos visuales de inmediato
    setNewMsgText('');
    setSelectedFile(null);

    try {
      // Subir archivo al bucket de Supabase si existe
      if (fileToSend) {
        const fileExt = fileToSend.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, fileToSend);

        if (!uploadError) {
          const { data } = supabase.storage.from('chat-attachments').getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        } else {
          console.error('Error subiendo imagen a Supabase Storage:', uploadError);
        }
      }

      const storedText = imageUrl ? `${imageUrl} ${textToSend}`.trim() : textToSend;

      // Guardar mensaje en base de datos
      await supabase.from('messages').insert([{
        contact_id: activeChat.id,
        sender: 'me',
        text: storedText
      }]);

      // Actualizar tarjeta del contacto
      await supabase.from('contacts').update({
        last_message: imageUrl ? '📷 Imagen enviada' : textToSend,
        updated_at: new Date().toISOString()
      }).eq('id', activeChat.id);

      // Despachar a WhatsApp real mediante Render
      await fetch('https://whatsapp-server-qr.onrender.com/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activeChat.phone,
          message: textToSend,
          imageUrl: imageUrl
        })
      });
    } catch (error) {
      console.error('Error al enviar el mensaje:', error);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="crm-app">
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
          <button className="btn-add" onClick={() => setShowNewContactModal(true)}>+ Nuevo Contacto</button>
        </div>
      </header>

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
                    </div>
                    <div className="card-phone">{contact.phone}</div>
                    <div className="card-msg-preview">{contact.last_message}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nuevo Contacto */}
      {showNewContactModal && (
        <div className="chat-modal-backdrop" onClick={() => setShowNewContactModal(false)}>
          <div className="chat-modal" style={{ height: 'auto', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>Agregar Nuevo Contacto</h3>
            <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="Nombre del contacto (opcional)" 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                style={{ padding: '10px', background: '#232733', border: '1px solid #3b4252', color: '#fff', borderRadius: '6px' }}
              />
              <input 
                type="text" 
                placeholder="Número de WhatsApp (ej: +5493512345678)" 
                value={newPhone} 
                onChange={e => setNewPhone(e.target.value)} 
                required
                style={{ padding: '10px', background: '#232733', border: '1px solid #3b4252', color: '#fff', borderRadius: '6px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn-add" style={{ background: '#3b4252', color: '#fff' }} onClick={() => setShowNewContactModal(false)}>Cancelar</button>
                <button type="submit" className="btn-add" disabled={loading}>
                  {loading ? 'Guardando...' : 'Crear Contacto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Chat Interactivo */}
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
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
                  No hay mensajes aún en esta conversación
                </div>
              ) : (
                messages.map((m) => {
                  const isImage = m.text && m.text.startsWith('http') && (
                    m.text.includes('.jpg') || 
                    m.text.includes('.png') || 
                    m.text.includes('.jpeg') || 
                    m.text.includes('.webp') ||
                    m.text.includes('chat-attachments')
                  );

                  return (
                    <div key={m.id || m.created_at} className={`msg-bubble ${m.sender}`}>
                      {isImage ? (
                        <div>
                          <img 
                            src={m.text.split(' ')[0]} 
                            alt="Adjunto" 
                            style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '4px', display: 'block' }} 
                          />
                          {m.text.split(' ').slice(1).join(' ') && (
                            <p>{m.text.split(' ').slice(1).join(' ')}</p>
                          )}
                        </div>
                      ) : (
                        <p>{m.text}</p>
                      )}
                      <span className="msg-time">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Vista previa si hay un archivo seleccionado */}
            {selectedFile && (
              <div style={{ padding: '8px 16px', background: '#1e222d', color: '#ff9800', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #3b4252' }}>
                <span>📎 Adjunto listo: <strong>{selectedFile.name}</strong></span>
                <button 
                  type="button" 
                  onClick={() => setSelectedFile(null)} 
                  style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="chat-modal-footer">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }} 
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                style={{ 
                  background: '#2e3440', 
                  border: '1px solid #434c5e', 
                  color: '#eceff4',
                  padding: '0 14px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Adjuntar imagen"
              >
                📎
              </button>
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