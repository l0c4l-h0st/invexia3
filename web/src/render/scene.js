// Rendu du monde : ciel, brume, terrain en tuiles (2 niveaux de détail),
// chargement progressif des zones, conteneurs instanciés, fumées et lumières.
import * as THREE from 'three';
import { GEO, dockWorld } from '../core/geo.js';
import { Bucket, CHUNK } from '../world/builder.js';
import { makeTextures, signTexture } from './textures.js';
import { fbm2 } from '../core/noise.js';

export const SUN_DIR = new THREE.Vector3(-0.86, 0.2, 0.36).normalize(); // ouest-sud-ouest, bas sur l'horizon
const FOG_COLOR = new THREE.Color(0x8a6f63);
const FOG_DENSITY = 0.00034;

/**
 * Niveaux de qualité. Tout s'applique en direct, sauf le lissage (aa), qui
 * dépend du contexte WebGL et ne change qu'au prochain chargement.
 * pr : plafond de densité de pixels · view : portée du chargement progressif
 * fog : épaisseur de la brume (masque la portée réduite) · lod : distance du terrain détaillé.
 */
export const QUALITY = {
  min: { label: 'Très basse', pr: 0.6, aa: false, shadows: 0, view: 0.7, fog: 1.45, particles: 120, lod: 750, flames: false },
  low: { label: 'Basse', pr: 0.75, aa: false, shadows: 0, view: 0.85, fog: 1.15, particles: 320, lod: 1000, flames: true },
  medium: { label: 'Moyenne', pr: 1, aa: true, shadows: 1024, view: 1, fog: 1, particles: 700, lod: 1300, flames: true },
  high: { label: 'Haute', pr: 1.5, aa: true, shadows: 2048, view: 1.15, fog: 1, particles: 700, lod: 1600, flames: true },
};
export const QUALITY_ORDER = ['min', 'low', 'medium', 'high'];

