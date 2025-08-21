"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Game, Player } from '@/lib/types';

const PLAYER_ID_KEY = 'adedanha-player-id';
const GAME_ID_KEY = 'adedanha-game-id';

interface GameContextType {
  game: Game | null;
  setGame: (game: Game | null) => void;
  player: Player | null;
  setPlayer: (player: Player | null) => void;
  playerId: string | null;
  setPlayerId: (id: string | null) => void;
  gameId: string | null;
  setGameId: (id: string | null) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  const [gameId, setGameIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(GAME_ID_KEY);
    }
    return null;
  });

  const [playerId, setPlayerIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PLAYER_ID_KEY);
    }
    return null;
  });

  const setGameId = (id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(GAME_ID_KEY, id);
      } else {
        localStorage.removeItem(GAME_ID_KEY);
      }
    }
    setGameIdState(id);
  };

  const setPlayerId = (id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(PLAYER_ID_KEY, id);
      } else {
        localStorage.removeItem(PLAYER_ID_KEY);
      }
    }
    setPlayerIdState(id);
  };

  // Effect for listening to game changes from Firestore
  useEffect(() => {
    const lobbyIdFromUrl = pathname.startsWith('/lobby/') ? pathname.split('/')[2] : null;
    if (lobbyIdFromUrl && lobbyIdFromUrl !== gameId) {
      setGameId(lobbyIdFromUrl);
      return;
    }

    if (!gameId) {
      if (game) setGame(null);
      return;
    }

    const gameRef = doc(db, 'games', gameId);
    const unsubscribe = onSnapshot(
      gameRef,
      (snapshot) => {
        const gameData = snapshot.data() as Game | undefined;
        if (gameData) {
          setGame(gameData);
          if (playerId && gameData.players[playerId] && !gameData.players[playerId].online) {
            updateDoc(gameRef, { [`players.${playerId}.online`]: true });
          }
        } else {
          setGame(null);
          setPlayer(null);
          if (gameId) setGameId(null);
          if (playerId) setPlayerId(null);
          if (pathname !== '/') {
            router.replace('/');
          }
        }
      },
      (error) => {
        console.error('Error listening to game document:', error);
        setGame(null);
        setPlayer(null);
        setGameId(null);
        setPlayerId(null);
        router.replace('/');
      }
    );

    return () => unsubscribe();
  }, [gameId, pathname, playerId, router]);

  // Effect for handling navigation based on game state
  useEffect(() => {
    if (!game || !gameId) {
      // Permite acesso à rota de convite /lobby/[id] mesmo sem game ou player
      const allowedPaths = ['/lobby/'];
      const protectedPaths = ['/categories', '/game', '/results', '/validation'];

      const isAllowedPath = allowedPaths.some((path) => pathname.startsWith(path));
      const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

      if (isProtectedPath && !isAllowedPath) {
        router.replace('/');
      }
      return;
    }

    let targetPath = '';
    switch (game.state) {
      case 'LOBBY':
        targetPath = `/lobby/${gameId}`;
        break;
      case 'CATEGORIES':
        targetPath = '/categories';
        break;
      case 'GAME':
        targetPath = '/game';
        break;
      case 'VALIDATION':
        targetPath = '/validation';
        break;
      case 'RESULTS':
        targetPath = '/results';
        break;
      default:
        targetPath = '/';
        break;
    }

    if (pathname !== targetPath) {
      router.replace(targetPath);
    }
  }, [game, gameId, pathname, router]);

  // Effect to derive the current player from the game object
  useEffect(() => {
    if (game && playerId) {
      const currentPlayer = game.players?.[playerId];
      setPlayer(currentPlayer || null);
    } else {
      setPlayer(null);
    }
  }, [game, playerId]);

  // Effect to handle player disconnection
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (gameId && playerId) {
        const gameRef = doc(db, 'games', gameId);
        updateDoc(gameRef, {
          [`players.${playerId}.online`]: false,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gameId, playerId]);

  return (
    <GameContext.Provider
      value={{
        game,
        setGame,
        player,
        setPlayer,
        playerId,
        setPlayerId,
        gameId,
        setGameId,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
