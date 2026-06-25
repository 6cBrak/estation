# Planning — Sprints détaillés

**Document complémentaire au :** `CAHIER_DES_CHARGES.md`
**Méthode :** Scrum allégé, sprints de **2 semaines**.
**Durée totale estimée :** 10 sprints (~5 mois).

---

## Légende des user stories

- **US** = User Story
- **Estim.** = estimation en points (Fibonacci : 1, 2, 3, 5, 8, 13).
- **Statut** : `[ ]` à faire, `[~]` en cours, `[x]` terminé.
- **Priorité** : 🔴 critique, 🟠 importante, 🟡 souhaitable.

### Définition du "Terminé" rappel
Voir `CLAUDE.md` § Definition of Done.

---

## Sprint 0 — Mise en place (1 semaine)

**Objectif :** environnement de dev opérationnel et squelette des projets.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S0.1 | Initialiser le repo Git, branches `main` / `develop`, .gitignore | 1 | 🔴 |
| [ ] | S0.2 | Créer `docker-compose.yml` (PostgreSQL 16, Redis, backend, frontend) | 3 | 🔴 |
| [ ] | S0.3 | Bootstraper le projet Django (config, settings split, requirements) | 3 | 🔴 |
| [ ] | S0.4 | Bootstraper le projet React (Vite + TS + Tailwind + shadcn) | 3 | 🔴 |
| [ ] | S0.5 | Configurer Ruff, Black, ESLint, Prettier, pre-commit hooks | 2 | 🟠 |
| [ ] | S0.6 | Configurer drf-spectacular (Swagger /api/v1/docs/) | 2 | 🟠 |
| [ ] | S0.7 | Mettre en place GitHub Actions (lint + tests sur PR) | 3 | 🟠 |
| [ ] | S0.8 | Créer le `BaseModel` abstrait dans `apps/core` | 1 | 🔴 |
| [ ] | S0.9 | Créer le `README.md` avec instructions de démarrage | 2 | 🟠 |

**Livrable :** un développeur peut cloner le repo et lancer `docker compose up` pour avoir backend + frontend qui démarrent.

---

## Sprint 1 — Authentification & Stations (2 semaines)

**Objectif :** un Super Admin peut créer des stations et des utilisateurs avec rôles.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S1.1 | Modèles `User`, `Role`, `Station` + migrations | 3 | 🔴 |
| [ ] | S1.2 | Endpoints JWT (`/auth/login/`, `/auth/refresh/`, `/auth/logout/`) | 5 | 🔴 |
| [ ] | S1.3 | Permission custom `IsSuperAdmin`, `IsStationManager`, etc. | 3 | 🔴 |
| [ ] | S1.4 | CRUD stations (Super Admin uniquement) | 3 | 🔴 |
| [ ] | S1.5 | CRUD utilisateurs avec affectation à une station | 5 | 🔴 |
| [ ] | S1.6 | Filtre automatique par `station_id` (mixin DRF) | 5 | 🔴 |
| [ ] | S1.7 | Page de login React (form + redirection) | 3 | 🔴 |
| [ ] | S1.8 | Layout principal React (sidebar selon rôle) | 5 | 🟠 |
| [ ] | S1.9 | Pages CRUD stations & utilisateurs (frontend) | 5 | 🔴 |
| [ ] | S1.10 | Tests : un gérant ne peut pas voir les utilisateurs d'une autre station | 3 | 🔴 |
| [ ] | S1.11 | Audit log de base (création, modification, suppression user) | 3 | 🟠 |

**Critères d'acceptation :**
- ✅ Un Super Admin peut créer une station et y affecter un gérant.
- ✅ Le gérant se connecte et n'accède qu'à sa station.
- ✅ Les routes sensibles sont protégées (403 si rôle insuffisant).

---

## Sprint 2 — Carburant : cuves & pompes (2 semaines)

