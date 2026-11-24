// Application principale : navigation et écrans.
import { APP_NAME, PARCOURS, THEMES, themeById, EXAMEN, EXAMEN_MODULE, SERIE_ENTRAINEMENT, NB_SITUATIONS, BOITE_MAITRISE, lienSur } from './config.js';
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

// La transition d'entrée ne joue qu'au changement d'écran (pas à chaque réponse d'un quiz).
let animerEntree = true;

/** Barre de titre compacte : apparaît en haut quand le bandeau de l'écran sort de la vue (comme une application). */
let observateurBandeau = null;
function majEnteteCompacte() {
  const hero = $app.querySelector('.hero[data-titre]');
  let barreTitre = document.getElementById('entete-compacte');
  observateurBandeau?.disconnect();
  if (!hero) { barreTitre?.remove(); return; }
  if (!barreTitre) {
    barreTitre = document.createElement('div');
    barreTitre.id = 'entete-compacte';
    barreTitre.className = 'entete-compacte';
    document.body.appendChild(barreTitre);
  }
  barreTitre.innerHTML = `${hero.dataset.retour ? `<a class="retour" href="${e(hero.dataset.retour)}" aria-label="Retour">${ic('retour')}</a>` : ''}<strong>${e(hero.dataset.titre)}</strong>`;
  barreTitre.classList.remove('visible');
  observateurBandeau = new IntersectionObserver(([entree]) => barreTitre.classList.toggle('visible', !entree.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
  observateurBandeau.observe(hero);
}

// Typographie française : espace insécable avant « : ; ? ! » et autour des guillemets (évite les coupures de ligne).
const insecables = (html) => html.replace(/ ([:;?!»])/g, ' $1').replace(/« /g, '« ');

function afficher(html, actif = '') {
  $app.innerHTML = insecables(html);
  majEnteteCompacte();
  $app.classList.remove('entree');
  if (animerEntree) {
    void $app.offsetWidth; // relance l'animation
    $app.classList.add('entree');
    animerEntree = false;
  }
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

async function vueBienvenue() {
  const pour = { csp: 'Pour une première carte de séjour pluriannuelle', resident: 'Pour une première carte de résident', naturalisation: 'Pour devenir Français ou Française' };
  const nombres = await Promise.all(Object.values(PARCOURS).map((x) => chargerQuestions(x.id).then((l) => l.length).catch(() => 0)));
  const atouts = [['cours', 'Des cours simples, à lire ou à écouter'], ['crayon', 'Des QCM corrigés et expliqués'], ['chrono', 'Des examens blancs chronométrés']];
  afficher(`
    <section class="bienvenue">
      <div class="hero hero-bienvenue">
        <div class="hero-marque"><span class="logo-marque">${ic('valide')}</span>${APP_NAME}</div>
        <h1>Préparez votre examen civique</h1>
        <ul class="atouts">${atouts.map(([i, t]) => `<li><span>${ic(i)}</span>${t}</li>`).join('')}</ul>
      </div>
      <div class="chevauche">
        <div class="carte choix-examen">
          <h2>Quel examen préparez-vous ?</h2>
          <p>Choisissez selon le titre que vous demandez.</p>
          <div class="pile-choix">
            ${Object.values(PARCOURS).map((p, i) => `<button class="choix-parcours" data-action="choisir-parcours" data-p="${p.id}" style="--c:${p.couleur}">
              ${pastille(p.icone)}
              <span class="lt-texte"><strong>${p.court}</strong><small>${pour[p.id] || p.sousTitre}</small>${nombres[i] ? `<span class="ca-meta">${nombres[i]} questions</span>` : ''}</span>
              <span class="chevron">${ic('chevron')}</span>
            </button>`).join('')}
          </div>
          <p class="note-choix">Vous pourrez changer à tout moment dans les réglages.</p>
        </div>

        <ul class="reperes reperes-apropos">
          <li>${pastille('valide', 'petite')}<span>Gratuit, sans publicité</span></li>
          <li>${pastille('bouclier', 'petite')}<span>Sans compte ni inscription</span></li>
          <li>${pastille('telecharger', 'petite')}<span>Marche aussi sans internet</span></li>
        </ul>
        <p class="petit centre avertissement">${ic('info', 'ic ic-texte')} Outil indépendant, non officiel : il n’est pas édité par l’État. <a href="#/a-propos">En savoir plus</a></p>
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

  // Les trois examens, pour la feuille de changement d'examen.
  const parcours = await Promise.all(Object.values(PARCOURS).map(async (x) => {
    const liste = x.id === p.id ? qs : await chargerQuestions(x.id).catch(() => []);
    const prog = store.getEtat().progress[x.id] || {};
    const maitrisees = Object.values(prog).filter((s) => s.box >= BOITE_MAITRISE).length;
    return { ...x, total: liste.length, part: liste.length ? maitrisees / liste.length : 0 };
  }));

  // Une seule action principale, selon l'avancement
  const etape = b.aRevoir > 0
    ? { href: '#/revision', icone: 'revoir', titre: 'Vos révisions du jour', texte: `${b.aRevoir} question${b.aRevoir > 1 ? 's' : ''} à revoir pour bien les retenir.`, bouton: 'Réviser maintenant' }
    : b.vues === 0
      ? { href: '#/entrainement/tout', icone: 'crayon', titre: 'Commencez par une première série', texte: `${SERIE_ENTRAINEMENT} questions, corrigées et expliquées une par une. Quelques minutes suffisent.`, bouton: 'Commencer' }
      : { href: '#/entrainement/tout', icone: 'crayon', titre: 'Continuez l’entraînement', texte: `Une série de ${SERIE_ENTRAINEMENT} questions adaptées à votre niveau.`, bouton: 'Continuer' };
  const dernierTxt = dernier ? `Dernier : <strong>${dernier.score}/${dernier.total}</strong>${dernier.type === 'complet' ? (dernier.reussi ? ' · réussi' : ' · pas encore') : ` (module ${e(themeById(dernier.type)?.court || '')})`}` : `${EXAMEN.nbQuestions} questions · ${EXAMEN.dureeMinutes} min`;

  afficher(`
    <section class="accueil">
      <div class="hero hero-accueil" data-titre="${APP_NAME}">
        <div class="hero-barre">
          <p class="hero-marque"><span class="logo-marque petit-logo">${ic('valide')}</span>${APP_NAME}</p>
          <a class="retour retour-hero" href="#/reglages" aria-label="Réglages">${ic('reglages')}</a>
        </div>
        <p class="libelle-examen">Vous préparez</p>
        <button class="selecteur-examen" data-action="ouvrir-parcours" aria-haspopup="dialog" aria-label="Examen préparé : ${p.court}. Changer d’examen" style="--c:${p.couleur}">
          <span class="sel-icone">${ic(p.icone, 'ic ic-texte')}</span><span class="sel-nom">${p.court}</span>
          <span class="sel-changer">Changer ${ic('chevron', 'ic ic-texte ic-bas')}</span>
        </button>
        <h1>${b.vues === 0 ? 'Prêt à commencer ?' : 'Bon retour !'}</h1>
        ${b.vues === 0
          ? `<p class="hero-texte">${b.total} questions pour préparer votre examen, à votre rythme.</p>`
          : `<div class="progres-hero">
              <div class="progres-hero-texte"><strong>${pct(b.progression)}</strong><span>de progression · ${b.vues} question${b.vues > 1 ? 's' : ''} travaillée${b.vues > 1 ? 's' : ''} sur ${b.total}</span></div>
              <div class="barre-hero">${barre(b.progression, 'Progression')}</div>
            </div>`}
        ${serie > 1 ? `<p class="serie">${ic('flamme', 'ic ic-texte')} ${serie} jours d’affilée</p>` : ''}
      </div>

      <h2 class="titre-section">Votre prochaine étape</h2>
      <a class="carte-vedette" href="${etape.href}">
        <span class="vedette-haut">${pastille(etape.icone)}<strong>${etape.titre}</strong></span>
        <span class="vedette-texte">${etape.texte}</span>
        <span class="bouton large">${etape.bouton} ${ic('chevron')}</span>
      </a>

      <div class="pile-cartes">
        ${carteAction({ href: '#/examen', icone: 'chrono', couleur: 'var(--c-principes)', titre: 'Examen blanc', texte: 'Comme le jour de l’examen, chronométré', meta: dernierTxt })}
        ${pf.faibles.length ? carteAction({ href: '#/progres', icone: 'cible', couleur: 'var(--c-societe)', titre: 'Vos points faibles', texte: `${pf.faibles.length} partie${pf.faibles.length > 1 ? 's' : ''} à travailler en priorité` }) : ''}
        ${carteAction({ href: '#/ecouter', icone: 'casque', couleur: 'var(--c-institutions)', titre: 'Écouter les cours', texte: 'Comme un podcast, en marchant ou en cuisinant' })}
      </div>

      <h2 class="titre-section">Vos thèmes</h2>
      <div class="liste-themes">
        ${THEMES.map((t) => {
          const bt = bilan(qs.filter((q) => q.t === t.id));
          return ligneTheme({ href: `#/theme/${t.id}`, icone: t.icone, couleur: t.couleur, titre: t.court, barreVal: bt.progression, sousTexte: `${bt.maitrisees}/${bt.total} maîtrisées` });
        }).join('')}
      </div>
      <p class="note-reglage centre pied-accueil">${ic('info', 'ic ic-texte')} Outil indépendant et gratuit, non officiel. <a href="#/a-propos">En savoir plus</a></p>
    </section>

    <dialog class="feuille" id="feuille-parcours" aria-labelledby="titre-parcours">
      <div class="feuille-poignee" aria-hidden="true"></div>
      <div class="feuille-tete">
        <h2 id="titre-parcours">Changer d’examen</h2>
        <button class="retour" data-action="fermer-parcours" aria-label="Fermer">${ic('fermer')}</button>
      </div>
      <p class="feuille-resume">Chaque examen garde sa propre progression.</p>
      <div class="groupe-lignes">
        ${parcours.map((x) => `<button class="ligne-reglage ligne-radio ${x.id === p.id ? 'actif' : ''}" data-action="choisir-parcours" data-p="${x.id}" style="--c:${x.couleur}" aria-pressed="${x.id === p.id}">
          ${pastille(x.icone, 'petite')}<span class="lt-texte"><strong>${x.court}</strong><small>${x.resume}${x.part ? ` · ${pct(x.part)} acquis` : ''}</small></span>
          <span class="radio" aria-hidden="true">${x.id === p.id ? ic('valide') : ''}</span></button>`).join('')}
      </div>
    </dialog>`, 'accueil');
  const feuille = document.getElementById('feuille-parcours');
  feuille?.addEventListener('click', (ev) => { if (ev.target === feuille) feuille.close(); });
}

async function vueTheme(themeId) {
  const t = themeById(themeId);
  if (!t) return naviguer('#/');
  const qs = (await questions()).filter((q) => q.t === t.id);
  const b = bilan(qs);
  const nbSit = qs.filter((q) => q.s).length;
  const iTheme = THEMES.findIndex((x) => x.id === t.id);
  const niveau = (x) => (x >= 0.8 ? 'ok' : x >= 0.5 ? 'moyen' : 'ko');
  const parties = Object.entries(t.sousThemes).map(([id, titre]) => ({ id, titre, b: bilan(qs.filter((q) => q.st === id)) })).filter((x) => x.b.total);
  const raccourcis = [
    { href: `#/cours/${t.id}`, icone: 'cours', titre: 'Le cours', texte: 'À lire ou écouter' },
    nbSit ? { href: `#/entrainement/situations/${t.id}`, icone: 'boussole', titre: 'Situations', texte: `${nbSit} cas concrets` } : null,
    { href: `#/examen/${t.id}`, icone: 'chrono', titre: 'Examen', texte: `${EXAMEN_MODULE.nbQuestions} questions` },
  ].filter(Boolean);
  afficher(`
    <div class="hero hero-cours hero-revision" data-titre="${e(t.court)}" data-retour="#/" style="--c:${t.couleur}">
      <div class="hero-haut">
        <a class="retour retour-hero" href="#/" aria-label="Retour à l’accueil">${ic('retour')}</a>
        <span class="hero-marque">Thème ${iTheme + 1} sur ${THEMES.length}</span>
      </div>
      <span class="puce-hero">${ic(t.icone, 'ic ic-texte')} ${t.court}</span>
      <h1>${t.titre}</h1>
      <div class="stats-hero">
        <div><strong>${b.total}</strong><span>questions</span></div>
        <div><strong>${b.maitrisees}</strong><span>maîtrisées</span></div>
        <div><strong>${b.reussite !== null ? pct(b.reussite) : '–'}</strong><span>bonnes réponses</span></div>
      </div>
      <div class="barre-hero">${barre(b.progression, 'Progression du thème')}</div>
    </div>

    <section class="chevauche" style="--c:${t.couleur}">
      <a class="carte-vedette vedette-theme" href="#/entrainement/${t.id}">
        <span class="vedette-haut">${pastille('crayon')}<strong>${b.vues ? 'Continuer sur ce thème' : 'S’entraîner sur ce thème'}</strong></span>
        <span class="vedette-texte">Une série de ${SERIE_ENTRAINEMENT} questions corrigées, adaptées à votre niveau.</span>
        <span class="bouton large">${b.vues ? 'Continuer' : 'Commencer'} ${ic('chevron')}</span>
      </a>
      <div class="raccourcis-theme">
        ${raccourcis.map((r) => `<a class="tuile tuile-raccourci" href="${r.href}">${pastille(r.icone, 'petite')}<strong>${r.titre}</strong><small>${r.texte}</small></a>`).join('')}
      </div>
    </section>

    <h2 class="titre-reglage">Les ${parties.length} parties du thème</h2>
    <div class="groupe-lignes" style="--c:${t.couleur}">
      ${parties.map((x, k) => `<a class="ligne-reglage ligne-partie" href="#/revision/${t.id}/${x.id}">
        <span class="num-partie">${k + 1}</span>
        <span class="lt-texte"><strong>${e(x.titre)}</strong>
          <small>${x.b.total} questions · ${x.b.maitrisees} maîtrisée${x.b.maitrisees > 1 ? 's' : ''}</small>${barre(x.b.progression, x.titre)}</span>
        ${x.b.reussite !== null ? `<span class="score-pf ${niveau(x.b.reussite)}" title="Bonnes réponses">${pct(x.b.reussite)}</span>` : `<span class="chevron">${ic('chevron')}</span>`}
      </a>`).join('')}
    </div>
    <p class="note-reglage">Touchez une partie pour la réviser pas à pas. Le pourcentage indique vos bonnes réponses.</p>`, 'accueil');
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
  const nbParties = cours.reduce((n, c) => n + (c ? c.sections.filter((s) => s.id !== 'sources').length : 0), 0);
  const minutes = cours.reduce((n, c) => n + (c ? dureeLecture(c) : 0), 0);
  const dernier = themeById(store.getEtat().prefs.dernierCours);

  afficher(`
    <section>
      <div class="hero" data-titre="Cours">
        <p class="hero-marque">${ic('cours', 'ic ic-texte')} Cours</p>
        <h1>Apprendre l’essentiel</h1>
        <p class="hero-texte">Un cours par thème de l’examen, en français simple, à lire ou à écouter.</p>
        <div class="stats">
          <div class="stat"><strong>${THEMES.length}</strong><small>cours</small></div>
          <div class="stat"><strong>${nbParties}</strong><small>parties</small></div>
          <div class="stat"><strong>${minutes} min</strong><small>de lecture</small></div>
        </div>
      </div>

      <div class="chevauche pile-cartes">
        ${dernier
          ? carteAction({ href: `#/cours/${dernier.id}`, icone: dernier.icone, couleur: dernier.couleur, titre: 'Reprendre la lecture', texte: dernier.titre, bouton: 'chevron' })
          : carteAction({ href: `#/cours/${THEMES[0].id}`, icone: THEMES[0].icone, couleur: THEMES[0].couleur, titre: 'Commencer par le premier cours', texte: THEMES[0].titre, bouton: 'chevron' })}
        ${audio.audioDisponible ? carteAction({ href: '#/ecouter', icone: 'casque', couleur: 'var(--c-institutions)', titre: 'Écouter les cours', texte: 'Comme un podcast, dans les transports ou en cuisinant' }) : ''}
      </div>

      <h2 class="titre-section">Les ${THEMES.length} cours</h2>
      <div class="groupe-lignes liste-cours">
        ${THEMES.map((t, i) => {
          const c = cours[i];
          const bt = bilan(qs.filter((q) => q.t === t.id));
          const parties = c ? c.sections.filter((s) => s.id !== 'sources').length : 0;
          return `<a class="ligne-reglage ligne-cours" href="#/cours/${t.id}" style="--c:${t.couleur}">
            ${pastille(t.icone, 'petite')}
            <span class="lt-texte">
              <strong>${t.titre}</strong>
              <small>${c ? `${parties} parties · ${dureeLecture(c)} min` : 'Bientôt disponible'}${bt.vues ? ` · ${pct(bt.progression)} acquis` : ''}</small>
              ${barre(bt.progression, t.titre)}
            </span>
            <span class="chevron">${ic('chevron')}</span>
          </a>`;
        }).join('')}
      </div>
    </section>`, 'cours');
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
  if (store.getEtat().prefs.dernierCours !== t.id) store.setPref('dernierCours', t.id);
  const parties = c.sections.filter((s) => s.id !== 'sources');
  const sources = c.sections.find((s) => s.id === 'sources');
  const iTheme = THEMES.findIndex((x) => x.id === t.id);
  const suivant = THEMES[(iTheme + 1) % THEMES.length];

  afficher(`
    <div class="barre-lecture" aria-hidden="true"><span id="progression-lecture"></span></div>
    <div class="hero hero-cours" data-titre="${e(c.titre || t.titre)}" data-retour="#/cours" style="--c:${t.couleur}">
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
  return lireCours(md).sections.filter((s) => s.id !== 'sources').map((s, n) => ({ titre: s.titre, texte: s.texte, theme: t.court, themeId, n }));
}

/** Durée d'écoute estimée, en minutes (environ 150 mots par minute à vitesse normale). */
const minutesEcoute = (pistes) => Math.max(1, Math.round(pistes.reduce((n, p) => n + `${p.titre} ${p.texte}`.split(/\s+/).length, 0) / 150 / (Number(store.getEtat().prefs.vitesse) || 1)));

async function vueEcouter() {
  if (!audio.audioDisponible) {
    afficher(`${entete('Écouter les cours', '#/cours')}<div class="carte carte-info attention">${ic('attention')}<p>Votre navigateur ne permet pas la lecture audio. Essayez avec Chrome, Edge ou Safari.</p></div>`, 'cours');
    return;
  }
  const blocs = [];
  for (const t of THEMES) blocs.push({ t, pistes: await pistesTheme(t.id) });
  const toutes = blocs.flatMap((b) => b.pistes);
  const enCours = audio.etatAudio().piste?.themeId;
  afficher(`
    <div class="hero" data-titre="Écouter les cours" data-retour="#/cours">
      <div class="hero-haut">
        <a class="retour retour-hero" href="#/cours" aria-label="Retour aux cours">${ic('retour')}</a>
        <span class="hero-marque">${ic('casque', 'ic ic-texte')} Cours audio</span>
      </div>
      <h1>Écouter les cours</h1>
      <p class="hero-texte">Comme un podcast : dans les transports, en cuisinant… Écoutez tout, un thème ou une seule partie.</p>
      <div class="stats-hero">
        <div><strong>${THEMES.length}</strong><span>thèmes</span></div>
        <div><strong>${toutes.length}</strong><span>parties</span></div>
        <div><strong>${minutesEcoute(toutes)} min</strong><span>d’écoute environ</span></div>
      </div>
    </div>

    <section class="chevauche">
      ${carteAction({ action: 'ecouter-tout', icone: 'casque', couleur: 'var(--c-institutions)', titre: 'Tout écouter', texte: 'Les cinq thèmes à la suite, du début', meta: `${toutes.length} parties` })}
    </section>

    <h2 class="titre-reglage">Choisir un thème</h2>
    <div class="pile-ecoute">
    ${blocs.map(({ t, pistes }, k) => `
      <details class="carte bloc-ecoute" style="--c:${t.couleur}" ${enCours ? (enCours === t.id ? 'open' : '') : (k === 0 ? 'open' : '')}>
        <summary class="bloc-ecoute-tete">
          ${pastille(t.icone, 'petite')}
          <span class="lt-texte"><strong>${t.court}</strong><small>${pistes.length ? `${pistes.length} parties · environ ${minutesEcoute(pistes)} min` : 'Bientôt disponible'}</small></span>
          ${pistes.length ? `<button class="rond-action petit-rond" data-action="ecouter-cours" data-theme="${t.id}" aria-label="Écouter tout le thème ${e(t.court)}">${ic('jouer')}</button>` : ''}
          <span class="chevron ic-tourne">${ic('chevron')}</span>
        </summary>
        <ol class="pistes">${pistes.map((p, i) => `<li><button class="piste" data-action="ecouter-cours" data-theme="${t.id}" data-index="${i}" data-cle="${t.id}:${i}"><span class="num">${i + 1}</span><span class="piste-titre">${e(p.titre)}<small class="en-ecoute">${ic('son', 'ic ic-texte')} En écoute</small></span>${ic('jouer', 'ic ic-piste')}</button></li>`).join('')}</ol>
      </details>`).join('')}
    </div>
    <p class="note-reglage">La voix et la vitesse se règlent dans les <a href="#/reglages">réglages</a>.</p>`, 'cours');
  majLecteur(audio.etatAudio());
}

function majLecteur(s) {
  // Met en évidence la partie en cours d'écoute
  const cle = s.statut !== 'arret' && s.piste ? `${s.piste.themeId}:${s.piste.n}` : '';
  document.querySelectorAll('.piste[data-cle]').forEach((b) => {
    b.classList.toggle('en-cours', b.dataset.cle === cle);
    if (b.dataset.cle === cle) b.closest('details')?.setAttribute('open', '');
  });
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
  const b = bilan(qs);
  const p = PARCOURS[parcoursCourant()];
  afficher(`
    <section>
      <div class="hero" data-titre="S’entraîner">
        <p class="hero-marque">${ic('crayon', 'ic ic-texte')} S’entraîner · ${e(p.court)}</p>
        <h1>Entraînez-vous à votre rythme</h1>
        <p class="hero-texte">${b.vues ? `Déjà <strong>${b.vues}</strong> questions travaillées sur ${b.total}.` : `${b.total} questions pour préparer votre examen.`}</p>
        <div class="stats">
          ${b.vues
            ? `<div class="stat"><strong>${b.vues}</strong><small>vues</small></div>
               <div class="stat"><strong>${b.reussite !== null ? pct(b.reussite) : '–'}</strong><small>de réussite</small></div>
               <div class="stat"><strong>${b.aRevoir}</strong><small>à revoir</small></div>`
            : `<div class="stat"><strong>${b.total}</strong><small>questions</small></div>
               <div class="stat"><strong>${THEMES.length}</strong><small>thèmes</small></div>
               <div class="stat"><strong>${sit.length}</strong><small>situations</small></div>`}
        </div>
      </div>

      <div class="chevauche pile-cartes">
        ${b.aRevoir ? carteAction({ href: '#/revision', icone: 'revoir', couleur: 'var(--c-histoire)', titre: 'Révisions du jour', texte: `${b.aRevoir} question${b.aRevoir > 1 ? 's' : ''} à revoir maintenant` }) : ''}
        ${carteAction({ href: '#/entrainement/tout', icone: 'des', couleur: 'var(--c-droits)', titre: 'Série adaptée', texte: `${SERIE_ENTRAINEMENT} questions choisies selon votre niveau` })}
        ${sit.length ? carteAction({ href: '#/entrainement/situations', icone: 'boussole', couleur: 'var(--c-societe)', titre: 'Mises en situation', texte: 'Des cas concrets de la vie quotidienne', meta: `${NB_SITUATIONS} sur ${EXAMEN.nbQuestions} à l’examen` }) : ''}
      </div>

      <ul class="reperes" aria-label="Comment fonctionne l’entraînement">
        <li>${pastille('valide', 'petite')}<span>Correction tout de suite</span></li>
        <li>${pastille('revoir', 'petite')}<span>Les erreurs reviennent plus tard</span></li>
        <li>${pastille('cible', 'petite')}<span>Questions adaptées à votre niveau</span></li>
      </ul>

      <h2 class="titre-section">Par thème</h2>
      <div class="grille-themes">
        ${THEMES.map((t) => {
          const bt = bilan(qs.filter((q) => q.t === t.id));
          return `<a class="tuile tuile-theme" href="#/entrainement/${t.id}" style="--c:${t.couleur}">
            ${pastille(t.icone, 'petite')}
            <strong>${t.court}</strong>
            ${barre(bt.progression, t.court)}
            <small>${bt.vues ? `${bt.vues}/${bt.total} vues` : `${bt.total} questions`}</small>
          </a>`;
        }).join('')}
      </div>
    </section>`, 'entrainement');
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
  const bonnes = s.questions.filter((qq, k) => s.reponses[k] !== undefined && s.reponses[k] === qq.bonne).length;
  const juste = choisie === q.bonne;
  const bravo = ['Bonne réponse !', 'Bravo !', 'Exactement !', 'Très bien !'][s.i % 4];
  afficher(`
    <div class="quiz" style="--c:${t.couleur}">
      <header class="quiz-tete">
        <button class="retour" data-action="quitter" aria-label="Quitter">${ic('fermer')}</button>
        <div class="quiz-avance">
          <div class="quiz-avance-texte"><strong>Question ${s.i + 1}</strong><small> sur ${s.questions.length}</small></div>
          ${!examen && s.questions.length <= 20 ? `<div class="segments-serie" role="img" aria-label="${bonnes} bonne${bonnes > 1 ? 's' : ''} réponse${bonnes > 1 ? 's' : ''} sur ${s.questions.length} questions">${s.questions.map((qq, k) => {
            const r = s.reponses[k];
            return `<span class="${r === undefined ? (k === s.i ? 'courant' : '') : r === qq.bonne ? 'ok' : 'ko'}"></span>`;
          }).join('')}</div>` : barre(avance, examen ? 'Questions répondues' : 'Avancement')}
        </div>
        ${examen ? `<div class="chrono" aria-live="off">${ic('chrono', 'ic ic-texte')}<span id="chrono">--:--</span></div>`
          : `<div class="compteur-bonnes" title="Bonnes réponses">${ic('valide', 'ic ic-texte')}<span>${bonnes}</span><span class="visuellement-cache"> bonnes réponses</span></div>`}
      </header>

      <div class="carte carte-question">
        <div class="quiz-etiquettes">
          <span class="etiquette">${ic(t.icone, 'ic ic-texte')} ${t.court}</span>
          ${q.s ? `<span class="etiquette etiquette-situation">${ic('boussole', 'ic ic-texte')} Mise en situation</span>` : ''}
          ${examen ? `<button class="marque-revoir ${s.marquees.has(s.i) ? 'actif' : ''}" data-action="marquer" aria-pressed="${s.marquees.has(s.i)}">${ic('naturalisation', 'ic ic-texte')} ${s.marquees.has(s.i) ? 'Marquée' : 'À revoir'}</button>` : ''}
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

      ${examen || s.verrou ? `<div class="quiz-pied ${examen ? 'pied-examen' : `pied-verdict ${juste ? 'ok' : 'ko'}`}">
        ${!examen ? `<div class="verdict" role="status">
          <span class="rond-etat">${ic(juste ? 'valide' : 'fermer')}</span>
          <span><strong>${juste ? bravo : 'Pas tout à fait'}</strong><small>${juste ? 'Continuez comme ça.' : 'Cette question reviendra dans vos révisions.'}</small></span>
        </div>` : ''}
        ${examen ? `
          <button class="bouton secondaire bouton-rond" data-action="prec" ${s.i === 0 ? 'disabled' : ''} aria-label="Question précédente">${ic('retour')}</button>
          <button class="bouton secondaire bouton-grille" data-action="ouvrir-grille" aria-haspopup="dialog" aria-label="Vue d’ensemble : ${nbRepondues} questions répondues sur ${s.questions.length}">${ic('des')} ${nbRepondues}/${s.questions.length}</button>
          ${s.i < s.questions.length - 1 ? `<button class="bouton" data-action="suiv">Suivante ${ic('chevron')}</button>` : `<button class="bouton bouton-ok" data-action="terminer">${ic('valide')} Terminer</button>`}
        ` : `<button class="bouton large" data-action="suiv" id="btn-suiv">${s.i < s.questions.length - 1 ? `Continuer ${ic('chevron')}` : `Voir mon résultat ${ic('chevron')}`}</button>`}
      </div>` : ''}

      ${examen ? feuilleExamen(s, nbRepondues) : ''}
    </div>`, 'aucun');
  if (examen) {
    // Toucher en dehors de la feuille la referme
    document.getElementById('feuille-exam')?.addEventListener('click', (ev) => { if (ev.target.id === 'feuille-exam') ev.target.close(); });
    majChrono();
  }
}

/** Feuille « Vue d'ensemble » de l'examen : grille des questions, marques, fin anticipée. */
function feuilleExamen(s, nbRepondues) {
  const n = s.questions.length;
  const marquees = s.marquees.size;
  return `<dialog class="feuille" id="feuille-exam" aria-labelledby="titre-feuille">
    <div class="feuille-poignee" aria-hidden="true"></div>
    <div class="feuille-tete">
      <h2 id="titre-feuille">Vue d’ensemble</h2>
      <button class="retour" data-action="fermer-grille" aria-label="Fermer">${ic('fermer')}</button>
    </div>
    <p class="feuille-resume"><strong>${nbRepondues}</strong> répondue${nbRepondues > 1 ? 's' : ''} · <strong>${n - nbRepondues}</strong> sans réponse${marquees ? ` · <strong>${marquees}</strong> marquée${marquees > 1 ? 's' : ''}` : ''}</p>
    <ul class="legende-grille" aria-hidden="true">
      <li><span class="faite"></span>Répondue</li><li><span></span>Sans réponse</li><li><span class="marquee"></span>À revoir</li>
    </ul>
    <div class="grille-num">${s.questions.map((_, k) => {
      const faite = s.reponses[k] !== undefined;
      const marquee = s.marquees.has(k);
      return `<button data-action="aller" data-k="${k}" class="${faite ? 'faite' : ''} ${marquee ? 'marquee' : ''} ${k === s.i ? 'courante' : ''}" aria-label="Question ${k + 1}${faite ? ', répondue' : ', sans réponse'}${marquee ? ', à revoir' : ''}">${k + 1}</button>`;
    }).join('')}</div>
    <div class="feuille-actions">
      <button class="bouton secondaire" data-action="fermer-grille">Continuer</button>
      <button class="bouton bouton-ok" data-action="terminer">${ic('valide')} Terminer</button>
    </div>
  </dialog>`;
}

function blocCorrection(q, choisie) {
  const ok = choisie === q.bonne;
  return `<div class="correction ${ok ? 'ok' : 'ko'}">
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
function heroResultat({ reussi, sur, retour, score, total, titre, texte, stats, seuil }) {
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
      ${seuil ? jaugeSeuil(score, total, seuil) : ''}
      <div class="stats">${stats.map(([n, l]) => `<div class="stat"><strong>${n}</strong><small>${l}</small></div>`).join('')}</div>
    </div>`;
}

/** Jauge du score avec le seuil de réussite marqué (ex. 32 sur 40). */
function jaugeSeuil(score, total, seuil) {
  return `<div class="jauge" style="--v:${(score / total) * 100}%; --s:${(seuil / total) * 100}%" role="img" aria-label="${score} bonnes réponses sur ${total}, seuil de réussite : ${seuil}">
    <div class="jauge-piste"><span class="jauge-val"></span><span class="jauge-seuil"></span></div>
    <div class="jauge-legende"><span>0</span><span class="jauge-seuil-txt">Seuil : ${seuil}</span><span>${total}</span></div>
  </div>`;
}

/** Actions après un résultat : une action principale, une secondaire. */
function actionsResultat(principale, secondaire) {
  const bouton = (a, cls) => a.href
    ? `<a class="${cls}" href="${a.href}">${ic(a.icone)} ${a.titre}</a>`
    : `<button class="${cls}" data-action="${a.action}" ${a.attrs || ''}>${ic(a.icone)} ${a.titre}</button>`;
  return `<div class="carte actions-resultat">
    ${bouton(principale, 'bouton large')}
    ${secondaire ? bouton(secondaire, 'bouton secondaire large') : ''}
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
      <div class="chevauche">
        ${actionsResultat({ action: 'rejouer', icone: 'jouer', titre: 'Nouvelle série' }, { href: '#/progres', icone: 'cible', titre: 'Voir mes points faibles' })}
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
  const p = PARCOURS[parcoursCourant()];
  const ex = store.getEtat().examens[p.id];
  const complets = ex.filter((r) => r.type === 'complet');
  const meilleur = complets.reduce((m, r) => Math.max(m, r.score), 0);
  const derniers = complets.slice(-8);
  const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  // Évolution des examens complets : une seule couleur, ligne de seuil, valeur affichée sur la dernière barre.
  const graphique = derniers.length >= 2 ? `
    <h2 class="titre-section">Mes examens complets</h2>
    <div class="carte evolution">
      <div class="evo-zone" role="img" aria-label="Scores des ${derniers.length} derniers examens complets, sur ${EXAMEN.nbQuestions}. Seuil de réussite : ${EXAMEN.seuil}.">
        <span class="evo-seuil" style="bottom:${(EXAMEN.seuil / EXAMEN.nbQuestions) * 100}%"><span>${EXAMEN.seuil} pour réussir</span></span>
        ${derniers.map((r, k) => `<span class="evo-col" tabindex="0" title="${fmtDate(r.date)} : ${r.score}/${r.total}">
          <span class="evo-barre" style="height:${(r.score / r.total) * 100}%">
            ${k === derniers.length - 1 ? `<span class="evo-valeur">${r.score}</span>` : ''}
            <span class="evo-bulle">${fmtDate(r.date)} · <strong>${r.score}/${r.total}</strong></span>
          </span></span>`).join('')}
      </div>
      <div class="evo-legende"><span>${fmtDate(derniers[0].date)}</span><span>Dernier : <strong>${derniers[derniers.length - 1].score}/${EXAMEN.nbQuestions}</strong></span></div>
      <ul class="visuellement-cache">${derniers.map((r) => `<li>${fmtDate(r.date)} : ${r.score} sur ${r.total}${r.score >= EXAMEN.seuil ? ', réussi' : ''}</li>`).join('')}</ul>
    </div>` : '';

  const niveau = (r) => (r.score / r.total >= 0.8 ? 'ok' : r.score / r.total >= 0.5 ? 'moyen' : 'ko');
  afficher(`
    <section>
      <div class="hero hero-accueil" data-titre="Examen blanc">
        <p class="hero-marque">${ic('chrono', 'ic ic-texte')} Examen blanc</p>
        <span class="puce-hero">${ic(p.icone, 'ic ic-texte')} ${e(p.court)}</span>
        <h1>Comme le jour de l’examen</h1>
        <p class="hero-texte">${complets.length ? `Meilleur score : <strong>${meilleur}/${EXAMEN.nbQuestions}</strong>${meilleur >= EXAMEN.seuil ? ' · seuil atteint' : ` · encore ${EXAMEN.seuil - meilleur} pour le seuil`}` : 'Mettez-vous dans les conditions réelles, chronomètre compris.'}</p>
        <div class="stats-hero">
          <div><strong>${EXAMEN.nbQuestions}</strong><span>questions</span></div>
          <div><strong>${EXAMEN.dureeMinutes} min</strong><span>au maximum</span></div>
          <div><strong>${EXAMEN.seuil}</strong><span>pour réussir</span></div>
        </div>
      </div>

      <h2 class="titre-section">Examen complet</h2>
      <div class="carte-vedette vedette-examen">
        <span class="vedette-haut">${pastille('chrono')}<strong>Les 5 thèmes, dont ${NB_SITUATIONS} mises en situation</strong></span>
        <button class="bouton large" data-action="examen" data-type="complet">${ic('jouer')} Lancer l’examen</button>
        <ul class="regles-examen">
          <li>${ic('retour', 'ic ic-texte')} On peut revenir en arrière et changer ses réponses.</li>
          <li>${ic('naturalisation', 'ic ic-texte')} On peut marquer une question pour la revoir.</li>
          <li>${ic('valide', 'ic ic-texte')} La correction complète s’affiche à la fin.</li>
          <li>${ic('chrono', 'ic ic-texte')} À la fin du temps, l’examen se termine tout seul.</li>
        </ul>
      </div>

      ${graphique}

      <h2 class="titre-reglage">Examen par module</h2>
      <div class="groupe-lignes">
        ${THEMES.map((t) => {
          const r = [...ex].reverse().find((x) => x.type === t.id);
          return `<button class="ligne-reglage" data-action="examen" data-type="${t.id}" style="--c:${t.couleur}">
            ${pastille(t.icone, 'petite')}<span class="lt-texte"><strong>${t.court}</strong><small>${r ? 'Dernier résultat' : `${EXAMEN_MODULE.nbQuestions} questions · pas encore passé`}</small></span>
            ${r ? `<span class="score-pf ${niveau(r)}">${r.score}/${r.total}</span>` : `<span class="chevron">${ic('chevron')}</span>`}
          </button>`;
        }).join('')}
      </div>
      <p class="note-reglage">${EXAMEN_MODULE.nbQuestions} questions sur un seul thème, au même rythme que l’examen.</p>

      ${ex.length ? `<h2 class="titre-reglage">Historique</h2>
      <div class="groupe-lignes historique-examens">
        ${ex.slice(-5).reverse().map((r) => {
          const t = r.type === 'complet' ? null : themeById(r.type);
          return `<div class="ligne-reglage ligne-info" style="--c:${t ? t.couleur : 'var(--c-principes)'}">
            ${pastille(t ? t.icone : 'chrono', 'petite')}
            <span class="lt-texte"><strong>${t ? e(t.court) : 'Examen complet'}</strong><small>${fmtDate(r.date)} · ${r.reussi ? 'réussi' : 'pas encore réussi'}</small></span>
            <span class="score-pf ${r.reussi ? 'ok' : 'ko'}">${r.score}/${r.total}</span>
          </div>`;
        }).join('')}
      </div>` : ''}
    </section>`, 'examen');
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
  session = { mode: 'examen', type, questions: liste.map(preparer), i: 0, reponses: [], marquees: new Set(), fin: Date.now() + duree * 1000, debut: Date.now() };
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
        seuil,
      })}
      <div class="chevauche">
        ${reussi
          ? actionsResultat({ action: 'examen', attrs: `data-type="${s.type}"`, icone: 'revoir', titre: 'Repasser un examen' }, nbErreurs ? { href: '#/progres', icone: 'cible', titre: 'Travailler mes points faibles' } : null)
          : actionsResultat({ href: '#/progres', icone: 'cible', titre: 'Travailler mes points faibles' }, { action: 'examen', attrs: `data-type="${s.type}"`, icone: 'revoir', titre: 'Repasser un examen' })}
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
  const p = PARCOURS[parcoursCourant()];
  const serie = store.getEtat().activite.serie;

  // Une partie : pastille du thème, titre court, thème et nombre à revoir, score de réussite à droite.
  const niveau = (x) => (x === null || x === undefined ? '' : x >= 0.8 ? 'ok' : x >= 0.5 ? 'moyen' : 'ko');
  const ligne = (r) => `<a class="ligne-reglage ligne-partie" href="#/revision/${r.theme.id}/${r.stId}" style="--c:${r.theme.couleur}">
      ${pastille(r.theme.icone, 'petite')}
      <span class="lt-texte"><strong>${e(r.titre)}</strong>
        <small>${r.theme.court}${r.aRevoir ? ` · <span class="a-revoir">${r.aRevoir} à revoir</span>` : ''}</small></span>
      ${r.reussite !== null ? `<span class="score-pf ${niveau(r.reussite)}" title="Bonnes réponses">${pct(r.reussite)}</span>` : `<span class="chevron">${ic('chevron')}</span>`}
    </a>`;
  const groupe = (liste) => `<div class="groupe-lignes">${liste.map(ligne).join('')}</div>`;
  const prioritaires = pf.faibles.slice(0, 5);
  const autres = pf.faibles.slice(5);

  afficher(`
    <section>
      <div class="hero" data-titre="Mes progrès">
        <div class="hero-ligne">
          <div>
            <p class="hero-marque">${ic('cible', 'ic ic-texte')} Mes progrès</p>
            <h1>${b.vues === 0 ? 'Votre suivi personnalisé' : b.reussite >= 0.8 ? 'Vous êtes sur la bonne voie' : 'Continuez, ça avance'}</h1>
            <p class="hero-texte">${b.vues === 0 ? 'Répondez à quelques questions : l’application repère vos points faibles.' : `Progression globale : <strong>${pct(b.progression)}</strong>${b.maitrisees ? ` · ${b.maitrisees} questions maîtrisées` : ''}`}</p>
            ${serie > 1 ? `<p class="serie">${ic('flamme', 'ic ic-texte')} ${serie} jours d’affilée</p>` : ''}
          </div>
          ${anneau(b.progression, 96)}
        </div>
        ${b.vues ? `<div class="stats">
          <div class="stat"><strong>${b.vues}</strong><small>travaillées</small></div>
          <div class="stat"><strong>${b.reussite !== null ? pct(b.reussite) : '–'}</strong><small>de réussite</small></div>
          <div class="stat"><strong>${b.aRevoir}</strong><small>à revoir</small></div>
        </div>` : ''}
      </div>

      <div class="chevauche pile-cartes">
        ${b.aRevoir
          ? carteAction({ href: '#/revision', icone: 'revoir', couleur: 'var(--c-histoire)', titre: 'Révisions du jour', texte: `${b.aRevoir} question${b.aRevoir > 1 ? 's' : ''} à revoir maintenant` })
          : carteAction({ href: '#/entrainement/tout', icone: 'crayon', couleur: 'var(--c-droits)', titre: b.vues ? 'Continuer l’entraînement' : 'Faire une première série', texte: b.vues ? 'Aucune révision prévue aujourd’hui' : `${SERIE_ENTRAINEMENT} questions pour établir votre bilan` })}
      </div>

      ${b.vues === 0 ? `
      <h2 class="titre-section">Comment ça marche</h2>
      <ol class="carte etapes-pf">
        <li>${pastille('crayon', 'petite')}<span><strong>Vous répondez</strong><small>à des séries de questions, à votre rythme.</small></span></li>
        <li>${pastille('cible', 'petite')}<span><strong>L’application repère</strong><small>les parties où vous faites des erreurs.</small></span></li>
        <li>${pastille('revoir', 'petite')}<span><strong>Vous révisez</strong><small>avec un rappel du cours et des questions ciblées.</small></span></li>
      </ol>` : `
      <h2 class="titre-section">Par thème</h2>
      <div class="carte score-themes">
        ${THEMES.map((t) => {
          const bt = bilan(qs.filter((q) => q.t === t.id));
          return `<a class="score-theme lien-bloc" href="#/theme/${t.id}" style="--c:${t.couleur}">
            ${pastille(t.icone, 'petite')}
            <span class="st-texte"><span class="st-ligne"><strong>${t.court}</strong><span class="st-score">${pct(bt.progression)}</span></span>${barre(bt.progression, t.court)}</span>
          </a>`;
        }).join('')}
      </div>`}

      ${pf.faibles.length ? `<div class="titre-avec-aide"><h2 class="titre-section">À travailler en priorité</h2><small>Touchez une partie pour la réviser</small></div>
        ${groupe(prioritaires)}
        ${autres.length ? `<details class="repli"><summary>${ic('chevron', 'ic ic-texte ic-tourne')} Voir ${autres.length} autres parties</summary>${groupe(autres)}</details>` : ''}`
        : b.vues ? `<div class="carte carte-info ok">${ic('valide')}<p>Aucun point faible repéré pour l’instant. Continuez à explorer de nouvelles parties !</p></div>` : ''}

      ${forts.length ? `<details class="repli"><summary>${ic('valide', 'ic ic-texte')} Points forts (${forts.length})</summary>${groupe(forts)}</details>` : ''}
      ${pf.nonCommences.length && b.vues ? `<details class="repli"><summary>${ic('info', 'ic ic-texte')} Pas encore commencées (${pf.nonCommences.length})</summary>${groupe(pf.nonCommences)}</details>` : ''}
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
  // Étape en cours : 1 relire (rien fait), 2 s'entraîner, 3 maîtrisée (80 % des questions)
  const etape = b.maitrise >= 0.8 ? 4 : b.vues ? 2 : 1;
  const entrainer = (libelle, cls = 'bouton') => `<button class="${cls}" data-action="entrainer-partie" data-theme="${themeId}" data-st="${stId}">${ic('jouer')} ${libelle}</button>`;
  const etapes = [
    {
      titre: 'Relire le cours',
      texte: section ? 'Les points essentiels de cette partie, en quelques minutes.' : 'Relisez le cours de ce thème.',
      action: section ? `<button class="bouton" data-action="voir-rappel">${ic('cours')} Lire le rappel</button>${entrainer('Je connais déjà', 'bouton secondaire')}` : '',
    },
    {
      titre: 'S’entraîner',
      texte: `${b.total} questions sur cette partie${b.vues ? ` · ${b.vues} déjà travaillée${b.vues > 1 ? 's' : ''}` : ''}.`,
      action: entrainer(b.vues ? 'Continuer' : 'Commencer'),
    },
    {
      titre: 'Maîtriser',
      texte: etape === 4 ? 'Partie maîtrisée : bravo ! Revenez de temps en temps pour ne pas oublier.' : `Objectif : 80 % des questions maîtrisées. Aujourd’hui : ${pct(b.maitrise)}.`,
      action: etape === 4 ? entrainer('S’entraîner encore', 'bouton secondaire') : '',
    },
  ];
  const stats = [
    [`${b.maitrisees}/${b.total}`, 'maîtrisées'],
    [b.reussite !== null ? pct(b.reussite) : '–', 'bonnes réponses'],
    [String(b.aRevoir), 'à revoir'],
  ];
  afficher(`
    <div class="hero hero-cours hero-revision" data-titre="${e(titre)}" data-retour="#/progres" style="--c:${t.couleur}">
      <div class="hero-haut">
        <a class="retour retour-hero" href="#/progres" aria-label="Retour à mes progrès">${ic('retour')}</a>
        <span class="hero-marque">Révision guidée</span>
      </div>
      <span class="puce-hero">${ic(t.icone, 'ic ic-texte')} ${t.court}</span>
      <h1>${e(titre)}</h1>
      <div class="stats-hero">${stats.map(([v, l]) => `<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</div>
      <div class="barre-hero">${barre(b.progression, titre)}</div>
    </div>

    <section class="chevauche" style="--c:${t.couleur}">
      <ol class="carte etapes-rev" aria-label="Étapes de la révision">
        ${etapes.map((x, i) => {
          const etat = i + 1 < etape ? 'faite' : i + 1 === etape ? 'active' : '';
          return `<li class="${etat}" ${etat === 'active' ? 'aria-current="step"' : ''}>
            <span class="rond-etape">${etat === 'faite' ? ic('valide') : i + 1}</span>
            <div class="etape-texte"><strong>${x.titre}</strong><small>${x.texte}</small>
              ${etat === 'active' || (etape === 4 && i === 2) ? `<div class="etape-actions">${x.action}</div>` : ''}</div>
          </li>`;
        }).join('')}
      </ol>
    </section>

    ${section ? `<h2 class="titre-reglage" id="rappel">${ic('cours', 'ic ic-texte')} Rappel du cours</h2>
    <article class="carte rappel-cours" style="--c:${t.couleur}">
      <div class="cours">${section.html}</div>
      <div class="actions-section">
        ${audio.audioDisponible ? `<button class="bouton secondaire" data-action="lire-texte" data-texte="${e(section.titre + '. ' + section.texte)}">${ic('casque')} Écouter</button>` : ''}
        <a class="bouton secondaire" href="#/cours/${themeId}/${stId}">${ic('cours')} Tout le cours</a>
      </div>
    </article>
    <div class="fin-rappel">${entrainer('S’entraîner sur cette partie', 'bouton large')}</div>` : ''}`, 'progres');
}

// ----- Réglages et à propos -----

/** Choix sous forme de boutons (segments), avec icône facultative. */
function segments(cle, valeurs, actuelle) {
  return `<div class="segments" role="group">${valeurs.map(([v, l, icone]) => `<button data-action="pref" data-cle="${cle}" data-v="${v}" class="${String(actuelle) === String(v) ? 'actif' : ''}" aria-pressed="${String(actuelle) === String(v)}">${icone ? ic(icone, 'ic ic-texte') : ''} ${l}</button>`).join('')}</div>`;
}

/** Ligne de réglage : pastille, titre, description, chevron ou contenu à droite. */
function ligneReglage({ action, href, attrs = '', icone, couleur, titre, texte, danger, externe }) {
  const contenu = `${pastille(icone, 'petite')}<span class="lt-texte"><strong>${titre}</strong>${texte ? `<small>${texte}</small>` : ''}</span><span class="chevron">${ic('chevron')}</span>`;
  const cls = `ligne-reglage ${danger ? 'danger' : ''}`;
  const style = ` style="--c:${couleur || 'var(--primaire)'}"`;
  if (href) return `<a class="${cls}" href="${href}"${style}${externe ? ' target="_blank" rel="noopener noreferrer"' : ''}>${contenu}</a>`;
  if (action === 'importer') return `<label class="${cls}"${style}>${contenu}<input type="file" accept="application/json,.json" data-action-change="importer" hidden></label>`;
  return `<button class="${cls}" data-action="${action}" ${attrs}${style}>${contenu}</button>`;
}

function vueReglages() {
  const et = store.getEtat();
  const voix = audio.voixFrancaises();
  const p = PARCOURS[et.parcours];
  afficher(`
    ${entete('Réglages')}

    <h2 class="titre-reglage">Mon examen</h2>
    <div class="groupe-lignes">
      ${Object.values(PARCOURS).map((x) => `<button class="ligne-reglage ligne-radio ${et.parcours === x.id ? 'actif' : ''}" data-action="choisir-parcours" data-p="${x.id}" style="--c:${x.couleur}" aria-pressed="${et.parcours === x.id}">
        ${pastille(x.icone, 'petite')}<span class="lt-texte"><strong>${x.court}</strong><small>${x.resume}</small></span>
        <span class="radio" aria-hidden="true">${et.parcours === x.id ? ic('valide') : ''}</span></button>`).join('')}
    </div>
    <p class="note-reglage">Chaque examen a sa propre progression.</p>

    <h2 class="titre-reglage">Affichage</h2>
    <div class="groupe-lignes">
      <div class="ligne-reglage ligne-controle" style="--c:var(--c-principes)">
        ${pastille('texte', 'petite')}<span class="lt-texte"><strong>Taille du texte</strong></span>
        ${segments('taille', [['normal', '<span class="apercu-a a1">A</span>'], ['grand', '<span class="apercu-a a2">A</span>'], ['tres-grand', '<span class="apercu-a a3">A</span>']], et.prefs.taille)}
      </div>
      <div class="ligne-reglage ligne-controle" style="--c:var(--c-institutions)">
        ${pastille(et.prefs.theme === 'sombre' ? 'lune' : et.prefs.theme === 'clair' ? 'soleil' : 'auto', 'petite')}<span class="lt-texte"><strong>Apparence</strong></span>
        ${segments('theme', [['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']], et.prefs.theme)}
      </div>
    </div>
    <p class="note-reglage">« Auto » suit le réglage de votre téléphone (clair le jour, sombre le soir).</p>

    ${audio.audioDisponible ? `<h2 class="titre-reglage">Audio</h2>
    <div class="groupe-lignes">
      <div class="ligne-reglage ligne-controle" style="--c:var(--c-histoire)">
        ${pastille('casque', 'petite')}<span class="lt-texte"><strong>Vitesse</strong></span>
        ${segments('vitesse', [[0.8, 'Lente'], [1, 'Normale'], [1.2, 'Rapide']], Number(et.prefs.vitesse))}
      </div>
      ${voix.length > 1 ? `<label class="ligne-reglage ligne-controle" style="--c:var(--c-droits)">${pastille('son', 'petite')}<span class="lt-texte"><strong>Voix</strong></span>
        <select data-action-change="voix" aria-label="Voix de lecture">${voix.map((v) => `<option ${v.name === et.prefs.voix ? 'selected' : ''}>${e(v.name)}</option>`).join('')}</select></label>` : ''}
      ${ligneReglage({ action: 'lire-texte', attrs: 'data-texte="Bonjour, voici un exemple de lecture."', icone: 'jouer', couleur: 'var(--c-droits)', titre: 'Tester la voix', texte: 'Écouter un court exemple' })}
    </div>` : ''}

    <h2 class="titre-reglage">Ma progression</h2>
    <div class="groupe-lignes">
      ${ligneReglage({ action: 'exporter', icone: 'telecharger', couleur: 'var(--c-droits)', titre: 'Télécharger ma progression', texte: 'Un fichier à garder ou à transférer' })}
      ${ligneReglage({ action: 'importer', icone: 'importer', couleur: 'var(--c-principes)', titre: 'Importer une progression', texte: 'Depuis un fichier téléchargé avant' })}
      ${ligneReglage({ action: 'reinitialiser', icone: 'corbeille', couleur: 'var(--ko)', titre: 'Effacer la progression', texte: `Seulement pour « ${p.court} »`, danger: true })}
    </div>
    <p class="note-reglage">${ic('bouclier', 'ic ic-texte')} Votre progression reste sur cet appareil : aucun compte, aucune donnée envoyée. Pour changer d’appareil, téléchargez le fichier puis importez-le.</p>

    <h2 class="titre-reglage">Informations</h2>
    <div class="groupe-lignes">
      ${ligneReglage({ href: '#/a-propos', icone: 'info', couleur: 'var(--c-institutions)', titre: 'À propos', texte: 'Sources, vie privée, contribuer' })}
      ${ligneReglage({ href: 'https://github.com/Nicko887/passeport-civique/issues', icone: 'attention', couleur: 'var(--attention)', titre: 'Signaler une erreur', texte: 'Sur GitHub (nouvel onglet)', externe: true })}
    </div>
    <p class="note-reglage centre">${APP_NAME} · gratuit, sans publicité, open source</p>`, 'aucun');
}

/** Ligne d'information, non cliquable. */
function ligneInfo(icone, couleur, titre, texte) {
  return `<div class="ligne-reglage ligne-info" style="--c:${couleur}">${pastille(icone, 'petite')}<span class="lt-texte"><strong>${titre}</strong>${texte ? `<small>${texte}</small>` : ''}</span></div>`;
}

function vueAPropos() {
  const retour = parcoursCourant() ? '#/reglages' : '#/';
  afficher(`
    <div class="hero hero-apropos" data-titre="À propos" data-retour="${retour}">
      <div class="hero-haut">
        <a class="retour retour-hero" href="${retour}" aria-label="Retour">${ic('retour')}</a>
        <span class="hero-marque">À propos</span>
      </div>
      <div class="apropos-marque">
        <span class="logo-marque logo-grand">${ic('valide')}</span>
        <h1>${APP_NAME}</h1>
        <p class="hero-texte">Pour préparer l’examen civique : carte pluriannuelle, carte de résident et naturalisation.</p>
      </div>
    </div>

    <section class="chevauche">
      <ul class="reperes reperes-apropos" aria-label="En bref">
        <li>${pastille('valide', 'petite')}<span>Gratuit, sans publicité</span></li>
        <li>${pastille('bouclier', 'petite')}<span>Sans compte ni inscription</span></li>
        <li>${pastille('code', 'petite')}<span>Ouvert à tous (open source)</span></li>
      </ul>
      <div class="carte carte-info attention">${ic('attention')}<p>C’est un <strong>outil indépendant</strong> : il n’est pas édité par l’État ni par le ministère de l’Intérieur.</p></div>
    </section>

    <h2 class="titre-reglage">Sources</h2>
    <div class="groupe-lignes">
      ${ligneReglage({ href: 'https://formation-civique.interieur.gouv.fr/', icone: 'institutions', couleur: 'var(--c-institutions)', titre: 'Questions officielles', texte: 'Site du ministère de l’Intérieur', externe: true })}
      ${ligneReglage({ href: 'https://leqcmcivique.fr', icone: 'valide', couleur: 'var(--c-droits)', titre: 'Réponses suggérées par leqcmcivique.fr', texte: 'Publiées sur data.gouv.fr, Licence Ouverte 2.0', externe: true })}
      ${ligneReglage({ href: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052381620', icone: 'chrono', couleur: 'var(--c-histoire)', titre: 'Format de l’examen', texte: '40 questions, dont 12 mises en situation · 45 minutes · 32 bonnes réponses pour réussir', externe: true })}
    </div>
    <p class="note-reglage">Les mauvaises réponses, les explications, les mises en situation et les cours sont rédigés pour ce projet, à partir de sources officielles. Il n’existe pas de liste officielle des mises en situation. Une erreur reste possible : signalez-la !</p>

    <h2 class="titre-reglage">Vie privée</h2>
    <div class="groupe-lignes">
      ${ligneInfo('bouclier', 'var(--ok)', 'Aucun compte', 'Pas d’inscription, pas d’adresse e-mail')}
      ${ligneInfo('valide', 'var(--ok)', 'Aucune donnée collectée', 'Pas de cookie publicitaire, pas de mesure d’audience')}
      ${ligneInfo('accueil', 'var(--ok)', 'Tout reste sur votre appareil', 'Votre progression ne quitte pas votre téléphone')}
    </div>

    <h2 class="titre-reglage">Contribuer</h2>
    <div class="groupe-lignes">
      ${ligneReglage({ href: 'https://github.com/Nicko887/passeport-civique/issues', icone: 'attention', couleur: 'var(--attention)', titre: 'Signaler une erreur', texte: 'Sur GitHub (nouvel onglet)', externe: true })}
      ${ligneReglage({ href: 'https://github.com/Nicko887/passeport-civique', icone: 'code', couleur: 'var(--c-principes)', titre: 'Voir le code source', texte: 'Le code et le contenu sont ouverts', externe: true })}
    </div>
    <p class="note-reglage centre">${APP_NAME} · gratuit et open source</p>`, 'aucun');
}

// ---------- Navigation ----------

function naviguer(h) {
  if (location.hash === h) routeur();
  else location.hash = h;
}

async function routeur() {
  animerEntree = true;
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
    case 'ouvrir-parcours': document.getElementById('feuille-parcours')?.showModal(); break;
    case 'fermer-parcours': document.getElementById('feuille-parcours')?.close(); break;
    case 'choisir-parcours':
      document.getElementById('feuille-parcours')?.close();
      store.setParcours(d.p);
      if (location.hash.includes('reglages')) { toast('Examen choisi : ' + PARCOURS[d.p].titre); vueReglages(); }
      else {
        if (location.hash === '#/' || location.hash === '') toast('Examen choisi : ' + PARCOURS[d.p].titre);
        naviguer('#/');
      }
      break;
    case 'repondre': repondre(Number(d.k)); break;
    case 'filtre-correction':
      document.getElementById('liste-corrections')?.classList.toggle('que-erreurs', d.f === 'ko');
      el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('actif', b === el));
      break;
    case 'suiv': suivante(); break;
    case 'prec': session.i = Math.max(0, session.i - 1); vueQuestion(); break;
    case 'aller': document.getElementById('feuille-exam')?.close(); session.i = Number(d.k); vueQuestion(); window.scrollTo(0, 0); break;
    case 'ouvrir-grille': document.getElementById('feuille-exam')?.showModal(); break;
    case 'fermer-grille': document.getElementById('feuille-exam')?.close(); break;
    case 'marquer':
      if (session.marquees.has(session.i)) session.marquees.delete(session.i); else session.marquees.add(session.i);
      vueQuestion();
      break;
    case 'terminer': {
      const manquantes = session.questions.length - session.reponses.filter((x) => x !== undefined).length;
      const marquees = session.marquees?.size || 0;
      const avertir = [manquantes ? `${manquantes} question${manquantes > 1 ? 's' : ''} sans réponse` : '', marquees ? `${marquees} question${marquees > 1 ? 's' : ''} marquée${marquees > 1 ? 's' : ''} « à revoir »` : ''].filter(Boolean).join(' et ');
      if (!avertir || confirm(`Il reste ${avertir}. Terminer quand même ?`)) { document.getElementById('feuille-exam')?.close(); terminerExamen(); }
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
    case 'voir-rappel':
      document.getElementById('rappel')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      break;
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
    case 'ecouter-cours': ev.preventDefault?.(); await lancerEcoute(d.theme, d.index); break;
    case 'ecouter-tout': {
      const toutes = [];
      for (const t of THEMES) toutes.push(...await pistesTheme(t.id));
      if (toutes.length) audio.ecouter(toutes, 0, majLecteur);
      break;
    }
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
  if (!session || ev.target.matches('input, select, textarea') || document.querySelector('dialog[open]')) return;
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
