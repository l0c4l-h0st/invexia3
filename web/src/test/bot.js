// Pilote automatique de test : il n'utilise QUE les commandes d'un joueur
// (touches + rotation de la souris à vitesse angulaire bornée).
import { PHYS, TICK } from '../core/config.js';

export function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
export function headingOf(x, z) { return Math.atan2(-x, -z); }

export class Bot {
  constructor(opts = {}) {
    this.maxTurn = (opts.maxTurnDeg ?? 360) * Math.PI / 180; // rad/s
    this.route = opts.route || [];
    this.wp = 0;
    this.loop = !!opts.loop;
    this.altT = 0; this.altSide = 1;
    this.yaw = opts.yaw ?? 0;
    this.pitch = 0;
    this.mode = opts.mode || 'route';
    this.brake = false;
    this.cruise = opts.cruise ?? Infinity; // vitesse visée (au-delà : pas de strafe)
    this.reach = opts.reach ?? 40;
    this.maxYawRate = 0;
    this.surfSide = 0;
  }

  target(p) {
    if (!this.route.length) return null;
    let t = this.route[this.wp];
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d < (t.reach ?? this.reach)) {
      if (this.wp < this.route.length - 1) this.wp++;
      else if (this.loop) this.wp = 0;
      t = this.route[this.wp];
    }
    return t;
  }

  turnTo(goal, dt) {
    const d = wrap(goal - this.yaw);
    const m = this.maxTurn * dt;
    const s = Math.max(-m, Math.min(m, d));
    this.yaw = wrap(this.yaw + s);
    this.maxYawRate = Math.max(this.maxYawRate, Math.abs(s) / dt);
  }

  /** Produit l'entrée du prochain tick. */
  input(pl, dt = TICK) {
    const inp = { fwd: false, back: false, left: false, right: false, jump: true, sprint: true, brake: this.brake, slide: false, slidePressed: false, yaw: this.yaw, pitch: 0 };
    const v = pl.vel, hs = Math.hypot(v.x, v.z);
    const t = this.target(pl.pos);
    const goalH = t ? headingOf(t.x - pl.pos.x, t.z - pl.pos.z) : this.yaw;
    const velH = hs > 0.5 ? headingOf(v.x, v.z) : goalH;
    if (this.brake) { inp.jump = false; this.turnTo(goalH, dt); inp.yaw = this.yaw; return inp; }

    if (pl.onGround || hs < 4) {
      // au sol : vise la cible, avance si lent ; Espace maintenu = rebond auto
      this.turnTo(goalH, dt);
      inp.fwd = hs < 7.5;
      inp.jump = hs > 6.5 || !pl.onGround;
      inp.yaw = this.yaw;
      return inp;
    }
    let err = wrap(goalH - velH);
    // en surf : rester plaqué contre la rampe (strafe vers la pente)
    if (pl.surfing) {
      const n = pl.surfN;
      const into = headingOf(-n.x, -n.z); // direction vers la rampe
      const side = wrap(into - velH) > 0 ? 1 : -1; // 1 = rampe à gauche
      this.surfSide = side;
      // regarde le long de la vitesse, légèrement vers la cible
      const look = velH + Math.max(-0.25, Math.min(0.25, err));
      this.turnTo(look, dt);
      inp.yaw = this.yaw;
      if (side > 0) inp.left = true; else inp.right = true;
      return inp;
    }
    let side;
    if (Math.abs(err) > 0.06) side = err > 0 ? 1 : -1;
    else {
      this.altT += dt;
      if (this.altT > 0.32) { this.altT = 0; this.altSide = -this.altSide; }
      side = this.altSide;
    }
    if (hs > this.cruise && Math.abs(err) < 0.1) {
      // vitesse de croisière atteinte : on suit simplement la trajectoire
      this.turnTo(velH + err, dt);
      inp.yaw = this.yaw;
      return inp;
    }
    const w = PHYS.airWishCap, a = PHYS.airAccel * PHYS.airRefSpeed * dt;
    const c = Math.max(-1, Math.min(1, (w - a) / Math.max(hs, 0.01)));
    const theta = Math.acos(c);
    const wishH = velH + side * theta;
    // A (gauche) : wish = yaw + 90° ; D (droite) : wish = yaw − 90°
    const goal = side > 0 ? wishH - Math.PI / 2 : wishH + Math.PI / 2;
    this.turnTo(goal, dt);
    inp.yaw = this.yaw;
    if (side > 0) inp.left = true; else inp.right = true;
    return inp;
  }
}
