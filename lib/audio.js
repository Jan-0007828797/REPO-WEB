let audioEl = null;
let unlocked = false;

export function isUnlocked(){ return unlocked; }

export function ensureAudio(src){
  if (!audioEl){
    audioEl = new Audio(src);
    audioEl.loop = true;
    audioEl.preload = "auto";
    audioEl.volume = 0.55;
  }
  return audioEl;
}

// call from a user gesture
export async function unlockAndPlay(src){
  unlocked = true;
  const a = ensureAudio(src);
  try{ await a.play(); }catch{}
}

export function stopAudio(){
  if (!audioEl) return;
  audioEl.pause();
  audioEl.currentTime = 0;
}
