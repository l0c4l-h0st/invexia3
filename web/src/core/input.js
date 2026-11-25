// Entrées clavier/souris. Les touches sont lues par position physique (event.code) :
// ZQSD sur AZERTY et WASD sur QWERTY tombent sur les mêmes touches.
const GAME_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'KeyF', 'KeyH', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyR']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.edges = new Set();
    this.dx = 0; this.dy = 0;
    this.locked = false;
    this.lockSupported = 'requestPointerLock' in canvas;
    this.dragLook = false; // repli si le verrouillage du pointeur est refusé
    this.dragging = false;
    this.enabled = false;
    this.lastLockError = null;
    this.onLockChange = () => {};
    this.onEscape = () => {};

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { if (this.locked) this.unlock(); this.onEscape(); return; }
      if (!this.enabled) return;
      if (GAME_CODES.has(e.code) || e.ctrlKey) { e.preventDefault(); }
      if (!e.repeat) this.edges.add(e.code);
      this.keys.add(e.code);
    }, { capture: true });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (this.enabled && GAME_CODES.has(e.code)) e.preventDefault(); }, { capture: true });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || (this.dragLook && this.dragging)) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; }
    });
    canvas.addEventListener('mousedown', () => { if (this.dragLook) this.dragging = true; });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.lastLockError = 'error'; });
  }

  /** Demande le verrouillage du pointeur (doit être appelé dans un geste utilisateur). */
  async lock() {
    if (!this.lockSupported) { this.dragLook = true; return false; }
    try {
      const r = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (r && r.then) await r;
      return true;
    } catch (e) {
      try {
        const r2 = this.canvas.requestPointerLock();
        if (r2 && r2.then) await r2;
        return true;
      } catch (e2) {
        this.lastLockError = String(e2 && e2.name || e2);
        return false;
      }
    }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(...codes) { return codes.some((c) => this.keys.has(c)); }
  pressed(code) { if (this.edges.has(code)) { this.edges.delete(code); return true; } return false; }
  clearEdges() { this.edges.clear(); }
  takeMouse() { const r = [this.dx, this.dy]; this.dx = 0; this.dy = 0; return r; }

  state() {
    return {
      fwd: this.down('KeyW', 'ArrowUp'),
      back: this.down('KeyS', 'ArrowDown'),
      left: this.down('KeyA', 'ArrowLeft'),
      right: this.down('KeyD', 'ArrowRight'),
      jump: this.down('Space'),
      sprint: this.down('ShiftLeft', 'ShiftRight'),
      brake: this.down('ControlLeft', 'ControlRight'),
      slide: this.down('KeyC'),
    };
  }
}
