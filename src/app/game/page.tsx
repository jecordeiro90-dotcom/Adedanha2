'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORIES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PartyPopper } from 'lucide-react';
import type { RoundAnswers } from '@/lib/types';
import { doc, updateDoc, deleteField, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type GamePhase = 'COUNTDOWN' | 'PLAYING' | 'WAITING';

export default function GamePage() {
  const router = useRouter();
  const { game, player, gameId } = useGame();
  const { toast } = useToast();
  const methods = useForm<RoundAnswers>();

  const [phase, setPhase] = useState<GamePhase>('COUNTDOWN');
  const [countdown, setCountdown] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCategories = CATEGORIES.filter(c => game?.categories?.includes(c.id));

  useEffect(() => {
    if (!game) return;

    if (game.state !== 'GAME') {
      router.replace('/');
      return;
    }

    const connectedPlayerIds = Object.keys(game.players).filter(
      (id) => game.players[id]?.online
    );

    const allConnectedPlayersAnswered = connectedPlayerIds.every(
      (id) => game.currentAnswers?.[id]
    );

    if (allConnectedPlayersAnswered && connectedPlayerIds.length > 0) {
      if (player?.id === game.hostId) {
        const gameRef = doc(db, 'games', gameId!);
        updateDoc(gameRef, { state: 'VALIDATION' });
      }
    } else if (game.roundWinner && !game.currentAnswers?.[player?.id || '']) {
      handleStop();
    }
  }, [game, router, player, gameId]);

  useEffect(() => {
    if (phase === 'COUNTDOWN') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setPhase('PLAYING');
      }
    }
  }, [phase, countdown]);

  const handleStop = async () => {
    if (!gameId || !player?.id) return;
    setIsSubmitting(true);

    const myAnswers = methods.getValues(player.id) || {};

    try {
      const gameRef = doc(db, 'games', gameId);

      const updates: any = {
        [`currentAnswers.${player.id}`]: myAnswers,
      };

      if (!game?.roundWinner) {
        updates.roundWinner = player.id;
      }

      await updateDoc(gameRef, updates);
      setPhase('WAITING');
    } catch (e) {
      console.error("Failed to submit answers:", e);
      toast({
        title: "Erro",
        description: "Não foi possível enviar suas respostas.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  // ✅ NOVO: Função para sair da partida e apagar se for o último
  const handleLeaveGame = async () => {
    if (!gameId || !player?.id) return;

    const gameRef = doc(db, 'games', gameId);

    try {
      const gameSnap = await getDoc(gameRef);
      if (!gameSnap.exists()) {
        router.replace('/');
        return;
      }

      const gameData = gameSnap.data();
      const players = gameData.players || {};

      await updateDoc(gameRef, {
        [`players.${player.id}`]: deleteField(),
      });

      const remainingPlayers = Object.keys(players).filter(id => id !== player.id);

      if (remainingPlayers.length === 0) {
        await deleteDoc(gameRef);
        console.log('Partida deletada (último jogador saiu).');
      }

      router.replace('/');
    } catch (error) {
      console.error('Erro ao sair da partida:', error);
      toast({
        title: 'Erro ao sair',
        description: 'Não foi possível sair da partida.',
        variant: 'destructive',
      });
    }
  };

  const renderContent = () => {
    if (!game) return <Loader2 className="w-16 h-16 animate-spin mx-auto text-primary" />;

    const hasSubmitted = game.currentAnswers && game.currentAnswers[player?.id || ''];
    if (phase === 'WAITING' || hasSubmitted) {
      return (
        <div className="text-center space-y-4">
          <Loader2 className="w-16 h-16 animate-spin mx-auto text-primary" />
          <p className="text-xl font-medium">Respostas enviadas!</p>
          <p className="text-muted-foreground">Aguardando os outros jogadores...</p>
        </div>
      );
    }

    switch (phase) {
      case 'COUNTDOWN':
        return (
          <div className="text-center">
            <p className="text-lg mb-4">A letra é...</p>
            <p className="text-9xl font-extrabold text-primary animate-in fade-in-0 zoom-in-50 duration-500">{game.currentLetter}</p>
            <p className="text-7xl font-bold mt-8 animate-ping">{countdown}</p>
          </div>
        );
      case 'PLAYING':
        return (
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(handleStop)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedCategories.map((category, cIndex) => (
                  <div key={category.id}>
                    <label htmlFor={`${player?.id}-${category.id}`} className="font-medium flex items-center gap-2 mb-1">
                      <category.icon className="w-4 h-4" />
                      {category.name}
                    </label>
                    <Input
                      id={`${player?.id}-${category.id}`}
                      {...methods.register(`${player?.id}.${category.id}`)}
                      autoFocus={cIndex === 0}
                      className="text-lg"
                      autoComplete="off"
                    />
                  </div>
                ))}
              </div>
              <Button type="submit" size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xl py-8" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-4 animate-spin" /> : <PartyPopper className="mr-4" />} STOP!
              </Button>
            </form>
          </FormProvider>
        );
      case 'WAITING':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="w-16 h-16 animate-spin mx-auto text-primary" />
            <p className="text-xl font-medium">
              {game.roundWinner && game.players[game.roundWinner] ? `${game.players[game.roundWinner].name} apertou STOP!` : 'Finalizando rodada...'}
            </p>
            <p className="text-muted-foreground">Aguardando os outros jogadores...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen p-4 sm:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]"></div>
      <Card className="w-full max-w-4xl shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500">
        <CardHeader className="text-center relative">
          {/* ✅ Botão Sair */}
          <button
            onClick={handleLeaveGame}
            className="absolute top-4 left-4 bg-destructive text-white px-4 py-2 rounded hover:bg-destructive/80 text-sm font-semibold"
          >
            Sair
          </button>
          <CardTitle className="text-3xl font-bold">Rodada da Letra</CardTitle>
          {game?.currentLetter && (
            <div className="absolute top-4 right-4 bg-primary text-primary-foreground rounded-full w-16 h-16 flex items-center justify-center text-4xl font-extrabold border-4 border-background shadow-lg">
              {game.currentLetter}
            </div>
          )}
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
