"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Gamepad2, Users, ArrowRight, Loader2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Game, GameState } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const { setPlayerId, setGameId } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [loadingMode, setLoadingMode] = useState<GameState | null>(null);
  const { toast } = useToast();

  const handleCreateGame = async (mode: 'single' | 'multi') => {
    if (!playerName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, insira seu nome para jogar.',
        variant: 'destructive',
      });
      return;
    }
    
    const targetState: GameState = mode === 'single' ? 'CATEGORIES' : 'LOBBY';
    setLoadingMode(targetState);

    const newPlayerId = nanoid();
    const newGameId = nanoid(6);

    const newGame: Game = {
      id: newGameId,
      hostId: newPlayerId,
      state: targetState,
      players: {
        [newPlayerId]: {
          id: newPlayerId,
          name: playerName.trim(),
          totalScore: 0,
          online: true,
        },
      },
      createdAt: Date.now(),
      categories: [],
      usedLetters: [],
    };
    
    try {
      await setDoc(doc(db, `games/${newGameId}`), newGame);
      setPlayerId(newPlayerId);
      setGameId(newGameId);
      
      const destination = mode === 'single' ? '/categories' : `/lobby/${newGameId}`;
      router.push(destination);

    } catch (error) {
      console.error("Failed to create game:", error);
      toast({
        title: 'Erro ao criar jogo',
        description: 'Não foi possível criar a sala. Tente novamente.',
        variant: 'destructive',
      });
      setLoadingMode(null);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]"></div>
      <Card className="w-full max-w-md shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Gamepad2 className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-4xl font-extrabold font-headline tracking-tight">Adedanha Online</CardTitle>
          <CardDescription>O clássico jogo de palavras, agora multiplayer!</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-center text-muted-foreground">
              Para começar, digite seu nome e escolha um modo de jogo.
            </p>
            <Input
              type="text"
              placeholder="Seu nome"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="text-lg text-center"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-4">
          <Button 
            className="w-full" 
            size="lg" 
            variant="outline"
            onClick={() => handleCreateGame('single')}
            disabled={!!loadingMode}
          >
            {loadingMode === 'CATEGORIES' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Users className="mr-2" />
            )}
            Jogar Sozinho
          </Button>
          <Button 
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold" 
            size="lg" 
            onClick={() => handleCreateGame('multi')}
            disabled={!!loadingMode}
          >
            {loadingMode === 'LOBBY' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <ArrowRight className="mr-2" />
            )}
            Criar Sala Multiplayer
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
