/**
 * Flat Climb Racing - Car Renderer & Name Engraving System
 * Bauhaus flat geometric car styling with dynamic nameplate engraving.
 * Made by Raghav Parashar
 */

// Defensive polyfill for CanvasRenderingContext2D.roundRect
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    if (typeof r === 'number') r = [r, r, r, r];
    const [tl, tr, br, bl] = r;
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    return this;
  };
}

class CarRenderer {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
  }

  // Predefined flat color liveries
  static LIVERIES = {
    blue: {
      id: 'blue',
      name: 'Royal Speedster',
      chassis: '#2B55FF',   // Bauhaus Royal Blue
      accent: '#FFB703',    // Marigold
      plateBg: '#FFB703',   // Gold plate
      plateText: '#0F1322', // Dark navy text
      cockpit: '#171C30',
      wheelRims: '#FFB703',
      helmet: '#FF4742'
    },
    red: {
      id: 'red',
      name: 'Coral Blaze',
      chassis: '#FF4742',   // Coral Red
      accent: '#FFFFFF',
      plateBg: '#0F1322',   // Obsidian plate
      plateText: '#FFFFFF', // White text
      cockpit: '#171C30',
      wheelRims: '#FFFFFF',
      helmet: '#FFB703'
    },
    yellow: {
      id: 'yellow',
      name: 'Marigold Gold',
      chassis: '#FFB703',   // Marigold Yellow
      accent: '#2B55FF',
      plateBg: '#2B55FF',   // Royal blue plate
      plateText: '#FFFFFF',
      cockpit: '#0F1322',
      wheelRims: '#2B55FF',
      helmet: '#00D06C'
    },
    green: {
      id: 'green',
      name: 'Emerald Drift',
      chassis: '#00D06C',   // Emerald Green
      accent: '#FFB703',
      plateBg: '#0F1322',
      plateText: '#62FFAE',
      cockpit: '#0F1322',
      wheelRims: '#FFB703',
      helmet: '#2B55FF'
    },
    dark: {
      id: 'dark',
      name: 'Stealth Onyx',
      chassis: '#1A1E30',   // Deep Obsidian
      accent: '#FF4742',
      plateBg: '#FF4742',   // Coral red plate
      plateText: '#FFFFFF',
      cockpit: '#0D0F1A',
      wheelRims: '#FF4742',
      helmet: '#FFB703'
    }
  };

  addExhaust(x, y, angle) {
    const spread = (Math.random() - 0.5) * 0.4;
    const speed = 40 + Math.random() * 30;
    const launchAngle = angle + Math.PI + spread;
    this.particles.push({
      x: x,
      y: y,
      vx: Math.cos(launchAngle) * speed,
      vy: Math.sin(launchAngle) * speed - 15,
      size: 4 + Math.random() * 4,
      maxSize: 14,
      alpha: 0.8,
      life: 0.35,
      color: Math.random() > 0.4 ? '#FFFFFF' : '#FFB703'
    });
  }

  addFloatingText(text, x, y, color = '#FFB703', size = 16) {
    this.floatingTexts.push({
      text: text,
      x: x,
      y: y,
      vy: -55,
      alpha: 1.0,
      life: 0.9,
      color: color,
      size: size
    });
  }

  updateParticles(dt) {
    // Update exhaust particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.size += (p.maxSize - p.size) * (dt * 5);
      p.alpha = Math.max(0, p.life / 0.35);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating pop texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      ft.alpha = Math.max(0, ft.life / 0.9);
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  drawParticles(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFloatingTexts(ctx) {
    ctx.save();
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#0F1322';
      ctx.lineWidth = 4;
      ctx.font = `900 ${ft.size}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  /**
   * Main render function for a car
   */
  renderCar(ctx, x, y, angle, w1, w2, options = {}) {
    const {
      engravedName = 'RAGHAV',
      liveryKey = 'blue',
      isGhost = false,
      isPlayer = true,
      tagText = null,
      emote = null,
      gas = false
    } = options;

    const livery = CarRenderer.LIVERIES[liveryKey] || CarRenderer.LIVERIES.blue;

    ctx.save();
    if (isGhost) {
      ctx.globalAlpha = 0.85; // Remote player styling
    }

    // 1. Suspension Struts (Mount to Wheel Hubs)
    this.drawSuspension(ctx, x, y, angle, w1, w2, livery);

    // 2. Wheels
    this.drawWheel(ctx, w1.x, w1.y, w1.angle, livery);
    this.drawWheel(ctx, w2.x, w2.y, w2.angle, livery);

    // 3. Chassis & Engraved Name Plate
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Exhaust pipe (Rear left)
    ctx.fillStyle = '#6B7280';
    ctx.fillRect(-44, -2, 10, 6);
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-44, -2, 10, 6);

    if (gas) {
      // Spawn exhaust particles relative to car
      const exhaustWorldX = x + Math.cos(angle) * -44 - Math.sin(angle) * 1;
      const exhaustWorldY = y + Math.sin(angle) * -44 + Math.cos(angle) * 1;
      if (Math.random() > 0.3) {
        this.addExhaust(exhaustWorldX, exhaustWorldY, angle);
      }
    }

    // Driver Helmet & Visor
    this.drawDriver(ctx, livery);

    // Roll Cage / Roof Pillars
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-16, -14);
    ctx.lineTo(-4, -32);
    ctx.lineTo(20, -32);
    ctx.lineTo(26, -14);
    ctx.stroke();

    // Windshield (Bauhaus cyan tinted glass)
    ctx.fillStyle = 'rgba(98, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(-2, -30);
    ctx.lineTo(18, -30);
    ctx.lineTo(24, -14);
    ctx.lineTo(0, -14);
    ctx.closePath();
    ctx.fill();

    // Main Car Body (Geometric Bauhaus flat silhouette)
    ctx.fillStyle = livery.chassis;
    ctx.beginPath();
    ctx.moveTo(-42, 6);   // Rear bumper
    ctx.lineTo(-42, -12); // Rear tail
    ctx.lineTo(-30, -14); // Spoiler mount
    ctx.lineTo(-12, -14); // Rear cockpit base
    ctx.lineTo(0, -28);   // Windshield slope
    ctx.lineTo(20, -28);  // Roof line
    ctx.lineTo(34, -10);  // Hood slope
    ctx.lineTo(44, -6);   // Nose front
    ctx.lineTo(44, 6);    // Front spoiler
    ctx.lineTo(32, 6);    // Front wheel arch right
    ctx.arc(24, 6, 12, 0, Math.PI, true);  // Front wheel arch
    ctx.lineTo(-14, 6);   // Underside
    ctx.arc(-24, 6, 12, 0, Math.PI, true); // Rear wheel arch
    ctx.closePath();
    ctx.fill();

    // Bold Outline (Bauhaus cartoon-grotesk stroke)
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Rear Aero Wing / Spoiler
    ctx.fillStyle = livery.accent;
    ctx.beginPath();
    ctx.rect(-44, -22, 16, 5);
    ctx.fill();
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-44, -22, 16, 5);

    // Front Headlight (Geometric bright circle/square)
    ctx.fillStyle = '#FFBE00';
    ctx.fillRect(40, -5, 4, 7);
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, -5, 4, 7);

    // Accent Racing Stripe
    ctx.fillStyle = livery.accent;
    ctx.fillRect(-28, -6, 56, 3.5);

    // ==========================================
    // THE CAR ENGRAVING PLATE (Custom Racer Name)
    // ==========================================
    this.drawEngravedPlate(ctx, engravedName, livery);

    ctx.restore(); // Restore car transform

    // 4. Overhead Name Tag / Multiplayer Badge
    if (tagText || !isPlayer) {
      this.drawNameTag(ctx, x, y - 52, tagText || engravedName, isPlayer);
    }

    // 5. Speech Bubble / Emote
    if (emote) {
      this.drawEmoteBubble(ctx, x, y - 82, emote);
    }

    ctx.restore();
  }

  drawSuspension(ctx, carX, carY, angle, w1, w2, livery) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Mount points
    const m1X = carX - cosA * 28 + sinA * 6;
    const m1Y = carY - sinA * 28 - cosA * 6;
    const m2X = carX + cosA * 28 + sinA * 6;
    const m2Y = carY + sinA * 28 - cosA * 6;

    ctx.save();
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    // Rear strut
    ctx.beginPath();
    ctx.moveTo(m1X, m1Y);
    ctx.lineTo(w1.x, w1.y);
    ctx.stroke();

    // Front strut
    ctx.beginPath();
    ctx.moveTo(m2X, m2Y);
    ctx.lineTo(w2.x, w2.y);
    ctx.stroke();

    // Spring coils (Bauhaus gold accent)
    ctx.strokeStyle = livery.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo((m1X + w1.x) / 2 - 4, (m1Y + w1.y) / 2 - 2);
    ctx.lineTo((m1X + w1.x) / 2 + 4, (m1Y + w1.y) / 2 + 2);
    ctx.moveTo((m2X + w2.x) / 2 - 4, (m2Y + w2.y) / 2 - 2);
    ctx.lineTo((m2X + w2.x) / 2 + 4, (m2Y + w2.y) / 2 + 2);
    ctx.stroke();

    ctx.restore();
  }

  drawWheel(ctx, x, y, angle, livery) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const radius = 15;

    // Outer Tire (Thick Charcoal/Black)
    ctx.fillStyle = '#0F1322';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Flat Tire Treads (Bauhaus geometric teeth)
    ctx.fillStyle = '#22283C';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * 11 - 2, Math.sin(a) * 11 - 2, 4, 4);
    }

    // Wheel Rim (Vibrant Livery color)
    ctx.fillStyle = livery.wheelRims;
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Hubcap Center
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Rotation indicator notch
    ctx.fillStyle = '#0F1322';
    ctx.fillRect(3, -1.5, 4, 3);

    ctx.restore();
  }

  drawDriver(ctx, livery) {
    // Driver Head / Helmet
    ctx.fillStyle = livery.helmet;
    ctx.beginPath();
    ctx.arc(8, -20, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Driver Visor (Dark sporty slit)
    ctx.fillStyle = '#0F1322';
    ctx.beginPath();
    ctx.roundRect(10, -22, 6, 4.5, 1.5);
    ctx.fill();
  }

  /**
   * Engrave racer's name onto the car chassis door
   */
  drawEngravedPlate(ctx, name, livery) {
    const rawName = (name || 'RACER').toUpperCase().trim().slice(0, 14);

    const plateW = 48;
    const plateH = 15;
    const plateX = -18;
    const plateY = -2;

    // Plate Base
    ctx.fillStyle = livery.plateBg;
    ctx.beginPath();
    ctx.roundRect(plateX, plateY, plateW, plateH, 3);
    ctx.fill();

    // Engraved inset border
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(plateX, plateY, plateW, plateH);

    // Decorative corner bolts / rivets
    ctx.fillStyle = '#0F1322';
    ctx.fillRect(plateX + 2, plateY + 2, 1.5, 1.5);
    ctx.fillRect(plateX + plateW - 3.5, plateY + 2, 1.5, 1.5);
    ctx.fillRect(plateX + 2, plateY + plateH - 3.5, 1.5, 1.5);
    ctx.fillRect(plateX + plateW - 3.5, plateY + plateH - 3.5, 1.5, 1.5);

    // Laser-Engraved Typography
    ctx.save();
    ctx.fillStyle = livery.plateText;
    // Dynamic text size based on name length
    let fontSize = 9.5;
    if (rawName.length > 8) fontSize = 8.0;
    if (rawName.length > 11) fontSize = 6.8;

    ctx.font = `900 ${fontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.5px';
    ctx.fillText(rawName, plateX + plateW / 2, plateY + plateH / 2 + 0.5);
    ctx.restore();
  }

  drawNameTag(ctx, x, y, text, isPlayer) {
    ctx.save();
    const tagBg = isPlayer ? '#2B55FF' : '#FF4742';
    ctx.font = '800 11px "Space Grotesk", sans-serif';
    const textMetrics = ctx.measureText(text);
    const w = Math.max(50, textMetrics.width + 16);
    const h = 20;

    // Tag Bubble
    ctx.fillStyle = tagBg;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 6);
    ctx.fill();

    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);

    // Little downward arrow
    ctx.fillStyle = tagBg;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + h / 2);
    ctx.lineTo(x + 4, y + h / 2);
    ctx.lineTo(x, y + h / 2 + 5);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawEmoteBubble(ctx, x, y, emote) {
    ctx.save();
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Speech bubble
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillText(emote, x, y);
    ctx.restore();
  }
}

window.CarRenderer = CarRenderer;
