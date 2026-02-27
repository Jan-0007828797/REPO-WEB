"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { getSocket } from "../../../lib/socket";
import { loadPlayerId } from "../../../lib/storage";
import { playClock, stopClock, playRing, stopRing } from "../../../lib/audio";
import { BottomBar, BottomBarWrapper, Modal } from "../../ui";

function SuperTopModal({ title, onClose, children }){
  // Same behavior/markup as Modal, but guaranteed above other modals.
  useEffect(()=>{ const onKey=(e)=>{ if(e.key==="Escape") onClose?.(); }; window.addEventListener("keydown", onKey); return ()=>window.removeEventListener("keydown", onKey); },[onClose]);
  return (
    <div className="modalBackdrop top superTop" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="modal">
        <div className="modalHeader">
          <div style={{fontWeight:900,fontSize:18}}>{title}</div>
          <button className="iconBtn" onClick={onClose}>✕</button>
        </div>
        <div style={{height:1,background:"rgba(255,255,255,.10)",margin:"12px 0"}}></div>
        {children}
      </div>
    </div>
  );
}

function GMTopModal({ title, onClose, children }){
  // Absolute priority above everything; blocks the game from getting stuck.
  useEffect(()=>{ const onKey=(e)=>{ if(e.key==="Escape") onClose?.(); }; window.addEventListener("keydown", onKey); return ()=>window.removeEventListener("keydown", onKey); },[onClose]);
  return (
    <div className="modalBackdrop gmTop" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="modal">
        <div className="modalHeader">
          <div style={{fontWeight:900,fontSize:18}}>{title}</div>
          <button className="iconBtn" onClick={onClose}>✕</button>
        </div>
        <div style={{height:1,background:"rgba(255,255,255,.10)",margin:"12px 0"}}></div>
        {children}
      </div>
    </div>
  );
}

function MonoIcon({ name, size=28, className="" }){
  // Monochrome, bold icons (not emoji) – consistent across the whole app.
  const s = Number(size)||28;
  const common = { viewBox:"0 0 64 64", width:s, height:s, fill:"none", stroke:"currentColor", strokeWidth:5, strokeLinecap:"round", strokeLinejoin:"round" };
  if(name==="crown"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <path d="M10 44l6-22 16 14 16-14 6 22" />
        <path d="M14 44h36" />
        <path d="M18 52h28" />
      </svg>
    );
  }
  if(name==="pin"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <path d="M32 58s16-14 16-30a16 16 0 10-32 0c0 16 16 30 16 30z" />
        <circle cx="32" cy="28" r="6" />
      </svg>
    );
  }
  if(name==="envelope"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <rect x="10" y="18" width="44" height="28" rx="6" />
        <path d="M12 20l20 16 20-16" />
      </svg>
    );
  }
  if(name==="camera"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <path d="M20 20l4-6h16l4 6" />
        <rect x="12" y="20" width="40" height="30" rx="8" />
        <circle cx="32" cy="35" r="9" />
      </svg>
    );
  }
  if(name==="btc"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <path d="M26 12v40" />
        <path d="M38 12v40" />
        <path d="M22 18h16a8 8 0 010 16H22" />
        <path d="M22 34h18a7 7 0 010 14H22" />
      </svg>
    );
  }
  if(name==="receipt"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <path d="M18 10h28v44l-4-3-4 3-4-3-4 3-4-3-4 3V10z" />
        <path d="M24 22h16" />
        <path d="M24 30h16" />
        <path d="M24 38h12" />
      </svg>
    );
  }
  // Investment type marks (monochrome). Color is carried by the background/border.
  if(name==="agri"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <path d="M22 50V18" />
        <path d="M32 50V14" />
        <path d="M42 50V18" />
        <path d="M22 26c6 0 10-4 10-10" />
        <path d="M42 26c-6 0-10-4-10-10" />
        <path d="M22 36c6 0 10-4 10-10" />
        <path d="M42 36c-6 0-10-4-10-10" />
      </svg>
    );
  }
  if(name==="mining"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <path d="M14 44l14-14 8 8 14-14" />
        <path d="M10 48h44" />
        <path d="M26 22l6-6 6 6" />
      </svg>
    );
  }
  if(name==="industry"){
    return (
      <svg {...common} className={className} aria-hidden="true">
        <path d="M14 50V30l14 8V30l14 8V22l8 6v22H14z" />
        <path d="M22 50V40" />
        <path d="M30 50V40" />
        <path d="M38 50V40" />
      </svg>
    );
  }
  return null;
}

function badgeFor(kind){
  if(kind==="ML") return { icon:"crown", label:"MARKET LEADER" };
  if(kind==="AUCTION") return { icon:"envelope", label:"DRAŽBA – OBÁLKA" };
  if(kind==="CRYPTO") return { icon:"btc", label:"KRYPTOTRANSAKCE" };
  if(kind==="SETTLE") return { icon:"receipt", label:"AUDIT" };
  return { icon:null, label:"" };
}

