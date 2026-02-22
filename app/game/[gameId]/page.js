"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "../../../lib/socket";
import { loadPlayerId } from "../../../lib/storage";
import { stopClock, playClock, playRing, stopRing } from "../../../lib/audio";
import { BottomBar, Modal } from "../../ui";
import { BrowserMultiFormatReader } from "@zxing/browser";

function pickBackCamera(devices = []) {
  const byLabel = devices.find((d) => /back|rear|environment/i.test(d.label || ""));
  if (byLabel) return byLabel;
  return devices[devices.length - 1] || null;
}

export default function GamePage() {
  const { gameId } = useParams();
  const r = useRouter();

  const playerId = useMemo(() => (typeof window === "undefined" ? "" : loadPlayerId()), []);
  const [gs, setGs] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState(null);

  // scan
  const [scanOn, setScanOn] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const videoRef = useRef(null);
  const codeReader = useMemo(() => new BrowserMultiFormatReader(), []);

  // po startu hry vypneme lobby hodiny
  useEffect(() => {
    stopClock();
    stopRing();
  }, []);

  useEffect(() => {
    const s = getSocket();
    s.emit("watch_game", { gameId }, (res) => {
      if (!res?.ok) setErr(res?.error || "Nelze načíst hru.");
    });
    const onState = (state) => {
      if (state?.gameId !== gameId) return;
      setGs(state);
    };
    s.on("game_state", onState);
    return () => s.off("game_state", onState);
  }, [gameId]);

  const me = gs?.players?.find((p) => p.playerId === playerId) || null;
  const isGM = me?.role === "GM";
  const step = gs?.fsm?.step || "";

  // Timer UI refresh
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const timerLeft = gs?.fsm?.timerEndsAt ? Math.max(0, Math.ceil((gs.fsm.timerEndsAt - now) / 1000)) : null;

  function submit(actionType, data) {
    setErr("");
    const s = getSocket();
    s.emit("submit_action", { gameId, playerId, actionType, data }, (res) => {
      if (!res?.ok) setErr(res?.error || "Akce selhala.");
    });
  }

  // Zvuky: tikání během kroků s časem / volbami
  useEffect(() => {
    if (!gs) return;
    // kroky, kde chceme slyšet hodiny
    const clockSteps = new Set(["F1_ML_BID", "F1_MOVE", "F1_ENVELOPE", "F2_CRYPTO", "F3_CLOSE"]);
    if (clockSteps.has(step)) playClock();
    else stopClock();
    // lobbista lastcall = zvonění
    if (step === "F1_LOBBY_LASTCALL") {
      // zvoní jen hráčům, kteří použili lobbistu
      const usedLobby = gs?.stepData?.envelope?.[playerId]?.usedLobby === true;
      if (usedLobby) playRing(); else stopRing();
    } else {
      stopRing();
    }
  }, [gs, step, playerId]);

  // SCAN: zapínáme jen v kroku F1_SCAN
  useEffect(() => {
    if (step !== "F1_SCAN") {
      setScanOn(false);
      try { codeReader.reset(); } catch {}
      return;
    }
  }, [step, codeReader]);

  useEffect(() => {
    if (!scanOn) return;
    let active = true;
    setScanErr("");
    (async () => {
      try {
        // preferuj zadní kameru
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices?.length) throw new Error("Kamera nenalezena");
        const back = pickBackCamera(devices);
        const deviceId = back?.deviceId || devices[0].deviceId;
        await codeReader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
          if (!active) return;
          if (result) {
            const cardId = String(result.getText() || "").trim().replace(/\s+/g, "");
            if (cardId) {
              active = false;
              try { codeReader.reset(); } catch {}
              setScanOn(false);
              submit("SCAN_CARD", { cardId });
            }
          }
        });
      } catch (e) {
        setScanErr(String(e?.message || e));
      }
    })();
    return () => {
      active = false;
      try { codeReader.reset(); } catch {}
    };
  }, [scanOn, codeReader]);

  if (!playerId) {
    return (
      <div className="container">
        <div className="header"><h1 className="brand">KRYPTOPOLY</h1></div>
        <div className="card">
          <div className="notice">Chybí playerId. Vrať se do lobby a připoj se znovu.</div>
          <button className="btn" onClick={() => r.push("/")}>Zpět</button>
        </div>
      </div>
    );
  }

  if (!gs) {
    return (
      <div className="container">
        <div className="header"><h1 className="brand">KRYPTOPOLY</h1></div>
        <div className="card">Načítám hru…</div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: 92 }}>
      <div className="header">
        <h1 className="brand">KRYPTOPOLY</h1>
        <div className="timer">
          {gs.fsm.year}. rok • F{gs.fsm.phase} • {step}{timerLeft != null ? ` • ⏳ ${timerLeft}s` : ""}
        </div>
        <button className="iconBtn" onClick={() => r.push(`/lobby/${gameId}`)}>🏠</button>
      </div>

      {err ? <div className="notice">{err}</div> : null}

      <div className="card">
        <div className="pills">
          <span className="pill">👥 {gs.players.length}/{gs.config.maxPlayers}</span>
          <span className="pill">🎭 {isGM ? "GM" : "Hráč"}</span>
          <span className="pill">🎲 {gs.gameId}</span>
        </div>

        <ul className="list" style={{ marginTop: 10 }}>
          {gs.players.map((p) => (
            <li key={p.playerId}>
              <span>{p.name}</span>
              <span className="badge">{p.role === "GM" ? "GM" : "Hráč"}</span>
            </li>
          ))}
        </ul>

        {/* --- STEP UI --- */}
        {step === "F1_ML_BID" ? (
          <StepML onSubmit={submit} />
        ) : step === "F1_MOVE" ? (
          <StepMove gs={gs} onSubmit={submit} playerId={playerId} />
        ) : step === "F1_ENVELOPE" ? (
          <StepEnvelope gs={gs} onSubmit={submit} playerId={playerId} />
        ) : step === "F1_LOBBY_LASTCALL" ? (
          <StepLastCall gs={gs} onSubmit={submit} playerId={playerId} />
        ) : step === "F1_SCAN" ? (
          <StepScan gs={gs} isGM={isGM} scanOn={scanOn} setScanOn={setScanOn} scanErr={scanErr} videoRef={videoRef} onNextPhase={() => submit("NEXT_PHASE", {})} />
        ) : step === "F2_CRYPTO" ? (
          <StepCrypto gs={gs} onSubmit={submit} playerId={playerId} />
        ) : step === "F3_CLOSE" ? (
          <StepF3 gs={gs} onSubmit={submit} playerId={playerId} />
        ) : step === "F3_RESULT" ? (
          <StepResult gs={gs} playerId={playerId} />
        ) : step === "ENDED" ? (
          <div className="hideChoice">Hra skončila.</div>
        ) : (
          <div className="hideChoice">Čekám na další krok…</div>
        )}
      </div>

      <BottomBar onTab={setTab} />
      {tab ? (
        <Modal title={tab === "accounting" ? "Účetnictví" : tab === "assets" ? "Aktiva" : tab === "experts" ? "Experti" : "Trendy"} onClose={() => setTab(null)}>
          <Panel tab={tab} gs={gs} playerId={playerId} />
        </Modal>
      ) : null}
    </div>
  );
}

