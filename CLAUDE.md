# Passeport Civique

Application web **gratuite, open source, sans inscription** pour préparer l'examen civique français (obligatoire depuis 2026) : parcours **naturalisation** (258 questions) et **carte de résident** (209 questions).

## Principes du projet

- **Le plus important pour l'utilisateur : la présentation et la facilité d'utilisation.** Public : adultes étrangers, souvent en français A2/B1.
- **Aucun compte en V1.** La progression est stockée dans le navigateur (`localStorage`), avec un export et un import de fichier. Des comptes facultatifs (Supabase) pourront venir plus tard ; ils ne doivent jamais bloquer l'entrée.
- **Outil indépendant, non officiel** : la mention apparaît sur l'écran d'accueil et dans « À propos ». Ne jamais imiter l'identité visuelle de l'État.
- **Exactitude factuelle absolue.** Toute correction de contenu s'appuie sur une source officielle (service-public.fr, Légifrance, vie-publique.fr, ministère de l'Intérieur).
- **Pas de reprise de code ou de contenu sous GPL ni de dépôts sans licence** (par exemple open-formation-civique.fr, qui est sous GPL). L'utilisateur a choisi de **publier seul**, sans contacter ce projet pour l'instant.

## Technique

- **Site statique, JavaScript sans framework ni étape de compilation**, installable et utilisable hors ligne (PWA, service worker `sw.js`).
- **Fichiers de l'application :**
  - `js/config.js` : thèmes, sous-thèmes, format d'examen, délais de révision ;
  - `js/store.js` : progression ;
  - `js/data.js` : sélection des questions et calcul des points faibles ;
  - `js/app.js` : écrans et navigation par `#/` ;
  - `js/audio.js` : lecture vocale par speechSynthesis ;
  - `js/markdown.js` : lecture des cours.
- **Contenu modifiable :**
  - `contenu/qcm/<parcours>-<theme>.json` : bonne réponse, 3 distracteurs, explication, sous-thème, `a_verifier` ;
  - `contenu/cours/<theme>.md` : cours en Markdown restreint ; les sections `## Titre {#id_sous_theme}` doivent avoir les mêmes identifiants que les sous-thèmes de `config.js`.
- **Après chaque modification du contenu :** lancer `python outils/construire.py`, qui produit `data/*.json` et vérifie le contenu. Avant chaque publication, incrémenter `VERSION` dans `sw.js`.
- **Tester en local :** `python -m http.server 8000`.
- **Thèmes (slugs) :** `principes`, `institutions`, `droits`, `histoire`, `societe`.
- **Sources :** `sources/*.json` (data.gouv.fr, Licence Ouverte 2.0). La mention « Réponses suggérées par leqcmcivique.fr » est obligatoire, avec un lien.

## Format de l'examen (dans `config.js`)

40 questions en 45 minutes ; il faut 32 bonnes réponses pour réussir. Répartition par thème selon l'arrêté du 10 octobre 2025, d'après des sources secondaires : principes 11, institutions 6, droits 11, histoire 8, société 4. À confirmer sur Légifrance.

## État au 23/11/2026

- La V1 est terminée et testée dans Chrome sans interface (mobile, ordinateur, mode sombre) : aucune erreur.
- Le premier commit est fait sur la branche `main`. Le remote est `https://github.com/Nicko887/passeport-civique.git`.
- **Le push est bloqué :** les identifiants Git du poste sont ceux de **NicodemeKONE**, qui n'a pas d'accès en écriture au dépôt (erreur 403). Il faut soit ajouter NicodemeKONE comme collaborateur (Write) du dépôt Nicko887/passeport-civique, soit se connecter avec Nicko887. Ensuite :
  1. `git push -u origin main` ;
  2. activer GitHub Pages (Settings > Pages > Deploy from a branch > main / root) ;
  3. le site sera à l'adresse https://nicko887.github.io/passeport-civique/.
- Les 5 questions douteuses ont été validées par l'utilisateur (nat 111, nat 112, nat 150, res 172 = « Cinquième », res 184).

## Prochaines étapes, validées par l'utilisateur

1. **Les mises en situation** : environ 12 questions sur 40 au vrai examen, sans liste officielle. Commencer par vérifier sur Légifrance leur nombre et leur répartition, puis rédiger environ 100 questions (situation concrète, une seule bonne réponse, des distracteurs plausibles et pas absurdes, une explication), et les intégrer à l'examen blanc.
2. Plus tard, si l'utilisateur le demande :
   - rééquilibrer la longueur des réponses : la bonne réponse est la plus longue dans environ 35 % des cas, l'objectif est 25 % ;
   - ajouter une aide en plusieurs langues ;
   - ajouter des comptes facultatifs ;
   - enregistrer de vrais podcasts ;
   - acheter un nom de domaine (passeport-civique.fr semblait libre au 22/11/2026).
