const KEY_NAME = "kryptopoly_name";

export function saveName(name){
  try{ localStorage.setItem(KEY_NAME, name); }catch{}
}
export function loadName(){
  try{ return localStorage.getItem(KEY_NAME) || ""; }catch{ return ""; }
}
