"use client";
import { useEffect } from "react";
export function Modal({title,onClose,children}){
  useEffect(()=>{ const onKey=(e)=>{ if(e.key==="Escape") onClose?.(); }; window.addEventListener("keydown", onKey); return ()=>window.removeEventListener("keydown", onKey); },[onClose]);
  return (
    <div className="modalBackdrop" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
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
export function BottomBar({onTab}){
  return (
    <div className="bottomBar">
      <button className="tabBtn" onClick={()=>onTab("accounting")}>🧾<span>Účet</span></button>
      <button className="tabBtn" onClick={()=>onTab("assets")}>🧱<span>Aktiva</span></button>
      <button className="tabBtn" onClick={()=>onTab("experts")}>🧑‍🔧<span>Experti</span></button>
      <button className="tabBtn" onClick={()=>onTab("trends")}>🗺️<span>Trendy</span></button>
    </div>
  );
}