**Objectif :** modéliser le matériel de la station et permettre les jaugeages.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S2.1 | Modèles `FuelType`, `Tank`, `Pump`, `PumpNozzle` + migrations | 3 | 🔴 |
| [ ] | S2.2 | Modèles `TankReading`, `StockMovement` + migrations | 3 | 🔴 |
| [ ] | S2.3 | CRUD cuves et pompes (Super Admin et Gérant) | 5 | 🔴 |
| [ ] | S2.4 | Endpoint de jaugeage (saisie niveau cuve) | 3 | 🔴 |
| [ ] | S2.5 | Logique de mouvements de stock (entrée, sortie, ajustement) | 5 | 🔴 |
| [ ] | S2.6 | Alertes niveau bas (signal Django sur seuil) | 3 | 🟠 |
| [ ] | S2.7 | UI : configuration des cuves et pompes (Gérant) | 5 | 🔴 |
| [ ] | S2.8 | UI : saisie de jaugeage avec historique | 3 | 🔴 |
| [ ] | S2.9 | Tests : cohérence des stocks après mouvements | 3 | 🔴 |

**Critères d'acceptation :**
- ✅ Une station peut être configurée avec ses cuves et pompes (SUPER 1, SUPER 2, GAS-OIL 1…).
- ✅ Le gérant peut saisir un jaugeage matin et soir.
- ✅ Le stock cuve est mis à jour automatiquement.

---

## Sprint 3 — Ventes & Caisse (2 semaines)

**Objectif :** un caissier peut ouvrir une session, enregistrer des ventes carburant et clôturer.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S3.1 | Modèles `CashSession`, `Sale`, `SaleItem`, `Payment` + migrations | 5 | 🔴 |
| [ ] | S3.2 | Endpoint d'ouverture de session de caisse | 3 | 🔴 |
| [ ] | S3.3 | Endpoint d'enregistrement de vente carburant (volume ou montant) | 5 | 🔴 |
| [ ] | S3.4 | Gestion des modes de paiement (espèces, MM, TPE, ticket, crédit) | 5 | 🔴 |
| [ ] | S3.5 | Endpoint de clôture de caisse (comptage, écart) | 5 | 🔴 |
| [ ] | S3.6 | Génération PDF du ticket de vente | 3 | 🟠 |
| [ ] | S3.7 | UI : interface caisse rapide (sélection pompe, paiement) | 8 | 🔴 |
| [ ] | S3.8 | UI : clôture de caisse avec récap | 5 | 🔴 |
| [ ] | S3.9 | Annulation de vente (avec motif et trace) | 3 | 🟠 |
| [ ] | S3.10 | Tests : impossible d'enregistrer une vente sans session ouverte | 2 | 🔴 |

**Critères d'acceptation :**
- ✅ Un caissier peut faire une vente espèces et imprimer un ticket en < 30 secondes.
- ✅ La clôture détecte un écart caisse au-delà du seuil et exige un commentaire.
- ✅ Une vente annulée garde une trace mais n'est plus comptée.

---

## Sprint 4 — Boutique, Lubrifiants, Services, Gaz (2 semaines)

**Objectif :** étendre les ventes à tous les autres produits / services de la station.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S4.1 | Modèles `Product`, `ProductCategory`, `ProductStock` + migrations | 3 | 🔴 |
| [ ] | S4.2 | Modèles `LubricantBrand`, `LubricantProduct`, `LubricantStock` | 3 | 🔴 |
| [ ] | S4.3 | Modèles `ServiceCatalogItem`, `GasBottleFormat`, `GasBottleStock` | 3 | 🔴 |
| [ ] | S4.4 | CRUD catalogues (boutique, lubrifiants, services, gaz) | 5 | 🔴 |
| [ ] | S4.5 | Extension des ventes pour items mixtes (carburant + boutique + service) | 5 | 🔴 |
| [ ] | S4.6 | Distinction "vente lubrifiant boutique" vs "vente lubrifiant piste" | 3 | 🟠 |
| [ ] | S4.7 | Recherche par code-barres en caisse (boutique) | 3 | 🟠 |
| [ ] | S4.8 | UI : catalogue boutique et lubrifiants par station | 5 | 🔴 |
| [ ] | S4.9 | UI : interface caisse mixte (panier multi-types) | 5 | 🔴 |
| [ ] | S4.10 | Mise à jour automatique des stocks à la vente | 3 | 🔴 |

