/**
 * Flat Climb Racing - 2D Vehicle Physics Engine
 * Chassis, two independent spring-damper suspension wheels, in-air torque, and collision detection.
 * Made by Raghav Parashar
 */

class VehiclePhysics {
  constructor(terrain) {
    this.terrain = terrain;

    // Vehicle dimensions
    this.wheelbase = 60; // Distance between wheels
    this.chassisWidth = 76;
    this.chassisHeight = 30;
    this.wheelRadius = 15;
    this.suspensionRestLength = 26;

    // Physical constants
    this.gravity = 980; // px/s^2
    this.mass = 4.0;
    this.wheelMass = 1.0;
    this.inertia = 1200;

    // Engine & Handling tuning
    this.driveForce = 1750;
    this.reverseForce = 1100;
    this.airTorque = 16.0; // Torque for mid-air flips
    this.springK = 260; // Suspension spring stiffness
    this.damperC = 22;  // Suspension damping
    this.tireFriction = 2.4;

    this.reset();
  }

  reset(startX = 60) {
    const groundY = this.terrain.getHeight(startX);

    // Chassis state
    this.x = startX;
    this.y = groundY - 50;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.angularVelocity = 0;

    // Rear wheel (Wheel 1)
    this.w1 = {
      x: startX - this.wheelbase / 2,
      y: groundY - this.wheelRadius - 2,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVelocity: 0,
      onGround: true,
      slip: 0
    };

    // Front wheel (Wheel 2)
    this.w2 = {
      x: startX + this.wheelbase / 2,
      y: groundY - this.wheelRadius - 2,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVelocity: 0,
      onGround: true,
      slip: 0
    };

    // Game stats
    this.distance = 0;
    this.maxDistance = 0;
    this.fuel = 100.0;
    this.score = 0;
    this.crashed = false;
    this.outOfFuel = false;
    this.airTime = 0;
    this.inAir = false;
    this.totalRotation = 0;
    this.lastAngle = 0;
    this.flipAccumulator = 0;

    // Event hooks
    this.onFlip = null;
    this.onCoin = null;
    this.onFuel = null;
    this.onCrash = null;
  }

  update(dt, gasInput, brakeInput) {
    if (this.crashed) {
      // Just simulate inert tumbling if crashed
      this.updateCrashed(dt);
      return;
    }

    // Clamp dt to avoid physics explosion on lag spikes
    const stepDt = Math.min(dt, 0.033);
    const substeps = 4;
    const subDt = stepDt / substeps;

    for (let s = 0; s < substeps; s++) {
      this.physicsSubstep(subDt, gasInput, brakeInput);
    }

    // Fuel consumption
    if (this.fuel > 0) {
      const fuelRate = (gasInput ? 4.2 : 0.8);
      this.fuel = Math.max(0, this.fuel - fuelRate * stepDt);
      if (this.fuel <= 0 && !this.outOfFuel) {
        this.outOfFuel = true;
      }
    }

    // Update Distance
    this.distance = Math.max(0, Math.floor((this.x - 60) / 30));
    if (this.distance > this.maxDistance) {
      this.maxDistance = this.distance;
    }

    // In-air and Flip Tracker
    const airborne = !this.w1.onGround && !this.w2.onGround;
    if (airborne) {
      this.inAir = true;
      this.airTime += stepDt;

      // Track angular change for 360 flips
      let deltaAngle = this.angle - this.lastAngle;
      // Normalize delta
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      this.flipAccumulator += deltaAngle;

      if (this.flipAccumulator <= -Math.PI * 1.85) {
        // Backflip complete!
        this.flipAccumulator += Math.PI * 2;
        this.score += 1000;
        if (this.onFlip) this.onFlip('BACKFLIP', 1000);
      } else if (this.flipAccumulator >= Math.PI * 1.85) {
        // Frontflip complete!
        this.flipAccumulator -= Math.PI * 2;
        this.score += 1500;
        if (this.onFlip) this.onFlip('FRONTFLIP', 1500);
      }
    } else {
      if (this.inAir && this.airTime > 1.0) {
        // Big air bonus
        const airBonus = Math.floor(this.airTime * 150);
        this.score += airBonus;
      }
      this.inAir = false;
      this.airTime = 0;
      this.flipAccumulator = 0;
    }
    this.lastAngle = this.angle;

    // Collectibles Check
    this.checkCollectibles();

    // Crash Check (Head hit ground)
    this.checkCrash();
  }

