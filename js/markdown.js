// Petit lecteur Markdown pour le format restreint des cours.
// Retourne { titre, intro, sections: [{ id, titre, html, texte }] }.

export const echapper = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const enLigne = (s) => echapper(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const sansMarques = (s) => s.replace(/\*\*/g, '');

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
      html += `<aside class="a-retenir">${encadre.map((l) => `<p>${enLigne(l)}</p>`).join('')}</aside>`;
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
