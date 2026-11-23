// Application principale : navigation et écrans.
import { APP_NAME, PARCOURS, THEMES, themeById, EXAMEN, EXAMEN_MODULE, SERIE_ENTRAINEMENT, NB_SITUATIONS, lienSur } from './config.js';
import * as store from './store.js';
import { chargerQuestions, chargerCours, preparer, choisirSerie, tirerExamen, tirerModule, bilan, pointsFaibles, melanger } from './data.js';
import { lireCours, echapper, lienExterne } from './markdown.js';
import * as audio from './audio.js';
import { ic, pastille } from './icones.js';

const $app = document.getElementById('app');
const e = echapper;
let session = null; // QCM ou examen en cours
let minuterie = null;

// ---------- Utilitaires d'affichage ----------

const pct = (x) => `${Math.round((x || 0) * 100)} %`;

function barre(valeur, libelle = '') {
  const v = Math.round((valeur || 0) * 100);
  return `<div class="barre" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" aria-label="${e(libelle)}"><span style="width:${v}%"></span></div>`;
}

function anneau(valeur, taille = 120, texte) {
  const r = 52, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, valeur || 0));
  return `<svg class="anneau" width="${taille}" height="${taille}" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="${r}" class="anneau-fond"/>
    <circle cx="60" cy="60" r="${r}" class="anneau-val" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}"/>
    <text x="60" y="60" class="anneau-txt">${texte ?? Math.round(v * 100) + '%'}</text></svg>`;
}

function entete(titre, retour = '#/') {
  return `<header class="entete-page"><a class="retour" href="${retour}" aria-label="Retour">${ic('retour')}</a><h1>${titre}</h1></header>`;
}

/** Grande carte d'action : bande de couleur, pastille, textes et bouton rond. */
function carteAction({ href, action, attrs = '', icone, titre, texte, meta, couleur, bouton = 'jouer', barreVal }) {
  const contenu = `
    ${pastille(icone)}
    <span class="ca-texte"><strong>${titre}</strong>${texte ? `<small>${texte}</small>` : ''}${meta ? `<span class="ca-meta">${meta}</span>` : ''}${barreVal !== undefined ? barre(barreVal, titre) : ''}</span>
    <span class="rond-action">${ic(bouton)}</span>`;
  const style = couleur ? ` style="--c:${couleur}"` : '';
  return action
    ? `<button class="carte-action" data-action="${action}" ${attrs}${style}>${contenu}</button>`
    : `<a class="carte-action" href="${href}"${style}>${contenu}</a>`;
}

/** Ligne de thème ou de partie : pastille, titre, barre de progression, chevron. */
function ligneTheme({ href, action, attrs = '', icone, titre, barreVal, sousTexte, couleur }) {
  const contenu = `
    ${icone ? pastille(icone, 'petite') : ''}
    <span class="lt-texte"><strong>${titre}</strong>${barreVal !== undefined ? barre(barreVal, titre) : ''}${sousTexte ? `<small>${sousTexte}</small>` : ''}</span>
    <span class="chevron">${ic('chevron')}</span>`;
  const style = couleur ? ` style="--c:${couleur}"` : '';
  return action
    ? `<button class="ligne-theme" data-action="${action}" ${attrs}${style}>${contenu}</button>`
    : `<a class="ligne-theme" href="${href}"${style}>${contenu}</a>`;
}

