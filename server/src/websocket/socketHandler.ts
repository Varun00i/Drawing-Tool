import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  Room, Player, RoomSettings, RoomState, MatchResult,
  ServerToClientEvents, ClientToServerEvents,
} from '../types';
import { computeScore } from '../scoring/engine';

const rooms = new Map<string, Room>();
const playerRooms = new Map<string, string>(); // socketId -> roomId

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastRoomState(io: Server, room: Room) {
  io.to(room.id).emit('room:state', room);
}

export function setupWebSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Player connected: ${socket.id}`);

    // ── Create Room ──
    socket.on('room:create', async (settings: RoomSettings, playerName: string, callback) => {
      const room: Room = {
        id: uuidv4(),
        code: generateCode(),
        hostId: socket.id,
        players: [{
          id: socket.id,
          name: playerName || 'Player 1',
          connected: true,
          hasSubmitted: false,
        }],
        settings: { ...settings, maxPlayers: Math.min(settings.maxPlayers || 6, 6) },
        state: 'lobby',
        createdAt: Date.now(),
      };

      rooms.set(room.id, room);
      playerRooms.set(socket.id, room.id);
      socket.join(room.id);

      callback(room);
    });

    // ── Join Room ──
    socket.on('room:join', (code: string, playerName: string, callback) => {
      const room = Array.from(rooms.values()).find(r => r.code === code);

      if (!room) {
        callback(null, 'Room not found');
        return;
      }

      if (room.state !== 'lobby') {
        callback(null, 'Match already in progress');
        return;
      }

      if (room.players.length >= (room.settings.maxPlayers || 6)) {
        socket.emit('room:full');
        callback(null, 'Room is full (max 6 players)');
        return;
      }

      const player: Player = {
        id: socket.id,
        name: playerName || `Player ${room.players.length + 1}`,
        connected: true,
        hasSubmitted: false,
      };

      room.players.push(player);
      playerRooms.set(socket.id, room.id);
      socket.join(room.id);

      io.to(room.id).emit('room:player-joined', player);
      broadcastRoomState(io, room);

      callback(room);
    });

    // ── Start Match ──
    socket.on('room:start-match', async () => {
      const roomId = playerRooms.get(socket.id);
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;

      room.state = 'countdown';
      broadcastRoomState(io, room);

      // Countdown
      let countdownSec = 3;
      const countdownInterval = setInterval(() => {
        io.to(room.id).emit('room:countdown', countdownSec);
        countdownSec--;

        if (countdownSec < 0) {
          clearInterval(countdownInterval);
          startMatch(io, room);
        }
      }, 1000);
    });

    // ── Submit Sketch ──
    socket.on('room:submit', async (imageData: string, callback) => {
      const roomId = playerRooms.get(socket.id);
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room || room.state !== 'playing') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.hasSubmitted) return;

      player.hasSubmitted = true;
      player.submissionTime = Date.now() - (room.startedAt || Date.now());

      io.to(room.id).emit('room:player-submitted', socket.id);

      // Score the submission
      try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '..', '..', 'uploads', 'submissions');
        fs.mkdirSync(dir, { recursive: true });
        const filename = `${Date.now()}-${socket.id.substring(0, 8)}.png`;
        const filepath = path.join(dir, filename);

        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

        player.thumbnailUrl = `/uploads/submissions/${filename}`;

        const refPath = room.referenceImageUrl || '';
        const result = await computeScore(filepath, refPath, room.settings.difficulty);

        player.score = result.score;

        const matchResult: MatchResult = {
          playerId: socket.id,
          playerName: player.name,
          score: result.score,
          rank: 0,
          submissionTime: player.submissionTime,
          breakdown: result.breakdown,
          heatmapUrl: result.heatmapUrl,
          comparisonUrl: result.comparisonUrl,
          thumbnailUrl: player.thumbnailUrl,
        };

        if (!room.results) room.results = [];
        room.results.push(matchResult);

        callback(matchResult);
      } catch (err) {
        console.error('Scoring error for player', socket.id, err);
        const fallbackResult: MatchResult = {
          playerId: socket.id,
          playerName: player.name,
          score: 0,
          rank: 0,
          submissionTime: player.submissionTime || 0,
          breakdown: { contourIoU: 0, keypointMatch: 0, localSimilarity: 0, composite: 0 },
        };
        callback(fallbackResult);
      }

      // Check if all players submitted
      const allSubmitted = room.players.every(p => p.hasSubmitted || !p.connected);
      if (allSubmitted) {
        endMatch(io, room);
      }
    });

    // ── Leave Room ──
    socket.on('room:leave', () => {
      handlePlayerLeave(io, socket);
    });

    // ── Rematch ──
    socket.on('room:rematch', () => {
      const roomId = playerRooms.get(socket.id);
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id) return;

      room.state = 'lobby';
      room.results = [];
      room.referenceImageUrl = undefined;
      room.startedAt = undefined;
      room.endsAt = undefined;
      room.players.forEach(p => {
        p.hasSubmitted = false;
        p.score = undefined;
        p.submissionTime = undefined;
        p.thumbnailUrl = undefined;
      });

      broadcastRoomState(io, room);
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      handlePlayerLeave(io, socket);
    });
  });
}

async function startMatch(io: Server, room: Room) {
  // Generate or pick reference image
  const { generateReferenceImage } = require('../services/openrouter');
  try {
    const image = await generateReferenceImage(room.settings.difficulty);
    room.referenceImageUrl = image.url;
  } catch (err) {
    console.error('Failed to generate reference image:', err);
    room.referenceImageUrl = '';
  }

  room.state = 'playing';
  room.startedAt = Date.now();
  room.endsAt = Date.now() + room.settings.timerSeconds * 1000;

  io.to(room.id).emit('room:start', {
    referenceImageUrl: room.referenceImageUrl || '',
    endsAt: room.endsAt,
  });

  broadcastRoomState(io, room);

  // Auto-end after timer
  setTimeout(() => {
    if (room.state === 'playing') {
      endMatch(io, room);
    }
  }, room.settings.timerSeconds * 1000 + 2000);
}

function endMatch(io: Server, room: Room) {
  room.state = 'results';

  if (room.results) {
    // Sort by score descending, then by submission time ascending
    room.results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.submissionTime - b.submissionTime;
    });

    // Assign ranks
    room.results.forEach((r, i) => {
      r.rank = i + 1;
    });

    io.to(room.id).emit('room:results', room.results);
  }

  broadcastRoomState(io, room);
}

function handlePlayerLeave(io: Server, socket: Socket) {
  const roomId = playerRooms.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const player = room.players.find(p => p.id === socket.id);
  if (player) {
    player.connected = false;
  }

  socket.leave(room.id);
  playerRooms.delete(socket.id);

  io.to(room.id).emit('room:player-left', socket.id);

  // If all players left, clean up the room
  const connectedPlayers = room.players.filter(p => p.connected);
  if (connectedPlayers.length === 0) {
    rooms.delete(roomId);
  } else {
    // Transfer host if host left
    if (room.hostId === socket.id) {
      room.hostId = connectedPlayers[0].id;
    }
    broadcastRoomState(io, room);

    // If in playing state, check if all remaining submitted
    if (room.state === 'playing') {
      const allDone = room.players.every(p => p.hasSubmitted || !p.connected);
      if (allDone) endMatch(io, room);
    }
  }
}
