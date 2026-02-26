"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { getSocket } from "../../../lib/socket";
export default function Lobby(){
  const { gameId } = useParams();
  const sp = useSearchParams();
  const isGM = (sp.get("role")||"player")==="gm";
  const r=useRouter();
  const [players,setPlayers]=useState([]);
  const [cfg,setCfg]=useState(null);
  const [qr,setQr]=useState("");
  const joinUrl = useMemo(()=> (typeof window==="undefined") ? "" : `${window.location.origin}/join/${gameId}`, [gameId]);
  useEffect(()=>{ (async ()=>{ if(!joinUrl) return; setQr(await QRCode.toDataURL(joinUrl,{margin:2,width:420,errorCorrectionLevel:'H'})); })(); },[joinUrl]);
  useEffect(()=>{
    const s=getSocket();
    s.emit("watch_lobby",{gameId},()=>{}); 
    const onUpd=(p)=>{ if(p?.gameId!==gameId) return; setPlayers(p.players||[]); setCfg(p.config||null); };
    const onStarted=()=>r.push(`/game/${gameId}`);
    s.on("lobby_update", onUpd);
        s.on("game_started", onStarted);
        return ()=>{ clearInterval(t); s.off("lobby_update", onUpd); s.off("game_started", onStarted); };
  },[gameId,r]);
  function start(){ const s=getSocket(); s.emit("start_game",{gameId},()=>{}); }
  const canStart = isGM && cfg && players.length>=1;
  return (
    <div className="container">
      <div className="header"><h1 className="brand">KRYPTOPOLY</h1><button className="iconBtn" onClick={()=>r.push("/")}>⌂</button></div>
      <div className="card">
        <div className="row">
          <div style={{flex:"1 1 220px"}}>{qr ? <img src={qr} alt="QR" style={{width:"100%",maxWidth:280,borderRadius:16,background:"rgba(255,255,255,.92)",padding:10}}/> : null}</div>
          <div style={{flex:"2 1 240px"}}>
            {cfg ? <div className="pills"><span className="pill">🗓️ {cfg.yearsTotal}</span><span className="pill">👥 {cfg.maxPlayers}</span></div> : null}
            <div className="sectionLabel">Připojení hráči</div>
            <ul className="list">{players.length===0 ? (<li><span>Čekám na hráče…</span><span className="badge">Lobby</span></li>) : players.map(p=>(<li key={p.playerId}><span>{p.name}</span><span className="badge">{p.role==="GM"?"GM":"Hráč"}</span></li>))}</ul>
            {isGM ? <button className="btn" disabled={!canStart} onClick={start}>▶ Spustit</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
