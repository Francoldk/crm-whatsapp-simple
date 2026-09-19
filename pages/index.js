import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';

// ============================================================
// CONSTANTES Y UTILS
// ============================================================

const ESTADOS_DISPONIBLES = [
  'Nuevo Lead',
  'Cotización Pendiente',
  'Cotizado',
  'Esperando Pago',
  'Carga en Tránsito',
  'Cerrado',
];

const STATUS_COLORS = {
  'Nuevo Lead': { bg: '#1e3a8a', color: '#93c5fd', border: '#3b82f6' },
  'Cotización Pendiente': { bg: '#78350f', color: '#fcd34d', border: '#f59e0b' },
  'Cotizado': { bg: '#4c1d95', color: '#c4b5fd', border: '#8b5cf6' },
  'Esperando Pago': { bg: '#7c2d12', color: '#fdba74', border: '#f97316' },
  'Carga en Tránsito': { bg: '#164e63', color: '#67e8f9', border: '#06b6d4' },
  'Cerrado': { bg: '#14532d', color: '#86efac', border: '#22c55e' },
};

const now = () =>
  new Date().toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatPhone = (p) => (p ? `+${String(p).replace(/^\+/, '')}` : '');

const debounce = (fn, wait) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

// ============================================================
// HOOKS PERSONALIZADOS
// ============================================================

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handle = debounce(() => setIsMobile(window.innerWidth < breakpoint), 150);
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [breakpoint]);
  return isMobile;
}

// Hook de conversaciones con polling seguro + isDirty
function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const dirtyRef = useRef(false);
  const abortRef = useRef(null);

  const markDirty = useCallback((ms = 4000) => {
    dirtyRef.current = true;
    clearTimeout(markDirty._t);
    markDirty._t = setTimeout(() => {
      dirtyRef.current = false;
    }, ms);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (dirtyRef.current) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch('/api/conversations', { signal: ctrl.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setConversations(data);
      } catch (e) {
        if (e.name !== 'AbortError') console.error('polling error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    tick();
    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, []);

  const patchConversation = useCallback(
    async (id, payload, { optimistic = true } = {}) => {
      markDirty();
      if (optimistic) {
        setConversations((prev) =>
          prev.map((c) => (String(c.id) === String(id) ? { ...c, ...payload } : c))
        );
      }
      try {
        const res = await fetch('/api/conversations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...payload }),
        });
        if (!res.ok) throw new Error(`PATCH ${res.status}`);
        return true;
      } catch (err) {
        console.error('patch error:', err);
        return false;
      }
    },
    [markDirty]
  );

  return { conversations, setConversations, loading, patchConversation, markDirty };
}

// Hook de toasts simple
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'info', ttl = 3200) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);
  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return { toasts, push, remove };
}

// ============================================================
// COMPONENTES UI ATÓMICOS
// ============================================================

const Toast = memo(function Toast({ toast, onClose }) {
  const colorMap = {
    success: { bg: 'rgba(20,83,45,0.95)', border: '#22c55e', color: '#86efac' },
    error: { bg: 'rgba(127,29,29,0.95)', border: '#ef4444', color: '#fca5a5' },
    info: { bg: 'rgba(30,58,138,0.95)', border: '#3b82f6', color: '#93c5fd' },
    warning: { bg: 'rgba(120,53,15,0.95)', border: '#f59e0b', color: '#fcd34d' },
  };
  const c = colorMap[toast.type] || colorMap.info;
  return (
    <div
      onClick={() => onClose(toast.id)}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        padding: '11px 16px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        cursor: 'pointer',
        animation: 'slideInRight 0.25s ease-out',
        maxWidth: '340px',
        marginBottom: '10px',
      }}
    >
      {toast.message}
    </div>
  );
});

const ToastContainer = memo(function ToastContainer({ toasts, onClose }) {
  return (
    <div style={styles.toastContainer}>
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>
  );
});

const StatusBadge = memo(function StatusBadge({ status, small }) {
  const c = STATUS_COLORS[status] || { bg: '#1e293b', color: '#94a3b8', border: '#334155' };
  return (
    <span
      style={{
        fontSize: small ? '9.5px' : '11px',
        fontWeight: 700,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        padding: small ? '2px 7px' : '4px 10px',
        borderRadius: '20px',
        display: 'inline-block',
        letterSpacing: '0.3px',
      }}
    >
      {status || 'Sin estado'}
    </span>
  );
});

