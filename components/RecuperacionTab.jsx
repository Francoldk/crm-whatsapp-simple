import {useMemo,useState} from 'react';
const panel={background:'#111827',border:'1px solid #293449',borderRadius:12,padding:16};
const button={background:'#6d28d9',color:'#fff',border:0,borderRadius:9,padding:'10px 14px',cursor:'pointer',fontWeight:700};
export default function RecuperacionTab({conversations=[],onOpenChat}){
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('Todos');
  const [selected,setSelected]=useState(null);
  const [loading,setLoading]=useState(false);
  const [analysis,setAnalysis]=useState({});
  const [draft,setDraft]=useState('');
  const [error,setError]=useState('');
  const statuses=['Todos',...new Set(conversations.map(c=>c.status).filter(Boolean))];
  const rows=useMemo(()=>conversations.filter(c=>(status==='Todos'||c.status===status)&&(`${c.name||''} ${c.phone||''} ${c.lastMessage||''}`.toLowerCase().includes(search.toLowerCase()))),[conversations,status,search]);
  const chosen=conversations.find(c=>String(c.id)===String(selected));
  const result=analysis[String(selected)];
  async function analyze(c){
    setSelected(c.id);setLoading(true);setError('');setDraft('');
    try{
      const r=await fetch('/api/recovery-analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contactId:c.id})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Error analizando');
      setAnalysis(p=>({...p,[String(c.id)]:d}));setDraft(d.mensaje_sugerido||'');
    }catch(e){setError(e.message)}finally{setLoading(false)}
  }
  const input={background:'#09101e',color:'#e2e8f0',border:'1px solid #334155',borderRadius:8,padding:10,minWidth:0};
  return <div style={{flex:1,minHeight:0,overflow:'auto',padding:20,color:'#e2e8f0',background:'#070c17'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:16}}>
      <div><h2 style={{margin:0}}>✨ Recuperación de prospectos</h2><p style={{fontSize:12,color:'#94a3b8'}}>Analizá el historial y prepará seguimientos. Nunca se envían automáticamente.</p></div>
      <a href="/api/export-chats" download style={{...button,textDecoration:'none'}}>⬇ Exportar todos los chats (CSV)</a>
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
      <div style={{...panel,minWidth:155}}><div style={{fontSize:11,color:'#94a3b8'}}>Contactos visibles</div><b style={{fontSize:24}}>{conversations.length}</b></div>
      <div style={{...panel,minWidth:155}}><div style={{fontSize:11,color:'#94a3b8'}}>Analizados en esta sesión</div><b style={{fontSize:24}}>{Object.keys(analysis).length}</b></div>
      <div style={{...panel,minWidth:155}}><div style={{fontSize:11,color:'#94a3b8'}}>Marcados prioritarios</div><b style={{fontSize:24}}>{Object.values(analysis).filter(a=>a.prioridad==='alta').length}</b></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(280px,1.25fr) minmax(280px,1fr)',gap:14}} className="recovery-layout">
      <div style={panel}>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}><input aria-label="Buscar prospecto" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar contacto o mensaje..." style={{...input,flex:1}}/><select value={status} onChange={e=>setStatus(e.target.value)} style={input}>{statuses.map(s=><option key={s}>{s}</option>)}</select></div>
        <div style={{maxHeight:'min(65vh,690px)',overflowY:'auto'}}>{rows.map(c=><div key={c.id} style={{borderBottom:'1px solid #263244',padding:'12px 4px',background:String(c.id)===String(selected)?'#1f1b39':'transparent',borderRadius:6}}>
          <div style={{display:'flex',gap:8,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}><div><b>{c.name||c.phone}</b><div style={{color:'#94a3b8',fontSize:11}}>{c.phone} · {c.status||'Sin estado'}</div></div><div style={{display:'flex',gap:7}}><button style={{...button,background:'#293449'}} onClick={()=>onOpenChat(c.id)}>Ver chat</button><button style={button} disabled={loading} onClick={()=>analyze(c)}>✨ Analizar</button></div></div>
          <p style={{margin:'6px 0 0',fontSize:12,color:'#94a3b8'}}>{String(c.lastMessage||'Sin mensajes').slice(0,145)}</p>
        </div>)}{!rows.length&&<p>No hay coincidencias.</p>}</div>
      </div>
      <div style={{...panel,alignSelf:'start'}}>
        <h3 style={{marginTop:0}}>🔎 Análisis de Sol</h3>
        {!chosen&&<p style={{color:'#94a3b8'}}>Elegí «Analizar» en un contacto para ver la evaluación y el mensaje sugerido.</p>}
        {chosen&&<><p style={{fontSize:12,color:'#94a3b8'}}>Contacto: {chosen.name||chosen.phone}</p>{loading&&<p>Analizando historial…</p>}{error&&<p role="alert" style={{color:'#fca5a5'}}>{error}</p>}
          {result&&<><p><b>Prioridad:</b> {result.prioridad}</p><p><b>Resumen:</b> {result.resumen}</p><p><b>Posible objeción:</b> {result.objecion||'No identificada'}</p><p><b>Estrategia:</b> {result.estrategia}</p>
            {result.no_contactar?<p style={{color:'#fca5a5'}}>⛔ Este cliente no debe recibir mensajes de recuperación.</p>:<><b>Borrador sugerido (editable)</b><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={6} style={{...input,width:'100%',boxSizing:'border-box',marginTop:8,resize:'vertical'}}/><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><button style={button} onClick={()=>navigator.clipboard.writeText(draft)}>Copiar borrador</button><button style={{...button,background:'#293449'}} onClick={()=>onOpenChat(chosen.id,draft)}>Usar en chat (sin enviar)</button></div></>}
            <p style={{fontSize:11,color:'#94a3b8'}}>Basado en {result.mensajesAnalizados} mensajes disponibles. Verificá la propuesta antes de contactar al cliente.</p>
          </>}</>}
      </div>
    </div>
    <style jsx>{`@media(max-width:850px){.recovery-layout{grid-template-columns:1fr!important}}`}</style>
  </div>;
}