**Critères d'acceptation :**
- ✅ Une vente peut combiner 50L de SUPER + 1L de Delvac DM12 + 1 lavage.
- ✅ Le stock de chaque produit est décrémenté automatiquement.
- ✅ La distinction lubrifiant boutique / piste apparaît dans les rapports.

---

## Sprint 5 — Personnel & Pointage (2 semaines)

**Objectif :** gestion des employés, plannings et pointage.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S5.1 | Modèles `Employee`, `Shift`, `ShiftAssignment`, `Attendance` | 3 | 🔴 |
| [ ] | S5.2 | CRUD employés (RH + Gérant pour sa station) | 5 | 🔴 |
| [ ] | S5.3 | Définition des shifts et planning hebdomadaire | 5 | 🔴 |
| [ ] | S5.4 | Pointage entrée / sortie | 3 | 🔴 |
| [ ] | S5.5 | Calcul automatique des heures travaillées | 3 | 🟠 |
| [ ] | S5.6 | UI : fiche employé avec upload de documents | 5 | 🟠 |
| [ ] | S5.7 | UI : calendrier de planning hebdomadaire | 8 | 🟠 |
| [ ] | S5.8 | UI : vue pointage du jour pour le gérant | 3 | 🔴 |
| [ ] | S5.9 | Récap mensuel par employé (heures, retards, absences) | 5 | 🟠 |

**Critères d'acceptation :**
- ✅ Le gérant peut affecter ses employés à un shift pour la semaine.
- ✅ Le pointage du matin met à jour le récap mensuel.
- ✅ Les heures travaillées sont calculées automatiquement.

---

## Sprint 6 — Clients, Fidélité, Crédit (2 semaines)

**Objectif :** gestion des clients particuliers et professionnels avec crédit et fidélité.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S6.1 | Modèles `Customer`, `Vehicle` + migrations | 3 | 🔴 |
| [ ] | S6.2 | Modèles `LoyaltyAccount`, `LoyaltyTransaction` | 3 | 🟠 |
| [ ] | S6.3 | Modèles `CreditAccount`, `CreditTransaction` | 3 | 🔴 |
| [ ] | S6.4 | CRUD clients (avec véhicules pour les Pros) | 5 | 🔴 |
| [ ] | S6.5 | Vente à crédit : contrôle du plafond avant validation | 5 | 🔴 |
| [ ] | S6.6 | Gain de points fidélité automatique à chaque vente éligible | 3 | 🟡 |
| [ ] | S6.7 | Conversion points → réduction en caisse | 3 | 🟡 |
| [ ] | S6.8 | Génération de la facture mensuelle pour un client à crédit (PDF) | 5 | 🔴 |
| [ ] | S6.9 | Enregistrement des paiements crédit | 3 | 🔴 |
| [ ] | S6.10 | UI : recherche rapide client en caisse (téléphone, plaque, n° carte) | 5 | 🔴 |

**Critères d'acceptation :**
- ✅ Un client Pro peut acheter à crédit jusqu'à son plafond.
- ✅ La facture mensuelle PDF est générable en un clic.
- ✅ Une vente avec carte fidélité accumule les points.

---

## Sprint 7 — Fournisseurs & Approvisionnement (2 semaines)

