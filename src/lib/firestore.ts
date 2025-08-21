
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  onSnapshot,
  getDoc,
  DocumentReference,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { app } from './firebase'; // Assuming you have firebase initialized in this file

const db = getFirestore(app);
const functions = getFunctions(app);
const auth = getAuth(app);

// --- TYPES ---
interface Player {
  id: string;
  name: string;
}

interface Lobby {
  hostId: string;
  players: Player[];
  status: 'aguardando' | 'em_jogo';
  letraAtual?: string;
}

/**
 * Creates a new lobby in Firestore for a game of Stop.
 * @returns The ID of the newly created lobby.
 */
export async function createLobby(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Usuário não autenticado.');
  }

  const newLobbyRef = doc(db, 'lobbies');
  const hostPlayer: Player = {
    id: currentUser.uid,
    name: currentUser.displayName || 'Anfitrião',
  };

  const lobbyData: Lobby = {
    hostId: currentUser.uid,
    players: [hostPlayer],
    status: 'aguardando',
  };

  await setDoc(newLobbyRef, lobbyData);
  return newLobbyRef.id;
}

/**
 * Adds the current authenticated player to an existing lobby.
 * @param lobbyId The ID of the lobby to join.
 */
export async function joinLobby(lobbyId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Usuário não autenticado.');
  }

  const lobbyRef = doc(db, 'lobbies', lobbyId);
  const lobbySnap = await getDoc(lobbyRef);

  if (!lobbySnap.exists()) {
    throw new Error('Lobby não encontrado.');
  }

  const lobbyData = lobbySnap.data() as Lobby;
  const isAlreadyInLobby = lobbyData.players.some(p => p.id === currentUser.uid);

  if (isAlreadyInLobby) {
    console.log("Jogador já está no lobby.");
    return;
  }
  
  const newPlayer: Player = {
    id: currentUser.uid,
    name: currentUser.displayName || `Jogador ${lobbyData.players.length + 1}`,
  };

  await updateDoc(lobbyRef, {
    players: arrayUnion(newPlayer),
  });
}

/**
 * Listens for real-time updates on a specific lobby document.
 * @param lobbyId The ID of the lobby to listen to.
 * @param callback A function to be called with the lobby data whenever it changes.
 * @returns An unsubscribe function to stop listening for updates.
 */
export function listenLobby(
  lobbyId: string,
  callback: (data: Lobby | null) => void
): Unsubscribe {
  const lobbyRef = doc(db, 'lobbies', lobbyId);

  const unsubscribe = onSnapshot(lobbyRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as Lobby);
    } else {
      console.error('Lobby não encontrado ou foi deletado.');
      callback(null);
    }
  });

  return unsubscribe;
}

/**
 * Calls the 'startGame' Cloud Function to securely start the game.
 * This can only be successfully called by the host of the lobby.
 * @param lobbyId The ID of the lobby to start.
 */
export async function startGame(lobbyId: string): Promise<void> {
    const startGameFunction = httpsCallable(functions, 'startGame');
    try {
        console.log(`Chamando a Cloud Function 'startGame' para o lobby ${lobbyId}...`);
        const result = await startGameFunction({ lobbyId });
        console.log("Jogo iniciado com sucesso:", result.data);
    } catch (error) {
        console.error("Erro ao iniciar o jogo:", error);
        // O erro (por exemplo, permissão negada) será logado no console.
        // Você pode adicionar um tratamento de erro mais robusto aqui (ex: exibir um toast).
        throw error;
    }
}
