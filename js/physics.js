/**
 * Flat Climb Racing - 2D Vehicle Physics Engine (v2 - Fixed & Tuned)
 * Simple, stable, fun - like the original Hill Climb Racing.
 * Made by Raghav Parashar
 */

class VehiclePhysics {
  constructor(terrain) {
    this.terrain = terrain;

    // Vehicle layout
    this.wheelRadius = 18;
    this.wheelbase   = 68; // px between wheel centers

    // Physics tuning
    this.gravity        = 1400; // px/s²
    this.driveForce     = 2200;
    this.brakeForce     = 1400;
    this.airTorqueRate  = 5.5;  // rad/s² when tilting in air
    this.linearDamping  = 0.985;
    this.angularDamping = 0.88;

    this.reset();
  }

  reset(startX = 80) {
    const gy = this.terrain.getHeight(startX);

    // Represent car as a single rigid body on two contact points
    this.x  = startX;
    this.y  = gy - this.wheelRadius - 2;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.angVel = 0;

    // Wheel spin angles (visual only)
    this.w1Angle = 0;
    this.w2Angle = 0;

    // Ground contact flags
    this.w1OnGround = true;
    this.w2OnGround = true;

    // Stats
    this.distance  = 0;
    this.fuel      = 100;
    this.score     = 0;
    this.crashed   = false;
    this.airTime   = 0;
    this.inAir     = false;
    this.flipAcc   = 0; // accumulates rotation in air for flip detection
    this.lastAngle = 0;

    // Event hooks
    this.onCoin    = null;
    this.onFuel    = null;
    this.onFlip    = null;
    this.onCrash   = null;
  }

