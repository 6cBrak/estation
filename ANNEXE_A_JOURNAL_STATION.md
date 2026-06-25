# Annexe A — Journal de Station OLA Energy

**Document de référence :** digitalisation du journal papier OLA Energy Burkina S.A.
**N° de formulaire papier :** 0078041 (format)
**Source :** formulaire physique utilisé quotidiennement en station.

> Ce document décrit la structure exacte du journal papier afin que l'application reproduise fidèlement la logique métier et le format PDF généré.

---

## 1. En-tête du journal

| Champ | Description |
|---|---|
| Station | Nom/code de la station |
| Nom du gérant | Prénom et nom du gérant de permanence |
| Journée | Date du jour (JJ-MM-AAAA) |
| N° | Numéro séquentiel du journal (ex : 0078041) |

---

## 2. Section 1 — Mouvements Carburants

### Logique métier fondamentale

> **Les ventes de carburant ne sont PAS enregistrées transaction par transaction.**
> Elles sont déduites de la différence entre les index de compteur de pompe en ouverture et en fermeture de journée.

### Pompes concernées

| Ligne | Pompe |
|---|---|
| 1 | SUPER 1 |
| 2 | SUPER 2 |
| 3 | SUPER 3 |
| 4 | SUPER 4 |
| 5 | PÉTROLE |
| 6 | GAS-OIL 1 |
| 7 | GAS-OIL 2 |
| 8 | GAS-OIL 3 |
| 9 | GAS-OIL 4 |

### Colonnes par pompe

| Colonne | Nom | Type | Calcul |
|---|---|---|---|
| A | Index Ouverture | Saisi | Repris automatiquement de J-1 Index Fermeture |
| B | Index Fermeture | Saisi | Relevé du compteur en fin de journée |
| C | Sortie du PV | Calculé | `B - A` |
| D | Retour | Saisi | Volume retourné dans la cuve (rarissime) |
| E | Vente du jour (litres) | Calculé | `C - D` |
| F | Stock Précédent (litres) | Calculé | Repris de J-1 Stock réel |
| G | Approvisionnement (litres) | Saisi | Livraison reçue dans la journée |
| H | Stock Théorique | Calculé | `F + G - E` |
| I | Stock Réel | Saisi | Jaugeage physique de la cuve en fin de journée |
| J | Écart + | Calculé | `I - H` si positif |
| K | Écart − | Calculé | `H - I` si positif |

### Règles métier

- Si `|Écart| > seuil_tolérance_station` → commentaire obligatoire avant clôture.
- L'index d'ouverture du jour = index de fermeture de la veille (reprise automatique).
- Un journal ne peut pas être clôturé si l'index fermeture d'une pompe n'est pas saisi.

---

## 3. Section 2 — Mouvements Lubrifiants

### Logique métier

Les lubrifiants ont un stock physique suivi quotidiennement. Les ventes sont saisies manuellement (quantité vendue en boutique ou en piste).

### Catalogue des produits suivis

**Marque Delvac (OLA) :**
- Delvac DM 1 15W40
- Delvac DM 5 5W40
- Delvac DM 4 5W40
- Delvac DM 1 15W40 (conditionnement différent)
- Delvac DM 11 5W40
- Delvac DM 4 SAE 50
- Star DI RO DIO 80/90
- Hydrol 46B
- Star DI RO 80/90
- Unité de réfroidissement

**Marque Accel :**
- Accel Piston 5W20
- Accel Bike 4 15W40/42
- Accel DM 3 15W40
- Mobi Power 4 T (4T) 15W50

**Autres :**
- Delvac DM1 13W40
- Glide Motor Cas SAE 60
- Star Concord
- Glycomol DM5 SAE 60
- ATF D
- Star Compact
- Star DI HO (ROXB5)
- Géar Oil HO (10/30W)
- Star DI HO (10/30W) AG

**Synthétiques / Piste :**
- Braw Fluid Del 1
- **CUMUL DES VENTES LUBRIFIANTS**
- **TOTAL GÉNÉRAL LUBRIFIANTS GAZ**

### Colonnes par produit

| Colonne | Nom | Type | Calcul |
|---|---|---|---|
| 1 | Stock ouverture | Calculé | Repris de J-1 Stock fermeture |
| 2 | Quantité reçue | Saisi | Livraison du jour |
| 3 | Stock cumulé | Calculé | `(1) + (2)` |
| 4 | Quantité vendue | Saisi | Ventes du jour (boutique + piste) |
| 5 | Stock fermeture | Calculé | `(3) - (4)` |
| P.U. | Prix unitaire | Paramétré | Prix de vente en FCFA |
| Qté | Quantité vendue jour | = colonne 4 | |
| Valeur | Montant FCFA | Calculé | `Qté × P.U.` |

---

## 4. Section 3 — Récapitulation des Ventes du Jour

