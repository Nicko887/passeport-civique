# Passeport Civique

Application web **gratuite, open source, sans inscription** pour préparer l'examen civique français (obligatoire depuis 2026) : trois parcours, un par mention de l'examen : **carte de séjour pluriannuelle** (CSP, 190 questions), **carte de résident** (CR, 209 questions) et **naturalisation** (258 questions). Chaque mention a sa propre liste officielle (formation-civique.interieur.gouv.fr) ; les listes CSP et CR n'ont qu'une trentaine de questions en commun.

## Principes du projet

- **Le plus important pour l'utilisateur : la présentation et la facilité d'utilisation.** Public : adultes étrangers, souvent en français A2/B1.
- **Aucun compte en V1.** La progression est stockée dans le navigateur (`localStorage`), avec un export et un import de fichier. Des comptes facultatifs (Supabase) pourront venir plus tard ; ils ne doivent jamais bloquer l'entrée.
- **Outil indépendant, non officiel** : la mention apparaît sur l'écran d'accueil et dans « À propos ». Ne jamais imiter l'identité visuelle de l'État.
- **Exactitude factuelle absolue.** Toute correction de contenu s'appuie sur une source officielle (service-public.gouv.fr, Légifrance, vie-publique.fr, ministère de l'Intérieur). Source très utile : les fiches officielles de l'examen sur https://formation-civique.interieur.gouv.fr/.
- **Relecture complète du 23/11/2026** : 5 agents (un par thème) ont corrigé et précisé tout le contenu, avec les noms complets (« Claude-Joseph Rouget de Lisle »…), et ajouté environ 765 liens vérifiés.
- **Pas de reprise de code ou de contenu sous GPL ni de dépôts sans licence** (par exemple open-formation-civique.fr, qui est sous GPL). L'utilisateur a choisi de **publier seul**, sans contacter ce projet pour l'instant.

## Technique

- **Site statique, JavaScript sans framework ni étape de compilation**, installable et utilisable hors ligne (PWA, service worker `sw.js`).
- **Fichiers de l'application :**
  - `js/config.js` : thèmes, sous-thèmes, format d'examen, délais de révision ;
  - `js/store.js` : progression ;
  - `js/data.js` : sélection des questions et calcul des points faibles ;
  - `js/app.js` : écrans et navigation par `#/` ;
  - `js/audio.js` : lecture vocale par speechSynthesis ;
  - `js/markdown.js` : lecture des cours (liens, encadrés « À retenir ») ;
  - `js/icones.js` : icônes au trait en SVG, dessinées pour le projet (`ic(nom)`, `pastille(nom)`) ; **pas d'émojis dans l'interface**.
- **Design (refonte du 23/11/2026) :** bandeau dégradé `.hero` + cartes qui le chevauchent (`.chevauche`) ; composants de `app.js` : `carteAction` (bande de couleur, pastille, bouton rond), `ligneTheme`, `heroResultat`, `carteCorrection`, `ligneReglage`. Couleurs des thèmes et des parcours dans `:root` (`--c-*`), avec mode sombre. Pas de drapeau ni d'imitation de l'identité visuelle de l'État. Captures de contrôle : Chrome sans interface en 390 × 844.
- **Contenu modifiable :**
  - `contenu/qcm/<parcours>-<theme>.json` : bonne réponse, 3 distracteurs, explication, sous-thème, `a_verifier` ;
  - `contenu/qcm/csp-<theme>.json` : parcours CSP ; chaque question garde `reponses_suggerees` (source) et `construire.py` vérifie que la bonne réponse en fait partie et qu'aucune mauvaise réponse n'en fait partie ;
  - `contenu/qcm/situations-<theme>.json` : mises en situation, **communes aux trois parcours** (identifiants `sit-<n>`, champ `s: 1` dans `data/`), avec un champ `source` (texte de loi). Numérotation : principes 1 à 50, droits 51 à 100 ;
  - `contenu/cours/<theme>.md` : cours en Markdown restreint ; les sections `## Titre {#id_sous_theme}` doivent avoir les mêmes identifiants que les sous-thèmes de `config.js`.
- **Liens externes** (vers des sites sûrs uniquement, liste `SITES_SURS` dans `config.js` **et** dans `construire.py`) :
  - dans les cours : `[texte](https://…)` ; un lien vers un site non autorisé s'affiche comme du texte simple ;
  - dans les questions : champ `"liens": [{"titre": "…", "url": "…"}]` (2 au maximum), affiché sous la correction ;
  - `python outils/verifier_liens.py` vérifie que les liens répondent (à relancer de temps en temps). Légifrance refuse les robots (403) : ces liens sont à vérifier à la main.
