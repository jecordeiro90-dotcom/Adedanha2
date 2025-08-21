import type { LucideIcon } from "lucide-react";

export interface Player {
  id: string;
  name: string;
  totalScore: number;
  online?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
}

export interface RoundAnswers {
  [playerId: string]: {
    [categoryId: string]: string;
  };
}

export interface RoundScores {
  [playerId: string]: {
    total: number;
    categories: {
      [categoryId: string]: number;
    };
  };
}

export type GameState = 'LOBBY' | 'CATEGORIES' | 'GAME' | 'VALIDATION' | 'RESULTS';

// key: `${playerId}-${categoryId}`
// value: string[] of playerIds who voted to nullify
export interface Votes {
  [answerKey: string]: string[];
}

export interface Game {
    id: string;
    hostId: string;
    state: GameState;
    players: Record<string, Player>;
    categories: string[];
    usedLetters: string[];
    createdAt: number;
    currentLetter?: string;
    currentAnswers?: RoundAnswers;
    roundWinner?: string | null;
    votes?: Votes;
}
