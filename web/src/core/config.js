// Velocity FPS — constantes de simulation et réglages par défaut.
// Unités : mètres, secondes. Physique à pas fixe 120 Hz (déterministe).

export const TICK_RATE = 120;
export const TICK = 1 / TICK_RATE;

export const PHYS = {
  gravity: 20,          // m/s² (proche de Source : 800 u/s²)
  jumpVel: 7.2,         // m/s  → saut de ~1,30 m
  walkSpeed: 5.2,       // marche d'exploration
  sprintSpeed: 8.6,     // Maj
  groundAccel: 10,      // sv_accelerate
  friction: 5.0,        // sv_friction
  stopSpeed: 2.5,
  airAccel: 40,         // sv_airaccelerate (style serveurs surf)
  airRefSpeed: 8.6,     // vitesse de référence pour le taux d'accélération en l'air
  airWishCap: 2.0,      // plafond « 30 u/s » de Source, ajusté pour la très haute vitesse
  maxSpeed: 400,        // LIMITE TECHNIQUE (m/s) = 1440 km/h
  radius: 0.7,          // sphère de collision
  eyeHeight: 0.95,      // œil au-dessus du centre de la sphère (≈1,65 m du sol)
  slideEye: 0.2,
  stepHeight: 0.55,
  minWalkNormal: 0.7,   // pente marchable max ≈ 45,6°
  // Glissade (C au sol en sprint)
  slideMinSpeed: 5.5,
  slideBoost: 3.0,
  slideBoostCap: 14,
  slideTime: 1.1,
  slideFriction: 0.35,
  // Plongeon (C en l'air)
  diveForward: 5.5,
  diveDown: 3.5,
  diveCooldown: 0.8,
  // Frein volontaire (Ctrl) : décélération = min(max, base + k·v)
  brakeGround: 22,
  brakeGroundK: 0.6,
  brakeGroundMax: 30,   // + friction plafonnée à 45 → ≈ 7,6 g au sol
  brakeAir: 9,
  brakeAirK: 0.55,
  brakeAirMax: 60,
  // Friction au sol plafonnée : atterrir à 150 m/s sans sauter fait déraper, pas s'écraser
  frictionMaxDecel: 45,
};

export const DEFAULT_SETTINGS = {
  sensitivity: 1.4,     // degrés par compte = 0.022 × sensibilité (échelle Source)
  invertY: false,
  fov: 100,             // FOV horizontal (degrés) en 16:9
  dynamicFov: true,
  shake: 0.6,           // secousses 0..1
  bob: 0.7,             // balancement 0..1
  speedLines: true,
  volume: 0.8,
  quality: 'auto',      // 'low' | 'medium' | 'high' | 'auto'
  showHelp: true,
};
