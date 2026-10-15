/* ============================================================
   YO'SECOURS · Tableau de bord · LOGIQUE, CALCULS ET RENDU
   ------------------------------------------------------------
   Sommaire
     1. Outils (formats français, dates, échappement HTML)
     2. Chargement des données
     3. Règles métier (statuts, encaissements, indicateurs)
     4. Période sélectionnée
     5. Composants : tableau triable + CSV, graphique, jauge
     6. Rendu des six vues
     7. Navigation (menu, onglets, menu mobile) et démarrage

   Aucun chiffre n'est écrit dans le HTML : tout est calculé ici à
   partir de data.js (données) et config.js (constantes).
   ============================================================ */

;(function () {
  "use strict"

  const CFG = window.YO_CONFIG
  const API = window.YoData

  /* ============================================================
     1. OUTILS
     ============================================================ */

  const fmtEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
  const fmtEuroRond = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
  const fmtNombre = new Intl.NumberFormat("fr-FR")
  const fmtDecimal = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
  const fmtPct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 })
  const fmtPctPrecis = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 })
  const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
  const fmtMoisAnnee = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" })
  const fmtMoisCourt = new Intl.DateTimeFormat("fr-FR", { month: "short" })
  const fmtJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  const euro = (n) => fmtEuro.format(n)
  const euroRond = (n) => fmtEuroRond.format(n)
  const nombre = (n) => fmtNombre.format(n)
  const pct = (n) => fmtPct.format(n)
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  const somme = (liste, f = (x) => x) => liste.reduce((t, x) => t + f(x), 0)
  const arrondi = (n) => Math.round(n * 100) / 100

  /** Échappe une valeur avant insertion dans du HTML */
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
  }

  /** "AAAA-MM-JJ" → Date locale à minuit (sans décalage de fuseau) */
  function versDate(iso) {
    const [a, m, j] = iso.split("-").map(Number)
    return new Date(a, m - 1, j)
  }

  function versIso(d) {
    const p = (n) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  /** Date au format français jj/mm/aaaa */
  const dateFr = (iso) => (iso ? fmtDate.format(versDate(iso)) : "")

  const ajouterJours = (iso, n) => {
    const d = versDate(iso)
    d.setDate(d.getDate() + n)
    return versIso(d)
  }

  const ajouterMois = (iso, n) => {
    const d = versDate(iso)
    const jourDuMois = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + n)
    // 29 février + 24 mois → 28 février (pas de débordement sur mars)
    const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(jourDuMois, dernier))
    return versIso(d)
  }

  const ecartJours = (isoA, isoB) => Math.round((versDate(isoB) - versDate(isoA)) / 86400000)

  /** Date du jour (figée si config.dateDuJour est renseignée) */
  const AUJ = CFG.dateDuJour || versIso(new Date())

  /** Normalise un texte pour la recherche : minuscules, sans accents */
  const normaliser = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")

  const icone = {
    recherche: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    export: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    droite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    alerte: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/></svg>',
    horloge: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    badge: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
  }

  /* ============================================================
     2. DONNÉES
     ============================================================ */

  const db = {}

  async function chargerDonnees() {
    const [formations, clients, sessions, factures, devis, charges, certifications] = await Promise.all([
      API.getFormations(),
      API.getClients(),
      API.getSessions(),
      API.getFactures(),
      API.getDevis(),
      API.getCharges(),
      API.getCertifications(),
    ])
    Object.assign(db, { formations, clients, sessions, factures, devis, charges, certifications })
    db.formation = Object.fromEntries(formations.map((f) => [f.id, f]))
    db.client = Object.fromEntries(clients.map((c) => [c.id, c]))
    db.session = Object.fromEntries(sessions.map((s) => [s.id, s]))

    // Montants calculés une fois pour toutes
    factures.forEach((f) => (f.montantHT = arrondi(somme(f.lignes, (l) => l.quantite * l.prixUnitaireHT))))
  }

  /* ============================================================
     3. RÈGLES MÉTIER
     ============================================================ */

  const LIBELLES_TYPE_CLIENT = { entreprise: "Entreprise", collectivite: "Collectivité", association: "Association" }
  const DEPARTEMENTS = [
    { code: "73", nom: "Savoie" },
    { code: "74", nom: "Haute-Savoie" },
    { code: "38", nom: "Isère" },
    { code: "05", nom: "Hautes-Alpes" },
  ]

  /** Statut d'une facture, déduit des dates (la couleur n'est jamais seule : libellé + symbole) */
  function statutFacture(f) {
    if (f.datePaiement) return { code: "payee", libelle: "Payée", classe: "green" }
    if (f.dateEcheance < AUJ) return { code: "retard", libelle: "En retard", classe: "red" }
    return { code: "attente", libelle: "En attente", classe: "yellow" }
  }

  function statutDevis(d) {
    if (d.statut === "accepte") return { code: "accepte", libelle: "Accepté", classe: "green" }
    if (d.statut === "refuse") return { code: "refuse", libelle: "Refusé", classe: "grey" }
    if (d.dateValidite < AUJ) return { code: "expire", libelle: "Expiré", classe: "grey" }
    return { code: "attente", libelle: "En attente", classe: "yellow" }
  }

  function statutSession(s) {
    if (s.statut === "annulee") return { code: "annulee", libelle: "Annulée", classe: "grey" }
    if (s.dateFin < AUJ) return { code: "realisee", libelle: "Réalisée", classe: "green" }
    if (s.dateDebut <= AUJ) return { code: "en_cours", libelle: "En cours", classe: "blue" }
    if (s.statut === "option") return { code: "option", libelle: "Option", classe: "yellow" }
    return { code: "confirmee", libelle: "Confirmée", classe: "blue" }
  }

  const estRealisee = (s) => statutSession(s).code === "realisee"
  const nbStagiaires = (s) => somme(s.inscriptions, (i) => i.stagiaires)
  const dansPeriode = (iso, p) => iso >= p.d && iso <= p.f
  const nomFormation = (id) => db.formation[id]?.nom ?? id

  /** Factures encaissées entre deux dates (le CA d'une micro-entreprise se compte à l'encaissement) */
  const encaissees = (d, f) => db.factures.filter((x) => x.datePaiement && x.datePaiement >= d && x.datePaiement <= f)
  const caEncaisse = (d, f) => arrondi(somme(encaissees(d, f), (x) => x.montantHT))

  const chargesEntre = (d, f) => db.charges.filter((c) => c.date >= d && c.date <= f)
  const cotisations = (ca) => arrondi(ca * CFG.tauxCotisations)

  /** Lignes de factures encaissées, enrichies (type de session, client) */
  function lignesEncaissees(p) {
    return encaissees(p.d, p.f).flatMap((f) =>
      f.lignes.map((l) => ({
        ...l,
        montant: l.quantite * l.prixUnitaireHT,
        type: db.session[f.sessionId]?.type,
        departement: db.client[f.clientId]?.departement,
      }))
    )
  }

  /** Taux de transformation des devis émis sur une plage (devis tranchés uniquement) */
  function tauxTransformation(devis) {
    const tranches = devis.filter((d) => statutDevis(d).code !== "attente")
    if (!tranches.length) return null
    return tranches.filter((d) => d.statut === "accepte").length / tranches.length
  }

  /** Délai moyen entre émission et paiement, en jours */
  function delaiMoyen(factures) {
    const payees = factures.filter((f) => f.datePaiement)
    if (!payees.length) return null
    return somme(payees, (f) => ecartJours(f.dateEmission, f.datePaiement)) / payees.length
  }

  /** Certificats expirant dans la fenêtre d'alerte (validité 24 mois) */
  function certificationsARenouveler() {
    const limite = ajouterJours(AUJ, CFG.alerteCertificationsJours)
    return db.certifications
      .map((c) => {
        const expiration = ajouterMois(c.dateFormation, 24)
        return { ...c, expiration, joursRestants: ecartJours(AUJ, expiration) }
      })
      .filter((c) => c.expiration >= AUJ && c.expiration <= limite)
      .sort((a, b) => a.joursRestants - b.joursRestants)
  }

  /* ============================================================
     4. PÉRIODE SÉLECTIONNÉE
     ============================================================ */

  const etat = { type: "mois", decalage: 0, vue: "vue-ensemble" }

  function calculerPeriode(type, decalage) {
    const auj = versDate(AUJ)
    const a = auj.getFullYear()
    const m = auj.getMonth()
    let debut, fin, libelle

    if (type === "mois") {
      debut = new Date(a, m + decalage, 1)
      fin = new Date(a, m + decalage + 1, 0)
      libelle = majuscule(fmtMoisAnnee.format(debut))
    } else if (type === "trimestre") {
      const t = Math.floor(m / 3) + decalage
      debut = new Date(a, t * 3, 1)
      fin = new Date(a, t * 3 + 3, 0)
      const n = Math.floor(debut.getMonth() / 3) + 1
      libelle = `${n === 1 ? "1er" : `${n}e`} trimestre ${debut.getFullYear()}`
    } else {
      debut = new Date(a + decalage, 0, 1)
      fin = new Date(a + decalage, 11, 31)
      libelle = `Année ${debut.getFullYear()}`
    }

    const d = versIso(debut)
    const f = versIso(fin)
    // Date de référence pour les cartes « mois / trimestre / année » :
    // aujourd'hui pour la période en cours, sinon sa borne la plus proche
    const reference = f < AUJ ? f : d > AUJ ? d : AUJ
    return { type, d, f, libelle, reference, enCours: d <= AUJ && AUJ <= f }
  }

  const periode = () => calculerPeriode(etat.type, etat.decalage)

  /** Plages mois, trimestre et année contenant une date */
  function plagesDe(iso) {
    const d = versDate(iso)
    const a = d.getFullYear()
    const m = d.getMonth()
    const t = Math.floor(m / 3)
    return {
      mois: { d: versIso(new Date(a, m, 1)), f: versIso(new Date(a, m + 1, 0)), nom: majuscule(fmtMoisAnnee.format(d)) },
      trimestre: { d: versIso(new Date(a, t * 3, 1)), f: versIso(new Date(a, t * 3 + 3, 0)), nom: `${t === 0 ? "1er" : `${t + 1}e`} trimestre ${a}` },
      annee: { d: `${a}-01-01`, f: `${a}-12-31`, nom: `Année ${a}` },
    }
  }

  /** Bornes de navigation : on ne remonte pas avant les premières données */
  function bornesDonnees() {
    const dates = [...db.factures.map((f) => f.dateEmission), ...db.sessions.map((s) => s.dateDebut), ...db.charges.map((c) => c.date)].sort()
    return { min: dates[0], max: dates.at(-1) }
  }

  /* ============================================================
     5. COMPOSANTS
     ============================================================ */

  /* ---------- 5.1 Tableau triable, filtrable, exportable ----------
     colonnes : [{ cle, titre, type: "texte"|"nombre"|"montant"|"date"|"statut",
                   valeur(ligne) → valeur de tri et d'export,
                   affiche(ligne) → HTML de la cellule (facultatif),
                   csv(ligne) → texte exporté (facultatif) }] */
  const tableaux = {}

  function creerTableau(cle, options) {
    const hote = document.querySelector(`[data-tableau="${cle}"]`)
    const t = {
      options,
      recherche: "",
      tri: options.triDefaut || { cle: options.colonnes[0].cle, sens: "asc" },
      filtres: Object.fromEntries((options.filtres || []).map((f) => [f.cle, f.defaut])),
    }
    tableaux[cle] = t

    const idRecherche = `recherche-${cle}`
    const filtresHtml = (options.filtres || [])
      .map((f) => {
        if (f.type === "case") {
          return `<label class="case"><input type="checkbox" data-filtre="${f.cle}" ${f.defaut ? "checked" : ""}> ${esc(f.libelle)}</label>`
        }
        return `<label class="case">${esc(f.libelle)}
          <select data-filtre="${f.cle}" class="champ-select">
            ${f.choix.map((c) => `<option value="${esc(c.valeur)}" ${c.valeur === f.defaut ? "selected" : ""}>${esc(c.libelle)}</option>`).join("")}
          </select></label>`
      })
      .join("")

    hote.innerHTML = `
      <div class="tableau__outils">
        <div class="recherche">
          ${icone.recherche}
          <label class="sr-only" for="${idRecherche}">Rechercher dans le tableau ${esc(options.legende)}</label>
          <input type="search" id="${idRecherche}" placeholder="Rechercher" autocomplete="off">
        </div>
        ${filtresHtml}
        <p class="tableau__compte" aria-live="polite"></p>
        <button type="button" class="btn btn--outline-rouge btn--sm" data-export>${icone.export} Exporter en CSV</button>
      </div>
      <div class="tableau__defil" role="region" aria-label="${esc(options.legende)}" tabindex="0">
        <table>
          <caption class="sr-only">${esc(options.legende)}. Les en-têtes de colonnes permettent de trier.</caption>
          <thead><tr>${options.colonnes
            .map(
              (c) => `<th scope="col" data-col="${c.cle}" class="${["montant", "nombre"].includes(c.type) ? "num" : ""}">
                ${c.triable === false ? esc(c.titre) : `<button type="button" class="tri">${esc(c.titre)}<span class="tri__icone" aria-hidden="true">↕</span></button>`}
              </th>`
            )
            .join("")}</tr></thead>
          <tbody></tbody>
        </table>
      </div>`

    hote.querySelector("input[type=search]").addEventListener("input", (e) => {
      t.recherche = normaliser(e.target.value.trim())
      majTableau(cle)
    })
    hote.querySelectorAll("[data-filtre]").forEach((el) =>
      el.addEventListener("change", () => {
        t.filtres[el.dataset.filtre] = el.type === "checkbox" ? el.checked : el.value
        majTableau(cle)
      })
    )
    hote.querySelectorAll("th .tri").forEach((btn) =>
      btn.addEventListener("click", () => {
        const col = btn.closest("th").dataset.col
        t.tri = { cle: col, sens: t.tri.cle === col && t.tri.sens === "asc" ? "desc" : "asc" }
        majTableau(cle)
      })
    )
    hote.querySelector("[data-export]").addEventListener("click", () => exporterCsv(cle))
    hote.addEventListener("click", (e) => options.surClic?.(e))

    return t
  }

  /** Lignes visibles : source, filtres, recherche, tri */
  function lignesVisibles(cle) {
    const t = tableaux[cle]
    const { colonnes } = t.options
    let lignes = t.options.lignes(t.filtres)

    if (t.recherche) {
      lignes = lignes.filter((l) => colonnes.some((c) => normaliser(texteCellule(c, l)).includes(t.recherche)))
    }

    const col = colonnes.find((c) => c.cle === t.tri.cle)
    const sens = t.tri.sens === "asc" ? 1 : -1
    return [...lignes].sort((a, b) => {
      const va = col.valeur(a)
      const vb = col.valeur(b)
      if (va === vb) return 0
      if (va === null || va === undefined || va === "") return 1 // valeurs vides toujours en fin
      if (vb === null || vb === undefined || vb === "") return -1
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sens
      return String(va).localeCompare(String(vb), "fr", { sensitivity: "base", numeric: true }) * sens
    })
  }

  function texteCellule(col, ligne) {
    if (col.csv) return col.csv(ligne)
    const v = col.valeur(ligne)
    if (v === null || v === undefined) return ""
    if (col.type === "montant") return euro(v)
    if (col.type === "date") return dateFr(v)
    if (col.type === "nombre") return nombre(v)
    return String(v)
  }

  function majTableau(cle) {
    const t = tableaux[cle]
    if (!t) return
    const { colonnes } = t.options
    const hote = document.querySelector(`[data-tableau="${cle}"]`)
    const lignes = lignesVisibles(cle)

    hote.querySelectorAll("th[data-col]").forEach((th) => {
      const actif = th.dataset.col === t.tri.cle
      if (actif) th.setAttribute("aria-sort", t.tri.sens === "asc" ? "ascending" : "descending")
      else th.removeAttribute("aria-sort")
      const ic = th.querySelector(".tri__icone")
      if (ic) ic.textContent = actif ? (t.tri.sens === "asc" ? "↑" : "↓") : "↕"
    })

    hote.querySelector("tbody").innerHTML = lignes.length
      ? lignes
          .map(
            (l) => `<tr>${colonnes
              .map((c) => {
                const classe = ["montant", "nombre"].includes(c.type) ? "num" : c.type === "date" ? "date" : ""
                const contenu = c.affiche ? c.affiche(l) : esc(texteCellule(c, l))
                return `<td class="${classe}">${contenu}</td>`
              })
              .join("")}</tr>`
          )
          .join("")
      : `<tr><td colspan="${colonnes.length}" class="tableau__vide">${esc(t.options.vide || "Aucun résultat.")}</td></tr>`

    const n = lignes.length
    hote.querySelector(".tableau__compte").textContent = `${nombre(n)} ligne${n > 1 ? "s" : ""}`
    hote.querySelector("[data-export]").disabled = n === 0
  }

  /** Export CSV (séparateur « ; », encodage UTF-8 avec BOM : s'ouvre proprement dans Excel en français) */
  function exporterCsv(cle) {
    const t = tableaux[cle]
    const colonnes = t.options.colonnes.filter((c) => c.exportable !== false)
    const lignes = lignesVisibles(cle)

    const cellule = (c, l) => {
      const v = c.valeur(l)
      let texte
      if (c.csv) texte = c.csv(l)
      else if (v === null || v === undefined) texte = ""
      else if (c.type === "montant") texte = fmtDecimal.format(v) // nombre brut, exploitable dans un tableur
      else if (c.type === "date") texte = dateFr(v)
      else texte = String(v)
      return /[;"\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
    }

    const entete = colonnes.map((c) => (c.type === "montant" && !/HT|TTC/.test(c.titre) ? `${c.titre} (€)` : c.titre))
    const csv = [entete.join(";"), ...lignes.map((l) => colonnes.map((c) => cellule(c, l)).join(";"))].join("\r\n")

    const lien = document.createElement("a")
    lien.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
    lien.download = `yosecours-${cle}-${AUJ}.csv`
    document.body.append(lien)
    lien.click()
    lien.remove()
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000)
    notifier(`Export CSV : ${nombre(lignes.length)} ligne${lignes.length > 1 ? "s" : ""} (fichier ${lien.download}).`)
  }

  /* ---------- 5.2 Graphiques (Chart.js) ----------
     Chaque graphique est doublé d'un tableau de données dépliable :
     les chiffres restent accessibles au clavier, aux lecteurs d'écran,
     et lisibles si Chart.js ne se charge pas. */
  const graphiques = {}
  const COULEURS = { nuit: "#0C1B2E", rouge: "#C8102E", pierre: "#8A9BAC", neige: "#F7F4EF", texte: "#556070", grille: "#ECE8E1" }

  function configurerChartJs() {
    if (!window.Chart) return
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif"
    Chart.defaults.font.size = 12
    Chart.defaults.color = COULEURS.texte
    Chart.defaults.maintainAspectRatio = false
    Chart.defaults.plugins.legend.labels.usePointStyle = true
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) Chart.defaults.animation = false
  }

  /**
   * @param {string} cle            identifiant [data-graphique]
   * @param {object} config         configuration Chart.js
   * @param {string} resume         phrase de synthèse (aria-label du canvas)
   * @param {object} donnees        { entetes: [...], lignes: [[...], ...] } pour le tableau dépliable
   */
  function graphique(cle, config, resume, donnees) {
    const hote = document.querySelector(`[data-graphique="${cle}"]`)
    graphiques[cle]?.destroy()

    const tableau = `
      <table>
        <thead><tr>${donnees.entetes.map((e, i) => `<th scope="col" class="${i ? "num" : ""}">${esc(e)}</th>`).join("")}</tr></thead>
        <tbody>${donnees.lignes.map((l) => `<tr>${l.map((v, i) => (i ? `<td class="num">${esc(v)}</td>` : `<th scope="row">${esc(v)}</th>`)).join("")}</tr>`).join("")}</tbody>
      </table>`

    if (!window.Chart) {
      hote.innerHTML = `<p class="graphique__secours">Le graphique n'a pas pu être chargé (connexion au CDN Chart.js). Les données :</p>${tableau}`
      return
    }

    hote.innerHTML = `
      <div class="graphique__zone"><canvas role="img" aria-label="${esc(resume)}"></canvas></div>
      <details><summary>Afficher les données du graphique</summary>${tableau}</details>`
    graphiques[cle] = new Chart(hote.querySelector("canvas"), config)
  }

  /** Axe en euros (nouvel objet à chaque appel : Chart.js modifie les options qu'on lui passe) */
  const axeEuro = () => ({ ticks: { callback: (v) => euroRond(v) }, grid: { color: COULEURS.grille }, border: { display: false }, beginAtZero: true })

  /* ---------- 5.3 Jauge ---------- */
  function jauge({ titre, valeur, plafond, legende, idTitre }) {
    const ratio = plafond ? valeur / plafond : 0
    const niveau = ratio >= 0.9 ? "danger" : ratio >= 0.75 ? "attention" : ""
    const texteNiveau = ratio >= 0.9 ? " Seuil presque atteint." : ratio >= 0.75 ? " À surveiller." : ""
    return `
      <article class="carte jauge">
        <h2 class="carte__titre" id="${idTitre}">${esc(titre)}</h2>
        <div class="jauge__chiffres">
          <p class="kpi__valeur">${pct(ratio)}</p>
          <p class="kpi__detail"><strong>${euro(valeur)}</strong> sur ${euroRond(plafond)} HT</p>
        </div>
        <div class="jauge__piste" role="progressbar" aria-labelledby="${idTitre}"
             aria-valuemin="0" aria-valuemax="${plafond}" aria-valuenow="${Math.round(Math.min(valeur, plafond))}"
             aria-valuetext="${esc(`${pct(ratio)}, soit ${euroRond(valeur)} sur ${euroRond(plafond)}.${texteNiveau}`)}">
          <div class="jauge__barre ${niveau ? `jauge__barre--${niveau}` : ""}" style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></div>
        </div>
        <p class="jauge__legende">${legende}${texteNiveau ? ` <strong>${esc(texteNiveau.trim())}</strong>` : ""}</p>
      </article>`
  }

  /* ---------- 5.4 Petits gabarits ---------- */
  const badge = (s) => `<span class="badge badge--${s.classe}">${esc(s.libelle)}</span>`

  function kpi({ label, valeur, detail = "", classe = "" }) {
    return `
      <article class="carte kpi ${classe}">
        <h2 class="kpi__label">${esc(label)}</h2>
        <p class="kpi__valeur">${valeur}</p>
        ${detail ? `<p class="kpi__detail">${detail}</p>` : ""}
      </article>`
  }

  function zone(nom, html) {
    const el = document.querySelector(`[data-zone="${nom}"]`)
    if (el) el.innerHTML = html
  }

  let minuteurToast
  function notifier(message) {
    const el = document.querySelector(".toast")
    el.hidden = false
    el.textContent = message
    clearTimeout(minuteurToast)
    minuteurToast = setTimeout(() => (el.hidden = true), 5000)
  }

  const nomsClientsSession = (s) => s.inscriptions.map((i) => db.client[i.clientId]?.nom).join(", ")

  /* ============================================================
     6. VUES
     ============================================================ */

  /* ---------- 6.1 Vue d'ensemble ---------- */
  function rendreVueEnsemble(p) {
    const plages = plagesDe(p.reference)
    const obj = CFG.objectifAnnuel

    // CA encaissé du mois, du trimestre et de l'année
    const lignesCa = [
      { cle: "mois", plage: plages.mois, objectif: obj / 12, libelleObjectif: "de l'objectif mensuel" },
      { cle: "trimestre", plage: plages.trimestre, objectif: obj / 4, libelleObjectif: "de l'objectif trimestriel" },
      { cle: "annee", plage: plages.annee, objectif: obj, libelleObjectif: "de l'objectif annuel" },
    ]
      .map(({ cle, plage, objectif, libelleObjectif }) => {
        const ca = caEncaisse(plage.d, plage.f)
        return `
          <div class="ca-ligne ${cle === p.type ? "est-selection" : ""}">
            <span class="ca-ligne__nom">${esc(plage.nom)}</span>
            <span class="ca-ligne__montant">${euroRond(ca)}</span>
            <span class="ca-ligne__objectif">${pct(ca / objectif)} ${libelleObjectif} (${euroRond(objectif)} HT)</span>
          </div>`
      })
      .join("")

    const caP = caEncaisse(p.d, p.f)
    const cotis = cotisations(caP)
    const chargesP = somme(chargesEntre(p.d, p.f), (c) => c.montant)
    const benefice = caP - cotis - chargesP

    zone(
      "kpi-ca",
      `<article class="carte kpi">
         <h2 class="kpi__label">CA encaissé HT</h2>
         <div class="ca-lignes">${lignesCa}</div>
       </article>` +
        kpi({
          label: "Cotisations à mettre de côté",
          valeur: euroRond(cotis),
          detail: `${fmtPctPrecis.format(CFG.tauxCotisations)} du CA encaissé sur la période (${euro(caP)} HT). Estimation.`,
          classe: "kpi--accent",
        }) +
        kpi({
          label: "Bénéfice estimé après charges",
          valeur: euroRond(benefice),
          detail: `CA ${euroRond(caP)} − cotisations ${euroRond(cotis)} − charges ${euroRond(chargesP)}. Avant impôt sur le revenu.`,
        })
    )

    // Jauges : plafond micro-entreprise et seuil de TVA, sur l'année civile
    const caAnnee = caEncaisse(plages.annee.d, plages.annee.f)
    const anneeEnCours = plages.annee.d <= AUJ && AUJ <= plages.annee.f
    let projection = ""
    if (anneeEnCours) {
      const ecoule = ecartJours(plages.annee.d, AUJ) + 1
      const total = ecartJours(plages.annee.d, plages.annee.f) + 1
      projection = ` Projection fin d'année au rythme actuel : <strong>${euroRond((caAnnee / ecoule) * total)}</strong>.`
    }
    const jaugeTva = CFG.tvaApplicable
      ? `<article class="carte"><h2 class="carte__titre">Seuil de TVA</h2>
           <p class="kpi__detail">TVA applicable (config.js) : la franchise en base ne s'applique pas, la jauge est désactivée.</p></article>`
      : jauge({
          titre: "Seuil de franchise de TVA",
          idTitre: "jauge-tva",
          valeur: caAnnee,
          plafond: CFG.seuilTVA,
          legende: `CA encaissé ${esc(plages.annee.nom.toLowerCase())}. Reste ${euroRond(Math.max(0, CFG.seuilTVA - caAnnee))} avant le seuil.${projection}`,
        })
    zone(
      "jauges",
      jauge({
        titre: "Plafond de CA de la micro-entreprise",
        idTitre: "jauge-plafond",
        valeur: caAnnee,
        plafond: CFG.plafondCA,
        legende: `CA encaissé ${esc(plages.annee.nom.toLowerCase())}. Reste ${euroRond(Math.max(0, CFG.plafondCA - caAnnee))} avant le plafond.${projection}`,
      }) + jaugeTva
    )

    // Impayés, devis, sessions, certifications
    const impayees = db.factures.filter((f) => !f.datePaiement)
    const retards = impayees.filter((f) => statutFacture(f).code === "retard")
    const attentes = impayees.filter((f) => statutFacture(f).code === "attente")
    const devisEnCours = db.devis.filter((d) => statutDevis(d).code === "attente")
    const devisPeriode = db.devis.filter((d) => dansPeriode(d.dateEmission, p))
    const tauxP = tauxTransformation(devisPeriode)
    const taux12 = tauxTransformation(db.devis.filter((d) => d.dateEmission > ajouterMois(AUJ, -12)))
    const sessionsP = db.sessions.filter((s) => estRealisee(s) && dansPeriode(s.dateDebut, p))
    const certifs = certificationsARenouveler()

    zone(
      "kpi-activite",
      kpi({
        label: "Factures en retard",
        valeur: euroRond(somme(retards, (f) => f.montantHT)),
        detail: `<strong>${retards.length} facture${retards.length > 1 ? "s" : ""}</strong> échue${retards.length > 1 ? "s" : ""}. Plus ${euro(somme(attentes, (f) => f.montantHT))} en attente, non échus (${attentes.length}).`,
        classe: retards.length ? "kpi--alerte" : "",
      }) +
        kpi({
          label: "Devis en cours",
          valeur: `${devisEnCours.length} <small>devis</small>`,
          detail: `${euro(somme(devisEnCours, (d) => d.montantHT))} HT en attente de réponse. Taux de transformation : <strong>${tauxP === null ? "aucun devis tranché sur la période" : pct(tauxP) + " sur la période"}</strong>${taux12 === null ? "" : `, ${pct(taux12)} sur 12 mois`}.`,
        }) +
        kpi({
          label: "Sessions réalisées",
          valeur: `${sessionsP.length} <small>session${sessionsP.length > 1 ? "s" : ""}</small>`,
          detail: `<strong>${nombre(somme(sessionsP, nbStagiaires))} stagiaires formés</strong> sur la période.`,
        }) +
        kpi({
          label: "Certificats à renouveler",
          valeur: `${certifs.length} <small>stagiaire${certifs.length > 1 ? "s" : ""}</small>`,
          detail: `Expiration dans les ${CFG.alerteCertificationsJours} prochains jours, dont <strong>${certifs.filter((c) => c.joursRestants <= 30).length} sous 30 jours</strong>.`,
          classe: certifs.some((c) => c.joursRestants <= 30) ? "kpi--alerte" : "",
        })
    )

    rendreGraphiqueCaMensuel(p)

    // Prochaines sessions (indépendant de la période : c'est l'agenda)
    const prochaines = db.sessions
      .filter((s) => s.dateDebut >= AUJ && s.statut !== "annulee")
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
      .slice(0, 5)
    zone(
      "prochaines-sessions",
      prochaines.length
        ? `<ul class="liste">${prochaines
            .map((s) => {
              const d = versDate(s.dateDebut)
              return `<li class="liste__item">
                <span class="liste__date" aria-hidden="true"><strong>${d.getDate()}</strong><span>${esc(fmtMoisCourt.format(d))}</span></span>
                <span>
                  <span class="liste__titre">${esc(nomFormation(s.formationId))} · ${s.type === "intra" ? "Intra" : "Inter"}</span>
                  <span class="liste__meta"><span class="sr-only">Le ${dateFr(s.dateDebut)}, </span>${esc(nomsClientsSession(s))} · ${esc(s.lieu)} · ${nbStagiaires(s)} stagiaires</span>
                </span>
                ${badge(statutSession(s))}
              </li>`
            })
            .join("")}</ul>`
        : `<p class="liste__vide">Aucune session programmée.</p>`
    )

    // À traiter
    const options = db.sessions.filter((s) => statutSession(s).code === "option")
    const urgents = certifs.filter((c) => c.joursRestants <= 30)
    const alertes = []
    if (retards.length)
      alertes.push({
        icone: icone.alerte,
        titre: `${retards.length} facture${retards.length > 1 ? "s" : ""} en retard, ${euro(somme(retards, (f) => f.montantHT))}`,
        texte: `La plus ancienne est échue depuis ${Math.max(...retards.map((f) => ecartJours(f.dateEcheance, AUJ)))} jours.`,
        lien: `<a class="lien" href="#facturation" data-raccourci="retards">Voir les factures en retard</a>`,
      })
    if (urgents.length)
      alertes.push({
        icone: icone.badge,
        titre: `${urgents.length} certificat${urgents.length > 1 ? "s" : ""} SST expire${urgents.length > 1 ? "nt" : ""} sous 30 jours`,
        texte: "Proposer une MAC SST avant l'expiration.",
        lien: `<a class="lien" href="#certifications">Relancer les stagiaires</a>`,
      })
    if (options.length)
      alertes.push({
        icone: icone.horloge,
        titre: `${options.length} session${options.length > 1 ? "s" : ""} en option à confirmer`,
        texte: options.map((s) => `${nomFormation(s.formationId)} le ${dateFr(s.dateDebut)}`).join(" ; "),
        lien: `<a class="lien" href="#sessions">Voir le planning</a>`,
      })
    if (devisEnCours.length)
      alertes.push({
        icone: icone.doc,
        titre: `${devisEnCours.length} devis en attente de réponse`,
        texte: `${euro(somme(devisEnCours, (d) => d.montantHT))} HT au total.`,
        lien: `<a class="lien" href="#facturation" data-raccourci="devis">Voir les devis</a>`,
      })
    zone(
      "a-traiter",
      alertes.length
        ? alertes
            .map(
              (a) => `<div class="alerte"><span class="alerte__icone">${a.icone}</span>
                <p class="alerte__texte"><strong>${esc(a.titre)}</strong>${esc(a.texte)}<br>${a.lien}</p></div>`
            )
            .join("")
        : `<p class="liste__vide">Rien d'urgent.</p>`
    )
  }

  /** CA encaissé sur 12 mois, se terminant au dernier mois de la période */
  function rendreGraphiqueCaMensuel(p) {
    const fin = versDate(p.f)
    const mois = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(fin.getFullYear(), fin.getMonth() - 11 + i, 1)
      const dIso = versIso(d)
      const fIso = versIso(new Date(d.getFullYear(), d.getMonth() + 1, 0))
      return {
        etiquette: `${fmtMoisCourt.format(d).replace(".", "")} ${String(d.getFullYear()).slice(2)}`,
        long: majuscule(fmtMoisAnnee.format(d)),
        ca: caEncaisse(dIso, fIso),
        selectionne: fIso >= p.d && dIso <= p.f,
      }
    })
    const objectifMensuel = CFG.objectifAnnuel / 12
    const total = somme(mois, (m) => m.ca)
    const meilleur = mois.reduce((a, b) => (b.ca > a.ca ? b : a))

    graphique(
      "ca-mensuel",
      {
        type: "bar", // graphique mixte : barres + ligne d'objectif
        data: {
          labels: mois.map((m) => m.etiquette),
          datasets: [
            {
              type: "bar",
              label: "CA encaissé HT",
              data: mois.map((m) => m.ca),
              backgroundColor: mois.map((m) => (m.selectionne ? COULEURS.rouge : COULEURS.nuit)),
              borderRadius: 4,
              maxBarThickness: 42,
              order: 2,
            },
            {
              type: "line",
              label: "Objectif mensuel",
              data: mois.map(() => objectifMensuel),
              borderColor: COULEURS.pierre,
              borderDash: [6, 5],
              borderWidth: 2,
              pointRadius: 0,
              order: 1,
            },
          ],
        },
        options: {
          scales: { y: axeEuro(), x: { grid: { display: false } } },
          plugins: {
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} : ${euro(c.parsed.y)}` } },
            legend: { position: "bottom" },
          },
        },
      },
      `Histogramme du chiffre d'affaires encaissé sur 12 mois, de ${mois[0].long} à ${mois[11].long}. Total ${euroRond(total)}. Meilleur mois : ${meilleur.long}, ${euroRond(meilleur.ca)}. Objectif mensuel ${euroRond(objectifMensuel)}. Les barres rouges correspondent à la période sélectionnée.`,
      {
        entetes: ["Mois", "CA encaissé HT", "Objectif mensuel"],
        lignes: mois.map((m) => [m.long + (m.selectionne ? " (période)" : ""), euro(m.ca), euroRond(objectifMensuel)]),
      }
    )
  }

  /* ---------- 6.2 Sessions ---------- */
  const calendrier = { mois: null, jour: null }

  function rendreSessions(p) {
    const sessionsP = db.sessions.filter((s) => dansPeriode(s.dateDebut, p))
    const realisees = sessionsP.filter(estRealisee)
    const remplissage = realisees.length ? somme(realisees, (s) => nbStagiaires(s) / s.capacite) / realisees.length : null
    const inter = realisees.filter((s) => s.type === "inter")
    const remplissageInter = inter.length ? somme(inter, (s) => nbStagiaires(s) / s.capacite) / inter.length : null
    const aVenir = db.sessions.filter((s) => s.dateDebut > AUJ && s.statut !== "annulee")

    zone(
      "kpi-sessions",
      kpi({ label: "Sessions réalisées", valeur: `${realisees.length}`, detail: `sur la période, dont ${inter.length} en inter.` }) +
        kpi({ label: "Stagiaires formés", valeur: nombre(somme(realisees, nbStagiaires)), detail: "sur la période." }) +
        kpi({
          label: "Taux de remplissage moyen",
          valeur: remplissage === null ? "—" : pct(remplissage),
          detail: remplissageInter === null ? "Aucune session inter réalisée sur la période." : `Sessions inter seules : <strong>${pct(remplissageInter)}</strong>. Rapport stagiaires / places.`,
        }) +
        kpi({
          label: "Sessions à venir",
          valeur: `${aVenir.length}`,
          detail: `dont ${aVenir.filter((s) => s.statut === "option").length} en option, non confirmées.`,
        })
    )

    if (!calendrier.mois) calendrier.mois = p.reference.slice(0, 7)
    rendreCalendrier()

    if (!tableaux.sessions) {
      creerTableau("sessions", {
        legende: "Liste des sessions",
        triDefaut: { cle: "date", sens: "desc" },
        filtres: [
          { cle: "periode", type: "case", libelle: "Période sélectionnée uniquement", defaut: true },
          {
            cle: "quand",
            type: "select",
            libelle: "Afficher",
            defaut: "toutes",
            choix: [
              { valeur: "toutes", libelle: "Passées et à venir" },
              { valeur: "venir", libelle: "À venir" },
              { valeur: "passees", libelle: "Passées" },
            ],
          },
        ],
        vide: "Aucune session pour ces critères.",
        lignes: (f) =>
          db.sessions.filter(
            (s) =>
              (!f.periode || dansPeriode(s.dateDebut, periode())) &&
              (f.quand === "toutes" || (f.quand === "venir" ? s.dateFin >= AUJ : s.dateFin < AUJ))
          ),
        colonnes: [
          {
            cle: "date",
            titre: "Date",
            type: "date",
            valeur: (s) => s.dateDebut,
            affiche: (s) => `${dateFr(s.dateDebut)}${s.dateFin !== s.dateDebut ? `<span class="cellule-sous">au ${dateFr(s.dateFin)}</span>` : ""}`,
            csv: (s) => (s.dateFin !== s.dateDebut ? `${dateFr(s.dateDebut)} au ${dateFr(s.dateFin)}` : dateFr(s.dateDebut)),
          },
          { cle: "formation", titre: "Formation", type: "texte", valeur: (s) => s.libelle || nomFormation(s.formationId) },
          { cle: "type", titre: "Intra / inter", type: "texte", valeur: (s) => (s.type === "intra" ? "Intra" : "Inter") },
          {
            cle: "client",
            titre: "Client",
            type: "texte",
            valeur: (s) => nomsClientsSession(s),
            affiche: (s) =>
              s.type === "intra"
                ? esc(nomsClientsSession(s))
                : `${s.inscriptions.length} clients<span class="cellule-sous">${esc(nomsClientsSession(s))}</span>`,
          },
          { cle: "lieu", titre: "Lieu", type: "texte", valeur: (s) => s.lieu },
          {
            cle: "stagiaires",
            titre: "Stagiaires",
            type: "nombre",
            valeur: nbStagiaires,
            affiche: (s) => `${nbStagiaires(s)}<span class="cellule-sous">sur ${s.capacite}</span>`,
            csv: (s) => String(nbStagiaires(s)),
          },
          { cle: "remplissage", titre: "Remplissage", type: "nombre", valeur: (s) => nbStagiaires(s) / s.capacite, csv: (s) => pct(nbStagiaires(s) / s.capacite), affiche: (s) => pct(nbStagiaires(s) / s.capacite) },
          { cle: "statut", titre: "Statut", type: "statut", valeur: (s) => statutSession(s).libelle, affiche: (s) => badge(statutSession(s)) },
        ],
      })
    }
    majTableau("sessions")
  }

  function rendreCalendrier() {
    const [a, m] = calendrier.mois.split("-").map(Number)
    const premier = new Date(a, m - 1, 1)
    const nbJours = new Date(a, m, 0).getDate()
    const decalageLundi = (premier.getDay() + 6) % 7 // lundi = 0

    // Sessions par jour (les sessions de 2 jours marquent les deux jours)
    const parJour = {}
    db.sessions
      .filter((s) => s.statut !== "annulee")
      .forEach((s) => {
        for (let d = s.dateDebut; d <= s.dateFin; d = ajouterJours(d, 1)) (parJour[d] ||= []).push(s)
      })

    const prefixe = calendrier.mois
    const joursAvecSession = Object.keys(parJour).filter((d) => d.startsWith(prefixe)).sort()
    if (!calendrier.jour || !calendrier.jour.startsWith(prefixe) || !parJour[calendrier.jour]) {
      calendrier.jour = joursAvecSession.find((d) => d >= AUJ) || joursAvecSession.at(-1) || null
    }

    const cellules = []
    for (let i = 0; i < decalageLundi; i++) cellules.push(`<td></td>`)
    for (let j = 1; j <= nbJours; j++) {
      const iso = `${prefixe}-${String(j).padStart(2, "0")}`
      const sessions = parJour[iso] || []
      const classes = ["cal__jour", iso < AUJ ? "cal__jour--passe" : "", iso === AUJ ? "cal__jour--auj" : ""].join(" ")
      const auj = iso === AUJ ? ' aria-current="date"' : ""
      if (sessions.length) {
        const libelle = `${fmtJourLong.format(versDate(iso))} : ${sessions.map((s) => nomFormation(s.formationId)).join(", ")}`
        const points = sessions.map((s) => `<i class="${s.dateFin < AUJ ? "est-passe" : ""}"></i>`).join("")
        cellules.push(`<td><button type="button" class="${classes}" data-jour="${iso}" aria-pressed="${iso === calendrier.jour}" aria-label="${esc(libelle)}"${auj}>${j}<span class="cal__points" aria-hidden="true">${points}</span></button></td>`)
      } else {
        cellules.push(`<td><span class="${classes}"${auj}>${j}</span></td>`)
      }
    }
    while (cellules.length % 7) cellules.push(`<td></td>`)
    const semaines = []
    for (let i = 0; i < cellules.length; i += 7) semaines.push(`<tr>${cellules.slice(i, i + 7).join("")}</tr>`)

    const libelleMois = majuscule(fmtMoisAnnee.format(premier))
    const { min, max } = bornesDonnees()
    const moisPrec = versIso(new Date(a, m - 2, 1)).slice(0, 7)
    const moisSuiv = versIso(new Date(a, m, 1)).slice(0, 7)

    zone(
      "calendrier",
      `<div class="cal__head">
        <button type="button" class="icon-btn" data-cal="${moisPrec}" aria-label="Mois précédent" ${moisPrec < min.slice(0, 7) ? "disabled" : ""}>${icone.gauche}</button>
        <p class="cal__mois" aria-live="polite">${esc(libelleMois)}</p>
        <button type="button" class="icon-btn" data-cal="${moisSuiv}" aria-label="Mois suivant" ${moisSuiv > max.slice(0, 7) ? "disabled" : ""}>${icone.droite}</button>
      </div>
      <table class="cal__grille" aria-labelledby="titre-calendrier">
        <caption class="sr-only">${esc(libelleMois)}. Les jours avec une session sont des boutons.</caption>
        <thead><tr>${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((j, i) => `<th scope="col"><abbr title="${["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][i]}">${j}</abbr></th>`).join("")}</tr></thead>
        <tbody>${semaines.join("")}</tbody>
      </table>
      <p class="cal__legende"><span><i></i> Session à venir</span><span><i class="est-passe"></i> Session passée</span></p>`
    )

    // Détail du jour sélectionné
    const titre = document.querySelector("[data-titre-jour]")
    const duJour = calendrier.jour ? parJour[calendrier.jour] : []
    titre.textContent = calendrier.jour ? majuscule(fmtJourLong.format(versDate(calendrier.jour))) : "Aucune session ce mois-ci"
    zone(
      "sessions-jour",
      duJour?.length
        ? `<ul class="liste">${duJour
            .map(
              (s) => `<li class="liste__item">
                <span class="liste__date" aria-hidden="true"><strong>${nbStagiaires(s)}</strong><span>stag.</span></span>
                <span>
                  <span class="liste__titre">${esc(s.libelle || nomFormation(s.formationId))} · ${s.type === "intra" ? "Intra" : "Inter"}</span>
                  <span class="liste__meta">${esc(nomsClientsSession(s))}<br>${esc(s.lieu)} · ${nbStagiaires(s)} stagiaires sur ${s.capacite} places · ${s.dateFin !== s.dateDebut ? `du ${dateFr(s.dateDebut)} au ${dateFr(s.dateFin)}` : dateFr(s.dateDebut)}</span>
                </span>
                ${badge(statutSession(s))}
              </li>`
            )
            .join("")}</ul>`
        : `<p class="liste__vide">Sélectionnez un jour marqué d'un point dans le calendrier.</p>`
    )
  }

  /* ---------- 6.3 Clients ---------- */
  function rendreClients(p) {
    const lignes = db.clients.map((c) => {
      const factures = db.factures.filter((f) => f.clientId === c.id)
      const sessions = db.sessions.filter((s) => estRealisee(s) && s.inscriptions.some((i) => i.clientId === c.id)).sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
      return {
        ...c,
        caCumule: arrondi(somme(factures.filter((f) => f.datePaiement), (f) => f.montantHT)),
        caPeriode: arrondi(somme(factures.filter((f) => f.datePaiement && dansPeriode(f.datePaiement, p)), (f) => f.montantHT)),
        du: arrondi(somme(factures.filter((f) => !f.datePaiement), (f) => f.montantHT)),
        nbSessions: sessions.length,
        derniere: sessions[0] || null,
      }
    })
    db.lignesClients = lignes

    const actifs = lignes.filter((l) => l.caPeriode > 0)
    const top = [...lignes].sort((a, b) => b.caCumule - a.caCumule)[0]
    const parType = Object.keys(LIBELLES_TYPE_CLIENT)
      .map((t) => `${lignes.filter((l) => l.type === t).length} ${LIBELLES_TYPE_CLIENT[t].toLowerCase()}${lignes.filter((l) => l.type === t).length > 1 ? "s" : ""}`)
      .join(", ")

    zone(
      "kpi-clients",
      kpi({ label: "Clients", valeur: `${lignes.length}`, detail: parType + "." }) +
        kpi({ label: "Clients facturés sur la période", valeur: `${actifs.length}`, detail: "ayant réglé au moins une facture sur la période." }) +
        kpi({ label: "Premier client (cumul)", valeur: `<span style="font-size:1.15rem">${esc(top.nom)}</span>`, detail: `${euro(top.caCumule)} HT encaissés.` }) +
        kpi({
          label: "Hors Tarentaise",
          valeur: pct(lignes.filter((l) => !l.tarentaise).length / lignes.length),
          detail: "des clients, avec indemnités kilométriques facturées en intra.",
        })
    )

    if (!tableaux.clients) {
      creerTableau("clients", {
        legende: "Portefeuille clients",
        triDefaut: { cle: "caCumule", sens: "desc" },
        filtres: [
          {
            cle: "type",
            type: "select",
            libelle: "Type",
            defaut: "tous",
            choix: [{ valeur: "tous", libelle: "Tous" }, ...Object.entries(LIBELLES_TYPE_CLIENT).map(([v, l]) => ({ valeur: v, libelle: l }))],
          },
        ],
        lignes: (f) => db.lignesClients.filter((c) => f.type === "tous" || c.type === f.type),
        colonnes: [
          { cle: "nom", titre: "Client", type: "texte", valeur: (c) => c.nom, affiche: (c) => `<strong>${esc(c.nom)}</strong><span class="cellule-sous">${esc(c.ville)}</span>` },
          { cle: "type", titre: "Type", type: "texte", valeur: (c) => LIBELLES_TYPE_CLIENT[c.type] },
          { cle: "departement", titre: "Département", type: "texte", valeur: (c) => c.departement, affiche: (c) => `${esc(c.departement)}${c.tarentaise ? `<span class="cellule-sous">Tarentaise</span>` : ""}`, csv: (c) => c.departement },
          { cle: "nbSessions", titre: "Sessions", type: "nombre", valeur: (c) => c.nbSessions },
          { cle: "caCumule", titre: "CA cumulé HT", type: "montant", valeur: (c) => c.caCumule },
          { cle: "caPeriode", titre: "CA période HT", type: "montant", valeur: (c) => c.caPeriode },
          { cle: "du", titre: "Reste dû HT", type: "montant", valeur: (c) => c.du },
          {
            cle: "derniere",
            titre: "Dernière session",
            type: "date",
            valeur: (c) => c.derniere?.dateDebut ?? null,
            affiche: (c) => (c.derniere ? `${dateFr(c.derniere.dateDebut)}<span class="cellule-sous">${esc(nomFormation(c.derniere.formationId))}</span>` : "Aucune"),
            csv: (c) => (c.derniere ? `${dateFr(c.derniere.dateDebut)} (${nomFormation(c.derniere.formationId)})` : ""),
          },
        ],
      })
    }
    majTableau("clients")
  }

  /* ---------- 6.4 Facturation ---------- */
  function rendreFacturation(p) {
    const facturesP = db.factures.filter((f) => dansPeriode(f.dateEmission, p))
    const payeesP = db.factures.filter((f) => f.datePaiement && dansPeriode(f.datePaiement, p))
    const delai = delaiMoyen(payeesP)
    const delai12 = delaiMoyen(db.factures.filter((f) => f.datePaiement && f.datePaiement > ajouterMois(AUJ, -12)))
    const impayees = db.factures.filter((f) => !f.datePaiement)
    const retards = impayees.filter((f) => statutFacture(f).code === "retard")
    const devisP = db.devis.filter((d) => dansPeriode(d.dateEmission, p))
    const taux = tauxTransformation(devisP)

    zone(
      "kpi-facturation",
      kpi({ label: "Facturé sur la période", valeur: euroRond(somme(facturesP, (f) => f.montantHT)), detail: `${facturesP.length} facture${facturesP.length > 1 ? "s" : ""} émise${facturesP.length > 1 ? "s" : ""}, montants HT.` }) +
        kpi({
          label: "Délai moyen de paiement",
          valeur: delai === null ? "—" : `${Math.round(delai)} <small>jours</small>`,
          detail: `${delai === null ? "Aucun encaissement sur la période." : `Sur ${payeesP.length} paiement${payeesP.length > 1 ? "s" : ""} reçu${payeesP.length > 1 ? "s" : ""} sur la période.`}${delai12 === null ? "" : ` ${Math.round(delai12)} jours sur 12 mois.`}`,
        }) +
        kpi({
          label: "Reste à encaisser",
          valeur: euroRond(somme(impayees, (f) => f.montantHT)),
          detail: `${impayees.length} facture${impayees.length > 1 ? "s" : ""}, dont <strong>${retards.length} en retard (${euro(somme(retards, (f) => f.montantHT))})</strong>.`,
          classe: retards.length ? "kpi--alerte" : "",
        }) +
        kpi({
          label: "Devis transformés",
          valeur: taux === null ? "—" : pct(taux),
          detail: `${devisP.length} devis émis sur la période${taux === null ? ", aucun encore tranché" : ""}. Calcul sur les devis acceptés, refusés ou expirés.`,
        })
    )

    document.querySelector("[data-mention-tva]").textContent = CFG.tvaApplicable
      ? "Montants hors taxes. TVA applicable selon config.js."
      : "Montants hors taxes. Franchise en base de TVA : les factures portent la mention « TVA non applicable, art. 293 B du CGI » (hypothèse, à confirmer)."

    if (!tableaux.factures) {
      creerTableau("factures", {
        legende: "Factures",
        triDefaut: { cle: "emission", sens: "desc" },
        filtres: [
          { cle: "periode", type: "case", libelle: "Émises sur la période", defaut: true },
          {
            cle: "statut",
            type: "select",
            libelle: "Statut",
            defaut: "tous",
            choix: [
              { valeur: "tous", libelle: "Tous" },
              { valeur: "payee", libelle: "Payées" },
              { valeur: "attente", libelle: "En attente" },
              { valeur: "retard", libelle: "En retard" },
            ],
          },
        ],
        vide: "Aucune facture pour ces critères. Décochez « Émises sur la période » pour tout afficher.",
        lignes: (f) => db.factures.filter((x) => (!f.periode || dansPeriode(x.dateEmission, periode())) && (f.statut === "tous" || statutFacture(x).code === f.statut)),
        colonnes: [
          { cle: "numero", titre: "Numéro", type: "texte", valeur: (f) => f.numero, affiche: (f) => `<strong>${esc(f.numero)}</strong>` },
          { cle: "client", titre: "Client", type: "texte", valeur: (f) => db.client[f.clientId].nom, affiche: (f) => `${esc(db.client[f.clientId].nom)}<span class="cellule-sous">${esc(f.lignes[0].libelle)}</span>` },
          { cle: "montant", titre: "Montant HT", type: "montant", valeur: (f) => f.montantHT },
          { cle: "emission", titre: "Émission", type: "date", valeur: (f) => f.dateEmission },
          { cle: "echeance", titre: "Échéance", type: "date", valeur: (f) => f.dateEcheance },
          { cle: "paiement", titre: "Paiement", type: "date", valeur: (f) => f.datePaiement, affiche: (f) => (f.datePaiement ? dateFr(f.datePaiement) : "Non payée") },
          {
            cle: "statut",
            titre: "Statut",
            type: "statut",
            valeur: (f) => statutFacture(f).libelle,
            affiche: (f) => {
              const s = statutFacture(f)
              const retard = s.code === "retard" ? `<span class="cellule-sous">depuis ${ecartJours(f.dateEcheance, AUJ)} j</span>` : ""
              return badge(s) + retard
            },
          },
        ],
      })
      creerTableau("devis", {
        legende: "Devis",
        triDefaut: { cle: "emission", sens: "desc" },
        filtres: [
          { cle: "periode", type: "case", libelle: "Émis sur la période", defaut: true },
          {
            cle: "statut",
            type: "select",
            libelle: "Statut",
            defaut: "tous",
            choix: [
              { valeur: "tous", libelle: "Tous" },
              { valeur: "attente", libelle: "En attente" },
              { valeur: "accepte", libelle: "Acceptés" },
              { valeur: "refuse", libelle: "Refusés" },
              { valeur: "expire", libelle: "Expirés" },
            ],
          },
        ],
        vide: "Aucun devis pour ces critères. Décochez « Émis sur la période » pour tout afficher.",
        lignes: (f) => db.devis.filter((d) => (!f.periode || dansPeriode(d.dateEmission, periode())) && (f.statut === "tous" || statutDevis(d).code === f.statut)),
        colonnes: [
          { cle: "numero", titre: "Numéro", type: "texte", valeur: (d) => d.numero, affiche: (d) => `<strong>${esc(d.numero)}</strong>` },
          { cle: "client", titre: "Client", type: "texte", valeur: (d) => db.client[d.clientId].nom },
          { cle: "objet", titre: "Objet", type: "texte", valeur: (d) => d.objet },
          { cle: "montant", titre: "Montant HT", type: "montant", valeur: (d) => d.montantHT },
          { cle: "emission", titre: "Émission", type: "date", valeur: (d) => d.dateEmission },
          { cle: "validite", titre: "Validité", type: "date", valeur: (d) => d.dateValidite },
          { cle: "statut", titre: "Statut", type: "statut", valeur: (d) => statutDevis(d).libelle, affiche: (d) => badge(statutDevis(d)) },
        ],
      })
    }
    majTableau("factures")
    majTableau("devis")
  }

  /* ---------- 6.5 Finances ---------- */
  function rendreFinances(p) {
    const caP = caEncaisse(p.d, p.f)
    const cotis = cotisations(caP)
    const chargesP = chargesEntre(p.d, p.f)
    const totalCharges = somme(chargesP, (c) => c.montant)
    const lignes = lignesEncaissees(p)
    const formation = lignes.filter((l) => l.formationId !== "deplacement")
    const caFormation = somme(formation, (l) => l.montant)

    zone(
      "kpi-finances",
      kpi({ label: "CA encaissé HT", valeur: euroRond(caP), detail: `dont ${euro(caP - caFormation)} d'indemnités kilométriques.` }) +
        kpi({ label: "Cotisations estimées", valeur: euroRond(cotis), detail: `${fmtPctPrecis.format(CFG.tauxCotisations)} du CA encaissé.` }) +
        kpi({ label: "Charges", valeur: euroRond(totalCharges), detail: `${chargesP.length} dépense${chargesP.length > 1 ? "s" : ""} sur la période.` }) +
        kpi({ label: "Bénéfice estimé", valeur: euroRond(caP - cotis - totalCharges), detail: "CA − cotisations − charges, avant impôt sur le revenu.", classe: "kpi--accent" })
    )

    // CA par formation (barres horizontales, une couleur : l'étiquette porte l'information)
    const parFormation = db.formations
      .map((f) => ({ nom: f.nom, ca: somme(formation.filter((l) => l.formationId === f.id), (l) => l.montant) }))
      .sort((a, b) => b.ca - a.ca)
    graphique(
      "ca-formation",
      {
        type: "bar",
        data: { labels: parFormation.map((f) => f.nom), datasets: [{ label: "CA encaissé HT", data: parFormation.map((f) => f.ca), backgroundColor: COULEURS.nuit, borderRadius: 4, maxBarThickness: 26 }] },
        options: { indexAxis: "y", scales: { x: axeEuro(), y: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${euro(c.parsed.x)}` } } } },
      },
      `CA encaissé par formation sur la période. ${parFormation.filter((f) => f.ca).map((f) => `${f.nom} : ${euroRond(f.ca)}`).join(", ") || "Aucun encaissement."}`,
      { entetes: ["Formation", "CA encaissé HT", "Part"], lignes: parFormation.map((f) => [f.nom, euro(f.ca), caFormation ? pct(f.ca / caFormation) : "—"]) }
    )

    // Intra / inter
    const intra = somme(formation.filter((l) => l.type === "intra"), (l) => l.montant)
    const inter = somme(formation.filter((l) => l.type === "inter"), (l) => l.montant)
    const partIntra = caFormation ? intra / caFormation : 0
    graphique(
      "intra-inter",
      {
        type: "doughnut",
        data: {
          labels: [`Intra (${pct(partIntra)})`, `Inter (${pct(caFormation ? 1 - partIntra : 0)})`],
          datasets: [{ data: [intra, inter], backgroundColor: [COULEURS.nuit, COULEURS.rouge], borderColor: "#FFFFFF", borderWidth: 3 }],
        },
        options: { cutout: "62%", plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.label} : ${euro(c.parsed)}` } } } },
      },
      `Répartition du CA de formation sur la période : intra ${euroRond(intra)} (${pct(partIntra)}), inter ${euroRond(inter)} (${pct(caFormation ? 1 - partIntra : 0)}).`,
      { entetes: ["Type", "CA encaissé HT", "Part"], lignes: [["Intra", euro(intra), pct(partIntra)], ["Inter", euro(inter), pct(caFormation ? 1 - partIntra : 0)]] }
    )

    // Par département (y compris les indemnités kilométriques)
    const parDep = DEPARTEMENTS.map((d) => ({ ...d, ca: somme(lignes.filter((l) => l.departement === d.code), (l) => l.montant) }))
    graphique(
      "ca-departement",
      {
        type: "bar",
        data: { labels: parDep.map((d) => `${d.nom} (${d.code})`), datasets: [{ label: "CA encaissé HT", data: parDep.map((d) => d.ca), backgroundColor: COULEURS.nuit, borderRadius: 4, maxBarThickness: 48 }] },
        options: { scales: { y: axeEuro(), x: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${euro(c.parsed.y)}` } } } },
      },
      `CA encaissé par département sur la période : ${parDep.map((d) => `${d.nom} ${euroRond(d.ca)}`).join(", ")}.`,
      { entetes: ["Département", "CA encaissé HT", "Part"], lignes: parDep.map((d) => [`${d.nom} (${d.code})`, euro(d.ca), caP ? pct(d.ca / caP) : "—"]) }
    )

    // Charges par catégorie
    const categories = [...new Set(db.charges.map((c) => c.categorie))]
      .map((cat) => ({ cat, montant: somme(chargesP.filter((c) => c.categorie === cat), (c) => c.montant) }))
      .sort((a, b) => b.montant - a.montant)
    graphique(
      "charges",
      {
        type: "bar",
        data: { labels: categories.map((c) => c.cat), datasets: [{ label: "Charges", data: categories.map((c) => c.montant), backgroundColor: COULEURS.rouge, borderRadius: 4, maxBarThickness: 26 }] },
        options: { indexAxis: "y", scales: { x: axeEuro(), y: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${euro(c.parsed.x)}` } } } },
      },
      `Charges de la période par catégorie, total ${euroRond(totalCharges)}. ${categories.filter((c) => c.montant).map((c) => `${c.cat} ${euroRond(c.montant)}`).join(", ")}.`,
      { entetes: ["Catégorie", "Montant", "Part"], lignes: categories.map((c) => [c.cat, euro(c.montant), totalCharges ? pct(c.montant / totalCharges) : "—"]) }
    )

    // Frais de déplacement
    const realisees = db.sessions.filter((s) => estRealisee(s) && dansPeriode(s.dateDebut, p))
    const km = somme(realisees, (s) => s.distanceKm * 2)
    const kmHors = somme(realisees.filter((s) => s.deplacementFacture), (s) => s.distanceKm * 2)
    const indemnites = somme(
      db.factures.filter((f) => dansPeriode(f.dateEmission, p)).flatMap((f) => f.lignes.filter((l) => l.formationId === "deplacement")),
      (l) => l.quantite * l.prixUnitaireHT
    )
    const carburant = somme(chargesP.filter((c) => c.categorie === "Déplacements"), (c) => c.montant)
    const aVenir = db.sessions.filter((s) => s.dateDebut > AUJ && s.statut !== "annulee" && s.deplacementFacture)
    const estimation = somme(aVenir, (s) => s.distanceKm * 2 * CFG.tauxKm)

    zone(
      "deplacements",
      `<div class="chiffres">
        <div class="chiffre"><p class="chiffre__valeur">${nombre(km)} km</p><p class="chiffre__label">parcourus pour les sessions réalisées (aller-retour depuis Séez), dont ${nombre(kmHors)} km hors Tarentaise.</p></div>
        <div class="chiffre"><p class="chiffre__valeur">${euroRond(indemnites)}</p><p class="chiffre__label">d'indemnités kilométriques facturées sur la période (HT).</p></div>
        <div class="chiffre"><p class="chiffre__valeur">${euroRond(carburant)}</p><p class="chiffre__label">de frais de déplacement réels (carburant, péages, entretien).</p></div>
        <div class="chiffre"><p class="chiffre__valeur">${euroRond(estimation)}</p><p class="chiffre__label">d'indemnités à facturer sur les ${aVenir.length} session${aVenir.length > 1 ? "s" : ""} intra à venir hors Tarentaise, à ${fmtDecimal.format(CFG.tauxKm)} €/km.</p></div>
      </div>`
    )

    const libelleMontant = CFG.tvaApplicable ? "Montant HT" : "Montant payé"
    if (!tableaux.charges) {
      creerTableau("charges", {
        legende: "Détail des charges",
        triDefaut: { cle: "date", sens: "desc" },
        filtres: [{ cle: "periode", type: "case", libelle: "Période sélectionnée uniquement", defaut: true }],
        vide: "Aucune charge sur la période.",
        lignes: (f) => db.charges.filter((c) => !f.periode || dansPeriode(c.date, periode())),
        colonnes: [
          { cle: "date", titre: "Date", type: "date", valeur: (c) => c.date },
          { cle: "categorie", titre: "Catégorie", type: "texte", valeur: (c) => c.categorie },
          { cle: "libelle", titre: "Libellé", type: "texte", valeur: (c) => c.libelle },
          { cle: "montant", titre: libelleMontant, type: "montant", valeur: (c) => c.montant },
        ],
      })
    }
    majTableau("charges")
  }

  /* ---------- 6.6 Certifications ---------- */
  function urgence(c) {
    if (c.joursRestants <= 30) return { libelle: `Urgent, ${c.joursRestants} j`, classe: "red" }
    if (c.joursRestants <= 60) return { libelle: `Dans ${c.joursRestants} j`, classe: "yellow" }
    return { libelle: `Dans ${c.joursRestants} j`, classe: "blue" }
  }

  function rendreCertifications() {
    const liste = certificationsARenouveler()
    db.lignesCertifs = liste

    // CA potentiel : une MAC intra dès 4 stagiaires chez le même client, sinon des places en inter
    const parClient = {}
    liste.forEach((c) => (parClient[c.clientId] = (parClient[c.clientId] || 0) + 1))
    const mac = db.formation.mac
    const potentiel = somme(Object.values(parClient), (n) => (n >= 4 ? mac.prixIntra : n * mac.prixInter))
    const relances = liste.filter((c) => c.dateRelance).length

    zone(
      "kpi-certifications",
      kpi({ label: "À renouveler", valeur: `${liste.length}`, detail: `certificats expirant dans les ${CFG.alerteCertificationsJours} prochains jours.` }) +
        kpi({ label: "Urgents", valeur: `${liste.filter((c) => c.joursRestants <= 30).length}`, detail: "expirent dans moins de 30 jours.", classe: liste.some((c) => c.joursRestants <= 30) ? "kpi--alerte" : "" }) +
        kpi({ label: "Entreprises concernées", valeur: `${Object.keys(parClient).length}`, detail: `${relances} relance${relances > 1 ? "s" : ""} envoyée${relances > 1 ? "s" : ""} (simulées).` }) +
        kpi({ label: "CA potentiel de recyclage", valeur: euroRond(potentiel), detail: `MAC SST : ${euroRond(mac.prixInter)} par stagiaire en inter, ${euroRond(mac.prixIntra)} en intra à partir de 4 stagiaires.`, classe: "kpi--accent" })
    )

    if (!tableaux.certifications) {
      creerTableau("certifications", {
        legende: "Stagiaires à recycler",
        triDefaut: { cle: "expiration", sens: "asc" },
        vide: "Aucun certificat n'expire dans la fenêtre d'alerte.",
        lignes: () => db.lignesCertifs,
        surClic: async (e) => {
          const bouton = e.target.closest("[data-relancer]")
          if (!bouton) return
          bouton.disabled = true
          const reponse = await API.relancerCertification(bouton.dataset.relancer)
          const cert = db.certifications.find((c) => c.id === reponse.id)
          cert.dateRelance = reponse.dateRelance
          rendreCertifications()
          const ligne = db.lignesCertifs.find((c) => c.id === reponse.id)
          notifier(`Relance simulée pour ${ligne.stagiaire} (${db.client[ligne.clientId].nom}). Aucun e-mail n'a été envoyé.`)
          // Le bouton est remplacé : on replace le focus sur la ligne pour ne pas perdre le clavier
          document.querySelector(`[data-ligne-certif="${reponse.id}"]`)?.focus()
        },
        colonnes: [
          { cle: "stagiaire", titre: "Stagiaire", type: "texte", valeur: (c) => c.stagiaire, affiche: (c) => `<strong>${esc(c.stagiaire)}</strong>` },
          { cle: "client", titre: "Entreprise", type: "texte", valeur: (c) => db.client[c.clientId].nom },
          { cle: "formation", titre: "Dernière formation", type: "texte", valeur: (c) => nomFormation(c.formationId) },
          { cle: "dateFormation", titre: "Suivie le", type: "date", valeur: (c) => c.dateFormation },
          { cle: "expiration", titre: "Expire le", type: "date", valeur: (c) => c.expiration },
          { cle: "jours", titre: "Délai", type: "statut", valeur: (c) => c.joursRestants, csv: (c) => `${c.joursRestants} jours`, affiche: (c) => badge(urgence(c)) },
          {
            cle: "relance",
            titre: "Relance",
            type: "texte",
            triable: false,
            valeur: (c) => c.dateRelance,
            csv: (c) => (c.dateRelance ? `Relancé le ${dateFr(c.dateRelance)}` : "Non relancé"),
            affiche: (c) =>
              c.dateRelance
                ? `<span class="badge badge--green" tabindex="-1" data-ligne-certif="${c.id}">Relancé le ${dateFr(c.dateRelance)}</span>`
                : `<button type="button" class="btn btn--primary btn--sm" data-relancer="${c.id}" aria-label="Relancer ${esc(c.stagiaire)}, ${esc(db.client[c.clientId].nom)}">Relancer</button>`,
          },
        ],
      })
    }
    majTableau("certifications")
  }

  /* ============================================================
     7. NAVIGATION ET DÉMARRAGE
     ============================================================ */

  const RENDUS = {
    "vue-ensemble": rendreVueEnsemble,
    sessions: rendreSessions,
    clients: rendreClients,
    facturation: rendreFacturation,
    finances: rendreFinances,
    certifications: rendreCertifications,
  }
  const aJour = new Set() // vues déjà rendues pour la période courante

  /** Rend une vue (les vues masquées sont rendues à leur ouverture : Chart.js a besoin d'une taille visible) */
  function rendreVue(id) {
    RENDUS[id](periode())
    aJour.add(id)
  }

  function majPeriode() {
    const p = periode()
    document.querySelector("[data-periode-libelle]").textContent = p.libelle
    const { min, max } = bornesDonnees()
    document.querySelector('[data-action="periode-precedente"]').disabled = calculerPeriode(etat.type, etat.decalage - 1).f < min
    document.querySelector('[data-action="periode-suivante"]').disabled = calculerPeriode(etat.type, etat.decalage + 1).d > max

    document.querySelectorAll("[data-sous-titre]").forEach((el) => {
      el.textContent =
        el.dataset.sousTitre === "certifications"
          ? `Validité du certificat SST : 24 mois. Alerte ${CFG.alerteCertificationsJours} jours avant l'expiration.`
          : `${p.libelle}${p.enCours ? ", période en cours" : ""}. Montants hors taxes, CA compté à l'encaissement.`
    })

    // Le calendrier suit la période choisie
    calendrier.mois = p.reference.slice(0, 7)
    calendrier.jour = null

    aJour.clear()
    rendreVue(etat.vue)
  }

  function afficherVue(id, { focus = true } = {}) {
    if (!RENDUS[id]) id = "vue-ensemble"
    etat.vue = id
    document.querySelectorAll(".vue").forEach((v) => (v.hidden = v.id !== id))
    document.querySelectorAll(".menu__link").forEach((a) => {
      if (a.dataset.vue === id) a.setAttribute("aria-current", "page")
      else a.removeAttribute("aria-current")
    })
    const titre = document.querySelector(`#${id} .vue__titre`)
    document.title = `${titre.textContent} · Tableau de bord Yo'Secours (maquette)`
    if (!aJour.has(id)) rendreVue(id)
    fermerMenu({ rendreFocus: false })
    if (focus) {
      window.scrollTo({ top: 0 })
      titre.focus({ preventScroll: true })
    }
  }

  /* ---------- Menu mobile ---------- */
  const burger = () => document.querySelector(".burger")

  function ouvrirMenu() {
    document.querySelector(".sidebar").classList.add("est-ouvert")
    document.querySelector(".sidebar__voile").hidden = false
    burger().setAttribute("aria-expanded", "true")
    document.querySelector(".menu__link[aria-current]")?.focus()
  }

  function fermerMenu({ rendreFocus = true } = {}) {
    const sidebar = document.querySelector(".sidebar")
    if (!sidebar.classList.contains("est-ouvert")) return
    sidebar.classList.remove("est-ouvert")
    document.querySelector(".sidebar__voile").hidden = true
    burger().setAttribute("aria-expanded", "false")
    if (rendreFocus) burger().focus()
  }

  /* ---------- Onglets accessibles (flèches, Début, Fin) ---------- */
  function initOnglets() {
    const onglets = [...document.querySelectorAll('[role="tab"]')]
    const activer = (onglet) => {
      onglets.forEach((o) => {
        const actif = o === onglet
        o.setAttribute("aria-selected", String(actif))
        o.tabIndex = actif ? 0 : -1
        document.getElementById(o.getAttribute("aria-controls")).hidden = !actif
      })
    }
    onglets.forEach((o, i) => {
      o.addEventListener("click", () => activer(o))
      o.addEventListener("keydown", (e) => {
        const cible = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: onglets.length - 1 }[e.key]
        if (cible === undefined) return
        e.preventDefault()
        const suivant = onglets[(cible + onglets.length) % onglets.length]
        activer(suivant)
        suivant.focus()
      })
    })
    return activer
  }

  /* ---------- Raccourcis depuis la vue d'ensemble ---------- */
  function appliquerRaccourci(nom, activerOnglet) {
    if (!aJour.has("facturation")) rendreVue("facturation")
    const cible = nom === "devis" ? "devis" : "factures"
    activerOnglet(document.getElementById(`onglet-${cible}`))
    const hote = document.querySelector(`[data-tableau="${cible}"]`)
    const t = tableaux[cible]
    // Les retards peuvent dater d'avant la période : on lève le filtre de période,
    // et on vide une éventuelle recherche qui masquerait des lignes
    t.filtres.periode = false
    t.recherche = ""
    hote.querySelector("input[type=search]").value = ""
    t.filtres.statut = nom === "retards" ? "retard" : "attente"
    hote.querySelector('[data-filtre="periode"]').checked = false
    hote.querySelector('[data-filtre="statut"]').value = t.filtres.statut
    majTableau(cible)
  }

  function mesurerBandeau() {
    const bandeau = document.querySelector(".bandeau-maquette")
    const appliquer = () => document.documentElement.style.setProperty("--bandeau-h", `${bandeau.offsetHeight}px`)
    appliquer()
    new ResizeObserver(appliquer).observe(bandeau)
  }

  async function demarrer() {
    mesurerBandeau()
    configurerChartJs()
    await chargerDonnees()

    document.querySelector("[data-date-jour]").textContent = `Données au ${fmtJourLong.format(versDate(AUJ))}`

    // Compteurs du menu
    const retards = db.factures.filter((f) => statutFacture(f).code === "retard").length
    const certifs = certificationsARenouveler().length
    const compteur = (nom, n, libelle) => {
      const el = document.querySelector(`[data-compteur="${nom}"]`)
      el.hidden = !n
      el.textContent = n
      el.setAttribute("aria-label", `${n} ${libelle}`)
    }
    compteur("retards", retards, `facture${retards > 1 ? "s" : ""} en retard`)
    compteur("certifications", certifs, `certificat${certifs > 1 ? "s" : ""} à renouveler`)

    const activerOnglet = initOnglets()

    // Période
    document.querySelectorAll('input[name="periode"]').forEach((r) =>
      r.addEventListener("change", () => {
        etat.type = r.value
        etat.decalage = 0
        majPeriode()
      })
    )

    // Délégation d'événements pour tous les boutons d'action
    document.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action
      if (action === "periode-precedente") etat.decalage--, majPeriode()
      if (action === "periode-suivante") etat.decalage++, majPeriode()
      if (action === "ouvrir-menu") ouvrirMenu()
      if (action === "fermer-menu") fermerMenu()

      const mois = e.target.closest("[data-cal]")?.dataset.cal
      if (mois) {
        calendrier.mois = mois
        calendrier.jour = null
        rendreCalendrier()
        document.querySelector(`[data-cal="${mois}"]`)?.focus()
      }
      const jour = e.target.closest("[data-jour]")?.dataset.jour
      if (jour) {
        calendrier.jour = jour
        rendreCalendrier()
        document.querySelector(`[data-jour="${jour}"]`)?.focus()
      }
      const raccourci = e.target.closest("[data-raccourci]")?.dataset.raccourci
      if (raccourci) appliquerRaccourci(raccourci, activerOnglet)
    })

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fermerMenu()
    })

    // Navigation par ancres (#sessions...) : bouton « précédent » du navigateur compris
    window.addEventListener("hashchange", () => afficherVue(location.hash.slice(1)))

    majPeriode()
    afficherVue(location.hash.slice(1) || "vue-ensemble", { focus: false })
  }

  demarrer().catch((erreur) => {
    console.error("[Tableau de bord]", erreur)
    document.querySelector("#contenu").insertAdjacentHTML(
      "afterbegin",
      `<p class="carte" role="alert">Le tableau de bord n'a pas pu se charger. Détail technique dans la console.</p>`
    )
  })
})()