// ============================================================
// COMPONENTES PRINCIPALES
// ============================================================

// --- ITEM DE LA LISTA DE CONVERSACIONES ---
const ConversationItem = memo(function ConversationItem({
  conv,
  isSelected,
  isMobile,
  onClick,
}) {
  const isBotActive = conv.botActive !== false;
  const initial = (conv.name || 'C').charAt(0).toUpperCase();

  const hue = useMemo(() => {
    let h = 0;
    for (let i = 0; i < (conv.name || 'C').length; i++) h = (h * 31 + conv.name.charCodeAt(i)) % 360;
    return h;
  }, [conv.name]);

  return (
    <div
      onClick={() => onClick(conv)}
      style={{
        ...styles.chatItemCard,
        backgroundColor: isSelected && !isMobile ? 'rgba(136,19,55,0.12)' : 'transparent',
        borderLeft: isSelected && !isMobile ? '3px solid #be123c' : '3px solid transparent',
      }}
    >
      <div
        style={{
          ...styles.chatAvatar,
          background: `linear-gradient(135deg, hsl(${hue},65%,45%), hsl(${(hue + 40) % 360},70%,35%))`,
        }}
      >
        {initial}
      </div>

      <div style={styles.chatContentBox}>
        <div style={styles.chatTopLine}>
          <strong style={styles.chatName}>
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isBotActive ? '#22c55e' : '#ef4444',
                marginRight: '6px',
                boxShadow: isBotActive ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
                verticalAlign: 'middle',
              }}
            />
            {conv.name || 'Sin nombre'}
          </strong>
          <span style={styles.chatTime}>{conv.time}</span>
        </div>
        <div style={styles.chatPhone}>{formatPhone(conv.phone)}</div>
        <p style={styles.chatSnippet}>{conv.lastMessage || 'Sin mensajes'}</p>
        <div style={{ marginTop: '6px' }}>
          <StatusBadge status={conv.status} small />
        </div>
      </div>
    </div>
  );
});