- **Après chaque modification du contenu :** lancer `python outils/construire.py`, qui produit `data/*.json` et vérifie le contenu. Avant chaque publication, incrémenter `VERSION` dans `sw.js`.
- **Tester en local :** `python -m http.server 8000`.
- **Thèmes (slugs) :** `principes`, `institutions`, `droits`, `histoire`, `societe`.
- **Sources :** `sources/*.json` (data.gouv.fr, Licence Ouverte 2.0). La mention « Réponses suggérées par leqcmcivique.fr » est obligatoire, avec un lien.

## Format de l'examen (dans `config.js`)

40 questions en 45 minutes ; il faut 32 bonnes réponses pour réussir. Répartition **vérifiée sur Légifrance le 23/11/2026** (arrêté du 10 octobre 2025, art. 3, JORFTEXT000052381620), identique pour toutes les mentions :
- principes 11 (devise et symboles 3, laïcité 2, **mises en situation 6**) ;
- institutions 6 (démocratie et vote 3, organisation de la République 2, institutions européennes 1) ;
- droits 11 (droits fondamentaux 2, obligations et devoirs 3, **mises en situation 6**) ;
- histoire 8 (périodes et personnages 3, territoires et géographie 3, patrimoine 2) ;
- société 4 (s'installer 1, soins 1, travail 1, autorité parentale et école 1).

`EXAMEN.situations` dans `config.js` ; `tirerExamen` et `tirerModule` dans `data.js` respectent cette proportion. **Seuil vérifié le 23/11/2026 : 32/40 pour toutes les mentions.** Naturalisation : arrêté du 10 octobre 2025, art. 2 (80 %). Carte pluriannuelle et carte de résident : dépliant officiel du ministère de l'Intérieur (https://www.immigration.interieur.gouv.fr/sites/dgef/files/medias/documents/2026-06/Flyer_A5_Examen_civique_Sejour_nov2025_Accessible.pdf) : « 32 bonnes réponses minimum pour réussir l'examen ». Le même dépliant indique des « niveaux de difficulté différents » selon le titre (CSP ou CR), sans détail.

## État au 23/11/2026

- La V1 est terminée et testée dans Chrome sans interface (mobile, ordinateur, mode sombre) : aucune erreur.
- Le premier commit est fait sur la branche `main`. Le remote est `https://github.com/Nicko887/passeport-civique.git`.
- **En ligne depuis le 23/11/2026 :** https://nicko887.github.io/passeport-civique/ (GitHub Pages, branche `main` / racine). Un `git push` publie le site en 1 à 2 minutes ; penser à incrémenter `VERSION` dans `sw.js`. Le site en ligne a été testé dans Chrome sans interface, y compris hors ligne : aucune erreur.
- Les 5 questions douteuses ont été validées par l'utilisateur (nat 111, nat 112, nat 150, res 172 = « Quatrième » depuis le 23/11/2026, rapport OIF 2026, res 184).

## Prochaines étapes, validées par l'utilisateur

1. ~~Les mises en situation~~ : **faites le 23/11/2026** (95 questions : 45 principes, 50 droits ; intégrées à l'examen blanc, à l'entraînement et aux écrans de thème). La bonne réponse est la plus longue dans 22 % des cas. Relues le 23/11/2026 par 4 agents indépendants (sans droit d'écriture), puis corrections vérifiées et appliquées : 41 questions corrigées (ex. diffamation ≠ injure, « voile » et non « grand voile », agent public et tribunal administratif, juré = Français, distracteurs moqueurs remplacés). Une relecture humaine reste conseillée pour le ton.
2. Plus tard, si l'utilisateur le demande :
   - ~~rééquilibrer la longueur des réponses~~ : **fait le 23/11/2026** (104 questions, distracteurs seulement). Bonne réponse la plus longue dans 16 à 22 % des questions selon le fichier, la plus courte dans 9 à 23 %. À surveiller avec `construire.py` et `outils/longueurs.py` quand on ajoute des questions ;
   - ajouter une aide en plusieurs langues ;
   - ajouter des comptes facultatifs ;
   - enregistrer de vrais podcasts ;
   - acheter un nom de domaine (passeport-civique.fr semblait libre au 22/11/2026).