function afficher(html, actif = '') {
  $app.innerHTML = html;
  document.querySelectorAll('.nav-bas a').forEach((a) => a.classList.toggle('actif', a.dataset.nav === actif));
  document.body.classList.toggle('sans-nav', actif === 'aucun');
  window.scrollTo(0, 0);
  const h1 = $app.querySelector('h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

const parcoursCourant = () => store.getEtat().parcours;
const questions = () => chargerQuestions(parcoursCourant());

// ---------- Écrans ----------

function vueBienvenue() {
  afficher(`
    <section class="bienvenue">
      <div class="hero hero-bienvenue">
        <div class="hero-marque"><span class="logo-marque">${ic('valide')}</span>${APP_NAME}</div>
        <h1>Préparez votre examen civique</h1>
        <p class="hero-texte">Gratuit, à votre rythme, sans inscription. Cours, QCM corrigés et examens blancs.</p>
      </div>
      <div class="chevauche">
        <h2 class="titre-sur-hero">Quel examen préparez-vous ?</h2>
        <div class="pile-cartes">
          ${Object.values(PARCOURS).map((p) => carteAction({
            action: 'choisir-parcours', attrs: `data-p="${p.id}"`, icone: p.icone, couleur: p.couleur,
            titre: p.titre, texte: p.sousTitre, meta: `${EXAMEN.nbQuestions} questions · ${EXAMEN.dureeMinutes} min`,
          })).join('')}
        </div>
        <p class="petit centre">Vous pourrez changer à tout moment dans les réglages.</p>
        <p class="petit centre avertissement">${ic('info', 'ic ic-texte')} Outil indépendant et gratuit, non officiel : il n’est pas édité par l’État. <a href="#/a-propos">En savoir plus</a></p>
      </div>
    </section>`, 'aucun');
}

async function vueAccueil() {
  const qs = await questions();
  const b = bilan(qs);
  const pf = pointsFaibles(qs);
  const p = PARCOURS[parcoursCourant()];
  const examens = store.getEtat().examens[p.id];
  const dernier = examens[examens.length - 1];
  const serie = store.getEtat().activite.serie;

  const outils = [
    ['#/cours', 'cours', 'Cours', '5 thèmes à lire ou écouter', 'var(--c-histoire)'],
    ['#/entrainement', 'crayon', 'S’entraîner', 'QCM avec corrections', 'var(--c-droits)'],
    ['#/progres', 'cible', 'Points faibles', pf.faibles.length ? pf.faibles.length + ' partie' + (pf.faibles.length > 1 ? 's' : '') + ' à travailler' : 'Votre suivi personnalisé', 'var(--c-societe)'],
    ['#/ecouter', 'casque', 'Écouter', 'Les cours en audio', 'var(--c-institutions)'],
  ];

  afficher(`
    <section class="accueil">
      <div class="hero">
        <div class="hero-ligne">
          <div>
            <p class="hero-marque">${ic(p.icone, 'ic ic-texte')} ${p.titre}</p>
            <h1>${b.vues === 0 ? 'Préparez votre examen' : 'Bon retour !'}</h1>
            <p class="hero-texte">${b.vues === 0 ? 'Commencez par un cours ou une première série de questions.' : `Vous maîtrisez <strong>${b.maitrisees}</strong> questions sur ${b.total}.`}</p>
            ${serie > 1 ? `<p class="serie">${ic('flamme', 'ic ic-texte')} ${serie} jours d’affilée</p>` : ''}
          </div>
          ${anneau(b.progression, 104)}
        </div>
      </div>

      <div class="chevauche pile-cartes">
        ${b.aRevoir > 0
          ? carteAction({ href: '#/revision', icone: 'revoir', couleur: 'var(--c-histoire)', titre: 'Mes révisions du jour', texte: `${b.aRevoir} question${b.aRevoir > 1 ? 's' : ''} à revoir pour bien les retenir` })
          : carteAction({ href: '#/entrainement/tout', icone: 'crayon', couleur: 'var(--c-droits)', titre: `${b.vues === 0 ? 'Commencer' : 'Continuer'} l’entraînement`, texte: `Série de ${SERIE_ENTRAINEMENT} questions adaptées à votre niveau` })}
        ${carteAction({ href: '#/examen', icone: 'chrono', couleur: 'var(--c-principes)', titre: 'Examen blanc', texte: 'Comme le jour de l’examen', meta: `${EXAMEN.nbQuestions} questions · ${EXAMEN.dureeMinutes} min` })}
      </div>

      ${dernier ? `
      <p class="carte carte-dernier resultat-ligne ${dernier.reussi ? 'ok' : 'ko'}">${ic(dernier.reussi ? 'valide' : 'fermer', 'ic ic-texte')} Dernier examen blanc : <strong>${dernier.score}/${dernier.total}</strong>${dernier.reussi ? ', réussi' : ', pas encore'} ${dernier.type === 'complet' ? '' : '(module ' + e(themeById(dernier.type)?.court || '') + ')'}</p>` : ''}

      <h2 class="titre-section">Outils de préparation</h2>
      <div class="grille-tuiles">
        ${outils.map(([href, icone, titre, texte, c]) => `<a class="tuile" href="${href}" style="--c:${c}">${pastille(icone)}<strong>${titre}</strong><small>${texte}</small></a>`).join('')}
      </div>

      <h2 class="titre-section">Vos thèmes</h2>
      <div class="liste-themes">
        ${THEMES.map((t) => {
          const bt = bilan(qs.filter((q) => q.t === t.id));
          return ligneTheme({ href: `#/theme/${t.id}`, icone: t.icone, couleur: t.couleur, titre: t.court, barreVal: bt.progression, sousTexte: `${bt.maitrisees}/${bt.total} maîtrisées` });
        }).join('')}
      </div>
      <a class="lien-discret" href="#/reglages">${ic('reglages', 'ic ic-texte')} Réglages : texte, voix, sauvegarde</a>
    </section>`, 'accueil');
}

async function vueTheme(themeId) {
  const t = themeById(themeId);
  if (!t) return naviguer('#/');
  const qs = (await questions()).filter((q) => q.t === t.id);
  const b = bilan(qs);
  const nbSit = qs.filter((q) => q.s).length;
  afficher(`
    ${entete(t.court)}
    <section style="--c:${t.couleur}">
      <div class="bandeau bandeau-theme">
        <div><p class="sur-titre">${ic(t.icone, 'ic ic-texte')} Thème</p><h2>${t.titre}</h2><p>${b.total} questions · ${b.maitrisees} maîtrisées</p></div>
        ${anneau(b.progression, 96)}
      </div>
      <div class="pile-cartes">
        ${carteAction({ href: `#/cours/${t.id}`, icone: 'cours', couleur: t.couleur, titre: 'Lire le cours', texte: 'Les points essentiels, à lire ou à écouter', bouton: 'chevron' })}
        ${carteAction({ href: `#/entrainement/${t.id}`, icone: 'crayon', couleur: t.couleur, titre: 'S’entraîner sur ce thème', texte: `${SERIE_ENTRAINEMENT} questions avec corrections` })}
        ${nbSit ? carteAction({ href: `#/entrainement/situations/${t.id}`, icone: 'boussole', couleur: t.couleur, titre: 'Mises en situation', texte: `${nbSit} cas concrets de la vie quotidienne` }) : ''}
        ${carteAction({ href: `#/examen/${t.id}`, icone: 'chrono', couleur: t.couleur, titre: 'Examen du module', texte: `${EXAMEN_MODULE.nbQuestions} questions, au rythme de l’examen` })}
      </div>
      <h2 class="titre-section">Parties du thème</h2>
      <div class="liste-themes">
        ${Object.entries(t.sousThemes).map(([id, titre]) => {
          const bs = bilan(qs.filter((q) => q.st === id));
          if (!bs.total) return '';
          return ligneTheme({ href: `#/revision/${t.id}/${id}`, titre, barreVal: bs.progression, sousTexte: `${bs.total} questions${bs.reussite !== null ? ' · ' + pct(bs.reussite) + ' de bonnes réponses' : ''}` });
        }).join('')}
      </div>
    </section>`, 'accueil');
}

// ----- Cours -----

// Durée de lecture estimée : environ 130 mots par minute pour un lecteur de niveau A2/B1.
const MOTS_PAR_MINUTE = 130;
const compterMots = (texte) => (texte.match(/\S+/g) || []).length;
function dureeLecture(c) {
  const mots = compterMots(c.intro.texte) + c.sections.filter((s) => s.id !== 'sources').reduce((n, s) => n + compterMots(s.texte), 0);
  return Math.max(1, Math.round(mots / MOTS_PAR_MINUTE));
}

async function vueListeCours() {
  const qs = await questions();
  const cours = await Promise.all(THEMES.map(async (t) => {
    const md = await chargerCours(t.id);
    return md ? lireCours(md) : null;
  }));
  afficher(`
    ${entete('Cours')}
    <p class="intro-page">Un cours par thème de l’examen, en français simple. Lisez-les ou écoutez-les comme un podcast.</p>
    <div class="pile-cartes">
      ${THEMES.map((t, i) => {
        const c = cours[i];
        const bt = bilan(qs.filter((q) => q.t === t.id));
        const parties = c ? c.sections.filter((s) => s.id !== 'sources').length : 0;
        return carteAction({
          href: `#/cours/${t.id}`, icone: t.icone, couleur: t.couleur, titre: t.titre, bouton: 'chevron',
          meta: c ? `${parties} parties · ${dureeLecture(c)} min` : 'Bientôt disponible',
          barreVal: bt.progression,
        });
      }).join('')}
    </div>
    ${audio.audioDisponible ? `<h2 class="titre-section">Plutôt écouter ?</h2>
    ${carteAction({ href: '#/ecouter', icone: 'casque', couleur: 'var(--c-institutions)', titre: 'Écouter les cours', texte: 'Comme un podcast : dans les transports, en cuisinant…' })}` : ''}`, 'cours');
}

async function vueCours(themeId, sectionId) {
  const t = themeById(themeId);
  if (!t) return naviguer('#/cours');
  const md = await chargerCours(themeId);
  if (!md) {
    afficher(`${entete(t.court, '#/cours')}<div class="carte"><p>Ce cours est en cours de rédaction. Revenez bientôt !</p></div>`, 'cours');
    return;
  }
  const c = lireCours(md);
  const parties = c.sections.filter((s) => s.id !== 'sources');
  const sources = c.sections.find((s) => s.id === 'sources');
  const iTheme = THEMES.findIndex((x) => x.id === t.id);
  const suivant = THEMES[(iTheme + 1) % THEMES.length];

  afficher(`
    <div class="barre-lecture" aria-hidden="true"><span id="progression-lecture"></span></div>
    <div class="hero hero-cours" style="--c:${t.couleur}">
      <div class="hero-haut">
        <a class="retour retour-hero" href="#/cours" aria-label="Retour à la liste des cours">${ic('retour')}</a>
        <span class="hero-marque">${ic(t.icone, 'ic ic-texte')} Cours · thème ${iTheme + 1} sur ${THEMES.length}</span>
      </div>
      <h1>${e(c.titre || t.titre)}</h1>
      <p class="hero-texte">${parties.length} parties · ${dureeLecture(c)} min de lecture</p>
      ${audio.audioDisponible ? `<button class="bouton bouton-clair" data-action="ecouter-cours" data-theme="${t.id}">${ic('casque')} Écouter tout le cours</button>` : ''}
    </div>

    <article class="cours chevauche" style="--c:${t.couleur}">
      <div class="carte intro-cours">${c.intro.html}</div>

      <nav class="carte sommaire" aria-label="Sommaire du cours">
        <h2>Sommaire</h2>
        <ol>
          ${parties.map((s, i) => `<li><a href="#/cours/${t.id}/${s.id}"><span class="num">${i + 1}</span><span class="sommaire-titre">${e(s.titre)}</span>${ic('chevron')}</a></li>`).join('')}
        </ol>
      </nav>

      ${parties.map((s, i) => `
        <section class="carte section-cours" id="sec-${s.id}" aria-labelledby="titre-${s.id}">
          <p class="section-num"><span class="num">${i + 1}</span> Partie ${i + 1} sur ${parties.length}</p>
          <h2 id="titre-${s.id}">${e(s.titre)}</h2>
          ${s.html}
          <div class="actions-section">
            ${audio.audioDisponible ? `<button class="bouton secondaire" data-action="ecouter-cours" data-theme="${t.id}" data-index="${i}">${ic('casque')} Écouter</button>` : ''}
            <a class="bouton" href="#/revision/${t.id}/${s.id}">${ic('crayon')} S’entraîner</a>
          </div>
        </section>`).join('')}

      ${sources ? `<details class="carte sources-cours"><summary>${ic('droits', 'ic ic-texte')} Sources de ce cours</summary>${sources.html}</details>` : ''}

      <h2 class="titre-section">Et ensuite ?</h2>
      <div class="pile-cartes">
        ${carteAction({ href: `#/entrainement/${t.id}`, icone: 'crayon', couleur: t.couleur, titre: 'Vérifier ce que j’ai retenu', texte: `${SERIE_ENTRAINEMENT} questions sur ce thème` })}
        ${carteAction({ href: `#/cours/${suivant.id}`, icone: suivant.icone, couleur: suivant.couleur, titre: `Cours suivant : ${suivant.court}`, texte: suivant.titre, bouton: 'chevron' })}
      </div>
    </article>`, 'cours');
  majProgressionLecture();
  if (sectionId) document.getElementById('sec-' + sectionId)?.scrollIntoView({ block: 'start' });
}

/** Barre fine en haut de l'écran : avancement de la lecture du cours. */
function majProgressionLecture() {
  const el = document.getElementById('progression-lecture');
  if (!el) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  el.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
}
window.addEventListener('scroll', majProgressionLecture, { passive: true });

// ----- Écoute (podcast) -----

async function pistesTheme(themeId) {
  const md = await chargerCours(themeId);
  if (!md) return [];
  const t = themeById(themeId);
  return lireCours(md).sections.filter((s) => s.id !== 'sources').map((s) => ({ titre: s.titre, texte: s.texte, theme: t.court, themeId }));
}

async function vueEcouter() {
  if (!audio.audioDisponible) {
    afficher(`${entete('Écouter')}<div class="carte"><p>Votre navigateur ne permet pas la lecture audio. Essayez avec Chrome, Edge ou Safari.</p></div>`, 'ecouter');
    return;
  }
  const blocs = [];
  for (const t of THEMES) blocs.push({ t, pistes: await pistesTheme(t.id) });
  afficher(`
    ${entete('Écouter les cours', '#/cours')}
    <p class="intro-page">Écoutez les cours comme un podcast : dans les transports, en cuisinant… Choisissez un thème ou une partie.</p>
    <div id="lecteur"></div>
    ${blocs.map(({ t, pistes }) => `
      <div class="carte bloc-ecoute" style="--c:${t.couleur}">
        <div class="bloc-ecoute-tete">
          ${pastille(t.icone, 'petite')}
          <span class="lt-texte"><strong>${t.court}</strong><small>${pistes.length ? `${pistes.length} parties` : 'Bientôt disponible'}</small></span>
          ${pistes.length ? `<button class="rond-action" data-action="ecouter-cours" data-theme="${t.id}" aria-label="Écouter tout le cours ${e(t.court)}">${ic('jouer')}</button>` : ''}
        </div>
        <ol class="pistes">${pistes.map((p, i) => `<li><button class="piste" data-action="ecouter-cours" data-theme="${t.id}" data-index="${i}"><span class="num">${i + 1}</span><span class="piste-titre">${e(p.titre)}</span>${ic('jouer', 'ic ic-piste')}</button></li>`).join('')}</ol>
      </div>`).join('')}`, 'ecouter');
  majLecteur(audio.etatAudio());
}

function majLecteur(s) {
  let el = document.getElementById('lecteur-flottant');
  if (s.statut === 'arret' && !s.piste) { el?.remove(); return; }
  if (s.statut === 'arret') { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'lecteur-flottant';
    el.className = 'lecteur';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="lecteur-info"><small>${e(s.piste?.theme || 'Lecture')}</small><strong>${e(s.piste?.titre || '')}</strong>${barre(s.progression, 'Avancement')}</div>
    <div class="lecteur-boutons">
      <button data-action="audio-prec" aria-label="Précédent">${ic('retour')}</button>
      <button data-action="audio-pause" class="lecteur-play" aria-label="${s.statut === 'lecture' ? 'Pause' : 'Lecture'}">${s.statut === 'lecture' ? '<span class="pause" aria-hidden="true"></span>' : ic('jouer')}</button>
      <button data-action="audio-suiv" aria-label="Suivant">${ic('chevron')}</button>
      <button data-action="audio-stop" aria-label="Arrêter">${ic('fermer')}</button>
    </div>`;
}