  physicsSubstep(dt, gas, brake) {
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);

    // Chassis mount positions in world space
    // Rear mount:
    const mount1X = this.x - cosA * (this.wheelbase * 0.48) + sinA * 6;
    const mount1Y = this.y - sinA * (this.wheelbase * 0.48) - cosA * 6;

    // Front mount:
    const mount2X = this.x + cosA * (this.wheelbase * 0.48) + sinA * 6;
    const mount2Y = this.y + sinA * (this.wheelbase * 0.48) - cosA * 6;

    // Normal downward vector relative to chassis
    const downX = -sinA;
    const downY = cosA;

    // --- 1. SUSPENSION FORCES ---
    // Wheel 1 (Rear)
    const s1X = this.w1.x - mount1X;
    const s1Y = this.w1.y - mount1Y;
    const s1Dist = Math.sqrt(s1X * s1X + s1Y * s1Y) || 1;
    const s1Comp = s1Dist - this.suspensionRestLength;
    const s1DirX = s1X / s1Dist;
    const s1DirY = s1Y / s1Dist;

    const relV1X = this.w1.vx - this.vx;
    const relV1Y = this.w1.vy - this.vy;
    const damp1 = relV1X * s1DirX + relV1Y * s1DirY;
    const f1Spring = -this.springK * s1Comp - this.damperC * damp1;

    // Wheel 2 (Front)
    const s2X = this.w2.x - mount2X;
    const s2Y = this.w2.y - mount2Y;
    const s2Dist = Math.sqrt(s2X * s2X + s2Y * s2Y) || 1;
    const s2Comp = s2Dist - this.suspensionRestLength;
    const s2DirX = s2X / s2Dist;
    const s2DirY = s2Y / s2Dist;

    const relV2X = this.w2.vx - this.vx;
    const relV2Y = this.w2.vy - this.vy;
    const damp2 = relV2X * s2DirX + relV2Y * s2DirY;
    const f2Spring = -this.springK * s2Comp - this.damperC * damp2;

    // Apply suspension to wheels (pushing wheels away from chassis)
    this.w1.vx += (s1DirX * -f1Spring / this.wheelMass) * dt;
    this.w1.vy += (s1DirY * -f1Spring / this.wheelMass) * dt;

    this.w2.vx += (s2DirX * -f2Spring / this.wheelMass) * dt;
    this.w2.vy += (s2DirY * -f2Spring / this.wheelMass) * dt;

    // Opposite force applied to chassis
    const chassisFx = s1DirX * f1Spring + s2DirX * f2Spring;
    const chassisFy = s1DirY * f1Spring + s2DirY * f2Spring;
    this.vx += (chassisFx / this.mass) * dt;
    this.vy += (chassisFy / this.mass) * dt;

    // Suspension torque on chassis
    const torque1 = (mount1X - this.x) * (s1DirY * f1Spring) - (mount1Y - this.y) * (s1DirX * f1Spring);
    const torque2 = (mount2X - this.x) * (s2DirY * f2Spring) - (mount2Y - this.y) * (s2DirX * f2Spring);
    let totalTorque = torque1 + torque2;

    // --- 2. IN-AIR PITCH TORQUE (Hill Climb classic balance) ---
    const inAirRatio = (!this.w1.onGround ? 0.5 : 0) + (!this.w2.onGround ? 0.5 : 0);
    if (inAirRatio > 0) {
      if (gas && this.fuel > 0) {
        totalTorque -= this.airTorque * this.inertia * inAirRatio; // Lean back
      }
      if (brake) {
        totalTorque += this.airTorque * this.inertia * inAirRatio; // Lean fwd
      }
    }

    // Apply gravity
    this.vy += this.gravity * dt;
    this.w1.vy += this.gravity * dt;
    this.w2.vy += this.gravity * dt;

    // Update chassis rotation
    this.angularVelocity += (totalTorque / this.inertia) * dt;
    this.angularVelocity *= Math.pow(0.92, dt * 60); // Angular damping
    this.angle += this.angularVelocity * dt;

    // Update chassis position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // --- 3. WHEEL TERRAIN COLLISION & PROPULSION ---
    this.updateWheelTerrain(this.w1, dt, gas, brake, true);
    this.updateWheelTerrain(this.w2, dt, gas, brake, false);

