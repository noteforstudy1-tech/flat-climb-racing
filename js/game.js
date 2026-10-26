/**
 * Flat Climb Racing - Main Game Engine & Controller
 * Bauhaus Flat Design aesthetic inspired by geometric Swiss posters.
 * Made by Raghav Parashar
 */

class FlatClimbGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Profile & Car Customization (Persisted)
    this.driverName = 'RAGHAV';
    this.carLivery = 'blue';
    this.loadProfile();

    // World & Subsystems
    this.terrain = new TerrainManager(1337);
    this.physics = new VehiclePhysics(this.terrain);
    this.renderer = new CarRenderer();
    this.multiplayer = new MultiplayerManager(this);

    // Camera
    this.camera = {
      x: 60,
      y: 400,
      targetX: 60,
      targetY: 400,
      zoom: 1.0,
      targetZoom: 1.0
    };

    // Input state
    this.input = {
      gas: false,
      brake: false
    };

    // Game state
    this.state = 'MENU'; // 'MENU', 'COUNTDOWN', 'PLAYING', 'GAMEOVER'
    this.countdownValue = 3;
    this.countdownTimer = null;
    this.lastTime = performance.now();
    this.fps = 60;
    this.clouds = [];
    this.initClouds();

    // Setup hooks
    this.setupPhysicsHooks();
    this.setupInputListeners();
    this.setupUI();
    this.handleResize();

    window.addEventListener('resize', () => this.handleResize());

    // Check URL parameters for direct room join
    this.checkUrlRoomJoin();

    // Start render loop
    requestAnimationFrame((t) => this.loop(t));
  }

  loadProfile() {
    try {
      const saved = localStorage.getItem('flat_climb_racer_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) this.driverName = parsed.name.slice(0, 14);
        if (parsed.livery) this.carLivery = parsed.livery;
      }
    } catch (e) {}
  }

  saveProfile(name, livery) {
    this.driverName = (name || 'RACER').toUpperCase().trim().slice(0, 14);
    this.carLivery = livery || 'blue';
    try {
      localStorage.setItem('flat_climb_racer_profile', JSON.stringify({
        name: this.driverName,
        livery: this.carLivery
      }));
    } catch (e) {}
  }

  initClouds() {
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: i * 350 + Math.random() * 150,
        y: 60 + Math.random() * 140,
        width: 70 + Math.random() * 60,
        height: 22 + Math.random() * 15,
        speed: 10 + Math.random() * 15
      });
    }
  }

  setWorldSeed(seed) {
    this.terrain.setSeed(seed);
    this.physics.reset(60);
    this.camera.x = 60;
    this.camera.y = this.physics.y;
  }

  setupPhysicsHooks() {
    this.physics.onCoin = (value, x, y) => {
      window.soundSystem.playCoin();
      this.renderer.addFloatingText(`+${value}`, x, y - 15, '#FFBE00', 17);
      this.updateHud();
    };

    this.physics.onFuel = (x, y) => {
      window.soundSystem.playFuel();
      this.renderer.addFloatingText('FUEL 100%!', x, y - 25, '#00D06C', 20);
      this.updateHud();
    };

    this.physics.onFlip = (type, bonus) => {
      window.soundSystem.playFlipBonus();
      this.renderer.addFloatingText(`${type}! +${bonus}`, this.physics.x, this.physics.y - 60, '#FF4742', 22);
      this.updateHud();
    };

    this.physics.onCrash = (reason) => {
      window.soundSystem.playCrash();
      this.renderer.addFloatingText('CRASH!', this.physics.x, this.physics.y - 40, '#FF4742', 26);
      setTimeout(() => {
        this.triggerGameOver('CRASHED! Driver head touched ground.');
      }, 700);
    };
  }

  handleResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
  }

  setupInputListeners() {
    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return; // Ignore while typing in registration modal

      if (['ArrowRight', 'KeyD', 'KeyW'].includes(e.code)) {
        this.input.gas = true;
        window.soundSystem.init();
        window.soundSystem.startEngine();
      } else if (['ArrowLeft', 'KeyA', 'KeyS'].includes(e.code)) {
        this.input.brake = true;
        window.soundSystem.init();
        window.soundSystem.startEngine();
      } else if (e.code === 'Space') {
        this.input.gas = true;
        window.soundSystem.init();
        window.soundSystem.startEngine();
        e.preventDefault();
      } else if (e.code === 'KeyR') {
        this.restartRace();
      } else if (e.code === 'KeyM') {
        this.toggleAudio();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowRight', 'KeyD', 'KeyW', 'Space'].includes(e.code)) {
        this.input.gas = false;
      } else if (['ArrowLeft', 'KeyA', 'KeyS'].includes(e.code)) {
        this.input.brake = false;
      }
    });

    // Touch Pedals for Mobile
    const gasBtn = document.getElementById('touchGas');
    const brakeBtn = document.getElementById('touchBrake');

    if (gasBtn && brakeBtn) {
      const handleGas = (active) => {
        this.input.gas = active;
        if (active) {
          window.soundSystem.init();
          window.soundSystem.startEngine();
          gasBtn.classList.add('active');
        } else {
          gasBtn.classList.remove('active');
        }
      };

      const handleBrake = (active) => {
        this.input.brake = active;
        if (active) {
          window.soundSystem.init();
          window.soundSystem.startEngine();
          brakeBtn.classList.add('active');
        } else {
          brakeBtn.classList.remove('active');
        }
      };

      gasBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); handleGas(true); });
      gasBtn.addEventListener('pointerup', (e) => { e.preventDefault(); handleGas(false); });
      gasBtn.addEventListener('pointercancel', (e) => { e.preventDefault(); handleGas(false); });

      brakeBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); handleBrake(true); });
      brakeBtn.addEventListener('pointerup', (e) => { e.preventDefault(); handleBrake(false); });
      brakeBtn.addEventListener('pointercancel', (e) => { e.preventDefault(); handleBrake(false); });
    }
  }

  startCountdown() {
    this.state = 'COUNTDOWN';
    this.countdownValue = 3;
    const overlay = document.getElementById('countdownOverlay');
    const numberEl = document.getElementById('countdownNumber');
    overlay.classList.remove('hidden');
    numberEl.textContent = '3';
    window.soundSystem.init();
    window.soundSystem.playClick();

    if (this.countdownTimer) clearInterval(this.countdownTimer);

    this.countdownTimer = setInterval(() => {
      this.countdownValue--;
      if (this.countdownValue > 0) {
        numberEl.textContent = this.countdownValue;
        window.soundSystem.playClick();
      } else if (this.countdownValue === 0) {
        numberEl.textContent = 'GO!';
        window.soundSystem.playCoin();
      } else {
        clearInterval(this.countdownTimer);
        overlay.classList.add('hidden');
        this.state = 'PLAYING';
      }
    }, 750);
  }

  restartRace() {
    this.physics.reset(60);
    this.camera.x = 60;
    this.camera.y = this.physics.y;
    this.state = 'PLAYING';
    document.getElementById('gameOverModal').classList.add('hidden');
    window.soundSystem.init();
    window.soundSystem.startEngine();
  }

  triggerGameOver(reason) {
    if (this.state === 'GAMEOVER') return;
    this.state = 'GAMEOVER';
    window.soundSystem.stopEngine();

    const modal = document.getElementById('gameOverModal');
    const titleEl = document.getElementById('goTitle');
    const reasonEl = document.getElementById('goReason');
    const distEl = document.getElementById('goDistance');
    const scoreEl = document.getElementById('goScore');
    const multiSummary = document.getElementById('goMultiSummary');

    titleEl.textContent = 'RACE FINISHED';
    reasonEl.textContent = reason;
    distEl.textContent = `${this.physics.distance}m`;
    scoreEl.textContent = this.physics.score;

    if (this.multiplayer.isConnected && this.multiplayer.remoteState) {
      multiSummary.classList.remove('hidden');
      const oppDist = this.multiplayer.remoteState.distance;
      const myDist = this.physics.distance;
      const winner = myDist >= oppDist ? `🏆 YOU WON! (+${myDist - oppDist}m ahead)` : `OPPONENT WON! (${oppDist}m)`;
      document.getElementById('goWinnerBanner').textContent = winner;
      document.getElementById('goOpponentDist').textContent = `${this.multiplayer.opponentProfile.name}: ${oppDist}m`;
    } else {
      multiSummary.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  }

  toggleAudio() {
    const isMuted = window.soundSystem.toggleMute();
    const btn = document.getElementById('btnMute');
    if (btn) {
      btn.textContent = isMuted ? '🔇' : '🔊';
    }
  }

  updateHud() {
    document.getElementById('hudDistance').textContent = `${this.physics.distance}m`;
    document.getElementById('hudScore').textContent = this.physics.score;

    // Fuel Bar
    const fuelPercent = Math.max(0, Math.min(100, this.physics.fuel));
    const fuelFill = document.getElementById('hudFuelFill');
    if (fuelFill) {
      fuelFill.style.width = `${fuelPercent}%`;
      if (fuelPercent < 22) {
        fuelFill.classList.add('fuel-warning');
      } else {
        fuelFill.classList.remove('fuel-warning');
      }
    }

    // Multiplayer Live Split Bar
    const multiHud = document.getElementById('hudMultiplayerSplit');
    if (this.multiplayer.isConnected && this.multiplayer.remoteState) {
      multiHud.classList.remove('hidden');
      const oppDist = this.multiplayer.remoteState.distance;
      const diff = this.physics.distance - oppDist;
      document.getElementById('multiMyName').textContent = this.driverName;
      document.getElementById('multiMyDist').textContent = `${this.physics.distance}m`;
      document.getElementById('multiOppName').textContent = this.multiplayer.opponentProfile.name;
      document.getElementById('multiOppDist').textContent = `${oppDist}m`;

      const diffBadge = document.getElementById('multiDiff');
      if (diff >= 0) {
        diffBadge.textContent = `+${diff}m`;
        diffBadge.style.color = '#00D06C';
      } else {
        diffBadge.textContent = `${diff}m`;
        diffBadge.style.color = '#FF4742';
      }
    } else {
      multiHud.classList.add('hidden');
    }
  }

  loop(currentTime) {
    const dt = Math.min(0.05, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // 1. Update Game Physics & State
    if (this.state === 'PLAYING') {
      this.physics.update(dt, this.input.gas, this.input.brake);
      window.soundSystem.updateEngine(this.input.gas, Math.abs(this.physics.vx) / 600);

      if (this.physics.fuel <= 0 && Math.abs(this.physics.vx) < 5 && Math.abs(this.physics.vy) < 5) {
        this.triggerGameOver('OUT OF FUEL! You ran dry.');
      }
    }

    // 2. Interpolate Multiplayer Opponent
    if (this.multiplayer.isConnected) {
      this.multiplayer.interpolate(dt);
    }

    // 3. Update Camera
    this.updateCamera(dt);

    // 4. Update Particles
    this.renderer.updateParticles(dt);

    // 5. Render Everything
    this.render();

    // 6. Update HUD elements
    this.updateHud();

    requestAnimationFrame((t) => this.loop(t));
  }

  updateCamera(dt) {
    // Lead camera ahead in direction of movement
    const leadX = this.physics.vx * 0.35;
    this.camera.targetX = this.physics.x + 120 + leadX;
    this.camera.targetY = this.physics.y - 40;

    // Smooth camera damping
    this.camera.x += (this.camera.targetX - this.camera.x) * (dt * 5.0);
    this.camera.y += (this.camera.targetY - this.camera.y) * (dt * 4.0);

    // Zoom out slightly at high velocity
    const speed = Math.hypot(this.physics.vx, this.physics.vy);
    this.camera.targetZoom = Math.max(0.78, 1.0 - (speed / 1600) * 0.22);
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * (dt * 3.0);
  }

  render() {
    const w = this.displayWidth;
    const h = this.displayHeight;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // --- A. SKY BACKGROUND (Matching screenshot's vibrant Bauhaus Blue) ---
    ctx.fillStyle = '#2F55FF';
    ctx.fillRect(0, 0, w, h);

    // --- B. THE ICONIC CORAL DISC (Top-left sun from screenshot) ---
    ctx.fillStyle = '#FF4742';
    ctx.beginPath();
    ctx.arc(80, 80, 68, 0, Math.PI * 2);
    ctx.fill();

    // --- C. DRIFTING MINIMALIST FLAT CLOUDS ---
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (const c of this.clouds) {
      c.x += c.speed * 0.016;
      if (c.x > w + 200) c.x = -150;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.width, c.height, c.height / 2);
      ctx.fill();
    }

    // --- D. CAMERA WORLD VIEW ---
    ctx.save();
    ctx.translate(w * 0.35, h * 0.55);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Draw Procedural Hills & Collectibles
    this.terrain.draw(ctx, this.camera.x, this.camera.y, w / this.camera.zoom, h / this.camera.zoom);

    // 2. Draw Opponent Car (Multiplayer)
    if (this.multiplayer.isConnected && this.multiplayer.remoteState) {
      const opp = this.multiplayer.remoteState;
      this.renderer.renderCar(
        ctx,
        opp.x,
        opp.y,
        opp.angle,
        opp.w1,
        opp.w2,
        {
          engravedName: this.multiplayer.opponentProfile.name,
          liveryKey: this.multiplayer.opponentProfile.livery,
          isGhost: true,
          isPlayer: false,
          tagText: `${this.multiplayer.opponentProfile.name} [${opp.distance}m]`,
          emote: this.multiplayer.activeEmote,
          gas: opp.gas
        }
      );
    }

    // 3. Draw Player's Car (with custom laser engraved name!)
    this.renderer.renderCar(
      ctx,
      this.physics.x,
      this.physics.y,
      this.physics.angle,
      this.physics.w1,
      this.physics.w2,
      {
        engravedName: this.driverName,
        liveryKey: this.carLivery,
        isGhost: false,
        isPlayer: true,
        tagText: null,
        emote: null,
        gas: this.input.gas
      }
    );

    // 4. Exhaust Particles & Floating Stunt Popups
    this.renderer.drawParticles(ctx);
    this.renderer.drawFloatingTexts(ctx);

    ctx.restore(); // Restore camera transform

    // --- E. OFF-SCREEN OPPONENT POINTER ---
    if (this.multiplayer.isConnected && this.multiplayer.remoteState) {
      this.drawOpponentEdgePointer(ctx, w, h);
    }
  }

  drawOpponentEdgePointer(ctx, w, h) {
    const opp = this.multiplayer.remoteState;
    // World to screen position
    const screenX = (opp.x - this.camera.x) * this.camera.zoom + w * 0.35;
    const isAhead = screenX > w - 40;
    const isBehind = screenX < 40;

    if (isAhead || isBehind) {
      ctx.save();
      const pointerX = isAhead ? w - 90 : 90;
      const pointerY = 120;
      const delta = opp.distance - this.physics.distance;
      const text = `${isAhead ? '▶' : '◀'} ${this.multiplayer.opponentProfile.name} (${delta >= 0 ? '+' : ''}${delta}m)`;

      ctx.fillStyle = '#FF4742';
      ctx.beginPath();
      ctx.roundRect(pointerX - 70, pointerY - 14, 140, 28, 8);
      ctx.fill();
      ctx.strokeStyle = '#0F1322';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(pointerX - 70, pointerY - 14, 140, 28);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, pointerX, pointerY);
      ctx.restore();
    }
  }

  setupUI() {
    // 1. Driver Registration & Car Engraving Modal Elements
    const regModal = document.getElementById('registrationModal');
    const inputName = document.getElementById('inputDriverName');
    const liveryOptions = document.querySelectorAll('.livery-option');
    const previewCanvas = document.getElementById('carPreviewCanvas');
    const btnSaveStart = document.getElementById('btnSaveAndStart');
    const btnOpenCustomizer = document.getElementById('btnCustomizeCar');

    if (inputName) {
      inputName.value = this.driverName;
      inputName.addEventListener('input', () => {
        this.driverName = (inputName.value || 'RACER').toUpperCase().slice(0, 14);
        this.drawCarPreview(previewCanvas);
      });
    }

    liveryOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        liveryOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.carLivery = opt.dataset.livery;
        this.drawCarPreview(previewCanvas);
      });
    });

    if (btnSaveStart) {
      btnSaveStart.addEventListener('click', () => {
        window.soundSystem.init();
        window.soundSystem.playClick();
        this.saveProfile(inputName.value, this.carLivery);
        regModal.classList.add('hidden');
        if (this.state === 'MENU') {
          this.startCountdown();
        }
      });
    }

    if (btnOpenCustomizer) {
      btnOpenCustomizer.addEventListener('click', () => {
        window.soundSystem.playClick();
        inputName.value = this.driverName;
        regModal.classList.remove('hidden');
        this.drawCarPreview(previewCanvas);
      });
    }

    // 2. Multiplayer Room Controls
    const btnOpenMultiplayer = document.getElementById('btnOpenMultiplayer');
    const multiModal = document.getElementById('multiplayerModal');
    const btnCreateRoom = document.getElementById('btnCreateRoom');
    const btnJoinRoom = document.getElementById('btnJoinRoom');
    const inputJoinCode = document.getElementById('inputRoomCode');
    const btnCopyInvite = document.getElementById('btnCopyInvite');
    const closeButtons = document.querySelectorAll('.modal-close');

    if (btnOpenMultiplayer) {
      btnOpenMultiplayer.addEventListener('click', () => {
        window.soundSystem.playClick();
        multiModal.classList.remove('hidden');
      });
    }

    closeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal-backdrop').classList.add('hidden');
      });
    });

    if (btnCreateRoom) {
      btnCreateRoom.addEventListener('click', () => {
        window.soundSystem.playClick();
        this.multiplayer.hostRoom();
      });
    }

    if (btnJoinRoom) {
      btnJoinRoom.addEventListener('click', () => {
        window.soundSystem.playClick();
        const code = inputJoinCode.value.trim();
        if (code) {
          this.multiplayer.joinRoom(code);
        }
      });
    }

    if (btnCopyInvite) {
      btnCopyInvite.addEventListener('click', () => {
        if (!this.multiplayer.roomId) return;
        const url = `${window.location.origin}${window.location.pathname}?room=${this.multiplayer.roomId}`;
        navigator.clipboard.writeText(url).then(() => {
          btnCopyInvite.textContent = 'COPIED LINK!';
          setTimeout(() => { btnCopyInvite.textContent = 'COPY INVITE LINK'; }, 2000);
        });
      });
    }

    // Status callback
    this.multiplayer.onStatusChange = (status, msg) => {
      const statusEl = document.getElementById('multiStatusText');
      const activeRoomPanel = document.getElementById('activeRoomPanel');
      if (statusEl) statusEl.textContent = msg;

      if (status === 'waiting') {
        activeRoomPanel.classList.remove('hidden');
        document.getElementById('displayRoomCode').textContent = this.multiplayer.roomId;
      } else if (status === 'connected') {
        multiModal.classList.add('hidden');
        activeRoomPanel.classList.add('hidden');
      }
    };

    // Rematch hooks
    const btnRematch = document.getElementById('btnRematch');
    if (btnRematch) {
      btnRematch.addEventListener('click', () => {
        window.soundSystem.playClick();
        this.multiplayer.requestRematch();
      });
    }

    const btnPlayAgain = document.getElementById('btnPlayAgain');
    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', () => {
        window.soundSystem.playClick();
        this.restartRace();
      });
    }

    // Emote Buttons
    document.querySelectorAll('.emote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        this.renderer.addFloatingText(emoji, this.physics.x, this.physics.y - 70, '#FFFFFF', 32);
        if (this.multiplayer.isConnected) {
          this.multiplayer.sendEmote(emoji);
        }
      });
    });

    // Mute button
    const btnMute = document.getElementById('btnMute');
    if (btnMute) {
      btnMute.addEventListener('click', () => this.toggleAudio());
    }

    // Initial Car Preview
    this.drawCarPreview(previewCanvas);
  }

  drawCarPreview(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Bauhaus backdrop in preview
    ctx.fillStyle = '#0F1322';
    ctx.fillRect(0, 0, w, h);

    // Decorative circle & accent
    ctx.fillStyle = '#FF4742';
    ctx.beginPath();
    ctx.arc(36, 36, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00D06C';
    ctx.fillRect(w - 30, h - 30, 30, 30);

    // Render Car at center
    const time = performance.now() * 0.003;
    const bounce = Math.sin(time) * 3;

    const w1 = { x: w / 2 - 28, y: h / 2 + 18, angle: time };
    const w2 = { x: w / 2 + 28, y: h / 2 + 18, angle: time };

    this.renderer.renderCar(
      ctx,
      w / 2,
      h / 2 + bounce,
      Math.sin(time * 0.8) * 0.04,
      w1,
      w2,
      {
        engravedName: this.driverName,
        liveryKey: this.carLivery,
        isGhost: false,
        isPlayer: true
      }
    );
  }

  checkUrlRoomJoin() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      const modal = document.getElementById('registrationModal');
      const inputJoinCode = document.getElementById('inputRoomCode');
      if (inputJoinCode) inputJoinCode.value = roomParam;

      // After user signs up their name, auto join!
      const btnSaveStart = document.getElementById('btnSaveAndStart');
      if (btnSaveStart) {
        btnSaveStart.textContent = `ENGRAVE & JOIN ROOM ${roomParam}`;
        const origClick = btnSaveStart.onclick;
        btnSaveStart.addEventListener('click', () => {
          setTimeout(() => {
            this.multiplayer.joinRoom(roomParam);
          }, 300);
        }, { once: true });
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new FlatClimbGame();
});