// Écouter un thème : on enchaîne ses parties à partir de celle choisie.
async function lancerEcoute(themeId, index) {
  const pistes = await pistesTheme(themeId);
  if (pistes.length) audio.ecouter(pistes, Math.max(0, Number(index) || 0), majLecteur);
}

// ----- Entraînement -----

async function vueChoixEntrainement() {
  const qs = await questions();
  const sit = qs.filter((q) => q.s);
  afficher(`
    ${entete('S’entraîner')}
    <p class="intro-page">Répondez aux questions et découvrez tout de suite la correction. Les questions que vous ratez reviendront plus tard pour être bien retenues.</p>
    <div class="pile-cartes">${carteAction({ href: '#/entrainement/tout', icone: 'des', couleur: 'var(--c-droits)', titre: 'Tous les thèmes', texte: `${SERIE_ENTRAINEMENT} questions choisies pour vous` })}
    ${sit.length ? carteAction({ href: '#/entrainement/situations', icone: 'boussole', couleur: 'var(--c-histoire)', titre: 'Mises en situation', texte: 'Des cas concrets de la vie quotidienne', meta: `${NB_SITUATIONS} questions sur ${EXAMEN.nbQuestions} à l’examen` }) : ''}</div>
    <h2 class="titre-section">Par thème</h2>
    <div class="liste-themes">
      ${THEMES.map((t) => {
        const bt = bilan(qs.filter((q) => q.t === t.id));
        return `<a class="ligne-theme" href="#/entrainement/${t.id}" style="--c:${t.couleur}">
          ${pastille(t.icone, 'petite')}
          <span class="lt-texte"><strong>${t.court}</strong>${barre(bt.progression, t.court)}<small>${bt.total} questions · ${bt.vues} déjà vues</small></span>
          <span class="chevron">${ic('chevron')}</span></a>`;
      }).join('')}
    </div>`, 'entrainement');
}

async function demarrerEntrainement(themeId, stId, titre, retour) {
  let qs = await questions();
  if (themeId === 'situations') {
    // #/entrainement/situations ou #/entrainement/situations/<theme>
    qs = qs.filter((q) => q.s && (!stId || q.t === stId));
  } else {
    if (themeId && themeId !== 'tout') qs = qs.filter((q) => q.t === themeId);
    if (stId) qs = qs.filter((q) => q.st === stId);
  }
  const serie = choisirSerie(qs, SERIE_ENTRAINEMENT).map(preparer);
  if (!serie.length) return naviguer('#/entrainement');
  session = { mode: 'entrainement', titre, retour, questions: serie, i: 0, reponses: [], verrou: false };
  vueQuestion();
}

async function demarrerRevisionDuJour() {
  const qs = await questions();
  const dues = qs.filter((q) => store.estARevoir(q.id));
  const serie = melanger(dues).slice(0, 15).map(preparer);
  if (!serie.length) { toast('Aucune révision prévue aujourd’hui'); return naviguer('#/'); }
  session = { mode: 'entrainement', titre: 'Révisions du jour', retour: '#/', questions: serie, i: 0, reponses: [], verrou: false };
  vueQuestion();
}

