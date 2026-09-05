import { useState, useEffect, useRef } from 'react';

export default function ModuloVentasCRM() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [inboxFilter, setInboxFilter] = useState('activos');
  const [loadingAi, setLoadingAi] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({});
  const [inputReply, setInputReply] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const chatBottomRef = useRef(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/whatsapp-webhook');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setConversations(data);
            if (!selectedId) {
              setSelectedId(String(data[0].id));
              setFormData(data[0].quoteData || {});
            }
          }
        }
      } catch (err) {
        console.error('Error al sincronizar CRM:', err);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selectedConv = conversations.find(
    (c) => String(c.id) === String(selectedId)
  ) || conversations[0] || { messages: [], quoteData: {}, botActive: true };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages]);

  const handleSelectConversation = (conv) => {
    setSelectedId(String(conv.id));
    setFormData(conv.quoteData || {});
  };

  const handleToggleBotIndividual = async () => {
    if (!selectedConv?.phone) return;
    const nextState = !(selectedConv.botActive !== false);

    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId) ? { ...c, botActive: nextState } : c
      )
    );

    try {
      await fetch('/api/whatsapp-webhook', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedConv.phone, botActive: nextState })
      });
    } catch (e) {
      console.error('Error toggle Sol:', e);
    }
  };

  const handleFormChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId) ? { ...c, quoteData: updated } : c
      )
    );
  };

  const handleStatusChange = (newStatus) => {
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId) ? { ...c, status: newStatus } : c
      )
    );
  };

  const handleTriggerSolAI = async () => {
    if (!selectedConv.messages || selectedConv.messages.length === 0) return;
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
        const mergedData = {
          ...formData,
          ...Object.fromEntries(
            Object.entries(data.extractedData).filter(([_, v]) => v !== null && v !== '')
          )
        };
        setFormData(mergedData);
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(selectedId) ? { ...c, quoteData: mergedData } : c
          )
        );
      }

      if (data.replyMessage) {
        setInputReply(data.replyMessage);
      }

      if (data.suggestedStatus) {
        handleStatusChange(data.suggestedStatus);
      }
    } catch (err) {
      console.error(err);
      alert('Detalle del error: ' + err.message);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleToggleArchive = (id, e) => {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(id) ? { ...c, archived: !c.archived } : c
      )
    );
  };

  const handleDeleteConversation = (id, e) => {
    e.stopPropagation();
    if (confirm('¿Eliminar esta conversación del CRM?')) {
      const remaining = conversations.filter((c) => String(c.id) !== String(id));
      setConversations(remaining);
      if (String(selectedId) === String(id) && remaining.length > 0) {
        setSelectedId(String(remaining[0].id));
        setFormData(remaining[0].quoteData || {});
      }
    }
  };

  const handleRenameConversation = (id, currentName, e) => {
    e.stopPropagation();
    const newName = prompt('Ingrese el nuevo nombre para este contacto:', currentName);
    if (newName && newName.trim()) {
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(id)
            ? { ...c, name: newName.trim(), quoteData: { ...c.quoteData, clientName: newName.trim() } }
            : c
        )
      );
      if (String(selectedId) === String(id)) {
        setFormData((prev) => ({ ...prev, clientName: newName.trim() }));
      }
    }
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!inputReply.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: 'me',
      text: inputReply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId)
          ? { ...c, lastMessage: inputReply, messages: [...(c.messages || []), newMsg] }
          : c
      )
    );
    setInputReply('');
  };

  const estadosDisponibles = [
    'Nuevo Lead',
    'Cotización Pendiente',
    'Cotizado',
    'Esperando Pago',
    'Carga en Tránsito',
    'Cerrado'
  ];

  const displayedConversations = conversations.filter((c) =>
    inboxFilter === 'activos' ? !c.archived : c.archived
  );

  const filteredByStatus =
    statusFilter === 'TODOS'
      ? conversations
      : conversations.filter((c) => c.status === statusFilter);

  const isSolActiveInCurrent = selectedConv?.botActive !== false;

  return (
    <div style={styles.container}>
      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: #0f172a;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: #881337;
        }
      `}</style>

      <header style={styles.topBar}>
        <div style={styles.brandingBox}>
          <img src="/logo.png" alt="De China Al Mundo" style={styles.logoImg} />
          <div style={styles.dividerV} />
          <div>
            <h1 style={styles.systemTitle}>Módulo de Ventas & Operaciones Comex</h1>
            <span style={styles.systemSub}>Gestión de Leads, WhatsApp y Precotización</span>
          </div>
        </div>

        <nav style={styles.tabNav}>
          <button
            type="button"
            style={activeTab === 'inbox' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab('inbox')}
          >
            📥 Bandeja (3 Columnas)
          </button>
          <button
            type="button"
            style={activeTab === 'estados' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab('estados')}
          >
            📊 Estados
          </button>
        </nav>
      </header>

      {activeTab === 'inbox' && (
        <main style={styles.mainGrid}>
          <aside style={styles.colInbox}>
            <div style={styles.inboxHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={styles.inboxTitle}>Mensajes</span>
                <div style={styles.archiveToggleGroup}>
                  <button
                    type="button"
                    style={inboxFilter === 'activos' ? styles.btnFilterActive : styles.btnFilterInactive}
                    onClick={() => setInboxFilter('activos')}
                  >
                    Activos
                  </button>
                  <button
                    type="button"
                    style={inboxFilter === 'archivados' ? styles.btnFilterActive : styles.btnFilterInactive}
                    onClick={() => setInboxFilter('archivados')}
                  >
                    Archivados
                  </button>
                </div>
              </div>
            </div>

            <div className="custom-scroll" style={styles.chatScrollList}>
              {displayedConversations.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  No hay conversaciones en esta sección.
                </div>
              )}
              {displayedConversations.map((conv) => {
                const isSelected = String(conv.id) === String(selectedId);
                const isChatBotActive = conv.botActive !== false;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    style={{
                      ...styles.chatItemCard,
                      backgroundColor: isSelected ? '#1e293b' : 'transparent',
                      borderLeft: isSelected ? '4px solid #881337' : '4px solid transparent'
                    }}
                  >
                    <div style={styles.chatAvatar}>
                      {(conv.name || 'C').charAt(0).toUpperCase()}
                    </div>

                    <div style={styles.chatContentBox}>
                      <div style={styles.chatTopLine}>
                        <strong style={styles.chatName}>
                          <span style={{ fontSize: '10px', marginRight: '4px' }}>
                            {isChatBotActive ? '🟢' : '🔴'}
                          </span>
                          {conv.name}
                        </strong>
                        <span style={styles.chatTime}>{conv.time}</span>
                      </div>
                      <div style={styles.chatPhone}>+{conv.phone}</div>
                      <p style={styles.chatSnippet}>{conv.lastMessage}</p>

                      <div style={styles.cardFooterActions}>
                        <span style={styles.badgeStatusMini}>{conv.status}</span>
                        <div style={styles.actionButtonsRow}>
                          <button
                            type="button"
                            title="Renombrar cliente"
                            style={styles.btnMiniAction}
                            onClick={(e) => handleRenameConversation(conv.id, conv.name, e)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            title={conv.archived ? 'Desarchivar' : 'Archivar conversación'}
                            style={styles.btnMiniAction}
                            onClick={(e) => handleToggleArchive(conv.id, e)}
                          >
                            {conv.archived ? '📤' : '📦'}
                          </button>
                          <button
                            type="button"
                            title="Borrar conversación"
                            style={{ ...styles.btnMiniAction, color: '#f87171' }}
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section style={styles.colChat}>
            <div style={styles.chatWindowHeader}>
              <div>
                <h3 style={styles.chatTargetName}>{selectedConv?.name || 'Seleccione un chat'}</h3>
                {selectedConv?.phone && <span style={styles.chatTargetPhone}>+{selectedConv.phone}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleToggleBotIndividual}
                  style={{
                    backgroundColor: isSolActiveInCurrent ? '#064e3b' : '#7f1d1d',
                    color: isSolActiveInCurrent ? '#34d399' : '#fca5a5',
                    border: `1px solid ${isSolActiveInCurrent ? '#059669' : '#b91c1c'}`,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {isSolActiveInCurrent ? '🤖 Sol Activa en este chat' : '⏸️ Sol Pausada (Atención Manual)'}
                </button>
                <div style={styles.tagStatusRight}>{selectedConv?.status || 'Lead'}</div>
              </div>
            </div>

            <div className="custom-scroll" style={styles.chatMessagesArea}>
              {(selectedConv?.messages || []).map((m) => (
                <div
                  key={m.id}
                  style={{
                    ...styles.msgBubble,
                    alignSelf: m.sender === 'me' ? 'flex-end' : 'flex-start',
                    backgroundColor: m.sender === 'me' ? '#881337' : '#1e293b'
                  }}
                >
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.4' }}>{m.text}</p>
                  <span style={styles.msgTimeTag}>{m.time}</span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendReply} style={styles.chatInputBar}>
              <input
                type="text"
                placeholder="Escribí una respuesta o usá la sugerencia de Sol..."
                value={inputReply}
                onChange={(e) => setInputReply(e.target.value)}
                style={styles.inputMessage}
              />
              <button type="submit" style={styles.btnSend}>
                Enviar
              </button>
            </form>
          </section>

          <aside style={styles.colForm}>
            <div style={styles.formHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={styles.formTitle}>DATOS DE COTIZACIÓN</strong>
                <span style={styles.badgeAiReady}>Motor Gemini Listo</span>
              </div>

              <button
                type="button"
                onClick={handleTriggerSolAI}
                disabled={loadingAi}
                style={{
                  ...styles.btnTriggerAi,
                  opacity: loadingAi ? 0.7 : 1,
                  cursor: loadingAi ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingAi ? '⏳ Sol está analizando el chat...' : '⚡ Sol: Autocompletar & Sugerir Cierre'}
              </button>
            </div>

            <div className="custom-scroll" style={styles.formScroll}>
              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>Cliente / Razón Social:</label>
                <input
                  type="text"
                  style={styles.fieldInput}
                  value={formData?.clientName || ''}
                  onChange={(e) => handleFormChange('clientName', e.target.value)}
                  placeholder="Ej: Distribuidora SRL"
                />
              </div>

              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>WhatsApp de Contacto:</label>
                <input
                  type="text"
                  style={styles.fieldInput}
                  value={formData?.phone || ''}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                  placeholder="Ej: 549351..."
                />
              </div>

              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>Producto / Mercadería:</label>
                <input
                  type="text"
                  style={styles.fieldInput}
                  value={formData?.product || ''}
                  onChange={(e) => handleFormChange('product', e.target.value)}
                  placeholder="Ej: Zapatillas deportivas"
                />
              </div>

              <div style={styles.twoCols}>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Posición Arancelaria (NCM):</label>
                  <input
                    type="text"
                    style={styles.fieldInput}
                    value={formData?.hscode || ''}
                    onChange={(e) => handleFormChange('hscode', e.target.value)}
                    placeholder="Ej: 6404.11.00"
                  />
                </div>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Incoterm:</label>
                  <select
                    style={styles.fieldSelect}
                    value={formData?.incoterm || 'FOB'}
                    onChange={(e) => handleFormChange('incoterm', e.target.value)}
                  >
                    <option value="EXW">EXW (Fábrica)</option>
                    <option value="FOB">FOB (Puerto)</option>
                    <option value="CIF">CIF (Destino)</option>
                    <option value="DDP">DDP (Nacionalizado)</option>
                  </select>
                </div>
              </div>

              <div style={styles.threeCols}>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>FOB (USD):</label>
                  <input
                    type="number"
                    style={styles.fieldInput}
                    value={formData?.goodsValue || ''}
                    onChange={(e) => handleFormChange('goodsValue', e.target.value)}
                    placeholder="4000"
                  />
                </div>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Peso (Kg):</label>
                  <input
                    type="number"
                    style={styles.fieldInput}
                    value={formData?.weightKg || ''}
                    onChange={(e) => handleFormChange('weightKg', e.target.value)}
                    placeholder="300"
                  />
                </div>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Volumen (m³):</label>
                  <input
                    type="number"
                    step="0.01"
                    style={styles.fieldInput}
                    value={formData?.cbm || ''}
                    onChange={(e) => handleFormChange('cbm', e.target.value)}
                    placeholder="1.5"
                  />
                </div>
              </div>

              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>Modalidad de Flete:</label>
                <select
                  style={styles.fieldSelect}
                  value={formData?.shippingMode || 'maritimo_compartido'}
                  onChange={(e) => handleFormChange('shippingMode', e.target.value)}
                >
                  <option value="maritimo_compartido">🚢 Carga Compartida Marítima (LCL)</option>
                  <option value="maritimo_cbm">📦 Carga Marítima por CBM</option>
                  <option value="courier_aereo">✈️ Courier Aéreo Express</option>
                  <option value="all_in_aereo">🚀 All In Aéreo</option>
                </select>
              </div>

              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>Notas Operativas / Resumen:</label>
                <textarea
                  style={styles.fieldTextarea}
                  value={formData?.notes || ''}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Detalles de la carga."
                />
              </div>

              <button
                type="button"
                style={styles.btnActionQuote}
                onClick={() => alert('Ficha guardada.')}
              >
                💾 Guardar Ficha
              </button>
            </div>
          </aside>
        </main>
      )}

      {activeTab === 'estados' && (
        <section style={styles.tabEstadosLayout}>
          <div style={styles.filterButtonGroup}>
            <button
              type="button"
              style={statusFilter === 'TODOS' ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setStatusFilter('TODOS')}
            >
              Todos ({conversations.length})
            </button>
            {estadosDisponibles.map((st) => (
              <button
                key={st}
                type="button"
                style={statusFilter === st ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setStatusFilter(st)}
              >
                {st} ({conversations.filter((c) => c.status === st).length})
              </button>
            ))}
          </div>

          <div style={styles.estadosBodyGrid}>
            <div className="custom-scroll" style={styles.estadosColList}>
              {filteredByStatus.map((conv) => {
                const isSelected = String(conv.id) === String(selectedId);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv)}
                    style={{
                      ...styles.estadoContactButton,
                      backgroundColor: isSelected ? '#1e293b' : '#0f172a',
                      borderColor: isSelected ? '#881337' : '#334155'
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '13px' }}>
                        {conv.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>+{conv.phone}</span>
                    </div>
                    <span style={styles.badgeStatusMini}>{conv.status}</span>
                  </button>
                );
              })}
            </div>

            <div className="custom-scroll" style={styles.estadosColDetail}>
              <div style={styles.cardDetailEstado}>
                <div style={styles.cardDetailHeader}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                      {selectedConv.name}
                    </h2>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      WhatsApp: +{selectedConv.phone} | Último contacto: {selectedConv.time}
                    </span>
                  </div>
                  <div style={styles.statusCurrentBox}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Estado Actual:</span>
                    <strong style={{ color: '#fbbf24', fontSize: '14px', display: 'block' }}>
                      {selectedConv.status}
                    </strong>
                  </div>
                </div>

                <hr style={styles.hr} />

                <div style={{ marginBottom: '20px' }}>
                  <label style={styles.fieldLabel}>Cambiar Estado con un Clic:</label>
                  <div style={styles.stateSelectorGrid}>
                    {estadosDisponibles.map((estado) => (
                      <button
                        key={estado}
                        type="button"
                        onClick={() => handleStatusChange(estado)}
                        style={
                          selectedConv.status === estado
                            ? styles.stateBtnSelected
                            : styles.stateBtnOption
                        }
                      >
                        {selectedConv.status === estado ? '✓ ' : ''}
                        {estado}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.summaryBox}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#cbd5e1' }}>
                    ÚLTIMO MENSAJE REGISTRADO:
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#f1f5f9', fontStyle: 'italic' }}>
                    "{selectedConv.lastMessage}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#090d16',
    color: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden'
  },
  topBar: {
    height: '65px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    flexShrink: 0
  },
  brandingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  logoImg: {
    height: '38px',
    objectFit: 'contain'
  },
  dividerV: {
    width: '1.5px',
    height: '30px',
    backgroundColor: '#334155'
  },
  systemTitle: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0,
    letterSpacing: '0.3px'
  },
  systemSub: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  tabNav: {
    display: 'flex',
    gap: '8px'
  },
  tabBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  tabBtnActive: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #9f1239',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  mainGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '340px 1fr 390px',
    minHeight: 0,
    overflow: 'hidden'
  },
  colInbox: {
    borderRight: '1px solid #1e293b',
    backgroundColor: '#0b1120',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  inboxHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#0f172a',
    flexShrink: 0
  },
  inboxTitle: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  archiveToggleGroup: {
    display: 'flex',
    gap: '4px'
  },
  btnFilterActive: {
    backgroundColor: '#881337',
    color: '#fff',
    border: 'none',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  btnFilterInactive: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: 'none',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    cursor: 'pointer'
  },
  chatScrollList: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  chatItemCard: {
    display: 'flex',
    gap: '10px',
    padding: '12px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid #1e293b',
    transition: 'background 0.2s'
  },
  chatAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#881337',
    color: '#fff',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  chatContentBox: {
    flex: 1,
    minWidth: 0
  },
  chatTopLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline'
  },
  chatName: {
    fontSize: '13px',
    color: '#f8fafc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  chatTime: {
    fontSize: '10px',
    color: '#64748b'
  },
  chatPhone: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '2px'
  },
  chatSnippet: {
    margin: 0,
    fontSize: '11.5px',
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  cardFooterActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px'
  },
  badgeStatusMini: {
    fontSize: '9.5px',
    fontWeight: 'bold',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#fbbf24',
    padding: '2px 5px',
    borderRadius: '4px'
  },
  actionButtonsRow: {
    display: 'flex',
    gap: '4px'
  },
  btnMiniAction: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '4px',
    fontSize: '11px',
    padding: '2px 6px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  colChat: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#070b12',
    borderRight: '1px solid #1e293b',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden'
  },
  chatWindowHeader: {
    padding: '12px 18px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  chatTargetName: {
    margin: 0,
    fontSize: '14px',
    color: '#ffffff'
  },
  chatTargetPhone: {
    fontSize: '11px',
    color: '#64748b'
  },
  tagStatusRight: {
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#881337',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  chatMessagesArea: {
    flex: 1,
    overflowY: 'scroll',
    minHeight: 0,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  msgBubble: {
    maxWidth: '65%',
    padding: '10px 14px',
    borderRadius: '8px',
    position: 'relative',
    color: '#fff'
  },
  msgTimeTag: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.6)',
    display: 'block',
    textAlign: 'right',
    marginTop: '4px'
  },
  chatInputBar: {
    padding: '12px 16px',
    backgroundColor: '#0f172a',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    gap: '10px',
    flexShrink: 0
  },
  inputMessage: {
    flex: 1,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none'
  },
  btnSend: {
    backgroundColor: '#881337',
    color: '#fff',
    border: 'none',
    padding: '0 20px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  colForm: {
    backgroundColor: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  },
  formHeader: {
    padding: '14px 18px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0
  },
  formTitle: {
    fontSize: '12px',
    color: '#ffffff',
    letterSpacing: '0.5px'
  },
  badgeAiReady: {
    fontSize: '10px',
    fontWeight: 'bold',
    backgroundColor: '#064e3b',
    color: '#34d399',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  btnTriggerAi: {
    width: '100%',
    backgroundColor: '#1e1b4b',
    color: '#a5b4fc',
    border: '1px solid #4338ca',
    padding: '9px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  formScroll: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  fieldItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#cbd5e1'
  },
  fieldInput: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none'
  },
  fieldSelect: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none'
  },
  fieldTextarea: {
    width: '100%',
    height: '60px',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none',
    resize: 'none'
  },
  twoCols: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '10px'
  },
  threeCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px'
  },
  btnActionQuote: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '6px'
  },
  tabEstadosLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    gap: '16px',
    minHeight: 0,
    overflow: 'hidden'
  },
  filterButtonGroup: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
    flexShrink: 0
  },
  filterBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  filterBtnActive: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #9f1239',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  estadosBodyGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '16px',
    minHeight: 0,
    overflow: 'hidden'
  },
  estadosColList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    backgroundColor: '#0b1120',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    minHeight: 0
  },
  estadoContactButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '6px',
    border: '1px solid #334155',
    cursor: 'pointer',
    width: '100%',
    transition: 'border 0.2s'
  },
  estadosColDetail: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    padding: '24px',
    overflowY: 'auto',
    minHeight: 0
  },
  cardDetailEstado: {
    maxWidth: '750px',
    margin: '0 auto'
  },
  cardDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  statusCurrentBox: {
    textAlign: 'right'
  },
  hr: {
    border: 'none',
    borderTop: '1px solid #1e293b',
    margin: '18px 0'
  },
  stateSelectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    marginTop: '8px'
  },
  stateBtnOption: {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  stateBtnSelected: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #f43f5e',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  summaryBox: {
    backgroundColor: '#0b1120',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    padding: '14px',
    marginBottom: '20px'
  }
};
EOFcat << 'EOF' > pages/index.js
import { useState, useEffect, useRef } from 'react';

export default function ModuloVentasCRM() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [inboxFilter, setInboxFilter] = useState('activos');
  const [loadingAi, setLoadingAi] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({});
  const [inputReply, setInputReply] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const chatBottomRef = useRef(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/whatsapp-webhook');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setConversations(data);
            if (!selectedId) {
              setSelectedId(String(data[0].id));
              setFormData(data[0].quoteData || {});
            }
          }
        }
      } catch (err) {
        console.error('Error al sincronizar CRM:', err);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selectedConv = conversations.find(
    (c) => String(c.id) === String(selectedId)
  ) || conversations[0] || { messages: [], quoteData: {}, botActive: true };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages]);

  const handleSelectConversation = (conv) => {
    setSelectedId(String(conv.id));
    setFormData(conv.quoteData || {});
  };

  const handleToggleBotIndividual = async () => {
    if (!selectedConv?.phone) return;
    const nextState = !(selectedConv.botActive !== false);

    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId) ? { ...c, botActive: nextState } : c
      )
    );

    try {
      await fetch('/api/whatsapp-webhook', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedConv.phone, botActive: nextState })
      });
    } catch (e) {
      console.error('Error toggle Sol:', e);
    }
  };

  const handleFormChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId) ? { ...c, quoteData: updated } : c
      )
    );
  };

  const handleStatusChange = (newStatus) => {
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId) ? { ...c, status: newStatus } : c
      )
    );
  };

  const handleTriggerSolAI = async () => {
    if (!selectedConv.messages || selectedConv.messages.length === 0) return;
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
        const mergedData = {
          ...formData,
          ...Object.fromEntries(
            Object.entries(data.extractedData).filter(([_, v]) => v !== null && v !== '')
          )
        };
        setFormData(mergedData);
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(selectedId) ? { ...c, quoteData: mergedData } : c
          )
        );
      }

      if (data.replyMessage) {
        setInputReply(data.replyMessage);
      }

      if (data.suggestedStatus) {
        handleStatusChange(data.suggestedStatus);
      }
    } catch (err) {
      console.error(err);
      alert('Detalle del error: ' + err.message);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleToggleArchive = (id, e) => {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(id) ? { ...c, archived: !c.archived } : c
      )
    );
  };

  const handleDeleteConversation = (id, e) => {
    e.stopPropagation();
    if (confirm('¿Eliminar esta conversación del CRM?')) {
      const remaining = conversations.filter((c) => String(c.id) !== String(id));
      setConversations(remaining);
      if (String(selectedId) === String(id) && remaining.length > 0) {
        setSelectedId(String(remaining[0].id));
        setFormData(remaining[0].quoteData || {});
      }
    }
  };

  const handleRenameConversation = (id, currentName, e) => {
    e.stopPropagation();
    const newName = prompt('Ingrese el nuevo nombre para este contacto:', currentName);
    if (newName && newName.trim()) {
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(id)
            ? { ...c, name: newName.trim(), quoteData: { ...c.quoteData, clientName: newName.trim() } }
            : c
        )
      );
      if (String(selectedId) === String(id)) {
        setFormData((prev) => ({ ...prev, clientName: newName.trim() }));
      }
    }
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!inputReply.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: 'me',
      text: inputReply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId)
          ? { ...c, lastMessage: inputReply, messages: [...(c.messages || []), newMsg] }
          : c
      )
    );
    setInputReply('');
  };

  const estadosDisponibles = [
    'Nuevo Lead',
    'Cotización Pendiente',
    'Cotizado',
    'Esperando Pago',
    'Carga en Tránsito',
    'Cerrado'
  ];

  const displayedConversations = conversations.filter((c) =>
    inboxFilter === 'activos' ? !c.archived : c.archived
  );

  const filteredByStatus =
    statusFilter === 'TODOS'
      ? conversations
      : conversations.filter((c) => c.status === statusFilter);

  const isSolActiveInCurrent = selectedConv?.botActive !== false;

  return (
    <div style={styles.container}>
      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: #0f172a;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: #881337;
        }
      `}</style>

      <header style={styles.topBar}>
        <div style={styles.brandingBox}>
          <img src="/logo.png" alt="De China Al Mundo" style={styles.logoImg} />
          <div style={styles.dividerV} />
          <div>
            <h1 style={styles.systemTitle}>Módulo de Ventas & Operaciones Comex</h1>
            <span style={styles.systemSub}>Gestión de Leads, WhatsApp y Precotización</span>
          </div>
        </div>

        <nav style={styles.tabNav}>
          <button
            type="button"
            style={activeTab === 'inbox' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab('inbox')}
          >
            📥 Bandeja (3 Columnas)
          </button>
          <button
            type="button"
            style={activeTab === 'estados' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab('estados')}
          >
            📊 Estados
          </button>
        </nav>
      </header>

      {activeTab === 'inbox' && (
        <main style={styles.mainGrid}>
          <aside style={styles.colInbox}>
            <div style={styles.inboxHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={styles.inboxTitle}>Mensajes</span>
                <div style={styles.archiveToggleGroup}>
                  <button
                    type="button"
                    style={inboxFilter === 'activos' ? styles.btnFilterActive : styles.btnFilterInactive}
                    onClick={() => setInboxFilter('activos')}
                  >
                    Activos
                  </button>
                  <button
                    type="button"
                    style={inboxFilter === 'archivados' ? styles.btnFilterActive : styles.btnFilterInactive}
                    onClick={() => setInboxFilter('archivados')}
                  >
                    Archivados
                  </button>
                </div>
              </div>
            </div>

            <div className="custom-scroll" style={styles.chatScrollList}>
              {displayedConversations.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  No hay conversaciones en esta sección.
                </div>
              )}
              {displayedConversations.map((conv) => {
                const isSelected = String(conv.id) === String(selectedId);
                const isChatBotActive = conv.botActive !== false;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    style={{
                      ...styles.chatItemCard,
                      backgroundColor: isSelected ? '#1e293b' : 'transparent',
                      borderLeft: isSelected ? '4px solid #881337' : '4px solid transparent'
                    }}
                  >
                    <div style={styles.chatAvatar}>
                      {(conv.name || 'C').charAt(0).toUpperCase()}
                    </div>

                    <div style={styles.chatContentBox}>
                      <div style={styles.chatTopLine}>
                        <strong style={styles.chatName}>
                          <span style={{ fontSize: '10px', marginRight: '4px' }}>
                            {isChatBotActive ? '🟢' : '🔴'}
                          </span>
                          {conv.name}
                        </strong>
                        <span style={styles.chatTime}>{conv.time}</span>
                      </div>
                      <div style={styles.chatPhone}>+{conv.phone}</div>
                      <p style={styles.chatSnippet}>{conv.lastMessage}</p>

                      <div style={styles.cardFooterActions}>
                        <span style={styles.badgeStatusMini}>{conv.status}</span>
                        <div style={styles.actionButtonsRow}>
                          <button
                            type="button"
                            title="Renombrar cliente"
                            style={styles.btnMiniAction}
                            onClick={(e) => handleRenameConversation(conv.id, conv.name, e)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            title={conv.archived ? 'Desarchivar' : 'Archivar conversación'}
                            style={styles.btnMiniAction}
                            onClick={(e) => handleToggleArchive(conv.id, e)}
                          >
                            {conv.archived ? '📤' : '📦'}
                          </button>
                          <button
                            type="button"
                            title="Borrar conversación"
                            style={{ ...styles.btnMiniAction, color: '#f87171' }}
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section style={styles.colChat}>
            <div style={styles.chatWindowHeader}>
              <div>
                <h3 style={styles.chatTargetName}>{selectedConv?.name || 'Seleccione un chat'}</h3>
                {selectedConv?.phone && <span style={styles.chatTargetPhone}>+{selectedConv.phone}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleToggleBotIndividual}
                  style={{
                    backgroundColor: isSolActiveInCurrent ? '#064e3b' : '#7f1d1d',
                    color: isSolActiveInCurrent ? '#34d399' : '#fca5a5',
                    border: `1px solid ${isSolActiveInCurrent ? '#059669' : '#b91c1c'}`,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {isSolActiveInCurrent ? '🤖 Sol Activa en este chat' : '⏸️ Sol Pausada (Atención Manual)'}
                </button>
                <div style={styles.tagStatusRight}>{selectedConv?.status || 'Lead'}</div>
              </div>
            </div>

            <div className="custom-scroll" style={styles.chatMessagesArea}>
              {(selectedConv?.messages || []).map((m) => (
                <div
                  key={m.id}
                  style={{
                    ...styles.msgBubble,
                    alignSelf: m.sender === 'me' ? 'flex-end' : 'flex-start',
                    backgroundColor: m.sender === 'me' ? '#881337' : '#1e293b'
                  }}
                >
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.4' }}>{m.text}</p>
                  <span style={styles.msgTimeTag}>{m.time}</span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendReply} style={styles.chatInputBar}>
              <input
                type="text"
                placeholder="Escribí una respuesta o usá la sugerencia de Sol..."
                value={inputReply}
                onChange={(e) => setInputReply(e.target.value)}
                style={styles.inputMessage}
              />
              <button type="submit" style={styles.btnSend}>
                Enviar
              </button>
            </form>
          </section>

          <aside style={styles.colForm}>
            <div style={styles.formHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={styles.formTitle}>DATOS DE COTIZACIÓN</strong>
                <span style={styles.badgeAiReady}>Motor Gemini Listo</span>
              </div>

              <button
                type="button"
                onClick={handleTriggerSolAI}
                disabled={loadingAi}
                style={{
                  ...styles.btnTriggerAi,
                  opacity: loadingAi ? 0.7 : 1,
                  cursor: loadingAi ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingAi ? '⏳ Sol está analizando el chat...' : '⚡ Sol: Autocompletar & Sugerir Cierre'}
              </button>
            </div>

            <div className="custom-scroll" style={styles.formScroll}>
              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>Cliente / Razón Social:</label>
                <input
                  type="text"
                  style={styles.fieldInput}
                  value={formData?.clientName || ''}
                  onChange={(e) => handleFormChange('clientName', e.target.value)}
                  placeholder="Ej: Distribuidora SRL"
                />
              </div>

              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>WhatsApp de Contacto:</label>
                <input
                  type="text"
                  style={styles.fieldInput}
                  value={formData?.phone || ''}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                  placeholder="Ej: 549351..."
                />
              </div>

              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>Producto / Mercadería:</label>
                <input
                  type="text"
                  style={styles.fieldInput}
                  value={formData?.product || ''}
                  onChange={(e) => handleFormChange('product', e.target.value)}
                  placeholder="Ej: Zapatillas deportivas"
                />
              </div>

              <div style={styles.twoCols}>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Posición Arancelaria (NCM):</label>
                  <input
                    type="text"
                    style={styles.fieldInput}
                    value={formData?.hscode || ''}
                    onChange={(e) => handleFormChange('hscode', e.target.value)}
                    placeholder="Ej: 6404.11.00"
                  />
                </div>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Incoterm:</label>
                  <select
                    style={styles.fieldSelect}
                    value={formData?.incoterm || 'FOB'}
                    onChange={(e) => handleFormChange('incoterm', e.target.value)}
                  >
                    <option value="EXW">EXW (Fábrica)</option>
                    <option value="FOB">FOB (Puerto)</option>
                    <option value="CIF">CIF (Destino)</option>
                    <option value="DDP">DDP (Nacionalizado)</option>
                  </select>
                </div>
              </div>

              <div style={styles.threeCols}>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>FOB (USD):</label>
                  <input
                    type="number"
                    style={styles.fieldInput}
                    value={formData?.goodsValue || ''}
                    onChange={(e) => handleFormChange('goodsValue', e.target.value)}
                    placeholder="4000"
                  />
                </div>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Peso (Kg):</label>
                  <input
                    type="number"
                    style={styles.fieldInput}
                    value={formData?.weightKg || ''}
                    onChange={(e) => handleFormChange('weightKg', e.target.value)}
                    placeholder="300"
                  />
                </div>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Volumen (m³):</label>
                  <input
                    type="number"
                    step="0.01"
                    style={styles.fieldInput}
                    value={formData?.cbm || ''}
                    onChange={(e) => handleFormChange('cbm', e.target.value)}
                    placeholder="1.5"
                  />
                </div>
              </div>

              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>Modalidad de Flete:</label>
                <select
                  style={styles.fieldSelect}
                  value={formData?.shippingMode || 'maritimo_compartido'}
                  onChange={(e) => handleFormChange('shippingMode', e.target.value)}
                >
                  <option value="maritimo_compartido">🚢 Carga Compartida Marítima (LCL)</option>
                  <option value="maritimo_cbm">📦 Carga Marítima por CBM</option>
                  <option value="courier_aereo">✈️ Courier Aéreo Express</option>
                  <option value="all_in_aereo">🚀 All In Aéreo</option>
                </select>
              </div>

              <div style={styles.fieldItem}>
                <label style={styles.fieldLabel}>Notas Operativas / Resumen:</label>
                <textarea
                  style={styles.fieldTextarea}
                  value={formData?.notes || ''}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Detalles de la carga."
                />
              </div>

              <button
                type="button"
                style={styles.btnActionQuote}
                onClick={() => alert('Ficha guardada.')}
              >
                💾 Guardar Ficha
              </button>
            </div>
          </aside>
        </main>
      )}

      {activeTab === 'estados' && (
        <section style={styles.tabEstadosLayout}>
          <div style={styles.filterButtonGroup}>
            <button
              type="button"
              style={statusFilter === 'TODOS' ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setStatusFilter('TODOS')}
            >
              Todos ({conversations.length})
            </button>
            {estadosDisponibles.map((st) => (
              <button
                key={st}
                type="button"
                style={statusFilter === st ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setStatusFilter(st)}
              >
                {st} ({conversations.filter((c) => c.status === st).length})
              </button>
            ))}
          </div>

          <div style={styles.estadosBodyGrid}>
            <div className="custom-scroll" style={styles.estadosColList}>
              {filteredByStatus.map((conv) => {
                const isSelected = String(conv.id) === String(selectedId);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv)}
                    style={{
                      ...styles.estadoContactButton,
                      backgroundColor: isSelected ? '#1e293b' : '#0f172a',
                      borderColor: isSelected ? '#881337' : '#334155'
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '13px' }}>
                        {conv.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>+{conv.phone}</span>
                    </div>
                    <span style={styles.badgeStatusMini}>{conv.status}</span>
                  </button>
                );
              })}
            </div>

            <div className="custom-scroll" style={styles.estadosColDetail}>
              <div style={styles.cardDetailEstado}>
                <div style={styles.cardDetailHeader}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                      {selectedConv.name}
                    </h2>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      WhatsApp: +{selectedConv.phone} | Último contacto: {selectedConv.time}
                    </span>
                  </div>
                  <div style={styles.statusCurrentBox}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Estado Actual:</span>
                    <strong style={{ color: '#fbbf24', fontSize: '14px', display: 'block' }}>
                      {selectedConv.status}
                    </strong>
                  </div>
                </div>

                <hr style={styles.hr} />

                <div style={{ marginBottom: '20px' }}>
                  <label style={styles.fieldLabel}>Cambiar Estado con un Clic:</label>
                  <div style={styles.stateSelectorGrid}>
                    {estadosDisponibles.map((estado) => (
                      <button
                        key={estado}
                        type="button"
                        onClick={() => handleStatusChange(estado)}
                        style={
                          selectedConv.status === estado
                            ? styles.stateBtnSelected
                            : styles.stateBtnOption
                        }
                      >
                        {selectedConv.status === estado ? '✓ ' : ''}
                        {estado}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.summaryBox}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#cbd5e1' }}>
                    ÚLTIMO MENSAJE REGISTRADO:
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#f1f5f9', fontStyle: 'italic' }}>
                    "{selectedConv.lastMessage}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#090d16',
    color: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden'
  },
  topBar: {
    height: '65px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    flexShrink: 0
  },
  brandingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  logoImg: {
    height: '38px',
    objectFit: 'contain'
  },
  dividerV: {
    width: '1.5px',
    height: '30px',
    backgroundColor: '#334155'
  },
  systemTitle: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0,
    letterSpacing: '0.3px'
  },
  systemSub: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  tabNav: {
    display: 'flex',
    gap: '8px'
  },
  tabBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  tabBtnActive: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #9f1239',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  mainGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '340px 1fr 390px',
    minHeight: 0,
    overflow: 'hidden'
  },
  colInbox: {
    borderRight: '1px solid #1e293b',
    backgroundColor: '#0b1120',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  inboxHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#0f172a',
    flexShrink: 0
  },
  inboxTitle: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  archiveToggleGroup: {
    display: 'flex',
    gap: '4px'
  },
  btnFilterActive: {
    backgroundColor: '#881337',
    color: '#fff',
    border: 'none',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  btnFilterInactive: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: 'none',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    cursor: 'pointer'
  },
  chatScrollList: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  chatItemCard: {
    display: 'flex',
    gap: '10px',
    padding: '12px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid #1e293b',
    transition: 'background 0.2s'
  },
  chatAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#881337',
    color: '#fff',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  chatContentBox: {
    flex: 1,
    minWidth: 0
  },
  chatTopLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline'
  },
  chatName: {
    fontSize: '13px',
    color: '#f8fafc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  chatTime: {
    fontSize: '10px',
    color: '#64748b'
  },
  chatPhone: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '2px'
  },
  chatSnippet: {
    margin: 0,
    fontSize: '11.5px',
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  cardFooterActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px'
  },
  badgeStatusMini: {
    fontSize: '9.5px',
    fontWeight: 'bold',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#fbbf24',
    padding: '2px 5px',
    borderRadius: '4px'
  },
  actionButtonsRow: {
    display: 'flex',
    gap: '4px'
  },
  btnMiniAction: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '4px',
    fontSize: '11px',
    padding: '2px 6px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  colChat: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#070b12',
    borderRight: '1px solid #1e293b',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden'
  },
  chatWindowHeader: {
    padding: '12px 18px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  chatTargetName: {
    margin: 0,
    fontSize: '14px',
    color: '#ffffff'
  },
  chatTargetPhone: {
    fontSize: '11px',
    color: '#64748b'
  },
  tagStatusRight: {
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#881337',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  chatMessagesArea: {
    flex: 1,
    overflowY: 'scroll',
    minHeight: 0,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  msgBubble: {
    maxWidth: '65%',
    padding: '10px 14px',
    borderRadius: '8px',
    position: 'relative',
    color: '#fff'
  },
  msgTimeTag: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.6)',
    display: 'block',
    textAlign: 'right',
    marginTop: '4px'
  },
  chatInputBar: {
    padding: '12px 16px',
    backgroundColor: '#0f172a',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    gap: '10px',
    flexShrink: 0
  },
  inputMessage: {
    flex: 1,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none'
  },
  btnSend: {
    backgroundColor: '#881337',
    color: '#fff',
    border: 'none',
    padding: '0 20px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  colForm: {
    backgroundColor: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  },
  formHeader: {
    padding: '14px 18px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0
  },
  formTitle: {
    fontSize: '12px',
    color: '#ffffff',
    letterSpacing: '0.5px'
  },
  badgeAiReady: {
    fontSize: '10px',
    fontWeight: 'bold',
    backgroundColor: '#064e3b',
    color: '#34d399',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  btnTriggerAi: {
    width: '100%',
    backgroundColor: '#1e1b4b',
    color: '#a5b4fc',
    border: '1px solid #4338ca',
    padding: '9px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  formScroll: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  fieldItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#cbd5e1'
  },
  fieldInput: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none'
  },
  fieldSelect: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none'
  },
  fieldTextarea: {
    width: '100%',
    height: '60px',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none',
    resize: 'none'
  },
  twoCols: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '10px'
  },
  threeCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px'
  },
  btnActionQuote: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '6px'
  },
  tabEstadosLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    gap: '16px',
    minHeight: 0,
    overflow: 'hidden'
  },
  filterButtonGroup: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
    flexShrink: 0
  },
  filterBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  filterBtnActive: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #9f1239',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  estadosBodyGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '16px',
    minHeight: 0,
    overflow: 'hidden'
  },
  estadosColList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    backgroundColor: '#0b1120',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    minHeight: 0
  },
  estadoContactButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '6px',
    border: '1px solid #334155',
    cursor: 'pointer',
    width: '100%',
    transition: 'border 0.2s'
  },
  estadosColDetail: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    padding: '24px',
    overflowY: 'auto',
    minHeight: 0
  },
  cardDetailEstado: {
    maxWidth: '750px',
    margin: '0 auto'
  },
  cardDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  statusCurrentBox: {
    textAlign: 'right'
  },
  hr: {
    border: 'none',
    borderTop: '1px solid #1e293b',
    margin: '18px 0'
  },
  stateSelectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    marginTop: '8px'
  },
  stateBtnOption: {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  stateBtnSelected: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #f43f5e',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  summaryBox: {
    backgroundColor: '#0b1120',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    padding: '14px',
    marginBottom: '20px'
  }
};
