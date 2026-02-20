"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadName } from "../../../lib/storage";
import { getSocket } from "../../../lib/socket";
import { stopAudio, unlockAndPlay } from "../../../lib/audio";

export default function JoinConfirm(){
  const { gameId } = useParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{ setName(loadName()); },[]);
  useEffect(()=>{
    setError("");
    try{
      const s = getSocket();
      s.emit("get_game_info", { gameId }, (res)=>{
        if (!res?.ok) { setError(res?.error || "Hra nenalezena."); return; }
        setInfo(res.game);
      });
    }catch(e){
      setError(String(e?.message || e));
    }
  }, [gameId]);

  function onJoin(){
    setBusy(true);
    setError("");
    try{
      const s = getSocket();
      s.emit("join_game", { gameId, name: name.trim() }, async (res)=>{
        if (!res?.ok) { setError(res?.error || "Nelze se připojit."); setBusy(false); return; }
        // Start clock ambience after successful join
        stopAudio();
        await unlockAndPlay("/sounds/grand_clock_loop.wav");
        router.push(`/lobby/${gameId}?role=player`);
      });
    }catch(e){
      setError(String(e?.message || e));
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="hero">
        <h1 className="title">KRYPTOPOLY</h1>
        <p className="subtitle">Potvrzení připojení</p>
      </div>

      <div className="card">
        {!info ? (
          <div className="small">Načítám údaje o hře…</div>
        ) : (
          <>
            <h2>{info.title}</h2>
            <div className="pillrow">
              <span className="pill cyan">Roků: {info.years}</span>
              <span className="pill orange">Hráčů: {info.maxPlayers}</span>
            </div>
            <div className="hr"></div>
            <div className="small">Kliknutím potvrdíš připojení ke hře.</div>
          </>
        )}

        {error ? <div className="notice" style={{borderColor:"rgba(255,77,109,.35)", background:"rgba(255,77,109,.10)", color:"#ffd3db"}}>{error}</div> : null}

        <button className="btn" disabled={!name.trim() || busy || !info} onClick={onJoin}>
          {busy ? "Připojuji…" : "Chci se připojit ke hře"}
        </button>

        <button className="btn secondary" onClick={()=>router.push("/")}>← Zpět</button>
      </div>
    </div>
  );
}