function vueQuestion() {
  const s = session;
  const q = s.questions[s.i];
  const t = themeById(q.t);
  const examen = s.mode === 'examen';
  const choisie = s.reponses[s.i];
  const nbRepondues = s.reponses.filter((r) => r !== undefined).length;
  const avance = examen ? nbRepondues / s.questions.length : (s.i + (s.verrou ? 1 : 0)) / s.questions.length;
  afficher(`
    <div class="quiz" style="--c:${t.couleur}">
      <header class="quiz-tete">
        <button class="retour" data-action="quitter" aria-label="Quitter">${ic('fermer')}</button>
        <div class="quiz-avance">
          <div class="quiz-avance-texte"><strong>Question ${s.i + 1}</strong><small> sur ${s.questions.length}</small></div>
          ${barre(avance, 'Avancement')}
        </div>
        ${examen ? `<div class="chrono" aria-live="off">${ic('chrono', 'ic ic-texte')}<span id="chrono">--:--</span></div>` : ''}
      </header>

      <div class="carte carte-question">
        <div class="quiz-etiquettes">
          <span class="etiquette">${ic(t.icone, 'ic ic-texte')} ${t.court}</span>
          ${q.s ? `<span class="etiquette etiquette-situation">${ic('boussole', 'ic ic-texte')} Mise en situation</span>` : ''}
        </div>
        <h1 class="quiz-question">${e(q.q)}</h1>
        ${audio.audioDisponible ? `<button class="lien-audio" data-action="lire-question">${ic('son', 'ic ic-texte')} Écouter la question</button>` : ''}
      </div>

      <div class="options" role="group" aria-label="Réponses possibles">
        ${q.options.map((o, k) => {
          let cls = '';
          let etat = '';
          if (examen) cls = choisie === k ? 'choisie' : '';
          else if (s.verrou) {
            cls = k === q.bonne ? 'juste' : choisie === k ? 'fausse' : 'eteinte';
            if (k === q.bonne) etat = `<span class="etat-option">${ic('valide')}<span class="visuellement-cache">(bonne réponse)</span></span>`;
            else if (choisie === k) etat = `<span class="etat-option">${ic('fermer')}<span class="visuellement-cache">(votre réponse)</span></span>`;
          }
          return `<button class="option ${cls}" data-action="repondre" data-k="${k}" ${!examen && s.verrou ? 'disabled' : ''}>
            <span class="lettre">${'ABCD'[k]}</span><span class="option-texte">${e(o)}</span>${etat}</button>`;
        }).join('')}
      </div>

      <div id="retour-q">${!examen && s.verrou ? blocCorrection(q, choisie) : ''}</div>

      ${examen ? `<details class="carte grille-exam"><summary>${ic('des', 'ic ic-texte')} Vue d’ensemble : ${nbRepondues}/${s.questions.length} répondues</summary>
        <div class="grille-num">${s.questions.map((_, k) => `<button data-action="aller" data-k="${k}" class="${s.reponses[k] !== undefined ? 'faite' : ''} ${k === s.i ? 'courante' : ''}" aria-label="Question ${k + 1}${s.reponses[k] !== undefined ? ', répondue' : ''}">${k + 1}</button>`).join('')}</div></details>` : ''}

      ${examen || s.verrou ? `<div class="quiz-pied">
        ${examen ? `
          <button class="bouton secondaire" data-action="prec" ${s.i === 0 ? 'disabled' : ''}>${ic('retour')} Précédente</button>
          ${s.i < s.questions.length - 1 ? `<button class="bouton" data-action="suiv">Suivante ${ic('chevron')}</button>` : `<button class="bouton bouton-ok" data-action="terminer">${ic('valide')} Terminer</button>`}
        ` : `<button class="bouton large" data-action="suiv" id="btn-suiv">${s.i < s.questions.length - 1 ? `Question suivante ${ic('chevron')}` : `Voir mon résultat ${ic('chevron')}`}</button>`}
      </div>` : ''}
    </div>`, 'aucun');
  if (examen) majChrono();
}

function blocCorrection(q, choisie) {
  const ok = choisie === q.bonne;
  return `<div class="correction ${ok ? 'ok' : 'ko'}" role="status">
    <div class="correction-tete">
      <span class="rond-etat">${ic(ok ? 'valide' : 'fermer')}</span>
      <span><strong>${ok ? 'Bonne réponse !' : 'Pas tout à fait'}</strong><small>${ok ? 'Bravo, continuez comme ça.' : 'Pas de souci : cette question reviendra dans vos révisions.'}</small></span>
    </div>
    ${ok ? '' : `<div class="bonne-reponse"><small>La bonne réponse</small><strong>${ic('valide', 'ic ic-texte')} ${e(q.a)}</strong></div>`}
    ${q.e ? `<div class="explication"><p class="explication-titre">${ic('ampoule', 'ic ic-texte')} Explication</p><p>${e(q.e)}</p></div>` : ''}
    ${blocLiens(q, true)}
  </div>`;
}

/** Liens sous une correction : retour au cours et sites sûrs « pour aller plus loin ». */
function blocLiens(q, avecCours = false) {
  const liens = (q.l || []).filter((l) => lienSur(l.url));
  if (!liens.length && !avecCours) return '';
  return `<div class="correction-liens">
    ${avecCours ? `<a class="puce-lien" href="#/cours/${q.t}/${q.st}">${ic('cours', 'ic ic-texte')} Revoir le cours</a>` : ''}
    ${liens.map((l) => lienExterne(l.url, l.titre)).join('')}
  </div>`;
}

function repondre(k) {
  const s = session;
  if (!s) return;
  if (s.mode === 'examen') {
    s.reponses[s.i] = k;
    vueQuestion();
    return;
  }
  if (s.verrou) return;
  s.reponses[s.i] = k;
  s.verrou = true;
  const q = s.questions[s.i];
  store.enregistrerReponse(q.id, k === q.bonne);
  if (navigator.vibrate && k !== q.bonne) navigator.vibrate(60);
  vueQuestion();
  document.getElementById('retour-q')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('btn-suiv')?.focus({ preventScroll: true });
}

function suivante() {
  const s = session;
  if (s.mode !== 'examen' && s.i >= s.questions.length - 1) return vueResultatEntrainement();
  s.i = Math.min(s.i + 1, s.questions.length - 1);
  s.verrou = false;
  vueQuestion();
}

/** Bandeau de résultat : anneau, titre et chiffres clés. */
function heroResultat({ reussi, sur, retour, score, total, titre, texte, stats }) {
  return `
    <div class="hero hero-resultat ${reussi ? 'reussi' : ''}">
      <div class="hero-haut">
        <a class="retour retour-hero" href="${retour}" aria-label="Fermer">${ic('fermer')}</a>
        <span class="hero-marque">${sur}</span>
      </div>
      <div class="resultat-centre">
        ${anneau(score / total, 140, `${score}/${total}`)}
        ${reussi !== undefined ? `<span class="badge-resultat">${ic(reussi ? 'valide' : 'cible', 'ic ic-texte')} ${reussi ? 'Réussi' : 'Pas encore réussi'}</span>` : ''}
        <h1>${titre}</h1>
        <p class="hero-texte">${texte}</p>
      </div>
      <div class="stats">${stats.map(([n, l]) => `<div class="stat"><strong>${n}</strong><small>${l}</small></div>`).join('')}</div>
    </div>`;
}

/** Carte de correction d'une question (résultats d'entraînement et d'examen). */
function carteCorrection(q, k, reponse) {
  const ok = reponse === q.bonne;
  const t = themeById(q.t);
  return `<article class="carte-corr ${ok ? 'ok' : 'ko'}" style="--c:${t.couleur}">
    <div class="corr-tete">
      <span class="etat-mini">${ic(ok ? 'valide' : 'fermer')}</span>
      <span class="corr-num">Question ${k + 1}</span>
      <span class="corr-theme">${ic(t.icone, 'ic ic-texte')} ${t.court}</span>
    </div>
    <p class="cq">${e(q.q)}</p>
    ${ok ? '' : `<p class="votre-rep">${ic('fermer', 'ic ic-texte')} <span><small>Votre réponse</small>${reponse === undefined ? '<em>aucune réponse</em>' : e(q.options[reponse])}</span></p>`}
    <p class="bonne-rep">${ic('valide', 'ic ic-texte')} <span>${ok ? '' : '<small>Bonne réponse</small>'}${e(q.a)}</span></p>
    ${!ok && q.e ? `<details class="corr-explication"><summary>${ic('ampoule', 'ic ic-texte')} Voir l’explication</summary><p>${e(q.e)}</p>${blocLiens(q, true)}</details>` : ''}
  </article>`;
}

