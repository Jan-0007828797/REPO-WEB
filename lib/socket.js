import { io } from "socket.io-client";

let sock = null;

export function getSocket(){
  if (sock) return sock;
  const url = (process.env.NEXT_PUBLIC_SERVER_URL || "").trim();
  if (!url) throw new Error("Missing NEXT_PUBLIC_SERVER_URL");
  sock = io(url, { transports: ["websocket"], withCredentials: false });
  return sock;
}
export function resetSocket(){
  try{ sock?.disconnect(); }catch{}
  sock = null;
}