export class WorldRenderer {
  constructor(canvas, quality) {
    if (!QUALITY[quality]) quality = 'medium';
    this.quality = quality;
    this.Q = QUALITY[quality];
    this.aa = this.Q.aa;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.aa, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = this.Q.shadows > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pixelRatioCap = this.Q.pr;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY * this.Q.fog);
    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.3, 12000);
    this.tex = makeTextures(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.time = 0;
    this._sky();
    this._lights();
    this._materials();
    this.stream = { loads: 0, unloads: 0, misses: 0, lateMs: 0, buildMs: 0, maxBuildMs: 0, loaded: 0 };
  }

  resize(w, h, scale = 1) {
    this._size = [w, h, scale];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap) * scale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _sky() {
    const geo = new THREE.SphereGeometry(10000, 48, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 sunDir; uniform float time;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec3 d = normalize(vDir);
          float e = d.y;
          vec3 zen = vec3(0.13,0.16,0.22), mid = vec3(0.42,0.35,0.37), hor = vec3(0.93,0.60,0.37), low = vec3(0.38,0.30,0.27);
          vec3 c = e > 0.0 ? mix(hor, mid, smoothstep(0.0, 0.18, e)) : mix(hor, low, smoothstep(0.0,-0.08,e));
          c = e > 0.18 ? mix(mid, zen, smoothstep(0.18, 0.75, e)) : c;
          float s = max(dot(d, sunDir), 0.0);
          c += vec3(1.0,0.62,0.30) * pow(s, 6.0) * 0.55 + vec3(1.0,0.85,0.6) * pow(s, 64.0) * 0.9 + vec3(1.0,0.95,0.85) * smoothstep(0.9993,0.9997,s) * 4.0;
          // bancs de nuages bas
          vec2 uv = d.xz / max(0.08, d.y + 0.12) * 1.6;
          float cl = n(uv + vec2(time*0.004,0.0)) * 0.6 + n(uv*2.7) * 0.4;
          cl = smoothstep(0.55, 0.85, cl) * smoothstep(0.0, 0.08, e) * (1.0 - smoothstep(0.25, 0.5, e));
          c = mix(c, vec3(0.55,0.40,0.38) + vec3(0.6,0.35,0.15) * pow(s,3.0), cl * 0.55);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    // environnement (reflets des métaux) à partir du ciel
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(geo, mat));
    this.envTex = pm.fromScene(envScene, 0.02, 1, 20000).texture;
    this.scene.environment = this.envTex;
    pm.dispose();
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0xcdb9ac, 0x40342d, 0.95);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffc48c, 2.7);
    this.sun.position.copy(SUN_DIR).multiplyScalar(400);
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    const s = this.sun.shadow;
    const ms = this.Q.shadows || 1024;
    s.mapSize.set(ms, ms);
    s.camera.left = -110; s.camera.right = 110; s.camera.top = 110; s.camera.bottom = -110;
    s.camera.near = 10; s.camera.far = 1200;
    s.bias = -0.0006; s.normalBias = 0.6;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  _materials() {
    const T = this.tex;
    const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
    this.mats = {
      concrete: std({ map: T.concrete, roughness: 0.92, metalness: 0 }),
      concreteDark: std({ map: T.concreteDark, roughness: 0.95, metalness: 0 }),
      steel: std({ map: T.steel, roughness: 0.55, metalness: 0.55, envMapIntensity: 0.7 }),
      rust: std({ map: T.rust, roughness: 0.85, metalness: 0.25 }),
      orange: std({ map: T.orange, roughness: 0.48, metalness: 0.15, envMapIntensity: 0.8 }),
      orangePlain: std({ map: T.orangePlain, roughness: 0.6, metalness: 0.2 }),
      deck: std({ map: T.deck, roughness: 0.82, metalness: 0 }),
      grating: std({ map: T.grating, roughness: 0.6, metalness: 0.6 }),
      brick: std({ map: T.brick, roughness: 0.9, metalness: 0 }),
      shed: std({ map: T.shed, roughness: 0.7, metalness: 0.35 }),
      container: std({ map: T.container, roughness: 0.65, metalness: 0.3 }),
      hull: std({ map: T.hull, roughness: 0.6, metalness: 0.35 }),
      glass: std({ color: 0x20262c, roughness: 0.1, metalness: 0.8 }),
      cable: std({ color: 0x141414, roughness: 0.8 }),
    };
    this.mats.concrete.polygonOffset = false;
    for (const m of Object.values(this.mats)) m.side = THREE.FrontSide;
  }

  // ---------------- terrain ----------------
  buildTerrain(terrain, roads = []) {
    const segs = [];
    for (const r of roads) for (let i = 0; i < r.length - 1; i++) segs.push([r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]]);
    const roadDist = (x, z) => {
      let best = 1e9;
      for (const [ax, az, bx, bz] of segs) {
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        let t = ((x - ax) * dx + (z - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        if (d < best) best = d;
      }
      return best;
    };
    const T = terrain, n = T.n, cell = T.cell;
    const tileCells = 48, tiles = Math.floor((n - 1) / tileCells);
    const mat = new THREE.MeshStandardMaterial({ map: this.tex.ground, vertexColors: true, roughness: 0.96, metalness: 0 });
    this.terrainMat = mat;
    this.tiles = [];
    const colorAt = (x, z, h, ny) => {
      const v = fbm2(x * 0.004, z * 0.004, 3);
      const w = fbm2(x * 0.02 + 5, z * 0.02 - 3, 2);
      let r = 0.55 + v * 0.12, g = 0.5 + v * 0.1, b = 0.46 + v * 0.08;
      // rouille / ocre sur les zones plates, sombre sur les pentes
      const rust = Math.max(0, w) * 0.35;
      r += rust * 0.5; g += rust * 0.12;
      const dark = Math.min(1, (1 - ny) * 2.5);
      r *= 1 - dark * 0.35; g *= 1 - dark * 0.38; b *= 1 - dark * 0.36;
      // plaques de laitier noir / poussière ocre à grande échelle
      const big = fbm2(x * 0.0012 + 40, z * 0.0012 - 13, 3);
      if (big > 0.12) { const k = Math.min(1, (big - 0.12) * 4); r = r * (1 - k) + 0.3 * k; g = g * (1 - k) + 0.28 * k; b = b * (1 - k) + 0.27 * k; }
      else if (big < -0.15) { const k = Math.min(1, (-0.15 - big) * 4); r = r * (1 - k) + 0.78 * k; g = g * (1 - k) + 0.6 * k; b = b * (1 - k) + 0.44 * k; }
      if (h < 0.4) { r *= 0.55; g *= 0.55; b *= 0.6; }
      if (Math.hypot(x, z) < GEO.terril.radius) { r *= 0.62; g *= 0.6; b *= 0.6; }
      // anciens chemins de service (repères au sol)
      const rd = roadDist(x, z);
      if (rd < 14) { const k = 1 - rd / 14; r = r * (1 - k * 0.7) + 0.74 * k * 0.7; g = g * (1 - k * 0.7) + 0.68 * k * 0.7; b = b * (1 - k * 0.7) + 0.6 * k * 0.7; }
      return [r, g, b];
    };
    for (let tj = 0; tj < tiles; tj++) for (let ti = 0; ti < tiles; ti++) {
      const lods = [];
      for (const step of [1, 4]) {
        const m = tileCells / step + 1;
        const pos = [], nor = [], col = [], uv = [], idx = [];
        for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
          const gi = ti * tileCells + i * step, gj = tj * tileCells + j * step;
          const x = T.origin + gi * cell, z = T.origin + gj * cell;
          const h = T.h[gj * n + gi];
          const hl = T.h[gj * n + Math.max(0, gi - step)], hr = T.h[gj * n + Math.min(n - 1, gi + step)];
          const hd = T.h[Math.max(0, gj - step) * n + gi], hu = T.h[Math.min(n - 1, gj + step) * n + gi];
          const nx = (hl - hr) / (2 * cell * step), nz = (hd - hu) / (2 * cell * step);
          const l = Math.hypot(nx, 1, nz);
          pos.push(x, h, z); nor.push(nx / l, 1 / l, nz / l); uv.push(x / 14, z / 14);
          col.push(...colorAt(x, z, h, 1 / l));
        }
        for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) {
          const a = j * m + i, b = a + 1, c = a + m + 1, d = a + m;
          idx.push(a, c, b, a, d, c);
        }
        // jupes (masquent les fissures entre niveaux de détail)
        if (step > 1) {
          const base = pos.length / 3;
          const edges = [];
          for (let i = 0; i < m; i++) edges.push(i, (m - 1) * m + i, i * m, i * m + m - 1);
          let k = 0;
          const ring = [];
          for (let i = 0; i < m; i++) ring.push(i);
          for (let j = 1; j < m; j++) ring.push(j * m + m - 1);
          for (let i = m - 2; i >= 0; i--) ring.push((m - 1) * m + i);
          for (let j = m - 2; j > 0; j--) ring.push(j * m);
          for (const v of ring) { pos.push(pos[v * 3], pos[v * 3 + 1] - 40, pos[v * 3 + 2]); nor.push(0, 1, 0); uv.push(uv[v * 2], uv[v * 2 + 1]); col.push(col[v * 3] * 0.6, col[v * 3 + 1] * 0.6, col[v * 3 + 2] * 0.6); k++; }
          for (let r = 0; r < ring.length; r++) {
            const a = ring[r], b = ring[(r + 1) % ring.length], a2 = base + r, b2 = base + (r + 1) % ring.length;
            idx.push(a, b, b2, a, b2, a2, a, b2, b, a, a2, b2);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, mat);
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        lods.push(mesh);
        this.scene.add(mesh);
      }
      const cx = T.origin + (ti + 0.5) * tileCells * cell, cz = T.origin + (tj + 0.5) * tileCells * cell;
      this.tiles.push({ cx, cz, lods });
    }
    this._water();
  }

  _water() {
    const D = GEO.docks;
    const g = new THREE.PlaneGeometry(D.len + 8, D.wid + 8, 1, 1);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1f2a2c, roughness: 0.08, metalness: 0.2, normalMap: this.tex.waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.9, envMapIntensity: 1.2 });
    this.tex.waterNormal.repeat.set(D.len / 30, D.wid / 30);
    const m = new THREE.Mesh(g, mat);
    m.position.set(D.cx, GEO.waterY, D.cz);
    m.rotation.y = Math.atan2(D.bx, D.bz);
    this.scene.add(m);
    this.water = m;
  }

  // ---------------- monde construit ----------------
  attachWorld(builder) {
    this.builder = builder;
    this.chunkList = [...builder.chunks.values()];
    // chunk permanent
    this._buildChunk(builder.always, true);
    this._instances(builder.instances);
    this._fx(builder.fx);
    this._signs(builder.signs);
  }

  _buildChunk(c, isAlways = false) {
    const t0 = performance.now();
    const buckets = new Map();
    const emit = (m) => { let b = buckets.get(m); if (!b) { b = new Bucket(); buckets.set(m, b); } return b; };
    for (const j of c.jobs) j(emit);
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    let tris = 0;
    for (const [m, b] of buckets) {
      if (!b.count) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.mats[m] || this.mats.concrete);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      tris += b.count / 3;
    }
    this.scene.add(group);
    c.group = group; c.loaded = true; c.tris = tris;
    const ms = performance.now() - t0;
    if (!isAlways) { this.stream.loads++; this.stream.buildMs += ms; this.stream.maxBuildMs = Math.max(this.stream.maxBuildMs, ms); }
    return ms;
  }

  _unloadChunk(c) {
    if (!c.group) return;
    this.scene.remove(c.group);
    for (const m of c.group.children) m.geometry.dispose();
    c.group = null; c.loaded = false;
    this.stream.unloads++;
  }

  /** Chargement progressif autour du joueur et dans la direction de sa vitesse. */
  updateStreaming(pos, vel, budgetMs = 6, force = false) {
    const sp = Math.hypot(vel.x, vel.z);
    const L = (1500 + Math.min(1600, sp * 5)) * this.Q.view;
    const px = pos.x + vel.x * 4, pz = pos.z + vel.z * 4;
    let want = [];
    for (const c of this.chunkList) {
      const d = Math.min(Math.hypot(c.cx - pos.x, c.cz - pos.z), Math.hypot(c.cx - px, c.cz - pz));
      c._d = d;
      if (!c.loaded && d < L) want.push(c);
      else if (c.loaded && d > L + 700) this._unloadChunk(c);
    }
    want.sort((a, b) => a._d - b._d);
    const t0 = performance.now();
    for (const c of want) {
      if (!force && performance.now() - t0 > budgetMs) break;
      this._buildChunk(c);
    }
    // contrôle « décor à temps » : la zone du joueur et ses voisines immédiates doivent être prêtes
    const ix = Math.floor(pos.x / CHUNK), iz = Math.floor(pos.z / CHUNK);
    let missing = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const c = this.builder.chunks.get(ix + a + ',' + (iz + b));
      if (c && !c.loaded) {
        // une zone voisine compte seulement si le joueur est à moins de 250 m de son bord
        const minx = (ix + a) * CHUNK, minz = (iz + b) * CHUNK;
        const dx = Math.max(minx - pos.x, 0, pos.x - (minx + CHUNK)), dz = Math.max(minz - pos.z, 0, pos.z - (minz + CHUNK));
        if (Math.hypot(dx, dz) < 250) missing++;
      }
    }
    if (this.stream.grace > 0) this.stream.grace--; else if (missing) this.stream.misses++;
    this.stream.loaded = this.chunkList.filter((c) => c.loaded).length;
    // niveaux de détail du terrain
    for (const t of this.tiles) {
      const d = Math.hypot(t.cx - pos.x, t.cz - pos.z);
      const near = d < this.Q.lod;
      t.lods[0].visible = near; t.lods[1].visible = !near;
    }
  }

  _instances(list) {
    const cont = list.filter((i) => i.type === 'container');
    if (!cont.length) return;
    const g = new THREE.BoxGeometry(2.44, 2.59, 12.19);
    // UV : nervures verticales
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ map: this.tex.container, roughness: 0.65, metalness: 0.3 }), cont.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), col = new THREE.Color();
    cont.forEach((c, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw);
      p.set(c.pos[0], c.pos[1], c.pos[2]);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      col.setRGB(c.color[0], c.color[1], c.color[2]);
      mesh.setColorAt(i, col);
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
  }

  _signs(list) {
    for (const s of list) {
      const t = signTexture(s.lines);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.55, roughness: 0.6 }));
      const n = { x: Math.cos(s.face * Math.PI / 180), z: Math.sin(s.face * Math.PI / 180) };
      m.position.set(s.pos.x + n.x * 0.32, s.y, s.pos.z + n.z * 0.32);
      m.rotation.y = Math.atan2(n.x, n.z);
      this.scene.add(m);
      const back = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.4, s.h + 0.4, 0.5), this.mats.steel);
      back.position.set(s.pos.x, s.y, s.pos.z); back.rotation.y = m.rotation.y;
      back.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(back.geometry.attributes.position.count * 3).fill(0.6), 3));
      this.scene.add(back);
    }
  }

  // ---------------- effets ----------------
  _fx(list) {
    // lampes & balises : points lumineux
    const lamps = list.filter((f) => f.type === 'lamp' || f.type === 'beacon');
    const pos = [], col = [], phase = [], size = [];
    for (const f of lamps) {
      pos.push(...f.pos);
      const c = f.type === 'lamp' ? [1.0, 0.72, 0.38] : f.color === 'red' ? [1.0, 0.12, 0.06] : [1.0, 0.85, 0.6];
      col.push(...c);
      phase.push(f.type === 'beacon' ? Math.random() * 6.28 : -1);
      size.push(f.type === 'lamp' ? 5 : 9);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
    g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    this.lampMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { map: { value: this.tex.halo }, time: { value: 0 }, scale: { value: 600 } },
      vertexShader: `attribute float phase; attribute float size; attribute vec3 color; varying vec3 vC; varying float vA; uniform float time; uniform float scale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float d = -mv.z;
          vA = phase < 0.0 ? 1.0 : (0.15 + 0.85 * step(0.6, fract(time*0.55 + phase)));
          vA *= exp(-d * 0.00012);
          vC = color; gl_PointSize = clamp(size * scale / max(d, 1.0), 2.0, 64.0) + 2.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb * vA * 1.6, t.a * vA); }`,
    });
    this.lamps = new THREE.Points(g, this.lampMat);
    this.lamps.frustumCulled = false;
    this.scene.add(this.lamps);

    // flammes
    this.flames = [];
    for (const f of list.filter((f) => f.type === 'flame')) {
      const grp = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.flame, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
        sp.scale.set(f.size * (0.7 + k * 0.25), f.size * (1.6 + k * 0.4), 1);
        sp.position.y = k * f.size * 0.2;
        grp.add(sp);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.halo, color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.55 }));
      halo.scale.set(f.size * 9, f.size * 9, 1);
      grp.add(halo);
      grp.position.set(...f.pos);
      this.scene.add(grp);
      this.flames.push({ grp, f, ph: Math.random() * 10 });
    }
    // lueurs de laitier
    for (const f of list.filter((f) => f.type === 'glow')) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), new THREE.MeshBasicMaterial({ color: 0xff5a12, transparent: true, opacity: 0.9, fog: true }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = f.yaw || 0;
      m.position.set(...f.pos);
      this.scene.add(m);
      (this.glows ||= []).push(m);
    }
    // fumées : particules en billboard
    this.emitters = list.filter((f) => f.type === 'smoke' || f.type === 'steam').map((f) => ({ ...f, acc: Math.random() }));
    const MAX = 700;
    this.pMax = Math.min(MAX, this.Q.particles);
    const pg = new THREE.InstancedBufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    pg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    pg.setIndex([0, 1, 2, 0, 2, 3]);
    this.pOff = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); // x,y,z,size
    this.pCol = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); // r,g,b,a
    this.pOff.setUsage(THREE.DynamicDrawUsage); this.pCol.setUsage(THREE.DynamicDrawUsage);
    pg.setAttribute('offset', this.pOff); pg.setAttribute('pcol', this.pCol);
    pg.instanceCount = 0;
    this.pGeo = pg;
    const pm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { map: { value: this.tex.puff }, fogColor: { value: FOG_COLOR }, fogDensity: { value: FOG_DENSITY * this.Q.fog } },
      vertexShader: `attribute vec4 offset; attribute vec4 pcol; uniform float fogDensity; varying vec2 vUv; varying vec4 vC; varying float vFog;
        void main(){ vUv = uv; vC = pcol; vec4 mv = viewMatrix * vec4(offset.xyz, 1.0); mv.xy += position.xy * offset.w; float d = -mv.z; vFog = 1.0 - exp(-pow(d * fogDensity * 0.8, 2.0)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; varying vec2 vUv; varying vec4 vC; varying float vFog;
        void main(){ vec4 t = texture2D(map, vUv); vec3 c = mix(vC.rgb, fogColor, vFog); gl_FragColor = vec4(c, t.a * vC.a); }`,
    });
    this.particles = new THREE.Mesh(pg, pm);
    this.particles.frustumCulled = false;
    this.particles.renderOrder = 5;
    this.scene.add(this.particles);
    this.parts = [];
  }

  updateFx(dt, camPos) {
    this.time += dt;
    this.sky.material.uniforms.time.value = this.time;
    this.lampMat.uniforms.time.value = this.time;
    this.lampMat.uniforms.scale.value = this.renderer.domElement.height * 0.5 / Math.tan(this.camera.fov * Math.PI / 360) / 60;
    for (const fl of this.flames) {
      const t = this.time * 7 + fl.ph;
      fl.grp.children.forEach((s, k) => {
        if (k > 2) { s.material.opacity = 0.42 + 0.12 * Math.sin(t * 0.9); return; }
        const f = 0.82 + 0.18 * Math.sin(t * (1 + k * 0.37)) * Math.sin(t * 1.7 + k);
        s.scale.y = fl.f.size * (1.6 + k * 0.4) * f;
        s.material.opacity = 0.75 + 0.25 * Math.sin(t * 2.3 + k);
      });
    }
    if (this.glows) for (const g of this.glows) g.material.opacity = 0.75 + 0.2 * Math.sin(this.time * 1.3 + g.position.x);
    if (this.water) { this.tex.waterNormal.offset.x = this.time * 0.01; this.tex.waterNormal.offset.y = this.time * 0.006; }
    // émission
    const wind = { x: 2.2, z: 1.2 };
    for (const e of this.emitters) {
      e.acc += dt * e.rate;
      while (e.acc >= 1 && this.parts.length < this.pMax) {
        e.acc -= 1;
        const steam = e.type === 'steam';
        this.parts.push({ x: e.pos[0] + (Math.random() - 0.5) * 3, y: e.pos[1], z: e.pos[2] + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 1.5, vy: steam ? 5 + Math.random() * 2 : 3 + Math.random() * 2, vz: (Math.random() - 0.5) * 1.5, s: e.size * 0.5, gs: e.size * 0.18, life: 0, max: steam ? 14 : 22, steam });
      }
      if (e.acc > 1) e.acc = 1;
    }
    const off = this.pOff.array, colA = this.pCol.array;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life > p.max) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
    }
    // tri arrière → avant (approximatif) pour la transparence
    this.parts.sort((a, b) => ((b.x - camPos.x) ** 2 + (b.z - camPos.z) ** 2) - ((a.x - camPos.x) ** 2 + (a.z - camPos.z) ** 2));
    for (const p of this.parts) {
      const k = p.life / p.max;
      p.vy *= (1 - dt * 0.08);
      p.x += (p.vx + wind.x * k * 2) * dt; p.y += p.vy * dt; p.z += (p.vz + wind.z * k * 2) * dt;
      p.s += p.gs * dt;
      off[n * 4] = p.x; off[n * 4 + 1] = p.y; off[n * 4 + 2] = p.z; off[n * 4 + 3] = p.s;
      const a = Math.min(1, p.life * 0.8) * (1 - k) * (p.steam ? 0.55 : 0.5);
      if (p.steam) { colA[n * 4] = 0.86; colA[n * 4 + 1] = 0.84; colA[n * 4 + 2] = 0.82; }
      else { colA[n * 4] = 0.32 + k * 0.2; colA[n * 4 + 1] = 0.29 + k * 0.18; colA[n * 4 + 2] = 0.28 + k * 0.17; }
      colA[n * 4 + 3] = a;
      n++;
    }
    this.pGeo.instanceCount = n;
    this.pOff.needsUpdate = true; this.pCol.needsUpdate = true;
  }

  updateSun(target) {
    if (!this.sun.castShadow) return;
    // ombres centrées sur le joueur, calées sur la grille des texels (pas de scintillement)
    const step = 220 / this.sun.shadow.mapSize.x;
    const tx = Math.round(target.x / step) * step, tz = Math.round(target.z / step) * step;
    this.sun.target.position.set(tx, target.y, tz);
    this.sun.position.set(tx + SUN_DIR.x * 500, target.y + SUN_DIR.y * 500, tz + SUN_DIR.z * 500);
  }

  /** Change la qualité en direct (le lissage attend le prochain chargement). */
  setQuality(level) {
    const Q = QUALITY[level];
    if (!Q) return;
    this.quality = level; this.Q = Q;
    this.pixelRatioCap = Q.pr;
    if (this._size) this.resize(...this._size);
    const sh = Q.shadows > 0;
    if (sh !== this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = sh;
      this.sun.castShadow = sh;
      // les shaders dépendent de la présence d'ombres : recompilation
      this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    const s = this.sun.shadow;
    if (sh && s.mapSize.x !== Q.shadows) {
      s.mapSize.set(Q.shadows, Q.shadows);
      if (s.map) { s.map.dispose(); s.map = null; }
    }
    this.scene.fog.density = FOG_DENSITY * Q.fog;
    if (this.particles) this.particles.material.uniforms.fogDensity.value = FOG_DENSITY * Q.fog;
    this.pMax = Math.min(700, Q.particles);
    if (this.parts && this.parts.length > this.pMax) this.parts.length = this.pMax;
    if (this.flames) for (const f of this.flames) f.grp.visible = Q.flames;
  }

  render() {
    this.renderer.info.reset();
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }
}
