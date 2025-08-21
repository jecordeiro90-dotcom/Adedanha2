
/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin SDK
initializeApp();

/**
 * Cloud Function to start a game lobby.
 *
 * This function is callable from the client. It verifies that the caller
 * is the host of the lobby before proceeding to update the game state.
 */
exports.startGame = onCall(async (request) => {
  // Check if the user is authenticated.
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "A função só pode ser chamada por um usuário autenticado."
    );
  }

  const { lobbyId } = request.data;
  if (!lobbyId || typeof lobbyId !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "O ID do lobby é obrigatório e deve ser uma string."
    );
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const lobbyRef = db.collection("lobbies").doc(lobbyId);

  try {
    const lobbyDoc = await lobbyRef.get();

    // Check if the lobby exists.
    if (!lobbyDoc.exists) {
      throw new HttpsError("not-found", "O lobby especificado não foi encontrado.");
    }

    const lobbyData = lobbyDoc.data();

    // Verify if the caller is the host of the lobby.
    if (lobbyData.hostId !== uid) {
      throw new HttpsError(
        "permission-denied",
        "Apenas o anfitrião da sala pode iniciar o jogo."
      );
    }

    // Generate a random letter from A-Z.
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

    // Update the lobby status and set the current letter.
    await lobbyRef.update({
      status: "em_jogo",
      letraAtual: randomLetter,
    });

    logger.info(`Lobby ${lobbyId} iniciado pelo host ${uid} com a letra ${randomLetter}.`);

    return {
      success: true,
      letraAtual: randomLetter,
    };
  } catch (error) {
    logger.error(`Erro ao iniciar o lobby ${lobbyId}:`, error);
    // Re-throw internal errors as HTTPS errors for the client.
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Ocorreu um erro inesperado ao iniciar o jogo.");
  }
});
