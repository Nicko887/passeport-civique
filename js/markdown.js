// Petit lecteur Markdown pour le format restreint des cours.
// Retourne { titre, intro, sections: [{ id, titre, html, texte }] }.
// Liens : [texte](https://…), seulement vers les sites de SITES_SURS (sinon le texte seul est affiché).
import { lienSur } from './config.js';
import { ic } from './icones.js';

export const echapper = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const RE_LIEN = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;

/** Lien externe ouvert dans un nouvel onglet, avec une icône pour le signaler. */
export const lienExterne = (url, texte) =>
  `<a class="lien-externe" href="${echapper(url)}" target="_blank" rel="noopener noreferrer">${echapper(texte)}<span aria-hidden="true"> ↗</span><span class="visuellement-cache"> (nouvel onglet)</span></a>`;

const enLigne = (s) => {
  const morceaux = [];
  let dernier = 0;
  for (const m of s.matchAll(RE_LIEN)) {
    morceaux.push(echapper(s.slice(dernier, m.index)));
    morceaux.push(lienSur(m[2]) ? lienExterne(m[2], m[1]) : echapper(m[1]));
    dernier = m.index + m[0].length;
  }
  morceaux.push(echapper(s.slice(dernier)));
  return morceaux.join('').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
};
// Texte lu à voix haute : sans les marques de mise en forme ni les adresses des liens.
const sansMarques = (s) => s.replace(RE_LIEN, '$1').replace(/\*\*/g, '');

function blocsEnHtml(lignes) {
  let html = '';
  let texte = [];
  let liste = null;
  let encadre = null;
  let para = [];

  const fermerPara = () => {
    if (para.length) {
      const t = para.join(' ');
      html += `<p>${enLigne(t)}</p>`;
      texte.push(sansMarques(t));
      para = [];
    }
  };
  const fermerListe = () => {
    if (liste) {
      html += `<ul>${liste.map((l) => `<li>${enLigne(l)}</li>`).join('')}</ul>`;
      texte.push(...liste.map(sansMarques));
      liste = null;
    }
  };
  const fermerEncadre = () => {
    if (encadre) {
      // « > **À retenir :** … » devient un encadré avec une étiquette.
      const RE_ETIQUETTE = /^\*\*À retenir\s*:\*\*\s*/;
      const avecEtiquette = RE_ETIQUETTE.test(encadre[0]);
      const majuscule = (t) => t.charAt(0).toLocaleUpperCase('fr') + t.slice(1);
      const lignes = avecEtiquette ? [majuscule(encadre[0].replace(RE_ETIQUETTE, '')), ...encadre.slice(1)] : encadre;
      html += `<aside class="a-retenir">${avecEtiquette ? `<p class="a-retenir-titre">${ic('ampoule', 'ic ic-texte')} À retenir</p>` : ''}${lignes.filter((l) => l.trim()).map((l) => `<p>${enLigne(l)}</p>`).join('')}</aside>`;
      texte.push(...encadre.map(sansMarques));
      encadre = null;
    }
  };
  const toutFermer = () => { fermerPara(); fermerListe(); fermerEncadre(); };

  for (const brute of lignes) {
    const l = brute.trimEnd();
    if (!l.trim()) { toutFermer(); continue; }
    if (l.startsWith('### ')) {
      toutFermer();
      html += `<h3>${enLigne(l.slice(4))}</h3>`;
      texte.push(sansMarques(l.slice(4)) + '.');
    } else if (/^\s*[-*] /.test(l)) {
      fermerPara(); fermerEncadre();
      (liste ||= []).push(l.replace(/^\s*[-*] /, ''));
    } else if (l.startsWith('>')) {
      fermerPara(); fermerListe();
      const c = l.replace(/^>\s?/, '');
      if (c.trim()) (encadre ||= []).push(c);
    } else {
      fermerListe(); fermerEncadre();
      para.push(l.trim());
    }
  }
  toutFermer();
  return { html, texte: texte.join('\n') };
}

export function lireCours(md) {
  const lignes = md.replace(/\r/g, '').split('\n');
  let titre = '';
  const intro = [];
  const sections = [];
  let courante = null;

  for (const l of lignes) {
    if (l.startsWith('# ')) { titre = l.slice(2).trim(); continue; }
    const m = l.match(/^## (.+?)\s*(?:\{#([\w-]+)\})?\s*$/);
    if (m) {
      courante = { id: m[2] || `section-${sections.length + 1}`, titre: m[1].trim(), lignes: [] };
      sections.push(courante);
      continue;
    }
    (courante ? courante.lignes : intro).push(l);
  }

  return {
    titre,
    intro: blocsEnHtml(intro),
    sections: sections.map((s) => ({ id: s.id, titre: s.titre, ...blocsEnHtml(s.lignes) })),
  };
}
