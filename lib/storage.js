const KEY="kryptopoly_v32";
export function saveObj(o){try{localStorage.setItem(KEY,JSON.stringify(o));}catch{}}
export function loadObj(){try{return JSON.parse(localStorage.getItem(KEY)||"{}");}catch{return {};}}
export function saveName(name){const o=loadObj();o.name=name;saveObj(o);}
export function loadName(){return (loadObj().name||"");}
export function savePlayerId(playerId){const o=loadObj();o.playerId=playerId;saveObj(o);}
export function loadPlayerId(){return (loadObj().playerId||"");}
export function saveLastGameId(gameId){const o=loadObj();o.lastGameId=gameId;saveObj(o);}
export function loadLastGameId(){return (loadObj().lastGameId||"");}
export function clearSession(){const o=loadObj(); delete o.playerId; delete o.lastGameId; saveObj(o);}
