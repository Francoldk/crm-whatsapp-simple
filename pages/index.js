import { useState, useEffect, useRef } from 'react';

export default function ModuloVentasCRM() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [mobileTab, setMobileTab] = useState('chats');
  const [inboxFilter, setInboxFilter] = useState('activos');
  const [loadingAi, setLoadingAi] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({});
  const [inputReply, setInputReply] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [isMobile, setIsMobile] = useState(false);

  const chatBottomRef = useRef(null);
  const chatAreaRef = useRef(null);
  const isUserScrollingRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sincronización continua sin pisar datos locales
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
            } else {
              // Si el usuario tiene una conversación activa, enriquecer la ficha sin pisarla con vacíos
              const current = data.find((c) => String(c.id) === String(selectedId));
              if (current?.quoteData && Object.keys(current.quoteData).length > 0) {
                setFormData((prev) => ({
                  ...current.quoteData,
                  ...prev
                }));
              }
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
    if (!isUserScrollingRef.current) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConv?.messages?.length, mobileTab]);

  const handleScrollChat = () => {
    if (!chatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isUserScrollingRef.current = distanceFromBottom > 120;
  };

  const handleSelectConversation = (conv) => {
    isUserScrollingRef.current = false;
    setSelectedId(String(conv.id));
    setFormData(conv.quoteData || {});
    if (isMobile) setMobileTab('chat_activo');
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 60);
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

  // Guardado manual con feedback real y confirmación
  const handleSaveFormDataManual = async () => {
    if (!selectedConv?.phone) return;
    try {
      const res = await fetch('/api/whatsapp-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedConv.phone,
          extractedData: formData
        })
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(selectedId) ? { ...c, quoteData: formData } : c
          )
        );
        alert('✅ Ficha guardada con éxito en el CRM');
      }
    } catch (err) {
      alert('Error al guardar ficha: ' + err.message);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId) ? { ...c, status: newStatus } : c
      )
    );
    if (selectedConv?.phone) {
      try {
        await fetch('/api/whatsapp-webhook', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: selectedConv.phone, status: newStatus })
        });
      } catch (_) {}
    }
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
            String(c.id) === String(selectedId)
              ? {
                  ...c,
                  quoteData: mergedData,
                  status: data.suggestedStatus || c.status
                }
              : c
          )
        );

        if (selectedConv?.phone) {
          await fetch('/api/whatsapp-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: selectedConv.phone,
              extractedData: mergedData,
              status: data.suggestedStatus || selectedConv.status
            })
          });
        }
      }

      if (data.replyMessage) {
        setInputReply(data.replyMessage);
      }

      if (data.suggestedStatus) {
        handleStatusChange(data.suggestedStatus);
      }
    } catch (err) {
      console.error(err);
      alert('Detalle: ' + err.message);
    } finally {
      setLoadingAi(false);
    }
  };

  // Envío manual universal: envía a WhatsApp y preserva quoteData intacto
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!inputReply.trim() || !selectedConv?.phone) return;

    const messageText = inputReply.trim();
    setInputReply('');
    isUserScrollingRef.current = false;

    const newMsg = {
      id: Date.now(),
      sender: 'me',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Actualización inmediata en pantalla sin perder quoteData
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(selectedId)
          ? {
              ...c,
              lastMessage: messageText,
              messages: [...(c.messages || []), newMsg],
              quoteData: formData // Mantiene la ficha
            }
          : c
      )
    );

    // 1. Enviar a bot.js si corre localmente
    fetch('http://localhost:3001/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: selectedConv.phone,
        message: messageText
      })
    }).catch(() => {});

    // 2. Guardar en el Webhook pasando la ficha actual para no resetearla
    try {
      await fetch('/api/whatsapp-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedConv.phone,
          text: messageText,
          sender: 'me',
          extractedData: formData // Mantiene intacta la ficha
        })
      });
    } catch (err) {
      console.error('Error registrando respuesta:', err);
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
    if (confirm('¿Eliminar conversación?')) {
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
    const newName = prompt('Nuevo nombre:', currentName);
    if (newName && newName.trim()) {
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(id)
            ? { ...c, name: newName.trim(), quoteData: { ...c.quoteData, clientName: newName.trim() } }
            : c
        )
      );
    }
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
      <header style={styles.topBar}>
        <div style={styles.brandingBox}>
          <img src="/logo.png" alt="DCAM" style={styles.logoImg} />
          {!isMobile && (
            <>
              <div style={styles.dividerV} />
              <div>
                <h1 style={styles.systemTitle}>Módulo de Ventas & Operaciones</h1>
                <span style={styles.systemSub}>De China al Mundo</span>
              </div>
            </>
          )}
        </div>

        <nav style={styles.tabNav}>
          <button
            type="button"
            style={activeTab === 'inbox' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab('inbox')}
          >
            📥 Inbox
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

      {isMobile && activeTab === 'inbox' && (
        <div style={styles.mobileSubNav}>
          <button
            type="button"
            style={mobileTab === 'chats' ? styles.mobileTabBtnActive : styles.mobileTabBtn}
            onClick={() => setMobileTab('chats')}
          >
            💬 Contactos ({displayedConversations.length})
          </button>
          <button
            type="button"
            style={mobileTab === 'chat_activo' ? styles.mobileTabBtnActive : styles.mobileTabBtn}
            onClick={() => setMobileTab('chat_activo')}
          >
            📱 Chat: {selectedConv?.name ? selectedConv.name.slice(0, 12) : 'Sin chat'}
          </button>
          <button
            type="button"
            style={mobileTab === 'ficha' ? styles.mobileTabBtnActive : styles.mobileTabBtn}
            onClick={() => setMobileTab('ficha')}
          >
            📝 Ficha / Cotizar
          </button>
        </div>
      )}

      {activeTab === 'inbox' && (
        <main
          style={{
            ...styles.mainGrid,
            gridTemplateColumns: isMobile ? '1fr' : '340px 1fr 400px'
          }}
        >
          {/* BANDEJA DE CONTACTOS */}
          {(!isMobile || mobileTab === 'chats') && (
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

              <div style={styles.chatScrollList}>
                {displayedConversations.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    No hay conversaciones.
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
                        backgroundColor: isSelected && !isMobile ? '#1e293b' : 'transparent',
                        borderLeft: isSelected && !isMobile ? '4px solid #881337' : '4px solid transparent'
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
                        <div style={{ marginTop: '4px' }}>
                          <span style={styles.badgeStatusMini}>{conv.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* CHAT ACTIVO */}
          {(!isMobile || mobileTab === 'chat_activo') && (
            <section style={styles.colChat}>
              <div style={styles.chatWindowHeader}>
                <div>
                  <h3 style={styles.chatTargetName}>{selectedConv?.name || 'Seleccione conversación'}</h3>
                  {selectedConv?.phone && <span style={styles.chatTargetPhone}>+{selectedConv.phone}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleToggleBotIndividual}
                    style={{
                      backgroundColor: isSolActiveInCurrent ? '#064e3b' : '#7f1d1d',
                      color: isSolActiveInCurrent ? '#34d399' : '#fca5a5',
                      border: `1px solid ${isSolActiveInCurrent ? '#059669' : '#b91c1c'}`,
                      padding: '5px 8px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {isSolActiveInCurrent ? '🤖 Sol Activa' : '⏸️ Sol Pausa'}
                  </button>
                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => setMobileTab('ficha')}
                      style={{
                        backgroundColor: '#881337',
                        color: '#fff',
                        border: 'none',
                        padding: '5px 8px',
                        borderRadius: '5px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      📝 Ficha
                    </button>
                  )}
                </div>
              </div>

              <div
                ref={chatAreaRef}
                onScroll={handleScrollChat}
                style={styles.chatMessagesArea}
              >
                {(selectedConv?.messages || []).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      ...styles.msgBubble,
                      maxWidth: isMobile ? '85%' : '65%',
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
                  placeholder="Escribí un mensaje manual..."
                  value={inputReply}
                  onChange={(e) => setInputReply(e.target.value)}
                  style={styles.inputMessage}
                />
                <button type="submit" style={styles.btnSend}>
                  Enviar
                </button>
              </form>
            </section>
          )}

          {/* FICHA TÉCNICA */}
          {(!isMobile || mobileTab === 'ficha') && (
            <aside style={styles.colForm}>
              <div style={styles.formHeader}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={styles.formTitle}>FICHA DE COTIZACIÓN (OPERACIONES)</strong>
                  <span style={styles.badgeAiReady}>VUCE Listo</span>
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
                  {loadingAi ? '⏳ Sol calculando...' : '⚡ Sol: Autocompletar Ficha & Cotizar'}
                </button>
              </div>

              <div style={styles.formScroll}>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Cliente / Razón Social:</label>
                  <input
                    type="text"
                    style={styles.fieldInput}
                    value={formData?.clientName || ''}
                    onChange={(e) => handleFormChange('clientName', e.target.value)}
                    placeholder="Nombre"
                  />
                </div>

                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Producto / Mercadería:</label>
                  <input
                    type="text"
                    style={styles.fieldInput}
                    value={formData?.product || ''}
                    onChange={(e) => handleFormChange('product', e.target.value)}
                    placeholder="Descripción"
                  />
                </div>

                <div style={styles.twoCols}>
                  <div style={styles.fieldItem}>
                    <label style={styles.fieldLabel}>Posición Arancelaria (VUCE):</label>
                    <input
                      type="text"
                      style={{ ...styles.fieldInput, border: '1px solid #059669', color: '#34d399', fontWeight: 'bold' }}
                      value={formData?.hscode || ''}
                      onChange={(e) => handleFormChange('hscode', e.target.value)}
                      placeholder="Ej: 8418.69.10"
                    />
                  </div>
                  <div style={styles.fieldItem}>
                    <label style={styles.fieldLabel}>Incoterm:</label>
                    <select
                      style={styles.fieldSelect}
                      value={formData?.incoterm || 'FOB'}
                      onChange={(e) => handleFormChange('incoterm', e.target.value)}
                    >
                      <option value="EXW">EXW</option>
                      <option value="FOB">FOB</option>
                      <option value="CIF">CIF</option>
                    </select>
                  </div>
                </div>

                <div style={styles.threeCols}>
                  <div style={styles.fieldItem}>
                    <label style={styles.fieldLabel}>FOB USD:</label>
                    <input
                      type="number"
                      style={styles.fieldInput}
                      value={formData?.goodsValue || ''}
                      onChange={(e) => handleFormChange('goodsValue', e.target.value)}
                      placeholder="USD"
                    />
                  </div>
                  <div style={styles.fieldItem}>
                    <label style={styles.fieldLabel}>Kilos:</label>
                    <input
                      type="number"
                      style={styles.fieldInput}
                      value={formData?.weightKg || ''}
                      onChange={(e) => handleFormChange('weightKg', e.target.value)}
                      placeholder="Kg"
                    />
                  </div>
                  <div style={styles.fieldItem}>
                    <label style={styles.fieldLabel}>CBM (m³):</label>
                    <input
                      type="number"
                      step="0.01"
                      style={styles.fieldInput}
                      value={formData?.cbm || ''}
                      onChange={(e) => handleFormChange('cbm', e.target.value)}
                      placeholder="m³"
                    />
                  </div>
                </div>

                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Modalidad de Flete:</label>
                  <select
                    style={styles.fieldSelect}
                    value={formData?.shippingMode || 'grupo_maritimo'}
                    onChange={(e) => handleFormChange('shippingMode', e.target.value)}
                  >
                    <option value="grupo_maritimo">🚢 Marítimo en Grupo (5 USD/kg si &lt; 1 CBM)</option>
                    <option value="maritimo_cbm_menos5">📦 Carga Marítima (&lt; 5 m³: 450 USD/CBM)</option>
                    <option value="maritimo_cbm_mas5">📦 Carga Marítima (&gt;= 5 m³: 350 USD/CBM)</option>
                    <option value="aereo_hasta30">✈️ Aéreo (hasta 30 kg: 20 USD/kg)</option>
                    <option value="aereo_mas30">✈️ Aéreo (desde 30 kg: 15 USD/kg)</option>
                  </select>
                </div>

                <div style={{ backgroundColor: '#0b1120', padding: '10px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                    DESGLOSE ESTIMADO DE LA COTIZACIÓN:
                  </span>
                  <div style={styles.threeCols}>
                    <div style={styles.fieldItem}>
                      <label style={{ fontSize: '9.5px', color: '#cbd5e1' }}>Flete USD:</label>
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={formData?.freightUSD || ''}
                        onChange={(e) => handleFormChange('freightUSD', e.target.value)}
                      />
                    </div>
                    <div style={styles.fieldItem}>
                      <label style={{ fontSize: '9.5px', color: '#cbd5e1' }}>Seguro (3%):</label>
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={formData?.insuranceUSD || ''}
                        onChange={(e) => handleFormChange('insuranceUSD', e.target.value)}
                      />
                    </div>
                    <div style={styles.fieldItem}>
                      <label style={{ fontSize: '9.5px', color: '#cbd5e1' }}>Aranceles (DI/TE):</label>
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={formData?.dutiesUSD || ''}
                        onChange={(e) => handleFormChange('dutiesUSD', e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ ...styles.twoCols, marginTop: '6px' }}>
                    <div style={styles.fieldItem}>
                      <label style={{ fontSize: '9.5px', color: '#cbd5e1' }}>Impuestos (IVA/IIBB):</label>
                      <input
                        type="number"
                        style={styles.fieldInput}
                        value={formData?.taxesUSD || ''}
                        onChange={(e) => handleFormChange('taxesUSD', e.target.value)}
                      />
                    </div>
                    <div style={styles.fieldItem}>
                      <label style={{ fontSize: '9.5px', color: '#fbbf24', fontWeight: 'bold' }}>TOTAL LOGÍSTICA USD:</label>
                      <input
                        type="number"
                        style={{ ...styles.fieldInput, borderColor: '#f59e0b', color: '#fbbf24', fontWeight: 'bold' }}
                        value={formData?.totalLogisticsUSD || ''}
                        onChange={(e) => handleFormChange('totalLogisticsUSD', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Notas Operativas:</label>
                  <textarea
                    style={styles.fieldTextarea}
                    value={formData?.notes || ''}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Detalles..."
                  />
                </div>

                <button
                  type="button"
                  style={styles.btnActionQuote}
                  onClick={handleSaveFormDataManual}
                >
                  💾 Guardar Ficha
                </button>
              </div>
            </aside>
          )}
        </main>
      )}

      {/* PESTAÑA ESTADOS */}
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

          <div
            style={{
              ...styles.estadosBodyGrid,
              gridTemplateColumns: isMobile ? '1fr' : '320px 1fr'
            }}
          >
            <div style={styles.estadosColList}>
              {filteredByStatus.map((conv) => {
                const isSelected = String(conv.id) === String(selectedId);
                const q = conv.quoteData || {};
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
                    <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>+{conv.phone}</span>
                      {q.product && (
                        <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>
                          📦 {q.product}
                        </div>
                      )}
                    </div>
                    <span style={styles.badgeStatusMini}>{conv.status}</span>
                  </button>
                );
              })}
            </div>

            {(!isMobile || selectedId) && (
              <div style={styles.estadosColDetail}>
                <div style={styles.cardDetailEstado}>
                  <div style={styles.cardDetailHeader}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                        {selectedConv.name}
                      </h2>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        WhatsApp: +{selectedConv.phone}
                      </span>
                    </div>
                    <div style={styles.statusCurrentBox}>
                      <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Estado:</span>
                      <strong style={{ color: '#fbbf24', fontSize: '14px', display: 'block' }}>
                        {selectedConv.status}
                      </strong>
                    </div>
                  </div>

                  <hr style={styles.hr} />

                  <div style={{ backgroundColor: '#0b1120', border: '1px solid #334155', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#38bdf8', textTransform: 'uppercase' }}>
                      📋 Resumen de Carga & Cotización
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block' }}>Producto / Mercadería:</span>
                        <strong style={{ color: '#fff' }}>{selectedConv.quoteData?.product || 'A definir'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block' }}>PA (VUCE):</span>
                        <strong style={{ color: '#34d399' }}>{selectedConv.quoteData?.hscode || 'Sin PA'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block' }}>Peso / Medidas:</span>
                        <strong style={{ color: '#fff' }}>
                          {selectedConv.quoteData?.weightKg ? `${selectedConv.quoteData.weightKg} kg` : '-'} | {selectedConv.quoteData?.cbm ? `${selectedConv.quoteData.cbm} m³` : '-'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block' }}>FOB Declarado:</span>
                        <strong style={{ color: '#fff' }}>
                          {selectedConv.quoteData?.goodsValue ? `USD ${selectedConv.quoteData.goodsValue}` : '-'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block' }}>Modalidad Ofrecida:</span>
                        <strong style={{ color: '#fff' }}>{selectedConv.quoteData?.shippingMode || 'Marítimo'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#fbbf24', display: 'block' }}>TOTAL Cotizado:</span>
                        <strong style={{ color: '#fbbf24', fontSize: '14px' }}>
                          {selectedConv.quoteData?.totalLogisticsUSD ? `USD ${selectedConv.quoteData.totalLogisticsUSD}` : 'Sin cotizar'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={styles.fieldLabel}>Cambiar Estado:</label>
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
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#cbd5e1' }}>
                      ÚLTIMO MENSAJE REGISTRADO:
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#f1f5f9', fontStyle: 'italic' }}>
                      "{selectedConv.lastMessage}"
                    </p>
                  </div>
                </div>
              </div>
            )}
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
    height: '56px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 14px',
    flexShrink: 0
  },
  brandingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logoImg: {
    height: '32px',
    objectFit: 'contain'
  },
  dividerV: {
    width: '1.5px',
    height: '24px',
    backgroundColor: '#334155'
  },
  systemTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0
  },
  systemSub: {
    fontSize: '10px',
    color: '#94a3b8'
  },
  tabNav: {
    display: 'flex',
    gap: '6px'
  },
  tabBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  tabBtnActive: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #9f1239',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  mobileSubNav: {
    display: 'flex',
    backgroundColor: '#0b1120',
    borderBottom: '1px solid #1e293b',
    padding: '4px',
    gap: '4px',
    flexShrink: 0
  },
  mobileTabBtn: {
    flex: 1,
    padding: '8px 4px',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: 'none',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  mobileTabBtnActive: {
    flex: 1,
    padding: '8px 4px',
    backgroundColor: '#881337',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  mainGrid: {
    flex: 1,
    display: 'grid',
    minHeight: 0,
    overflow: 'hidden'
  },
  colInbox: {
    borderRight: '1px solid #1e293b',
    backgroundColor: '#0b1120',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%'
  },
  inboxHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#0f172a',
    flexShrink: 0
  },
  inboxTitle: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase'
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
    borderBottom: '1px solid #1e293b'
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
  badgeStatusMini: {
    fontSize: '9.5px',
    fontWeight: 'bold',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#fbbf24',
    padding: '2px 5px',
    borderRadius: '4px'
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
    padding: '10px 14px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  chatTargetName: {
    margin: 0,
    fontSize: '13px',
    color: '#ffffff'
  },
  chatTargetPhone: {
    fontSize: '11px',
    color: '#64748b'
  },
  chatMessagesArea: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  msgBubble: {
    padding: '8px 12px',
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
    padding: '10px 14px',
    backgroundColor: '#0f172a',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    gap: '8px',
    flexShrink: 0
  },
  inputMessage: {
    flex: 1,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none'
  },
  btnSend: {
    backgroundColor: '#881337',
    color: '#fff',
    border: 'none',
    padding: '0 16px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  colForm: {
    backgroundColor: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    overflow: 'hidden'
  },
  formHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0
  },
  formTitle: {
    fontSize: '11px',
    color: '#ffffff'
  },
  badgeAiReady: {
    fontSize: '9.5px',
    fontWeight: 'bold',
    backgroundColor: '#064e3b',
    color: '#34d399',
    padding: '2px 5px',
    borderRadius: '4px'
  },
  btnTriggerAi: {
    width: '100%',
    backgroundColor: '#1e1b4b',
    color: '#a5b4fc',
    border: '1px solid #4338ca',
    padding: '8px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    textAlign: 'center'
  },
  formScroll: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  fieldItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  },
  fieldLabel: {
    fontSize: '10.5px',
    fontWeight: 'bold',
    color: '#cbd5e1'
  },
  fieldInput: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '7px 9px',
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
    padding: '7px 9px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none'
  },
  fieldTextarea: {
    width: '100%',
    height: '45px',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '7px 9px',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none',
    resize: 'none'
  },
  twoCols: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  threeCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px'
  },
  btnActionQuote: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: 'none',
    padding: '10px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    marginTop: '4px'
  },
  tabEstadosLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '14px',
    gap: '12px',
    minHeight: 0,
    overflow: 'hidden'
  },
  filterButtonGroup: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
    paddingBottom: '4px',
    flexShrink: 0
  },
  filterBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  filterBtnActive: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #9f1239',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  estadosBodyGrid: {
    flex: 1,
    display: 'grid',
    gap: '12px',
    minHeight: 0,
    overflow: 'hidden'
  },
  estadosColList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    overflowY: 'auto',
    backgroundColor: '#0b1120',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    minHeight: 0
  },
  estadoContactButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #334155',
    cursor: 'pointer',
    width: '100%'
  },
  estadosColDetail: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    padding: '16px',
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
    margin: '14px 0'
  },
  stateSelectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '8px',
    marginTop: '6px'
  },
  stateBtnOption: {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    padding: '8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  stateBtnSelected: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #f43f5e',
    padding: '8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  summaryBox: {
    backgroundColor: '#0b1120',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '10px'
  }
};