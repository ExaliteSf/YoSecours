/* ============================================================
   YO'SECOURS · Tableau de bord · DONNÉES FICTIVES
   ------------------------------------------------------------
   Aucune donnée réelle : entreprises, collectivités, associations
   et stagiaires sont inventés.

   Ce fichier simule une future API. Chaque accès passe par une
   fonction asynchrone (getFactures(), getSessions()...) qui renvoie
   une promesse : le jour où une vraie API existe, il suffit de
   remplacer le corps de ces fonctions par un fetch(), sans toucher
   à app.js.

   Les dates sont exprimées par rapport au jour courant (fonction
   jour(n) : n jours avant ou après aujourd'hui). La maquette reste
   ainsi cohérente quel que soit le jour où on l'ouvre.

   Les données sont brutes, comme le serait une réponse d'API :
   les statuts calculés (facture en retard, devis expiré, session
   réalisée) sont déduits dans app.js.
   ============================================================ */

;(function () {
  "use strict"

  const CFG = window.YO_CONFIG || {}

  /* ---------- Dates ---------- */

  function aujourdhui() {
    if (CFG.dateDuJour) {
      const [a, m, j] = CFG.dateDuJour.split("-").map(Number)
      return new Date(a, m - 1, j)
    }
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  const AUJ = aujourdhui()

  function iso(date) {
    const p = (n) => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
  }

  /** Date ISO située n jours avant (n < 0) ou après (n > 0) aujourd'hui */
  function jour(n) {
    const d = new Date(AUJ)
    d.setDate(d.getDate() + n)
    return iso(d)
  }

  /** Date de formation telle que le certificat (24 mois) expire dans n jours */
  function formeExpirantDans(n) {
    const d = new Date(AUJ)
    d.setDate(d.getDate() + n)
    d.setMonth(d.getMonth() - 24)
    return iso(d)
  }

  /* ---------- Catalogue (tarifs HT du site yosecours.fr) ---------- */

  // prixInter : par stagiaire · prixIntra : forfait par session · null = sur devis
  const FORMATIONS = [
    { id: "sst", nom: "SST Initiale", heures: 14, jours: 2, prixInter: 220, prixIntra: 1500, capacite: 10, certifiante: true },
    { id: "mac", nom: "MAC SST", heures: 7, jours: 1, prixInter: 110, prixIntra: 750, capacite: 10, certifiante: true },
    { id: "dae", nom: "DAE", heures: 2, jours: 1, prixInter: 30, prixIntra: 280, capacite: 12, certifiante: false },
    { id: "extincteurs", nom: "Manipulation extincteurs", heures: 2, jours: 1, prixInter: 65, prixIntra: 550, capacite: 12, certifiante: false },
    { id: "evacuation", nom: "Évacuation guide-file / serre-file", heures: 2, jours: 1, prixInter: 65, prixIntra: 550, capacite: 15, certifiante: false },
    { id: "eauxvives", nom: "Secours eaux vives", heures: 14, jours: 2, prixInter: null, prixIntra: null, capacite: 8, certifiante: false },
    { id: "mesure", nom: "Formation sur mesure", heures: 7, jours: 1, prixInter: null, prixIntra: null, capacite: 12, certifiante: false },
  ]

  /* ---------- Clients (tous fictifs) ----------
     distanceKm : distance aller simple depuis Séez
     tarentaise : déplacement offert dans la vallée
     delaiPaiement : habitude de paiement en jours (simulation) */
  const CLIENTS = [
    { id: "c01", nom: "Hôtel Les Arolles", type: "entreprise", ville: "Bourg-Saint-Maurice", departement: "73", distanceKm: 6, tarentaise: true, delaiPaiement: 12 },
    { id: "c02", nom: "Glisse et Neige Altitude", type: "entreprise", ville: "Tignes", departement: "73", distanceKm: 31, tarentaise: true, delaiPaiement: 20 },
    { id: "c03", nom: "SIVOM des Cimes Blanches", type: "collectivite", ville: "Aime-la-Plagne", departement: "73", distanceKm: 21, tarentaise: true, delaiPaiement: 45 },
    { id: "c04", nom: "Association Montagne et Partage", type: "association", ville: "Moûtiers", departement: "73", distanceKm: 46, tarentaise: true, delaiPaiement: 25 },
    { id: "c05", nom: "Rafting Isère Aventure", type: "entreprise", ville: "Landry", departement: "73", distanceKm: 14, tarentaise: true, delaiPaiement: 15 },
    { id: "c06", nom: "École de ski Les Mélèzes", type: "entreprise", ville: "Les Arcs", departement: "73", distanceKm: 17, tarentaise: true, delaiPaiement: 9 },
    { id: "c07", nom: "Boulangerie de la Roche Blanche", type: "entreprise", ville: "Aime-la-Plagne", departement: "73", distanceKm: 21, tarentaise: true, delaiPaiement: 35 },
    { id: "c08", nom: "Transports Alpins Express", type: "entreprise", ville: "Albertville", departement: "73", distanceKm: 74, tarentaise: false, delaiPaiement: 40 },
    { id: "c09", nom: "Résidence Les Edelweiss", type: "association", ville: "Chambéry", departement: "73", distanceKm: 125, tarentaise: false, delaiPaiement: 50 },
    { id: "c10", nom: "Menuiserie du Val d'Arly", type: "entreprise", ville: "Ugine", departement: "73", distanceKm: 82, tarentaise: false, delaiPaiement: 30 },
    { id: "c11", nom: "Logistique Mont-Blanc Services", type: "entreprise", ville: "Sallanches", departement: "74", distanceKm: 118, tarentaise: false, delaiPaiement: 22 },
    { id: "c12", nom: "Syndicat mixte des Lacs Alpins", type: "collectivite", ville: "Annecy", departement: "74", distanceKm: 148, tarentaise: false, delaiPaiement: 48 },
    { id: "c13", nom: "Laboratoires Belledonne", type: "entreprise", ville: "Grenoble", departement: "38", distanceKm: 182, tarentaise: false, delaiPaiement: 30 },
    { id: "c14", nom: "Vercors Verticale", type: "association", ville: "Villard-de-Lans", departement: "38", distanceKm: 215, tarentaise: false, delaiPaiement: 28 },
    { id: "c15", nom: "Hôtel du Col Blanc", type: "entreprise", ville: "Briançon", departement: "05", distanceKm: 132, tarentaise: false, delaiPaiement: 18 },
  ]

  /* ---------- Sessions (40) ----------
     j : premier jour de la session, relatif à aujourd'hui
     intra : client · inter : inscriptions [client, nombre de stagiaires]
     statut brut : "confirmee", "option" (non confirmée) ou "annulee"
     montantHT : uniquement pour les formations sur devis
     impayes : factures volontairement laissées impayées (simulation de retards) */
  const SESSIONS = [
    { id: "S01", j: -358, formation: "sst", type: "intra", client: "c02", stagiaires: 9 },
    { id: "S02", j: -351, formation: "mac", type: "intra", client: "c06", stagiaires: 10 },
    { id: "S03", j: -344, formation: "sst", type: "inter", lieu: "Séez", distanceKm: 0, inscriptions: [["c01", 3], ["c07", 2], ["c04", 2]] },
    { id: "S04", j: -337, formation: "dae", type: "intra", client: "c06", stagiaires: 8 },
    { id: "S05", j: -330, formation: "mac", type: "intra", client: "c01", stagiaires: 6 },
    { id: "S06", j: -316, formation: "extincteurs", type: "intra", client: "c08", stagiaires: 11 },
    { id: "S07", j: -309, formation: "sst", type: "intra", client: "c09", stagiaires: 10 },
    { id: "S08", j: -295, formation: "mac", type: "inter", lieu: "Séez", distanceKm: 0, inscriptions: [["c05", 3], ["c04", 4], ["c07", 1]] },
    { id: "S09", j: -281, formation: "evacuation", type: "intra", client: "c09", stagiaires: 14 },
    { id: "S10", j: -267, formation: "sst", type: "inter", lieu: "Bourg-Saint-Maurice", distanceKm: 6, inscriptions: [["c03", 4], ["c10", 3]] },
    { id: "S11", j: -253, formation: "dae", type: "inter", lieu: "Séez", distanceKm: 0, inscriptions: [["c01", 5], ["c07", 4], ["c04", 3]] },
    { id: "S12", j: -239, formation: "mac", type: "intra", client: "c11", stagiaires: 9 },
    { id: "S13", j: -225, formation: "sst", type: "intra", client: "c13", stagiaires: 10 },
    { id: "S14", j: -211, formation: "extincteurs", type: "intra", client: "c10", stagiaires: 9, statut: "annulee" },
    { id: "S15", j: -204, formation: "mac", type: "inter", lieu: "Séez", distanceKm: 0, inscriptions: [["c02", 4], ["c06", 3]] },
    { id: "S16", j: -190, formation: "eauxvives", type: "intra", client: "c05", stagiaires: 8, montantHT: 1800, libelle: "Secours eaux vives, 2 jours" },
    { id: "S17", j: -183, formation: "sst", type: "intra", client: "c03", stagiaires: 8 },
    { id: "S18", j: -169, formation: "mesure", type: "intra", client: "c14", stagiaires: 9, montantHT: 1200, libelle: "Secours en milieu vertical, sur mesure" },
    { id: "S19", j: -162, formation: "mac", type: "intra", client: "c12", stagiaires: 10 },
    { id: "S20", j: -148, formation: "sst", type: "inter", lieu: "Séez", distanceKm: 0, inscriptions: [["c07", 2], ["c04", 3], ["c01", 3]] },
    { id: "S21", j: -134, formation: "dae", type: "intra", client: "c12", stagiaires: 12 },
    { id: "S22", j: -120, formation: "evacuation", type: "intra", client: "c13", stagiaires: 15 },
    { id: "S23", j: -106, formation: "sst", type: "intra", client: "c15", stagiaires: 8, impayes: true },
    { id: "S24", j: -92, formation: "mac", type: "inter", lieu: "Bourg-Saint-Maurice", distanceKm: 6, inscriptions: [["c05", 4], ["c03", 3], ["c10", 2]] },
    { id: "S25", j: -78, formation: "extincteurs", type: "intra", client: "c01", stagiaires: 10 },
    { id: "S26", j: -64, formation: "sst", type: "intra", client: "c08", stagiaires: 9, impayes: true },
    { id: "S27", j: -50, formation: "mac", type: "intra", client: "c09", stagiaires: 10, impayes: true },
    { id: "S28", j: -36, formation: "dae", type: "inter", lieu: "Aime-la-Plagne", distanceKm: 21, inscriptions: [["c04", 6], ["c07", 3]], impayes: ["c07"] },
    { id: "S29", j: -29, formation: "sst", type: "intra", client: "c11", stagiaires: 10 },
    { id: "S30", j: -22, formation: "evacuation", type: "intra", client: "c01", stagiaires: 13 },
    { id: "S31", j: -15, formation: "mac", type: "inter", lieu: "Séez", distanceKm: 0, inscriptions: [["c02", 4], ["c06", 4], ["c01", 2]] },
    { id: "S32", j: -8, formation: "sst", type: "intra", client: "c06", stagiaires: 10 },
    { id: "S33", j: -3, formation: "dae", type: "intra", client: "c03", stagiaires: 10 },
    // Sessions à venir
    { id: "S34", j: 6, formation: "mac", type: "intra", client: "c02", stagiaires: 10 },
    { id: "S35", j: 13, formation: "sst", type: "inter", lieu: "Séez", distanceKm: 0, inscriptions: [["c07", 2], ["c04", 3]] },
    { id: "S36", j: 20, formation: "extincteurs", type: "intra", client: "c11", stagiaires: 12, statut: "option" },
    { id: "S37", j: 27, formation: "sst", type: "intra", client: "c13", stagiaires: 10 },
    { id: "S38", j: 34, formation: "mac", type: "intra", client: "c06", stagiaires: 9 },
    { id: "S39", j: 48, formation: "mesure", type: "intra", client: "c09", stagiaires: 12, statut: "option", montantHT: 950, libelle: "Gestes d'urgence en établissement de santé, sur mesure" },
    { id: "S40", j: 62, formation: "sst", type: "inter", lieu: "Bourg-Saint-Maurice", distanceKm: 6, inscriptions: [["c01", 4], ["c06", 3], ["c02", 2]] },
  ]

  /* ---------- Devis hors sessions (prospects, refus, expirations) ---------- */
  const DEVIS_LIBRES = [
    { j: -215, client: "c15", objet: "MAC SST, intra", montantHT: 750, km: 264, statut: "refuse" },
    { j: -140, client: "c10", objet: "MAC SST, intra", montantHT: 750, km: 164, statut: "refuse" },
    { j: -95, client: "c08", objet: "Manipulation extincteurs, intra", montantHT: 550, km: 148, statut: "en_attente" },
    { j: -62, client: "c04", objet: "Gestes d'urgence en refuge, sur mesure", montantHT: 650, km: 0, statut: "en_attente" },
    { j: -9, client: "c14", objet: "Secours eaux vives, 2 jours", montantHT: 2400, km: 430, statut: "en_attente" },
    { j: -5, client: "c12", objet: "Évacuation guide-file / serre-file, intra", montantHT: 550, km: 296, statut: "en_attente" },
    { j: -2, client: "c11", objet: "DAE, intra", montantHT: 280, km: 236, statut: "en_attente" },
  ]

  /* ---------- Certificats SST et MAC (validité 24 mois) ---------- */
  const CERTIFICATIONS_BRUTES = [
    ["Lucie M.", "c09", "sst", 4],
    ["Thomas B.", "c02", "mac", 9],
    ["Inès R.", "c08", "sst", 16],
    ["Mathieu G.", "c02", "sst", 16],
    ["Sarah L.", "c06", "mac", 23],
    ["Hugo P.", "c03", "sst", 31],
    ["Chloé D.", "c01", "mac", 38],
    ["Antoine F.", "c13", "sst", 44],
    ["Manon T.", "c04", "sst", 52],
    ["Julien C.", "c11", "mac", 59],
    ["Léa V.", "c12", "sst", 66],
    ["Nicolas H.", "c07", "sst", 73],
    ["Emma S.", "c05", "mac", 81],
    ["Baptiste A.", "c15", "sst", 88],
    // Au-delà de la fenêtre d'alerte : ne doivent pas apparaître dans la liste
    ["Camille N.", "c09", "mac", 104],
    ["Pauline K.", "c02", "sst", 140],
    ["Romain E.", "c01", "sst", 210],
    ["Zoé W.", "c13", "mac", 400],
  ]

  /* ============================================================
     Construction des jeux de données (ce que renverrait l'API)
     ============================================================ */

  // Barème kilométrique appliqué sur les factures déjà émises.
  // C'est une donnée historique : modifier tauxKm dans config.js
  // ne doit pas réécrire les anciennes factures.
  const TAUX_KM_FACTURE = 0.26

  const formationParId = Object.fromEntries(FORMATIONS.map((f) => [f.id, f]))
  const clientParId = Object.fromEntries(CLIENTS.map((c) => [c.id, c]))

  function construireSessions() {
    return SESSIONS.map((s) => {
      const f = formationParId[s.formation]
      const inscriptions =
        s.type === "intra" ? [{ clientId: s.client, stagiaires: s.stagiaires }] : s.inscriptions.map(([clientId, n]) => ({ clientId, stagiaires: n }))
      const client = s.type === "intra" ? clientParId[s.client] : null
      return {
        id: s.id,
        formationId: s.formation,
        type: s.type,
        dateDebut: jour(s.j),
        dateFin: jour(s.j + f.jours - 1),
        lieu: s.lieu || client.ville,
        distanceKm: s.distanceKm ?? client.distanceKm,
        deplacementFacture: s.type === "intra" && !client.tarentaise,
        inscriptions,
        capacite: f.capacite,
        statut: s.statut || "confirmee",
        montantHT: s.montantHT ?? null,
        libelle: s.libelle || null,
      }
    })
  }

  function construireFactures(sessions) {
    const brutes = []
    sessions.forEach((s, index) => {
      // Une facture n'est émise qu'une fois la session réalisée
      if (s.statut === "annulee" || s.dateFin >= jour(0)) return
      const f = formationParId[s.formationId]
      const source = SESSIONS[index]
      const emission = source.j + f.jours // lendemain du dernier jour de formation

      s.inscriptions.forEach(({ clientId, stagiaires }) => {
        const client = clientParId[clientId]
        const lignes = []
        if (s.type === "intra") {
          lignes.push({
            formationId: f.id,
            libelle: `${s.libelle || f.nom} (intra, ${f.heures} h, ${stagiaires} stagiaires)`,
            quantite: 1,
            prixUnitaireHT: s.montantHT ?? f.prixIntra,
          })
          if (s.deplacementFacture) {
            lignes.push({
              formationId: "deplacement",
              libelle: `Indemnités kilométriques, ${client.distanceKm * 2} km aller-retour depuis Séez`,
              quantite: client.distanceKm * 2,
              prixUnitaireHT: TAUX_KM_FACTURE,
            })
          }
        } else {
          lignes.push({
            formationId: f.id,
            libelle: `${f.nom} (inter, ${f.heures} h, ${s.lieu})`,
            quantite: stagiaires,
            prixUnitaireHT: f.prixInter,
          })
        }

        // Paiement simulé : habitude du client, avec une légère variation
        const forceImpaye = source.impayes === true || (Array.isArray(source.impayes) && source.impayes.includes(clientId))
        const delai = client.delaiPaiement + ((index * 5) % 7) - 3
        const paiement = emission + delai
        brutes.push({
          emissionJ: emission,
          clientId,
          sessionId: s.id,
          lignes,
          dateEmission: jour(emission),
          dateEcheance: jour(emission + 30),
          datePaiement: forceImpaye || paiement >= 0 ? null : jour(paiement),
        })
      })
    })

    // Numérotation chronologique continue, par année d'émission
    brutes.sort((a, b) => a.emissionJ - b.emissionJ || a.clientId.localeCompare(b.clientId))
    const compteurs = {}
    return brutes.map(({ emissionJ, ...facture }) => {
      const annee = facture.dateEmission.slice(0, 4)
      compteurs[annee] = (compteurs[annee] || 0) + 1
      return { numero: `F-${annee}-${String(compteurs[annee]).padStart(3, "0")}`, ...facture }
    })
  }

  function construireDevis(sessions) {
    const bruts = []

    // Chaque session intra a fait l'objet d'un devis
    SESSIONS.forEach((source, index) => {
      if (source.type !== "intra") return
      const s = sessions[index]
      const f = formationParId[source.formation]
      const client = clientParId[source.client]
      const emission = source.j - (16 + ((index * 3) % 12))
      const km = client.tarentaise ? 0 : client.distanceKm * 2
      bruts.push({
        emissionJ: emission,
        clientId: source.client,
        sessionId: s.id,
        objet: `${source.libelle || f.nom}, intra`,
        montantHT: Math.round(((source.montantHT ?? f.prixIntra) + km * TAUX_KM_FACTURE) * 100) / 100,
        dateEmission: jour(emission),
        dateValidite: jour(emission + 30),
        // Session en option : devis toujours en attente de réponse
        statut: s.statut === "option" ? "en_attente" : "accepte",
        dateReponse: s.statut === "option" ? null : jour(emission + 4 + (index % 6)),
      })
    })

    DEVIS_LIBRES.forEach((d, i) => {
      bruts.push({
        emissionJ: d.j,
        clientId: d.client,
        sessionId: null,
        objet: d.objet,
        montantHT: Math.round((d.montantHT + d.km * TAUX_KM_FACTURE) * 100) / 100,
        dateEmission: jour(d.j),
        dateValidite: jour(d.j + 30),
        statut: d.statut,
        dateReponse: d.statut === "en_attente" ? null : jour(d.j + 7 + i),
      })
    })

    bruts.sort((a, b) => a.emissionJ - b.emissionJ)
    const compteurs = {}
    return bruts.map(({ emissionJ, ...devis }) => {
      const annee = devis.dateEmission.slice(0, 4)
      compteurs[annee] = (compteurs[annee] || 0) + 1
      return { numero: `D-${annee}-${String(compteurs[annee]).padStart(3, "0")}`, ...devis }
    })
  }

  function construireCharges(sessions) {
    const charges = []
    const ajouter = (j, categorie, libelle, montant) => {
      if (j > 0) return // pas de charge future
      charges.push({ date: jour(j), categorie, libelle, montant: Math.round(montant * 100) / 100 })
    }

    // Charges récurrentes, sur les 12 derniers mois
    for (let m = 0; m < 12; m++) {
      const debutMois = new Date(AUJ.getFullYear(), AUJ.getMonth() - m, 1)
      const decalage = (jourDuMois) => Math.round((new Date(debutMois.getFullYear(), debutMois.getMonth(), jourDuMois) - AUJ) / 86400000)
      ajouter(decalage(3), "Banque et logiciels", "Frais bancaires, compte professionnel", 9)
      ajouter(decalage(5), "Télécom et web", "Forfait téléphone et internet", 32)
      ajouter(decalage(10), "Banque et logiciels", "Logiciel de facturation et comptabilité", 25)
      ajouter(decalage(12), "Télécom et web", "Hébergement du site yosecours.fr", 9)
      ajouter(decalage(15), "Assurance", "Assurance responsabilité civile professionnelle", 38)

      // Consommables et carburant, proportionnels à l'activité du mois
      const prefixeMois = iso(debutMois).slice(0, 7) // "AAAA-MM"
      const duMois = sessions.filter((s) => s.statut !== "annulee" && s.dateDebut.startsWith(prefixeMois) && s.dateDebut <= jour(0))
      const stagiaires = duMois.reduce((t, s) => t + s.inscriptions.reduce((u, i) => u + i.stagiaires, 0), 0)
      const km = duMois.reduce((t, s) => t + s.distanceKm * 2, 0)
      if (stagiaires) ajouter(decalage(20), "Matériel pédagogique", "Consommables (masques, lingettes, pansements)", 15 + stagiaires * 1.8)
      if (km) ajouter(decalage(27), "Déplacements", "Carburant et péages", km * 0.13)
    }

    // Achats ponctuels
    ajouter(-340, "Matériel pédagogique", "Mannequins RCP adulte, enfant et nourrisson", 1280)
    ajouter(-330, "Télécom et web", "Renouvellement du nom de domaine", 15)
    ajouter(-262, "Matériel pédagogique", "Bac à feu écologique", 690)
    ajouter(-200, "Matériel pédagogique", "Défibrillateur de formation", 420)
    ajouter(-150, "Matériel pédagogique", "Recharge des extincteurs pédagogiques", 165)
    ajouter(-120, "Formation du formateur", "Maintien des compétences formateur SST", 890)
    ajouter(-45, "Matériel pédagogique", "Trousses de secours de démonstration", 140)
    ajouter(-30, "Déplacements", "Entretien du véhicule", 310)

    return charges.sort((a, b) => a.date.localeCompare(b.date))
  }

  function construireCertifications() {
    return CERTIFICATIONS_BRUTES.map(([stagiaire, clientId, formationId, expireDans], i) => ({
      id: `C${String(i + 1).padStart(2, "0")}`,
      stagiaire,
      clientId,
      formationId,
      dateFormation: formeExpirantDans(expireDans),
      dateRelance: null,
    }))
  }

  // Construction unique, puis copies à chaque appel (comme une vraie API)
  const SESSIONS_API = construireSessions()
  const BASE = {
    formations: FORMATIONS,
    clients: CLIENTS.map(({ delaiPaiement, ...c }) => c),
    sessions: SESSIONS_API,
    factures: construireFactures(SESSIONS_API),
    devis: construireDevis(SESSIONS_API),
    charges: construireCharges(SESSIONS_API),
    certifications: construireCertifications(),
  }

  const copie = (valeur) => Promise.resolve(JSON.parse(JSON.stringify(valeur)))

  /* ---------- API publique ----------
     À remplacer plus tard, par exemple :
       getFactures: () => fetch("/api/factures").then((r) => r.json()) */
  window.YoData = {
    getFormations: () => copie(BASE.formations),
    getClients: () => copie(BASE.clients),
    getSessions: () => copie(BASE.sessions),
    getFactures: () => copie(BASE.factures),
    getDevis: () => copie(BASE.devis),
    getCharges: () => copie(BASE.charges),
    getCertifications: () => copie(BASE.certifications),

    /** Relance d'un stagiaire (simulée : aucune donnée n'est envoyée) */
    relancerCertification: (id) => {
      const c = BASE.certifications.find((x) => x.id === id)
      if (c) c.dateRelance = jour(0)
      return copie({ ok: true, id, dateRelance: jour(0) })
    },
  }
})()
