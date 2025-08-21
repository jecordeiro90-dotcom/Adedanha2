"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CATEGORIES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { ListChecks, ArrowLeft, ArrowRight, Loader2, Plus } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function CategoriesPage() {
  const router = useRouter();
  const { game, player, gameId } = useGame();
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['nome', 'cor', 'fruta', 'animal', 'lugar']);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!game) return;
    if (game.state !== 'CATEGORIES') router.replace('/');
  }, [game, router]);

  const handleToggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAddCategory = () => {
    const id = newCategory.trim().toLowerCase().replace(/\s+/g, '-');
    if (!id || selectedCategories.includes(id) || customCategories.includes(id)) return;

    setCustomCategories(prev => [...prev, id]);
    setSelectedCategories(prev => [...prev, id]);
    setNewCategory('');
  };

  const handleStartGame = async () => {
    if (selectedCategories.length < 2) {
      toast({
        title: 'Ops!',
        description: 'Escolha pelo menos duas categorias para jogar.',
        variant: 'destructive',
      });
      return;
    }

    if (!gameId || !game) return;

    setIsLoading(true);
    try {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVXZ";
      const availableLetters = [...alphabet].filter(
        (l) => !(game?.usedLetters || []).includes(l)
      );
      if (availableLetters.length === 0) {
        toast({ title: 'Fim de jogo!', description: 'Todas as letras já foram usadas!', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const randomIndex = Math.floor(Math.random() * availableLetters.length);
      const newLetter = availableLetters[randomIndex];

      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        state: 'GAME',
        categories: selectedCategories,
        currentLetter: newLetter,
        usedLetters: [...(game?.usedLetters || []), newLetter],
        currentAnswers: {},
        roundWinner: null,
        votes: {},
      });

      setIsLoading(false);
    } catch (error) {
      console.error("Failed to start game:", error);
      toast({ title: 'Erro', description: 'Não foi possível iniciar o jogo.', variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const isHost = player?.id === game?.hostId;
  const isSinglePlayer = game ? Object.keys(game.players).length === 1 : false;
  const canControlGame = isHost || isSinglePlayer;

  if (!game || !player) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-4">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]" />
      <Card className="w-full max-w-lg shadow-2xl animate-in fade-in-50 zoom-in-95 duration-500">
        <CardHeader>
          <div className="flex justify-center items-center gap-2 mb-2">
            <ListChecks className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-center text-3xl font-bold">Escolha as Categorias</CardTitle>
          <CardDescription className="text-center">
            {canControlGame ? "Selecione os temas que farão parte do jogo." : "Aguardando o anfitrião escolher as categorias."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...CATEGORIES.map(c => ({ id: c.id, name: c.name })), ...customCategories.map(id => ({ id, name: id }))].map(category => (
              <Label
                key={category.id}
                htmlFor={category.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border bg-card transition-colors ${canControlGame ? 'cursor-pointer hover:bg-secondary/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary' : 'opacity-70 cursor-not-allowed'}`}
              >
                <Checkbox
                  id={category.id}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => handleToggleCategory(category.id)}
                  disabled={!canControlGame}
                />
                <span className="text-base font-medium capitalize">{category.name}</span>
              </Label>
            ))}
          </div>

          {canControlGame && (
            <div className="flex gap-2 mt-4">
              <Input
                placeholder="Nova categoria (ex: profissão)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <Button type="button" onClick={handleAddCategory}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
          )}
        </CardContent>

        {canControlGame && (
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
            {!isSinglePlayer && (
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link href={`/lobby/${gameId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Lobby</Link>
              </Button>
            )}
            <Button
              className="w-full sm:w-auto flex-grow bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
              size="lg"
              onClick={handleStartGame}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Começar a Jogar!
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
