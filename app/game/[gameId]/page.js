"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { stopAudio } from "../../../lib/audio";
import { getSocket } from "../../../lib/socket";

export default function Game(){
  const { gameId } = useParams();
  const router = useRouter();
  const [state, setState] = useState(null);

  useEffect(()=>{
    stopAudio();
    try{
      const s = getSocket();
      s.emit("get_game_state", { gameId }, (res)=>{
        if (res?.ok) setState(res.state);
      });
    }catch{}
  }, [gameId]);

  return (
    <div className="container">
      <div className="hero">
        <h1 className="title">KRYPTOPOLY</h1>
        <p className="subtitle">Rok 1 – Fáze 1 (test)</p>
      </div>

      <div className="card">
        <h2>Hra běží</h2>
        <div className="small">
          Toto je testovací obrazovka. Zvuk hodin je vypnut. Další fáze doplníme podle pravidel.
        </div>
        <div className="hr"></div>
        <div className="small">GameID: {gameId}</div>
        {state ? <pre style={{whiteSpace:"pre-wrap", fontSize:12, color:"#b7c7e6"}}>{JSON.stringify(state,null,2)}</pre> : null}
        <button className="btn secondary" onClick={()=>router.push(`/lobby/${gameId}`)}>← Zpět do lobby</button>
      </div>
    </div>
  );
}
