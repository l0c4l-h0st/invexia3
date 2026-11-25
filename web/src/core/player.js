// Déplacement du joueur : modèle Source/Quake (friction, accélération sol,
// accélération en l'air plafonnée → strafe, surf sur pentes > 45,6°),
// plus glissade, plongeon et frein volontaire.
import { PHYS } from './config.js';
import { GEO, inBasin } from './geo.js';

const OVERCLIP = 1.001;
const MAX_PLANES = 6;

function clipVel(v, nx, ny, nz, over) {
  let back = v.x * nx + v.y * ny + v.z * nz;
  back = back < 0 ? back * over : back / over;
  v.x -= nx * back; v.y -= ny * back; v.z -= nz * back;
}

export class Player {
  constructor(col) {
    this.col = col;
    this.r = PHYS.radius;
    this.pos = { x: 0, y: 0, z: 0 };
    this.prev = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.gn = { x: 0, y: 1, z: 0 };
    this.gmat = 'concrete';
    this.surfing = false; this.surfN = { x: 0, y: 1, z: 0 }; this.surfTime = 0;
    this.slideT = 0; this.sliding = false;
    this.diving = false; this.diveCd = 0;
    this.braking = false; this.sprinting = false; this.wading = false;
    this.airTime = 0; this.groundTime = 0;
    this.events = [];
    this.stepDist = 0; this.stride = 1.7; this.stepSide = 1;
    this.lastSafe = { x: 0, y: 0, z: 0, yaw: 0 }; this.safeT = 0;
    this.stats = { jumps: 0, bhops: 0, chain: 0, maxChain: 0, distance: 0, topSpeed: 0, ticks: 0, wallHits: 0, respawns: 0 };
    this.tr = {};
    this.planes = [];
    for (let i = 0; i < MAX_PLANES + 2; i++) this.planes.push({ x: 0, y: 0, z: 0 });
    this.lastImpact = 0;
    this.eye = PHYS.eyeHeight;
  }

  spawn(x, y, z, yaw) {
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
    this.prev.x = x; this.prev.y = y; this.prev.z = z;
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.yaw = yaw; this.pitch = 0;
    this.slideT = 0; this.diving = false;
    this.lastSafe = { x, y, z, yaw };
  }

  get hspeed() { return Math.hypot(this.vel.x, this.vel.z); }
  get speed() { return Math.hypot(this.vel.x, this.vel.y, this.vel.z); }

  trace(sx, sy, sz, ex, ey, ez) { return this.col.trace(sx, sy, sz, ex, ey, ez, this.r, this.tr); }

  groundTrace() {
    const p = this.pos;
    const tr = this.trace(p.x, p.y, p.z, p.x, p.y - 0.09, p.z);
    if (tr.fraction >= 1) { this.onGround = false; return; }
    if (tr.ny < PHYS.minWalkNormal) {
      this.onGround = false;
      if (tr.ny > 0.02) { this.surfContact = true; this.surfN.x = tr.nx; this.surfN.y = tr.ny; this.surfN.z = tr.nz; }
      return;
    }
    const v = this.vel;
    if (v.y > 0 && v.x * tr.nx + v.y * tr.ny + v.z * tr.nz > 0.25) { this.onGround = false; return; }
    this.onGround = true;
    this.gn.x = tr.nx; this.gn.y = tr.ny; this.gn.z = tr.nz;
    this.gmat = tr.mat || 'concrete';
    p.y = tr.ey; // colle au sol
  }