function vueResultatEntrainement() {
  const s = session;
  const bonnes = s.questions.filter((q, k) => s.reponses[k] === q.bonne).length;
  const total = s.questions.length;
  const ratio = bonnes / total;
  const retour = s.retour || '#/entrainement';
  session = null;
  const ratees = s.questions.map((q, k) => [q, k]).filter(([q, k]) => s.reponses[k] !== q.bonne);
  afficher(`
    <section class="resultat">
      ${heroResultat({
        reussi: ratio >= 0.8 ? true : undefined, sur: `${ic('crayon', 'ic ic-texte')} ${s.titre ? e(s.titre) : 'Série terminée'}`, retour,
        score: bonnes, total,
        titre: ratio === 1 ? 'Parfait !' : ratio >= 0.8 ? 'Très bien !' : ratio >= 0.5 ? 'C’est un bon début' : 'Continuez, vous progressez',
        texte: ratees.length ? 'Les questions ratées reviendront dans vos révisions pour bien les retenir.' : 'Toutes les réponses sont justes.',
        stats: [[bonnes, 'bonnes réponses'], [total - bonnes, total - bonnes > 1 ? 'erreurs' : 'erreur'], [`${Math.round(ratio * 100)} %`, 'de réussite']],
      })}
      <div class="chevauche pile-cartes">
        ${carteAction({ action: 'rejouer', icone: 'revoir', couleur: 'var(--c-droits)', titre: 'Nouvelle série', texte: `${SERIE_ENTRAINEMENT} autres questions adaptées à votre niveau` })}
        ${carteAction({ href: '#/progres', icone: 'cible', couleur: 'var(--c-societe)', titre: 'Voir mes points faibles', texte: 'Les parties à travailler en priorité', bouton: 'chevron' })}
      </div>
      ${ratees.length ? `<h2 class="titre-section">À retenir (${ratees.length})</h2>
        <div class="liste-corrections">${ratees.map(([q, k]) => carteCorrection(q, k, s.reponses[k])).join('')}</div>` : ''}
      <a class="lien-discret" href="${retour}">${ic('retour', 'ic ic-texte')} Retour</a>
    </section>`, 'aucun');
  dernierLancement.retour = retour;
}

const dernierLancement = { fn: null, retour: '' };

// ----- Examen blanc -----

async function vueChoixExamen() {
  const ex = store.getEtat().examens[parcoursCourant()];
  afficher(`
    ${entete('Examen blanc')}
    <div class="carte info-exam">
      <h2>Comme le jour de l’examen</h2>
      <ul>
        <li><strong>${EXAMEN.nbQuestions} questions</strong> sur les 5 thèmes, dont <strong>${NB_SITUATIONS} mises en situation</strong></li>
        <li><strong>${EXAMEN.dureeMinutes} minutes</strong> maximum</li>
        <li>Il faut <strong>${EXAMEN.seuil} bonnes réponses</strong> (80 %) pour réussir</li>
        <li>La correction s’affiche à la fin</li>
      </ul>
    </div>
    ${carteAction({ action: 'examen', attrs: 'data-type="complet"', icone: 'chrono', couleur: 'var(--c-principes)', titre: 'Lancer l’examen complet', texte: 'Comme le jour de l’examen', meta: `${EXAMEN.nbQuestions} questions · ${EXAMEN.dureeMinutes} minutes` })}
    <h2 class="titre-section">Examen par module</h2>
    <p class="intro-page">${EXAMEN_MODULE.nbQuestions} questions sur un seul thème, au même rythme que l’examen.</p>
    <div class="liste-themes">
      ${THEMES.map((t) => `<button class="ligne-theme" data-action="examen" data-type="${t.id}" style="--c:${t.couleur}">
        ${pastille(t.icone, 'petite')}<span class="lt-texte"><strong>${t.court}</strong>
        <small>${dernierScore(ex, t.id)}</small></span><span class="chevron">${ic('chevron')}</span></button>`).join('')}
    </div>
    ${ex.length ? `<h2 class="titre-section">Historique</h2><div class="carte"><ol class="historique">${ex.slice(-8).reverse().map((r) => `
      <li><span>${new Date(r.date).toLocaleDateString('fr-FR')} · ${r.type === 'complet' ? 'Examen complet' : e(themeById(r.type)?.court || '')}</span>
      <strong class="${r.reussi ? 'ok' : 'ko'}">${r.score}/${r.total}</strong></li>`).join('')}</ol></div>` : ''}`, 'examen');
}

function dernierScore(ex, type) {
  const r = [...ex].reverse().find((x) => x.type === type);
  return r ? `Dernier score : ${r.score}/${r.total}` : 'Pas encore passé';
}

async function demarrerExamen(type) {
  const qs = await questions();
  let liste, duree;
  if (type === 'complet') {
    liste = tirerExamen(qs);
    duree = EXAMEN.dureeMinutes * 60;
  } else {
    liste = tirerModule(qs, type, EXAMEN_MODULE.nbQuestions);
    duree = liste.length * EXAMEN_MODULE.secondesParQuestion;
  }
  session = { mode: 'examen', type, questions: liste.map(preparer), i: 0, reponses: [], fin: Date.now() + duree * 1000, debut: Date.now() };
  clearInterval(minuterie);
  minuterie = setInterval(majChrono, 1000);
  vueQuestion();
}

function majChrono() {
  if (!session || session.mode !== 'examen') { clearInterval(minuterie); return; }
  const reste = Math.max(0, Math.round((session.fin - Date.now()) / 1000));
  const el = document.getElementById('chrono');
  if (el) {
    el.textContent = `${String(Math.floor(reste / 60)).padStart(2, '0')}:${String(reste % 60).padStart(2, '0')}`;
    el.parentElement?.classList.toggle('urgent', reste < 300);
  }
  if (reste === 0) { toast('Temps écoulé !'); terminerExamen(); }
}

