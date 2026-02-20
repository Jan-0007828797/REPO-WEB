"use client";

import { useEffect, useState } from "react";
import { loadName, saveName } from "../lib/storage";
import { useRouter } from "next/navigation";

export default function Home(){
  const [name, setName] = useState("");
  const router = useRouter();

  useEffect(()=>{ setName(loadName()); },[]);

  const onName = (v)=>{
    setName(v);
    saveName(v);
  };

  return (
    <div className="container">
      <div className="hero">
        <h1 className="title">KRYPTOPOLY</h1>
        <p className="subtitle">Testovací menu – kryptoměny • průmysl • zemědělství • těžba</p>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Profil hráče</h2>
          <label>Jméno</label>
          <input value={name} onChange={(e)=>onName(e.target.value)} placeholder="Např. GM / Adam / Eva" />
          <div className="pillrow">
            <span className="pill cyan">Crypto</span>
            <span className="pill orange">Industry</span>
            <span className="pill green">Agro</span>
            <span className="pill yellow">Energy</span>
          </div>
          <p className="small">Jméno se uloží do tohoto zařízení (pro test). Pro připojení vždy použij QR.</p>
        </div>

        <div className="card">
          <h2>Herní menu</h2>
          <button className="btn" disabled={!name.trim()} onClick={()=>router.push("/create")}>
            🎩 Vytvořit hru (GM)
          </button>
          <button className="btn secondary" disabled={!name.trim()} onClick={()=>router.push("/join")}>
            📷 Připojit se ke hře (QR)
          </button>
          <div className="notice">
            Tip: Pokud se něco zasekne, nejčastější příčina je špatná server URL nebo mezera v env proměnné.
          </div>
        </div>
      </div>
    </div>
  );
}