function StepML({ onSubmit }) {
  const [bid, setBid] = useState("0");
  return (
    <div style={{ marginTop: 12 }}>
      <input className="bigInput" value={bid} onChange={(e) => setBid(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Nabídka USD" />
      <div className="row">
        <button className="btn" onClick={() => onSubmit("ML_BID", { want: true, bid: Number(bid || 0) })}>Potvrdit</button>
        <button className="btn secondary" onClick={() => onSubmit("ML_BID", { want: false })}>Nechci být ML</button>
      </div>
    </div>
  );
}

function StepMove({ gs, onSubmit, playerId }) {
  const me = gs.players.find((p) => p.playerId === playerId);
  const myMarket = me?.market?.marketId || null;
  const taken = new Set(Object.values(gs.stepData?.moves || {}).map((v) => v.marketId).filter(Boolean));
  const markets = (gs.seed?.markets12 || []).length ? gs.seed.markets12 : Array.from({ length: 12 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`);
  // kontinenty pro jednoduchost nabídneme EU/ASIA/… (server stejně jen uloží string)
  const continents = ["EUROPE", "ASIA", "AFRICA", "N_AMERICA", "S_AMERICA", "OCEANIA"];
  const [continent, setContinent] = useState(me?.market?.continent || "EUROPE");

  return (
    <div style={{ marginTop: 12 }}>
      <div className="pills"><span className="pill">📍 Vyber trh</span><span className="pill">🌍 {continent}</span></div>
      <div className="row" style={{ marginTop: 10 }}>
        <select className="bigInput" value={continent} onChange={(e) => setContinent(e.target.value)}>
          {continents.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
        {markets.map((m) => {
          const disabled = taken.has(m) && myMarket !== m;
          return (
            <button key={m} className={disabled ? "btn secondary" : "btn"} disabled={disabled} onClick={() => onSubmit("MOVE_SELECT", { marketId: m, continent })}>
              {m}{disabled ? " ✖" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepEnvelope({ gs, onSubmit, playerId }) {
  const [bid, setBid] = useState("0");
  const [useLobby, setUseLobby] = useState(false);
  const already = gs.stepData?.envelope?.[playerId];
  return (
    <div style={{ marginTop: 12 }}>
      <div className="pills"><span className="pill">✉️ Obálka</span></div>
      {already ? <div className="hideChoice">Hotovo – čekám na ostatní…</div> : (
        <>
          <input className="bigInput" value={bid} onChange={(e) => setBid(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Nabídka USD" />
          <div className="row">
            <button className="btn" onClick={() => onSubmit("ENVELOPE_BID", { want: true, bid: Number(bid || 0), useLobby })}>Potvrdit</button>
            <button className="btn secondary" onClick={() => onSubmit("ENVELOPE_BID", { want: false, useLobby })}>Nechci dražit</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className={useLobby ? "btn" : "btn secondary"} onClick={() => setUseLobby((v) => !v)}>
              📞 {useLobby ? "Lobbista: ANO" : "Lobbista: NE"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StepLastCall({ gs, onSubmit, playerId }) {
  const entry = gs.stepData?.envelope?.[playerId];
  const usedLobby = entry?.usedLobby === true;
  const [finalBid, setFinalBid] = useState(String(entry?.finalBid ?? entry?.bid ?? 0));
  const others = Object.entries(gs.stepData?.envelope || {}).map(([pid, v]) => ({ pid, bid: v.bid, usedLobby: v.usedLobby })).filter((x) => x.pid !== playerId);
  if (!usedLobby) return <div className="hideChoice">Čekám…</div>;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="pills"><span className="pill">📞 Lobbista</span><span className="pill">Vidíš nabídky</span></div>
      <ul className="list" style={{ marginTop: 10 }}>
        {others.map((o) => (
          <li key={o.pid}><span>Protihráč</span><span className="badge">{o.bid == null ? "—" : `${o.bid} USD`}</span></li>
        ))}
      </ul>
      <input className="bigInput" value={finalBid} onChange={(e) => setFinalBid(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Finální nabídka" />
      <button className="btn" onClick={() => onSubmit("LOBBY_FINAL_BID", { finalBid: Number(finalBid || 0) })}>Potvrdit finální nabídku</button>
    </div>
  );
}

function StepScan({ gs, isGM, scanOn, setScanOn, scanErr, videoRef, onNextPhase }) {
  const res = gs.stepData?.auctionResult;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="pills"><span className="pill">📦 Sken karet</span></div>
      {res?.card ? (
        <div className="hideChoice">Draženo: <b>{res.card.name}</b> • Výsledek: {res.wonBy ? "někdo vyhrál" : "nikdo"} {res.bid!=null ? `(${res.bid} USD)` : ""}</div>
      ) : null}
      {scanErr ? <div className="notice">{scanErr}</div> : null}
      {scanOn ? (
        <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,240,255,.22)", marginTop: 10 }}>
          <video ref={videoRef} style={{ width: "100%" }} />
        </div>
      ) : (
        <button className="btn" onClick={() => setScanOn(true)}>📷 Spustit sken</button>
      )}
      {isGM ? (
        <button className="btn secondary" onClick={onNextPhase} style={{ marginTop: 8 }}>▶ Přejít na Fázi 2</button>
      ) : null}
    </div>
  );
}

function StepCrypto({ gs, onSubmit, playerId }) {
  const prices = gs.prices || { BTC: 100, ETH: 50, LTC: 20, SIA: 5 };
  const me = gs.players.find((p) => p.playerId === playerId);
  const wallet = me?.wallet || {};
  const entry = gs.stepData?.crypto?.[playerId] || { trades: {}, confirm: false };
  const syms = ["BTC", "ETH", "LTC", "SIA"];
  const [local, setLocal] = useState(entry.trades || {});
  useEffect(() => setLocal(entry.trades || {}), [entry.trades]);

  const deltaUSD = syms.reduce((s, sym) => s + (Number(local[sym] || 0) * prices[sym]), 0);

  function setDelta(sym, v) {
    const next = { ...local, [sym]: v };
    setLocal(next);
    onSubmit("CRYPTO_SET", { sym, delta: v });
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="pills"><span className="pill">💱 Kryptoburza</span><span className="pill">Δ USD: {deltaUSD}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 10 }}>
        {syms.map((sym) => {
          const d = Number(local[sym] || 0);
          return (
            <div key={sym} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 900 }}>{sym}</div>
                <div className="badge">Cena: {prices[sym]} USD</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                <div>Máte: <b>{wallet[sym] || 0}</b></div>
                <div>Δ: <b>{d}</b></div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn secondary" onClick={() => setDelta(sym, Math.max(-10, d - 1))}>Prodej -1</button>
                <button className="btn" onClick={() => setDelta(sym, Math.min(10, d + 1))}>Nákup +1</button>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn" onClick={() => onSubmit("CRYPTO_CONFIRM", {})} style={{ marginTop: 10 }}>
        {entry.confirm ? "✅ Potvrzeno" : "Potvrdit kryptotransakci"}
      </button>
    </div>
  );
}

function StepF3({ gs, onSubmit, playerId }) {
  const preview = gs.stepData?.settlement?.[playerId];
  return (
    <div style={{ marginTop: 12 }}>
      <div className="pills"><span className="pill">🧾 Fáze 3</span></div>
      <div className="hideChoice">Potvrď konec roku. (Výpočet se provede po potvrzení všech hráčů.)</div>
      <button className="btn" onClick={() => onSubmit("F3_SUBMIT", {})}>Potvrdit konec roku</button>
      {preview ? (
        <div style={{ marginTop: 10 }}>
          <div className="badge">Náhled: {preview.totalUSD} USD • Krypto: {preview.cryptoValueUSD} USD</div>
        </div>
      ) : null}
    </div>
  );
}

function StepResult({ gs, playerId }) {
  const s = gs.stepData?.settlement?.[playerId];
  if (!s) return <div className="hideChoice">Výsledek se načítá…</div>;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="pills"><span className="pill">✅ Vyúčtování</span></div>
      <ul className="list" style={{ marginTop: 10 }}>
        <li><span>Základ</span><span className="badge">{s.baseUSD} USD</span></li>
        <li><span>Globální</span><span className="badge">{s.globalUSD} USD</span></li>
        <li><span>Regionální</span><span className="badge">{s.regionalUSD} USD</span></li>
        <li><span>Elektřina</span><span className="badge">-{s.electricityUSD} USD</span></li>
        <li><span>Celkem</span><span className="badge">{s.totalUSD} USD</span></li>
        <li><span>Krypto hodnota</span><span className="badge">{s.cryptoValueUSD} USD</span></li>
      </ul>
      <div className="hideChoice" style={{ marginTop: 10 }}>GM pokračuje do dalšího roku automaticky po výpočtu.</div>
    </div>
  );
}

function Panel({ tab, gs, playerId }) {
  if (tab === "assets") {
    const myAssets = (gs.assets || []).filter((a) => a.owner?.playerId === playerId);
    return (
      <div>
        <div className="pills"><span className="pill">🧱 Moje aktiva</span></div>
        <ul className="list" style={{ marginTop: 10 }}>
          {myAssets.length ? myAssets.map((a) => (
            <li key={a.assetId}><span>{a.name}</span><span className="badge">{a.type}</span></li>
          )) : <li><span>Nemáš žádná aktiva</span><span className="badge">—</span></li>}
        </ul>
      </div>
    );
  }
  if (tab === "experts") {
    const myEx = (gs.assets || []).filter((a) => a.owner?.playerId === playerId && a.type === "EXPERT");
    return (
      <div>
        <div className="pills"><span className="pill">🧑‍🔧 Experti</span></div>
        <ul className="list" style={{ marginTop: 10 }}>
          {myEx.length ? myEx.map((a) => (
            <li key={a.assetId}><span>{a.name}</span><span className="badge">{a.rules?.functionLabel || "Expert"}</span></li>
          )) : <li><span>Nemáš experty</span><span className="badge">—</span></li>}
        </ul>
      </div>
    );
  }
  if (tab === "trends") {
    const years = gs.seed?.years || [];
    return (
      <div>
        <div className="pills"><span className="pill">🗺️ Trendy</span></div>
        {years.map((y) => (
          <div key={y.year} className="card" style={{ padding: 12, marginTop: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Rok {y.year}</div>
            <div className="badge">Globální: {y.globals.map((t) => t.name).join(", ")}</div>
            <div className="badge" style={{ marginTop: 6 }}>Krypto: {y.crypto?.name || "—"}</div>
          </div>
        ))}
      </div>
    );
  }
  // accounting
  const me = gs.players.find((p) => p.playerId === playerId);
  const wallet = me?.wallet || {};
  const prices = gs.prices || { BTC: 100, ETH: 50, LTC: 20, SIA: 5 };
  const cryptoValue = Object.keys(prices).reduce((s, k) => s + (wallet[k] || 0) * prices[k], 0);
  return (
    <div>
      <div className="pills"><span className="pill">🧾 Účetnictví</span></div>
      <ul className="list" style={{ marginTop: 10 }}>
        {Object.keys(prices).map((k) => (
          <li key={k}><span>{k}: {wallet[k] || 0} ks</span><span className="badge">{(wallet[k] || 0) * prices[k]} USD</span></li>
        ))}
        <li><span>Krypto celkem</span><span className="badge">{cryptoValue} USD</span></li>
      </ul>
    </div>
  );
}