function terminerExamen() {
  clearInterval(minuterie);
  const s = session;
  if (!s) return;
  s.questions.forEach((q, k) => store.enregistrerReponse(q.id, s.reponses[k] === q.bonne));
  const score = s.questions.filter((q, k) => s.reponses[k] === q.bonne).length;
  const total = s.questions.length;
  const reussi = s.type === 'complet' ? score >= EXAMEN.seuil : score / total >= 0.8;
  const dureeMin = Math.max(1, Math.round((Date.now() - s.debut) / 60000));
  store.enregistrerExamen({ type: s.type, score, total, reussi, duree: Math.round((Date.now() - s.debut) / 1000) });
  session = null;

  const parTheme = THEMES.map((t) => {
    const idx = s.questions.map((q, k) => (q.t === t.id ? k : -1)).filter((k) => k >= 0);
    return { t, n: idx.length, ok: idx.filter((k) => s.reponses[k] === s.questions[k].bonne).length };
  }).filter((x) => x.n);
  const nbErreurs = total - score;
  const seuil = s.type === 'complet' ? EXAMEN.seuil : Math.ceil(total * 0.8);

  afficher(`
    <section class="resultat">
      ${heroResultat({
        reussi, retour: '#/examen',
        sur: `${ic('chrono', 'ic ic-texte')} ${s.type === 'complet' ? 'Examen blanc complet' : `Examen du module ${e(themeById(s.type)?.court || '')}`}`,
        score, total,
        titre: reussi ? 'Examen réussi !' : 'Pas encore… mais vous progressez',
        texte: reussi ? `Vous avez dépassé le seuil de ${seuil} bonnes réponses.` : `Il fallait ${seuil} bonnes réponses sur ${total}. Encore ${Math.max(0, seuil - score)} pour réussir.`,
        stats: [[score, 'bonnes réponses'], [nbErreurs, nbErreurs > 1 ? 'erreurs' : 'erreur'], [`${dureeMin} min`, 'de durée']],
      })}
      <div class="chevauche pile-cartes">
        ${carteAction({ href: '#/progres', icone: 'cible', couleur: 'var(--c-societe)', titre: 'Travailler mes points faibles', texte: 'Un rappel du cours, puis des questions ciblées', bouton: 'chevron' })}
        ${carteAction({ action: 'examen', attrs: `data-type="${s.type}"`, icone: 'revoir', couleur: 'var(--c-principes)', titre: 'Repasser un examen', texte: 'Avec de nouvelles questions' })}
      </div>
      ${parTheme.length > 1 ? `<h2 class="titre-section">Résultat par thème</h2>
        <div class="carte score-themes">${parTheme.map((x) => `
          <div class="score-theme" style="--c:${x.t.couleur}">
            ${pastille(x.t.icone, 'petite')}
            <span class="st-texte"><span class="st-ligne"><strong>${x.t.court}</strong><span class="st-score ${x.ok / x.n >= 0.8 ? 'ok' : 'ko'}">${x.ok}/${x.n}</span></span>${barre(x.ok / x.n, x.t.court)}</span>
          </div>`).join('')}</div>` : ''}
      <h2 class="titre-section">Correction</h2>
      ${nbErreurs ? `<div class="segments filtre-correction" role="group" aria-label="Filtrer la correction">
        <button data-action="filtre-correction" data-f="ko" class="actif">Mes erreurs (${nbErreurs})</button>
        <button data-action="filtre-correction" data-f="tout">Toutes (${total})</button>
      </div>` : ''}
      <div class="liste-corrections ${nbErreurs ? 'que-erreurs' : ''}" id="liste-corrections">
        ${s.questions.map((q, k) => carteCorrection(q, k, s.reponses[k])).join('')}
      </div>
    </section>`, 'aucun');
}

// ----- Progrès et points faibles -----

async function vueProgres() {
  const qs = await questions();
  const b = bilan(qs);
  const pf = pointsFaibles(qs);
  const forts = pf.evalues.filter((r) => !pf.faibles.includes(r));

  // Une partie : pastille du thème, titre, barre de réussite, pastille de score à droite.
  const niveau = (x) => (x === null || x === undefined ? '' : x >= 0.8 ? 'ok' : x >= 0.5 ? 'moyen' : 'ko');
  const ligne = (r) => `<a class="ligne-pf" href="#/revision/${r.theme.id}/${r.stId}" style="--c:${r.theme.couleur}">
      ${pastille(r.theme.icone, 'petite')}
      <span class="lt-texte"><strong>${e(r.titre)}</strong>
        <small>${r.theme.court}${r.aRevoir ? ` · <span class="a-revoir">${r.aRevoir} à revoir</span>` : ''} · ${r.maitrisees}/${r.total} maîtrisées</small></span>
      ${r.reussite !== null ? `<span class="score-pf ${niveau(r.reussite)}">${pct(r.reussite)}</span>` : `<span class="chevron">${ic('chevron')}</span>`}
    </a>`;

  afficher(`
    <section>
      <div class="hero">
        <div class="hero-ligne">
          <div>
            <p class="hero-marque">${ic('cible', 'ic ic-texte')} Mes progrès</p>
            <h1>${b.vues === 0 ? 'Votre suivi personnalisé' : b.reussite >= 0.8 ? 'Vous êtes sur la bonne voie' : 'Continuez, ça avance'}</h1>
            <p class="hero-texte">${b.vues === 0 ? 'L’application repère les parties où vous faites des erreurs.' : `<strong>${b.maitrisees}</strong> questions maîtrisées sur ${b.total}.`}</p>
          </div>
          ${anneau(b.progression, 104)}
        </div>
        ${b.vues ? `<div class="stats">
          <div class="stat"><strong>${b.vues}</strong><small>questions vues</small></div>
          <div class="stat"><strong>${b.reussite !== null ? pct(b.reussite) : '–'}</strong><small>de bonnes réponses</small></div>
          <div class="stat"><strong>${b.aRevoir}</strong><small>à revoir</small></div>
        </div>` : ''}
      </div>

      <div class="chevauche pile-cartes">
        ${b.aRevoir
          ? carteAction({ href: '#/revision', icone: 'revoir', couleur: 'var(--c-histoire)', titre: 'Révisions du jour', texte: `${b.aRevoir} question${b.aRevoir > 1 ? 's' : ''} à revoir maintenant` })
          : carteAction({ href: '#/entrainement/tout', icone: 'crayon', couleur: 'var(--c-droits)', titre: b.vues ? 'Continuer l’entraînement' : 'Faire une première série', texte: b.vues ? 'Aucune révision prévue aujourd’hui' : `${SERIE_ENTRAINEMENT} questions pour établir votre bilan` })}
      </div>

      ${b.vues ? `<h2 class="titre-section">Par thème</h2>
      <div class="carte score-themes">
        ${THEMES.map((t) => {
          const bt = bilan(qs.filter((q) => q.t === t.id));
          return `<a class="score-theme lien-bloc" href="#/theme/${t.id}" style="--c:${t.couleur}">
            ${pastille(t.icone, 'petite')}
            <span class="st-texte"><span class="st-ligne"><strong>${t.court}</strong><span class="st-score">${bt.maitrisees}/${bt.total}</span></span>${barre(bt.progression, t.court)}</span>
          </a>`;
        }).join('')}
      </div>` : ''}

      ${pf.faibles.length ? `<h2 class="titre-section">À travailler en priorité</h2>
        <p class="intro-page">Touchez une partie : un rappel du cours, puis des questions ciblées jusqu’à ce que ce soit acquis.</p>
        <div class="liste-themes">${pf.faibles.map(ligne).join('')}</div>`
        : b.vues ? `<div class="carte carte-info ok">${ic('valide')}<p>Aucun point faible repéré pour l’instant. Continuez à explorer de nouvelles parties !</p></div>` : ''}

      ${forts.length ? `<details class="repli"><summary>${ic('valide', 'ic ic-texte')} Points forts (${forts.length})</summary><div class="liste-themes">${forts.map(ligne).join('')}</div></details>` : ''}
      ${pf.nonCommences.length && b.vues ? `<details class="repli"><summary>${ic('info', 'ic ic-texte')} Pas encore commencées (${pf.nonCommences.length})</summary><div class="liste-themes">${pf.nonCommences.map(ligne).join('')}</div></details>` : ''}
    </section>`, 'progres');
}

