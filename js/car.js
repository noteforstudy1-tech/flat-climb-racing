/**
 * Flat Climb Racing - Car Renderer (v2)
 * Hill Climb Racing–style silhouette with Bauhaus flat colour treatment.
 * Made by Raghav Parashar
 */

// Polyfill roundRect for older browsers
(function () {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r || 0, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y,     x + w, y + h, r);
      this.arcTo(x + w, y + h, x,     y + h, r);
      this.arcTo(x,     y + h, x,     y,     r);
      this.arcTo(x,     y,     x + w, y,     r);
      this.closePath();
      return this;
    };
  }
})();

/* ── Livery definitions ─────────────────────────────────────────────── */
const LIVERIES = {
  blue:   { chassis:'#2B55FF', accent:'#FFB703', wheel:'#FFB703',  helmet:'#FF4742', plateBg:'#FFB703', plateText:'#0F1322' },
  red:    { chassis:'#FF4742', accent:'#FFFFFF', wheel:'#FFFFFF',  helmet:'#FFB703', plateBg:'#0F1322', plateText:'#FFFFFF' },
  yellow: { chassis:'#FFB703', accent:'#2B55FF', wheel:'#2B55FF',  helmet:'#00D06C', plateBg:'#2B55FF', plateText:'#FFFFFF' },
  green:  { chassis:'#00D06C', accent:'#FFB703', wheel:'#FFB703',  helmet:'#2B55FF', plateBg:'#0F1322', plateText:'#62FFAE' },
  dark:   { chassis:'#1A1E30', accent:'#FF4742', wheel:'#FF4742',  helmet:'#FFB703', plateBg:'#FF4742', plateText:'#FFFFFF' },
};

class CarRenderer {
  constructor() {
    this.particles    = [];
    this.floatTexts   = [];
  }

  static get LIVERIES() { return LIVERIES; }

  /* ─── PARTICLES ───────────────────────────────────────────────────── */
  spawnExhaust(worldX, worldY, carAngle) {
    const angle = carAngle + Math.PI + (Math.random() - 0.5) * 0.5;
    const spd   = 35 + Math.random() * 30;
    this.particles.push({
      x: worldX, y: worldY,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 18,
      r: 3 + Math.random() * 3,
      life: 1, maxLife: 1,
      col: Math.random() > 0.4 ? 'rgba(255,255,255,' : 'rgba(255,183,3,',
    });
  }

