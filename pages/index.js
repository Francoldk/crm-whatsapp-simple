import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import KanbanTab from '../components/KanbanTab';
import AsistenteIATab from '../components/AsistenteIATab';

const ESTADOS = [
  'Entrante', 'Faltan Datos', 'Cotizado', 'Pre-Cierre', 'Cliente Cerrado', 'Cliente Finalizado',
];

const STATUS_COLORS = {
  'Entrante': { bg: 'rgba(244,63,94,0.12)', color: '#fb7185', border: 'rgba(244,63,94,0.4)' },
  'Faltan Datos': { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.4)' },
  'Cotizado': { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: 'rgba(139,92,246,0.4)' },
  'Pre-Cierre': { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: 'rgba(6,182,212,0.4)' },
  'Cliente Cerrado': { bg: 'rgba(249,115,22,0.12)', color: '#fb923c', border: 'rgba(249,115,22,0.4)' },
  'Cliente Finalizado': { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', border: 'rgba(34,197,94,0.4)' },
};

export default function CRM() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [inputReply, setInputReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({});
  const [hoveredId, setHoveredId] = useState(null);

  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const selectedConv = useMemo(
    () => conversations.find((c) => String(c.id) === String(selectedId)) || conversations[0] || null,
    [conversations, selectedId]
  );

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setConversations(data);
        if (!selectedId && data.length > 0) setSelectedId(String(data[0].id));
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const fetchVendedores = useCallback(async () => {
    try {
      const res = await fetch('/api/vendedores');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setVendedores(data);
    } catch (err) {}
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchConversations();
    fetchVendedores();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [status, fetchConversations, fetchVendedores]);

  useEffect(() => {
    if (selectedConv) setFormData(selectedConv.quoteData || {});
  }, [selectedConv?.id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages?.length]);

  // AUTOCOMPLETADO SOL AI
  const handleTriggerSolAI = async () => {
    if (!selectedConv?.messages || selectedConv.messages.length === 0) return;
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationHistory: selectedConv.messages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en Sol AI');

      if (data.extractedData) {
        const cleanedData = Object.fromEntries(
          Object.entries(data.extractedData).filter(([_, v]) => v !== null && v !== '')
        );
        const mergedData = { ...formData, ...cleanedData };
        setFormData(mergedData);
        updateContact({ quoteData: mergedData, status: data.suggestedStatus || selectedConv.status });
      }
      if (data.replyMessage) setInputReply(data.replyMessage);
    } catch (err) {
      alert('Detalle: ' + err.message);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputReply.trim() || !selectedConv) return;

    const text = inputReply.trim();
    setInputReply('');
    const targetPhone = selectedConv.phone || selectedConv.jid;
    const now = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedConv.id)
          ? {
              ...c,
              lastMessage: text,
              messages: [...(c.messages || []), { id: Date.now(), sender: 'me', text, time: now }],
            }
          : c
      )
    );

    try {
      // Usamos el proxy de Vercel a Render
      await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, message: text, contactId: selectedConv.id }),
      });
      // Guardar en la DB de Supabase
      await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedConv.id,
          lastMessage: text,
        })
      });
    } catch (err) {
      console.error('Error enviando:', err);
    }
  };

  const updateContact = async (fields) => {
    if (!selectedConv) return;
    try {
      await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedConv.id, ...fields }),
      });
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRename = async (conv, e) => {
    e?.stopPropagation();
    const currentName = conv.name || conv.phone;
    const newName = prompt(`Nuevo nombre para "${currentName}":`, currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    try {
      await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conv.id, name: newName.trim() }),
      });
      fetchConversations();
    } catch (err) {}
  };

  const handleDelete = async (conv, e) => {
    e?.stopPropagation();
    const confirmacion = prompt(`⚠️ ¿Borrar "${conv.name || conv.phone}" definitivamente?\nEscribí "BORRAR" para confirmar:`);
    if (confirmacion !== 'BORRAR') return;
    try {
      await fetch('/api/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conv.id }),
      });
      if (String(selectedId) === String(conv.id)) setSelectedId(null);
      fetchConversations();
    } catch (err) {}
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const getVendedorName = (userId) => {
    if (!userId) return 'Sin asignar';
    const v = vendedores.find((v) => v.id === userId);
    return v ? (v.name || v.email) : `#${userId}`;
  };

  if (status === 'loading' || !session) {
    return <div style={styles.loadingScreen}>Cargando...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logoBox}>
            <img src="/logo.png" alt="DCAM" style={styles.logo} />
          </div>
          <div>
            <h1 style={styles.title}>CRM DCAM</h1>
            <span style={styles.subtitle}>
              {session.user.name || session.user.email} · {session.user.role}
            </span>
          </div>
        </div>

        <nav style={styles.tabs}>
          <button onClick={() => setActiveTab('chat')} style={activeTab === 'chat' ? styles.tabActive : styles.tab}>💬 Chat</button>
          <button onClick={() => setActiveTab('kanban')} style={activeTab === 'kanban' ? styles.tabActive : styles.tab}>📊 Kanban</button>
          <button onClick={() => setActiveTab('asistente')} style={activeTab === 'asistente' ? styles.tabActive : styles.tab}>✨ Asistente IA</button>
        </nav>

        <div style={styles.headerRight}>
          <div style={styles.statPill}>
            <span style={styles.statDot} />
            <span>{conversations.length} contactos</span>
          </div>
          {session.user.role === 'admin' && (
            <button onClick={() => router.push('/admin')} style={styles.btnAdmin}>👥 Usuarios</button>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={styles.btnLogout}>Salir</button>
        </div>
      </header>

      {activeTab === 'chat' && (
        <main style={styles.grid}>
          <aside style={styles.colInbox}>
            <div style={styles.inboxHeader}>
              <input
                type="text"
                placeholder="🔍  Buscar contactos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <div style={styles.list}>
              {loading && conversations.length === 0 && <div style={styles.emptyState}>Cargando...</div>}
              {!loading && filteredConversations.length === 0 && (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.4 }}>📭</div>
                  <span>No hay conversaciones</span>
                </div>
              )}
              {filteredConversations.map((conv) => {
                const isSelected = String(conv.id) === String(selectedId);
                const isHovered = hoveredId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedId(String(conv.id))}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      ...styles.convItem,
                      position: 'relative',
                      background: isSelected ? 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(6,182,212,0.06))' : 'transparent',
                      borderLeft: isSelected ? '3px solid #8b5cf6' : '3px solid transparent',
                    }}
                  >
                    <div style={styles.avatar}>{(conv.name || 'C').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.convTop}>
                        <strong style={styles.convName}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: conv.botActive !== false ? '#22c55e' : '#ef4444', marginRight: '6px' }} />
                          {conv.name || conv.phone}
                        </strong>
                        <span style={styles.convTime}>{conv.time}</span>
                      </div>
                      <div style={styles.convPhone}>+{conv.phone}</div>
                      <p style={styles.convSnippet}>{conv.lastMessage || 'Sin mensajes'}</p>
                      <div style={{ marginTop: '5px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ ...styles.statusBadge, background: STATUS_COLORS[conv.status]?.bg || 'rgba(51,65,85,0.4)', color: STATUS_COLORS[conv.status]?.color || '#94a3b8', border: `1px solid ${STATUS_COLORS[conv.status]?.border || 'rgba(51,65,85,0.6)'}` }}>
                          {conv.status}
                        </span>
                        {conv.assignedTo && <span style={styles.assignedBadge}>👤 {getVendedorName(conv.assignedTo)}</span>}
                      </div>
                    </div>
                    {isHovered && (
                      <div style={{ ...styles.convActions, position: 'absolute', right: '10px', top: '15px', display: 'flex', gap: '5px', zIndex: 10 }}>
                        <button onClick={(e) => handleRename(conv, e)} style={styles.actionBtn}>✏️</button>
                        <button onClick={(e) => handleDelete(conv, e)} style={{ ...styles.actionBtn, ...styles.actionBtnDanger }}>🗑️</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          <section style={styles.colChat}>
            {selectedConv ? (
              <>
                <div style={styles.chatHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ ...styles.avatar, width: '42px', height: '42px', fontSize: '17px' }}>
                      {(selectedConv.name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={styles.chatTitle}>{selectedConv.name || selectedConv.phone}</h3>
                      <span style={styles.chatPhone}>+{selectedConv.phone}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={(e) => handleRename(selectedConv, e)} style={styles.btnRename}>✏️</button>
                    <button
                      onClick={() => updateContact({ botActive: !(selectedConv.botActive !== false) })}
                      style={{
                        ...styles.btnToggleBot,
                        background: selectedConv.botActive !== false ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.1))' : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))',
                        borderColor: selectedConv.botActive !== false ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
                        color: selectedConv.botActive !== false ? '#4ade80' : '#f87171',
                      }}
                    >
                      {selectedConv.botActive !== false ? '🤖 Sol activa' : '⏸️ Sol pausada'}
                    </button>
                  </div>
                </div>

                <div style={styles.messagesArea}>
                  {(!selectedConv.messages || selectedConv.messages.length === 0) && (
                    <div style={styles.emptyChat}>
                      <div style={{ fontSize: '44px', opacity: 0.15 }}>💬</div>
                      <div style={{ color: '#475569', fontSize: '13px', marginTop: '10px' }}>Sin mensajes todavía</div>
                    </div>
                  )}
                  {(selectedConv.messages || []).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        ...styles.bubble,
                        alignSelf: m.sender === 'me' ? 'flex-end' : 'flex-start',
                        background: m.sender === 'me' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))',
                        border: m.sender === 'me' ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(51,65,85,0.6)',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5 }}>{m.text}</p>
                      <span style={styles.bubbleTime}>{m.time}</span>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                <form onSubmit={handleSend} style={styles.chatInputBar}>
                  <input
                    type="text"
                    placeholder="Escribí un mensaje..."
                    value={inputReply}
                    onChange={(e) => setInputReply(e.target.value)}
                    style={styles.inputMessage}
                  />
                  <button type="submit" style={styles.btnSend} disabled={!inputReply.trim()}>➤</button>
                </form>
              </>
            ) : (
              <div style={styles.emptyChat}>
                <div style={{ fontSize: '56px', opacity: 0.15 }}>👈</div>
                <div style={{ color: '#475569', marginTop: '10px' }}>Seleccioná una conversación</div>
              </div>
            )}
          </section>

          <aside style={styles.colForm}>
            <div style={styles.formHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={styles.formIcon}>📋</span>
                  <strong style={styles.formTitle}>FICHA DE COTIZACIÓN</strong>
                </div>
                <button
                  onClick={handleTriggerSolAI}
                  disabled={loadingAi}
                  style={{
                    background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                    color: '#c7d2fe',
                    border: '1px solid #4338ca',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: loadingAi ? 'wait' : 'pointer',
                    opacity: loadingAi ? 0.7 : 1,
                  }}
                >
                  {loadingAi ? '⏳ Calculando...' : '⚡ Sol: Autocompletar'}
                </button>
              </div>
            </div>
            <div style={styles.formScroll}>
              <Field label="Cliente / Razón Social">
                <input type="text" value={formData.clientName || ''} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} style={styles.fieldInput} placeholder="Nombre del cliente" />
              </Field>
              <Field label="Producto / Mercadería">
                <input type="text" value={formData.product || ''} onChange={(e) => setFormData({ ...formData, product: e.target.value })} style={styles.fieldInput} placeholder="Descripción del producto" />
              </Field>
              <div style={styles.twoCols}>
                <Field label="Peso (kg)">
                  <input type="number" value={formData.weightKg || ''} onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })} style={styles.fieldInput} placeholder="kg" />
                </Field>
                <Field label="CBM (m³)">
                  <input type="number" value={formData.cbm || ''} onChange={(e) => setFormData({ ...formData, cbm: e.target.value })} style={styles.fieldInput} placeholder="m³" />
                </Field>
              </div>
              <Field label="Valor FOB (USD)">
                <input type="number" value={formData.goodsValue || ''} onChange={(e) => setFormData({ ...formData, goodsValue: e.target.value })} style={styles.fieldInput} placeholder="USD" />
              </Field>
              <Field label="Notas Operativas">
                <textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} style={styles.fieldTextarea} placeholder="Detalles adicionales..." />
              </Field>

              <button onClick={() => updateContact({ quoteData: formData })} style={styles.btnSave}>💾 Guardar Ficha</button>

              <div style={styles.divider} />

              <Field label="Estado del Lead">
                <select value={selectedConv?.status || 'Entrante'} onChange={(e) => updateContact({ status: e.target.value })} style={styles.fieldSelect}>
                  {ESTADOS.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </Field>

              <Field label="Asignado a">
                <select value={selectedConv?.assignedTo || ''} onChange={(e) => updateContact({ assignedTo: e.target.value ? Number(e.target.value) : null })} style={styles.fieldSelect}>
                  <option value="">Sin asignar</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name || v.email}</option>)}
                </select>
              </Field>
            </div>
          </aside>
        </main>
      )}

      {activeTab === 'kanban' && <KanbanTab conversations={conversations} />}
      {activeTab === 'asistente' && <AsistenteIATab />}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.3px' }}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  loadingScreen: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05070d', color: '#64748b' },
  container: { height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #05070d 0%, #0a0f1c 100%)', color: '#e2e8f0', overflow: 'hidden', position: 'relative' },
  bgGlow1: { position: 'fixed', top: '-20%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 },
  bgGlow2: { position: 'fixed', bottom: '-20%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 },
  header: { height: '64px', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(51,65,85,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, zIndex: 10, position: 'relative' },
  brand: { display: 'flex', alignItems: 'center', gap: '14px' },
  logoBox: { width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: '100%', height: '100%', objectFit: 'contain', padding: '4px' },
  title: { fontSize: '15px', fontWeight: 800, margin: 0, color: '#f1f5f9' },
  subtitle: { fontSize: '10.5px', color: '#64748b' },
  tabs: { display: 'flex', gap: '6px' },
  tab: { background: 'rgba(30,41,59,0.6)', color: '#94a3b8', border: '1px solid rgba(51,65,85,0.6)', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  tabActive: { background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: '1px solid rgba(139,92,246,0.5)', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' },
  headerRight: { display: 'flex', gap: '10px', alignItems: 'center' },
  statPill: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 600, background: 'rgba(30,41,59,0.6)', color: '#94a3b8', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(51,65,85,0.6)' },
  statDot: { width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e' },
  btnAdmin: { background: 'rgba(6,182,212,0.15)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)', padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' },
  btnLogout: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' },
  grid: { flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr 400px', minHeight: 0, overflow: 'hidden', zIndex: 1, position: 'relative' },
  colInbox: { background: 'rgba(10,15,28,0.6)', backdropFilter: 'blur(10px)', borderRight: '1px solid rgba(51,65,85,0.4)', display: 'flex', flexDirection: 'column', minHeight: 0 },
  inboxHeader: { padding: '14px', borderBottom: '1px solid rgba(51,65,85,0.3)' },
  searchInput: { width: '100%', padding: '10px 14px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '10px', color: '#e2e8f0', fontSize: '12.5px', outline: 'none', boxSizing: 'border-box' },
  list: { flex: 1, overflowY: 'auto', minHeight: 0 },
  emptyState: { padding: '60px 20px', textAlign: 'center', fontSize: '13px', color: '#64748b' },
  convItem: { display: 'flex', gap: '12px', padding: '14px', cursor: 'pointer', borderBottom: '1px solid rgba(51,65,85,0.25)', transition: 'background 0.15s', position: 'relative' },
  convActions: { position: 'absolute', top: '10px', right: '15px', display: 'flex', gap: '5px', zIndex: 2 },
  actionBtn: { width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(51,65,85,0.7)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  actionBtnDanger: { background: 'rgba(127,29,29,0.9)', border: '1px solid rgba(239,68,68,0.5)' },
  avatar: { width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 },
  convTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  convName: { fontSize: '13px', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' },
  convTime: { fontSize: '10px', color: '#64748b' },
  convPhone: { fontSize: '11px', color: '#64748b', marginBottom: '3px' },
  convSnippet: { margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statusBadge: { fontSize: '9.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', display: 'inline-block' },
  assignedBadge: { fontSize: '9.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)', display: 'inline-block' },
  colChat: { background: 'rgba(5,7,13,0.4)', display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid rgba(51,65,85,0.4)' },
  chatHeader: { padding: '14px 20px', background: 'rgba(15,23,42,0.7)', borderBottom: '1px solid rgba(51,65,85,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatTitle: { margin: 0, fontSize: '14.5px', color: '#f1f5f9', fontWeight: 600 },
  chatPhone: { fontSize: '11.5px', color: '#64748b' },
  btnRename: { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd', padding: '7px 12px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  btnToggleBot: { border: '1px solid', padding: '7px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' },
  messagesArea: { flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 },
  emptyChat: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' },
  bubble: { maxWidth: '70%', padding: '11px 15px', borderRadius: '16px' },
  bubbleTime: { display: 'block', textAlign: 'right', fontSize: '9.5px', color: 'rgba(255,255,255,0.5)', marginTop: '5px' },
  chatInputBar: { padding: '16px 20px', background: 'rgba(15,23,42,0.7)', borderTop: '1px solid rgba(51,65,85,0.4)', display: 'flex', gap: '12px' },
  inputMessage: { flex: 1, padding: '12px 16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '12px', color: '#e2e8f0', fontSize: '13.5px', outline: 'none' },
  btnSend: { width: '46px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' },
  colForm: { background: 'rgba(10,15,28,0.6)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', minHeight: 0 },
  formHeader: { padding: '18px 20px', borderBottom: '1px solid rgba(51,65,85,0.4)' },
  formIcon: { fontSize: '16px' },
  formTitle: { fontSize: '11.5px', color: '#f1f5f9', letterSpacing: '0.8px' },
  formScroll: { flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 },
  fieldInput: { width: '100%', padding: '10px 13px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12.5px', outline: 'none', boxSizing: 'border-box' },
  fieldSelect: { width: '100%', padding: '10px 13px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12.5px', outline: 'none' },
  fieldTextarea: { width: '100%', padding: '10px 13px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12.5px', outline: 'none', resize: 'vertical', minHeight: '70px', fontFamily: 'inherit', boxSizing: 'border-box' },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  btnSave: { padding: '12px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', marginTop: '4px' },
  divider: { height: '1px', background: 'rgba(51,65,85,0.4)', margin: '6px 0' },
};