**Objectif :** gestion des bons de commande et livraisons.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S7.1 | Modèles `Supplier`, `PurchaseOrder`, `PurchaseOrderItem` | 3 | 🔴 |
| [ ] | S7.2 | Modèles `Delivery`, `DeliveryItem` | 3 | 🔴 |
| [ ] | S7.3 | CRUD fournisseurs | 3 | 🔴 |
| [ ] | S7.4 | Création d'un bon de commande (BC) | 5 | 🔴 |
| [ ] | S7.5 | Réception : transformer un BC en livraison avec écart | 5 | 🔴 |
| [ ] | S7.6 | Mise à jour automatique des stocks à la réception | 3 | 🔴 |
| [ ] | S7.7 | Pour livraison carburant : saisir jauge avant / après | 3 | 🔴 |
| [ ] | S7.8 | Génération PDF du BC | 3 | 🟠 |
| [ ] | S7.9 | UI : liste BC avec statuts (draft / sent / received) | 5 | 🔴 |
| [ ] | S7.10 | UI : écran de réception | 5 | 🔴 |

**Critères d'acceptation :**
- ✅ Un BC carburant génère un mouvement de stock à la réception.
- ✅ L'écart entre commande et livraison est tracé et visible.
- ✅ Le BC peut être imprimé en PDF.

---

## Sprint 8 — Journal de Station (2 semaines) ⭐ CŒUR MÉTIER

**Objectif :** digitaliser le journal papier OLA Energy.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S8.1 | Modèles `StationJournal`, `JournalFuelLine`, `JournalLubricantLine` | 5 | 🔴 |
| [ ] | S8.2 | Modèles `JournalSalesRecap`, `JournalPaymentSummary` | 3 | 🔴 |
| [ ] | S8.3 | Endpoint d'ouverture du journal (reprise auto J-1) | 5 | 🔴 |
| [ ] | S8.4 | Calculs automatiques (volumes, écarts, cumuls mensuels) | 8 | 🔴 |
| [ ] | S8.5 | Endpoint de clôture avec validation (toutes les jauges saisies) | 5 | 🔴 |
| [ ] | S8.6 | Génération PDF reproduisant la mise en page papier (WeasyPrint) | 8 | 🔴 |
| [ ] | S8.7 | Hash et verrouillage du journal après validation | 3 | 🔴 |
| [ ] | S8.8 | UI : écran "Journal du jour" avec les 3 sections (cf. annexe A § 6) | 13 | 🔴 |
| [ ] | S8.9 | Historique des journaux par station (liste + visualisation) | 5 | 🟠 |
| [ ] | S8.10 | Workflow de validation par le siège (Super Admin) | 5 | 🟠 |

**Critères d'acceptation :**
- ✅ Le gérant ouvre son journal le matin avec toutes les valeurs J-1 reprises.
- ✅ La clôture refuse de valider si une jauge manque ou un écart > seuil sans commentaire.
- ✅ Le PDF généré est identique en structure au formulaire papier OLA.

---

## Sprint 9 — Rapports & Tableau de bord (2 semaines)

**Objectif :** vues consolidées et exports.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S9.1 | Tableau de bord Super Admin (vue réseau) | 8 | 🔴 |
| [ ] | S9.2 | Tableau de bord Gérant (sa station) | 5 | 🔴 |
| [ ] | S9.3 | Rapport ventes (par jour / semaine / mois, par station) | 5 | 🔴 |
| [ ] | S9.4 | Rapport stocks (carburant et boutique) | 3 | 🔴 |
| [ ] | S9.5 | Rapport caisses (clôtures et écarts) | 3 | 🔴 |
| [ ] | S9.6 | Rapport personnel (heures, absences) | 3 | 🟠 |
| [ ] | S9.7 | Rapport crédit (encours, factures, paiements) | 3 | 🔴 |
| [ ] | S9.8 | Rapport rapprochement (pompes vs caisse vs cuves) | 5 | 🔴 |
| [ ] | S9.9 | Exports PDF et Excel sur tous les rapports | 5 | 🔴 |
| [ ] | S9.10 | Génération asynchrone (Celery) pour rapports lourds | 5 | 🟠 |
| [ ] | S9.11 | Graphiques (Recharts ou Chart.js) sur le dashboard | 5 | 🟠 |