async function vueRevision(themeId, stId) {
  const t = themeById(themeId);
  if (!t || !t.sousThemes[stId]) return naviguer('#/progres');
  const titre = t.sousThemes[stId];
  const qs = (await questions()).filter((q) => q.t === themeId && q.st === stId);
  const b = bilan(qs);
  const md = await chargerCours(themeId);
  const section = md ? lireCours(md).sections.find((s) => s.id === stId) : null;
  const etape = b.maitrise >= 0.8 ? 3 : b.vues ? 2 : 1;
  const etapes = [['cours', 'Relire'], ['crayon', 'S’entraîner'], ['valide', 'Maîtriser']];
  afficher(`
    <div class="hero hero-cours" style="--c:${t.couleur}">
      <div class="hero-haut">
        <a class="retour retour-hero" href="#/progres" aria-label="Retour à mes progrès">${ic('retour')}</a>
        <span class="hero-marque">${ic(t.icone, 'ic ic-texte')} Révision guidée · ${t.court}</span>
      </div>
      <h1>${e(titre)}</h1>
      <p class="hero-texte"><strong>${b.maitrisees}/${b.total}</strong> questions maîtrisées${b.reussite !== null ? ` · ${pct(b.reussite)} de bonnes réponses` : ''}</p>
      <div class="barre-hero">${barre(b.progression, titre)}</div>
    </div>

    <section class="chevauche" style="--c:${t.couleur}">
      <ol class="carte etapes" aria-label="Étapes de la révision">
        ${etapes.map(([icone, nom], i) => `<li class="etape ${i + 1 < etape ? 'faite' : i + 1 === etape ? 'active' : ''}">
          <span>${i + 1 < etape ? ic('valide') : ic(icone)}</span>${nom}</li>`).join('')}
      </ol>

      ${carteAction({ action: 'entrainer-partie', attrs: `data-theme="${themeId}" data-st="${stId}"`, icone: 'crayon', couleur: t.couleur, titre: 'S’entraîner sur cette partie', meta: `${b.total} questions ciblées` })}

      ${section ? `<details class="carte rappel" ${b.vues ? '' : 'open'}>
        <summary><span class="pastille petite">${ic('cours')}</span><span class="lt-texte"><strong>Rappel du cours</strong><small>${b.vues ? 'Touchez pour relire' : 'À lire avant de commencer'}</small></span><span class="chevron">${ic('chevron')}</span></summary>
        <div class="cours">${section.html}</div>
        <div class="actions-section">
          ${audio.audioDisponible ? `<button class="bouton secondaire" data-action="lire-texte" data-texte="${e(section.titre + '. ' + section.texte)}">${ic('casque')} Écouter</button>` : ''}
          <a class="bouton secondaire" href="#/cours/${themeId}/${stId}">${ic('cours')} Tout le cours</a>
        </div>
      </details>` : ''}
    </section>`, 'progres');
}

// ----- Réglages et à propos -----

/** Choix sous forme de boutons (segments), avec icône facultative. */
function segments(cle, valeurs, actuelle) {
  return `<div class="segments" role="group">${valeurs.map(([v, l, icone]) => `<button data-action="pref" data-cle="${cle}" data-v="${v}" class="${String(actuelle) === String(v) ? 'actif' : ''}" aria-pressed="${String(actuelle) === String(v)}">${icone ? ic(icone, 'ic ic-texte') : ''} ${l}</button>`).join('')}</div>`;
}

/** Ligne de réglage : pastille, titre, description, chevron ou contenu à droite. */
function ligneReglage({ action, href, attrs = '', icone, couleur, titre, texte, danger }) {
  const contenu = `${pastille(icone, 'petite')}<span class="lt-texte"><strong>${titre}</strong>${texte ? `<small>${texte}</small>` : ''}</span><span class="chevron">${ic('chevron')}</span>`;
  const cls = `ligne-reglage ${danger ? 'danger' : ''}`;
  const style = ` style="--c:${couleur || 'var(--primaire)'}"`;
  if (href) return `<a class="${cls}" href="${href}"${style}>${contenu}</a>`;
  if (action === 'importer') return `<label class="${cls}"${style}>${contenu}<input type="file" accept="application/json,.json" data-action-change="importer" hidden></label>`;
  return `<button class="${cls}" data-action="${action}" ${attrs}${style}>${contenu}</button>`;
}

function vueReglages() {
  const et = store.getEtat();
  const voix = audio.voixFrancaises();
  afficher(`
    ${entete('Réglages')}

    <h2 class="titre-section titre-reglage">Mon examen</h2>
    <div class="pile-cartes choix-examen">
      ${Object.values(PARCOURS).map((p) => `<button class="choix-radio ${et.parcours === p.id ? 'actif' : ''}" data-action="choisir-parcours" data-p="${p.id}" style="--c:${p.couleur}" aria-pressed="${et.parcours === p.id}">
        ${pastille(p.icone, 'petite')}<span class="lt-texte"><strong>${p.titre}</strong><small>${p.sousTitre}</small></span>
        <span class="radio" aria-hidden="true">${et.parcours === p.id ? ic('valide') : ''}</span></button>`).join('')}
    </div>
    <p class="petit">Chaque examen a sa propre progression.</p>

    <h2 class="titre-section titre-reglage">Affichage</h2>
    <div class="carte reglages-groupe">
      <div class="reglage">
        <p class="reglage-titre">${ic('texte', 'ic ic-texte')} Taille du texte</p>
        ${segments('taille', [['normal', '<span class="apercu-a a1">A</span>'], ['grand', '<span class="apercu-a a2">A</span>'], ['tres-grand', '<span class="apercu-a a3">A</span>']], et.prefs.taille)}
      </div>
      <div class="reglage">
        <p class="reglage-titre">${ic('soleil', 'ic ic-texte')} Apparence</p>
        ${segments('theme', [['auto', 'Auto', 'auto'], ['clair', 'Clair', 'soleil'], ['sombre', 'Sombre', 'lune']], et.prefs.theme)}
      </div>
    </div>

    ${audio.audioDisponible ? `<h2 class="titre-section titre-reglage">Audio</h2>
    <div class="carte reglages-groupe">
      <div class="reglage">
        <p class="reglage-titre">${ic('casque', 'ic ic-texte')} Vitesse de lecture</p>
        ${segments('vitesse', [[0.8, 'Lente'], [1, 'Normale'], [1.2, 'Rapide']], Number(et.prefs.vitesse))}
      </div>
      ${voix.length > 1 ? `<label class="reglage"><span class="reglage-titre">${ic('son', 'ic ic-texte')} Voix</span><select data-action-change="voix">${voix.map((v) => `<option ${v.name === et.prefs.voix ? 'selected' : ''}>${e(v.name)}</option>`).join('')}</select></label>` : ''}
      <button class="bouton secondaire large" data-action="lire-texte" data-texte="Bonjour, voici un exemple de lecture.">${ic('son')} Tester la voix</button>
    </div>` : ''}

    <h2 class="titre-section titre-reglage">Ma progression</h2>
    <div class="carte carte-info">${ic('bouclier')}<p>Votre progression reste <strong>sur cet appareil</strong>. Aucun compte, aucune donnée envoyée. Pour changer d’appareil, téléchargez le fichier puis importez-le.</p></div>
    <div class="groupe-lignes">
      ${ligneReglage({ action: 'exporter', icone: 'telecharger', couleur: 'var(--c-droits)', titre: 'Télécharger ma progression', texte: 'Un fichier à garder ou à transférer' })}
      ${ligneReglage({ action: 'importer', icone: 'importer', couleur: 'var(--c-principes)', titre: 'Importer une progression', texte: 'Depuis un fichier téléchargé avant' })}
      ${ligneReglage({ action: 'reinitialiser', icone: 'corbeille', couleur: 'var(--ko)', titre: 'Effacer la progression', texte: `Seulement pour l’examen « ${PARCOURS[et.parcours].titre} »`, danger: true })}
    </div>

    <h2 class="titre-section titre-reglage">Informations</h2>
    <div class="groupe-lignes">
      ${ligneReglage({ href: '#/a-propos', icone: 'info', couleur: 'var(--c-institutions)', titre: `À propos de ${APP_NAME}`, texte: 'Sources, vie privée, contribuer' })}
    </div>`, 'aucun');
}

