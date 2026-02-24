"use client";
import { useEffect } from "react";
export function Modal({title,onClose,children,variant}){
  useEffect(()=>{ const onKey=(e)=>{ if(e.key==="Escape") onClose?.(); }; window.addEventListener("keydown", onKey); return ()=>window.removeEventListener("keydown", onKey); },[onClose]);
  return (
    <div className={"modalBackdrop"+(variant==="top"?" top":"")} onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="modal">
        <div className="modalHeader">
          <div style={{fontWeight:900,fontSize:18}}>{title}</div>
          <button className="iconBtn" onClick={onClose}>✕</button>
        </div>
        <div style={{height:1,background:"rgba(255,255,255,.10)",margin:"12px 0"}}></div>
        {children}
      </div>
    </div>
  );
}
// Bottom bar is intentionally dumb: visual-only. Logic stays in pages (golden rule).
export function BottomBar({onTab, active}){
  return (
    <div className="bottomBar">
      <button className={"tabBtn"+(active==="accounting"?" active":"")} onClick={()=>onTab("accounting")} aria-label="Účetnictví">
        <span className="tabIcon" aria-hidden="true">🧾</span>
        <span className="tabLabel">Účet</span>
      </button>
      <button className={"tabBtn"+(active==="assets"?" active":"")} onClick={()=>onTab("assets")} aria-label="Aktiva">
        <span className="tabIcon" aria-hidden="true">🏭</span>
        <span className="tabLabel">Aktiva</span>
      </button>
      <button className={"tabBtn"+(active==="experts"?" active":"")} onClick={()=>onTab("experts")} aria-label="Experti">
        <span className="tabIcon" aria-hidden="true">🧑‍💼</span>
        <span className="tabLabel">Experti</span>
      </button>
      <button className={"tabBtn"+(active==="trends"?" active":"")} onClick={()=>onTab("trends")} aria-label="Trendy">
        <span className="tabIcon" aria-hidden="true">🌐</span>
        <span className="tabLabel">Trendy</span>
      </button>
    </div>
  );
}
