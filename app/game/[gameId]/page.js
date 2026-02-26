
'use client';

import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export default function Game({ params }) {
  const { gameId } = params;
  const [state, setState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    const s = io('http://localhost:3001');
    setSocket(s);

    s.emit('join_game', { gameId, name: 'Player' });

    s.on('joined', ({ playerId }) => setPlayerId(playerId));

    s.on('state_sync', (data) => {
      setState(data);
    });

    return () => s.disconnect();
  }, []);

  if (!state) return <div>Loading…</div>;

  return (
    <div>
      <h1>Kryptopoly</h1>
      <h2>Phase: {state.public.phase}</h2>
      <h3>Year: {state.public.year}</h3>

      <button onClick={() => socket.emit('commit_phase', { gameId, playerId })}>
        Confirm Action
      </button>

      <footer style={{position:'fixed',bottom:0,width:'100%',background:'#222',color:'#fff'}}>
        Peněženka | Karty | Trendy
      </footer>
    </div>
  );
}
