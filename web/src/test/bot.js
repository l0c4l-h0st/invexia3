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
    // comportement humain : une touche de strafe est tenue au moins `minHold` secondes
    this.minHold = opts.minHold ?? 0.18;
    this.side = 1; this.sideT = 0; this.switches = 0;
  }

  target(p) {
    if (!this.route.length) return null;
    let t = this.route[this.wp];
    for (let guard = 0; guard < 4; guard++) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      const n = this.route[this.wp + 1];
      // point atteint, ou dépassé (on est déjà au-delà dans la direction du point suivant)
      const passed = n && ((p.x - t.x) * (n.x - t.x) + (p.z - t.z) * (n.z - t.z)) > 0 && d < 90;
      if (d < (t.reach ?? this.reach) || passed) {
        if (this.wp < this.route.length - 1) this.wp++;
        else if (this.loop) this.wp = 0;
        else break;
        t = this.route[this.wp];
      } else break;
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
    // dans un couloir en U : ne pas pousser contre les berges, se laisser revenir au fond
    if (pl.surfing && t && t.nopush) {
      this.turnTo(goalH, dt);
      inp.yaw = this.yaw;
      return inp;
    }
    // en surf : rester plaqué contre la rampe (strafe vers la pente)
    if (pl.surfing) {
      const n = pl.surfN;
      const into = headingOf(-n.x, -n.z); // direction vers la rampe
      const side = wrap(into - velH) > 0 ? 1 : -1; // 1 = rampe à gauche
      this.surfSide = side;
      // regarde le long de la vitesse, légèrement vers la cible
      const look = velH + Math.max(-0.45, Math.min(0.45, err));
      this.turnTo(look, dt);
      inp.yaw = this.yaw;
      // dosage : on relâche la poussée quand on remonte la face (sinon on passe le faîte)
      const push = pl.vel.y < 2.0;
      if (push) { if (side > 0) inp.left = true; else inp.right = true; }
      return inp;
    }
    this.sideT += dt;
    // contrôle « tout ou rien » avec hystérésis : on change de côté quand on a dépassé le cap visé
    let want = this.side;
    if (Math.abs(err) > 0.35) want = err > 0 ? 1 : -1;
    else if (this.side > 0 && err < -0.06) want = -1;
    else if (this.side < 0 && err > 0.06) want = 1;
    if (want !== this.side && this.sideT >= this.minHold) { this.side = want; this.sideT = 0; this.switches++; }
    const side = this.side;
    if (hs > this.cruise && Math.abs(err) < 0.1) {
      // vitesse de croisière atteinte : on suit simplement la trajectoire
      this.turnTo(velH + err, dt);
      inp.yaw = this.yaw;
      return inp;
    }
    // dosage humain : la vitesse ne tourne pas plus vite que ~125°/s en ligne droite (~230°/s en virage)
    const w = PHYS.airWishCap, aMax = Math.min(w, PHYS.airAccel * PHYS.airRefSpeed * dt);
    const velTurn = Math.abs(err) > 0.35 ? 4.0 : 2.2;
    const a = Math.min(aMax, Math.max(0.05, hs * velTurn * dt));
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
