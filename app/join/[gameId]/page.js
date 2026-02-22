"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadName, saveName, savePlayerId } from "../../../lib/storage";
import { getSocket } from "../../../lib/socket";
export default function JoinConfirm(){
  const { gameId } = useParams();
  const r=useRouter();
  const [name,setName]=useState("");
  const [err,setErr]=useState("");
  useEffect(()=>setName(loadName()),[]);
  function join(){
    setErr("");
    const s=getSocket();
    s.emit("join_game",{gameId,name:name.trim()},(res)=>{
      if(!res?.ok){ setErr(res?.error||"Chyba"); return; }
      savePlayerId(res.playerId);
      r.push(`/lobby/${gameId}?role=player`);
    });
  }
  return (
    <div className="container">
      <div className="header"><h1 className="brand">KRYPTOPOLY</h1><button className="iconBtn" onClick={()=>r.push("/")}>←</button></div>
      <div className="card">
        <input className="bigInput" value={name} onChange={(e)=>{setName(e.target.value); saveName(e.target.value);}} placeholder="Jméno" />
        {err ? <div className="notice">{err}</div> : null}
        <button className="btn" disabled={!name.trim()} onClick={join}>Připojit</button>
      </div>
    </div>
  );
}