function vueAPropos() {
  afficher(`
    ${entete('À propos', '#/reglages')}
    <div class="carte carte-marque">
      <span class="logo-marque logo-plein">${ic('valide')}</span>
      <div><h2>${APP_NAME}</h2><p>Une application <strong>gratuite, sans publicité et open source</strong> pour préparer l’examen civique : naturalisation, carte de résident et carte pluriannuelle.</p></div>
    </div>
    <div class="carte carte-info attention">${ic('attention')}<p>C’est un <strong>outil indépendant</strong> : il n’est pas édité par l’État ni par le ministère de l’Intérieur.</p></div>

    <h2 class="titre-section">${ic('droits', 'ic ic-texte')} Sources</h2>
    <div class="carte texte">
      <ul class="liste-propre">
        <li><strong>Questions</strong> : listes officielles publiées par le ministère de l’Intérieur.</li>
        <li><strong>Réponses</strong> suggérées par <a href="https://leqcmcivique.fr" target="_blank" rel="noopener">leqcmcivique.fr</a>, publiées sur data.gouv.fr sous Licence Ouverte 2.0.</li>
        <li><strong>Mauvaises réponses, explications, mises en situation et cours</strong> : rédigés pour ce projet. Il n’existe pas de liste officielle des mises en situation. Ces contenus peuvent contenir des erreurs : signalez-les !</li>
        <li><strong>Format de l’examen</strong> : 40 questions, dont 12 mises en situation, 45 minutes, 32 bonnes réponses pour réussir (arrêté du 10 octobre 2025).</li>
      </ul>
    </div>

    <h2 class="titre-section">${ic('code', 'ic ic-texte')} Contribuer</h2>
    <div class="carte texte"><p>Le code et le contenu sont ouverts. Vous pouvez signaler une erreur ou proposer une amélioration sur <a href="https://github.com/Nicko887/passeport-civique" target="_blank" rel="noopener">GitHub</a>.</p></div>

    <h2 class="titre-section">${ic('bouclier', 'ic ic-texte')} Vie privée</h2>
    <div class="carte texte"><p>Aucun compte, aucun cookie publicitaire, aucune donnée personnelle collectée. La progression reste sur votre appareil.</p></div>`, 'aucun');
}

// ---------- Navigation ----------

function naviguer(h) {
  if (location.hash === h) routeur();
  else location.hash = h;
}

async function routeur() {
  const h = location.hash.replace(/^#\/?/, '');
  const [r, a, b] = h.split('/');

  if (session?.mode === 'examen' && r !== 'session') {
    if (!confirm('Quitter l’examen ? Vos réponses seront perdues.')) {
      history.replaceState(null, '', '#/session');
      return;
    }
    clearInterval(minuterie);
    session = null;
  } else if (session && r !== 'session') {
    session = null;
  }

  if (!parcoursCourant() && r !== 'a-propos') return vueBienvenue();

  try {
    switch (r) {
      case '': return await vueAccueil();
      case 'theme': return await vueTheme(a);
      case 'cours': return a ? await vueCours(a, b) : await vueListeCours();
      case 'ecouter': return await vueEcouter();
      case 'entrainement':
        if (!a) return await vueChoixEntrainement();
        history.replaceState(null, '', '#/session');
        dernierLancement.fn = () => demarrerEntrainement(a, b || null, null, a === 'situations' && b ? '#/theme/' + b : '#/entrainement');
        return await dernierLancement.fn();
      case 'examen':
        if (!a) return await vueChoixExamen();
        history.replaceState(null, '', '#/session');
        return await demarrerExamen(a);
      case 'progres': return await vueProgres();
      case 'revision':
        if (!a) {
          history.replaceState(null, '', '#/session');
          dernierLancement.fn = demarrerRevisionDuJour;
          return await demarrerRevisionDuJour();
        }
        return await vueRevision(a, b);
      case 'reglages': return vueReglages();
      case 'a-propos': return vueAPropos();
      case 'session': return session ? vueQuestion() : naviguer('#/');
      default: return naviguer('#/');
    }
  } catch (err) {
    console.error(err);
    afficher(`<div class="carte"><h1>Oups</h1><p>Le contenu n’a pas pu être chargé. Vérifiez votre connexion et réessayez.</p><a class="bouton" href="#/">Accueil</a></div>`);
  }
}

// ---------- Actions ----------

function appliquerPrefs() {
  const p = store.getEtat().prefs;
  document.documentElement.dataset.taille = p.taille;
  if (p.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = p.theme === 'sombre' ? 'dark' : 'light';
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  switch (d.action) {
    case 'choisir-parcours':
      store.setParcours(d.p);
      if (location.hash.includes('reglages')) { toast('Examen choisi : ' + PARCOURS[d.p].titre); vueReglages(); }
      else naviguer('#/');
      break;
    case 'repondre': repondre(Number(d.k)); break;
    case 'filtre-correction':
      document.getElementById('liste-corrections')?.classList.toggle('que-erreurs', d.f === 'ko');
      el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('actif', b === el));
      break;
    case 'suiv': suivante(); break;
    case 'prec': session.i = Math.max(0, session.i - 1); vueQuestion(); break;
    case 'aller': session.i = Number(d.k); vueQuestion(); break;
    case 'terminer': {
      const manquantes = session.questions.length - session.reponses.filter((x) => x !== undefined).length;
      if (!manquantes || confirm(`Il reste ${manquantes} question${manquantes > 1 ? 's' : ''} sans réponse. Terminer quand même ?`)) terminerExamen();
      break;
    }
    case 'quitter':
      if (session?.mode === 'examen') {
        if (!confirm('Quitter l’examen ? Vos réponses seront perdues.')) return;
        clearInterval(minuterie);
      }
      { const retour = session?.mode === 'examen' ? '#/examen' : session?.retour || '#/'; session = null; naviguer(retour); }
      break;
    case 'rejouer': if (dernierLancement.fn) { history.replaceState(null, '', '#/session'); await dernierLancement.fn(); } break;
    case 'examen': history.replaceState(null, '', '#/session'); session = null; await demarrerExamen(d.type); break;
    case 'entrainer-partie': {
      const t = themeById(d.theme);
      const retour = location.hash;
      dernierLancement.fn = () => demarrerEntrainement(d.theme, d.st, t.sousThemes[d.st], retour);
      history.pushState(null, '', '#/session');
      await dernierLancement.fn();
      break;
    }
    case 'lire-question': {
      const q = session.questions[session.i];
      audio.ecouter([{ titre: '', texte: q.q + ' ' + q.options.map((o, k) => `Réponse ${'ABCD'[k]} : ${o}.`).join(' ') }], 0, majLecteur);
      break;
    }
    case 'lire-texte': audio.ecouter([{ titre: '', texte: d.texte, theme: 'Lecture' }], 0, majLecteur); break;
    case 'ecouter-cours': await lancerEcoute(d.theme, d.index); break;
    case 'audio-pause': audio.pauseReprise(); break;
    case 'audio-suiv': audio.suivant(); break;
    case 'audio-prec': audio.precedent(); break;
    case 'audio-stop': audio.arreter(); document.getElementById('lecteur-flottant')?.remove(); break;
    case 'pref':
      store.setPref(d.cle, d.cle === 'vitesse' ? Number(d.v) : d.v);
      appliquerPrefs();
      vueReglages();
      break;
    case 'exporter': {
      const blob = new Blob([store.exporter()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `passeport-civique-progression-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      break;
    }
    case 'reinitialiser':
      if (confirm('Effacer toute la progression de cet examen ? Cette action est définitive.')) {
        store.reinitialiser(parcoursCourant());
        toast('Progression effacée');
      }
      break;
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.actionChange === 'voix') store.setPref('voix', el.value);
  if (el.dataset.actionChange === 'importer' && el.files[0]) {
    try {
      store.importer(await el.files[0].text());
      appliquerPrefs();
      toast('Progression importée');
      vueReglages();
    } catch {
      toast('Ce fichier n’est pas reconnu');
    }
  }
});

// Raccourcis clavier pendant les questions : 1-4 ou A-D pour répondre, Entrée pour continuer.
document.addEventListener('keydown', (ev) => {
  if (!session || ev.target.matches('input, select, textarea')) return;
  const k = '1234'.indexOf(ev.key) >= 0 ? '1234'.indexOf(ev.key) : 'abcd'.indexOf(ev.key.toLowerCase());
  if (k >= 0 && k < session.questions[session.i].options.length && ev.key.length === 1) { repondre(k); ev.preventDefault(); }
  else if (ev.key === 'Enter' && session.mode !== 'examen' && session.verrou) { suivante(); ev.preventDefault(); }
});

window.addEventListener('hashchange', routeur);
document.querySelectorAll('.nav-bas [data-icone]').forEach((el) => { el.innerHTML = ic(el.dataset.icone); });
appliquerPrefs();
routeur();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
