"use client";

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CATEGORIES } from '@/lib/constants';
import { Gavel, Loader2, ThumbsDown, ThumbsUp, ArrowRight } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ValidationPage() {
  const router = useRouter();
  const { game, player, gameId } = useGame();

  const players = useMemo(() => game?.players ? Object.values(game.players).filter(p => game.currentAnswers?.[p.id]) : [], [game?.players, game?.currentAnswers]);
  const selectedCategories = useMemo(() => CATEGORIES.filter(c => game?.categories?.includes(c.id)), [game?.categories]);

  useEffect(() => {
    if (!game) {
        if (!gameId) router.replace('/');
        return;
    }
    if (game.state !== 'VALIDATION') {
        router.replace('/');
        return;
    }
  }, [game, gameId, router]);


  const handleVote = async (targetPlayerId: string, categoryId: string) => {
    if (!gameId || !player) return;
    
    const answerKey = `${targetPlayerId}-${categoryId}`;
    const gameRef = doc(db, 'games', gameId);
    
    const currentVotes = game?.votes?.[answerKey] || [];
    const hasVoted = currentVotes.includes(player.id);
    
    await updateDoc(gameRef, {
      [`votes.${answerKey}`]: hasVoted ? arrayRemove(player.id) : arrayUnion(player.id)
    });
  };

  const handleFinishValidation = async () => {
    if (!gameId || player?.id !== game?.hostId) return;

    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, { state: 'RESULTS' });
  };
  
  if (!game || !player) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Carregando validação...</p>
      </div>
    );
  }

  const isHost = player.id === game.hostId;
  const isSinglePlayer = Object.values(game.players).filter(p => p.online).length === 1;

  if (isSinglePlayer && isHost) {
      handleFinishValidation();
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-xl text-muted-foreground">Calculando seus resultados...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]"></div>
      
      <Card className="max-w-7xl mx-auto shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-2"><Gavel className="text-primary"/> Validação da Rodada ({game.currentLetter})</CardTitle>
          <CardDescription>
            Hora de serem os juízes! Votem para anular as respostas que consideram inválidas. Uma resposta será anulada se mais de 50% dos outros jogadores votarem nela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Categoria</TableHead>
                  {players.map(p => <TableHead key={p.id} className="text-center">{p.name}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCategories.map(category => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    {players.map(p => {
                       const answerKey = `${p.id}-${category.id}`;
                       const answer = game.currentAnswers?.[p.id]?.[category.id] || "-";
                       const myVote = game.votes?.[answerKey]?.includes(player.id);
                       const totalVotes = game.votes?.[answerKey]?.length || 0;
                       
                       const canVote = p.id !== player.id && answer !== "-";

                       return (
                        <TableCell key={p.id} className="text-center">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-lg">{answer}</span>
                            {canVote && (
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant={myVote ? "destructive" : "outline"}
                                        size="sm"
                                        onClick={() => handleVote(p.id, category.id)}
                                    >
                                        {myVote ? <ThumbsDown className="mr-2"/> : <ThumbsUp className="mr-2"/>}
                                        {myVote ? "Anulado" : "Anular"}
                                    </Button>
                                    <span className="text-sm font-bold w-4">{totalVotes}</span>
                                </div>
                            )}
                          </div>
                        </TableCell>
                       )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 flex justify-center">
        {isHost ? (
          <Button onClick={handleFinishValidation} size="lg">
            Finalizar Validação e Ver Resultados <ArrowRight className="ml-2"/>
          </Button>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">Aguardando o anfitrião finalizar a validação...</p>
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
