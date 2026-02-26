"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { getSocket } from "../../../lib/socket";
import { loadPlayerId } from "../../../lib/storage";
import { playRing, stopRing } from "../../../lib/audio";
import { BottomBar, Modal } from "../../ui";

const PHASES = [
  { key:"ML", label:"Market Leader", icon:"👑" },
  { key:"MARKET_PICK", label:"Výběr trhu", icon:"📍" },
  { key:"AUCTION", label:"Dražba", icon:"🔒" },
  { key:"ACQUIRE", label:"Akvizice", icon:"📷" },
  { key:"EXCHANGE", label:"Kryptoburza", icon:"💱" },
  { key:"AUDIT", label:"Audit", icon:"🧾" },
];

function PhaseBar({ phase }){
  return (
    <div className="stepRow">
      {PHASES.map(p=>{
        const active = p.key===phase;
        return (
          <div key={p.key} className={"step"+(active?" active":"")}>
            <div className="stepIcon">{p.icon}</div>
            <div className="stepLabel">{p.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function groupMarkets(options, continentOrder){
  const byCont = {};
  for(const c of continentOrder) byCont[c]=[];
  for(const m of options){
    if(!byCont[m.continent]) byCont[m.continent]=[];
    byCont[m.continent].push(m);
  }
  // sort within continent by type order: AGRO, MINING, INDUSTRY (to match colors grouping feel)
  const typeOrder = { AGRO:1, MINING:2, INDUSTRY:3 };
  for(const c of Object.keys(byCont)){
    byCont[c].sort((a,b)=>(typeOrder[a.marketType]||9)-(typeOrder[b.marketType]||9));
  }
  return byCont;
}

function formatCont(c){
  const map = { S_AMERICA:"SA", N_AMERICA:"JA", EUROPE:"EVR", AFRICA:"AFR", ASIA:"ASIE", OCEANIA:"OCEANIE" };
  return map[c]||c;
}
function formatType(t){
  const map = { AGRO:"Zemědělství", MINING:"Těžba", INDUSTRY:"Průmysl" };
  return map[t]||t;
}

export default function Game(){
  const { gameId } = useParams();
  const r = useRouter();
  const [sock,setSock]=useState(null);
  const [playerId,setPlayerId]=useState("");
  const [state,setState]=useState(null);
  const [gmState,setGmState]=useState(null);

  const [activeTab,setActiveTab]=useState(null); // wallet | cards | trends
  const [trendModalOpen,setTrendModalOpen]=useState(false);

  // MARKET PICK
  const [marketOptions,setMarketOptions]=useState([]);
  const [continentOrder,setContinentOrder]=useState(["S_AMERICA","N_AMERICA","EUROPE","AFRICA","ASIA","OCEANIA"]);
  const [confirmMarket,setConfirmMarket]=useState(null);

  // AUCTION
  const [auctionBid,setAuctionBid]=useState("");
  const [auctionPass,setAuctionPass]=useState(false);
  const [auctionLobbyist,setAuctionLobbyist]=useState(false);
  const [intelOpen,setIntelOpen]=useState(false);
  const [intelOffers,setIntelOffers]=useState([]);

  // ACQUIRE / SCAN
  const [scanOpen,setScanOpen]=useState(false);
  const [scanErr,setScanErr]=useState("");
  const [scanCard,setScanCard]=useState(null);
  const [moreModal,setMoreModal]=useState(false);
  const scannerRef = useRef(null);
  const readerRef = useRef(null);

  // EXCHANGE
  const [pending,setPending]=useState({ BTC:0, ETH:0, LTC:0, SIA:0 });
  const [pendingErr,setPendingErr]=useState("");

  // AUDIT
  const [auditPreview,setAuditPreview]=useState(null);
  const [auditFinal,setAuditFinal]=useState(null);
  const [auditMsg,setAuditMsg]=useState("");
  const [lawyerOpen,setLawyerOpen]=useState(false);
  const [lobbyOpen,setLobbyOpen]=useState(false);
  const [lobbyAction,setLobbyAction]=useState(null); // STEAL | SABOTAGE

  const pub = state?.public;
  const my = state?.my;

  const isGM = my?.role==="GM";

  useEffect(()=>{
    const pid = loadPlayerId();
    if(pid) setPlayerId(pid);
    const s = getSocket();
    setSock(s);

    const onSync=(payload)=>{ if(payload?.public?.gameId!==gameId) return; setState(payload); };
    const onGm=(p)=>{ setGmState(p); };
    const onIntel=(p)=>{
      setIntelOffers(p?.offers||[]);
      setIntelOpen(true);
      // best-effort ring
      try{ playRing(); }catch{}
    };
    const onAuditFinal=(p)=>{
      setAuditFinal(p);
      setAuditMsg("Finální audit připraven. Zkontroluj a potvrď.");
    };
    s.on("state_sync", onSync);
    s.on("gm_state", onGm);
    s.on("auction_intel_notify", onIntel);
    s.on("audit_final_ready", onAuditFinal);

    // subscribe
    if(pid) s.emit("watch_game",{ gameId, playerId: pid },()=>{});
    else {
      // fallback – redirect to join
      r.push(`/join/${gameId}`);
    }

    return ()=>{
      s.off("state_sync", onSync);
      s.off("gm_state", onGm);
      s.off("auction_intel_notify", onIntel);
      s.off("audit_final_ready", onAuditFinal);
      try{ stopRing(); }catch{}
    };
  },[gameId,r]);

  // Trend popup open on entering ML
  useEffect(()=>{
    if(pub?.phase==="ML"){
      setTrendModalOpen(true);
      setAuditFinal(null);
      setAuditPreview(null);
    } else {
      setTrendModalOpen(false);
    }
  },[pub?.phase]);

  // Load market options when entering MARKET_PICK
  useEffect(()=>{
    if(!sock || !pub || !my) return;
    if(pub.phase==="MARKET_PICK"){
      sock.emit("market_pick_enter",{ gameId, playerId: my.playerId },(res)=>{
        if(res?.ok){
          setMarketOptions(res.options||[]);
          setContinentOrder(res.continentOrder||continentOrder);
        }
      });
    }
  },[sock,pub?.phase]);

  // Load audit preview when entering AUDIT
  useEffect(()=>{
    if(!sock || !pub || !my) return;
    if(pub.phase==="AUDIT"){
      sock.emit("audit_preview",{ gameId, playerId: my.playerId },(res)=>{
        if(res?.ok) setAuditPreview(res.preview);
      });
    } else {
      setAuditPreview(null);
      setAuditFinal(null);
    }
  },[sock,pub?.phase]);

  // Scanner lifecycle
  useEffect(()=>{
    if(!scanOpen) return;
    setScanErr("");
    readerRef.current = new BrowserMultiFormatReader();
    (async ()=>{
      try{
        await readerRef.current.decodeFromVideoDevice(null, scannerRef.current, (result, err)=>{
          if(result?.getText){
            const qr = result.getText();
            // stop camera immediately to avoid multiple reads
            try{ readerRef.current?.reset(); }catch{}
            sock.emit("scan_preview",{ gameId, playerId: my.playerId, qrText: qr },(res)=>{
              if(!res?.ok){ setScanErr(res?.error||"Chyba QR"); setScanOpen(false); return; }
              if(!res.available){ setScanErr("Karta už byla získána"); setScanOpen(false); return; }
              setScanCard(res.card);
              setScanOpen(false);
            });
          }
        });
      }catch(e){
        setScanErr("Kamera nelze spustit");
        setScanOpen(false);
      }
    })();
    return ()=>{ try{ readerRef.current?.reset(); }catch{} };
  },[scanOpen]);

  const trends = pub?.trendsActive || [];
  const canCounterTrend = (t)=> {
    // server validates; UI shows only if not already countered/proofed
    const already = my?.protections?.trendCounters?.[t.id] || my?.protections?.proofBadges?.[t.id];
    return !already;
  };

  const walletTotalUSD = useMemo(()=>{
    // info-only
    const prices = gmState?.exchange?.prices || { BTC:10000, ETH:5000, LTC:1000, SIA:200 };
    const c = my?.crypto || {};
    return Math.floor((c.BTC||0)*prices.BTC + (c.ETH||0)*prices.ETH + (c.LTC||0)*prices.LTC + (c.SIA||0)*prices.SIA);
  },[my?.crypto, gmState]);

  if(!state) return <div className="container pagePad"><div className="card">Načítám…</div></div>;

  function gmAdvance(){
    sock.emit("gm_advance_phase",{ gameId, playerId: my.playerId },()=>{});
  }

  function renderPhase(){
    const phase = pub.phase;

    if(phase==="ML"){
      return (
        <div className="card">
          <div className="h2">Market Leader</div>
          <div className="muted">Zadej částku nebo zvol „Nechci být Market Leader“.</div>
          <div style={{height:10}} />
          <input className="bigInput" placeholder="Částka (USD)" value={auctionBid} onChange={(e)=>setAuctionBid(e.target.value.replace(/[^\d]/g,""))} />
          <div className="row">
            <button className="btn" onClick={()=>sock.emit("ml_commit",{ gameId, playerId: my.playerId, bidUsd:Number(auctionBid||0), pass:false },()=>{})}>Potvrdit</button>
            <button className="btn secondary" onClick={()=>sock.emit("ml_commit",{ gameId, playerId: my.playerId, pass:true },()=>{})}>Nechci být ML</button>
          </div>
          <div className="muted">Po potvrzení čekáš na ostatní.</div>
        </div>
      );
    }

    if(phase==="MARKET_PICK"){
      const grouped = groupMarkets(marketOptions, continentOrder);
      return (
        <div className="card">
          <div className="h2">Výběr trhu</div>
          <div className="muted">Zvol trh (skrytý pohyb). Uvidíš jen volné trhy (a svůj aktuální v dalších letech).</div>
          <div style={{height:10}} />
          {continentOrder.map(cont=>{
            const items = grouped[cont] || [];
            if(items.length===0) return null;
            return (
              <div key={cont} style={{marginBottom:12}}>
                <div style={{fontWeight:900, opacity:.9, marginBottom:6}}>{formatCont(cont)}</div>
                <div className="grid2">
                  {items.map(m=>(
                    <button key={m.marketId} className="chip" onClick={()=>setConfirmMarket(m)}>
                      <div style={{fontWeight:900}}>{formatType(m.marketType)}</div>
                      <div className="muted" style={{fontSize:12}}>{m.marketId}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if(phase==="AUCTION"){
      return (
        <div className="card">
          <div className="h2">Dražba</div>
          <div className="muted">Zadej nabídku, nebo „Nechci dražit“. Lobbista je tajný – nikdo nepozná, že ho používáš.</div>
          <div style={{height:10}} />
          <input className="bigInput" placeholder="Částka (USD)" value={auctionBid} onChange={(e)=>setAuctionBid(e.target.value.replace(/[^\d]/g,""))} />
          <label className="checkRow">
            <input type="checkbox" checked={auctionPass} onChange={(e)=>setAuctionPass(e.target.checked)} />
            <span>Nechci dražit</span>
          </label>
          <label className="checkRow">
            <input type="checkbox" checked={auctionLobbyist} onChange={(e)=>{
              setAuctionLobbyist(e.target.checked);
              sock.emit("auction_set_lobbyist_intent",{ gameId, playerId: my.playerId, enabled: e.target.checked },()=>{});
            }} />
            <span>Použít Lobbistu (pokud mám)</span>
          </label>
          <div className="row">
            <button className="btn" onClick={()=>{
              sock.emit("auction_commit_initial",{ gameId, playerId: my.playerId, bidUsd:Number(auctionBid||0), pass: auctionPass },()=>{});
            }}>Potvrdit</button>
          </div>
          <div className="muted">Po potvrzení čekáš na ostatní. Pokud máš intel, přijde ti upozornění.</div>
        </div>
      );
    }

    if(phase==="ACQUIRE"){
      return (
        <div className="card">
          <div className="h2">Akvizice</div>
          <div className="muted">Získal jsem kartu → skener. Nezískal jsem kartu → hotovo.</div>
          {scanErr ? <div className="notice">{scanErr}</div> : null}
          <div className="row">
            <button className="btn" onClick={()=>setScanOpen(true)}>Získal jsem kartu</button>
            <button className="btn secondary" onClick={()=>sock.emit("acquire_no_card_commit",{ gameId, playerId: my.playerId },()=>{})}>Nezískal jsem kartu</button>
          </div>
        </div>
      );
    }

    if(phase==="EXCHANGE"){
      return (
        <div className="card">
          <div className="h2">Kryptoburza</div>
          <div className="muted">Celková suma USD (informativní) je nad tabulkou.</div>

          <div style={{marginTop:10, fontWeight:900, fontSize:18}}>≈ {walletTotalUSD.toLocaleString("cs-CZ")} USD</div>

          {pendingErr ? <div className="notice">{pendingErr}</div> : null}

          <div style={{height:10}} />
          <div className="grid4">
            {["BTC","ETH","LTC","SIA"].map(c=>(
              <div key={c} className="chip">
                <div style={{fontWeight:900}}>{c}</div>
                <div className="muted" style={{fontSize:12}}>Máš: {my.crypto?.[c]||0} ks</div>
                <input className="smallInput" value={String(pending[c]||0)} onChange={(e)=>{
                  const v = Number(String(e.target.value).replace(/[^\-\d]/g,""))||0;
                  const next = { ...pending, [c]: v };
                  setPending(next);
                  setPendingErr("");
                  sock.emit("exchange_update_pending",{ gameId, playerId: my.playerId, pending: next },(res)=>{
                    if(!res?.ok) setPendingErr(res?.error||"Chyba");
                  });
                }} />
                <div className="muted" style={{fontSize:12}}>Delta (ks)</div>
              </div>
            ))}
          </div>

          <div className="row" style={{marginTop:12}}>
            <button className="btn" onClick={()=>sock.emit("exchange_commit",{ gameId, playerId: my.playerId },()=>{})}>Potvrdit obchody</button>
          </div>
        </div>
      );
    }

    if(phase==="AUDIT"){
      return (
        <div className="card">
          <div className="h2">Audit</div>
          <div className="muted">Vyúčtování roku (app = tool, USD cash u stolu). Nejdřív zahájíš audit, pak se dopočítá finál.</div>

          {auditMsg ? <div className="notice">{auditMsg}</div> : null}

          <div style={{height:10}} />
          {(auditFinal?.rows || auditPreview?.rows || []).map((r,i)=>(
            <div key={i} className="rowLine">
              <div style={{flex:1}}>{r.label}</div>
              <div style={{fontWeight:900}}>{(r.value||0).toLocaleString("cs-CZ")} USD</div>
            </div>
          ))}
          <div className="rowLine" style={{marginTop:8,borderTop:"1px solid rgba(255,255,255,.12)",paddingTop:8}}>
            <div style={{flex:1,fontWeight:900}}>Součet</div>
            <div style={{fontWeight:900,fontSize:18}}>{(auditFinal?.total ?? auditPreview?.total ?? 0).toLocaleString("cs-CZ")} USD</div>
          </div>

          <div style={{height:10}} />
          <div className="grid2">
            <button className="btn" onClick={()=>sock.emit("audit_start",{ gameId, playerId: my.playerId },(res)=>{ if(res?.ok) setAuditMsg("Hotovo – čekám na ostatní."); })}>Zahájit audit</button>
            <button className="btn secondary" onClick={()=>setLawyerOpen(true)}>Použít Právníky</button>
            <button className="btn secondary" onClick={()=>{ setLobbyAction("STEAL"); setLobbyOpen(true); }}>Použít Lobbistu – steal</button>
            <button className="btn secondary" onClick={()=>{ setLobbyAction("SABOTAGE"); setLobbyOpen(true); }}>Použít Lobbistu – sabotage</button>
          </div>

          <div style={{height:10}} />
          <button className="btn" disabled={!auditFinal} onClick={()=>sock.emit("audit_confirm",{ gameId, playerId: my.playerId },()=>{})}>Potvrdit audit</button>
        </div>
      );
    }

    return <div className="card">Neznámá fáze.</div>;
  }

  return (
    <div className="container pagePad">
      <div className="header">
        <h1 className="brand">KRYPTOPOLY</h1>
        <button className="iconBtn" onClick={()=>r.push("/")}>✕</button>
      </div>

      <PhaseBar phase={pub.phase} />

      {isGM ? (
        <div className="card" style={{marginTop:12}}>
          <div style={{fontWeight:900}}>GM panel</div>
          <div className="muted">Manuální posun je zachován. OK se používá, když jsou hráči ready.</div>
          <div className="row">
            <button className="btn" onClick={gmAdvance}>OK / Další fáze</button>
            {pub.phase==="AUDIT" && (gmState?.audit?.confirmed===pub.readiness.total) ? (
              <button className="btn secondary" onClick={()=>sock.emit("gm_next_year",{ gameId, playerId: my.playerId },()=>{})}>Nový rok</button>
            ) : null}
          </div>
          <div className="muted">Ready: {pub.readiness.count}/{pub.readiness.total}</div>
        </div>
      ) : null}

      <div style={{marginTop:12}}>
        {renderPhase()}
      </div>

      <BottomBar active={activeTab} onTab={(t)=> setActiveTab(t)} />

      {activeTab==="wallet" ? (
        <Modal title="Peněženka" onClose={()=>setActiveTab(null)} variant="top">
          <div className="muted">USD cash aplikace neeviduje. Níže jsou kryptoměny.</div>
          <div style={{height:10}} />
          {["BTC","ETH","LTC","SIA"].map(c=>(
            <div key={c} className="rowLine">
              <div style={{flex:1}}>{c}</div>
              <div style={{fontWeight:900}}>{my.crypto?.[c]||0} ks</div>
            </div>
          ))}
        </Modal>
      ) : null}

      {activeTab==="cards" ? (
        <Modal title="Karty" onClose={()=>setActiveTab(null)} variant="top">
          <div className="rowLine"><div style={{flex:1}}>Tradiční investice</div><div style={{fontWeight:900}}>{my.cardsSummary?.investments||0}</div></div>
          <div className="rowLine"><div style={{flex:1}}>Mining farmy</div><div style={{fontWeight:900}}>{my.cardsSummary?.miningFarms||0}</div></div>
          <div className="rowLine"><div style={{flex:1}}>Experti</div><div style={{fontWeight:900}}>{my.cardsSummary?.experts||0}</div></div>
        </Modal>
      ) : null}

      {activeTab==="trends" ? (
        <Modal title="Trendy" onClose={()=>setActiveTab(null)} variant="top">
          {trends.length===0 ? <div className="muted">Žádné trendy.</div> : null}
          {trends.map(t=>(
            <div key={t.id} className="rowLine" style={{alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:900}}>{t.name}</div>
                <div className="muted" style={{fontSize:12}}>{t.infoOnly ? "Info (kontrola u stolu)" : "Aplikace zohledňuje v logice"}</div>
              </div>
              <div>
                {/* no actions here to keep 1 action per screen; actions are in phase modals */}
              </div>
            </div>
          ))}
        </Modal>
      ) : null}

      {trendModalOpen && pub.phase==="ML" ? (
        <Modal title="Trendy tohoto roku" onClose={()=>setTrendModalOpen(false)} variant="top">
          <div className="muted">Přehled aktivních globálních trendů. Pokud máš Právníka a je to relevantní, můžeš se bránit (v rámci pravidel).</div>
          <div style={{height:10}} />
          {trends.map(t=>(
            <div key={t.id} className="rowLine" style={{alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:900}}>{t.name}</div>
                <div className="muted" style={{fontSize:12}}>{t.infoOnly ? "Info trend" : "Enforced trend"}</div>
                {my?.protections?.proofBadges?.[t.id] ? <div className="notice" style={{marginTop:6}}>{my.protections.proofBadges[t.id].text}</div> : null}
              </div>
              <div>
                {canCounterTrend(t) ? (
                  <button className="btn tiny" onClick={()=>sock.emit("lawyer_counter_trend",{ gameId, playerId: my.playerId, trendId: t.id },()=>{})}>Právník</button>
                ) : null}
              </div>
            </div>
          ))}
          <div style={{height:10}} />
          <button className="btn" onClick={()=>setTrendModalOpen(false)}>OK</button>
        </Modal>
      ) : null}

      {confirmMarket ? (
        <Modal title="Potvrdit trh" onClose={()=>setConfirmMarket(null)} variant="top">
          <div style={{fontWeight:900,fontSize:18}}>{formatCont(confirmMarket.continent)} – {formatType(confirmMarket.marketType)}</div>
          <div className="muted">Definitivní rozhodnutí.</div>
          <div style={{height:10}} />
          <button className="btn" onClick={()=>{
            sock.emit("market_pick_commit",{ gameId, playerId: my.playerId, marketId: confirmMarket.marketId },(res)=>{
              if(res?.ok) setConfirmMarket(null);
            });
          }}>Potvrdit</button>
        </Modal>
      ) : null}

      {intelOpen ? (
        <Modal title="Intel (Lobbista)" onClose={()=>{ setIntelOpen(false); try{stopRing();}catch{} }} variant="top">
          <div className="muted">Tajné informace. Můžeš upravit nabídku, nebo potvrdit beze změny.</div>
          <div style={{height:10}} />
          {intelOffers.map(o=>(
            <div key={o.playerId} className="rowLine">
              <div style={{flex:1}}>{o.name}</div>
              <div style={{fontWeight:900}}>
                {o.passed ? "PASS" : (o.bidUsd||0).toLocaleString("cs-CZ")+" USD"}
              </div>
            </div>
          ))}
          <div style={{height:10}} />
          <input className="bigInput" placeholder="Nová částka (USD)" value={auctionBid} onChange={(e)=>setAuctionBid(e.target.value.replace(/[^\d]/g,""))} />
          <label className="checkRow">
            <input type="checkbox" checked={auctionPass} onChange={(e)=>setAuctionPass(e.target.checked)} />
            <span>Nechci dražit</span>
          </label>
          <div className="row">
            <button className="btn" onClick={()=>{
              sock.emit("auction_commit_final",{ gameId, playerId: my.playerId, bidUsd:Number(auctionBid||0), pass: auctionPass },(res)=>{
                if(res?.ok){ setIntelOpen(false); try{stopRing();}catch{} }
              });
            }}>Potvrdit (definitivní)</button>
            <button className="btn secondary" onClick={()=>{
              // confirm without changes
              sock.emit("auction_commit_final",{ gameId, playerId: my.playerId, bidUsd:Number(auctionBid||0), pass: auctionPass },(res)=>{
                if(res?.ok){ setIntelOpen(false); try{stopRing();}catch{} }
              });
            }}>Potvrdit beze změny</button>
          </div>
        </Modal>
      ) : null}

      {scanOpen ? (
        <Modal title="Skener" onClose={()=>setScanOpen(false)} variant="top">
          <div className="muted">Namiř na QR kód. Kód je malý – drž telefon stabilně.</div>
          <div style={{height:10}} />
          <video ref={scannerRef} style={{width:"100%", borderRadius:16, background:"#000"}} />
        </Modal>
      ) : null}

      {scanCard ? (
        <Modal title="Potvrdit kartu" onClose={()=>setScanCard(null)} variant="top">
          <div style={{fontWeight:900,fontSize:18}}>{scanCard.cardId}</div>
          <div className="muted">{scanCard.kind}</div>
          <div style={{height:10}} />
          <button className="btn" onClick={()=>{
            sock.emit("scan_claim",{ gameId, playerId: my.playerId, cardId: scanCard.cardId },(res)=>{
              if(res?.ok){
                setScanCard(null);
                setMoreModal(true);
              }
            });
          }}>Potvrdit získání</button>
        </Modal>
      ) : null}

      {moreModal ? (
        <Modal title="Máš toho víc?" onClose={()=>setMoreModal(false)} variant="top">
          <div className="row">
            <button className="btn" onClick={()=>{ setMoreModal(false); setScanOpen(true); }}>ANO</button>
            <button className="btn secondary" onClick={()=>{ setMoreModal(false); sock.emit("acquire_finish_commit",{ gameId, playerId: my.playerId },()=>{}); }}>NE</button>
          </div>
        </Modal>
      ) : null}

      {lawyerOpen ? (
        <Modal title="Právníci" onClose={()=>setLawyerOpen(false)} variant="top">
          <div className="muted">Štít = preventivní ochrana proti lobbistům. Ikony trendů = ochrana proti trendům (pokud je to možné).</div>
          <div style={{height:10}} />
          <button className="btn" onClick={()=>sock.emit("lawyer_activate_preventive",{ gameId, playerId: my.playerId },()=>{})}>🛡️ Použít preventivně</button>
          <div style={{height:10}} />
          {trends.map(t=>(
            <div key={t.id} className="rowLine">
              <div style={{flex:1}}>{t.name}</div>
              <button className="btn tiny" disabled={!canCounterTrend(t)} onClick={()=>sock.emit("lawyer_counter_trend",{ gameId, playerId: my.playerId, trendId: t.id },()=>{})}>Právník</button>
            </div>
          ))}
        </Modal>
      ) : null}

      {lobbyOpen ? (
        <Modal title={`Lobbista – ${lobbyAction==="STEAL"?"steal":"sabotage"}`} onClose={()=>setLobbyOpen(false)} variant="top">
          <div className="muted">Vyber protihráče. Tato volba je skrytá.</div>
          <div style={{height:10}} />
          {pub.players.filter(p=>p.playerId!==my.playerId).map(p=>(
            <button key={p.playerId} className="chip" onClick={()=>{
              sock.emit("lobbyist_action_select",{ gameId, playerId: my.playerId, action: lobbyAction, targetPlayerId: p.playerId },(res)=>{
                if(res?.ok) setLobbyOpen(false);
              });
            }}>{p.name}</button>
          ))}
        </Modal>
      ) : null}

    </div>
  );
}
