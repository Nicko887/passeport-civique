"""Vérifie que tous les liens externes du contenu répondent (cours et questions).

Usage : python outils/verifier_liens.py [fichier ...]
Sans argument, vérifie tout le dossier contenu/. À lancer de temps en temps : les sites changent leurs adresses.
"""
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
RE_LIEN_MD = re.compile(r"\[([^\]]+)\]\((https://[^)\s]+)\)")
ENTETES = {"User-Agent": "Mozilla/5.0 (verification de liens ; Passeport Civique)", "Accept-Language": "fr"}


def liens_du_fichier(fichier):
    texte = fichier.read_text(encoding="utf-8")
    if fichier.suffix == ".md":
        return [(fichier.name, url) for _, url in RE_LIEN_MD.findall(texte)]
    res = []
    for item in json.loads(texte):
        for l in item.get("liens") or []:
            res.append((f"{fichier.name} #{item.get('src_id')}", l.get("url", "")))
    return res


def tester(url):
    for methode in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, headers=ENTETES, method=methode)
            with urllib.request.urlopen(req, timeout=20) as rep:
                return rep.status
        except urllib.error.HTTPError as err:
            if methode == "GET" or err.code not in (403, 405, 400):
                return err.code
        except Exception as err:  # noqa: BLE001 - on veut tout signaler
            if methode == "GET":
                return f"erreur : {err}"
    return "?"


def main(args):
    fichiers = [Path(a) for a in args] or sorted((RACINE / "contenu").rglob("*.md")) + sorted((RACINE / "contenu").rglob("*.json"))
    liens = [x for f in fichiers for x in liens_du_fichier(f)]
    uniques = sorted({u for _, u in liens})
    print(f"{len(liens)} liens, {len(uniques)} adresses différentes")
    with ThreadPoolExecutor(8) as pool:
        statuts = dict(zip(uniques, pool.map(tester, uniques)))
    # Certains sites (Légifrance…) refusent les robots avec une erreur 403 : on ne peut pas conclure.
    a_la_main = [(ref, u) for ref, u in liens if statuts[u] == 403]
    mauvais = [(ref, u, statuts[u]) for ref, u in liens if statuts[u] not in (200, 403)]
    for ref, u in a_la_main:
        print(f"À VÉRIFIER À LA MAIN (le site refuse les robots) : {u} ({ref})")
    for ref, u, s in mauvais:
        print(f"PROBLÈME {s} : {u} ({ref})")
    print("Tous les liens répondent." if not mauvais else f"{len(mauvais)} lien(s) à corriger.")
    return 1 if mauvais else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
