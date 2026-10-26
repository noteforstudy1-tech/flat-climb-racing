/**
 * Flat Climb Racing - Main Game Engine (v2 - Fixed)
 * Made by Raghav Parashar
 */

class FlatClimbGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    // Profile
    this.driverName = 'RAGHAV';
    this.carLivery  = 'blue';
    this._loadProfile();

    // Subsystems
    this.terrain     = new TerrainManager(1337);
    this.physics     = new VehiclePhysics(this.terrain);
    this.renderer    = new CarRenderer();
    this.multiplayer = new MultiplayerManager(this);

    // Camera
    this.cam = { x: 80, y: 400, zoom: 1.0 };

    // Input — only ever set by the dedicated touch buttons / key events
    this.input = { gas: false, brake: false };

    // State: MENU | COUNTDOWN | PLAYING | GAMEOVER
    this.state         = 'MENU';
    this.countdownVal  = 3;
    this.countdownTmr  = null;

    // Clouds
    this.clouds = [];
    this._initClouds();

    // Misc
    this.lastTime = performance.now();
    this._previewCanvas = null;   // reference so we can stop it
    this._previewActive = false;

    this._hookPhysics();
    this._hookInput();
    this._hookUI();

    window.addEventListener('resize', () => this._resize());
    this._resize();

    this._checkUrlRoom();

    requestAnimationFrame(t => this._loop(t));
  }

  /* ──────────────────────────────────────────────────── PROFILE ─── */
  _loadProfile() {
    try {
      const d = JSON.parse(localStorage.getItem('fcr_profile') || '{}');
      if (d.name)   this.driverName = d.name.slice(0, 14);
      if (d.livery) this.carLivery  = d.livery;
    } catch (_) {}
  }
  _saveProfile(name, livery) {
    this.driverName = (name || 'RACER').toUpperCase().trim().slice(0, 14) || 'RACER';
    this.carLivery  = livery || 'blue';
    try { localStorage.setItem('fcr_profile', JSON.stringify({ name: this.driverName, livery: this.carLivery })); } catch (_) {}
  }

  /* ──────────────────────────────────────────────────── WORLD ───── */
  setWorldSeed(seed) {
    this.terrain.setSeed(seed);
    this.physics.reset(80);
    this.cam.x = 80;
    this.cam.y = this.physics.y;
  }

  /* ──────────────────────────────────────────────── PHYSICS HOOKS ─ */
  _hookPhysics() {
    this.physics.onCoin = (v, x, y) => {
      window.soundSystem.playCoin();
      this.renderer.addFloatingText(`+${v}`, x, y - 20, '#FFBE00', 17);
    };
    this.physics.onFuel = (x, y) => {
      window.soundSystem.playFuel();
      this.renderer.addFloatingText('FUEL!', x, y - 30, '#00D06C', 20);
    };
    this.physics.onFlip = (type, pts) => {
      window.soundSystem.playFlipBonus();
      this.renderer.addFloatingText(`${type}! +${pts}`, this.physics.x, this.physics.y - 65, '#FF4742', 22);
    };
    this.physics.onCrash = () => {
      window.soundSystem.playCrash();
      this.renderer.addFloatingText('CRASH!', this.physics.x, this.physics.y - 45, '#FF4742', 26);
      window.soundSystem.stopEngine();
      setTimeout(() => this._gameOver('Head hit the ground!'), 500);
    };
  }

  /* ──────────────────────────────────────────────────── INPUT ───── */
  _hookInput() {
    // ── KEYBOARD ──
    // Only block game input when typing in a text input field
    const gameKeys = new Set(['ArrowRight','ArrowLeft','KeyD','KeyA','KeyW','KeyS','Space','KeyR','KeyM']);

    window.addEventListener('keydown', e => {
      // Never capture input while typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // Never capture input while any modal is open
      if (document.querySelector('.modal-backdrop:not(.hidden)')) return;

      if (e.code === 'Space') e.preventDefault();

      if (this.state !== 'PLAYING') return; // no game input unless playing

      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space') {
        this.input.gas = true;
        window.soundSystem.init(); window.soundSystem.startEngine();
      }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.input.brake = true;
        window.soundSystem.init(); window.soundSystem.startEngine();
      }
      if (e.code === 'KeyR') this._restartRace();
      if (e.code === 'KeyM') this._toggleMute();
    });

    window.addEventListener('keyup', e => {
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space') this.input.gas   = false;
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA')                        this.input.brake = false;
    });

    // ── TOUCH PEDALS ──
    const gasBtn   = document.getElementById('touchGas');
    const brakeBtn = document.getElementById('touchBrake');

    if (gasBtn) {
      gasBtn.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (this.state !== 'PLAYING') return;
        this.input.gas = true;
        gasBtn.classList.add('active');
        window.soundSystem.init(); window.soundSystem.startEngine();
      });
      gasBtn.addEventListener('pointerup',     e => { e.preventDefault(); this.input.gas = false; gasBtn.classList.remove('active'); });
      gasBtn.addEventListener('pointercancel', e => { e.preventDefault(); this.input.gas = false; gasBtn.classList.remove('active'); });
      gasBtn.addEventListener('pointerleave',  e => { this.input.gas = false; gasBtn.classList.remove('active'); });
    }

    if (brakeBtn) {
      brakeBtn.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (this.state !== 'PLAYING') return;
        this.input.brake = true;
        brakeBtn.classList.add('active');
        window.soundSystem.init(); window.soundSystem.startEngine();
      });
      brakeBtn.addEventListener('pointerup',     e => { e.preventDefault(); this.input.brake = false; brakeBtn.classList.remove('active'); });
      brakeBtn.addEventListener('pointercancel', e => { e.preventDefault(); this.input.brake = false; brakeBtn.classList.remove('active'); });
      brakeBtn.addEventListener('pointerleave',  e => { this.input.brake = false; brakeBtn.classList.remove('active'); });
    }
  }

  /* ────────────────────────────────────────────────── GAME STATE ── */
  startCountdown() {
    this.state       = 'COUNTDOWN';
    this.countdownVal = 3;
    this.input.gas   = false;
    this.input.brake = false;

    const overlay  = document.getElementById('countdownOverlay');
    const numEl    = document.getElementById('countdownNumber');
    overlay.classList.remove('hidden');
    numEl.textContent = '3';
    window.soundSystem.init();
    window.soundSystem.playClick();

    if (this.countdownTmr) clearInterval(this.countdownTmr);
    this.countdownTmr = setInterval(() => {
      this.countdownVal--;
      if (this.countdownVal > 0) {
        numEl.textContent = this.countdownVal;
        window.soundSystem.playClick();
      } else if (this.countdownVal === 0) {
        numEl.textContent = 'GO!';
        window.soundSystem.playCoin();
      } else {
        clearInterval(this.countdownTmr);
        overlay.classList.add('hidden');
        this.state = 'PLAYING';
        window.soundSystem.startEngine();
      }
    }, 750);
  }

  _restartRace() {
    this.input.gas   = false;
    this.input.brake = false;
    this.physics.reset(80);
    this.cam.x = 80; this.cam.y = this.physics.y;
    document.getElementById('gameOverModal').classList.add('hidden');
    this.startCountdown();
  }

  restartRace() { this._restartRace(); }

  _gameOver(reason) {
    if (this.state === 'GAMEOVER') return;
    this.state       = 'GAMEOVER';
    this.input.gas   = false;
    this.input.brake = false;
    window.soundSystem.stopEngine();

    document.getElementById('goReason').textContent   = reason;
    document.getElementById('goDistance').textContent = `${this.physics.distance}m`;
    document.getElementById('goScore').textContent    = this.physics.score;

    const multiBox = document.getElementById('goMultiSummary');
    if (this.multiplayer.isConnected && this.multiplayer.remoteState) {
      multiBox.classList.remove('hidden');
      const oppD = this.multiplayer.remoteState.distance;
      const diff = this.physics.distance - oppD;
      document.getElementById('goWinnerBanner').textContent  = diff >= 0 ? `🏆 YOU WIN! (+${diff}m)` : `OPPONENT WINS! (${oppD}m)`;
      document.getElementById('goOpponentDist').textContent  = `${this.multiplayer.opponentProfile.name}: ${oppD}m`;
    } else {
      multiBox.classList.add('hidden');
    }

    document.getElementById('gameOverModal').classList.remove('hidden');
  }

  _toggleMute() {
    const m = window.soundSystem.toggleMute();
    const b = document.getElementById('btnMute');
    if (b) b.textContent = m ? '🔇' : '🔊';
  }

  /* ────────────────────────────────────────────────────── HUD ───── */
  _updateHud() {
    const p = this.physics;
    document.getElementById('hudDistance').textContent = `${p.distance}m`;
    document.getElementById('hudScore').textContent    = p.score;

    const ff = document.getElementById('hudFuelFill');
    if (ff) {
      ff.style.width = `${Math.max(0, Math.min(100, p.fuel))}%`;
      ff.classList.toggle('fuel-warning', p.fuel < 22);
    }

    const mHud = document.getElementById('hudMultiplayerSplit');
    if (this.multiplayer.isConnected && this.multiplayer.remoteState) {
      mHud.classList.remove('hidden');
      const opp  = this.multiplayer.remoteState;
      const diff = p.distance - opp.distance;
      document.getElementById('multiMyName').textContent  = this.driverName;
      document.getElementById('multiMyDist').textContent  = `${p.distance}m`;
      document.getElementById('multiOppName').textContent = this.multiplayer.opponentProfile.name;
      document.getElementById('multiOppDist').textContent = `${opp.distance}m`;
      const db = document.getElementById('multiDiff');
      db.textContent  = (diff >= 0 ? '+' : '') + diff + 'm';
      db.style.color  = diff >= 0 ? '#00D06C' : '#FF4742';
    } else {
      mHud.classList.add('hidden');
    }
  }

  /* ─────────────────────────────────────────────────── MAIN LOOP ── */
  _loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.state === 'PLAYING') {
      this.physics.update(dt, this.input.gas, this.input.brake);

      // Out-of-fuel stop check
      if (this.physics.fuel <= 0 && !this.physics.crashed) {
        const spd = Math.hypot(this.physics.vx, this.physics.vy);
        if (spd < 8) this._gameOver('Out of fuel!');
      }

      window.soundSystem.updateEngine(this.input.gas, Math.min(1, Math.abs(this.physics.vx) / 500));
    }

    if (this.multiplayer.isConnected) this.multiplayer.interpolate(dt);

    this._updateCamera(dt);
    this.renderer.updateParticles(dt);
    this._render();
    this._updateHud();

    requestAnimationFrame(t => this._loop(t));
  }

  /* ──────────────────────────────────────────────────── CAMERA ──── */
  _updateCamera(dt) {
    const lead = this.physics.vx * 0.32;
    const tx   = this.physics.x + 110 + lead;
    const ty   = this.physics.y - 50;

    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 4);

    const spd   = Math.hypot(this.physics.vx, this.physics.vy);
    const tz    = Math.max(0.78, 1.0 - (spd / 1400) * 0.22);
    this.cam.zoom += (tz - this.cam.zoom) * Math.min(1, dt * 3);
  }

  /* ──────────────────────────────────────────────────── RENDER ──── */
  _render() {
    const ctx = this.ctx;
    const W   = this.displayW, H = this.displayH;

    ctx.clearRect(0, 0, W, H);

    // Sky
    ctx.fillStyle = '#2F55FF';
    ctx.fillRect(0, 0, W, H);

    // Coral sun (top left – matching reference screenshot)
    ctx.fillStyle = '#FF4742';
    ctx.beginPath();
    ctx.arc(75, 75, 65, 0, Math.PI * 2);
    ctx.fill();

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    for (const c of this.clouds) {
      c.x += c.speed * 0.016;
      if (c.x > W + 200) c.x = -150;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.width, c.height, c.height / 2);
      ctx.fill();
    }

    // ─ Camera world space ─
    ctx.save();
    ctx.translate(W * 0.35, H * 0.58);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    // Terrain (hills + collectibles)
    this.terrain.draw(ctx, this.cam.x, this.cam.y, W / this.cam.zoom, H / this.cam.zoom);

    // Opponent car (multiplayer)
    if (this.multiplayer.isConnected && this.multiplayer.remoteState) {
      const opp = this.multiplayer.remoteState;
      this.renderer.renderCar(ctx, opp.x, opp.y, opp.angle,
        { x: opp.w1x, y: opp.w1y, angle: opp.w1a },
        { x: opp.w2x, y: opp.w2y, angle: opp.w2a }, {
          engravedName: this.multiplayer.opponentProfile.name,
          liveryKey:    this.multiplayer.opponentProfile.livery,
          isGhost: true, isPlayer: false,
          showTag: true,
          tagText: `${this.multiplayer.opponentProfile.name} [${opp.distance}m]`,
          emote: this.multiplayer.activeEmote,
          gas: opp.gas
        });
    }

    // Player car — wheel objects computed from physics
    const { w1x, w1y, w2x, w2y } = this.physics.getWheelPositions();
    this.renderer.renderCar(ctx, this.physics.x, this.physics.y, this.physics.angle,
      { x: w1x, y: w1y, angle: this.physics.w1Angle },
      { x: w2x, y: w2y, angle: this.physics.w2Angle }, {
        engravedName: this.driverName,
        liveryKey:    this.carLivery,
        isGhost: false, isPlayer: true,
        gas: this.input.gas
      });

    // Particles + popups (in world space)
    this.renderer.drawParticles(ctx);
    this.renderer.drawFloatingTexts(ctx);

    ctx.restore();

    // Off-screen opponent indicator (screen space)
    if (this.multiplayer.isConnected && this.multiplayer.remoteState) {
      this._drawOpponentPointer(ctx, W, H);
    }
  }

  _drawOpponentPointer(ctx, W, H) {
    const opp = this.multiplayer.remoteState;
    const sx  = (opp.x - this.cam.x) * this.cam.zoom + W * 0.35;
    if (sx > 40 && sx < W - 40) return; // on screen, no pointer needed

    const isAhead = sx > W - 40;
    const px      = isAhead ? W - 95 : 95;
    const py      = 115;
    const delta   = opp.distance - this.physics.distance;
    const label   = `${isAhead ? '▶' : '◀'} ${this.multiplayer.opponentProfile.name} (${delta >= 0 ? '+' : ''}${delta}m)`;

    ctx.save();
    ctx.fillStyle   = '#FF4742';
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.roundRect(px - 75, py - 14, 150, 28, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle    = '#FFFFFF';
    ctx.font         = '800 11px "Space Grotesk",sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px, py);
    ctx.restore();
  }

  /* ────────────────────────────────────────────────────── UI ─────── */
  _hookUI() {
    // ─ Registration / Engraving modal ─
    const regModal   = document.getElementById('registrationModal');
    const inputName  = document.getElementById('inputDriverName');
    const prevCanvas = document.getElementById('carPreviewCanvas');
    const btnSave    = document.getElementById('btnSaveAndStart');
    const btnCust    = document.getElementById('btnCustomizeCar');

    // Sync input to saved name
    if (inputName) inputName.value = this.driverName;

    // Select saved livery button
    document.querySelectorAll('.livery-option').forEach(opt => {
      if (opt.dataset.livery === this.carLivery) opt.classList.add('selected');
      opt.addEventListener('click', () => {
        document.querySelectorAll('.livery-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.carLivery = opt.dataset.livery;
      });
    });

    // Open customizer (pause if playing)
    if (btnCust) {
      btnCust.addEventListener('click', e => {
        e.stopPropagation();
        window.soundSystem.playClick();
        if (inputName) inputName.value = this.driverName;
        regModal.classList.remove('hidden');
      });
    }

    // Save + start
    if (btnSave) {
      btnSave.addEventListener('click', e => {
        e.stopPropagation();
        window.soundSystem.init();
        window.soundSystem.playClick();
        const name = inputName ? inputName.value.trim() : '';
        this._saveProfile(name, this.carLivery);
        regModal.classList.add('hidden');
        if (this.state === 'MENU' || this.state === 'GAMEOVER') {
          this.physics.reset(80);
          this.startCountdown();
        }
      });
    }

    // Live preview: name typing
    if (inputName) {
      inputName.addEventListener('input', () => {
        this.driverName = (inputName.value || 'RACER').toUpperCase().slice(0, 14);
      });
    }

    // Start preview loop for registration modal
    if (prevCanvas) {
      this._startPreviewLoop(prevCanvas);
    }

    // ─ Multiplayer modal ─
    const mpModal      = document.getElementById('multiplayerModal');
    const btnOpenMp    = document.getElementById('btnOpenMultiplayer');
    const btnCreate    = document.getElementById('btnCreateRoom');
    const btnJoin      = document.getElementById('btnJoinRoom');
    const inputRoom    = document.getElementById('inputRoomCode');
    const btnCopyInvite = document.getElementById('btnCopyInvite');

    if (btnOpenMp) {
      btnOpenMp.addEventListener('click', e => {
        e.stopPropagation();
        window.soundSystem.playClick();
        mpModal.classList.remove('hidden');
      });
    }

    if (btnCreate) {
      btnCreate.addEventListener('click', e => {
        e.stopPropagation();
        window.soundSystem.playClick();
        this.multiplayer.hostRoom();
      });
    }

    if (btnJoin) {
      btnJoin.addEventListener('click', e => {
        e.stopPropagation();
        window.soundSystem.playClick();
        const code = inputRoom ? inputRoom.value.trim() : '';
        if (code) this.multiplayer.joinRoom(code);
      });
    }

    if (btnCopyInvite) {
      btnCopyInvite.addEventListener('click', e => {
        e.stopPropagation();
        if (!this.multiplayer.roomId) return;
        const url = `${location.origin}${location.pathname}?room=${this.multiplayer.roomId}`;
        navigator.clipboard.writeText(url).then(() => {
          btnCopyInvite.textContent = 'COPIED!';
          setTimeout(() => { btnCopyInvite.textContent = 'COPY INVITE LINK'; }, 2000);
        }).catch(() => {
          prompt('Copy this link:', url);
        });
      });
    }

    // Multiplayer status callback
    this.multiplayer.onStatusChange = (status, msg) => {
      const el  = document.getElementById('multiStatusText');
      const rp  = document.getElementById('activeRoomPanel');
      if (el) el.textContent = msg;
      if (status === 'waiting') {
        rp.classList.remove('hidden');
        document.getElementById('displayRoomCode').textContent = this.multiplayer.roomId;
      } else if (status === 'connected') {
        mpModal.classList.add('hidden');
        rp.classList.add('hidden');
      }
    };

    // ─ All .modal-close buttons ─
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        btn.closest('.modal-backdrop').classList.add('hidden');
      });
    });

    // ─ Game Over modal ─
    const btnPlayAgain = document.getElementById('btnPlayAgain');
    const btnRematch   = document.getElementById('btnRematch');

    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', e => {
        e.stopPropagation();
        window.soundSystem.playClick();
        this._restartRace();
      });
    }

    if (btnRematch) {
      btnRematch.addEventListener('click', e => {
        e.stopPropagation();
        window.soundSystem.playClick();
        this.multiplayer.requestRematch();
      });
    }

    // Multiplayer rematch
    this.multiplayer.onRematchRequested = () => {
      const ok = confirm(`${this.multiplayer.opponentProfile.name} wants a rematch! Accept?`);
      if (ok) this.multiplayer.requestRematch();
    };

    // ─ Emote bar ─
    document.querySelectorAll('.emote-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const em = btn.dataset.emoji;
        this.renderer.addFloatingText(em, this.physics.x, this.physics.y - 70, '#FFFFFF', 30);
        if (this.multiplayer.isConnected) this.multiplayer.sendEmote(em);
      });
    });

    // ─ Mute ─
    const btnMute = document.getElementById('btnMute');
    if (btnMute) btnMute.addEventListener('click', e => { e.stopPropagation(); this._toggleMute(); });
  }

  /* ─ Animated car preview for registration modal ─ */
  _startPreviewLoop(canvas) {
    const draw = () => {
      const modal = document.getElementById('registrationModal');
      if (!modal.classList.contains('hidden')) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Dark backdrop
        ctx.fillStyle = '#080A12';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#FF4742';
        ctx.beginPath(); ctx.arc(30, 30, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#00D06C';
        ctx.fillRect(W - 28, H - 28, 28, 28);

        // Ground
        const gY = H * 0.76;
        ctx.fillStyle = '#00D06C';
        ctx.fillRect(0, gY, W, 3);

        const t   = performance.now() * 0.001;
        const cx  = W * 0.46, cy = gY - 22;
        const bob = Math.sin(t * 3) * 3;
        const ang = Math.sin(t * 0.8) * 0.04;
        const sa  = Math.sin(ang), ca = Math.cos(ang);
        const wb  = 34;

        const w1 = { x: cx - ca * wb,  y: cy - sa * wb + gY - 18 - (cy + bob), angle: t };
        const w2 = { x: cx + ca * wb,  y: cy + sa * wb + gY - 18 - (cy + bob), angle: t };
        // Simpler — fixed positions for preview
        const pw1 = { x: cx - 34, y: gY - 18, angle: t * 2 };
        const pw2 = { x: cx + 34, y: gY - 18, angle: t * 2 };

        this.renderer.renderCar(ctx, cx, cy + bob, ang, pw1, pw2, {
          engravedName: this.driverName,
          liveryKey:    this.carLivery,
          isGhost: false, isPlayer: true
        });
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  /* ──────────────────────────────────────────────────── RESIZE ──── */
  _resize() {
    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.displayW = rect.width;
    this.displayH = rect.height;
    this.ctx.scale(dpr, dpr);
  }

  /* ──────────────────────────────────────────────────── CLOUDS ──── */
  _initClouds() {
    for (let i = 0; i < 9; i++) {
      this.clouds.push({
        x: i * 360 + Math.random() * 120,
        y: 55 + Math.random() * 130,
        width:  70 + Math.random() * 60,
        height: 20 + Math.random() * 14,
        speed:  10 + Math.random() * 14
      });
    }
  }

  /* ─────────────────────────────────────────────── URL ROOM JOIN ── */
  _checkUrlRoom() {
    const room = new URLSearchParams(location.search).get('room');
    if (!room) return;
    const ir = document.getElementById('inputRoomCode');
    if (ir) ir.value = room;
    const bs = document.getElementById('btnSaveAndStart');
    if (bs) {
      bs.textContent = `ENGRAVE & JOIN ROOM ${room}`;
      bs.addEventListener('click', () => {
        setTimeout(() => this.multiplayer.joinRoom(room), 250);
      }, { once: true });
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new FlatClimbGame();
});
