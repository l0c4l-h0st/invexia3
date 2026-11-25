# Résultats mesurés (Chromium headless, Playwright)

Exécution : 2026-11-25T11:36:29.671Z — fichier testé : `dist/velocity-fps.html`.
Rendu : ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) (rendu **logiciel**, sans GPU : 1.7 images/s, médiane 550 ms par image).
La physique tourne à pas fixe de 120 Hz : les durées ci-dessous sont en **temps de jeu**. Le pilote automatique n’utilise que les commandes d’un joueur (touches + rotation de la vue bornée à 300°/s).

## Batterie principale (tests/e2e.mjs) : 15/15

| Vérification | Résultat | Mesures |
| --- | --- | --- |
| Partie lancée par clic sur « Jouer » | OK | `{"state":"playing","pointerLock":true,"repliSourisLibre":false,"gpu":"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)","chargementMs":4904}` |
| Au moins 5 rebonds enchaînés (touches réelles W/Z + Espace maintenus, 6 s de jeu) | OK | `{"rebonds":9,"chaineMax":9,"sauts":10,"secteur":"Grand Viaduc"}` |
| Plusieurs secteurs franchis à plus de 100 m/s | OK | `{"secteurs":["Grand Viaduc","Échangeur de la Darse","La Boucle"],"premiers100ms_apres_s":27.5,"vitesseMax":128.5,"distanceKm":3.78,"dureeJeu_s":43,"rotationVueMax_degParS":300}` |
| Inspection du couteau en plein vol sans bloquer le mouvement | OK | `{"vitesseAvant":81.4,"vitessePendant":92.5,"vitesseApres":100.5,"poidsPendant":1,"actifPendant":true,"tempsInspect":3.5,"distanceParcourue":802,"finie":true,"enLair":true}` |
| Frein (Ctrl) : arrêt depuis la vitesse de pointe | OK | `{"vitesseDepart":129.2,"tempsJeu_s":1.5,"vitesseFinale":0,"secteur":"La Boucle"}` |
| Demi-tour puis retour sur ses pas dans des lieux déjà traversés | OK | `{"secteurAvant":"La Boucle","demiTourApres_s":0.5,"secteursTraverses":["La Boucle","Échangeur de la Darse","Grand Viaduc"],"reconnus":["Échangeur de la Darse","Grand Viaduc"]}` |
| Collision : Gazomètre (cuve r=56 m) à 300 m/s | OK | `{"test":"Gazomètre (cuve r=56 m) à 300 m/s","distanceAuCentre_m":62.6,"dehors":true,"penetrationMax_m":0,"chocs":1}` |
| Collision : Base de haut-fourneau (r=18 m) à 400 m/s | OK | `{"test":"Base de haut-fourneau (r=18 m) à 400 m/s","distanceAuCentre_m":61.6,"dehors":true,"penetrationMax_m":0,"chocs":3}` |
| Collision : Chute verticale à 350 m/s sur le terrain | OK | `{"test":"Chute verticale à 350 m/s sur le terrain","hauteurAuDessusDuSol_m":0.99,"auDessus":true,"penetrationMax_m":0,"chocs":0}` |
| Collision : Berge de la Boucle frôlée à 400 m/s | OK | `{"test":"Berge de la Boucle frôlée à 400 m/s","altitude":60.9,"penetrationMax_m":0,"chocs":0}` |
| Pause (Échap) fige la partie, « Reprendre » la relance | OK | `{"etatApresEchap":"paused","deplacementPendantPause_m":0,"etatApresReprise":"playing","deplacementApresReprise_m":11.1}` |
| Surf des Coulées jusqu’aux Hauts-Fourneaux (pilote auto) | OK | `{"arrive":true,"vitesseMax":84.5,"secondesAvecContactSurf":51,"secteur":"Hauts-Fourneaux","chute":false}` |
| Décor chargé à temps (zone du joueur toujours prête) | OK | `{"loads":127,"unloads":97,"misses":0,"lateMs":0,"buildMs":546.6000000024214,"maxBuildMs":67.70000000018626,"loaded":30,"grace":0}` |
| Aucune traversée de géométrie détectée pendant toute la session | OK | `{"max":0,"over5cm":0,"checks":17280}` |
| Aucune erreur JavaScript | OK | `[]` |

## Mouvements (tests/moves.mjs) : 6/6

| Vérification | Résultat | Mesures |
| --- | --- | --- |
| Sprint (Maj) | OK | `{"vitesse":8.6}` |
| Glissade (C en sprint) | OK | `{"fromDive":false,"before":8.6,"after":11.6,"tick":450,"slideT":1.1,"slideTAfter0_5s":0.6,"hsAfter0_5s":9.74}` |
| Plongeon (C en l’air) | OK | `{"before":{"hs":8.6,"vy":-3.8000000000000025,"g":false},"after":{"hs":14.1,"vy":-7.3},"tick":1110}` |
| Réception du plongeon en glissade | OK | `{"glissadesApresPlongeon":1}` |
| Secousses réglables jusqu’à zéro (amplitude caméra max à la réception d’une chute de 55 m) | OK | `{"secousses_0.6":0.024,"secousses_0":0}` |
| Aucune erreur JavaScript | OK | `{"errors":[]}` |

## Parcours rapide (extrait, temps de jeu)

| t (s) | vitesse (m/s) | secteur |
| --- | --- | --- |
| 0.3 | 9.8 | Le Belvédère |
| 2.3 | 24.3 | Le Belvédère |
| 4.3 | 36.8 | Grand Viaduc |
| 6.3 | 46.1 | Grand Viaduc |
| 8.5 | 54.7 | Grand Viaduc |
| 10.8 | 62.1 | Grand Viaduc |
| 12.8 | 68 | Grand Viaduc |
| 14.8 | 73.4 | Grand Viaduc |
| 16.8 | 78.4 | Grand Viaduc |
| 29.8 | 105.6 | La Boucle |
| 32 | 109.5 | La Boucle |
| 34.5 | 113.7 | La Boucle |
| 36.8 | 117.4 | La Boucle |
| 38.8 | 120.6 | La Boucle |
| 40.8 | 123.7 | La Boucle |
| 42.8 | 126.6 | La Boucle |

Captures : `tests/shots/` (pendant les tests, 640×360) et `tests/showcase/` (1280×720), converties en JPEG.