  addFloatingText(text, x, y, color = '#FFB703', size = 16) {
    this.floatTexts.push({ text, x, y, vy: -60, alpha: 1, life: 1, color, size });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.r  += 4 * dt;
      p.life -= dt / p.maxLife * 0.9;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const f = this.floatTexts[i];
      f.y    += f.vy * dt;
      f.life -= dt * 0.9;
      f.alpha = Math.max(0, f.life);
      if (f.life <= 0) this.floatTexts.splice(i, 1);
    }
  }

  drawParticles(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life) * 0.8;
      ctx.fillStyle   = p.col + Math.max(0, p.life) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFloatingTexts(ctx) {
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floatTexts) {
      ctx.globalAlpha  = f.alpha;
      ctx.font         = `900 ${f.size}px "Space Grotesk",sans-serif`;
      ctx.strokeStyle  = '#0F1322';
      ctx.lineWidth    = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle    = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  /* ─── MAIN CAR RENDER ─────────────────────────────────────────────── */
  /**
   * Render the car at world position (cx, cy) with given chassis angle.
   * w1 = rear wheel, w2 = front wheel — each has { x, y, angle }
   */
  renderCar(ctx, cx, cy, angle, w1, w2, opts = {}) {
    const {
      engravedName = 'RACER',
      liveryKey    = 'blue',
      isGhost      = false,
      isPlayer     = true,
      showTag      = false,
      tagText      = '',
      emote        = null,
      gas          = false,
    } = opts;

    const liv = LIVERIES[liveryKey] || LIVERIES.blue;

    ctx.save();
    if (isGhost) ctx.globalAlpha = 0.82;

    /* Wheels (drawn first so body overlaps them slightly) */
    this._drawWheel(ctx, w1.x, w1.y, w1.angle, liv);
    this._drawWheel(ctx, w2.x, w2.y, w2.angle, liv);

    /* Body */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Exhaust particles
    if (gas && Math.random() > 0.4) {
      const ex = cx + Math.cos(angle) * -44;
      const ey = cy + Math.sin(angle) * -44 + Math.cos(angle) * 6;
      this.spawnExhaust(ex, ey, angle);
    }

    this._drawCarBody(ctx, liv, engravedName);

    ctx.restore(); // body transform

    /* Overhead tag + emote */
    if (showTag) this._drawNameTag(ctx, cx, cy - 60, tagText, isPlayer);
    if (emote)   this._drawEmote(ctx, cx, cy - 92, emote);

    ctx.restore(); // global alpha
  }

  /* ─── HILL CLIMB RACING–STYLE CAR BODY ───────────────────────────── */
  _drawCarBody(ctx, liv, name) {
    const sw = '#0F1322';           // stroke / outline colour

    /* ── 1. FRAME / ROLL CAGE ── */
    ctx.strokeStyle = sw;
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Rear strut
    ctx.beginPath();
    ctx.moveTo(-24, 2);
    ctx.lineTo(-28, -28);
    ctx.stroke();

    // Front windscreen frame
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(10, -30);
    ctx.lineTo(32, -30);
    ctx.lineTo(34, -10);
    ctx.stroke();

    // Roof bar
    ctx.beginPath();
    ctx.moveTo(-28, -28);
    ctx.lineTo(10, -30);
    ctx.stroke();

    /* ── 2. MAIN BODY ── (the classic HCR rounded-rectangular silhouette) */
    ctx.fillStyle   = liv.chassis;
    ctx.strokeStyle = sw;
    ctx.lineWidth   = 3.5;

    // Lower hull – wide and squat like the HCR Jeep
    ctx.beginPath();
    ctx.moveTo(-46,  8);   // rear bottom
    ctx.lineTo(-46, -6);   // rear side
    ctx.lineTo(-34, -8);   // rear slope
    ctx.lineTo(-24,  2);   // rear strut base
    ctx.lineTo( 8,   2);   // cockpit floor
    ctx.lineTo(34,  -10);  // front strut base
    ctx.lineTo(42,  -4);   // nose
    ctx.lineTo(44,   8);   // front bumper
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Skid plate / underside
    ctx.fillStyle = liv.accent;
    ctx.beginPath();
    ctx.moveTo(-42, 8);
    ctx.lineTo( 40, 8);
    ctx.lineTo( 38, 12);
    ctx.lineTo(-40, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = sw;
    ctx.lineWidth   = 2;
    ctx.stroke();

    /* ── 3. ROOF & WINDSCREEN ── */
    // Roof panel
    ctx.fillStyle   = liv.chassis;
    ctx.strokeStyle = sw;
    ctx.lineWidth   = 3.5;
    ctx.beginPath();
    ctx.moveTo(-28, -28);
    ctx.lineTo( 10, -30);
    ctx.lineTo( 32, -30);
    ctx.lineTo( 34, -10);
    ctx.lineTo(  8,   2);
    ctx.lineTo(-24,   2);
    ctx.lineTo(-28, -28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Windscreen glass
    ctx.fillStyle   = 'rgba(120,210,255,0.38)';
    ctx.strokeStyle = 'rgba(120,210,255,0.7)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(11, -28);
    ctx.lineTo(31, -28);
    ctx.lineTo(32, -12);
    ctx.lineTo(10,  -1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /* ── 4. REAR CARGO / FUEL TANK BUMP ── */
    ctx.fillStyle   = liv.accent;
    ctx.strokeStyle = sw;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.roundRect(-44, -20, 18, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Tank highlight line
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(-42, -8);
    ctx.lineTo(-28, -8);
    ctx.stroke();

    /* ── 5. FRONT HEADLIGHT ── */
    ctx.fillStyle   = '#FFEE88';
    ctx.strokeStyle = sw;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(40, -3, 5, 8, 2);
    ctx.fill();
    ctx.stroke();

    /* ── 6. DRIVER (Little HCR–style character) ── */
    this._drawDriver(ctx, liv);

    /* ── 7. ENGRAVED NAME PLATE (on door) ── */
    this._drawPlate(ctx, name, liv);

    /* ── 8. ACCENT RACING STRIPE ── */
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-22, -4, 52, 5);
  }

  _drawDriver(ctx, liv) {
    /* Body torso */
    ctx.fillStyle   = liv.chassis;
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.roundRect(-16, -26, 18, 22, 4);
    ctx.fill();
    ctx.stroke();

    /* Helmet */
    ctx.fillStyle = liv.helmet;
    ctx.beginPath();
    ctx.arc(-7, -28, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    /* Visor slit */
    ctx.fillStyle = '#0F1322';
    ctx.beginPath();
    ctx.roundRect(-4, -31, 8, 5, 2);
    ctx.fill();

    /* Helmet stripe */
    ctx.strokeStyle = liv.accent;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(-7, -28, 10, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  _drawPlate(ctx, name, liv) {
    const rawName = (name || 'RACER').toUpperCase().trim().slice(0, 13);
    const pw = 52, ph = 16;
    const px = -8, py = -4; // door area

    // Plate base
    ctx.fillStyle   = liv.plateBg;
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth   = 1.8;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 3);
    ctx.fill();
    ctx.stroke();

    // Corner rivets
    ctx.fillStyle = '#0F1322';
    [[px+2, py+2],[px+pw-4,py+2],[px+2,py+ph-4],[px+pw-4,py+ph-4]].forEach(([rx,ry]) => {
      ctx.beginPath(); ctx.arc(rx, ry, 1.2, 0, Math.PI*2); ctx.fill();
    });

    // Name text
    ctx.fillStyle = liv.plateText;
    let fs = 10;
    if (rawName.length > 8)  fs = 8.5;
    if (rawName.length > 11) fs = 7;
    ctx.font         = `900 ${fs}px "Space Grotesk",sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rawName, px + pw / 2, py + ph / 2 + 0.5);
  }

  /* ─── WHEEL ───────────────────────────────────────────────────────── */
  _drawWheel(ctx, wx, wy, wa, liv) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wa);

    const R = 18, r = 9;

    // Tire (big, grippy HCR style)
    ctx.fillStyle   = '#0F1322';
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth   = 0;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();

    // Tread nubs – 8 around edge
    for (let i = 0; i < 8; i++) {
      const a  = (i / 8) * Math.PI * 2;
      const nx = Math.cos(a) * (R - 2);
      const ny = Math.sin(a) * (R - 2);
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(a);
      ctx.fillStyle = '#1E2740';
      ctx.fillRect(-4, -3, 8, 6);
      ctx.restore();
    }

    // Rim
    ctx.fillStyle   = liv.wheel;
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rim spokes (3 spokes)
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth   = 2.5;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
      ctx.lineTo(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1));
      ctx.stroke();
    }

    // Hub cap
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ─── NAME TAG (multiplayer overhead label) ─────────────────────── */
  _drawNameTag(ctx, x, y, text, isPlayer) {
    ctx.save();
    const bg = isPlayer ? '#2B55FF' : '#FF4742';
    ctx.font = '800 11px "Space Grotesk",sans-serif';
    const tw = ctx.measureText(text).width;
    const w  = Math.max(52, tw + 18), h = 22;

    ctx.fillStyle   = bg;
    ctx.strokeStyle = '#0F1322';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(x - w/2, y - h/2, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Downward arrow
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(x-5, y+h/2); ctx.lineTo(x+5, y+h/2); ctx.lineTo(x, y+h/2+6);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle    = '#FFFFFF';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  _drawEmote(ctx, x, y, emoji) {
    ctx.save();
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#0F1322'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI*2);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.strokeStyle = '#0F1322'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.fillText(emoji, x, y);
    ctx.restore();
  }

}

window.CarRenderer = CarRenderer;
