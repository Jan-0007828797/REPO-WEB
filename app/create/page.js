"use client";
import { useEffect, useState } from "react";
import { loadName, saveName, savePlayerId } from "../../lib/storage";
import { getSocket } from "../../lib/socket";
import { useRouter } from "next/navigation";
import { ConsentGate } from "../consent";
import { playClock, stopClock } from "../../lib/audio";
export default function Create(){
  const r=useRouter();
  const [stage,setStage]=useState("consent");
  const [name,setName]=useState("");
  const [yearsTotal,setYears]=useState(4);
  const [maxPlayers,setMaxPlayers]=useState(1);
  const [err,setErr]=useState("");
  useEffect(()=>{ setName(loadName()); },[]);
  function createGame(){
    setErr("");
    const s=getSocket();
    s.emit("create_game",{ name:name.trim(), yearsTotal:Number(yearsTotal), maxPlayers:Number(maxPlayers) },(res)=>{
      if(!res?.ok){ setErr(res?.error||"Chyba"); return; }
      savePlayerId(res.playerId);
      stopClock();
      r.push(`/lobby/${res.gameId}?role=gm`);
    });
  }
  return (
    <div className="container">
      <div className="header"><h1 className="brand">KRYPTOPOLY</h1><button className="iconBtn" onClick={()=>r.push("/")}>←</button></div>
      {stage==="consent" ? (
        <ConsentGate onDone={()=>{ playClock(); setStage("form"); }} />
      ) : (
        <div className="card">
          <input className="bigInput" value={name} onChange={(e)=>{setName(e.target.value); saveName(e.target.value);}} placeholder="GM" />
          <div className="row">
            <select value={yearsTotal} onChange={(e)=>setYears(Number(e.target.value))}><option value={4}>4</option><option value={5}>5</option></select>
            <select value={maxPlayers} onChange={(e)=>setMaxPlayers(Number(e.target.value))}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select>
          </div>
          {err ? <div className="notice">{err}</div> : null}
          <button className="btn" disabled={!name.trim()} onClick={createGame}>Vytvořit</button>
        </div>
      )}
    </div>
  );
}