  // Returns world positions of the two wheel axle centers
  getWheelPositions() {
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);
    const half = this.wheelbase / 2;
    // Wheel 1 = rear (left in travel direction)
    const w1x = this.x - cosA * half;
    const w1y = this.y - sinA * half;
    // Wheel 2 = front
    const w2x = this.x + cosA * half;
    const w2y = this.y + sinA * half;
    return { w1x, w1y, w2x, w2y };
  }

  update(dt, gas, brake) {
    if (this.crashed) {
      this._updateCrashed(dt);
      return;
    }
    dt = Math.min(dt, 0.025); // clamp to avoid explosion on tab-switch

    const { w1x, w1y, w2x, w2y } = this.getWheelPositions();

    // Ground heights at each wheel
    const g1 = this.terrain.getHeight(w1x);
    const g2 = this.terrain.getHeight(w2x);

    // Check contact
    this.w1OnGround = (w1y + this.wheelRadius) >= g1;
    this.w2OnGround = (w2y + this.wheelRadius) >= g2;
    const anyOnGround = this.w1OnGround || this.w2OnGround;
    const bothOnGround = this.w1OnGround && this.w2OnGround;

    // ---- GRAVITY ----
    this.vy += this.gravity * dt;

    // ---- DRIVE / BRAKE ----
    if (anyOnGround && this.fuel > 0) {
      const cosA = Math.cos(this.angle);
      const sinA = Math.sin(this.angle);
      if (gas) {
        this.vx += cosA * this.driveForce * dt;
        this.vy += sinA * this.driveForce * dt;
      } else if (brake) {
        // Brake: apply force in reverse direction
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 5) {
          this.vx -= (this.vx / speed) * this.brakeForce * dt;
          this.vy -= (this.vy / speed) * this.brakeForce * dt;
        }
      }
    }

    // ---- AIR TILT ----
    if (!anyOnGround) {
      if (gas)   this.angVel -= this.airTorqueRate * dt; // lean back
      if (brake) this.angVel += this.airTorqueRate * dt; // lean forward
    }

    // ---- ANGULAR DAMPING when on ground ----
    if (bothOnGround) {
      this.angVel *= Math.pow(this.angularDamping, dt * 60);
    } else {
      this.angVel *= Math.pow(0.995, dt * 60);
    }

    // Integrate
    this.angle += this.angVel * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // ---- GROUND COLLISION (per wheel) ----
    this._resolveGround(dt);

    // ---- CHASSIS TILT TO TERRAIN ----
    if (bothOnGround) {
      this._alignToTerrain(dt);
    }

    // ---- LINEAR DAMPING (air resistance) ----
    this.vx *= Math.pow(this.linearDamping, dt * 60);

    // ---- FUEL ----
    if (this.fuel > 0) {
      this.fuel -= (gas ? 3.5 : 0.6) * dt;
      if (this.fuel < 0) this.fuel = 0;
    }

    // ---- DISTANCE ----
    this.distance = Math.max(0, Math.floor((this.x - 80) / 30));

    // ---- FLIP TRACKING ----
    this._trackFlips(dt);

    // ---- COLLECTIBLES ----
    this._checkCollectibles();

    // ---- CRASH CHECK ----
    this._checkCrash();

    // ---- WHEEL SPIN (visual) ----
    const speed = Math.hypot(this.vx, this.vy);
    const spinRate = speed / this.wheelRadius;
    this.w1Angle += spinRate * (this.vx >= 0 ? 1 : -1) * dt;
    this.w2Angle += spinRate * (this.vx >= 0 ? 1 : -1) * dt;
  }

  _resolveGround(dt) {
    const { w1x, w1y, w2x, w2y } = this.getWheelPositions();

    let pushY1 = 0, pushY2 = 0;

    if (this.w1OnGround) {
      const g1 = this.terrain.getHeight(w1x);
      const pen1 = (w1y + this.wheelRadius) - g1;
      if (pen1 > 0) {
        pushY1 = pen1;
        if (this.vy > 0) this.vy = 0; // stop sinking
      }
    }
    if (this.w2OnGround) {
      const g2 = this.terrain.getHeight(w2x);
      const pen2 = (w2y + this.wheelRadius) - g2;
      if (pen2 > 0) {
        pushY2 = pen2;
        if (this.vy > 0) this.vy = 0;
      }
    }

    // Apply correction to body center
    const maxPush = Math.max(pushY1, pushY2);
    if (maxPush > 0) {
      this.y -= maxPush;
    }
  }

  _alignToTerrain(dt) {
    const { w1x, w2x } = this.getWheelPositions();
    const h1 = this.terrain.getHeight(w1x);
    const h2 = this.terrain.getHeight(w2x);
    const targetAngle = Math.atan2(h2 - h1, w2x - w1x);

    // Smoothly drive angle toward terrain angle
    let diff = targetAngle - this.angle;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // PD controller
    this.angVel += diff * 18 * dt;
    this.angVel -= this.angVel * 12 * dt;
  }

  _trackFlips(dt) {
    const anyOnGround = this.w1OnGround || this.w2OnGround;
    if (!anyOnGround) {
      this.inAir = true;
      this.airTime += dt;

      let delta = this.angle - this.lastAngle;
      while (delta >  Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.flipAcc += delta;

      if (this.flipAcc <= -Math.PI * 1.9) {
        this.flipAcc += Math.PI * 2;
        this.score += 1000;
        if (this.onFlip) this.onFlip('BACKFLIP', 1000);
      } else if (this.flipAcc >= Math.PI * 1.9) {
        this.flipAcc -= Math.PI * 2;
        this.score += 1500;
        if (this.onFlip) this.onFlip('FRONTFLIP', 1500);
      }
    } else {
      if (this.inAir && this.airTime > 1.0) {
        this.score += Math.floor(this.airTime * 100);
      }
      this.inAir   = false;
      this.airTime = 0;
      this.flipAcc = 0;
    }
    this.lastAngle = this.angle;
  }

  _checkCollectibles() {
    const r = 42;
    for (const coin of this.terrain.coinGroups) {
      if (!coin.collected) {
        const dx = coin.x - this.x;
        const dy = coin.y - this.y;
        if (Math.abs(dx) < r && Math.abs(dy) < r) {
          coin.collected = true;
          this.score += 100;
          if (this.onCoin) this.onCoin(100, coin.x, coin.y);
        }
      }
    }
    for (const fc of this.terrain.fuelCans) {
      if (!fc.collected) {
        const dx = fc.x - this.x;
        const dy = fc.y - this.y;
        if (Math.abs(dx) < r && Math.abs(dy) < r) {
          fc.collected = true;
          this.fuel = 100;
          this.score += 250;
          if (this.onFuel) this.onFuel(fc.x, fc.y);
        }
      }
    }
  }

  _checkCrash() {
    // Driver head is above the car body — if it hits terrain = crash
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);
    // Head is slightly in front of center and above
    const headX = this.x - sinA * 26 + cosA * 8;
    const headY = this.y + cosA * 26 + sinA * 8;  // Wait - corrected below
    // Actually: "above" in screen means negative y offset from car
    // Head sits at +cosA*26 in the body-normal direction
    const hx = this.x + (-sinA) * 28;
    const hy = this.y + ( cosA) * 28;

    const gy = this.terrain.getHeight(hx);
    if (hy >= gy - 4 && (this.w1OnGround || this.w2OnGround)) {
      this.crashed = true;
      if (this.onCrash) this.onCrash();
    }
  }

  _updateCrashed(dt) {
    dt = Math.min(dt, 0.025);
    this.vy += this.gravity * dt;
    this.vx *= 0.97;
    this.angVel *= 0.95;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angVel * dt;

    const gy = this.terrain.getHeight(this.x);
    if (this.y > gy - this.wheelRadius) {
      this.y = gy - this.wheelRadius;
      this.vy *= -0.15;
      this.vx *= 0.7;
    }
  }
}

window.VehiclePhysics = VehiclePhysics;
