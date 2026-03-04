const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { buildWall, canHu, canPeng, canChi, sortTiles } = require('./src/game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function createRoom(roomId, ownerId) {
  return {
    roomId,
    ownerId,
    players: [],
    started: false,
    currentTurn: 0,
    wall: [],
    discards: [[], [], [], []],
    melds: [[], [], [], []],
    lastDiscard: null,
    waitingClaims: null,
    winner: null,
  };
}

function publicState(room, viewerSocketId = null) {
  return {
    roomId: room.roomId,
    started: room.started,
    currentTurn: room.currentTurn,
    wallCount: room.wall.length,
    lastDiscard: room.lastDiscard,
    winner: room.winner,
    players: room.players.map((p, idx) => ({
      seat: idx,
      id: p.id,
      name: p.name,
      ready: p.ready,
      online: p.online,
      handCount: p.hand.length,
      hand: p.socketId === viewerSocketId ? sortTiles(p.hand) : undefined,
      melds: room.melds[idx],
      discards: room.discards[idx],
    })),
  };
}

function nextSeat(seat) {
  return (seat + 1) % 4;
}

function cleanupRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const onlineCount = room.players.filter((p) => p.online).length;
  if (onlineCount === 0) rooms.delete(roomId);
}

function startGame(room) {
  room.started = true;
  room.winner = null;
  room.wall = buildWall();
  room.discards = [[], [], [], []];
  room.melds = [[], [], [], []];
  room.lastDiscard = null;
  room.waitingClaims = null;

  for (let i = 0; i < 4; i += 1) {
    room.players[i].hand = room.wall.splice(0, 13);
  }
  room.currentTurn = 0;
  room.players[0].hand.push(room.wall.shift());

  io.to(room.roomId).emit('state', publicState(room));
  io.to(room.roomId).emit('log', '牌局开始，东家先手。');
}

function scheduleClaimResolve(room) {
  if (!room.waitingClaims) return;
  const token = room.waitingClaims.token;
  setTimeout(() => {
    if (!room.waitingClaims || room.waitingClaims.token !== token) return;
    resolveClaims(room);
  }, 6000);
}

function resolveClaims(room) {
  const wc = room.waitingClaims;
  if (!wc) return;

  const allClaims = [...wc.claims.values()];
  const hu = allClaims.find((c) => c.type === 'hu');
  if (hu) {
    room.winner = {
      seat: hu.seat,
      by: 'discard',
      tile: wc.tile,
      fromSeat: wc.fromSeat,
    };
    room.started = false;
    room.waitingClaims = null;
    io.to(room.roomId).emit('state', publicState(room));
    io.to(room.roomId).emit('log', `玩家 ${hu.seat} 抢胡 ${wc.tile}，本局结束。`);
    return;
  }

  const peng = allClaims.find((c) => c.type === 'peng');
  if (peng) {
    const p = room.players[peng.seat];
    removeTilesFromHand(p.hand, [wc.tile, wc.tile]);
    room.melds[peng.seat].push({ type: 'peng', tiles: [wc.tile, wc.tile, wc.tile] });
    room.currentTurn = peng.seat;
    room.lastDiscard = null;
    room.waitingClaims = null;
    io.to(room.roomId).emit('state', publicState(room));
    io.to(room.roomId).emit('log', `玩家 ${peng.seat} 碰 ${wc.tile}。`);
    return;
  }

  const chi = allClaims.find((c) => c.type === 'chi');
  if (chi) {
    const p = room.players[chi.seat];
    removeTilesFromHand(p.hand, chi.consumed);
    room.melds[chi.seat].push({ type: 'chi', tiles: [...chi.consumed, wc.tile].sort() });
    room.currentTurn = chi.seat;
    room.lastDiscard = null;
    room.waitingClaims = null;
    io.to(room.roomId).emit('state', publicState(room));
    io.to(room.roomId).emit('log', `玩家 ${chi.seat} 吃 ${wc.tile}。`);
    return;
  }

  room.currentTurn = nextSeat(wc.fromSeat);
  room.waitingClaims = null;
  drawIfNeeded(room);
}

function removeTilesFromHand(hand, tiles) {
  for (const t of tiles) {
    const idx = hand.indexOf(t);
    if (idx >= 0) hand.splice(idx, 1);
  }
}