**Critères d'acceptation :**
- ✅ Le Super Admin voit en un coup d'œil les ventes du jour de toutes les stations.
- ✅ Tous les rapports sont exportables en PDF et Excel.
- ✅ Le rapport de rapprochement met en évidence les écarts > seuil.

---

## Sprint 10 — Recette, sécurité, déploiement (2 semaines)

**Objectif :** durcissement, tests utilisateurs, mise en production.

| Statut | US | Description | Estim. | Prio |
|--------|----|----|--------|------|
| [ ] | S10.1 | Audit de sécurité (OWASP Top 10) | 5 | 🔴 |
| [ ] | S10.2 | Tests de charge (k6 ou Locust) sur 50 utilisateurs simultanés | 3 | 🟠 |
| [ ] | S10.3 | Mise en place sauvegarde BDD quotidienne automatique | 3 | 🔴 |
| [ ] | S10.4 | Configuration HTTPS + reverse proxy (Nginx / Traefik) | 3 | 🔴 |
| [ ] | S10.5 | Configuration monitoring (Sentry pour les erreurs) | 3 | 🟠 |
| [ ] | S10.6 | Recette utilisateur avec un gérant pilote | 5 | 🔴 |
| [ ] | S10.7 | Corrections issues de la recette | 8 | 🔴 |
| [ ] | S10.8 | Documentation : manuel utilisateur par rôle (PDF) | 5 | 🔴 |
| [ ] | S10.9 | Formation des premiers utilisateurs | 3 | 🟠 |
| [ ] | S10.10 | Mise en production sur une station pilote | 5 | 🔴 |

**Critères d'acceptation :**
- ✅ L'application tourne sur la station pilote sans incident pendant 1 semaine.
- ✅ Les sauvegardes sont vérifiées (restauration testée).
- ✅ Le manuel utilisateur est validé par le gérant.

---

## Suivi global

### Vélocité estimée
- Équipe de 2 développeurs full-stack : **30-40 points par sprint** (rythme de croisière à partir du sprint 2).
- Total estimé du backlog : **~340 points**.

### Risques identifiés
| Risque | Impact | Mitigation |
|--------|--------|------------|
| Reproduction exacte du PDF OLA Energy | 🔴 | Obtenir un modèle officiel avant le sprint 8 |
| Adoption par les gérants peu à l'aise avec l'informatique | 🟠 | UI proche du papier + formation + support |
| Perte de connectivité internet en station | 🔴 | Prévoir un mode "offline-first" en V2 (hors V1) |
| Ajout de nouvelles stations à chaud | 🟠 | Multi-tenant logique dès le sprint 1 |
| Variations tarifaires (prix carburant fluctuant) | 🟠 | Historique des prix + paramétrage centralisé |

### Hors V1 (à rappeler au commanditaire)
- Application mobile native
- Mode offline avec synchronisation
- Intégration directe avec les pompes (lecture automatique des index)
- Comptabilité analytique complète
- Module e-commerce / commande en ligne
- API publique pour intégrations tierces
- Multilingue (anglais, langues locales)

### Cérémonies recommandées
- **Daily standup** : 15 min chaque matin.
- **Sprint planning** : début de sprint, 2h.
- **Sprint review** : fin de sprint, démo au commanditaire, 1h.
- **Rétrospective** : fin de sprint, équipe seule, 1h.

---

## 🎯 Jalons (milestones) majeurs

| Jalon | Sprint | Date relative | Livrable |
|-------|--------|---------------|----------|
| M1 — MVP technique | S1 | Semaine 3 | Auth + multi-stations fonctionnel |
| M2 — Ventes opérationnelles | S4 | Semaine 11 | Caisse + tous les types de produits |
| M3 — Journal digitalisé | S8 | Semaine 19 | Cœur métier OLA |
| M4 — Production pilote | S10 | Semaine 23 | App déployée sur 1 station |
