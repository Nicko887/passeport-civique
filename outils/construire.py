"""Assemble les fichiers de contenu (contenu/qcm/*.json) en données prêtes pour l'application (data/*.json).

Usage : python outils/construire.py
Vérifie aussi la qualité du contenu et affiche les problèmes trouvés.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

RACINE = Path(__file__).resolve().parent.parent
QCM = RACINE / "contenu" / "qcm"
SORTIE = RACINE / "data"

THEMES = {
    "principes": ["symboles", "valeurs", "laicite", "libertes", "egalite", "citoyennete"],
    "institutions": ["constitution", "executif", "parlement", "justice", "collectivites", "elections", "europe"],
    "droits": ["droits_fondamentaux", "devoirs", "famille", "egalite_fh", "travail", "justice_recours"],
    "histoire": ["histoire_ancienne", "revolution_empire", "histoire_contemporaine", "histoire_recente",
                 "geographie", "outre_mer", "culture"],
    "societe": ["sante", "education", "logement", "emploi_social", "demarches", "vie_quotidienne"],
}
PARCOURS = {"naturalisation": "nat", "resident": "res", "csp": "csp"}
COURS = RACINE / "contenu" / "cours"

# Sites sûrs autorisés pour les liens (même liste que SITES_SURS dans js/config.js).
SITES_SURS = [
    "gouv.fr", "service-public.fr", "vie-publique.fr", "elysee.fr", "assemblee-nationale.fr", "senat.fr",
    "conseil-constitutionnel.fr", "conseil-etat.fr", "cour-de-cassation.fr", "defenseurdesdroits.fr", "justice.fr",
    "cnil.fr", "ameli.fr", "caf.fr", "msa.fr", "francetravail.fr", "info-retraite.fr", "europa.eu", "insee.fr",
    "bnf.fr", "ina.fr", "lumni.fr", "histoire-image.org", "monuments-nationaux.fr", "chateauversailles.fr",
    "louvre.fr", "musee-orsay.fr", "centrepompidou.fr", "pantheonsorbonne.fr", "unesco.org", "ign.fr",
    "meteofrance.com", "onisep.fr", "arretonslesviolences.gouv.fr",
]
RE_LIEN_MD = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")


def lien_sur(url):
    u = urlparse(url)
    hote = u.hostname or ""
    return u.scheme == "https" and any(hote == d or hote.endswith("." + d) for d in SITES_SURS)


def verifier_liens_question(item, ref, problemes):
    """Contrôle le champ facultatif « liens » : [{"titre": ..., "url": ...}], 2 liens au maximum."""
    liens = item.get("liens") or []
    if len(liens) > 2:
        problemes.append(f"{ref} : 2 liens au maximum")
    propres = []
    for l in liens:
        if not isinstance(l, dict) or not l.get("titre") or not l.get("url"):
            problemes.append(f"{ref} : lien mal formé {l!r}")
        elif not lien_sur(l["url"]):
            problemes.append(f"{ref} : site non autorisé {l['url']}")
        else:
            propres.append({"titre": l["titre"].strip(), "url": l["url"].strip()})
    return propres


def verifier_cours(problemes):
    for fichier in sorted(COURS.glob("*.md")):
        for n, ligne in enumerate(fichier.read_text(encoding="utf-8").splitlines(), 1):
            for _, url in RE_LIEN_MD.findall(ligne):
                if not lien_sur(url):
                    problemes.append(f"{fichier.name} ligne {n} : site non autorisé {url}")


def lire_fichier(fichier, theme, sous_themes, prefixe, situation, problemes, a_verifier, longueurs):
    """Lit un fichier de questions et renvoie les questions au format de l'application."""
    questions = []
    plus_longue = plus_courte = 0
    for item in json.loads(fichier.read_text(encoding="utf-8")):
        ref = f"{fichier.name} #{item.get('src_id')}"
        d = [x.strip() for x in item.get("distracteurs", [])]
        a = item.get("bonne_reponse", "").strip()
        if len(d) != 3 or len(set(d)) != 3 or a in d or not a:
            problemes.append(f"{ref} : réponses invalides")
            continue
        # Fidélité à la source : la bonne réponse est l'une des réponses suggérées,
        # et aucune mauvaise réponse n'en fait partie (elle serait juste).
        suggerees = item.get("reponses_suggerees")
        if suggerees:
            n = lambda s: re.sub(r"\W+", " ", s.lower().replace("’", "'")).strip()
            ns = {n(x) for x in suggerees}
            if n(a) not in ns and not item.get("a_verifier"):
                problemes.append(f"{ref} : la bonne réponse n'est pas une des réponses suggérées")
            if any(n(x) in ns for x in d):
                problemes.append(f"{ref} : une mauvaise réponse est une réponse suggérée (donc juste)")
        if situation and not item.get("explication", "").strip():
            problemes.append(f"{ref} : une mise en situation doit avoir une explication")
        st = item.get("sous_theme")
        if st not in sous_themes:
            problemes.append(f"{ref} : sous-thème inconnu « {st} », remplacé par {sous_themes[0]}")
            st = sous_themes[0]
        if item.get("a_verifier"):
            a_verifier.append(f"{ref} : {item.get('note', '')}")
        if len(a) > max(len(x) for x in d):
            plus_longue += 1
        if len(a) < min(len(x) for x in d):
            plus_courte += 1
        liens = verifier_liens_question(item, ref, problemes)
        questions.append({
            "id": f"{prefixe}-{item['src_id']}",
            "t": theme,
            "st": st,
            "q": item["question"].strip(),
            "a": a,
            "d": d,
            "e": item.get("explication", "").strip(),
            "n": item.get("difficulte", 2),
            **({"s": 1} if situation else {}),
            **({"l": liens} if liens else {}),
            **({"v": 1} if item.get("a_verifier") else {}),
        })
    if questions:
        longueurs[fichier.name] = (plus_longue / len(questions), plus_courte / len(questions))
    return questions


