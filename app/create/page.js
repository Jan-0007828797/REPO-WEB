"use client";

import { useEffect, useState } from "react";
import { loadName } from "../../lib/storage";
import { getSocket, resetSocket } from "../../lib/socket";
import { useRouter } from "next/navigation";

export default function Create(){
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Kryptopoly – Test");
  const [years, setYears] = useState(3);
  const [players, setPlayers] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{ setName(loadName()); },[]);

  async function onCreate(){
    setError("");
    setBusy(true);
    try{
      const s = getSocket();
      s.emit("create_game", {
        gmName: name.trim(),
        title: title.trim(),
        years: Number(years),
        maxPlayers: Number(players),
      }, (res)=>{
        if (!res?.ok) {
          setError(res?.error || "Nepodařilo se vytvořit hru.");
          setBusy(false);
          return;
        }
        router.push(`/lobby/${res.gameId}?role=gm`);
      });
    }catch(e){
      setError(String(e?.message || e));
      resetSocket();
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="hero">
        <h1 className="title">KRYPTOPOLY</h1>
        <p className="subtitle">Vytvoření hry (GM)</p>
      </div>

      <div className="card">
        <div className="row">
          <div>
            <label>Název hry</label>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} />
          </div>
          <div>
            <label>Počet roků</label>
            <select value={years} onChange={(e)=>setYears(e.target.value)}>
              {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Počet hráčů (včetně GM)</label>
            <select value={players} onChange={(e)=>setPlayers(e.target.value)}>
              {[2,3,4,5,6].map(n=>(
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {error ? <div className="notice" style={{borderColor:"rgba(255,77,109,.35)", background:"rgba(255,77,109,.10)", color:"#ffd3db"}}>{error}</div> : null}

        <button className="btn" disabled={!name.trim() || busy} onClick={onCreate}>
          {busy ? "Vytvářím…" : "Vytvořit hru"}
        </button>

        <button className="btn secondary" onClick={()=>router.push("/")}>← Zpět</button>
      </div>
    </div>
  );
}
