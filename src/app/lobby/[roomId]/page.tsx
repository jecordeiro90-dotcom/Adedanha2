"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Crown, Gamepad2, Loader2, LogIn, Users, QrCode, Copy } from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { nanoid } from 'nanoid';
import QRCode from "qrcode.react";
import type { Player, Game } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const MAX_PLAYERS = 20;

export default function LobbyPage() {
  const { roomId } = useParams();
  const router = useRouter();
  const { playerId, setPlayerId, game, player, setPlayer } = useGame();
  const { toast } = useToast();

  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');
  
  // Effect to derive player data from game state
  useEffect(() => {
    if(game && playerId) {
      const currentPlayer = game.players?.[playerId];
      if (currentPlayer) {
        setPlayer(currentPlayer);
      }
    }
  }, [game, playerId, setPlayer]);

  // Effect to update invite link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setInviteLink(window.location.href);
    }
  }, [roomId]);
  
  // This effect handles the initial loading state and determines
  // whether to show the "Join" form or the "Lobby" view.
  useEffect(() => {
    if (!game) {
      setIsLoading(true);
      return;
    }

    if (game.state !== 'LOBBY') {
        router.replace('/');
        return;
    }

    // At this point, `game` exists.
    // We check if the current user (identified by playerId from localStorage) is listed in the game's players.
    const isPlayerInGame = playerId && game.players && game.players[playerId];

    if (isPlayerInGame) {
      // The user is already in the game. We can show the lobby.
      // We also ensure the local player object is updated.
      if (!player || player.id !== playerId) {
        setPlayer(game.players[playerId]);
      }
      setIsLoading(false);
    } else {
      // The user is not in the game. We should show the join form.
      setIsLoading(false);
    }
    
  }, [game, playerId, player, setPlayer, router]);


  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Por favor, insira seu nome para entrar.', variant: 'destructive' });
      return;
    }
    if (!game || !roomId) {
       toast({ title: 'Erro', description: 'O jogo não foi carregado ainda.', variant: 'destructive' });
       return;
    }

    const currentPlayersCount = Object.keys(game.players).length;
    if (currentPlayersCount >= MAX_PLAYERS) {
      toast({ title: 'Sala cheia!', description: `Esta sala já atingiu o limite de ${MAX_PLAYERS} jogadores.`, variant: 'destructive' });
      return;
    }

    setIsJoining(true);
    const newPlayerId = nanoid();
    const newPlayer: Player = { id: newPlayerId, name: playerName.trim(), totalScore: 0, online: true };
    
    try {
      const gameRef = doc(db, 'games', roomId as string);
      // Set the new player in the database using dot notation for nested objects
      await updateDoc(gameRef, {
        [`players.${newPlayerId}`]: newPlayer
      });
      
      // Set the player ID in local storage and context. This will trigger a re-render.
      // The useEffect above will see the player is now in the game and show the lobby.
      setPlayerId(newPlayerId); 
    } catch (error) {
      console.error("Failed to join game:", error);
      toast({ title: 'Erro ao entrar na sala', description: 'Não foi possível entrar. Tente novamente.', variant: 'destructive' });
    } finally {
      setIsJoining(false);
    }
  };
  
  const handleStartGame = async () => {
    if (game && player && game.hostId === player.id && roomId) {
        try {
            const gameRef = doc(db, 'games', roomId as string);
            await updateDoc(gameRef, { state: 'CATEGORIES' });
        } catch (error) {
            toast({ title: 'Erro', description: 'Não foi possível iniciar o jogo.', variant: 'destructive' });
        }
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({ title: "Copiado!", description: "Link de convite copiado para a área de transferência." });
  }

  const playersList = game?.players ? Object.values(game.players) : [];
  const onlinePlayers = playersList.filter(p => p.online);

  // If we are still determining the game/player state, show a loading screen.
  if (isLoading) {
    return (
       <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-xl text-muted-foreground">Entrando na sala...</p>
      </div>
    );
  }

  // If the user is not in the game yet, show the join form.
  if (!player || !game?.players[player.id]) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-background">
        <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <Card className="w-full max-w-md shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-extrabold">Entrar no Jogo</CardTitle>
            <CardDescription>Você foi convidado para uma partida de Adedanha!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="text"
              placeholder="Seu nome"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="text-lg text-center"
              onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
            />
            <Button className="w-full" onClick={handleJoinGame} disabled={isJoining}>
              {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Entrar na Sala
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If the user is in the game, show the lobby.
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]"></div>
      <Card className="w-full max-w-2xl shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-extrabold">Sala de Espera</CardTitle>
          <CardDescription>Aguardando o anfitrião iniciar o jogo. Convide seus amigos!</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Jogadores na sala ({onlinePlayers.length}/{MAX_PLAYERS})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 border rounded-lg p-3">
              {onlinePlayers.length > 0 ? (
                <ul className="space-y-2">
                  {onlinePlayers.map((p) => (
                    <li key={p.id} className="flex items-center justify-between bg-secondary/50 p-2 rounded-md">
                      <span className="font-medium">{p.name}</span>
                      {p.id === game?.hostId && <Crown className="w-5 h-5 text-amber-400" title="Anfitrião" />}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6">
                    <p>Ninguém na sala ainda. Chame seus amigos!</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center space-y-4 bg-secondary/30 p-4 rounded-lg">
             <h3 className="font-semibold text-lg flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" /> Convide Amigos</h3>
             <div className="bg-white p-2 rounded-md shadow-md">
              {inviteLink ? <QRCode value={inviteLink} size={128} /> : <Skeleton className="w-32 h-32" />}
             </div>
             <div className="flex items-center gap-2 w-full">
                <Input value={inviteLink} readOnly className="text-xs"/>
                <Button variant="outline" size="icon" onClick={copyToClipboard}><Copy className="w-4 h-4"/></Button>
             </div>
          </div>
        </CardContent>
        <CardFooter>
          {player.id === game?.hostId ? (
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold" size="lg" onClick={handleStartGame} disabled={onlinePlayers.length < 1}>
              {onlinePlayers.length < 1 ? 'Aguardando jogadores...' : `Começar com ${onlinePlayers.length} jogador(es)`}
              <ArrowRight className="ml-2" />
            </Button>
          ) : (
             <p className="w-full text-center text-muted-foreground">Aguardando <span className="font-bold">{game?.players[game.hostId]?.name || 'o anfitrião'}</span> iniciar o jogo...</p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
