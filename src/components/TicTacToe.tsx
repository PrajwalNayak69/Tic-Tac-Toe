"use client";
import { useEffect, useState } from "react";
import { useNakama } from "../lib/useNakama";
import type { Match } from "@heroiclabs/nakama-js";

const OP_CODE_MOVE = 1;
const OP_CODE_STATE = 2;
const OP_CODE_READY = 3;

interface GameState {
  board: string[];
  players: string[];
  turn: number;
  winner: string | null;
  started: boolean;
  playersReady: { [key: string]: boolean };
  playerNicknames: { [key: string]: string };
}

export default function TicTacToe() {
  const { socket, session, connected, client } = useNakama();
  const [match, setMatch] = useState<Match | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState<number>(-1);
  const [status, setStatus] = useState("Connecting...");
  const [searching, setSearching] = useState(false);
  const [nickname, setNickname] = useState("");
  const [inputNickname, setInputNickname] = useState("");
  const [nicknameSet, setNicknameSet] = useState(false);
  const [lobbyNickname, setLobbyNickname] = useState("");

  // Handle incoming match data
  useEffect(() => {
    if (!socket || !session) return;

    const matchDataHandler = (data: any) => {
      if (data.op_code === OP_CODE_STATE) {
        const state: GameState = JSON.parse(
          new TextDecoder().decode(data.data)
        );
        
        const myIndex = state.players.indexOf(session.user_id);
        setMyPlayerIndex(myIndex);
        setGameState(state);

        console.log("📦 Game state updated:", state);

        // Update status
        if (!state.started) {
          const bothReady = state.playersReady && state.players.every(p => state.playersReady[p]);
          if (bothReady) {
            setStatus("Starting game...");
          } else {
            setStatus("Waiting for players to ready up...");
          }
        } else if (state.winner) {
          if (state.winner === "draw") {
            setStatus("Game ended in a draw!");
          } else if (state.winner === "abandoned") {
            setStatus("Opponent left the game");
          } else {
            const winnerIndex = state.winner === "X" ? 0 : 1;
            setStatus(
              winnerIndex === myIndex ? "🎉 You won!" : "😢 You lost!"
            );
          }
        } else {
          const isMyTurn = state.turn === myIndex;
          setStatus(
            isMyTurn ? "Your turn!" : "Opponent's turn..."
          );
        }
      }
    };

    const matchmakerMatchedHandler = async (matched: any) => {
      console.log("🎯 Matchmaker found opponent!", matched);
      setSearching(false);
      
      try {
        const joinedMatch = await socket.joinMatch(matched.match_id);
        setMatch(joinedMatch);
        setLobbyNickname(nickname); // Pre-fill with current nickname
        setStatus("Match found! Confirm your nickname...");
        console.log("✅ Joined matchmade game:", matched.match_id);
      } catch (err) {
        console.error("❌ Failed to join matchmade game:", err);
        setStatus("Failed to join match");
      }
    };

    socket.onmatchdata = matchDataHandler;
    socket.onmatchmakermatched = matchmakerMatchedHandler;

    return () => {
      socket.onmatchdata = () => {};
      socket.onmatchmakermatched = () => {};
    };
  }, [socket, session, nickname]);

  // Confirm nickname (no Nakama account update)
  const confirmNickname = () => {
    if (!inputNickname.trim()) return;
    setNickname(inputNickname.trim());
    setNicknameSet(true);
    console.log("✅ Nickname set:", inputNickname.trim());
  };

  // Start matchmaking
  const findMatch = async () => {
    if (!socket) return;
    try {
      setSearching(true);
      setStatus("Searching for opponent...");
      console.log("🔍 Starting matchmaker...");
      
      const ticket = await socket.addMatchmaker("*", 2, 2, {});
      console.log("✅ Added to matchmaker queue:", ticket);
    } catch (err: any) {
      console.error("❌ Matchmaker failed:", err);
      setStatus("Matchmaking failed: " + err.message);
      setSearching(false);
    }
  };

  // Cancel matchmaking
  const cancelSearch = () => {
    setSearching(false);
    setStatus("Search cancelled");
    console.log("❌ Cancelled matchmaking");
  };

  // Send ready signal with nickname
  const sendReady = async () => {
    if (!socket || !match || !session || !lobbyNickname.trim()) return;
    
    try {
      await socket.sendMatchState(
        match.match_id,
        OP_CODE_READY,
        JSON.stringify({ 
          nickname: lobbyNickname.trim(),
          userId: session.user_id 
        })
      );
      console.log(`✅ Sent ready with nickname: ${lobbyNickname}`);
    } catch (err) {
      console.error("❌ Failed to send ready:", err);
    }
  };

  // Make a move
  const makeMove = async (cellIndex: number) => {
    if (!socket || !match || !gameState) return;
    if (gameState.turn !== myPlayerIndex) return;
    if (gameState.board[cellIndex] !== "") return;
    if (gameState.winner) return;

    try {
      await socket.sendMatchState(
        match.match_id,
        OP_CODE_MOVE,
        JSON.stringify({ cell: cellIndex })
      );
      console.log(`📤 Sent move: cell ${cellIndex}`);
    } catch (err) {
      console.error("❌ Failed to send move:", err);
    }
  };

  // Leave match
  const leaveMatch = async () => {
    if (!socket || !match) return;
    try {
      await socket.leaveMatch(match.match_id);
      setMatch(null);
      setGameState(null);
      setMyPlayerIndex(-1);
      setLobbyNickname("");
      setStatus("Left match");
      console.log("👋 Left match");
    } catch (err) {
      console.error("❌ Failed to leave match:", err);
    }
  };

  // UI: Not Connected
  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white text-xl">
        Connecting to server...
      </div>
    );
  }

  // UI: Nickname Screen (ALWAYS show first)
  if (!nicknameSet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
        <h1 className="text-5xl font-bold text-white mb-4">Welcome!</h1>
        <p className="text-gray-400 text-lg mb-8">Choose your nickname</p>

        <div className="flex flex-col gap-4 w-full max-w-md">
          <input
            type="text"
            value={inputNickname}
            onChange={(e) => setInputNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && inputNickname.trim() && confirmNickname()}
            placeholder="Enter your nickname"
            maxLength={20}
            className="px-6 py-4 bg-gray-800 text-white text-xl rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700"
            autoFocus
          />
          <button
            onClick={confirmNickname}
            disabled={!inputNickname.trim()}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl text-xl font-bold transition-all disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // UI: No Match (Lobby)
  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
        <h1 className="text-5xl font-bold text-white mb-2">Tic-Tac-Toe</h1>
        <p className="text-blue-400 text-xl mb-8">Welcome, {nickname}!</p>

        {!searching ? (
          <>
            <button
              onClick={findMatch}
              className="px-12 py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl text-2xl font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              Find Match
            </button>
            <p className="text-gray-500 text-sm mt-6">
              You'll be automatically matched with another player
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="text-xl text-gray-300">{status}</span>
            </div>
            <button
              onClick={cancelSearch}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // UI: Pre-Game Lobby
  if (match && gameState && !gameState.started) {
    const myUserId = session?.user_id || "";
    const isReady = (gameState.playersReady && gameState.playersReady[myUserId]) || false;
    const opponentId = gameState.players.find(p => p !== myUserId);
    const opponentReady = opponentId && gameState.playersReady ? gameState.playersReady[opponentId] : false;
    const opponentNickname = opponentId && gameState.playerNicknames ? gameState.playerNicknames[opponentId] : null;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
        <h1 className="text-5xl font-bold text-white mb-2">Match Found!</h1>
        <p className="text-gray-400 text-lg mb-8">Confirm your nickname to start</p>

        <div className="flex flex-col gap-6 w-full max-w-2xl">
          {/* Player 1 (You) */}
          <div className={`flex items-center gap-4 p-6 rounded-xl transition-all ${
            isReady ? 'bg-green-900/30 ring-2 ring-green-500' : 'bg-gray-800'
          }`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold text-blue-400">X</span>
                <span className="text-gray-400">You</span>
              </div>
              {!isReady ? (
                <input
                  type="text"
                  value={lobbyNickname}
                  onChange={(e) => setLobbyNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lobbyNickname.trim() && sendReady()}
                  placeholder="Enter your nickname"
                  maxLength={20}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <div className="text-2xl font-bold text-white">
                  {gameState.playerNicknames?.[myUserId] || nickname}
                </div>
              )}
            </div>
            {isReady ? (
              <div className="flex items-center gap-2 text-green-400">
                <span className="text-xl">✓</span>
                <span>Ready</span>
              </div>
            ) : (
              <button
                onClick={sendReady}
                disabled={!lobbyNickname.trim()}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition disabled:cursor-not-allowed"
              >
                Ready
              </button>
            )}
          </div>

          {/* Player 2 (Opponent) */}
          <div className={`flex items-center gap-4 p-6 rounded-xl transition-all ${
            opponentReady ? 'bg-green-900/30 ring-2 ring-green-500' : 'bg-gray-800'
          }`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold text-red-400">O</span>
                <span className="text-gray-400">Opponent</span>
              </div>
              {opponentReady && opponentNickname ? (
                <div className="text-2xl font-bold text-white">{opponentNickname}</div>
              ) : (
                <div className="text-gray-500 italic">Choosing nickname...</div>
              )}
            </div>
            {opponentReady && (
              <div className="flex items-center gap-2 text-green-400">
                <span className="text-xl">✓</span>
                <span>Ready</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={leaveMatch}
          className="mt-8 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
        >
          Leave Match
        </button>
      </div>
    );
  }

  // UI: In Game
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
      <h1 className="text-5xl font-bold text-white mb-2">Tic-Tac-Toe</h1>
      <div className="text-xl text-gray-300 mb-4">{status}</div>

      {/* Player Info */}
      {gameState && gameState.players.length === 2 && (
        <div className="flex gap-8 mb-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${myPlayerIndex === 0 ? 'bg-blue-900/30 ring-2 ring-blue-500' : 'bg-gray-800'}`}>
            <span className="text-2xl font-bold text-blue-400">X</span>
            <span className="text-white">{gameState.playerNicknames?.[gameState.players[0]] || "Player 1"}</span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${myPlayerIndex === 1 ? 'bg-red-900/30 ring-2 ring-red-500' : 'bg-gray-800'}`}>
            <span className="text-2xl font-bold text-red-400">O</span>
            <span className="text-white">{gameState.playerNicknames?.[gameState.players[1]] || "Player 2"}</span>
          </div>
        </div>
      )}

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {gameState?.board.map((cell, i) => (
          <button
            key={i}
            onClick={() => makeMove(i)}
            disabled={
              !gameState.started ||
              gameState.turn !== myPlayerIndex ||
              cell !== "" ||
              !!gameState.winner
            }
            className={`
              w-24 h-24 text-5xl font-bold rounded-xl transition-all
              ${cell === "X" ? "text-blue-400" : "text-red-400"}
              ${
                gameState.turn === myPlayerIndex && cell === "" && !gameState.winner
                  ? "bg-gray-700 hover:bg-gray-600 cursor-pointer shadow-lg"
                  : "bg-gray-800 cursor-not-allowed"
              }
            `}
          >
            {cell}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={leaveMatch}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
        >
          Leave Game
        </button>

        {gameState?.winner && (
          <button
            onClick={() => {
              leaveMatch();
              setTimeout(() => findMatch(), 100);
            }}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            Find New Match
          </button>
        )}
      </div>
    </div>
  );
}