function PhaseBar({ phase, bizStep }){
  // Top bar: always show the whole game flow (no popups; fixed screens).
  // Trends are NOT a phase anymore (still available via bottom tab "Trendy").
  const phases = [
    { key:"ML_BID", label:"Market Leader", icon:"crown" },
    { key:"MOVE", label:"Výběr trhu", icon:"pin" },
    { key:"AUCTION_ENVELOPE", label:"Dražba", icon:"envelope" },
    { key:"ACQUIRE", label:"Akvizice", icon:"camera" },
    { key:"CRYPTO", label:"Kryptoburza", icon:"btc" },
    { key:"SETTLE", label:"Audit", icon:"receipt" },
  ];

  const activeKey = (()=>{
    if(phase==="BIZ") return bizStep;
    if(phase==="CRYPTO") return "CRYPTO";
    if(phase==="SETTLE") return "SETTLE";
    return null;
  })();

  return (
    <div className="stepRow" aria-label="Fáze hry">
      {phases.map(p=>{
        const active = p.key===activeKey;
        return (
          <div key={p.key} className={"stepChip"+(active?" active":"")}>
            <span className="stepIcon" aria-hidden="true"><MonoIcon name={p.icon} size={36} /></span>
            <span className="stepText">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function PrivacyCard({ kind, mode, amountText, onReveal, onHide }){
  const b = badgeFor(kind);
  if(mode==="edit") return null;
  return (
    <div className="privacyBackdrop">
      <div className="privacyFull">
        <div className="privacyBadge">
          {b.icon ? <span className="privacyEmoji" aria-hidden="true"><MonoIcon name={b.icon} size={30} /></span> : null}
          <span className="privacyLabel">{b.label}</span>
        </div>

        {mode==="hidden" ? (
          <>
            <div className="privacyHidden">🔒</div>
            <button className="primaryBtn big full" onClick={onReveal}>ODKRÝT</button>
          </>
        ) : (
          <>
            <div className="privacyAmount">{amountText}</div>
            <button className="secondaryBtn big full" onClick={onHide}>SKRÝT</button>
          </>
        )}
      </div>
    </div>
  );
}

function pickBackCamera(devices = []) {
  const byLabel = devices.find((d) => /back|rear|environment/i.test(d.label || ""));
  if (byLabel) return byLabel;
  return devices[devices.length - 1] || null;
}

export default function GamePage(){
  const { gameId } = useParams();
  const router = useRouter();
  const playerId = useMemo(()=> (typeof window==="undefined" ? "" : loadPlayerId()), []);
  // Socket must be initialized before any hooks that reference it (dependency arrays are evaluated during render).
  const s = useMemo(()=> getSocket(), []);
  const [gs, setGs] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState(null);
  const [gmPanelOpen, setGmPanelOpen] = useState(false);
  const [trendModal, setTrendModal] = useState(null); // {name, icon, desc}
  const [regionalModal, setRegionalModal] = useState(null); // {continent, name, icon, desc}
  const [mlTrendIntroOpen, setMlTrendIntroOpen] = useState(false);

  // local privacy modes
  const [mlPrivacy, setMlPrivacy] = useState("edit");       // edit|hidden|reveal
  const [aucPrivacy, setAucPrivacy] = useState("edit");
  const [cryptoPrivacy, setCryptoPrivacy] = useState("edit");
  const [settlePrivacy, setSettlePrivacy] = useState("edit");

  // Legacy expert modal state (kept to avoid runtime errors; not used in the new Audit UX)
  const [expertsOpen, setExpertsOpen] = useState(false);
  const [expertPick, setExpertPick] = useState(null);
  const [expertTarget, setExpertTarget] = useState(null);
  const [expertCard, setExpertCard] = useState(null);

  // Privacy overlays are hard-lock (cannot be dismissed; disappear on phase change)

  // inputs
  const [mlBid, setMlBid] = useState("");
  const [aucBid, setAucBid] = useState("");
  const [useLobby, setUseLobby] = useState(false);
  const [aucFinalBid, setAucFinalBid] = useState("");

  const [cryptoD, setCryptoD] = useState({ BTC:0, ETH:0, LTC:0, SIA:0 });

  // Audit (SETTLE) UX state
  const [auditPreview, setAuditPreview] = useState(null); // {settlementUsd, breakdown}
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLobbyOpen, setAuditLobbyOpen] = useState(false);
  const [auditLobbyTarget, setAuditLobbyTarget] = useState(null);
  const [auditLobbyType, setAuditLobbyType] = useState("STEAL");
  const [auditLawyerMode, setAuditLawyerMode] = useState("NONE"); // NONE|BLOCK_TREND|SHIELD_LOBBY
  const [auditLawyerTrendKey, setAuditLawyerTrendKey] = useState("");

  // Acquisition (scan) UI
  const [scanOn, setScanOn] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const [scanPreview, setScanPreview] = useState(null); // {card}
  const [acqMoreOpen, setAcqMoreOpen] = useState(false);
  const [acqHadAny, setAcqHadAny] = useState(false);
  const [acqNoScanLocal, setAcqNoScanLocal] = useState(false); // instant UX feedback
  const videoRef = useRef(null);
  const codeReader = useMemo(()=> new BrowserMultiFormatReader(), []);

  useEffect(()=>{

    s.emit("watch_game", { gameId, playerId }, (res)=>{
      if(!res?.ok) setErr(res?.error || "Nelze načíst hru.");
    });
    const onState = (state)=>{
      if(state?.gameId!==gameId) return;
      setGs(state);
    };
    s.on("game_state", onState);
    return ()=> s.off("game_state", onState);
  }, [gameId]);

  const me = gs?.players?.find(p=>p.playerId===playerId) || null;
  const isGM = me?.role==="GM";

  const uiLocked = (gs?.phase==="BIZ" && gs?.bizStep==="MOVE" && !!gs?.biz?.move?.[playerId]?.committed);
  const setTabSafe = (t)=>{ if(!uiLocked) setTab(t); };

  // Sound logic: clock during interactive steps (except Trends)
  useEffect(()=>{
    stopRing();
    const phase = gs?.phase;
    const bizStep = gs?.bizStep;
    if(!phase) { stopClock(); return; }

    const shouldClock =
      (phase==="BIZ" && bizStep) ||
      (phase==="CRYPTO") ||
      (phase==="SETTLE");

    if(shouldClock) playClock(); else stopClock();

    // lobbyist ringing for users who used lobbyist and need final bid
    if(phase==="BIZ" && bizStep==="AUCTION_ENVELOPE"){
      const entry = gs?.biz?.auction?.entries?.[playerId];
      const active = !!gs?.biz?.auction?.lobbyistPhaseActive;
      if(active && entry?.usedLobbyist && !entry?.finalCommitted){
        playRing();
      }else{
        stopRing();
      }
    }
  }, [gs, playerId]);

  // Load preview when entering SETTLE and not yet committed
  useEffect(()=>{
    if(gs?.phase!=="SETTLE") return;
    const started = !!gs?.settle?.entries?.[playerId]?.started;
    if(started) return;
    setAuditLoading(true);
    s.emit("preview_audit", { gameId, playerId }, (res)=>{
      setAuditLoading(false);
      if(!res?.ok) setAuditPreview({ error: res?.error || "Chyba" });
      else setAuditPreview({ settlementUsd: res.settlementUsd, breakdown: res.breakdown||[] });
    });
  }, [gs?.phase, gameId, playerId]);

  // Reset local states on step changes (so UX is clean)
  useEffect(()=>{
    const phase = gs?.phase;
    const step = gs?.bizStep;
    if(phase==="BIZ" && step==="ML_BID"){
      const committed = !!gs?.biz?.mlBids?.[playerId]?.committed;
      setMlPrivacy(committed ? "hidden" : "edit");
      setMlTrendIntroOpen(true);
    }
    if(phase==="BIZ" && step==="AUCTION_ENVELOPE"){
      const committed = !!gs?.biz?.auction?.entries?.[playerId]?.committed;
      setAucPrivacy(committed ? "hidden" : "edit");
    }
    if(phase==="CRYPTO"){
      const committed = !!gs?.crypto?.entries?.[playerId]?.committed;
      setCryptoPrivacy(committed ? "hidden" : "edit");
    }
    if(phase==="SETTLE"){
      const started = !!gs?.settle?.entries?.[playerId]?.started;
      setSettlePrivacy(started ? "hidden" : "edit");
    }

    // Acquisition step: default scanner OFF, clear preview
    if(phase==="BIZ" && step==="ACQUIRE"){
      setScanOn(false);
      setScanErr("");
      setScanPreview(null);
      setAcqMoreOpen(false);
      setAcqHadAny(false);
    }
  }, [gs?.phase, gs?.bizStep, gs?.year]);

  // Acquisition scanner lifecycle
  useEffect(()=>{
    const phase = gs?.phase;
    const step = gs?.bizStep;
    if(!(phase==="BIZ" && step==="ACQUIRE" && scanOn)){
      try{ codeReader.reset(); }catch{}
      return;
    }
    let active = true;
    setScanErr("");
    (async ()=>{
      try{
        // Prefer back camera
        try{
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
          stream.getTracks().forEach(t=>t.stop());
        }catch{}

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if(!devices?.length) throw new Error("Kamera nenalezena");
        const back = pickBackCamera(devices);
        const deviceId = back?.deviceId || devices[0].deviceId;

        // Higher resolution helps with small QR codes.
        const constraints = {
          audio: false,
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: { ideal: "environment" },
            advanced: [
              // Not all browsers/devices support this, but it's safe to request.
              { focusMode: "continuous" }
            ]
          }
        };

        await codeReader.decodeFromConstraints(constraints, videoRef.current, (result)=>{
          if(!active) return;
          if(result){
            const raw = String(result.getText()||"").trim();
            if(!raw) return;
            // Pause scanning while we confirm
            try{ codeReader.reset(); }catch{}
            active = false;
            // Ask server for preview (does NOT claim)
            s.emit("scan_preview", { gameId, playerId, cardQr: raw }, (res)=>{
              if(!res?.ok){
                setScanErr(res?.error || "Neznámá karta");
                // Resume scanning
                setScanOn(false);
                setTimeout(()=>{ setScanOn(true); }, 250);
                return;
              }
              setScanPreview({ card: res.card });
            });
          }
        });
      }catch(e){
        setScanErr(String(e?.message||e));
      }
    })();
    return ()=>{ active = false; try{ codeReader.reset(); }catch{} };
  }, [gs?.phase, gs?.bizStep, scanOn, codeReader, s, gameId, playerId]);


  function gmNext(){ s.emit("gm_next", { gameId, playerId }, (res)=>{ if(!res?.ok) setErr(res?.error||""); }); }
  function gmBack(){ s.emit("gm_back", { gameId, playerId }, (res)=>{ if(!res?.ok) setErr(res?.error||""); }); }

  // Readiness signal for GM button (GM is also counted as a player)
  const readiness = useMemo(()=>{
    const players = gs?.players || [];
    if(!players.length) return { ready:0, total:0, isGreen:false };

    const pidList = players.map(p=>p.playerId);

    const phase = gs?.phase;
    const step = gs?.bizStep;

    function committedFor(pid){
      if(phase==="BIZ" && step==="ML_BID") return !!gs?.biz?.mlBids?.[pid]?.committed;
      if(phase==="BIZ" && step==="MOVE") return !!gs?.biz?.move?.[pid]?.committed;
      if(phase==="BIZ" && step==="AUCTION_ENVELOPE"){
        const e = gs?.biz?.auction?.entries?.[pid];
        if(!gs?.biz?.auction?.lobbyistPhaseActive) return !!e?.committed;
        // lobbyist final wave: only lobbyists are required
        if(!e?.usedLobbyist) return true;
        return !!e?.finalCommitted;
      }
      if(phase==="BIZ" && step==="ACQUIRE") return !!gs?.biz?.acquire?.entries?.[pid]?.committed;
      if(phase==="CRYPTO") return !!gs?.crypto?.entries?.[pid]?.committed;
      if(phase==="SETTLE") return !!gs?.settle?.entries?.[pid]?.started;
      return false;
    }

    // Total count in lobbyist subphase = only lobbyists (everyone else is auto-ready)
    let totalIds = pidList;
    if(phase==="BIZ" && step==="AUCTION_ENVELOPE" && gs?.biz?.auction?.lobbyistPhaseActive){
      const entries = gs?.biz?.auction?.entries || {};
      totalIds = pidList.filter(pid=>!!entries[pid]?.usedLobbyist);
      if(totalIds.length===0) totalIds = pidList; // safety
    }

    const ready = totalIds.filter(pid=>committedFor(pid)).length;
    const total = totalIds.length;
    return { ready, total, isGreen: total>0 && ready===total };
  }, [gs, playerId]);

  function commitML(amount){
    s.emit("commit_ml_bid", { gameId, playerId, amountUsd: amount }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
      setMlPrivacy("hidden"); // auto hide after commit
    });
  }

  function commitAuction(bid, usedLobbyist){
    s.emit("commit_auction_bid", { gameId, playerId, bidUsd: bid, usedLobbyist }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
      setAucPrivacy("hidden"); // auto hide after commit
    });
  }

  function commitFinalAuction(finalBid){
    s.emit("commit_auction_final_bid", { gameId, playerId, finalBidUsd: finalBid }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
      setAucPrivacy("hidden");
    });
  }

  function pickMarket(marketId){
    s.emit("pick_market", { gameId, playerId, marketId }, (res)=>{
      if(!res?.ok) setErr(res?.error || "Nelze vybrat trh");
    });
  }

  function commitCrypto(){
    s.emit("commit_crypto", { gameId, playerId, deltas: cryptoD }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
      setCryptoPrivacy("hidden");
    });
  }

  function commitSettle(){
    s.emit("commit_settlement_ready", { gameId, playerId }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
      setSettlePrivacy("hidden");
    });
  }

  function auditSetLawyer(next){
    s.emit("audit_set_pending_lawyer", { gameId, playerId, lawyer: next }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
    });
  }

  function auditAddLobby(action){
    s.emit("audit_add_pending_lobby", { gameId, playerId, action }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
    });
  }

  function auditRemoveLobby(index){
    s.emit("audit_remove_pending_lobby", { gameId, playerId, index }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
    });
  }

  function auditPay(){
    s.emit("audit_pay", { gameId, playerId }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
      setSettlePrivacy("hidden");
    });
  }

  function commitAcquire({ gotCard }){
    s.emit("commit_acquire", { gameId, playerId, gotCard: !!gotCard }, (res)=>{
      if(!res?.ok) setErr(res?.error||"Chyba");
    });
  }

  function acceptScannedCard(cardId){
    s.emit("claim_card", { gameId, playerId, cardId }, (res)=>{
      if(!res?.ok) return setErr(res?.error||"Chyba");
      setScanPreview(null);
      setAcqHadAny(true);
      setScanOn(false);
      setAcqMoreOpen(true);
    });
  }

  function rejectScannedCard(){
    setScanPreview(null);
    // back to scanner immediately
    setScanOn(false);
    setTimeout(()=>{ setScanOn(true); }, 200);
  }

  // derived display amounts
  const mlAmount = gs?.biz?.mlBids?.[playerId]?.amountUsd;
  const aucEntry = gs?.biz?.auction?.entries?.[playerId] || null;
  const aucShownBid = (aucEntry?.usedLobbyist && aucEntry?.finalCommitted) ? aucEntry?.finalBidUsd : aucEntry?.bidUsd;
  const cryptoDelta = gs?.crypto?.entries?.[playerId]?.deltaUsd;
  const settleAmount = gs?.settle?.entries?.[playerId]?.finalUsd;

  // Golden rule / UX: Remove redundant phase text under the brand.

  const markets = gs?.catalog?.markets || [];
  const locks = gs?.biz?.marketLocks || {};
  const myMove = gs?.biz?.move?.[playerId];
  const acqEntry = gs?.biz?.acquire?.entries?.[playerId] || null;
  const acqNoScanCommitted = !!acqEntry?.committed && acqEntry?.gotCard===false;

  // Tabs content data
  const myInv = gs?.inventory?.[playerId] || { investments:[], miningFarms:[], experts:[] };
  const myReveals = gs?.reveals?.[playerId] || { globalYearsRevealed:[], cryptoYearsRevealed:[] };

  // Sync local Audit controls from server (so refresh/reconnect keeps UI consistent)
  useEffect(()=>{
    if(gs?.phase!=="SETTLE") return;
    const pend = gs?.settle?.pending?.[playerId] || { lawyer:null, lobby:[] };
    const l = pend.lawyer;
    if(!l){
      setAuditLawyerMode("NONE");
      setAuditLawyerTrendKey("");
    }else if(l.mode==="BLOCK_TREND"){
      setAuditLawyerMode("BLOCK_TREND");
      setAuditLawyerTrendKey(l.trendKey||"");
    }else if(l.mode==="SHIELD_LOBBY"){
      setAuditLawyerMode("SHIELD_LOBBY");
      setAuditLawyerTrendKey("");
    }
  }, [gs?.phase, gs?.settle?.pending?.[playerId], playerId]);

  if(err){
    // keep minimal
  }

  return (
    <div className="screen">
      <div className="topHeader">
        <div className="topHeaderRow">
          <div>
            <div className="brand">KRYPTOPOLY</div>
          </div>
          <div className="topHeaderRight">
            {gs?.year ? <div className="yearPill">Rok {gs.year}</div> : null}
          </div>
        </div>
        <PhaseBar phase={gs?.phase} bizStep={gs?.bizStep} />
      </div>

      {isGM && gs?.status==="IN_PROGRESS" ? (
        <div className="gmFabFixed">
          <button
            className={"gmFab "+(readiness.isGreen?"gmGreen":"gmRed")}
            onClick={()=>{
              if(readiness.isGreen){
                gmNext();
              }else{
                setGmPanelOpen(true);
              }
            }}
            aria-label="GM – další fáze"
          >
            GM <span className="gmCount">{readiness.ready}/{readiness.total}</span>
          </button>
        </div>
      ) : null}

      {err ? <div className="toast" onClick={()=>setErr("")}>{err}</div> : null}

      <div className="content">
        {!gs ? (
          <div className="card"><div className="muted">Načítám hru…</div></div>
        ) : gs.status==="GAME_OVER" ? (
          <div className="card center">
            <div style={{fontSize:28, fontWeight:900}}>Konec hry</div>
            <div className="muted">Díky za testování.</div>
          </div>
        ) : gs.phase==="BIZ" && gs.bizStep==="ML_BID" ? (
          <div className="card phaseCard">
            <div className="phaseHeader">
              <div className="phaseLeft">
                <div className="phaseIcon" aria-hidden="true"><MonoIcon name="crown" size={48} /></div>
                <div>
                  <div className="phaseTitle">Market Leader</div>
                  <div className="phaseSub">Zadej nabídku v USD. Po potvrzení se displej automaticky skryje.</div>
                </div>
              </div>
            </div>

            {/* golden rule: keep button styling (classes) identical; only change layout */}
            <div className="formRow stackConfirm">
              <input
                className="inputBig"
                inputMode="numeric"
                placeholder="0"
                maxLength={8}
                value={mlBid}
                onChange={(e)=>setMlBid(e.target.value.replace(/[^\d]/g,""))}
              />
              <button className="primaryBtn big full" onClick={()=>commitML(mlBid===""?0:Number(mlBid))}>Potvrdit</button>
              <button className="secondaryBtn big full" onClick={()=>commitML(null)}>Nechci být ML</button>
            </div>
          </div>
        ) : gs.phase==="BIZ" && gs.bizStep==="MOVE" ? (
          <div className="card phaseCard">
            <div className="phaseHeader">
              <div className="phaseLeft">
                <div className="phaseIcon" aria-hidden="true"><MonoIcon name="pin" size={48} /></div>
                <div>
                  <div className="phaseTitle">Výběr trhu</div>
                  <div className="phaseSub">Vyber trh. Jakmile klikneš, trh zmizí ostatním. Volba je definitivní.</div>
                </div>
              </div>
            </div>
            {(() => {
              const year = Number(gs?.year || 1);
              const isFarm = (m) => {
                const t = String(m?.type || "").toLowerCase();
                const n = String(m?.name || "").toLowerCase();
                const id = String(m?.marketId || "").toLowerCase();
                return t.includes("farm") || n.includes("farma") || id.startsWith("f");
              };
              const kindOf = (m) => {
                const t = `${m?.type || ""} ${m?.name || ""}`.toLowerCase();
                if (isFarm(m)) return "farm";
                if (t.includes("průmys") || t.includes("prumys") || t.includes("industry")) return "industry";
                if (t.includes("těž") || t.includes("tez") || t.includes("mining") || t.includes("těža") ) return "mining";
                if (t.includes("země") || t.includes("zeme") || t.includes("agri") || t.includes("agriculture")) return "agri";
                return "other";
              };

              const markFor = (k) => {
                if(k==="agri") return "agri";
                if(k==="mining") return "mining";
                if(k==="industry") return "industry";
                return "industry";
              };
              const continentLabel = (c) => {
                const x = String(c || "");
                if (x === "N_AMERICA") return "Sev. Amerika";
                if (x === "S_AMERICA") return "Již. Amerika";
                if (x === "EUROPE") return "Evropa";
                if (x === "AFRICA") return "Afrika";
                if (x === "ASIA") return "Asie";
                if (x === "OCEANIA") return "Austrálie";
                return x;
              };

              const continentOrder = ["N_AMERICA", "S_AMERICA", "EUROPE", "AFRICA", "ASIA", "OCEANIA"];
              const nonFarm = markets.filter((m) => !isFarm(m));
              const farms = markets.filter((m) => isFarm(m));

              const rows = continentOrder
                .map((cont) => {
                  const ms = nonFarm.filter((m) => m.continent === cont);
                  if (!ms.length) return null;
                  const sortKey = (m) => {
                    const k = kindOf(m);
                    return k === "industry" ? 0 : k === "mining" ? 1 : k === "agri" ? 2 : 9;
                  };
                  const picked = [...ms].sort((a, b) => sortKey(a) - sortKey(b)).slice(0, 2);
                  return { cont, markets: picked };
                })
                .filter(Boolean);

              const renderBtn = (m) => {
                const lockedBy = locks[m.marketId];
                const locked = !!lockedBy && lockedBy !== playerId;
                const mine = myMove?.marketId === m.marketId;
                const cls = kindOf(m);

                // UX: When another player occupies a market, it becomes invisible to others (blank slot).
                if(locked && !mine){
                  return <div key={m.marketId} className={"marketCell hiddenSlot " + cls} aria-hidden="true" />;
                }
                return (
                  <button
                    key={m.marketId}
                    className={"marketCell " + cls + (locked ? " locked" : "") + (mine ? " mine" : "")}
                    disabled={locked || !!myMove?.committed}
                    onClick={() => pickMarket(m.marketId)}
                    title={m.name || m.marketId}
                  >
                    <div className="marketCellInner">
                      <div className={"marketGlyph " + cls} aria-hidden="true">
                        <MonoIcon name={markFor(cls)} size={56} />
                      </div>
                      <div className="marketInfo">
                        <div className="marketCellTop">
                          <span className="marketCellTitle">{m.name || m.marketId}</span>
                          <span className="marketCellTag">{m.type}</span>
                        </div>
                        <div className="marketCellMeta">{m.marketId}</div>
                      </div>
                    </div>
                    {mine ? <div className="pill">MOJE</div> : locked ? <div className="pill dim">OBS.</div> : null}
                  </button>
                );
              };

              return (
                <div className="marketTable">
                  {rows.map((r) => (
                    <div key={r.cont} className="marketRow">
                      <div className="marketRowLabel">{continentLabel(r.cont)}</div>
                      <div className="marketRowCells">
                        {r.markets.map(renderBtn)}
                      </div>
                    </div>
                  ))}

                  {year >= 2 ? (
                    <div className="marketRow">
                      <div className="marketRowLabel">Farma</div>
                      <div className="marketRowCells farms">
                        {[0, 1, 2].map((i) => {
                          const m = farms[i];
                          if (!m) return <div key={i} className="marketCell placeholder">Farma {i + 1}</div>;
                          const mm = { ...m, name: `Farma ${i + 1}` };
                          return renderBtn(mm);
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : gs.phase==="BIZ" && gs.bizStep==="AUCTION_ENVELOPE" ? (
          <div className="card phaseCard">
            <div className="phaseHeader">
              <div className="phaseLeft">
                <div className="phaseIcon" aria-hidden="true"><MonoIcon name="envelope" size={48} /></div>
                <div>
                  <div className="phaseTitle">Dražba – obálka</div>
                  <div className="phaseSub">Zadej nabídku v USD, nebo zvol neúčast. Pokud máš lobbistu, můžeš získat „poslední šanci“.</div>
                </div>
              </div>
            </div>

            {!aucEntry?.committed ? (
              <>
                {/* golden rule: keep button styling (classes) identical; only change layout */}
                <div className="formRow stackConfirm">
                  <input
                    className="inputBig"
                    inputMode="numeric"
                    placeholder={useLobby ? "Lobbista" : "0"}
                    maxLength={8}
                    value={useLobby ? "" : aucBid}
                    disabled={useLobby}
                    onChange={(e)=>setAucBid(e.target.value.replace(/[^\d]/g,""))}
                  />
                  <button className="primaryBtn big full" onClick={()=>commitAuction(useLobby ? null : (aucBid===""?0:Number(aucBid)), useLobby)}>Potvrdit</button>
                </div>
                <div className="formRow">
                  <label className="checkRow">
                    <input type="checkbox" checked={useLobby} onChange={(e)=>setUseLobby(e.target.checked)} />
                    <span>Použít lobbistu (částku zadám až po odhalení nabídek)</span>
                  </label>
                </div>
                <button className="secondaryBtn big full" onClick={()=>commitAuction(null, false)}>Nechci dražit</button>
              </>
            ) : (
              <>
                {gs.biz.auction.lobbyistPhaseActive && aucEntry?.usedLobbyist && !aucEntry?.finalCommitted ? (
                  <div className="cardInner">
                    <div className="muted"><b>Lobbista</b> – vidíš výsledky 1. kola. Nyní zvol finální rozhodnutí.</div>

                    <div className="auditTable" style={{marginTop:12}}>
                      {(gs.players||[]).map(p=>{
                        const e = gs.biz.auction.entries?.[p.playerId];
                        const txt = e?.usedLobbyist ? "Použit Lobbista" : (e?.bidUsd==null ? "Nechci dražit" : `${e.bidUsd} USD`);
                        return (
                          <div key={p.playerId} className="auditRow">
                            <div className="auditLbl">{p.name}</div>
                            <div className="auditVal neu">{txt}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="formRow" style={{marginTop:12}}>
                      <input className="inputBig" inputMode="numeric" placeholder="0" maxLength={8} value={aucFinalBid} onChange={(e)=>setAucFinalBid(e.target.value.replace(/[^\d]/g,""))} />
                      <button className="primaryBtn big" onClick={()=>commitFinalAuction(aucFinalBid===""?0:Number(aucFinalBid))}>Potvrdit</button>
                    </div>
                    <button className="secondaryBtn big full" onClick={()=>commitFinalAuction(null)} style={{marginTop:10}}>Nechci dražit</button>
                  </div>
                ) : (
                  <div className="muted">Obálka odeslána. (Telefon je skrytý – můžeš odkryt ručně.)</div>
                )}
              </>
            )}
          </div>
        ) : gs.phase==="BIZ" && gs.bizStep==="ACQUIRE" ? (
          <div className="card phaseCard">
            <div className="phaseHeader">
              <div className="phaseLeft">
                <div className="phaseIcon" aria-hidden="true"><MonoIcon name="camera" size={48} /></div>
                <div>
                  <div className="phaseTitle">Akvizice</div>
                  <div className="phaseSub">Definitivně potvrď, zda jsi získal kartu. Pokud ano, naskenuj QR kód (můžeš vícekrát).</div>
                </div>
              </div>
            </div>

            <div className="ctaRow" style={{marginTop:10}}>
              {(!acqNoScanCommitted && !acqNoScanLocal) ? (
                <button className="primaryBtn big full" onClick={()=>{ setScanErr(""); setScanOn(true); }}>
                  Získat kartu
                </button>
              ) : null}

              {(!acqNoScanCommitted && !acqNoScanLocal) ? (
                <button className="secondaryBtn big full" onClick={()=>{ setAcqNoScanLocal(true); setScanOn(false); setScanPreview(null); commitAcquire({ gotCard:false }); }}>
                  Nebudu skenovat
                </button>
              ) : (
                <button className="secondaryBtn big full" disabled>
                  Čekám na ostatní hráče
                </button>
              )}
            </div>

            {acqHadAny ? (
              <div className="muted" style={{marginTop:10}}>✅ Alespoň jedna karta byla naskenována. Dokonči akvizice odpovědí „NE“ v dotazu „Máš toho víc?“.</div>
            ) : (
              <div className="muted" style={{marginTop:10}}>Pokud jsi získal kartu, klikni na „Získal jsem kartu“ a naskenuj QR kód.</div>
            )}
          </div>
        ) : gs.phase==="CRYPTO" ? (
          <div className="card phaseCard">
            <div className="phaseHeader">
              <div className="phaseLeft">
                <div className="phaseIcon" aria-hidden="true"><MonoIcon name="btc" size={48} /></div>
                <div>
                  <div className="phaseTitle">Kryptoburza</div>
                  <div className="phaseSub">Naklikej změny v kusech. Pak potvrď. Ukazovací režim skryje detaily.</div>
                </div>
              </div>
            </div>
            {/* UX: confirm + total must be visible before the table */}
            <button className="primaryBtn full" onClick={commitCrypto}>Potvrdit transakci</button>
            <div className="cryptoTotal" style={{marginTop:10}}>
              {(()=>{
                const total = ["BTC","ETH","LTC","SIA"].reduce((acc,sym)=> acc + (-(cryptoD[sym]||0) * (gs.crypto?.rates?.[sym]||0)), 0);
                const cls = total>0?"pos":total<0?"neg":"neu";
                const txt = total>0?`+${total} USD`:total<0?`${total} USD`:`0 USD`;
                return <div className={"cryptoTotalVal "+cls}>Celkem: {txt}</div>;
              })()}
            </div>

            <div className="cryptoList" style={{marginTop:12}}>
              {["BTC","ETH","LTC","SIA"].map(sym=>{
                const rate = gs.crypto?.rates?.[sym] || 0;
                const val = cryptoD[sym] || 0;
                const owned = me?.wallet?.crypto?.[sym] ?? 0;
                const lineUsd = -val * rate; // positive = gain (sell), negative = cost (buy)
                return (
                  <div key={sym} className="cryptoRow">
                    <div className="cryptoMeta">
                      <div className="cryptoSym">{sym}</div>
                      <div className="cryptoMetaLine">
                        <div className="muted">{rate} USD/ks</div>
                        <div className="cryptoOwnedWrap">
                          <div className="cryptoOwnedLabel">Vlastním</div>
                          <div className="cryptoOwned">{owned}</div>
                        </div>
                      </div>
                    </div>
                    <div className="cryptoCtrls">
                      <button
                        className="ghostBtn"
                        onClick={()=>{
                          const next = val-1;
                          // selling (negative) cannot exceed owned
                          if(next < 0 && Math.abs(next) > owned) return;
                          setCryptoD({...cryptoD, [sym]: next});
                        }}
                      >−</button>
                      <div className="cryptoVal">{val}</div>
                      <button
                        className="ghostBtn"
                        onClick={()=>{
                          const next = val+1;
                          setCryptoD({...cryptoD, [sym]: next});
                        }}
                      >+</button>
                    </div>
                    <div className={"cryptoLineUsd "+(lineUsd>0?"pos":lineUsd<0?"neg":"neu")}>
                      {lineUsd>0?`+${lineUsd} USD`:lineUsd<0?`${lineUsd} USD`:`0 USD`}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="ghostBtn full" onClick={()=>{ setCryptoD({BTC:0,ETH:0,LTC:0,SIA:0}); commitCrypto(); }}>Neobchoduji</button>
          </div>
        ) : gs.phase==="SETTLE" ? (
          <div className="card phaseCard">
            <div className="phaseHeader">
              <div className="phaseLeft">
                <div className="phaseIcon" aria-hidden="true"><MonoIcon name="receipt" size={48} /></div>
                <div>
                  <div className="phaseTitle">{(() => {
                    const entry = gs?.settle?.entries?.[playerId];
                    if(entry?.paid) return "Audit – platba";
                    if(gs?.settle?.stage==="FINAL") return "Finální audit";
                    if(entry?.started) return "Audit";
                    return "Předběžný audit";
                  })()}</div>
                  <div className="phaseSub">Účetnictví + simulace auditu. Tajné akce (Právník, Lobbista) nastavíš jen ty. Po zahájení už nejde měnit.</div>
                </div>
              </div>
              <button className="ghostBtn" onClick={()=>setTab("accounting")}>Účetnictví</button>
            </div>

            {(() => {
              const entry = gs?.settle?.entries?.[playerId] || {};
              const started = !!entry.started;
              const paid = !!entry.paid;
              const stage = gs?.settle?.stage || "PREVIEW";
              const pend = gs?.settle?.pending?.[playerId] || { lawyer:null, lobby:[] };

              const view = (stage==="FINAL" && entry.finalUsd!=null) ? { settlementUsd: entry.finalUsd, breakdown: entry.finalBreakdown||[] } : auditPreview;
              const sum = view?.settlementUsd ?? 0;
              const breakdown = view?.breakdown || [];

              const inv = gs?.inventory?.[playerId] || { experts:[] };
              const hasLawyer = (inv.experts||[]).some(e=>e.functionKey==="LAWYER_TRENDS" && !e.used) || !!pend.lawyer;
              const lobbyAvail = (inv.experts||[]).filter(e=>e.functionKey==="STEAL_BASE_PROD" && !e.used).length;
              const lobbyPending = (pend.lobby||[]).length;

              const globals = gs?.trends?.byYear?.[String(gs?.year||1)]?.globals || [];
              const blockable = globals.filter(t=>t?.lawyer?.allowed);
              const canChooseBlockTrend = hasLawyer && blockable.length>0;

              return (
                <>
                  <div className="auditBlock">
                    {auditLoading && !started ? (
                      <div className="muted">Počítám…</div>
                    ) : view?.error ? (
                      <div className="muted">{view.error}</div>
                    ) : (
                      <>
                        <div className="auditHeadline">
                          <div className="auditHint">Souhrn (USD)</div>
                          <div className={"auditSum "+((sum||0)>=0?"pos":"neg")}>{(sum||0)>=0?"+":""}{sum||0} USD</div>
                        </div>
                        <div className="auditTable">
                          {breakdown.length ? breakdown.map((b,idx)=> (
                            <div key={idx} className="auditRow">
                              <div className="auditLbl">{b.label}</div>
                              <div className={"auditVal "+(b.usd>0?"pos":b.usd<0?"neg":"neu")}>{b.usd>=0?"+":""}{b.usd} USD</div>
                            </div>
                          )) : <div className="muted">Rozpad není k dispozici.</div>}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Secret actions (only before start) */}
                  {!started ? (
                    <div className="auditSecret">
                      <div className="auditSecretTitle">Tajné akce</div>

                      {/* Lawyer */}
                      <div className="auditSecretCard">
                        <div className="auditSecretHead">
                          <div>
                            <div className="auditSecretName">Právník</div>
                            <div className="muted">1×: buď blokuje negativní trend, nebo zablokuje největší škodu od lobbistů.</div>
                          </div>
                          <div className={"pill "+(hasLawyer?"ok":"bad")}>{hasLawyer?"Mám":"Nemám"}</div>
                        </div>

                        <div className="auditSecretBody">
                          <div className="segRow">
                            <button className={"segBtn "+(auditLawyerMode==="NONE"?"on":"")} onClick={()=>{ setAuditLawyerMode("NONE"); setAuditLawyerTrendKey(""); auditSetLawyer(null); }}>Bez právníka</button>
                            <button className={"segBtn "+(auditLawyerMode==="SHIELD_LOBBY"?"on":"")} disabled={!hasLawyer} onClick={()=>{ setAuditLawyerMode("SHIELD_LOBBY"); setAuditLawyerTrendKey(""); auditSetLawyer({ mode:"SHIELD_LOBBY" }); }}>Štít vs lobbista</button>
                            <button className={"segBtn "+(auditLawyerMode==="BLOCK_TREND"?"on":"")} disabled={!canChooseBlockTrend} onClick={()=>{ setAuditLawyerMode("BLOCK_TREND"); if(!auditLawyerTrendKey && blockable[0]?.key) setAuditLawyerTrendKey(blockable[0].key); }}>Blokovat trend</button>
                          </div>

                          {auditLawyerMode==="BLOCK_TREND" ? (
                            <div className="auditInline" style={{marginTop:10}}>
                              <div className="muted" style={{marginBottom:6}}>Vyber trend (rok {gs?.year})</div>
                              <select
                                className="select"
                                value={auditLawyerTrendKey}
                                onChange={(e)=>{
                                  const v = e.target.value;
                                  setAuditLawyerTrendKey(v);
                                  auditSetLawyer({ mode:"BLOCK_TREND", trendKey: v });
                                }}
                              >
                                {blockable.map(t=> (
                                  <option key={t.key} value={t.key}>{t.icon} {t.name}</option>
                                ))}
                              </select>
                              <button className="ghostBtn full" style={{marginTop:10}} disabled={!hasLawyer || !auditLawyerTrendKey} onClick={()=>auditSetLawyer({ mode:"BLOCK_TREND", trendKey: auditLawyerTrendKey })}>Potvrdit volbu trendu</button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Lobbyist */}
                      <div className="auditSecretCard">
                        <div className="auditSecretHead">
                          <div>
                            <div className="auditSecretName">Lobbista</div>
                            <div className="muted">Krádež = přesun nejvyšší roční base produkce tradiční investice. Sabotáž = −50 % výsledku.</div>
                          </div>
                          <div className={"pill "+(lobbyAvail>0?"ok":"bad")}>{lobbyAvail}× volné</div>
                        </div>

                        <div className="auditSecretBody">
                          {lobbyPending ? (
                            <div className="auditPills">
                              {pend.lobby.map((a,idx)=>{
                                const targetName = (gs?.players||[]).find(p=>p.playerId===a.targetPid)?.name || "Hráč";
                                const lbl = a.type==="STEAL" ? "Krádež" : "Sabotáž";
                                return (
                                  <div key={idx} className="auditPill">
                                    <span>{lbl} → {targetName}</span>
                                    <button className="pillX" onClick={()=>auditRemoveLobby(idx)}>×</button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : <div className="muted">Zatím žádné akce.</div>}

                          <button className="secondaryBtn big full" style={{marginTop:10}} disabled={lobbyPending>=lobbyAvail} onClick={()=>{ setAuditLobbyTarget((gs?.players||[]).find(p=>p.playerId!==playerId)?.playerId || null); setAuditLobbyType("STEAL"); setAuditLobbyOpen(true); }}>
                            + Přidat lobbistu
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Primary action */}
                  {!paid ? (
                    <>
                      {!started ? (
                        <div className="ctaRow">
                          <button className="primaryBtn big full" onClick={commitSettle}>Zahájit audit</button>
                        </div>
                      ) : stage!=="FINAL" ? (
                        <div className="muted" style={{marginTop:10}}>Čekám na ostatní hráče…</div>
                      ) : (
                        <div className="ctaRow">
                          <button className="primaryBtn big full" onClick={auditPay}>{(sum||0)>=0 ? "Vyplatit dividendu" : "Uhradit ztráty"}</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="privacyLock">
                      <div className="privacyTitle">Částka pro banku</div>
                      <div className={"privacyAmt "+((entry.finalUsd||0)>=0?"pos":"neg")}>{(entry.finalUsd||0)>=0?"+":""}{entry.finalUsd||0} USD</div>
                      <div className="muted" style={{marginTop:10}}>Polož telefon na stůl a ukaž jen tuto částku. Detailní rozpad je skrytý.</div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="card">
            <div className="muted">Čekám na GM…</div>
          </div>
        )}
      </div>

      <BottomBarWrapper disabled={uiLocked}>
        <BottomBar onTab={setTabSafe} active={tab} />
      </BottomBarWrapper>

      {gmPanelOpen && isGM && gs?.status==="IN_PROGRESS" ? (
        <GMTopModal title="GM potvrzení" onClose={()=>setGmPanelOpen(false)}>
          <div className="gmPanel">
            <div className="muted" style={{marginBottom:12}}>
              Tlačítko je červené: ne všichni hráči potvrdili definitivní rozhodnutí.
              <br/><b>Stav:</b> {readiness.ready}/{readiness.total}
              {gs?.phase==="BIZ" && gs?.bizStep==="MOVE" ? (
                <>
                  <br/><b>Pozor:</b> Ve fázi Výběr trhu by se nemělo pokračovat, dokud nejsou všichni hotovo.
                </>
              ) : null}
            </div>
            <div className="ctaRow">
              <button className="secondaryBtn big full" onClick={()=>{ gmBack(); setGmPanelOpen(false); }}>← Zpět</button>
              <button className="primaryBtn big full gmNextBtn" onClick={()=>{ gmNext(); setGmPanelOpen(false); }}>Přesto pokračovat →</button>
            </div>
          </div>
        </GMTopModal>
      ) : null}

      {/* Acquisition: scanner (small QR-friendly) */}
      {scanOn && gs?.phase==="BIZ" && gs?.bizStep==="ACQUIRE" ? (
        <SuperTopModal title="Skener QR" onClose={()=>{ setScanOn(false); setScanErr(""); }}>
          {scanErr ? <div className="notice">{scanErr}</div> : null}
          <div className="scanFrame">
            <video ref={videoRef} className="scanVideo" playsInline />
            <div className="scanHint">Zaměř malý QR kód</div>
          </div>
          <div className="muted" style={{marginTop:10}}>Tip: přibliž telefon k QR a drž ho chvíli v klidu (ostření).</div>
          <button className="ghostBtn full" style={{marginTop:12}} onClick={()=>{ setScanOn(false); setScanErr(""); }}>Zavřít skener</button>
        </SuperTopModal>
      ) : null}

      {/* Acquisition: "Máš toho víc" loop */}
      {acqMoreOpen && gs?.phase==="BIZ" && gs?.bizStep==="ACQUIRE" ? (
        <Modal title="Máš toho víc?" onClose={()=>setAcqMoreOpen(false)}>
          <div className="muted">Pokud máš další kartu, dej ANO a pokračuj ve skenování. Pokud už ne, dej NE – to je definitivní rozhodnutí.</div>
          <div className="ctaRow" style={{marginTop:12}}>
            <button className="secondaryBtn big full" onClick={()=>{ setAcqMoreOpen(false); setScanErr(""); setScanOn(true); }}>ANO</button>
            <button className="primaryBtn big full" onClick={()=>{ setAcqMoreOpen(false); commitAcquire({ gotCard:true }); }}>NE</button>
          </div>
        </Modal>
      ) : null}

      {/* Audit: add lobbyist secret action */}
      {auditLobbyOpen && gs?.phase==="SETTLE" && !gs?.settle?.entries?.[playerId]?.started ? (
        <Modal title="Lobbista – tajná akce" onClose={()=>setAuditLobbyOpen(false)}>
          <div className="muted">Vyber cíl a typ akce. Soupeři neuvidí, co nastavíš.</div>
          <div style={{display:"grid",gap:10,marginTop:12}}>
            <div>
              <div className="muted" style={{marginBottom:6}}>Cíl</div>
              <select className="select" value={auditLobbyTarget||""} onChange={(e)=>setAuditLobbyTarget(e.target.value)}>
                {(gs?.players||[]).filter(p=>p.playerId!==playerId).map(p=> (
                  <option key={p.playerId} value={p.playerId}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="muted" style={{marginBottom:6}}>Typ</div>
              <select className="select" value={auditLobbyType} onChange={(e)=>setAuditLobbyType(e.target.value)}>
                <option value="STEAL">Krádež (přesun base produkce)</option>
                <option value="SABOTAGE">Sabotáž (−50 % výsledku)</option>
              </select>
            </div>
          </div>
          <div className="ctaRow" style={{marginTop:12}}>
            <button className="secondaryBtn big full" onClick={()=>setAuditLobbyOpen(false)}>Zrušit</button>
            <button className="primaryBtn big full" disabled={!auditLobbyTarget} onClick={()=>{ auditAddLobby({ type: auditLobbyType, targetPid: auditLobbyTarget }); setAuditLobbyOpen(false); }}>
              Přidat
            </button>
          </div>
        </Modal>
      ) : null}

      {/* Acquisition: scanned card confirmation (always top) */}
      {scanPreview?.card ? (
        <SuperTopModal
          title={scanPreview.card.kind==="INVESTMENT" ? "Tradiční investice" : scanPreview.card.kind==="MINING_FARM" ? "Mining farma" : "Expert"}
          onClose={()=>{ setScanPreview(null); setScanOn(false); }}
        >
          <div style={{display:"grid",gap:10}}>
            <div className="cardInner">
              <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:900,fontSize:18}}>{scanPreview.card.name}</div>
                  <div className="muted">ID: {scanPreview.card.cardId}</div>
                </div>
                <div className="pill">{scanPreview.card.kind.replace("_"," ")}</div>
              </div>
              {scanPreview.card.kind==="INVESTMENT" ? (
                <div className="muted" style={{marginTop:8}}>
                  Kontinent: <b>{scanPreview.card.continent}</b> • Trh: <b>{scanPreview.card.market}</b> • Typ: <b>{scanPreview.card.type}</b>
                  <br/>Základní produkce: <b>+{(scanPreview.card.usdProduction||0)*1000} USD</b>
                </div>
              ) : scanPreview.card.kind==="MINING_FARM" ? (
                <div className="muted" style={{marginTop:8}}>
                  Krypto: <b>{scanPreview.card.crypto}</b> • Produkce: <b>+{scanPreview.card.cryptoProduction} ks/rok</b>
                  <br/>Elektřina: <b>-{scanPreview.card.electricityUSD} USD</b>
                </div>
              ) : (
                <div className="muted" style={{marginTop:8}}>
                  Funkce: <b>{scanPreview.card.functionLabel}</b>
                  <br/>{scanPreview.card.functionDesc}
                </div>
              )}
            </div>

            <div className="ctaRow">
              <button className="primaryBtn full" onClick={()=>acceptScannedCard(scanPreview.card.cardId)}>✅ Ano, to je moje</button>
              <button className="ghostBtn full" onClick={rejectScannedCard}>✖ Ne, chyba</button>
            </div>
          </div>
        </SuperTopModal>
      ) : null}


      {/* NOTE: trend/regional detail overlays are rendered at the very end (superTop) so they always stay above other modals. */}

      {/* MOVE: definitive confirmation (cannot be closed; disappears on phase change) */}
      {uiLocked ? (()=>{
        const marketId = gs?.biz?.move?.[playerId]?.marketId;
        const m = (gs?.catalog?.markets||[]).find(x=>x.marketId===marketId) || null;
        return (
          <div className="lockBackdrop" aria-label="Definitivní výběr trhu">
            <div className="lockModal">
              <div className="lockTitle">Definitivní výběr trhu</div>
              <div className="lockSub">Ukaž tento displej ostatním hráčům. Okno se zavře až při posunu do další fáze.</div>
              <div className="lockBig">{m?.name || marketId || "—"}</div>
              <div className="lockTag">{m?.type ? `Typ: ${m.type}` : ""}</div>
            </div>
          </div>
        );
      })() : null}

      {/* privacy overlays */}
      <PrivacyCard
        kind="ML"
        mode={(gs?.phase==="BIZ" && gs?.bizStep==="ML_BID" && gs?.biz?.mlBids?.[playerId]?.committed) ? mlPrivacy : "edit"}
        amountText={(mlAmount==null) ? "NECHCI" : `${mlAmount} USD`}
        onReveal={()=>setMlPrivacy("reveal")}
        onHide={()=>setMlPrivacy("hidden")}
      />
      <PrivacyCard
        kind="AUCTION"
        mode={(() => {
          const committed = !!gs?.biz?.auction?.entries?.[playerId]?.committed;
          const isLobbyistFinal = !!gs?.biz?.auction?.lobbyistPhaseActive && !!gs?.biz?.auction?.entries?.[playerId]?.usedLobbyist && !gs?.biz?.auction?.entries?.[playerId]?.finalCommitted;
          if(gs?.phase==="BIZ" && gs?.bizStep==="AUCTION_ENVELOPE" && committed && !isLobbyistFinal) return aucPrivacy;
          return "edit";
        })()}
        amountText={(aucShownBid==null) ? "NECHCI" : `${aucShownBid} USD`}
        onReveal={()=>setAucPrivacy("reveal")}
        onHide={()=>setAucPrivacy("hidden")}
      />
      <PrivacyCard
        kind="CRYPTO"
        mode={(gs?.phase==="CRYPTO" && gs?.crypto?.entries?.[playerId]?.committed) ? cryptoPrivacy : "edit"}
        amountText={`${cryptoDelta>0?"+":""}${cryptoDelta||0} USD`}
        onReveal={()=>setCryptoPrivacy("reveal")}
        onHide={()=>setCryptoPrivacy("hidden")}
      />
      <PrivacyCard
        kind="SETTLE"
        mode={(gs?.phase==="SETTLE" && gs?.settle?.entries?.[playerId]?.paid) ? "hidden" : "edit"}
        amountText={`${(settleAmount??0)>=0?"+":""}${settleAmount??0} USD`}
        onReveal={()=>setSettlePrivacy("reveal")}
        onHide={()=>setSettlePrivacy("hidden")}
      />

      {/* Tabs */}
      {tab==="trends" ? (
        <Modal title="Trendy" onClose={()=>setTab(null)}>
          <TrendsPanel gs={gs} playerId={playerId} onOpenTrend={(t)=>setTrendModal(t)} onOpenRegional={(t)=>setRegionalModal(t)} onRevealGlobal={()=>s.emit("reveal_global_next_year",{gameId,playerId},()=>{})} onRevealCrypto={()=>s.emit("reveal_crypto_next_year",{gameId,playerId},()=>{})} />
        </Modal>
      ) : null}

      {tab==="assets" ? (
        <Modal title="Karty" onClose={()=>setTab(null)}>
          <CardsPanel inv={myInv} />
        </Modal>
      ) : null}

      {tab==="accounting" ? (
        <Modal title="Účetnictví" onClose={()=>setTab(null)}>
          <AccountingPanel gs={gs} playerId={playerId} gameId={gameId} />
        </Modal>
      ) : null}

      {expertsOpen && gs?.phase==="SETTLE" ? (
        <SuperTopModal title="Povolat experty" onClose={()=>{ setExpertsOpen(false); setExpertPick(null); setExpertTarget(null); setExpertCard(null); }}>
          {(() => {
            const inv = gs?.inventory?.[playerId] || { experts:[] };
            const usable = (inv.experts||[]).filter(e=>!e.used && (e.functionKey==="STEAL_BASE_PROD" || e.functionKey==="LAWYER_TRENDS"));
            const others = (gs?.players||[]).filter(p=>p.playerId!==playerId && p.role!=="GM");

            function applySteal(){
              const effect = { type:"STEAL_BASE_PRODUCTION", targetPlayerId: expertTarget, cardId: expertCard };
              s.emit("apply_expert_effect", { gameId, playerId, effect }, (res)=>{
                if(!res?.ok) alert(res?.error || "Chyba");
                else {
                  setExpertsOpen(false);
                  setExpertPick(null); setExpertTarget(null); setExpertCard(null);
                }
              });
            }

            const step = !expertPick ? 1 : (expertPick.functionKey==="STEAL_BASE_PROD" ? (!expertTarget ? 2 : !expertCard ? 3 : 4) : 9);

            return (
              <div className="expertModal">
                {!usable.length ? (
                  <div className="muted">Nemáš žádného použitelného experta.</div>
                ) : null}

                {!expertPick ? (
                  <div className="cardsGrid" style={{marginTop:6}}>
                    {usable.map(e=>{
                      const icon = e.functionKey==="STEAL_BASE_PROD" ? "🕴️" : "⚖️";
                      return (
                        <button key={e.cardId} className="expertPickTile" onClick={()=>setExpertPick(e)}>
                          <div className="tileIcon">{icon}</div>
                          <div className="tileMeta">
                            <div className="tileTitle">{e.functionLabel}</div>
                            <div className="tileSub">{e.functionDesc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : expertPick.functionKey==="LAWYER_TRENDS" ? (
                  <div className="cardInner">
                    <div className="secTitle">Právník</div>
                    <div className="muted" style={{marginTop:6}}>
                      Právníka v této verzi používáš v detailu trendu (ochrana proti trendům). V auditu se jen připomíná, že ho máš k dispozici.
                    </div>
                    <button className="secondaryBtn big full" onClick={()=>{ setExpertPick(null); }}>Zpět</button>
                  </div>
                ) : (
                  <>
                    <div className="secTitle">{expertPick.functionLabel}</div>
                    <div className="muted" style={{marginTop:6}}>Vyber hráče a jeho investici. Efekt se započítá do finálního auditu.</div>

                    {!expertTarget ? (
                      <div className="list" style={{marginTop:10}}>
                        {others.length ? others.map(p=>(
                          <button key={p.playerId} className="listItem clickable" onClick={()=>setExpertTarget(p.playerId)}>
                            <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                              <div><b>{p.name||"Hráč"}</b></div>
                              <div className="pill">vybrat</div>
                            </div>
                          </button>
                        )) : <div className="muted">Žádní další hráči.</div>}
                      </div>
                    ) : !expertCard ? (
                      <div className="list" style={{marginTop:10}}>
                        {(gs?.inventory?.[expertTarget]?.investments||[]).map(c=>(
                          <button key={c.cardId} className="listItem clickable" onClick={()=>setExpertCard(c.cardId)}>
                            <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                              <div><b>{c.cardId}</b> • {c.name}</div>
                              <div className="pill">+{(c.usdProduction||0)*1000} USD</div>
                            </div>
                            <div className="muted">{c.continent} • {c.type}</div>
                          </button>
                        ))}
                        <button className="secondaryBtn big full" onClick={()=>{ setExpertTarget(null); }}>Změnit hráče</button>
                      </div>
                    ) : (
                      <div className="ctaRow" style={{marginTop:12}}>
                        <button className="primaryBtn big full" onClick={applySteal}>ANO – aplikovat</button>
                        <button className="secondaryBtn big full" onClick={()=>{ setExpertPick(null); setExpertTarget(null); setExpertCard(null); }}>NE – zrušit</button>
                      </div>
                    )}
                  </>
                )}

                {expertPick ? (
                  <div className="muted" style={{marginTop:10}}>Krok {step}/4</div>
                ) : null}
              </div>
            );
          })()}
        </SuperTopModal>
      ) : null}

      {tab==="status" ? (
        <Modal title="Stav hry" onClose={()=>setTab(null)}>
          <pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(gs, null, 2)}</pre>
        </Modal>
      ) : null}

      {mlTrendIntroOpen && gs?.phase==="BIZ" && gs?.bizStep==="ML_BID" ? (
        <Modal
          title={`Aktuální trend pro Rok ${gs?.year||1}`}
          onClose={()=>setMlTrendIntroOpen(false)}
          variant="top"
        >
          <CurrentTrendsMini
            gs={gs}
            onOpenAll={()=>setTab("trends")}
            onOpenTrend={(t)=>setTrendModal(t)}
            onOpenRegional={(t)=>setRegionalModal(t)}
          />
        </Modal>
      ) : null}

      {trendModal ? (
        <SuperTopModal title={`${trendModal.icon||"🌐"} ${trendModal.name||"Trend"}`} onClose={()=>setTrendModal(null)}>
          <div className="modalText">
            {trendModal.desc ? trendModal.desc : "Detail trendu není k dispozici."}
          </div>

          {(() => {
            const inv = gs?.inventory?.[playerId] || { experts: [] };
            const lawyerLeft = (inv.experts||[]).filter(e=>e.functionKey==="LAWYER_TRENDS" && !e.used).length;
            const allowed = !!trendModal?.lawyer?.allowed;
            const req = trendModal?.lawyer?.phase;
            const phase = gs?.phase;
            const biz = gs?.bizStep;

            const canNow =
              allowed && (
                (req==="BIZ_TRENDS_ONLY" && phase==="BIZ" && biz==="ML_BID") ||
                (req==="BIZ_MOVE_ONLY" && phase==="BIZ" && biz==="MOVE") ||
                (req==="AUDIT_ANYTIME_BEFORE_CLOSE" && phase==="SETTLE")
              );

            const y = String(gs?.year||1);
            const protectedNow = !!gs?.lawyer?.protections?.[playerId]?.[y]?.[trendModal.key];

            function useLawyer(){
              const s = getSocket();
              s.emit("use_lawyer_on_trend", { gameId, playerId, trendKey: trendModal.key }, (res)=>{
                if(!res?.ok) alert(res?.error || "Chyba");
              });
            }

            const phaseHint =
              req==="BIZ_TRENDS_ONLY" ? "Právníka lze použít na začátku roku ve fázi Market Leader." :
              req==="BIZ_MOVE_ONLY" ? "Právníka lze použít pouze ve fázi Investice (pohyb)." :
              req==="AUDIT_ANYTIME_BEFORE_CLOSE" ? "Právníka lze použít kdykoliv před uzavřením Auditu." :
              "Právníka nelze použít.";

            return (
              <div className="lawyerBox">
                <div className="secTitle" style={{marginTop:12}}>Právník</div>

                {!allowed ? (
                  <div className="muted">Na tento trend nelze použít Právníka.</div>
                ) : protectedNow ? (
                  <div className="pill" style={{display:"inline-flex"}}>✅ Ochráněno (tento rok)</div>
                ) : lawyerLeft<1 ? (
                  <div className="muted">Právník není k dispozici.</div>
                ) : (
                  <>
                    <div className="muted">{phaseHint}</div>
                    <button className={"primaryBtn full"+(canNow? "":" disabled")} disabled={!canNow} onClick={useLawyer}>
                      Použít právníka
                    </button>
                  </>
                )}
              </div>
            );
          })()}
        </SuperTopModal>
      ) : null}

      {regionalModal ? (
        <SuperTopModal title={`${regionalModal.icon||"📍"} ${regionalModal.continent||"Kontinent"}`} onClose={()=>setRegionalModal(null)}>
          <div className="secTitle">{regionalModal.name||"Regionální trend"}</div>
          <div className="modalText" style={{marginTop:6}}>{regionalModal.desc || "Detail není k dispozici."}</div>
        </SuperTopModal>
      ) : null}
    </div>
  );
}

function TrendsPanel({ gs, playerId, onOpenTrend, onOpenRegional, onRevealGlobal, onRevealCrypto }){
  if(!gs?.trends) return <div className="muted">Trendy nejsou načtené.</div>;
  const yearsTotal = gs.config?.yearsTotal || 4;
  const currentYear = gs.year || 1;
  const byYear = gs.trends.byYear || {};
  const reveals = gs.reveals?.[playerId] || { globalYearsRevealed:[], cryptoYearsRevealed:[] };
  const gSet = new Set(reveals.globalYearsRevealed||[]);
  const cSet = new Set(reveals.cryptoYearsRevealed||[]);
  const inv = gs.inventory?.[playerId] || { experts:[] };
  const analystLeft = inv.experts.filter(e=>e.functionKey==="ANALYST" && !e.used).length;
  const guruLeft = inv.experts.filter(e=>e.functionKey==="CRYPTOGURU" && !e.used).length;

  const regCls = (t)=>{
    const k = String(t?.key||"");
    const n = String(t?.name||"").toLowerCase();
    if(k.includes("REG_INVESTMENT_BOOM") || n.includes("boom")) return "reg boom";
    if(k.includes("REG_HIGH_EDUCATION") || n.includes("vzdělan") || n.includes("vzdelan") ) return "reg edu";
    if(k.includes("REG_STABILITY") || n.includes("stabil")) return "reg stable";
    if(k.includes("REG_TAXES") || n.includes("dan")) return "reg tax";
    return "reg";
  };

  return (
    <div>
      <div className="muted" style={{marginBottom:10}}>
        Scrolluj doprava. Aktuální rok je odkrytý. Budoucí roky jsou rubem (❓). Odkrytí je jen pro tebe.
      </div>

      <div className="revealBar">
        <div className="revealChip">Analytik: <b>{analystLeft}</b></div>
        <button className={"primaryBtn"+(analystLeft<1?" disabled":"")} disabled={analystLeft<1} onClick={onRevealGlobal}>Odkryj globální</button>
        <div style={{width:12}}></div>
        <div className="revealChip">Kryptoguru: <b>{guruLeft}</b></div>
        <button className={"primaryBtn"+(guruLeft<1?" disabled":"")} disabled={guruLeft<1} onClick={onRevealCrypto}>Odkryj krypto</button>
      </div>

      <div className="yearsScroller">
        {Array.from({length:yearsTotal}, (_,i)=>i+1).map(y=>{
          const data = byYear[String(y)];
          const isCurrentOrPast = y<=currentYear;
          const gRevealed = isCurrentOrPast || gSet.has(y);
          const cRevealed = isCurrentOrPast || cSet.has(y);

          return (
            <div key={y} className="yearCol">
              <div className="yearTitle">Rok {y}</div>

              <div className="secTitle">Globální</div>
              <div className="cardRow">
                {data?.globals?.map((t)=>(
                  <TrendCard key={t.trendId} revealed={gRevealed} title={t.name} icon={t.icon||"🌐"} clickable={gRevealed} onClick={()=> onOpenTrend && onOpenTrend(t)} />
                ))}
              </div>

              <div className="secTitle">Krypto</div>
              <div className="cardRow">
                <CryptoTrendCard revealed={cRevealed} crypto={data?.crypto} />
              </div>

              <div className="secTitle">Regionální</div>
              <div>
                {Object.values(data?.regional||{}).map((t)=>(
                  <div key={t.trendId} className="regRow">
                    <div className="regMeta">
                      <div className="regName">{t.continent}</div>
                      <div className="regCont muted">{t.name}</div>
                    </div>
                    <button className={"regSymBtn "+regCls(t)} onClick={()=>onOpenRegional && onOpenRegional(t)} aria-label="Detail regionálního trendu">
                      <span className="regSymIcon">{t.icon || "📍"}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendsPreviewCard({ gs, onOpen, onOpenTrend, onOpenRegional }){
  const y = gs?.year || 1;
  const data = gs?.trends?.byYear?.[String(y)];

  const regCls = (t)=>{
    const k = String(t?.key||"");
    const n = String(t?.name||"").toLowerCase();
    if(k.includes("REG_INVESTMENT_BOOM") || n.includes("boom")) return "reg boom";
    if(k.includes("REG_HIGH_EDUCATION") || n.includes("vzdělan") || n.includes("vzdelan")) return "reg edu";
    if(k.includes("REG_STABILITY") || n.includes("stabil")) return "reg stable";
    if(k.includes("REG_TAXES") || n.includes("dan")) return "reg tax";
    return "reg";
  };
  return (
    <div className="card">
      <div className="titleRow">
        <div>
          <div className="title">Trendy • Rok {y}</div>
          <div className="muted">nové aktivní trendy</div>
        </div>
        <button className="ghostBtn" onClick={onOpen}>Všechny trendy</button>
      </div>

      <div className="trendPreview">
        <div className="trendPreviewBlock">
          <div className="secTitle">Globální</div>
          <div className="previewRow">
            {(data?.globals||[]).map(t=>(
              <div key={t.trendId} className="previewCard clickable" onClick={()=>onOpenTrend && onOpenTrend(t)} role="button" tabIndex={0}>
                <div className="previewIcon">{t.icon||"🌐"}</div>
                <div className="previewName">{t.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="trendPreviewBlock">
          <div className="secTitle">Krypto</div>
          <div className="previewRow">
            <CryptoTrendPreview crypto={data?.crypto} />
          </div>
        </div>

        <div className="trendPreviewBlock">
          <div className="secTitle">Regionální</div>
          <div className="regionalMini">
            {Object.values(data?.regional||{}).map(t=>(
              <div key={t.trendId} className="regionalDot">
                <span>{t.continent}</span>
                <button className={"regSymBtn "+regCls(t)} onClick={()=>onOpenRegional && onOpenRegional(t)} aria-label="Detail regionálního trendu">
                  <span className="regSymIcon">{t.icon || "📍"}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentTrendsMini({ gs, onOpenAll, onOpenTrend, onOpenRegional }){
  const y = gs?.year || 1;
  const data = gs?.trends?.byYear?.[String(y)];
  const globals = data?.globals || [];
  const crypto = data?.crypto || null;
  const regional = data?.regional || {};

  const regCls = (t)=>{
    const k = String(t?.key||"");
    const n = String(t?.name||"").toLowerCase();
    if(k.includes("REG_INVESTMENT_BOOM") || n.includes("boom")) return "reg boom";
    if(k.includes("REG_HIGH_EDUCATION") || n.includes("vzdělan") || n.includes("vzdelan")) return "reg edu";
    if(k.includes("REG_STABILITY") || n.includes("stabil")) return "reg stable";
    if(k.includes("REG_TAXES") || n.includes("dan")) return "reg tax";
    return "reg";
  };

  return (
    <div>
      <div className="muted" style={{marginTop:-6}}>Aktivní trendy pro tento rok (detail kdykoliv v záložce Trendy).</div>

      <div style={{marginTop:12}}>
        <div className="secTitle">Globální</div>
        <div className="previewRow" style={{marginTop:10}}>
          {globals.length ? globals.map(t=>(
            <div key={t.trendId||t.key} className="previewCard clickable" onClick={()=>onOpenTrend && onOpenTrend(t)} role="button" tabIndex={0}>
              <div className="previewIcon">{t.icon||"🌐"}</div>
              <div className="previewName">{t.name}</div>
            </div>
          )) : <div className="muted">—</div>}
        </div>
      </div>

      <div style={{marginTop:14}}>
        <div className="secTitle">Krypto</div>
        <div className="cardInner" style={{marginTop:10}}>
          {crypto?.coeff ? (
            <div className="cryptoMini">
              {["BTC","ETH","LTC","SIA"].map(sym=>{
                const k = Number(crypto.coeff?.[sym] ?? 1);
                const a = arrowForCoeff(k);
                return (
                  <div key={sym} className="cryptoMiniRow">
                    <div className="pill" style={{minWidth:56,justifyContent:"center"}}>{sym}</div>
                    <div className={"trendArrow "+a.cls} aria-label={a.label}>{a.sym}</div>
                    <div className="muted">×{k}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="muted">—</div>
          )}
        </div>
      </div>

      <div style={{marginTop:14}}>
        <div className="secTitle">Regionální</div>
        <div className="regionalMini" style={{marginTop:8}}>
          {Object.values(regional).map(t=>(
            <div key={t.trendId||t.key} className="regionalDot">
              <span>{t.continent}</span>
              <button className={"regSymBtn "+regCls(t)} onClick={()=>onOpenRegional && onOpenRegional(t)} aria-label="Detail regionálního trendu">
                <span className="regSymIcon">{t.icon || "📍"}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <button className="ghostBtn full" style={{marginTop:14}} onClick={onOpenAll}>Všechny trendy</button>
    </div>
  );
}


function arrowForCoeff(k){
  // Use text arrows so we can color them via CSS.
  if(k>1) return { sym:"▲", cls:"up", label:"roste" };
  if(k<1) return { sym:"▼", cls:"down", label:"klesá" };
  return { sym:"→", cls:"flat", label:"beze změny" };
}

function CryptoTrendCard({ revealed, crypto }){
  if(!revealed){
    return (
      <div className="trendCard wide back">
        <div className="trendBack">❓</div>
      </div>
    );
  }
  const coeff = crypto?.coeff || {};
  const coins = ["BTC","ETH","LTC","SIA"];
  return (
    <div className="trendCard wide cryptoCard">
      <div className="trendTop">
        <div className="trendIcon" aria-hidden="true"><MonoIcon name="btc" size={38} /></div>
        <div className="trendTitle">{crypto?.name || "Kryptotrend"}</div>
      </div>
      <div className="cryptoGrid">
        {coins.map(c=>{
          const k = Number(coeff[c] ?? 1);
          const a = arrowForCoeff(k);
          return (
            <div key={c} className={"cryptoRow "+a.cls}>
              <div className="coin">{c}</div>
              <div className="arrow">{a.sym}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CryptoTrendPreview({ crypto }){
  const coeff = crypto?.coeff || {};
  const coins = ["BTC","ETH","LTC","SIA"];
  return (
    <div className="previewCard wide cryptoPreview">
      <div className="previewName">{crypto?.name || "Kryptotrend"}</div>
      <div className="cryptoMiniGrid">
        {coins.map(c=>{
          const k = Number(coeff[c] ?? 1);
          const a = arrowForCoeff(k);
          return (
            <div key={c} className={"cryptoMini "+a.cls}>
              <span className="coin">{c}</span>
              <span className="arrow">{a.sym}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendCard({ revealed, title, icon, wide, onClick, clickable }){
  return (
    <div className={"trendCard"+(wide?" wide":"")+(revealed?"":" back")+(clickable?" clickable":"")} onClick={revealed && clickable ? onClick : undefined} role={revealed && clickable ? "button" : undefined} tabIndex={revealed && clickable ? 0 : undefined}>
      {revealed ? (
        <>
          <div className="trendIcon">{icon}</div>
          <div className="trendName">{title}</div>
        </>
      ) : (
        <>
          <div className="trendIcon">❓</div>
          <div className="trendName muted">Skryté</div>
        </>
      )}
    </div>
  );
}

function AssetsPanel({ inv }){
  const tiKind = (item) => {
    const t = String(item?.type||"").toUpperCase();
    if(t.includes("AGRO") || t.includes("ZEM")) return "agri";
    if(t.includes("MINING") || t.includes("TEZ") || t.includes("TĚŽ")) return "mining";
    if(t.includes("INDUSTRY") || t.includes("PRUM") || t.includes("PRŮM")) return "industry";
    return "industry";
  };
  return (
    <div>
      <div className="secTitle">Tradiční investice</div>
      <div className="list">
        {inv.investments.length? inv.investments.map(c=>(
          <div key={c.cardId} className="listItem">
            <div className="listLine">
              <span className={"tiDot " + tiKind(c)} aria-hidden="true"></span>
              <b>{c.cardId}</b> • {c.name}
            </div>
            <div className="muted">{c.continent} • {c.type} • +{(c.usdProduction||0)*1000} USD/rok</div>
          </div>
        )) : <div className="muted">Zatím žádné.</div>}
      </div>

      <div className="secTitle" style={{marginTop:16}}>Mining farmy</div>
      <div className="list">
        {inv.miningFarms.length? inv.miningFarms.map(c=>(
          <div key={c.cardId} className="listItem">
            <div><b>{c.cardId}</b> • {c.name}</div>
            <div className="muted">{c.crypto} • +{c.cryptoProduction} ks/rok • elektřina {c.electricityUSD} USD</div>
          </div>
        )) : <div className="muted">Zatím žádné.</div>}
      </div>
    </div>
  );
}

function CardsPanel({ inv }){
  const investments = inv?.investments || [];
  const miningFarms = inv?.miningFarms || [];
  const experts = inv?.experts || [];

  const tiKind = (item) => {
    const t = String(item?.type||"").toUpperCase();
    if(t.includes("AGRO") || t.includes("ZEM")) return "agri";
    if(t.includes("MINING") || t.includes("TEZ") || t.includes("TĚŽ")) return "mining";
    if(t.includes("INDUSTRY") || t.includes("PRUM") || t.includes("PRŮM")) return "industry";
    return "industry";
  };

  const TypeBadge = ({ kind }) => {
    return (
      <div className={"tiBadge " + kind} aria-hidden="true">
        <MonoIcon name={kind} size={44} className="tiBadgeIcon" />
      </div>
    );
  };

  const iconFor = (kind, item) => {
    if(kind==="MINING_FARM") return "⚙️";
    if(kind==="EXPERT"){
      const k = String(item?.functionKey||"");
      if(k.includes("LAWYER")) return "⚖️";
      if(k.includes("LOBBY") || k.includes("STEAL")) return "🕴️";
      if(k.includes("ANALYST")) return "🔎";
      if(k.includes("CRYPTO")) return "🧬";
      return "🧑‍💼";
    }
    return "🃏";
  };

  return (
    <div className="cardsPanel">
      <div className="cardsSection">
        <div className="secTitle">Tradiční investice</div>
        <div className="cardsGrid">
          {investments.length ? investments.map(c=> (
            <div key={c.cardId} className="cardTile">
              <div className="tileTop">
                <div className="tileIcon"><TypeBadge kind={tiKind(c)} /></div>
                <div className="tileMeta">
                  <div className="tileTitle">{c.name}</div>
                  <div className="tileSub">{c.continent} • {c.type}</div>
                </div>
              </div>
              <div className="tileBottom">
                <div className="tileId">{c.cardId}</div>
                <div className="tileVal">+{(c.usdProduction||0)*1000} USD/rok</div>
              </div>
            </div>
          )) : <div className="muted">Zatím žádné.</div>}
        </div>
      </div>

      <div className="cardsSection">
        <div className="secTitle">Mining farmy</div>
        <div className="cardsGrid">
          {miningFarms.length ? miningFarms.map(c=> (
            <div key={c.cardId} className="cardTile">
              <div className="tileTop">
                <div className="tileIcon">{iconFor("MINING_FARM", c)}</div>
                <div className="tileMeta">
                  <div className="tileTitle">{c.name}</div>
                  <div className="tileSub">{c.crypto} • +{c.cryptoProduction} ks/rok</div>
                </div>
              </div>
              <div className="tileBottom">
                <div className="tileId">{c.cardId}</div>
                <div className="tileVal neg">−{c.electricityUSD} USD elektřina</div>
              </div>
            </div>
          )) : <div className="muted">Zatím žádné.</div>}
        </div>
      </div>

      <div className="cardsSection">
        <div className="secTitle">Experti</div>
        <div className="cardsGrid">
          {experts.length ? experts.map(e=> (
            <div key={e.cardId} className={"cardTile"+(e.used?" used":"")}> 
              <div className="tileTop">
                <div className="tileIcon">{iconFor("EXPERT", e)}</div>
                <div className="tileMeta">
                  <div className="tileTitle">{e.functionLabel}</div>
                  <div className="tileSub">{e.functionDesc}</div>
                </div>
              </div>
              <div className="tileBottom">
                <div className="tileId">{e.cardId}</div>
                <div className={"pill"+(e.used?" dim":"")}>{e.used?"použito":"k dispozici"}</div>
              </div>
            </div>
          )) : <div className="muted">Zatím žádní.</div>}
        </div>
      </div>
    </div>
  );
}

function ExpertsPanel({ inv }){
  return (
    <div className="list">
      {inv.experts.length? inv.experts.map(e=>(
        <div key={e.cardId} className="listItem">
          <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
            <div><b>{e.cardId}</b> • {e.functionLabel}</div>
            <div className={"pill"+(e.used?" dim":"")}>{e.used?"použito":"k dispozici"}</div>
          </div>
          <div className="muted">{e.functionDesc}</div>
        </div>
      )) : <div className="muted">Zatím žádné.</div>}
    </div>
  );
}

function AccountingPanel({ gs, playerId, gameId }){
  const inv = gs?.inventory?.[playerId] || { investments:[], miningFarms:[], experts:[] };
  const baseUsd = (inv.investments||[]).reduce((s,c)=>s + (Number(c.usdProduction||0)*1000), 0);
  // (v3 test) region/global bonus rules are not fully encoded; show nominal placeholders.
  const regionalBonusUsd = 0;
  const globalBonusUsd = 0;

  const electricityUsd = (inv.miningFarms||[]).reduce((s,c)=>s + Number(c.electricityUSD||0), 0);
  const cryptoProd = { BTC:0, ETH:0, LTC:0, SIA:0 };
  for(const mf of (inv.miningFarms||[])){
    const sym = mf.crypto;
    if(sym && cryptoProd[sym]!=null) cryptoProd[sym] += Number(mf.cryptoProduction||0);
  }

  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  function openPreview(){
    setPreviewOpen(true);
    setLoading(true);

    s.emit("preview_audit", { gameId, playerId }, (res)=>{
      setLoading(false);
      if(!res?.ok){
        setPreview({ error: res?.error || "Chyba" });
      }else{
        setPreview({ settlementUsd: res.settlementUsd, breakdown: res.breakdown||[] });
      }
    });
  }

  return (
    <div>
      <button className="ghostBtn full" onClick={openPreview}>Předběžný audit</button>

      <div className="secTitle" style={{marginTop:12}}>Tradiční investice</div>
      <div className="list">
        <div className="listItem" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>Základní produkce</div>
          <div style={{fontWeight:900,color:"var(--primary)"}}>+{baseUsd} USD</div>
        </div>
        <div className="listItem" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>Regionální bonus</div>
          <div style={{fontWeight:900,color:"var(--primary)"}}>+{regionalBonusUsd} USD</div>
        </div>
        <div className="listItem" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>Globální bonus</div>
          <div style={{fontWeight:900,color:"var(--primary)"}}>+{globalBonusUsd} USD</div>
        </div>
      </div>

      <div className="secTitle" style={{marginTop:16}}>Mining farmy</div>
      <div className="list">
        <div className="listItem" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>Elektřina</div>
          <div style={{fontWeight:900,color:"var(--danger)"}}>−{electricityUsd} USD</div>
        </div>
        {(["BTC","ETH","LTC","SIA"]).map(sym=>{
          const v = cryptoProd[sym] || 0;
          return (
            <div key={sym} className="listItem" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>{sym} produkce / rok</div>
              <div style={{fontWeight:900,color:"var(--primary)"}}>+{v} ks</div>
            </div>
          );
        })}
      </div>

      {previewOpen ? (
        <SuperTopModal title="Předběžný audit" onClose={()=>setPreviewOpen(false)}>
          {loading ? (
            <div className="muted">Počítám…</div>
          ) : preview?.error ? (
            <div className="muted">{preview.error}</div>
          ) : (
            <>
              <div className="bigNumber">{(preview?.settlementUsd||0)>=0?"+":""}{preview?.settlementUsd||0} USD</div>
              <div className="secTitle">Rozpad</div>
              <div className="list">
                {(preview?.breakdown||[]).map((b, idx)=>(
                  <div key={idx} className="listItem" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>{b.label}</div>
                    <div style={{fontWeight:900}}>{b.usd>=0?"+":""}{b.usd} USD</div>
                  </div>
                ))}
              </div>
              <div className="muted" style={{marginTop:10}}>
                Pozn.: Předběžný audit je simulace pro test (nezavírá rok).
              </div>
            </>
          )}
        </SuperTopModal>
      ) : null}
    </div>
  );
}