// --- LISTA DE CONVERSACIONES ---
function InboxList({
  conversations,
  selectedId,
  isMobile,
  inboxFilter,
  setInboxFilter,
  onSelect,
  searchQuery,
  setSearchQuery,
}) {
  const filtered = useMemo(() => {
    const base = conversations.filter((c) =>
      inboxFilter === 'activos' ? !c.archived : c.archived
    );
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q)
    );
  }, [conversations, inboxFilter, searchQuery]);

  return (
    <aside style={styles.colInbox}>
      <div style={styles.inboxHeader}>
        <div style={styles.inboxHeaderTop}>
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
              Archivo
            </button>
          </div>
        </div>
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, teléfono o mensaje..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.chatScrollList}>
        {filtered.length === 0 && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {searchQuery ? 'Sin resultados' : 'No hay conversaciones'}
            </div>
          </div>
        )}
        {filtered.map((conv) => (
          <ConversationItem
            key={conv.id}
            conv={conv}
            isSelected={String(conv.id) === String(selectedId)}
            isMobile={isMobile}
            onClick={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}

// --- VENTANA DE CHAT ---
function ChatWindow({
  conv,
  inputReply,
  setInputReply,
  onSend,
  onToggleBot,
  isMobile,
  onOpenFicha,
  chatAreaRef,
  chatBottomRef,
  onScroll,
}) {
  const isBotActive = conv?.botActive !== false;

  return (
    <section style={styles.colChat}>
      <div style={styles.chatWindowHeader}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={styles.chatTargetName}>{conv?.name || 'Seleccioná una conversación'}</h3>
          {conv?.phone && <span style={styles.chatTargetPhone}>{formatPhone(conv.phone)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onToggleBot}
            disabled={!conv?.id}
            style={{
              ...styles.btnToggleBot,
              background: isBotActive
                ? 'linear-gradient(135deg,#064e3b,#065f46)'
                : 'linear-gradient(135deg,#7f1d1d,#991b1b)',
              borderColor: isBotActive ? '#059669' : '#b91c1c',
              color: isBotActive ? '#6ee7b7' : '#fca5a5',
            }}
          >
            <span style={{ marginRight: '4px' }}>{isBotActive ? '🤖' : '⏸️'}</span>
            {isBotActive ? 'Sol activa' : 'Sol pausada'}
          </button>
          {isMobile && (
            <button type="button" onClick={onOpenFicha} style={styles.btnFichaMobile}>
              📝 Ficha
            </button>
          )}
        </div>
      </div>

      <div ref={chatAreaRef} onScroll={onScroll} style={styles.chatMessagesArea}>
        {(!conv?.messages || conv.messages.length === 0) && (
          <div style={styles.emptyChat}>
            <div style={{ fontSize: '40px', marginBottom: '10px', opacity: 0.4 }}>💬</div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>
              Aún no hay mensajes en esta conversación
            </div>
          </div>
        )}
        {(conv?.messages || []).map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.msgBubble,
              maxWidth: isMobile ? '85%' : '65%',
              alignSelf: m.sender === 'me' ? 'flex-end' : 'flex-start',
              background:
                m.sender === 'me'
                  ? 'linear-gradient(135deg,#9f1239,#881337)'
                  : 'linear-gradient(135deg,#1e293b,#0f172a)',
              borderBottomRightRadius: m.sender === 'me' ? '4px' : '14px',
              borderBottomLeftRadius: m.sender === 'me' ? '14px' : '4px',
            }}
          >
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5 }}>{m.text}</p>
            <span style={styles.msgTimeTag}>{m.time}</span>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      <form onSubmit={onSend} style={styles.chatInputBar}>
        <input
          type="text"
          placeholder="Escribí un mensaje manual..."
          value={inputReply}
          onChange={(e) => setInputReply(e.target.value)}
          style={styles.inputMessage}
        />
        <button type="submit" style={styles.btnSend} disabled={!inputReply.trim()}>
          ➤
        </button>
      </form>
    </section>
  );
}

// --- FORMULARIO DE FICHA ---
function QuoteForm({
  formData,
  onFormChange,
  onSave,
  onTriggerAI,
  loadingAi,
}) {
  return (
    <aside style={styles.colForm}>
      <div style={styles.formHeader}>
        <div style={styles.formHeaderRow}>
          <strong style={styles.formTitle}>FICHA DE COTIZACIÓN</strong>
          <span style={styles.badgeAiReady}>VUCE</span>
        </div>
        <button
          type="button"
          onClick={onTriggerAI}
          disabled={loadingAi}
          style={{
            ...styles.btnTriggerAi,
            opacity: loadingAi ? 0.7 : 1,
            cursor: loadingAi ? 'wait' : 'pointer',
          }}
        >
          {loadingAi ? '⏳ Sol calculando…' : '⚡ Sol: Autocompletar'}
        </button>
      </div>

      <div style={styles.formScroll}>
        <Field label="Cliente / Razón Social">
          <input
            type="text"
            style={styles.fieldInput}
            value={formData?.clientName || ''}
            onChange={(e) => onFormChange('clientName', e.target.value)}
            placeholder="Nombre del cliente"
          />
        </Field>

        <Field label="Producto / Mercadería">
          <input
            type="text"
            style={styles.fieldInput}
            value={formData?.product || ''}
            onChange={(e) => onFormChange('product', e.target.value)}
            placeholder="Descripción del producto"
          />
        </Field>

        <div style={styles.twoCols}>
          <Field label="Posición Arancelaria">
            <input
              type="text"
              style={{ ...styles.fieldInput, borderColor: '#059669', color: '#34d399', fontWeight: 600 }}
              value={formData?.hscode || ''}
              onChange={(e) => onFormChange('hscode', e.target.value)}
              placeholder="Ej: 8418.69.10"
            />
          </Field>
          <Field label="Incoterm">
            <select
              style={styles.fieldSelect}
              value={formData?.incoterm || 'FOB'}
              onChange={(e) => onFormChange('incoterm', e.target.value)}
            >
              <option value="EXW">EXW</option>
              <option value="FOB">FOB</option>
              <option value="CIF">CIF</option>
            </select>
          </Field>
        </div>

        <div style={styles.threeCols}>
          <Field label="FOB USD">
            <input
              type="number"
              min="0"
              style={styles.fieldInput}
              value={formData?.goodsValue || ''}
              onChange={(e) => onFormChange('goodsValue', e.target.value)}
              placeholder="USD"
            />
          </Field>
          <Field label="Kilos">
            <input
              type="number"
              min="0"
              style={styles.fieldInput}
              value={formData?.weightKg || ''}
              onChange={(e) => onFormChange('weightKg', e.target.value)}
              placeholder="Kg"
            />
          </Field>
          <Field label="CBM (m³)">
            <input
              type="number"
              min="0"
              step="0.01"
              style={styles.fieldInput}
              value={formData?.cbm || ''}
              onChange={(e) => onFormChange('cbm', e.target.value)}
              placeholder="m³"
            />
          </Field>
        </div>

        <Field label="Modalidad de Flete">
          <select
            style={styles.fieldSelect}
            value={formData?.shippingMode || 'grupo_maritimo'}
            onChange={(e) => onFormChange('shippingMode', e.target.value)}
          >
            <option value="grupo_maritimo">🚢 Marítimo en Grupo (5 USD/kg si &lt; 1 CBM)</option>
            <option value="maritimo_cbm_menos5">📦 Marítimo &lt; 5 m³ (450 USD/CBM)</option>
            <option value="maritimo_cbm_mas5">📦 Marítimo ≥ 5 m³ (350 USD/CBM)</option>
            <option value="aereo_hasta30">✈️ Aéreo ≤ 30 kg (20 USD/kg)</option>
            <option value="aereo_mas30">✈️ Aéreo &gt; 30 kg (15 USD/kg)</option>
          </select>
        </Field>

        <div style={styles.breakdownBox}>
          <span style={styles.breakdownTitle}>DESGLOSE ESTIMADO</span>
          <div style={styles.threeCols}>
            <Field label="Flete USD" small>
              <input
                type="number"
                min="0"
                style={styles.fieldInput}
                value={formData?.freightUSD || ''}
                onChange={(e) => onFormChange('freightUSD', e.target.value)}
              />
            </Field>
            <Field label="Seguro (3%)" small>
              <input
                type="number"
                min="0"
                style={styles.fieldInput}
                value={formData?.insuranceUSD || ''}
                onChange={(e) => onFormChange('insuranceUSD', e.target.value)}
              />
            </Field>
            <Field label="Aranceles" small>
              <input
                type="number"
                min="0"
                style={styles.fieldInput}
                value={formData?.dutiesUSD || ''}
                onChange={(e) => onFormChange('dutiesUSD', e.target.value)}
              />
            </Field>
          </div>
          <div style={{ ...styles.twoCols, marginTop: '6px' }}>
            <Field label="Impuestos (IVA/IIBB)" small>
              <input
                type="number"
                min="0"
                style={styles.fieldInput}
                value={formData?.taxesUSD || ''}
                onChange={(e) => onFormChange('taxesUSD', e.target.value)}
              />
            </Field>
            <Field label="TOTAL LOGÍSTICA USD" small highlight>
              <input
                type="number"
                min="0"
                style={styles.fieldInputHighlight}
                value={formData?.totalLogisticsUSD || ''}
                onChange={(e) => onFormChange('totalLogisticsUSD', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Field label="Notas Operativas">
          <textarea
            style={styles.fieldTextarea}
            value={formData?.notes || ''}
            onChange={(e) => onFormChange('notes', e.target.value)}
            placeholder="Detalles adicionales..."
          />
        </Field>

        <button type="button" style={styles.btnActionQuote} onClick={onSave}>
          💾 Guardar Ficha
        </button>
      </div>
    </aside>
  );
}

function Field({ label, children, small, highlight }) {
  return (
    <div style={styles.fieldItem}>
      <label
        style={{
          ...styles.fieldLabel,
          fontSize: small ? '9.5px' : '10.5px',
          color: highlight ? '#fbbf24' : '#cbd5e1',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// --- PANEL DE ESTADOS ---
function EstadosPanel({
  conversations,
  selectedId,
  selectedConv,
  statusFilter,
  setStatusFilter,
  onSelect,
  onStatusChange,
  isMobile,
}) {
  const filtered = useMemo(
    () => (statusFilter === 'TODOS' ? conversations : conversations.filter((c) => c.status === statusFilter)),
    [conversations, statusFilter]
  );

  const q = selectedConv?.quoteData || {};

  return (
    <section style={styles.tabEstadosLayout}>
      <div style={styles.filterButtonGroup}>
        <button
          type="button"
          style={statusFilter === 'TODOS' ? styles.filterBtnActive : styles.filterBtn}
          onClick={() => setStatusFilter('TODOS')}
        >
          Todos ({conversations.length})
        </button>
        {ESTADOS_DISPONIBLES.map((st) => {
          const count = conversations.filter((c) => c.status === st).length;
          return (
            <button
              key={st}
              type="button"
              style={statusFilter === st ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setStatusFilter(st)}
            >
              {st} ({count})
            </button>
          );
        })}
      </div>

      <div
        style={{
          ...styles.estadosBodyGrid,
          gridTemplateColumns: isMobile ? '1fr' : '320px 1fr',
        }}
      >
        <div style={styles.estadosColList}>
          {filtered.length === 0 && (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>📊</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Sin resultados</div>
            </div>
          )}
          {filtered.map((conv) => {
            const isSelected = String(conv.id) === String(selectedId);
            const cq = conv.quoteData || {};
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelect(conv)}
                style={{
                  ...styles.estadoContactButton,
                  backgroundColor: isSelected ? 'rgba(136,19,55,0.15)' : '#0f172a',
                  borderColor: isSelected ? '#be123c' : '#1e293b',
                }}
              >
                <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                  <strong style={styles.estadoContactName}>{conv.name}</strong>
                  <span style={styles.estadoContactPhone}>{formatPhone(conv.phone)}</span>
                  {cq.product && (
                    <div style={styles.estadoContactProduct}>📦 {cq.product}</div>
                  )}
                </div>
                <StatusBadge status={conv.status} small />
              </button>
            );
          })}
        </div>

        {(!isMobile || selectedId) && selectedConv?.id && (
          <div style={styles.estadosColDetail}>
            <div style={styles.cardDetailEstado}>
              <div style={styles.cardDetailHeader}>
                <div>
                  <h2 style={styles.detailName}>{selectedConv.name}</h2>
                  <span style={styles.detailPhone}>WhatsApp: {formatPhone(selectedConv.phone)}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Estado actual</span>
                  <StatusBadge status={selectedConv.status} />
                </div>
              </div>

              <hr style={styles.hr} />

              <div style={styles.summaryCard}>
                <h3 style={styles.summaryCardTitle}>📋 Resumen de Carga & Cotización</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: '14px',
                    fontSize: '12px',
                  }}
                >
                  <InfoRow label="Producto" value={q.product || 'A definir'} />
                  <InfoRow label="PA (VUCE)" value={q.hscode || 'Sin PA'} highlight />
                  <InfoRow
                    label="Peso / Medidas"
                    value={`${q.weightKg ? `${q.weightKg} kg` : '-'} | ${q.cbm ? `${q.cbm} m³` : '-'}`}
                  />
                  <InfoRow
                    label="FOB Declarado"
                    value={q.goodsValue ? `USD ${q.goodsValue}` : '-'}
                  />
                  <InfoRow label="Modalidad" value={q.shippingMode || 'Marítimo'} />
                  <InfoRow
                    label="TOTAL Cotizado"
                    value={q.totalLogisticsUSD ? `USD ${q.totalLogisticsUSD}` : 'Sin cotizar'}
                    warn
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={styles.fieldLabel}>Cambiar estado</label>
                <div style={styles.stateSelectorGrid}>
                  {ESTADOS_DISPONIBLES.map((estado) => (
                    <button
                      key={estado}
                      type="button"
                      onClick={() => onStatusChange(estado)}
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
                <h4 style={styles.summaryBoxTitle}>ÚLTIMO MENSAJE</h4>
                <p style={styles.summaryBoxText}>"{selectedConv.lastMessage || '—'}"</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function InfoRow({ label, value, highlight, warn }) {
  return (
    <div>
      <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', marginBottom: '2px' }}>
        {label}
      </span>
      <strong
        style={{
          color: warn ? '#fbbf24' : highlight ? '#34d399' : '#fff',
          fontSize: warn ? '14px' : '12.5px',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function ModuloVentasCRM() {
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState('inbox');
  const [mobileTab, setMobileTab] = useState('chats');
  const [inboxFilter, setInboxFilter] = useState('activos');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({});
  const [inputReply, setInputReply] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const { conversations, patchConversation } = useConversations();
  const { toasts, push, remove } = useToasts();

  const chatBottomRef = useRef(null);
  const chatAreaRef = useRef(null);
  const isUserScrollingRef = useRef(false);
  const selectedIdRef = useRef(selectedId);
  
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selectedConv = useMemo(
    () =>
      conversations.find((c) => String(c.id) === String(selectedId)) ||
      conversations[0] || { messages: [], quoteData: {}, botActive: true },
    [conversations, selectedId]
  );

  // Auto-selección inicial
  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(String(conversations[0].id));
      setFormData(conversations[0].quoteData || {});
    }
  }, [conversations, selectedId]);

  // Sincronizar formData SOLO si no está dirty (evita pisar edición)
  useEffect(() => {
    if (!selectedConv?.id) return;
    if (isUserScrollingRef.current) return;
    setFormData((prev) => {
      const incoming = selectedConv.quoteData || {};
      return Object.keys(prev).length === 0 ? incoming : prev;
    });
  }, [selectedConv?.id]);

  // Auto-scroll
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConv?.messages?.length, mobileTab]);

  const handleScrollChat = () => {
    if (!chatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    isUserScrollingRef.current = scrollHeight - scrollTop - clientHeight > 120;
  };

  const handleSelectConversation = useCallback(
    (conv) => {
      isUserScrollingRef.current = false;
      setSelectedId(String(conv.id));
      setFormData(conv.quoteData || {});
      if (isMobile) setMobileTab('chat_activo');
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
    },
    [isMobile]
  );

  const handleToggleBotIndividual = useCallback(async () => {
    if (!selectedConv?.id) return;
    const nextState = !(selectedConv.botActive !== false);
    
    // Actualizamos optimísticamente la BD mediante el custom hook
    const success = await patchConversation(selectedConv.id, { botActive: nextState });
    
    if (success) {
      push(`Sol AI ha sido ${nextState ? 'activada' : 'pausada'} para este chat`, nextState ? 'success' : 'warning');
    } else {
      push('Error al cambiar el estado del bot', 'error');
    }
  }, [selectedConv, patchConversation, push]);

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveFormDataManual = useCallback(async () => {
    if (!selectedConv?.id) return;
    const success = await patchConversation(selectedConv.id, { quoteData: formData });
    if (success) {
      push('Ficha guardada exitosamente en la base de datos', 'success');
    } else {
      push('Error al guardar la ficha', 'error');
    }
  }, [selectedConv?.id, formData, patchConversation, push]);

  const handleStatusChange = useCallback(async (newStatus) => {
    if (!selectedConv?.id) return;
    const success = await patchConversation(selectedConv.id, { status: newStatus });
    if (success) {
      push(`Estado actualizado a: ${newStatus}`, 'info');
    }
  }, [selectedConv?.id, patchConversation, push]);

  // Lógica de autocompletado con Sol AI
  const handleTriggerSolAI = useCallback(async () => {
    if (!selectedConv.messages || selectedConv.messages.length === 0) {
      push('No hay historial de chat para analizar.', 'warning');
      return;
    }
    
    setLoadingAi(true);
    push('Sol está analizando la conversación...', 'info', 2000);
    
    try {
      const res = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationHistory: selectedConv.messages })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fallo interno de Sol AI');

      if (data.extractedData) {
        // Limpiamos los campos nulos que devuelva la IA
        const cleanedData = Object.fromEntries(
          Object.entries(data.extractedData).filter(([_, v]) => v !== null && v !== '')
        );
        
        setFormData((prev) => {
          const mergedData = { ...prev, ...cleanedData };
          
          // Guardamos automáticamente la ficha en Supabase
          patchConversation(selectedConv.id, {
            quoteData: mergedData,
            ...(data.suggestedStatus ? { status: data.suggestedStatus } : {})
          });
          
          return mergedData;
        });
        
        push('¡Ficha autocompletada con éxito!', 'success');
      } else {
        push('Sol no encontró datos nuevos para extraer.', 'warning');
      }

      if (data.replyMessage) {
        setInputReply(data.replyMessage);
      }
      
    } catch (err) {
      console.error(err);
      push(`Error de IA: ${err.message}`, 'error', 4000);
    } finally {
      setLoadingAi(false);
    }
  }, [selectedConv, patchConversation, push]);

  const handleSendReply = useCallback(async (e) => {
    e.preventDefault();
    const targetPhone = selectedConv?.phone || selectedConv?.jid || selectedConv?.id;
    if (!inputReply.trim() || !targetPhone) return;

    const messageText = inputReply.trim();
    setInputReply('');
    isUserScrollingRef.current = false;

    const newMsg = {
      id: Date.now(),
      sender: 'me',
      text: messageText,
      time: now()
    };

    const updatedMessages = [...(selectedConv.messages || []), newMsg];

    // Actualización optimista inmediata
    patchConversation(selectedConv.id, {
      lastMessage: messageText,
      messages: updatedMessages
    });

    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          message: messageText,
          contactId: selectedConv.id
        })
      });
      if (!res.ok) throw new Error('El proxy interno falló.');
    } catch (err) {
      console.error('Error en envío manual:', err);
      push('Hubo un error al despachar el mensaje a WhatsApp', 'error');
    }
  }, [inputReply, selectedConv, patchConversation, push]);

  return (
    <div style={styles.container}>
      <ToastContainer toasts={toasts} onClose={remove} />
      
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
            💬 Contactos
          </button>
          <button
            type="button"
            style={mobileTab === 'chat_activo' ? styles.mobileTabBtnActive : styles.mobileTabBtn}
            onClick={() => setMobileTab('chat_activo')}
          >
            📱 Chat
          </button>
          <button
            type="button"
            style={mobileTab === 'ficha' ? styles.mobileTabBtnActive : styles.mobileTabBtn}
            onClick={() => setMobileTab('ficha')}
          >
            📝 Ficha
          </button>
        </div>
      )}

      {activeTab === 'inbox' && (
        <main style={{ ...styles.mainGrid, gridTemplateColumns: isMobile ? '1fr' : '340px 1fr 400px' }}>
          {(!isMobile || mobileTab === 'chats') && (
            <InboxList
              conversations={conversations}
              selectedId={selectedId}
              isMobile={isMobile}
              inboxFilter={inboxFilter}
              setInboxFilter={setInboxFilter}
              onSelect={handleSelectConversation}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}

          {(!isMobile || mobileTab === 'chat_activo') && (
            <ChatWindow
              conv={selectedConv}
              inputReply={inputReply}
              setInputReply={setInputReply}
              onSend={handleSendReply}
              onToggleBot={handleToggleBotIndividual}
              isMobile={isMobile}
              onOpenFicha={() => setMobileTab('ficha')}
              chatAreaRef={chatAreaRef}
              chatBottomRef={chatBottomRef}
              onScroll={handleScrollChat}
            />
          )}

          {(!isMobile || mobileTab === 'ficha') && (
            <QuoteForm
              formData={formData}
              onFormChange={handleFormChange}
              onSave={handleSaveFormDataManual}
              onTriggerAI={handleTriggerSolAI}
              loadingAi={loadingAi}
            />
          )}
        </main>
      )}

      {activeTab === 'estados' && (
        <EstadosPanel
          conversations={conversations}
          selectedId={selectedId}
          selectedConv={selectedConv}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onSelect={handleSelectConversation}
          onStatusChange={handleStatusChange}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

// ============================================================
// ESTILOS
// ============================================================

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
  toastContainer: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
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
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  inboxHeaderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
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
  searchInput: {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '12px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  chatScrollList: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatItemCard: {
    display: 'flex',
    gap: '10px',
    padding: '12px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid #1e293b',
    transition: 'background-color 0.2s'
  },
  chatAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    color: '#fff',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
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
    fontSize: '14px',
    color: '#ffffff',
    fontWeight: '600'
  },
  chatTargetPhone: {
    fontSize: '11.5px',
    color: '#64748b'
  },
  btnToggleBot: {
    border: '1px solid',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  },
  btnFichaMobile: {
    backgroundColor: '#881337',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  chatMessagesArea: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  emptyChat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  msgBubble: {
    padding: '10px 14px',
    position: 'relative',
    color: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  msgTimeTag: {
    fontSize: '9.5px',
    color: 'rgba(255,255,255,0.5)',
    display: 'block',
    textAlign: 'right',
    marginTop: '6px'
  },
  chatInputBar: {
    padding: '12px 14px',
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
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13.5px',
    outline: 'none'
  },
  btnSend: {
    backgroundColor: '#be123c',
    color: '#fff',
    border: 'none',
    width: '42px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s'
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
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  formHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  formTitle: {
    fontSize: '11.5px',
    color: '#ffffff',
    letterSpacing: '0.5px'
  },
  badgeAiReady: {
    fontSize: '9.5px',
    fontWeight: 'bold',
    backgroundColor: '#064e3b',
    color: '#34d399',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  btnTriggerAi: {
    width: '100%',
    background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
    color: '#c7d2fe',
    border: '1px solid #4338ca',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '11.5px',
    fontWeight: 'bold',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
  },
  formScroll: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  fieldItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  fieldLabel: {
    fontWeight: '600'
  },
  fieldInput: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '9px 10px',
    color: '#ffffff',
    fontSize: '12.5px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  fieldInputHighlight: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #f59e0b',
    borderRadius: '6px',
    padding: '9px 10px',
    color: '#fbbf24',
    fontSize: '13px',
    fontWeight: 'bold',
    outline: 'none'
  },
  fieldSelect: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '9px 10px',
    color: '#ffffff',
    fontSize: '12.5px',
    outline: 'none'
  },
  fieldTextarea: {
    width: '100%',
    height: '60px',
    boxSizing: 'border-box',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '9px 10px',
    color: '#ffffff',
    fontSize: '12.5px',
    outline: 'none',
    resize: 'vertical'
  },
  twoCols: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px'
  },
  threeCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px'
  },
  breakdownBox: {
    backgroundColor: '#0b1120',
    padding: '14px',
    borderRadius: '8px',
    border: '1px solid #1e293b'
  },
  breakdownTitle: {
    fontSize: '10.5px',
    fontWeight: 'bold',
    color: '#94a3b8',
    display: 'block',
    marginBottom: '10px',
    letterSpacing: '0.5px'
  },
  btnActionQuote: {
    backgroundColor: '#be123c',
    color: '#ffffff',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '6px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
  },
  tabEstadosLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '16px',
    minHeight: 0,
    overflow: 'hidden'
  },
  filterButtonGroup: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '6px',
    flexShrink: 0
  },
  filterBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '11.5px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  filterBtnActive: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #9f1239',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '11.5px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
  },
  estadosBodyGrid: {
    flex: 1,
    display: 'grid',
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
    borderRadius: '10px',
    border: '1px solid #1e293b',
    minHeight: 0
  },
  estadoContactButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.2s'
  },
  estadoContactName: {
    display: 'block',
    color: '#fff',
    fontSize: '13.5px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  estadoContactPhone: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  estadoContactProduct: {
    fontSize: '11.5px',
    color: '#38bdf8',
    marginTop: '4px'
  },
  estadosColDetail: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    padding: '20px',
    overflowY: 'auto',
    minHeight: 0
  },
  cardDetailEstado: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  cardDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  detailName: {
    margin: 0,
    fontSize: '20px',
    color: '#fff',
    fontWeight: '700'
  },
  detailPhone: {
    fontSize: '13px',
    color: '#94a3b8'
  },
  hr: {
    border: 'none',
    borderTop: '1px solid #1e293b',
    margin: '18px 0'
  },
  summaryCard: {
    backgroundColor: '#0b1120',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '20px'
  },
  summaryCardTitle: {
    margin: '0 0 14px 0',
    fontSize: '13.5px',
    color: '#38bdf8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  stateSelectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
    marginTop: '8px'
  },
  stateBtnOption: {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '11.5px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  stateBtnSelected: {
    backgroundColor: '#881337',
    color: '#ffffff',
    border: '1px solid #f43f5e',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '11.5px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
  },
  summaryBox: {
    backgroundColor: '#0b1120',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px'
  },
  summaryBoxTitle: {
    margin: '0 0 8px 0',
    fontSize: '11px',
    color: '#cbd5e1',
    letterSpacing: '0.5px'
  },
  summaryBoxText: {
    margin: 0,
    fontSize: '13px',
    color: '#f1f5f9',
    fontStyle: 'italic',
    lineHeight: 1.5
  }
};