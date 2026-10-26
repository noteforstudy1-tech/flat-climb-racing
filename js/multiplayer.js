/**
 * Flat Climb Racing - PeerJS Multiplayer Network Engine
 * Peer-to-peer real-time synchronization via WebRTC DataChannels.
 * Both players see each other's live cars, engraved names, and race distance.
 * Made by Raghav Parashar
 */

class MultiplayerManager {
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.isConnected = false;
    this.roomId = null;
    this.remoteState = null;
    this.targetState = null;
    this.syncInterval = null;
    this.opponentProfile = {
      name: 'OPPONENT',
      livery: 'red'
    };
    this.activeEmote = null;
    this.emoteTimeout = null;

    this.onStatusChange = null;
    this.onOpponentEmote = null;
    this.onRematchRequested = null;
  }

  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `FLAT-${code}`;
  }

  getPeerId(roomCode) {
    return `flat-climb-racing-${roomCode.toUpperCase().trim()}`;
  }

  /**
   * Host a new multiplayer room
   */
  hostRoom(roomCode = null) {
    this.cleanup();
    this.isHost = true;
    this.roomId = roomCode || this.generateRoomCode();
    const peerId = this.getPeerId(this.roomId);

    if (this.onStatusChange) {
      this.onStatusChange('creating', `Initializing room ${this.roomId}...`);
    }

    try {
      this.peer = new Peer(peerId, {
        debug: 1
      });

      this.peer.on('open', (id) => {
        if (this.onStatusChange) {
          this.onStatusChange('waiting', `Room ${this.roomId} ready! Waiting for racer to join...`);
        }
      });

      this.peer.on('connection', (conn) => {
        this.conn = conn;
        this.setupConnection();
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Host error:', err);
        if (err.type === 'unavailable-id') {
          // Room ID already occupied, generate another and retry
          this.hostRoom(this.generateRoomCode());
        } else {
          if (this.onStatusChange) {
            this.onStatusChange('error', `Connection error: ${err.type}`);
          }
        }
      });
    } catch (e) {
      console.error('Host init error:', e);
      if (this.onStatusChange) {
        this.onStatusChange('error', 'PeerJS unavailable');
      }
    }
  }

  /**
   * Join an existing multiplayer room
   */
  joinRoom(roomCode) {
    this.cleanup();
    this.isHost = false;
    this.roomId = roomCode.toUpperCase().trim();
    const targetPeerId = this.getPeerId(this.roomId);

    if (this.onStatusChange) {
      this.onStatusChange('connecting', `Connecting to room ${this.roomId}...`);
    }

    try {
      // Create guest peer with random ID
      this.peer = new Peer(null, { debug: 1 });

      this.peer.on('open', (id) => {
        const conn = this.peer.connect(targetPeerId, {
          reliable: false // Low-latency UDP-style DataChannel for 30Hz game physics
        });
        this.conn = conn;
        this.setupConnection();
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Join error:', err);
        if (this.onStatusChange) {
          this.onStatusChange('error', `Could not connect to room ${this.roomId}: ${err.type}`);
        }
      });
    } catch (e) {
      console.error('Join init error:', e);
      if (this.onStatusChange) {
        this.onStatusChange('error', 'PeerJS connection failed');
      }
    }
  }

  setupConnection() {
    this.conn.on('open', () => {
      this.isConnected = true;

      if (this.isHost) {
        // Send initial seed and host racer profile
        const seed = Math.floor(Math.random() * 900000) + 100000;
        this.game.setWorldSeed(seed);
        this.send({
          type: 'INIT_ROOM',
          seed: seed,
          name: this.game.driverName,
          livery: this.game.carLivery
        });

        if (this.onStatusChange) {
          this.onStatusChange('connected', `Opponent joined! Race starting...`);
        }
      } else {
        // Guest sends their profile to host
        this.send({
          type: 'GUEST_PROFILE',
          name: this.game.driverName,
          livery: this.game.carLivery
        });

        if (this.onStatusChange) {
          this.onStatusChange('connected', `Connected to Host! Syncing track...`);
        }
      }

      // Start high-frequency state broadcaster (30Hz)
      this.startBroadcasting();
    });

    this.conn.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.conn.on('close', () => {
      this.isConnected = false;
      this.stopBroadcasting();
      if (this.onStatusChange) {
        this.onStatusChange('disconnected', 'Opponent disconnected.');
      }
    });

    this.conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.isConnected = false;
    });
  }

  send(data) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(data);
      } catch (e) {
        console.warn('Send packet failed:', e);
      }
    }
  }

  handleIncomingData(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'INIT_ROOM':
        // Host sets the seed for both players
        this.opponentProfile.name = data.name || 'HOST';
        this.opponentProfile.livery = data.livery || 'blue';
        this.game.setWorldSeed(data.seed);
        this.game.startCountdown();
        break;

      case 'GUEST_PROFILE':
        this.opponentProfile.name = data.name || 'RACER 2';
        this.opponentProfile.livery = data.livery || 'red';
        this.game.startCountdown();
        break;

      case 'STATE':
        this.updateRemoteState(data);
        break;

      case 'EMOTE':
        this.showOpponentEmote(data.emoji);
        break;

      case 'REMATCH_REQUEST':
        if (this.onRematchRequested) {
          this.onRematchRequested();
        }
        break;

      case 'REMATCH_START':
        this.game.setWorldSeed(data.seed);
        this.game.restartRace();
        break;
    }
  }

  startBroadcasting() {
    this.stopBroadcasting();
    // 30Hz broadcast loop
    this.syncInterval = setInterval(() => {
      if (!this.isConnected || !this.game.physics) return;

      const p = this.game.physics;
      this.send({
        type: 'STATE',
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        angle: Math.round(p.angle * 100) / 100,
        vx: Math.round(p.vx),
        vy: Math.round(p.vy),
        w1x: Math.round(p.w1.x * 10) / 10,
        w1y: Math.round(p.w1.y * 10) / 10,
        w1a: Math.round(p.w1.angle * 100) / 100,
        w2x: Math.round(p.w2.x * 10) / 10,
        w2y: Math.round(p.w2.y * 10) / 10,
        w2a: Math.round(p.w2.angle * 100) / 100,
        dist: p.distance,
        score: p.score,
        fuel: Math.round(p.fuel),
        crashed: p.crashed,
        gas: this.game.input.gas,
        name: this.game.driverName,
        livery: this.game.carLivery
      });
    }, 33);
  }

  stopBroadcasting() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  updateRemoteState(data) {
    if (data.name) this.opponentProfile.name = data.name;
    if (data.livery) this.opponentProfile.livery = data.livery;

    if (!this.remoteState) {
      // First packet, initialize directly
      this.remoteState = {
        x: data.x,
        y: data.y,
        angle: data.angle,
        vx: data.vx,
        vy: data.vy,
        w1: { x: data.w1x, y: data.w1y, angle: data.w1a },
        w2: { x: data.w2x, y: data.w2y, angle: data.w2a },
        distance: data.dist,
        score: data.score,
        fuel: data.fuel,
        crashed: data.crashed,
        gas: data.gas
      };
    }

    this.targetState = {
      x: data.x,
      y: data.y,
      angle: data.angle,
      vx: data.vx,
      vy: data.vy,
      w1: { x: data.w1x, y: data.w1y, angle: data.w1a },
      w2: { x: data.w2x, y: data.w2y, angle: data.w2a },
      distance: data.dist,
      score: data.score,
      fuel: data.fuel,
      crashed: data.crashed,
      gas: data.gas
    };
  }

  /**
   * Smooth interpolation (lerp) of remote opponent state each local frame
   */
  interpolate(dt) {
    if (!this.remoteState || !this.targetState) return;

    const lerpRate = Math.min(1.0, dt * 20); // Responsive smoothing

    this.remoteState.x += (this.targetState.x - this.remoteState.x) * lerpRate;
    this.remoteState.y += (this.targetState.y - this.remoteState.y) * lerpRate;
    this.remoteState.angle += (this.targetState.angle - this.remoteState.angle) * lerpRate;

    this.remoteState.w1.x += (this.targetState.w1.x - this.remoteState.w1.x) * lerpRate;
    this.remoteState.w1.y += (this.targetState.w1.y - this.remoteState.w1.y) * lerpRate;
    this.remoteState.w1.angle += (this.targetState.w1.angle - this.remoteState.w1.angle) * lerpRate;

    this.remoteState.w2.x += (this.targetState.w2.x - this.remoteState.w2.x) * lerpRate;
    this.remoteState.w2.y += (this.targetState.w2.y - this.remoteState.w2.y) * lerpRate;
    this.remoteState.w2.angle += (this.targetState.w2.angle - this.remoteState.w2.angle) * lerpRate;

    this.remoteState.distance = this.targetState.distance;
    this.remoteState.score = this.targetState.score;
    this.remoteState.fuel = this.targetState.fuel;
    this.remoteState.crashed = this.targetState.crashed;
    this.remoteState.gas = this.targetState.gas;
  }

  sendEmote(emoji) {
    this.send({
      type: 'EMOTE',
      emoji: emoji
    });
  }

  showOpponentEmote(emoji) {
    this.activeEmote = emoji;
    if (this.emoteTimeout) clearTimeout(this.emoteTimeout);
    this.emoteTimeout = setTimeout(() => {
      this.activeEmote = null;
    }, 2400);

    if (this.onOpponentEmote) {
      this.onOpponentEmote(emoji);
    }
  }

  requestRematch() {
    if (this.isHost) {
      const seed = Math.floor(Math.random() * 900000) + 100000;
      this.send({
        type: 'REMATCH_START',
        seed: seed
      });
      this.game.setWorldSeed(seed);
      this.game.restartRace();
    } else {
      this.send({
        type: 'REMATCH_REQUEST'
      });
    }
  }

  cleanup() {
    this.stopBroadcasting();
    if (this.conn) {
      try { this.conn.close(); } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.isConnected = false;
    this.remoteState = null;
    this.targetState = null;
    this.roomId = null;
  }
}

window.MultiplayerManager = MultiplayerManager;
