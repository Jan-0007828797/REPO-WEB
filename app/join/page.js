"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadName } from "../../lib/storage";
import { unlockAndPlay } from "../../lib/audio";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function Join(){
  const router = useRouter();
  const [name, setName] = useState("");
  const [consentCam, setConsentCam] = useState(false);
  const [consentAudio, setConsentAudio] = useState(false);
  const [phase, setPhase] = useState("consent"); // consent | scan
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const codeReader = useMemo(()=> new BrowserMultiFormatReader(), []);

  useEffect(()=>{ setName(loadName()); },[]);

  async function startScan(){
    setError("");
    if (!consentCam || !consentAudio) return;

    // unlock audio now (mobile gesture) — sound starts after successful join, but unlock here
    await unlockAndPlay("/sounds/grand_clock_loop.wav").catch(()=>{});
    // stop immediately; we only wanted unlock. It will start after join confirmation in lobby.
    // We'll stop later in join/[gameId] after confirm to re-start properly there.
    // But on some phones play may already start; user expects consent sound ok.
    // We'll let it keep low, and in confirm step we'll restart cleanly.

    setPhase("scan");
  }

  useEffect(()=>{
    if (phase !== "scan") return;
    let active = true;

    (async ()=>{
      try{
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices?.length) throw new Error("Nenalezen fotoaparát.");

        const deviceId = devices[0].deviceId;
        await codeReader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err)=>{
          if (!active) return;
          if (result){
            const text = result.getText();
            // Expect QR to be a URL like /join/<gameId>
            try{
              const u = new URL(text);
              const parts = u.pathname.split("/").filter(Boolean);
              const idx = parts.indexOf("join");
              if (idx >= 0 && parts[idx+1]){
                router.push(`/join/${parts[idx+1]}`);
                return;
              }
            }catch{
              // maybe it's just a gameId
              const id = String(text || "").trim();
              if (id) router.push(`/join/${id}`);
            }
          }
        });
      }catch(e){
        setError(String(e?.message || e));
      }
    })();

    return ()=>{
      active = false;
      try{ codeReader.reset(); }catch{}
    };
  }, [phase, codeReader, router]);

  return (
    <div className="container">
      <div className="hero">
        <h1 className="title">KRYPTOPOLY</h1>
        <p className="subtitle">Připojení ke hře (QR)</p>
      </div>

      {phase === "consent" ? (
        <div className="card">
          <h2>Souhlas</h2>
          <p className="small">Pro připojení potřebujeme kameru (QR) a možnost přehrát zvuk (atmosféra v lobby).</p>

          <div className="hr"></div>

          <label style={{display:"flex", gap:10, alignItems:"center"}}>
            <input type="checkbox" style={{width:26, height:26, marginTop:0}} checked={consentCam} onChange={(e)=>setConsentCam(e.target.checked)} />
            Souhlasím s použitím fotoaparátu
          </label>

          <label style={{display:"flex", gap:10, alignItems:"center"}}>
            <input type="checkbox" style={{width:26, height:26, marginTop:0}} checked={consentAudio} onChange={(e)=>setConsentAudio(e.target.checked)} />
            Souhlasím s přehráváním zvuku
          </label>

          {error ? <div className="notice" style={{borderColor:"rgba(255,77,109,.35)", background:"rgba(255,77,109,.10)", color:"#ffd3db"}}>{error}</div> : null}

          <button className="btn" disabled={!consentCam || !consentAudio || !name.trim()} onClick={startScan}>
            Otevřít QR skener
          </button>
          <button className="btn secondary" onClick={()=>router.push("/")}>← Zpět</button>
        </div>
      ) : (
        <div className="card">
          <h2>Skenuj QR kód hry</h2>
          <div className="notice">Pokud se neobjeví systémový dotaz na kameru, zkontroluj oprávnění pro tento web v nastavení prohlížeče.</div>
          {error ? <div className="notice" style={{borderColor:"rgba(255,77,109,.35)", background:"rgba(255,77,109,.10)", color:"#ffd3db"}}>{error}</div> : null}
          <div style={{borderRadius:16, overflow:"hidden", border:"2px solid rgba(0,240,255,.22)"}}>
            <video ref={videoRef} style={{width:"100%"}} />
          </div>
          <button className="btn secondary" onClick={()=>setPhase("consent")}>← Zpět na souhlas</button>
        </div>
      )}
    </div>
  );
}
