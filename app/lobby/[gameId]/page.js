"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { getSocket } from "../../../lib/socket";
import { stopAudio } from "../../../lib/audio";

export default function Lobby(){
  const { gameId } = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const role = sp.get("role") || "player";
  const isGM = role === "gm";

  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");

  const joinUrl = useMemo(()=>{
    // QR points to /join/<gameId> on the current domain
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${gameId}`;
  }, [gameId]);

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try{
        if (!joinUrl) return;
        const dataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 240 });
        if (mounted) setQr(dataUrl);
      }catch(e){}
    })();
    return () => { mounted = false; };
  }, [joinUrl]);

  useEffect(()=>{
    setError("");
    try{
      const s = getSocket();
      s.emit("watch_lobby", { gameId }, (res)=>{
        if (!res?.ok) setError(res?.error || "Nelze otevřít lobby.");
      });

      const onLobby = (payload)=>{
        if (payload?.gameId !== gameId) return;
        setGame(payload.game);
        setPlayers(payload.players || []);
        if (payload.game?.status === "RUNNING"){
          stopAudio();
          router.push(`/game/${gameId}`);
        }
      };
      const onStarted = (payload)=>{
        if (payload?.gameId !== gameId) return;
        stopAudio();
        router.push(`/game/${gameId}`);
      };

      s.on("lobby_update", onLobby);
      s.on("game_started", onStarted);

      return ()=>{
        s.off("lobby_update", onLobby);
        s.off("game_started", onStarted);
      };
    }catch(e){
      setError(String(e?.message || e));
    }
  }, [gameId, router]);

  function startGame(){
    setError("");
    try{
      const s = getSocket();
      s.emit("start_game", { gameId }, (res)=>{
        if (!res?.ok) setError(res?.error || "Nelze spustit hru.");
      });
    }catch(e){
      setError(String(e?.message || e));
    }
  }

  const readyCount = players.length;
  const maxPlayers = game?.maxPlayers || 0;
  const canStart = isGM && game?.status === "LOBBY" && maxPlayers > 0 && readyCount === maxPlayers;

  return (
    <div className="container">
      <div className="hero">
        <h1 className="title">KRYPTOPOLY</h1>
        <p className="subtitle">Lobby</p>
      </div>

      <div className="grid">
        <div className="card">
          <h2>QR připojení</h2>
          <div className="qrwrap">
            {qr ? (
              <div className="qrbox">
                <img src={qr} alt="QR" />
              </div>
            ) : <div className="small">Generuji QR…</div>}
            <div className="small">Hráči se připojí pouze naskenováním QR. (Žádné opisování ID.)</div>
          </div>
        </div>

        <div className="card">
          <h2>Stav hry</h2>
          {game ? (
            <>
              <div className="pillrow">
                <span className="pill cyan">Roků: {game.years}</span>
                <span className="pill orange">Hráčů: {game.maxPlayers}</span>
                <span className="pill green">Připojeno: {readyCount}/{maxPlayers}</span>
              </div>
              <div className="hr"></div>
              <ul className="list">
                {players.map((p)=>(
                  <li key={p.id}>
                    <span>{p.name}</span>
                    <span className="badge">{p.role === "GM" ? "GM" : "Hráč"}</span>
                  </li>
                ))}
              </ul>
              {isGM ? (
                <button className="btn" disabled={!canStart} onClick={startGame}>
                  Spustit hru
                </button>
              ) : (
                <div className="small">Čekej na spuštění hry GM.</div>
              )}
            </>
          ) : (
            <div className="small">Načítám…</div>
          )}

          {error ? <div className="notice" style={{borderColor:"rgba(255,77,109,.35)", background:"rgba(255,77,109,.10)", color:"#ffd3db"}}>{error}</div> : null}

          <button className="btn secondary" onClick={()=>router.push("/")}>← Zpět do menu</button>
        </div>
      </div>
    </div>
  );
}
