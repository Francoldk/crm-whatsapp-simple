'use client';

import { useState } from 'react';

export default function ModuloVentasCRM() {
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'estados'

  // Lista mockeada de conversaciones activas
  const [conversations, setConversations] = useState([
    {
      id: 1,
      name: 'Distribuidora San Vicente',
      phone: '5493512345678',
      lastMessage: 'Hola Franco, me podés pasar el costo de 40 cubiertas puestas en Córdoba?',
      time: '11:20',
      status: 'Cotización Pendiente',
      quoteData: {
        clientName: 'Distribuidora San Vicente',
        phone: '5493512345678',
        product: 'Cubiertas / Neumáticos rodado 14',
        hscode: '4011.10.00',
        incoterm: 'FOB',
        goodsValue: '4200',
        weightKg: '380',
        cbm: '2.4',
        shippingMode: 'maritimo_compartido',
        notes: 'Cliente busca traer consolidado vía Santos o directo a Bs As.'
      },
      messages: [
        { id: 101, sender: 'client', text: 'Hola Franco, cómo estás?', time: '11:15' },
        { id: 102, sender: 'client', text: 'Me podés pasar el costo de 40 cubiertas puestas en Córdoba?', time: '11:20' }
      ]
    },
    {
      id: 2,
      name: 'Marcos Repuestos',
      phone: '5491145678901',
      lastMessage: 'Ariel me pasó tu contacto. Tengo 2 pallets listos en Ningbo.',
      time: 'Ayer',
      status: 'Nuevo Lead',
      quoteData: {
        clientName: 'Marcos Repuestos',
        phone: '5491145678901',
        product: 'Ópticas y faros de camión',
        hscode: '8512.20.10',
        incoterm: 'FOB',
        goodsValue: '1850',
        weightKg: '120',
        cbm: '1.1',
        shippingMode: 'maritimo_cbm',
        notes: 'Verificar si el proveedor entrega directo en nuestro galpón.'
      },
      messages: [
        { id: 201, sender: 'client', text: 'Ariel me pasó tu contacto. Tengo 2 pallets listos en Ningbo.', time: 'Ayer 18:40' }
      ]
    },
    {
      id: 3,
      name: 'TecnoGlobal S.A.S.',
      phone: '5493519876543',
      lastMessage: 'Impecable la cotización, ya coordinamos el pago del flete.',
      time: '02/09',
      status: 'Esperando Pago',
      quoteData: {
        clientName: 'TecnoGlobal S.A.S.',
        phone: '5493519876543',
        product: 'Módulos LCD y repuestos celulares',
        hscode: '8529.90.20',
        incoterm: 'EXW',
        goodsValue: '3100',
        weightKg: '25',
        cbm: '0.15',
        shippingMode: 'courier_aereo',
        notes: 'Urgente vía courier.'
      },
      messages: [
        { id: 301, sender: 'me', text: 'Te adjunto la proforma final con impuestos incluidos.', time: '02/09 09:10' },
        { id: 302, sender: 'client', text: 'Impecable la cotización, ya coordinamos el pago del flete.', time: '02/09 09:45' }
      ]
    }
  ]);

  const [selectedId, setSelectedId] = useState(1);
  const selectedConv = conversations.find((c) => c.id === selectedId) || conversations[0];

  // Estado del formulario de precotización vinculado a la conversación activa
  const [formData, setFormData] = useState(selectedConv?.quoteData);
  const [inputReply, setInputReply] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  // Al cambiar de conversación en el panel izquierdo
  const handleSelectConversation = (conv) => {
    setSelectedId(conv.id);
    setFormData(conv.quoteData);
  };

  // Actualizar campos del formulario
  const handleFormChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, quoteData: updated } : c))
    );
  };

  // Modificar estado manualmente
  const handleStatusChange = (newStatus) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, status: newStatus } : c))
    );
  };

  // Envío manual de respuesta
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
        c.id === selectedId
          ? { ...c, lastMessage: inputReply, messages: [...c.messages, newMsg] }
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

  const filteredConversations =
    statusFilter === 'TODOS'
      ? conversations
      : conversations.filter((c) => c.status === statusFilter);

  return (
    <div style={styles.container}>
      {/* BARRA SUPERIOR CORPORATIVA */}
      <header style={styles.topBar}>
        <div style={styles.brandingBox}>
          <img src="/logo.png" alt="De China Al Mundo" style={styles.logoImg} />
          <div style={styles.dividerV} />
          <div>
            <h1 style={styles.systemTitle}>Módulo de Ventas & Operaciones Comex</h1>
            <span style={styles.systemSub}>Gestión de Leads, WhatsApp y Precotización</span>
          </div>
        </div>

        {/* SELECTOR DE SOLAPAS / PESTAÑAS */}
        <nav style={styles.tabNav}>
          <button
            type="button"
            style={activeTab === 'inbox' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab('inbox')}
          >
            📥 Bandeja de Entrada (Chats & Cotización)
          </button>
          <button
            type="button"
            style={activeTab === 'estados' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setActiveTab('estados')}
          >
            📊 Estados de Conversaciones
          </button>
        </nav>
      </header>

      {/* =========================================================
          PESTAÑA 1: BANDEJA DE ENTRADA (ESTRUCTURA DE 3 COLUMNAS)
         ========================================================= */}
      {activeTab === 'inbox' && (
        <main style={styles.mainGrid}>
          {/* COLUMNA 1: LISTADO DE WHATSAPP CON VISTA PREVIA */}
          <aside style={styles.colInbox}>
            <div style={styles.inboxHeader}>
              <span style={styles.inboxTitle}>Mensajes Entrantes ({conversations.length})</span>
            </div>
            <div style={styles.chatScrollList}>
              {conversations.map((conv) => {
                const isSelected = conv.id === selectedId;
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
                      {conv.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.chatContentBox}>
                      <div style={styles.chatTopLine}>
                        <strong style={styles.chatName}>{conv.name}</strong>
                        <span style={styles.chatTime}>{conv.time}</span>
                      </div>
                      <div style={styles.chatPhone}>+{conv.phone}</div>
                      <p style={styles.chatSnippet}>{conv.lastMessage}</p>
                      <span style={styles.badgeStatusMini}>{conv.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* COLUMNA 2: VISOR DE CONVERSACIÓN ACTIVA */}
          <section style={styles.colChat}>
            <div style={styles.chatWindowHeader}>
              <div>
                <h3 style={styles.chatTargetName}>{selectedConv?.name}</h3>
                <span style={styles.chatTargetPhone}>+{selectedConv?.phone}</span>
              </div>
              <div style={styles.tagStatusRight}>{selectedConv?.status}</div>
            </div>

            {/* Burbujas de chat */}
            <div style={styles.chatMessagesArea}>
              {selectedConv?.messages.map((m) => (
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
            </div>

            {/* Input para responder manual */}
            <form onSubmit={handleSendReply} style={styles.chatInputBar}>
              <input
                type="text"
                placeholder="Escribí un mensaje..."
                value={inputReply}
                onChange={(e) => setInputReply(e.target.value)}
                style={styles.inputMessage}
              />
              <button type="submit" style={styles.btnSend}>
                Enviar
              </button>
            </form>
          </section>

          {/* COLUMNA 3: FORMULARIO DE AUTOCOMPLETADO / PRECOTIZACIÓN */}
          <aside style={styles.colForm}>
            <div style={styles.formHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={styles.formTitle}>DATOS DE COTIZACIÓN</strong>
                <span style={styles.badgeAiReady}>🤖 Autocompletado Listo</span>
              </div>
              <p style={styles.formSubtitle}>
                Completá manualmente o dejá que la IA procese la conversación.
              </p>
            </div>

            <div style={styles.formScroll}>
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
                <label style={styles.fieldLabel}>Producto / Mercadería Declarada:</label>
                <input
                  type="text"
                  style={styles.fieldInput}
                  value={formData?.product || ''}
                  onChange={(e) => handleFormChange('product', e.target.value)}
                  placeholder="Ej: Neumáticos rodado 14"
                />
              </div>

              <div style={styles.twoCols}>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Posición Arancelaria (NCM/PA):</label>
                  <input
                    type="text"
                    style={styles.fieldInput}
                    value={formData?.hscode || ''}
                    onChange={(e) => handleFormChange('hscode', e.target.value)}
                    placeholder="Ej: 4011.10.00"
                  />
                </div>
                <div style={styles.fieldItem}>
                  <label style={styles.fieldLabel}>Incoterm Pactado:</label>
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
                  <label style={styles.fieldLabel}>Valor FOB (USD):</label>
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
                <label style={styles.fieldLabel}>Modalidad de Flete Recomendada:</label>
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
                <label style={styles.fieldLabel}>Notas Operativas / Origen:</label>
                <textarea
                  style={styles.fieldTextarea}
                  value={formData?.notes || ''}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Detalles del proveedor chino, requerimientos de despacho, etc."
                />
              </div>

              <button
                type="button"
                style={styles.btnActionQuote}
                onClick={() => alert('Datos guardados y listos para exportar al Cotizador oficial.')}
              >
                💾 Guardar Ficha de Precotización
              </button>
            </div>
          </aside>
        </main>
      )}

      {/* =========================================================
          PESTAÑA 2: ESTADOS DE CONVERSACIONES (TABLERO Y BOTONES)
         ========================================================= */}
      {activeTab === 'estados' && (
        <section style={styles.tabEstadosLayout}>
          {/* BARRA SUPERIOR DE FILTROS POR ESTADO */}
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
            {/* LISTADO LATERAL DE CONTACTOS SEGÚN ESTADO */}
            <div style={styles.estadosColList}>
              {filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedId;
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

            {/* PANEL CENTRAL: DETALLES BÁSICOS Y CAMBIO MANUAL DE ESTADO */}
            <div style={styles.estadosColDetail}>
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

                {/* SELECTOR MANUAL DE NUEVO ESTADO */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={styles.fieldLabel}>Modificar Estado Manualmente:</label>
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

                {/* RESUMEN RÁPIDO DE LA CONVERSACIÓN */}
                <div style={styles.summaryBox}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#cbd5e1' }}>
                    ÚLTIMO MENSAJE REGISTRADO:
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#f1f5f9', fontStyle: 'italic' }}>
                    "{selectedConv.lastMessage}"
                  </p>
                </div>

                {/* SÍNTESIS BÁSICA DE LA CARGA */}
                <div style={styles.cargoSummaryGrid}>
                  <div style={styles.cargoSummaryItem}>
                    <span style={styles.cargoLabel}>PRODUCTO</span>
                    <strong style={styles.cargoVal}>{selectedConv.quoteData.product}</strong>
                  </div>
                  <div style={styles.cargoSummaryItem}>
                    <span style={styles.cargoLabel}>POSICIÓN ARANCELARIA</span>
                    <strong style={styles.cargoVal}>{selectedConv.quoteData.hscode}</strong>
                  </div>
                  <div style={styles.cargoSummaryItem}>
                    <span style={styles.cargoLabel}>MODALIDAD</span>
                    <strong style={styles.cargoVal}>{selectedConv.quoteData.shippingMode}</strong>
                  </div>
                  <div style={styles.cargoSummaryItem}>
                    <span style={styles.cargoLabel}>FOB DECLARADO</span>
                    <strong style={styles.cargoVal}>USD {selectedConv.quoteData.goodsValue}</strong>
                  </div>
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
    gridTemplateColumns: '320px 1fr 380px',
    overflow: 'hidden'
  },
  colInbox: {
    borderRight: '1px solid #1e293b',
    backgroundColor: '#0b1120',
    display: 'flex',
    flexDirection: 'column'
  },
  inboxHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#0f172a'
  },
  inboxTitle: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  chatScrollList: {
    flex: 1,
    overflowY: 'auto'
  },
  chatItemCard: {
    display: 'flex',
    gap: '12px',
    padding: '14px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #1e293b',
    transition: 'background 0.2s'
  },
  chatAvatar: {
    width: '38px',
    height: '38px',
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
    marginBottom: '3px'
  },
  chatSnippet: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  badgeStatusMini: {
    display: 'inline-block',
    marginTop: '6px',
    fontSize: '9.5px',
    fontWeight: 'bold',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#fbbf24',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  colChat: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#070b12',
    borderRight: '1px solid #1e293b'
  },
  chatWindowHeader: {
    padding: '12px 18px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    overflowY: 'auto',
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
    gap: '10px'
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
    overflow: 'hidden'
  },
  formHeader: {
    padding: '14px 18px',
    borderBottom: '1px solid #1e293b'
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
  formSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: '#64748b'
  },
  formScroll: {
    flex: 1,
    overflowY: 'auto',
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
    height: '65px',
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
    overflow: 'hidden'
  },
  filterButtonGroup: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px'
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
    border: '1px solid #1e293b'
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
    overflowY: 'auto'
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
  },
  cargoSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px'
  },
  cargoSummaryItem: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    padding: '12px',
    borderRadius: '6px'
  },
  cargoLabel: {
    display: 'block',
    fontSize: '9.5px',
    color: '#94a3b8',
    fontWeight: 'bold',
    marginBottom: '4px'
  },
  cargoVal: {
    fontSize: '13px',
    color: '#ffffff'
  }
};