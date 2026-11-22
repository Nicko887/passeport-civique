# Passeport Civique

Application **gratuite, sans publicité, sans inscription et open source** pour préparer l'**examen civique** français, obligatoire depuis le 1er janvier 2026 pour la **naturalisation** et la **carte de résident**.

> Outil indépendant : il n'est pas édité par l'État ni par le ministère de l'Intérieur.

## Fonctionnalités

- **Deux parcours :** naturalisation (258 questions) et carte de résident (209 questions), chacun avec sa propre progression.
- **Cours :** un cours en français simple pour chacun des 5 thèmes officiels, avec des encadrés « À retenir ».
- **Écoute :** les cours sont lus à voix haute, comme un podcast, par la synthèse vocale du navigateur.
- **Entraînement :** des QCM avec correction immédiate, une explication et un lien vers le cours.
- **Examen blanc :**
  - en conditions réelles : 40 questions, 45 minutes, 32 bonnes réponses pour réussir, avec la répartition officielle par thème ;
  - ou par module, sur un seul thème.
- **Points faibles :** l'application repère automatiquement les parties où l'utilisateur se trompe, puis le guide de trois façons :
  - un rappel du cours ;
  - des questions ciblées ;
  - une révision espacée (système de Leitner), jusqu'à la maîtrise.
- **Accessibilité :**
  - texte agrandissable et mode sombre ;
  - lecture audio des questions ;
  - navigation au clavier (touches 1 à 4 pour répondre, Entrée pour continuer).
- **Hors ligne et installable** sur téléphone (PWA).
- **Vie privée :**
  - aucune donnée collectée, la progression reste sur l'appareil ;
  - export et import d'un fichier pour changer d'appareil.

## Lancer en local

Aucune dépendance, aucune compilation :

```bash
python outils/construire.py        # assemble contenu/qcm → data/*.json et vérifie le contenu
python -m http.server 8000         # puis ouvrir http://localhost:8000
```

## Organisation

| Dossier | Rôle |
|---|---|
| `sources/` | Jeux de données d'origine (data.gouv.fr) |
| `contenu/qcm/` | Questions enrichies : bonne réponse, distracteurs, explication, sous-thème. **C'est ici qu'on corrige ou enrichit.** |
| `contenu/cours/` | Cours au format Markdown restreint (un fichier par thème) |
| `data/` | Fichiers générés par `outils/construire.py` (ne pas modifier à la main) |
| `js/`, `css/` | Application (JavaScript sans framework) |

### Format d'une question (`contenu/qcm/*.json`)

```json
{
  "src_id": 1,
  "question": "Texte officiel exact",
  "bonne_reponse": "…",
  "distracteurs": ["…", "…", "…"],
  "explication": "1 à 2 phrases simples",
  "sous_theme": "symboles",
  "difficulte": 1,
  "a_verifier": false,
  "note": ""
}
```

Après toute modification : `python outils/construire.py`, puis incrémenter `VERSION` dans `sw.js` avant de publier.

## Contribuer

Une erreur dans une réponse, une explication ou un cours ? Ouvrez une *issue* ou proposez une modification de `contenu/`. Toute correction doit s'appuyer sur une source officielle : service-public.fr, Légifrance, vie-publique.fr ou le ministère de l'Intérieur.

## Sources et licences

- **Questions :** listes officielles publiées par le ministère de l'Intérieur.
- **Réponses suggérées par [leqcmcivique.fr](https://leqcmcivique.fr)** : jeux de données publiés sur [data.gouv.fr](https://www.data.gouv.fr/datasets/69b8424c79191becedadf30f) sous [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/).
- **Distracteurs, explications et cours** rédigés pour ce projet : Licence Ouverte 2.0.
- **Code :** licence MIT (voir `LICENSE`).