function drawIfNeeded(room) {
  if (!room.started) return;
  const player = room.players[room.currentTurn];
  if (player.hand.length % 3 === 1) {
    io.to(room.roomId).emit('state', publicState(room));
    return;
  }
  const tile = room.wall.shift();
  if (!tile) {
    room.started = false;
    room.winner = { by: 'draw-game' };
    io.to(room.roomId).emit('state', publicState(room));
    io.to(room.roomId).emit('log', '流局，牌墙耗尽。');
    return;
  }
  player.hand.push(tile);
  io.to(room.roomId).emit('state', publicState(room));
  io.to(room.roomId).emit('log', `轮到玩家 ${room.currentTurn}，摸牌。`);
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ roomId, name }) => {
    if (!roomId || rooms.has(roomId)) {
      socket.emit('error_message', '房间号无效或已存在');
      return;
    }
    const room = createRoom(roomId, socket.id);
    rooms.set(roomId, room);
    socket.emit('room_created', roomId);
    socket.emit('log', '房间创建成功。');
    joinRoom(socket, { roomId, name });
  });

  socket.on('join_room', (payload) => joinRoom(socket, payload));

  socket.on('toggle_ready', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.started) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    player.ready = !player.ready;
    io.to(roomId).emit('state', publicState(room));
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.started) return;
    if (room.players.length !== 4) {
      socket.emit('error_message', '需要 4 名玩家才能开始');
      return;
    }
    if (!room.players.every((p) => p.ready)) {
      socket.emit('error_message', '所有玩家需要先准备');
      return;
    }
    startGame(room);
  });

  socket.on('discard', ({ roomId, tile }) => {
    const room = rooms.get(roomId);
    if (!room || !room.started || room.waitingClaims) return;
    const seat = room.players.findIndex((p) => p.socketId === socket.id);
    if (seat < 0 || seat !== room.currentTurn) return;

    const player = room.players[seat];
    const idx = player.hand.indexOf(tile);
    if (idx < 0) return;
    player.hand.splice(idx, 1);
    room.discards[seat].push(tile);
    room.lastDiscard = { seat, tile };

    const claims = new Map();
    for (let i = 1; i <= 3; i += 1) {
      const targetSeat = (seat + i) % 4;
      const target = room.players[targetSeat];
      const handIfHu = [...target.hand, tile];
      const canHuNow = canHu(handIfHu);
      const canPengNow = canPeng(target.hand, tile);
      const canChiNow = i === 1 ? canChi(target.hand, tile) : [];
      if (canHuNow || canPengNow || canChiNow.length) {
        claims.set(targetSeat, {
          canHu: canHuNow,
          canPeng: canPengNow,
          chiOptions: canChiNow,
        });
      }
    }

    if (claims.size > 0) {
      room.waitingClaims = {
        token: Date.now() + Math.random(),
        fromSeat: seat,
        tile,
        claims: new Map(),
      };
      for (const [targetSeat, ability] of claims.entries()) {
        const targetPlayer = room.players[targetSeat];
        io.to(targetPlayer.socketId).emit('claim_options', {
          roomId,
          tile,
          fromSeat: seat,
          ...ability,
        });
      }
      io.to(roomId).emit('state', publicState(room));
      scheduleClaimResolve(room);
      return;
    }

    room.currentTurn = nextSeat(seat);
    drawIfNeeded(room);
  });

  socket.on('claim', ({ roomId, type, consumed }) => {
    const room = rooms.get(roomId);
    if (!room || !room.waitingClaims) return;
    const seat = room.players.findIndex((p) => p.socketId === socket.id);
    if (seat < 0) return;

    if (type === 'hu') {
      room.waitingClaims.claims.set(seat, { seat, type: 'hu' });
    } else if (type === 'peng') {
      if (canPeng(room.players[seat].hand, room.waitingClaims.tile)) {
        room.waitingClaims.claims.set(seat, { seat, type: 'peng' });
      }
    } else if (type === 'chi') {
      const options = canChi(room.players[seat].hand, room.waitingClaims.tile);
      if (Array.isArray(consumed) && consumed.length === 2) {
        const key = consumed.slice().sort().join(',');
        const ok = options.some((o) => o.slice().sort().join(',') === key);
        if (ok) room.waitingClaims.claims.set(seat, { seat, type: 'chi', consumed });
      }
    } else if (type === 'pass') {
      room.waitingClaims.claims.set(seat, { seat, type: 'pass' });
    }

    resolveClaims(room);
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      const p = room.players.find((x) => x.socketId === socket.id);
      if (p) {
        p.online = false;
        io.to(roomId).emit('state', publicState(room));
        io.to(roomId).emit('log', `${p.name} 断线。`);
      }
      cleanupRoomIfEmpty(roomId);
    }
  });
});

function joinRoom(socket, { roomId, name }) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit('error_message', '房间不存在');
    return;
  }
  if (room.players.length >= 4) {
    socket.emit('error_message', '房间已满');
    return;
  }

  const player = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    socketId: socket.id,
    name: name || `玩家${room.players.length + 1}`,
    ready: false,
    online: true,
    hand: [],
  };
  room.players.push(player);
  socket.join(roomId);
  socket.emit('joined_room', { roomId, seat: room.players.length - 1 });
  io.to(roomId).emit('state', publicState(room));
  io.to(roomId).emit('log', `${player.name} 加入房间。`);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mahjong server running on http://localhost:${PORT}`);
});
