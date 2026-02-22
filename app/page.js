"use client";
import { useEffect, useState } from "react";
import { loadName, saveName } from "../lib/storage";
import { useRouter } from "next/navigation";
export default function Home(){
  const [name,setName]=useState("");
  const r=useRouter();
  useEffect(()=>setName(loadName()),[]);
  return (
    <div className="container">
      <div className="header"><h1 className="brand">KRYPTOPOLY</h1></div>
      <div className="card">
        <input className="bigInput" value={name} onChange={(e)=>{setName(e.target.value); saveName(e.target.value);}} placeholder="Jméno" />
        <div className="row">
          <button className="btn" disabled={!name.trim()} onClick={()=>r.push("/create")}>🎩 GM</button>
          <button className="btn secondary" disabled={!name.trim()} onClick={()=>r.push("/join")}>📷 QR</button>
        </div>
      </div>
    </div>
  );
}