    // Hard limit distance between wheels and chassis so suspension cannot invert
    this.constrainWheel(this.w1, mount1X, mount1Y);
    this.constrainWheel(this.w2, mount2X, mount2Y);
  }

  updateWheelTerrain(w, dt, gas, brake, isRear) {
    const groundY = this.terrain.getHeight(w.x);
    const slope = this.terrain.getSlope(w.x);
    const normal = this.terrain.getNormal(w.x);
    const tangX = Math.cos(normal.angle);
    const tangY = Math.sin(normal.angle);

    const penetration = (w.y + this.wheelRadius) - groundY;

    if (penetration > 0) {
      w.onGround = true;

      // Position correction
      w.y -= normal.y * penetration;
      w.x -= normal.x * penetration;

      // Relative velocity along normal and tangent
      const vDotNormal = w.vx * normal.x + w.vy * normal.y;
      const vDotTang = w.vx * tangX + w.vy * tangY;

      // Normal reaction force (springy ground contact)
      if (vDotNormal < 0) {
        const restitution = 0.05;
        w.vx -= (1 + restitution) * vDotNormal * normal.x;
        w.vy -= (1 + restitution) * vDotNormal * normal.y;
      }

      // DRIVE TORQUE & BRAKING
      let driveForce = 0;
      if (this.fuel > 0) {
        if (gas) {
          // All-wheel drive, biased towards rear
          driveForce = this.driveForce * (isRear ? 1.0 : 0.8);
        } else if (brake) {
          driveForce = -this.reverseForce;
        }
      }

      // Ground friction against slip
      const frictionImpulse = -vDotTang * this.tireFriction * 18 * dt;
      const driveImpulse = (driveForce / this.wheelMass) * dt;
      const totalTangential = driveImpulse + frictionImpulse;

      w.vx += totalTangential * tangX;
      w.vy += totalTangential * tangY;

      // Wheel rotation visual
      w.angularVelocity = (w.vx * tangX + w.vy * tangY) / this.wheelRadius;
    } else {
      w.onGround = false;
      // Air drag on spinning wheel
      w.angularVelocity *= 0.98;
    }

    w.x += w.vx * dt;
    w.y += w.vy * dt;
    w.angle += w.angularVelocity * dt;
  }

  constrainWheel(w, mx, my) {
    const dx = w.x - mx;
    const dy = w.y - my;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxLen = this.suspensionRestLength * 1.45;
    const minLen = this.suspensionRestLength * 0.45;

    if (dist > maxLen) {
      w.x = mx + (dx / dist) * maxLen;
      w.y = my + (dy / dist) * maxLen;
    } else if (dist < minLen) {
      w.x = mx + (dx / dist) * minLen;
      w.y = my + (dy / dist) * minLen;
    }
  }

  checkCrash() {
    // Driver head position
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);
    const headX = this.x + sinA * 22;
    const headY = this.y - cosA * 22;

    const groundY = this.terrain.getHeight(headX);

    // If head hits ground or upside down collision
    if (headY >= groundY - 4) {
      this.crashed = true;
      if (this.onCrash) this.onCrash('DRIVER DOWN');
    }
  }

  checkCollectibles() {
    const minX = this.x - 45;
    const maxX = this.x + 45;

    // Coins
    for (const coin of this.terrain.coinGroups) {
      if (!coin.collected && coin.x >= minX && coin.x <= maxX) {
        const dy = coin.y - this.y;
        if (Math.abs(dy) < 45) {
          coin.collected = true;
          this.score += coin.value;
          if (this.onCoin) this.onCoin(coin.value, coin.x, coin.y);
        }
      }
    }

    // Fuel Cans
    for (const fuelCan of this.terrain.fuelCans) {
      if (!fuelCan.collected && fuelCan.x >= minX && fuelCan.x <= maxX) {
        const dy = fuelCan.y - this.y;
        if (Math.abs(dy) < 45) {
          fuelCan.collected = true;
          this.fuel = 100.0;
          this.outOfFuel = false;
          this.score += 250;
          if (this.onFuel) this.onFuel(fuelCan.x, fuelCan.y);
        }
      }
    }
  }

  updateCrashed(dt) {
    // Tumble to a stop
    this.vy += this.gravity * dt;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.angularVelocity *= 0.94;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angularVelocity * dt;

    const groundY = this.terrain.getHeight(this.x);
    if (this.y > groundY - 10) {
      this.y = groundY - 10;
      this.vy = 0;
      this.vx *= 0.8;
    }
  }
}

window.VehiclePhysics = VehiclePhysics;
