"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CATEGORIES } from '@/lib/constants';
import { Award, Check, ChevronsRight, Crown, Home, Loader2, RefreshCw, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { RoundScores } from '@/lib/types';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ResultsPage() {
  const router = useRouter();
  const { game, player, gameId, setGameId, setPlayerId } = useGame();
  const [roundScores, setRoundScores] = useState<RoundScores | null>(null);

  const players = useMemo(() => game?.players ? Object.values(game.players).filter(p => p.online || (game?.currentAnswers && p.id in game.currentAnswers)) : [], [game?.players, game?.currentAnswers]);
  const selectedCategories = useMemo(() => CATEGORIES.filter(c => game?.categories?.includes(c.id)), [game?.categories]);
  
  useEffect(() => {
    if (!game) {
      if (!gameId) router.replace('/');
      return;
    }
    
    if (game.state !== 'RESULTS') {
      router.replace('/');
      return;
    }
    if (!gameId) return;

    if (roundScores) return;

    const calculateScores = () => {
      if (!game.currentAnswers || Object.keys(game.currentAnswers).length === 0) {
        setRoundScores({});
        return;
      };

      const scores: RoundScores = players.reduce((acc, p) => ({ ...acc, [p.id]: { total: 0, categories: {} } }), {});
      const totalPlayersWithAnswers = players.filter(p => game.currentAnswers?.[p.id]).length;
      
      selectedCategories.forEach(category => {
        const answersForCategory: { player: string; answer: string }[] = [];
        
        players.forEach(p => {
            const answerKey = `${p.id}-${category.id}`;
            const votes = game.votes?.[answerKey]?.length || 0;
            const voters = game.players ? Object.values(game.players).filter(voter => voter.online && voter.id !== p.id).length : 0;
            const isNullified = voters > 0 && (votes / voters) > 0.5;

            if (isNullified) {
                scores[p.id].categories[category.id] = 0;
                return;
            }

            const rawAnswer = game.currentAnswers?.[p.id]?.[category.id] || '';
            const answer = rawAnswer.trim().toLowerCase();
            
            if (answer && answer.startsWith((game.currentLetter || '').toLowerCase())) {
                answersForCategory.push({ player: p.id, answer });
            } else {
                scores[p.id].categories[category.id] = 0;
            }
        });
        
        const answerCounts = answersForCategory.reduce((acc, { answer }) => {
          if(!answer) return acc;
          acc[answer] = (acc[answer] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        answersForCategory.forEach(({ player, answer }) => {
          if (answerCounts[answer] > 1) {
            scores[player].categories[category.id] = 5;
          } else {
            scores[player].categories[category.id] = 10;
          }
        });
      });

      const playerUpdates: Record<string, any> = {};
      Object.keys(scores).forEach(playerId => {
        const roundTotal = Object.values(scores[playerId].categories).reduce((sum, current) => sum + (current || 0), 0);
        scores[playerId].total = roundTotal;
        if (game.players[playerId]) {
          const currentTotal = game.players[playerId].totalScore || 0;
          playerUpdates[`players.${playerId}.totalScore`] = currentTotal + roundTotal;
        }
      });
      
      // Only host updates the final scores to avoid race conditions.
      if (player?.id === game.hostId && Object.keys(playerUpdates).length > 0) {
        const gameRef = doc(db, 'games', gameId);
        updateDoc(gameRef, playerUpdates).catch(error => {
          console.error("Failed to update scores:", error);
        });
      }
      setRoundScores(scores);
    };

    calculateScores();
  }, [game, players, selectedCategories, player, gameId, router, roundScores]);

  const handleNextRound = async () => {
    if ((player?.id === game?.hostId || players.length === 1) && gameId) {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, { 
          state: 'CATEGORIES', 
          roundWinner: null,
          currentAnswers: {},
          votes: {},
      });
    }
  };

  const handleNewGame = async () => {
    if (player?.id === game?.hostId && gameId) {
       const gameRef = doc(db, 'games', gameId);
       await deleteDoc(gameRef);
    }
    setGameId(null);
    setPlayerId(null);
    router.push('/');
  };

  const sortedPlayers = useMemo(() => {
    if (!game?.players) return [];
    return Object.values(game.players).sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  }, [game?.players]);

  if (!roundScores || !game) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-xl text-muted-foreground">Calculando resultados...</p>
        </div>
    );
  }

  const renderScoreIcon = (score: number | undefined) => {
    if (score === undefined || score === 0) return <X className="text-destructive" />;
    if (score === 10) return <Check className="text-green-500" />;
    if (score === 5) return <ChevronsRight className="text-yellow-500" />;
    return <X className="text-destructive" />;
  };

  const isHost = player?.id === game.hostId;
  const isSinglePlayer = players.length === 1;

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]"></div>
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <Card className="shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold flex items-center gap-2"><Award className="text-primary"/> Resultados da Rodada ({game.currentLetter})</CardTitle>
                    <CardDescription>
                      {game.roundWinner && game.players[game.roundWinner] ? `${game.players[game.roundWinner].name} apertou STOP! Veja a pontuação.` : 'Confira a pontuação da rodada.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Categoria</TableHead>
                            {players.map(p => <TableHead key={p.id} className="text-center">{p.name}</TableHead>)}
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {selectedCategories.map(category => (
                            <TableRow key={category.id}>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            {players.map(p => {
                                const answerKey = `${p.id}-${category.id}`;
                                const votes = game.votes?.[answerKey]?.length || 0;
                                const voters = game.players ? Object.values(game.players).filter(voter => voter.online && voter.id !== p.id).length : 0;
                                const isNullified = voters > 0 && (votes / voters) > 0.5;

                                return (
                                <TableCell key={p.id} className="text-center">
                                <div className="flex flex-col items-center">
                                    <span className={isNullified ? 'line-through text-muted-foreground' : ''}>{game.currentAnswers?.[p.id]?.[category.id] || "-"}</span>
                                    <span className="font-bold text-lg flex items-center gap-1">
                                    { isNullified ? <ShieldAlert className="text-destructive"/> : renderScoreIcon(roundScores[p.id]?.categories[category.id])}
                                    {roundScores[p.id]?.categories[category.id] ?? 0}
                                    </span>
                                </div>
                                </TableCell>
                            )})}
                            </TableRow>
                        ))}
                        <TableRow className="bg-secondary/50">
                            <TableHead>Total da Rodada</TableHead>
                            {players.map(p => (
                            <TableHead key={p.id} className="text-center text-xl font-extrabold text-primary">
                                {roundScores[p.id]?.total ?? 0}
                            </TableHead>
                            ))}
                        </TableRow>
                        </TableBody>
                    </Table>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-1 space-y-8">
            <Card className="shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500 [animation-delay:200ms]">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold flex items-center gap-2"><Crown className="text-amber-400"/> Placar Geral</CardTitle>
                    <CardDescription>A corrida para se tornar a lenda da Adedanha!</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        {sortedPlayers.map((p, index) => (
                        <li key={p.id} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-amber-100 dark:bg-amber-900/50 border border-amber-400' : 'bg-secondary/50'}`}>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-lg w-6">{index + 1}.</span>
                                <span className="font-medium">{p.name}</span>
                            </div>
                            <span className="font-extrabold text-xl text-primary">{p.totalScore}</span>
                        </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
            <Card className="shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500 [animation-delay:400ms]">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold">E agora?</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {isHost || isSinglePlayer ? (
                        <>
                            <Button onClick={handleNextRound} size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
                               <RefreshCw className="mr-2"/> Próxima Rodada
                           </Button>
                           <Button onClick={handleNewGame} size="lg" variant="outline" className="w-full font-bold">
                               <Home className="mr-2"/> Encerrar e Voltar
                           </Button>
                        </>
                    ) : (
                        <p className="text-center text-muted-foreground">Aguardando o anfitrião iniciar a próxima rodada ou encerrar o jogo.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
