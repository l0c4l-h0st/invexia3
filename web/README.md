# Velocity FPS — Friche Ardente (v2.2)

Balade libre à très haute vitesse dans une friche industrielle, jouable dans un navigateur de bureau.
Aucun moteur à installer : `index.html` (à la racine du dépôt) et `web/dist/velocity-fps.html` sont des
fichiers **autonomes** (Three.js r160 est intégré, aucune ressource réseau n'est requise ; seules les polices
Google sont chargées si la connexion le permet, avec repli local).

## Jouer

Ouvrir `index.html` (ou `web/dist/velocity-fps.html`) dans Chrome, Edge ou Firefox, cliquer sur **Jouer**.

| Commande | Action |
| --- | --- |
| ZQSD / WASD | se déplacer (lecture par position physique des touches : AZERTY et QWERTY) |
| Souris | regarder (verrouillage du pointeur, mouvement brut sans lissage) |
| Maj | sprint |
| Espace maintenu | bunny hop automatique au contact du sol |
| Q/A ou D en l'air + rotation de la souris du même côté | strafe : gain de vitesse |
| Ctrl | frein volontaire (au sol et en l'air) |
| C | glissade au sol (en sprint), plongeon en l'air |
| F | figures au karambit : trois enchaînements à tour de rôle (vitrine et double tour, lancer-rattraper, tourbillon et estoc), en plein saut sans bloquer les commandes |
| R | retour à l'élan : ≈3 s en arrière sur un appui stable, vitesse conservée (appuis rapprochés = plus loin) |
| F1 | réglages en direct : graphismes (qualité, résolution, images/s) et physique (préréglages Arcade, Standard, Source classique) |
| Échap | pause et réglages |
| H | afficher / masquer l'aide |

**Limite technique : 400 m/s (1 440 km/h).** La vitesse est plafonnée au-delà.

Sous le compteur de vitesse, la **jauge de synchronisation** indique pendant chaque saut la part du temps
où la souris tourne du même côté que la touche de strafe, et le gain de vitesse du dernier saut.

## Graphismes et PC modestes

Qualité réglable **en direct** (F1, ou Échap → Réglages), sans recharger la page :

| Niveau | Ombres | Densité de pixels max | Portée du chargement | Fumées |
| --- | --- | --- | --- | --- |
| Très basse | non | ×0,6 | 70 % (brume plus dense) | 120 particules, sans flammes |
| Basse | non | ×0,75 | 85 % | 320 particules |
| Moyenne | 1024² | ×1 | 100 % | 700 particules |
| Haute | 2048² | ×1,5 | 115 % | 700 particules |

- **Résolution** (50 à 100 %) : le levier le plus efficace sur une carte graphique faible.
- **Auto** (par défaut) : niveau de départ choisi d'après la carte graphique annoncée par le navigateur
  (rendu logiciel → Très basse, graphique intégré Intel HD/UHD → Basse, sinon Moyenne), puis baisse d'un cran
  si les images/s restent sous 38 pendant 4 s ; au plus bas, la résolution descend jusqu'à 70 %.
- Hors Auto, un message conseille F1 si les images/s restent faibles.
- Le lissage (anticrénelage) dépend du contexte WebGL : il change au prochain chargement de la page.

## Le karambit « KR-9 Serre »

Lame en griffe à double émouture (face A stonewash gravée, face B aux couleurs de revenu, biseaux polis
miroir), anneau DLC à liseré orange, plaquettes G10 quadrillées sur soie apparente, axes en acier.
Il est tenu index dans l'anneau par une main gantée articulée (trois phalanges par doigt).
La main ne s'arrête jamais : respiration, roulis, bascule du couteau sur l'index, et toutes les 2 à 4 s
un geste spontané (tour complet, double tour, tour inversé, balancier, claquement de poignet).
Les rotations font s'ouvrir les doigts, le poignet réagit à l'accélération du couteau et une traînée
lumineuse suit la pointe.

## Ce qu'il y a dans la friche

- **Le Belvédère** (départ, 104 m) au sommet du Terril : on voit les **Hauts-Fourneaux** au nord-est
  (flammes, cheminées) et les **Docks** au nord-ouest (portiques à feux rouges). Deux départs :
- **Les Coulées** : 1,5 km de rampe de surf orange en grand S, tremplin final et couloir de réception
  qui débouche au pied des fourneaux.
- **Grand Viaduc** : 1,8 km de tablier en U (berges surfables) qui descend vers l'échangeur de la Darse.
- **La Boucle** : anneau surélevé de 11,8 km (profils en U, sections larges, vallées en V, bosses),
  quatre **échangeurs** (Fourneaux, Plaine, Gazomètre, Darse) avec rampes d'accès au sol.
- **Hauts-Fourneaux** : trois fourneaux avec ponts de chargement marchables jusqu'aux gueulards (77 m),
  cowpers à dômes surfables, collecteur de gaz rideable, cheminées et torchère.
- **Docks de la Darse** : cargo à coque surfable, portiques et galerie jusqu'à une flèche, parc à conteneurs,
  hangars à toit cintré, silos.
- **Le Gazomètre** : cuve à dôme surfable, charpente, hélice de 0,9 km entre l'échangeur (70 m) et le sol,
  tours de refroidissement.
- **Plaine des Scories** : dunes, cônes de laitier surfables, tremplins, cokerie, ligne haute tension.
- Pipelines rideables, chemins de service, hangars en ruine, crêtes de laitier qui ferment le monde.

Les zones de 600 m sont **chargées progressivement** autour du joueur et dans la direction de sa vitesse.

## Développement

```bash
cd web
npm install
npm run build        # produit dist/velocity-fps.html, dist/artifact.html et ../index.html
node tools/sim.mjs   # simulateur physique hors navigateur (bhop, surf, frein)
node tools/worldcheck.mjs  # construit le monde et vérifie quelques invariants
node tests/e2e.mjs   # tests de bout en bout dans Chromium (Playwright)
node tests/moves.mjs # sprint, glissade, plongeon, secousses réglables jusqu'à zéro
node tests/quality.mjs # niveaux de qualité en direct, résolution, mode Auto
```

Arborescence :

- `src/core/` : physique (pas fixe 120 Hz), collisions continues sphère/volumes convexes et terrain,
  entrées, configuration.
- `src/world/` : constructeur (collision + géométrie par zone), plan du monde, secteurs.
- `src/render/` : rendu Three.js (ciel, brume, terrain à deux niveaux de détail, streaming, effets).
- `src/view/` : gants et couteau procéduraux, animations (foulée, inertie, réception, inspection).
- `src/audio/` : sons procéduraux (vent et sifflement selon la vitesse, frottement de surf, pas par matière).
- `tests/` : tests de bout en bout ; `tests/RESULTS.md` résume les mesures de la dernière exécution (`results.json`, `results-moves.json`).

### Physique en bref

Modèle Source/Quake : friction au sol, accélération au sol, accélération en l'air plafonnée (le strafe
synchronisé avec la souris fait gagner de la vitesse), surf sur toute pente de plus de 45,6°.
Réglages principaux (`src/core/config.js`) : gravité 20 m/s², saut 7,2 m/s, `airAccel` 40,
plafond de strafe 2,4 m/s, friction au sol plafonnée à 45 m/s² (une réception sans saut fait déraper au lieu
d'arrêter net), frein jusqu'à ≈ 7,6 g au sol et 6 g en l'air.
Les collisions sont des tracés continus : aucune traversée possible à 400 m/s (3,3 m par pas).
Les jointures entre segments d'une même rampe ne bloquent jamais (pas de « ramp bug »).