def construire():
    problemes = []
    a_verifier = []
    longueurs = {}
    for parcours, prefixe in PARCOURS.items():
        questions = []
        for theme, sous_themes in THEMES.items():
            fichier = QCM / f"{parcours}-{theme}.json"
            if not fichier.exists():
                problemes.append(f"MANQUANT : {fichier.name}")
                continue
            questions += lire_fichier(fichier, theme, sous_themes, prefixe, False,
                                      problemes, a_verifier, longueurs)
            # Mises en situation : communes aux deux parcours (même répartition pour toutes les mentions).
            situations = QCM / f"situations-{theme}.json"
            if situations.exists():
                questions += lire_fichier(situations, theme, sous_themes, "sit", True,
                                          problemes if parcours == "naturalisation" else [],
                                          a_verifier if parcours == "naturalisation" else [],
                                          longueurs)
        ids = [q["id"] for q in questions]
        if len(ids) != len(set(ids)):
            problemes.append(f"{parcours} : identifiants en double")
        SORTIE.mkdir(exist_ok=True)
        (SORTIE / f"{parcours}.json").write_text(
            json.dumps({"parcours": parcours, "questions": questions}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        nb_sit = sum(1 for q in questions if q.get("s"))
        print(f"{parcours} : {len(questions)} questions, dont {nb_sit} mises en situation")

    verifier_cours(problemes)
    print("\nLongueur des réponses : part des questions où la bonne réponse est la plus longue / la plus courte")
    print("(objectif : environ 25 % chacune, le hasard pour 4 réponses ; détail : python outils/longueurs.py <fichier>)")
    for nom, (longue, courte) in sorted(longueurs.items()):
        print(f" - {nom} : plus longue {round(longue * 100)} % · plus courte {round(courte * 100)} %")

    for p in problemes:
        print("PROBLÈME", p)
    if a_verifier:
        print(f"\n{len(a_verifier)} question(s) marquée(s) à vérifier :")
        for v in a_verifier:
            print(" -", v)
    return 1 if problemes else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(construire())
