"use client";
import { useEffect, useState } from "react";
import { loadLastGameId, loadName, loadPlayerId, saveName } from "../lib/storage";
import { useRouter } from "next/navigation";

export default function Home(){
  const [name,setName]=useState("");
  const [lastGame,setLastGame]=useState("");
  const [playerId,setPlayerId]=useState("");
  const r=useRouter();

  useEffect(()=>{
    setName(loadName());
    setLastGame(loadLastGameId());
    setPlayerId(loadPlayerId());
  },[]);

  const canResume = Boolean(lastGame && playerId);

  return (
    <div className="container">
      <div className="header"><h1 className="brand">KRYPTOPOLY</h1></div>

      <div className="card">
        <div className="sectionLabel">Profil</div>
        <input
          className="bigInput"
          value={name}
          onChange={(e)=>{ setName(e.target.value); saveName(e.target.value); }}
          placeholder="Přezdívka (unikátní ve hře)"
        />

        {canResume ? (
          <div style={{marginTop:10}}>
            <button className="btn secondary" disabled={!name.trim()} onClick={()=>r.push(`/lobby/${lastGame}`)}>
              ↩ Vrátit se do poslední hry
            </button>
            <div className="hint" style={{marginTop:6}}>Tip: pokud se vracíš na jiném zařízení, naskenuj znovu QR kód hry.</div>
          </div>
        ) : null}

        <div className="row" style={{marginTop:12}}>
          <button className="btn" disabled={!name.trim()} onClick={()=>r.push("/create")}>🎩 GM</button>
          <button className="btn secondary" disabled={!name.trim()} onClick={()=>r.push("/join")}>📷 QR</button>
        </div>

        <div className="hint" style={{marginTop:10}}>
          Připojení do hry probíhá vždy přes QR kód. Přezdívka je povinná a musí být ve hře unikátní.
        </div>
      </div>
    </div>
  );
}
