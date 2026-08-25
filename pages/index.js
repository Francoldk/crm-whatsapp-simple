import { useState, useEffect } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error cargando contactos:', error);
      } else if (data) {
        setContacts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!newPhone.trim()) {
      alert('Ingresá un número de teléfono');
      return;
    }

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
        .select();

      if (error) {
        alert('Error Supabase: ' + error.message);
        console.error(error);
      } else {
        setShowNewContactModal(false);
        setNewName('');
        setNewPhone('');
        fetchContacts();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

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
    </div>
  );
}