
'use client';

import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export default function Lobby({ params }) {
  const { gameId } = params;
  const [socket, setSocket] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    const s = io('http://localhost:3001');
    setSocket(s);
    s.emit('join_game', { gameId, name: 'Player' });

    s.on('joined', ({ playerId }) => setPlayerId(playerId));

    return () => s.disconnect();
  }, []);

  return (
    <div>
      <h1>Lobby – Game {gameId}</h1>
      <p>Player ID: {playerId}</p>
      <a href={`/game/${gameId}`}>Start Game</a>
    </div>
  );
}