  /** Un pas de simulation. inp : {fwd,back,left,right,jump,sprint,brake,slide,slidePressed,yaw,pitch} */
  tick(inp, dt) {
    const P = PHYS, v = this.vel, p = this.pos;
    this.prev.x = p.x; this.prev.y = p.y; this.prev.z = p.z;
    this.yaw = inp.yaw; this.pitch = inp.pitch;
    this.surfContact = false;
    this.col.depenetrate(p, this.r);
    const wasGround = this.onGround;
    this.groundTrace();

    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    const mf = (inp.fwd ? 1 : 0) - (inp.back ? 1 : 0);
    const ms = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let wx = fx * mf + rx * ms, wz = fz * mf + rz * ms;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    this.wishX = wx; this.wishZ = wz;
    this.braking = !!inp.brake;
    this.wading = inBasin(p.x, p.z, 2) && p.y - this.r < GEO.waterY + 0.3;
    this.diveCd -= dt;

    // Glissade / plongeon (C)
    if (inp.slidePressed) {
      if (this.onGround && this.slideT <= 0 && this.hspeed > P.slideMinSpeed) this.startSlide();
      else if (!this.onGround && !this.diving && this.diveCd <= 0) this.startDive(fx, fz);
    }
    // Saut (maintenir Espace = bunny hop automatique au contact du sol)
    if (this.onGround && (inp.jump || inp.jumpPressed)) this.jump();

    this.sprinting = !!inp.sprint && mf > 0 && this.onGround && this.slideT <= 0;
    const vyBefore = v.y;
    if (this.onGround) this.groundMove(inp, wx, wz, wl > 0, dt);
    else this.airMove(inp, wx, wz, wl > 0, dt);

    // Catégorisation finale
    const airVy = vyBefore;
    this.groundTrace();
    if (this.onGround) {
      if (!wasGround) this.onLand(-airVy);
      this.groundTime += dt; this.airTime = 0;
    } else {
      this.airTime += dt; this.groundTime = 0;
      if (this.slideT > 0 && this.airTime > 0.15) this.slideT = 0;
    }
    this.surfing = this.surfContact && !this.onGround;
    if (this.surfing) this.surfTime += dt; else this.surfTime = 0;

    // Limite technique
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp > P.maxSpeed) { const k = P.maxSpeed / sp; v.x *= k; v.y *= k; v.z *= k; }
    // Limite du monde (crêtes) : mur doux
    const R = Math.hypot(p.x, p.z);
    if (R > GEO.boundary) {
      const nx = p.x / R, nz = p.z / R;
      p.x = nx * GEO.boundary; p.z = nz * GEO.boundary;
      const out = v.x * nx + v.z * nz;
      if (out > 0) { v.x -= nx * out * 1.3; v.z -= nz * out * 1.3; }
    }
    // Chute hors du monde ou état numérique invalide
    if (p.y < -80 || !Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z)) this.respawnSafe();
    // Dernière position sûre
    this.safeT += dt;
    if (this.onGround && !this.wading && this.safeT > 1) {
      this.safeT = 0;
      this.lastSafe = { x: p.x, y: p.y + 0.2, z: p.z, yaw: this.yaw };
    }
    // Statistiques
    const hs = Math.hypot(v.x, v.z);
    this.stats.distance += Math.hypot(p.x - this.prev.x, p.z - this.prev.z);
    if (sp > this.stats.topSpeed) this.stats.topSpeed = Math.min(sp, P.maxSpeed);
    this.stats.ticks++;
    // Pas
    if (this.onGround && this.slideT <= 0 && hs > 0.6) {
      this.stride = Math.min(2.5, 1.45 + hs * 0.085);
      this.stepDist += Math.hypot(p.x - this.prev.x, p.z - this.prev.z);
      if (this.stepDist >= this.stride) {
        this.stepDist -= this.stride;
        this.stepSide = -this.stepSide;
        this.events.push({ type: 'step', mat: this.wading ? 'water' : this.gmat, speed: hs, side: this.stepSide, sprint: this.sprinting });
      }
    } else if (!this.onGround) {
      // garde la phase pour une reprise fluide
    }
    if (this.groundTime > 0.3) this.stats.chain = 0;
    // Hauteur des yeux (glissade)
    const eyeTarget = this.slideT > 0 ? P.slideEye : P.eyeHeight;
    this.eye += (eyeTarget - this.eye) * Math.min(1, dt * 12);
  }

  jump() {
    const v = this.vel;
    const chained = this.groundTime <= 2.5 / 120;
    v.y = Math.max(v.y, 0) + PHYS.jumpVel;
    this.onGround = false;
    this.slideT = 0;
    this.stats.jumps++;
    if (chained && this.stats.jumps > 1) {
      this.stats.bhops++;
      this.stats.chain++;
      if (this.stats.chain > this.stats.maxChain) this.stats.maxChain = this.stats.chain;
    } else this.stats.chain = 0;
    this.events.push({ type: 'jump', chained, speed: this.hspeed, mat: this.gmat });
  }

  startSlide(fromDive = false) {
    const v = this.vel;
    const hs = Math.hypot(v.x, v.z);
    if (!fromDive && hs < PHYS.slideBoostCap) {
      const k = Math.min(hs + PHYS.slideBoost, PHYS.slideBoostCap) / Math.max(0.01, hs);
      v.x *= k; v.z *= k;
    }
    this.slideT = PHYS.slideTime;
    this.events.push({ type: 'slide', speed: hs, mat: this.gmat });
  }

  startDive(fx, fz) {
    const v = this.vel;
    const hs = Math.hypot(v.x, v.z);
    const imp = hs < 15 ? PHYS.diveForward : 1.5;
    v.x += fx * imp; v.z += fz * imp;
    v.y = Math.min(v.y, 1.5) - PHYS.diveDown;
    this.diving = true;
    this.diveCd = PHYS.diveCooldown;
    this.events.push({ type: 'dive', speed: hs });
  }

  onLand(impact) {
    this.lastImpact = impact;
    const dive = this.diving;
    if (this.diving) { this.diving = false; this.startSlide(true); }
    this.events.push({ type: 'land', impact, mat: this.wading ? 'water' : this.gmat, dive, speed: this.hspeed });
  }

  respawnSafe() {
    const s = this.lastSafe;
    this.spawn(s.x, s.y, s.z, s.yaw);
    this.stats.respawns++;
    this.events.push({ type: 'respawn' });
  }

  friction(f, dt) {
    const v = this.vel;
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed < 0.02) { v.x = 0; v.z = 0; return; }
    const control = speed < PHYS.stopSpeed ? PHYS.stopSpeed : speed;
    let drop = Math.min(control * f, PHYS.frictionMaxDecel) * dt;
    if (this.braking) drop += Math.min(PHYS.brakeGroundMax, PHYS.brakeGround + PHYS.brakeGroundK * speed) * dt;
    const ns = Math.max(0, speed - drop);
    const k = ns / speed;
    v.x *= k; v.y *= k; v.z *= k;
  }

  accelerate(wx, wz, wishspeed, accel, dt) {
    const v = this.vel;
    const cur = v.x * wx + v.z * wz;
    const add = wishspeed - cur;
    if (add <= 0) return;
    let as = accel * wishspeed * dt;
    if (as > add) as = add;
    v.x += as * wx; v.z += as * wz;
  }

  groundMove(inp, wx, wz, hasWish, dt) {
    const P = PHYS, v = this.vel;
    const sliding = this.slideT > 0;
    let f = sliding ? P.slideFriction : P.friction;
    if (this.wading) f *= 2.2;
    this.friction(f, dt);
    let wish = this.sprinting ? P.sprintSpeed : P.walkSpeed;
    if (this.wading) wish *= 0.7;
    if (sliding) wish *= 0.25;
    if (this.braking) wish *= 0.35;
    if (hasWish) {
      // projette la direction voulue sur le plan du sol
      const n = this.gn;
      const d = wx * n.x + wz * n.z;
      let ax = wx - n.x * d, ay = -n.y * d, az = wz - n.z * d;
      const l = Math.hypot(ax, ay, az) || 1;
      ax /= l; ay /= l; az /= l;
      const cur = v.x * ax + v.y * ay + v.z * az;
      const add = wish - cur;
      if (add > 0) {
        let as = P.groundAccel * wish * dt;
        if (as > add) as = add;
        v.x += as * ax; v.y += as * ay; v.z += as * az;
      }
    }
    if (sliding) {
      // la gravité tire le long de la pente : la glissade accélère en descente
      const n = this.gn, g = P.gravity;
      v.x += g * n.y * n.x * dt; v.y += (-g + g * n.y * n.y) * dt; v.z += g * n.y * n.z * dt;
      this.slideT -= dt;
      const downhill = v.x * n.x + v.z * n.z > 0 && (n.y < 0.995);
      if (this.slideT <= 0 && inp.slide && downhill && this.hspeed > 6) this.slideT = 0.05; // luge en descente
      if (this.hspeed < 2.5) this.slideT = 0;
    }
    const sp = Math.hypot(v.x, v.y, v.z);
    clipVel(v, this.gn.x, this.gn.y, this.gn.z, OVERCLIP);
    const sp2 = Math.hypot(v.x, v.y, v.z);
    if (sp2 > 1e-6) { const k = sp / sp2; v.x *= k; v.y *= k; v.z *= k; }
    if (Math.abs(v.x) < 1e-6 && Math.abs(v.z) < 1e-6) return;
    this.stepSlideMove(dt);
  }

  airMove(inp, wx, wz, hasWish, dt) {
    const P = PHYS, v = this.vel;
    if (hasWish) {
      // accélération en l'air plafonnée : seul un strafe synchronisé avec la souris fait gagner de la vitesse
      const cur = v.x * wx + v.z * wz;
      const add = P.airWishCap - cur;
      if (add > 0) {
        let as = P.airAccel * P.airRefSpeed * dt;
        if (as > add) as = add;
        v.x += as * wx; v.z += as * wz;
      }
    }
    if (this.braking) {
      const hs = Math.hypot(v.x, v.z);
      if (hs > 0.01) {
        const ns = Math.max(0, hs - Math.min(P.brakeAirMax, P.brakeAir + P.brakeAirK * hs) * dt);
        v.x *= ns / hs; v.z *= ns / hs;
      }
    }
    v.y -= P.gravity * dt;
    this.slideMove(dt, false);
  }

  /** Q3 PM_SlideMove (sans gravité intégrée). Renvoie vrai si collision. */
  slideMove(dt, grounded) {
    const v = this.vel, p = this.pos, planes = this.planes;
    let np = 0;
    if (grounded) { planes[np].x = this.gn.x; planes[np].y = this.gn.y; planes[np].z = this.gn.z; np++; }
    const sp0 = Math.hypot(v.x, v.y, v.z);
    if (sp0 > 1e-6) { planes[np].x = v.x / sp0; planes[np].y = v.y / sp0; planes[np].z = v.z / sp0; np++; }
    let timeLeft = dt;
    let bumps = 0;
    for (bumps = 0; bumps < 4; bumps++) {
      const tr = this.trace(p.x, p.y, p.z, p.x + v.x * timeLeft, p.y + v.y * timeLeft, p.z + v.z * timeLeft);
      if (tr.fraction > 0) { p.x = tr.ex; p.y = tr.ey; p.z = tr.ez; }
      if (tr.fraction >= 1) break;
      // contact
      const into = -(v.x * tr.nx + v.y * tr.ny + v.z * tr.nz);
      if (tr.ny < PHYS.minWalkNormal && tr.ny > 0.02) { this.surfContact = true; this.surfN.x = tr.nx; this.surfN.y = tr.ny; this.surfN.z = tr.nz; }
      if (tr.ny < 0.3 && into > 6) {
        this.stats.wallHits++;
        this.events.push({ type: 'impact', speed: into, mat: tr.mat || 'concrete' });
      }
      timeLeft -= timeLeft * tr.fraction;
      if (np >= MAX_PLANES) { v.x = v.y = v.z = 0; return true; }
      // même plan qu'avant : petite poussée pour éviter de rester collé
      let same = false;
      for (let i = 0; i < np; i++) {
        if (tr.nx * planes[i].x + tr.ny * planes[i].y + tr.nz * planes[i].z > 0.99) {
          v.x += tr.nx * 0.01; v.y += tr.ny * 0.01; v.z += tr.nz * 0.01;
          same = true; break;
        }
      }
      if (same) continue;
      planes[np].x = tr.nx; planes[np].y = tr.ny; planes[np].z = tr.nz; np++;
      // trouve un plan dans lequel on entre
      let i;
      for (i = 0; i < np; i++) {
        const pi = planes[i];
        const intoI = v.x * pi.x + v.y * pi.y + v.z * pi.z;
        if (intoI >= 0.001) continue;
        const c = { x: v.x, y: v.y, z: v.z };
        clipVel(c, pi.x, pi.y, pi.z, OVERCLIP);
        let ok = true;
        for (let j = 0; j < np; j++) {
          if (j === i) continue;
          const pj = planes[j];
          if (c.x * pj.x + c.y * pj.y + c.z * pj.z >= 0.001) continue;
          clipVel(c, pj.x, pj.y, pj.z, OVERCLIP);
          if (c.x * pi.x + c.y * pi.y + c.z * pi.z >= 0) continue;
          // glisse le long de l'arête
          let dx = pi.y * pj.z - pi.z * pj.y, dy = pi.z * pj.x - pi.x * pj.z, dz = pi.x * pj.y - pi.y * pj.x;
          const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
          const d = dx * v.x + dy * v.y + dz * v.z;
          c.x = dx * d; c.y = dy * d; c.z = dz * d;
          for (let k = 0; k < np; k++) {
            if (k === i || k === j) continue;
            const pk = planes[k];
            if (c.x * pk.x + c.y * pk.y + c.z * pk.z >= 0.001) continue;
            v.x = v.y = v.z = 0; ok = false; break;
          }
          if (!ok) break;
        }
        if (!ok) return true;
        v.x = c.x; v.y = c.y; v.z = c.z;
        break;
      }
    }
    return bumps > 0;
  }

  /** Q3 PM_StepSlideMove : franchit marches et bordures au sol. */
  stepSlideMove(dt) {
    const p = this.pos, v = this.vel;
    const so = { x: p.x, y: p.y, z: p.z }, sv = { x: v.x, y: v.y, z: v.z };
    if (!this.slideMove(dt, true)) return;
    const d1 = Math.hypot(p.x - so.x, p.z - so.z);
    const r1 = { x: p.x, y: p.y, z: p.z }, rv = { x: v.x, y: v.y, z: v.z };
    // essai en montant d'une marche
    let tr = this.trace(so.x, so.y, so.z, so.x, so.y + PHYS.stepHeight, so.z);
    const up = tr.ey - so.y;
    if (up < 0.05) return;
    p.x = tr.ex; p.y = tr.ey; p.z = tr.ez;
    v.x = sv.x; v.y = sv.y; v.z = sv.z;
    this.slideMove(dt, true);
    tr = this.trace(p.x, p.y, p.z, p.x, p.y - up - 0.05, p.z);
    p.x = tr.ex; p.y = tr.ey; p.z = tr.ez;
    const d2 = Math.hypot(p.x - so.x, p.z - so.z);
    const landed = tr.fraction < 1 && tr.ny >= PHYS.minWalkNormal;
    if (!landed || d2 <= d1 + 0.001) {
      p.x = r1.x; p.y = r1.y; p.z = r1.z; v.x = rv.x; v.y = rv.y; v.z = rv.z;
      return;
    }
    if (tr.fraction < 1) clipVel(v, tr.nx, tr.ny, tr.nz, OVERCLIP);
    this.events.push({ type: 'stepup' });
  }
}