C'est la synthèse quotidienne. Elle consolide toutes les ventes par catégorie et suit les **cumuls mensuels**.

### Lignes de récapitulation

| Catégorie | Type |
|---|---|
| **PRODUITS BLANCS** | |
| SUPER | Carburant |
| PÉTROLE | Carburant |
| GAS-OIL | Carburant |
| **CUMUL CARBURANT** | Sous-total calculé |
| **LUBRIFIANTS** | |
| Lubs Boutique | Lubrifiants vendus en boutique |
| Lubs Piste | Lubrifiants vendus en piste (service) |
| **CUMUL LUBRIFIANTS** | Sous-total calculé |
| **OPÉRATIONS** | |
| Graissage | Service |
| Vidange | Service |
| Lavage | Service |
| Autres / Divers | Service divers |
| BOUTIQUE | Ventes boutique générale |
| GAZ / (CHARGES) | Bouteilles de gaz |
| **TOTAL GÉNÉRAL** | Somme de toutes les catégories |

### Colonnes de la récapitulation

| Colonne | Nom | Description |
|---|---|---|
| Quantité | Ventes du jour | Volume ou nombre d'unités vendues aujourd'hui |
| P.U. | Prix unitaire | Prix en FCFA (carburant : FCFA/litre) |
| Valeur | Montant FCFA | `Quantité × P.U.` |
| Report de la Veille | Cumul J-1 | Total cumulé du mois jusqu'à hier |
| Total du mois précédent | Quantité | Cumul du mois M-1 (référence) |
| Total du mois en cours | Quantité | `Report veille + Ventes du jour` |
| Écarts + | Variance positive | |
| Écarts − | Variance négative | |

### Modes de règlement (bas de la section 3)

| Mode | Description |
|---|---|
| ESPÈCES | Paiement cash |
| TICKETS | Bons carburant entreprise |
| TPE | Paiement carte bancaire |

> La somme `ESPÈCES + TICKETS + TPE` doit égaler le **TOTAL GÉNÉRAL**.
> Un écart entre cette somme et le total général doit être justifié (crédit non encore encaissé, erreur de saisie).

---

## 5. Workflow quotidien du gérant

```
MATIN (ouverture)
├── Relever les index d'ouverture de chaque pompe
├── Constater le stock lubrifiant ouverture (= fermeture J-1)
└── Ouvrir le journal (statut : draft)

JOURNÉE
├── Saisir les livraisons carburant si reçues (Approvisionnement)
├── Saisir les livraisons lubrifiants si reçues (Qté reçue)
└── (Pas de saisie de ventes individuelles carburant)

SOIR (clôture)
├── Relever les index de fermeture de chaque pompe
├── Jauger les cuves → saisir Stock réel
├── Compter les ventes lubrifiants (inventaire physique ou tickets)
├── Saisir les ventes opérations (graissage, vidange, lavage)
├── Saisir les ventes boutique et gaz
├── Saisir les encaissements (Espèces, Tickets, TPE)
├── Vérifier les écarts (carburant et caisse)
├── Signer et clôturer le journal
└── (Le journal est verrouillé après clôture)
```

---

## 6. Règles de validation avant clôture

1. Tous les index de fermeture de pompe doivent être renseignés.
2. Tous les jaugeages de cuve (Stock réel) doivent être renseignés.
3. Si `|Écart carburant| > seuil` → un commentaire est obligatoire.
4. `Espèces + Tickets + TPE` doit correspondre au Total Général (tolérance paramétrable).
5. Un journal clôturé est verrouillé (hash d'intégrité) et ne peut plus être modifié.
6. La validation finale est faite par le **Super Admin / siège**.

---

## 7. Reprise automatique J-1 → J

Chaque matin, à l'ouverture d'un nouveau journal, les champs suivants sont repris automatiquement depuis le journal de la veille :

| Champ J | Source J-1 |
|---|---|
| Index Ouverture (chaque pompe) | Index Fermeture J-1 |
| Stock Précédent carburant (chaque pompe) | Stock Réel J-1 |
| Stock ouverture lubrifiants (chaque produit) | Stock fermeture J-1 |
| Report de la Veille (récap section 3) | Total du mois en cours J-1 |

---

## 8. Implications pour la modélisation de données

- **Pas de modèle `Sale` pour le carburant** → les ventes carburant sont dérivées des `PumpReading` (index).
- Le modèle central est `StationJournal` avec ses lignes `JournalFuelLine` (une par pompe).
- Les lubrifiants ont leurs propres lignes `JournalLubricantLine` (une par produit suivi).
- La section 3 est `JournalSalesRecap` (une ligne par catégorie) + `JournalPaymentSummary`.
- Le modèle `Sale` (Sprint 3) concerne **uniquement** : boutique, services (graissage/vidange/lavage), gaz — c'est-à-dire tout ce qui se vend unitairement avec un ticket.
