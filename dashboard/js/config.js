/* ============================================================
   YO'SECOURS · Tableau de bord · CONSTANTES MODIFIABLES
   ------------------------------------------------------------
   Toutes les valeurs ci-dessous sont des hypothèses de travail.
   Chacune est à confirmer avec le client ou son comptable avant
   toute utilisation réelle : elles changent régulièrement
   (lois de finances, revalorisations triennales des plafonds).
   ============================================================ */

window.YO_CONFIG = Object.freeze({
  // Plafond de chiffre d'affaires de la micro-entreprise pour une activité
  // de prestation de services / BNC, valeur 2026.
  // À confirmer avec le client ou son comptable.
  plafondCA: 83600,

  // Seuil de franchise en base de TVA pour les prestations de services
  // (seuil majoré : 41 250 €). Une réforme abaissant ce seuil a été
  // votée puis suspendue : à surveiller.
  // À confirmer avec le client ou son comptable.
  seuilTVA: 37500,

  // Taux global de cotisations sociales sur le CA encaissé :
  // 25,6 % (BNC non réglementé, 2026) + 0,2 % de contribution à la
  // formation professionnelle. Hors versement libératoire de l'impôt.
  // À confirmer avec le client ou son comptable (le taux dépend aussi
  // du rattachement BIC / BNC de l'activité et de l'ACRE éventuelle).
  tauxCotisations: 0.258,

  // Indemnité kilométrique facturée, par km aller-retour depuis Séez,
  // hors Tarentaise (affichée sur le site : 0,26 €/km).
  // À confirmer avec le client ou son comptable.
  tauxKm: 0.26,

  // Objectif annuel de CA encaissé, fixé par le client.
  // À confirmer avec le client ou son comptable.
  objectifAnnuel: 30000,

  // false = franchise en base de TVA (mention « TVA non applicable,
  // art. 293 B du CGI » sur les factures) ; les montants sont alors HT = TTC.
  // Une exonération propre à la formation professionnelle continue
  // (art. 261-4-4° du CGI) peut aussi s'appliquer selon le statut de
  // l'organisme.
  // À confirmer avec le client ou son comptable.
  tvaApplicable: false,

  // Fenêtre d'alerte des certificats SST à renouveler, en jours.
  // À confirmer avec le client ou son comptable.
  alerteCertificationsJours: 90,

  // Date du jour utilisée par le tableau de bord, au format "AAAA-MM-JJ".
  // null = date réelle du jour. Utile pour figer une démonstration.
  // À confirmer avec le client ou son comptable.
  dateDuJour: null,
});
