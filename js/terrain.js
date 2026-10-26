/**
 * Flat Climb Racing - Procedural Endless Terrain Generator
 * Seeded deterministic generation for synchronized multiplayer.
 * Made by Raghav Parashar
 */

class TerrainManager {
  constructor(seed = 1337) {
    this.seed = seed;
    this.baseY = 460;
    this.fuelInterval = 130; // meters
    this.coinGroups = [];
    this.fuelCans = [];
    this.milestones = [];
    this.initWorld();
  }

  setSeed(newSeed) {
    this.seed = newSeed;
    this.initWorld();
  }

  // Seeded pseudo-random number generator (Mulberry32)
  prng(s) {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  initWorld() {
    this.coinGroups = [];
    this.fuelCans = [];
    this.milestones = [];

    // Pre-populate initial item caches up to 5000m (generated on-demand beyond)
    this.generateItemsUpTo(2500);
  }

  generateItemsUpTo(maxMeters) {
    const currentMax = this.milestones.length > 0 
      ? this.milestones[this.milestones.length - 1].meters 
      : 0;

    for (let m = Math.max(50, currentMax + 50); m <= maxMeters; m += 50) {
      const x = m * 30; // 30 pixels per meter
      this.milestones.push({
        x: x,
        y: this.getHeight(x),
        meters: m
      });
    }

    // Fuel cans every ~130 meters starting at 120m
    const currentFuelM = this.fuelCans.length > 0
      ? this.fuelCans[this.fuelCans.length - 1].meters
      : 0;
    for (let m = Math.max(120, currentFuelM + this.fuelInterval); m <= maxMeters; m += this.fuelInterval) {
      const x = m * 30;
      const y = this.getHeight(x) - 24;
      this.fuelCans.push({
        id: `fuel_${m}`,
        x: x,
        y: y,
        meters: m,
        collected: false
      });
    }

    // Coins placed in fun arcs between hills
    const currentCoinM = this.coinGroups.length > 0
      ? this.coinGroups[this.coinGroups.length - 1].meters
      : 0;
    for (let m = Math.max(25, currentCoinM + 30); m <= maxMeters; m += 30) {
      const r = this.prng(this.seed + m * 7);
      if (r > 0.15) { // 85% chance of coin bunch
        const baseX = m * 30;
        const count = 3 + Math.floor(r * 4); // 3 to 6 coins
        for (let i = 0; i < count; i++) {
          const cx = baseX + i * 28;
          // Follow terrain height + arc
          const cy = this.getHeight(cx) - (25 + Math.sin((i / (count - 1)) * Math.PI) * 25);
          this.coinGroups.push({
            id: `coin_${m}_${i}`,
            x: cx,
            y: cy,
            meters: m,
            value: 100,
            collected: false
          });
        }
      }
    }
  }

  /**
   * Continuous procedural height function Y(x)
   * Higher y in canvas = lower on screen.
   * Start area (x < 150) is flat.
   */
  getHeight(x) {
    if (x < 150) {
      return this.baseY; // Flat launch pad
    }

    // Transition smoothly from flat start to rolling hills
    const rampFactor = Math.min(1.0, (x - 150) / 300);

    // Multi-octave sinusoidal terrain with seed offsets
    const s = this.seed % 10000;
    const wave1 = Math.sin((x + s * 13) * 0.0035) * 55;
    const wave2 = Math.cos((x + s * 29) * 0.008) * 35;
    const wave3 = Math.sin((x + s * 47) * 0.0015) * 110;
    const wave4 = Math.sin((x + s * 71) * 0.02) * 12;

    // Gradual difficulty / mountain rise with distance
    const distanceMeters = x / 30;
    const steepness = Math.min(2.2, 0.9 + distanceMeters * 0.0008);

    // Occasional exciting jump ramps
    const rampMod = Math.sin((x + s * 9) * 0.0006);
    let rampJump = 0;
    if (rampMod > 0.75) {
      rampJump = -Math.sin(((x % 400) / 400) * Math.PI) * 50;
    }

    const totalHeight = this.baseY + (wave1 + wave2 + wave3 + wave4 + rampJump) * rampFactor * steepness;
    return totalHeight;
  }

  getSlope(x) {
    const dx = 1.0;
    const y1 = this.getHeight(x - dx);
    const y2 = this.getHeight(x + dx);
    return (y2 - y1) / (2 * dx);
  }

  getNormal(x) {
    const slope = this.getSlope(x);
    // Tangent vector is (1, slope)
    const len = Math.sqrt(1 + slope * slope);
    // Normal vector pointing UP (away from ground) is (-slope/len, -1/len) in canvas coords
    return {
      x: -slope / len,
      y: -1 / len,
      angle: Math.atan2(slope, 1)
    };
  }

  draw(ctx, cameraX, cameraY, viewWidth, viewHeight) {
    // Parallax background hills (Distant Royal Blue)
    this.drawBackgroundHills(ctx, cameraX, cameraY, viewWidth, viewHeight);

    // Foreground main hills (Emerald Green crust + Dark Slate soil)
    this.drawForegroundHills(ctx, cameraX, cameraY, viewWidth, viewHeight);

    // Milestones / Distance markers
    this.drawMilestones(ctx, cameraX, cameraY, viewWidth, viewHeight);

    // Start line arch
    this.drawStartLine(ctx, cameraX, cameraY);

    // Collectibles (Coins and Fuel Cans)
    this.drawCollectibles(ctx, cameraX, cameraY, viewWidth, viewHeight);
  }

  drawBackgroundHills(ctx, camX, camY, w, h) {
    ctx.save();
    // Parallax factor 0.35
    const parallaxX = camX * 0.35;
    const step = 20;
    const startX = Math.floor((camX - w / 2 - 100) / step) * step;
    const endX = camX + w / 2 + 100;

    ctx.fillStyle = '#1D3BBE'; // Deep Bauhaus midground blue
    ctx.beginPath();
    ctx.moveTo(startX, h * 2);

    for (let x = startX; x <= endX; x += step) {
      // Smoother, taller distant mountains
      const s = this.seed % 5000;
      const my = (this.baseY + 40) + Math.sin((x * 0.35 + s * 11) * 0.002) * 140 + Math.cos((x * 0.35 + s * 3) * 0.004) * 80;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(endX, h * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawForegroundHills(ctx, camX, camY, w, h) {
    const step = 8;
    const startX = Math.floor((camX - w / 2 - 100) / step) * step;
    const endX = camX + w / 2 + 100;

    // Check if we need to generate more items
    const maxViewMeters = (endX / 30) + 200;
    if (this.milestones.length === 0 || maxViewMeters > this.milestones[this.milestones.length - 1].meters) {
      this.generateItemsUpTo(maxViewMeters + 500);
    }

    ctx.save();

    // 1. Soil Fill (Bauhaus Deep Navy/Charcoal)
    ctx.fillStyle = '#11162B';
    ctx.beginPath();
    ctx.moveTo(startX, camY + h * 2);

    for (let x = startX; x <= endX; x += step) {
      const y = this.getHeight(x);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(endX, camY + h * 2);
    ctx.closePath();
    ctx.fill();

    // 2. Geometric Stratum Band (Accent stripe beneath surface)
    ctx.fillStyle = '#1A2345';
    ctx.beginPath();
    ctx.moveTo(startX, camY + h * 2);
    for (let x = startX; x <= endX; x += step) {
      const y = this.getHeight(x) + 18;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(endX, camY + h * 2);
    ctx.closePath();
    ctx.fill();

    // 3. Thick Flat Emerald Green Grass Top
    ctx.strokeStyle = '#00D06C';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let first = true;
    for (let x = startX; x <= endX; x += step) {
      const y = this.getHeight(x);
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 4. Crisp Highlight Line (Pure White / Mint ultra-thin edge)
    ctx.strokeStyle = '#62FFAE';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    first = true;
    for (let x = startX; x <= endX; x += step) {
      const y = this.getHeight(x) - 5;
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.restore();
  }

  drawStartLine(ctx, camX, camY) {
    // Only draw if near start
    if (camX > 400) return;

    ctx.save();
    const x = 50;
    const y = this.baseY;

    // Checkered Banner Poles (Bauhaus style)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 110);
    ctx.moveTo(x + 70, y);
    ctx.lineTo(x + 70, y - 110);
    ctx.stroke();

    // Top Signboard (Bold Marigold Yellow)
    ctx.fillStyle = '#FFB703';
    ctx.fillRect(x - 10, y - 135, 90, 26);
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 10, y - 135, 90, 26);

    ctx.fillStyle = '#0F1322';
    ctx.font = '900 13px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', x + 35, y - 122);

    // Checkered finish/start ribbon across
    const rows = 2;
    const cols = 7;
    const cellSize = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#FFFFFF' : '#FF4742';
        ctx.fillRect(x + c * cellSize, y - 105 + r * cellSize, cellSize, cellSize);
      }
    }

    ctx.restore();
  }

  drawMilestones(ctx, camX, camY, w, h) {
    ctx.save();
    const minX = camX - w / 2 - 50;
    const maxX = camX + w / 2 + 50;

    for (const ms of this.milestones) {
      if (ms.x >= minX && ms.x <= maxX) {
        // Milestone post
        ctx.fillStyle = '#FFBE00';
        ctx.fillRect(ms.x - 3, ms.y - 45, 6, 45);

        // Milestone Signboard
        ctx.fillStyle = '#0F1322';
        ctx.fillRect(ms.x - 28, ms.y - 70, 56, 25);
        ctx.strokeStyle = '#FFBE00';
        ctx.lineWidth = 2;
        ctx.strokeRect(ms.x - 28, ms.y - 70, 56, 25);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 12px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${ms.meters}m`, ms.x, ms.y - 58);
      }
    }
    ctx.restore();
  }

  drawCollectibles(ctx, camX, camY, w, h) {
    const minX = camX - w / 2 - 80;
    const maxX = camX + w / 2 + 80;
    const time = Date.now() * 0.005;

    ctx.save();

    // 1. Coins
    for (const coin of this.coinGroups) {
      if (!coin.collected && coin.x >= minX && coin.x <= maxX) {
        const bounce = Math.sin(time + coin.x * 0.05) * 3;
        const cy = coin.y + bounce;

        // Outer coin rim (Golden Amber)
        ctx.fillStyle = '#FFB703';
        ctx.beginPath();
        ctx.arc(coin.x, cy, 11, 0, Math.PI * 2);
        ctx.fill();

        // Inner coin core
        ctx.fillStyle = '#FFE066';
        ctx.beginPath();
        ctx.arc(coin.x, cy, 8, 0, Math.PI * 2);
        ctx.fill();

        // Bauhaus center star / diamond
        ctx.fillStyle = '#0F1322';
        ctx.font = '900 10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', coin.x, cy);
      }
    }

    // 2. Fuel Cans (Bauhaus Coral Red Canister)
    for (const fuel of this.fuelCans) {
      if (!fuel.collected && fuel.x >= minX && fuel.x <= maxX) {
        const floatY = fuel.y + Math.sin(time * 1.5 + fuel.x) * 4;

        // Shadow beneath fuel can
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(fuel.x, fuel.y + 24, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Jerrycan Body
        ctx.fillStyle = '#FF4742'; // Coral red
        ctx.beginPath();
        ctx.roundRect(fuel.x - 12, floatY - 14, 24, 28, 4);
        ctx.fill();

        // Handle
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fuel.x - 7, floatY - 14);
        ctx.lineTo(fuel.x - 7, floatY - 20);
        ctx.lineTo(fuel.x + 7, floatY - 20);
        ctx.lineTo(fuel.x + 7, floatY - 14);
        ctx.stroke();

        // Cap
        ctx.fillStyle = '#FFB703';
        ctx.fillRect(fuel.x + 4, floatY - 23, 5, 5);

        // "GAS" Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 9px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAS', fuel.x, floatY);
      }
    }

    ctx.restore();
  }
}

window.TerrainManager = TerrainManager;
