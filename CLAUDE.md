# CLAUDE.md — Instructions pour Claude Code

Ce fichier est lu automatiquement par Claude Code à chaque session.
**À ne jamais ignorer ni contourner.**

---

## 📚 Documents de référence (à lire AVANT toute action)

1. **`CAHIER_DES_CHARGES.md`** — spécification fonctionnelle et technique globale
2. **`ANNEXE_A_JOURNAL_STATION.md`** — digitalisation du journal de station papier
3. **`DATABASE_SCHEMA.md`** — modèle de données complet
4. **`PLANNING.md`** — découpage en sprints et user stories

> Avant chaque tâche, vérifier que la demande est cohérente avec ces documents. En cas de conflit, **demander clarification** plutôt que d'inventer.

---

## 🎯 Contexte projet

Application web de gestion de **stations-service multi-sites** pour le réseau **OLA Energy Burkina**.
Remplace un journal papier quotidien rempli à la main.
**Stack :** Django REST Framework + PostgreSQL + React (Vite + TypeScript).
**Langue :** Français (UI et code commenté en français).
**Devise :** FCFA (XOF).
**Fuseau horaire :** `Africa/Ouagadougou` (UTC+0).

---

## 🏗️ Structure imposée du projet

```
.
├── backend/                    # Django
│   ├── config/                 # settings split (base, dev, prod), urls, wsgi
│   ├── apps/
│   │   ├── core/               # BaseModel abstrait, permissions, utils
│   │   ├── accounts/           # User, rôles, JWT
│   │   ├── stations/           # Station, paramétrage
│   │   ├── fuel/               # Cuves, pompes, mouvements
│   │   ├── sales/              # Ventes, caisse, paiements
│   │   ├── shop/               # Boutique générale
│   │   ├── lubricants/         # Catalogue lubrifiants (séparé de shop)
│   │   ├── services/           # Graissage, vidange, lavage
│   │   ├── gas/                # Bouteilles de gaz
│   │   ├── personnel/          # Employés, shifts, pointage
│   │   ├── customers/          # Clients, fidélité, crédit
│   │   ├── suppliers/          # Fournisseurs, approvisionnement
│   │   ├── journal/            # Journal de station quotidien
│   │   └── reports/            # Rapports, exports
│   ├── manage.py
│   └── requirements/
│       ├── base.txt
│       ├── dev.txt
│       └── prod.txt
├── frontend/                   # React + Vite + TS
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── features/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── lib/
│   │   ├── routes/
│   │   └── main.tsx
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

**Ne pas créer d'autres dossiers à la racine sans justification explicite.**

---

## ⚖️ Conventions de code

### Backend (Django)
- **Python 3.12+**, formatage **Black**, linting **Ruff**, imports triés **isort**.
- **Type hints** sur toutes les fonctions publiques.
- Modèles : **PascalCase**, fichiers : `snake_case.py`.
- Une app Django = un domaine métier. **Pas de fourre-tout**.
- Tous les modèles métier héritent d'un `BaseModel` (dans `apps/core/models.py`) :
  ```python
  class BaseModel(models.Model):
      id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
      created_at = models.DateTimeField(auto_now_add=True)
      updated_at = models.DateTimeField(auto_now=True)
      created_by = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL, related_name='+')
      is_active = models.BooleanField(default=True)
      class Meta:
          abstract = True
  ```
- **Pas de suppression physique** (`.delete()`) sur les entités métier : utiliser `is_active=False`.
- **ViewSets DRF** plutôt que vues fonctionnelles, sauf cas particulier.
- **Serializers explicites** : pas de `fields = '__all__'` en production.
- **Permissions** : combiner `IsAuthenticated` + permission custom par rôle + filtre station.
- **Tests** : `pytest` + `pytest-django`, factories avec `factory_boy`.

### Frontend (React)
- **TypeScript strict** (`strict: true` dans tsconfig).
- Composants : **PascalCase**, hooks : **camelCase** préfixé `use`.
- **TanStack Query** pour les appels API (pas d'`useEffect` + `fetch`).
- **Zustand** pour l'état global (auth, station courante).
- **TailwindCSS** + **shadcn/ui** pour l'UI.
- **react-hook-form + zod** pour les formulaires et la validation.
- Un dossier `features/<domaine>/` par module métier.
- Tests : **Vitest** + **React Testing Library**.

### API REST
- Versionnée : `/api/v1/...`
- Endpoints en **kebab-case pluriel** : `/api/v1/fuel-tanks/`, `/api/v1/journal-entries/`
- Réponses paginées par défaut (`PageNumberPagination`, page_size=20).
- Erreurs au format JSON cohérent : `{ "detail": "...", "errors": {...} }`.
- Documentation auto avec **drf-spectacular** (Swagger sur `/api/v1/docs/`).

---

## 🔒 Règles de sécurité non négociables

1. **Toujours** filtrer les querysets par `station_id` selon l'utilisateur connecté (sauf rôles globaux).
2. **Jamais** faire confiance au frontend : valider tout côté backend.
3. **Mots de passe** : Argon2 obligatoire (`PASSWORD_HASHERS`).
4. **Secrets** : uniquement dans `.env`, **jamais** committés.
5. **JWT** : access token 15 min, refresh token 7 jours, rotation activée.
6. **CORS** : whitelist stricte des domaines frontend.
7. **Audit log** sur toute action critique (vente, clôture, suppression logique, modification rôle).
8. **Rate limiting** sur `/api/v1/auth/login/` (5 tentatives / 5 min / IP).

---

## 🧪 Définition du "Terminé" (Definition of Done)

Une fonctionnalité est considérée comme livrée **uniquement si** :

- [ ] Code conforme aux conventions ci-dessus.
- [ ] Tests unitaires écrits (couverture ≥ 70 % sur le module touché).
- [ ] Tests d'intégration sur les endpoints API.
- [ ] Migrations Django créées et testées.
- [ ] Documentation API à jour (drf-spectacular).
- [ ] Permissions testées (un utilisateur sans le bon rôle reçoit bien 403).
- [ ] Filtrage par station vérifié (un gérant ne voit pas les données d'une autre station).
- [ ] Code review passée (auto-review minimum).
- [ ] Pas de warning Django / TypeScript / Ruff.
- [ ] README ou commentaire ajouté si la logique métier est non triviale.

---

## 🚦 Comment travailler avec moi (Claude Code)

### Démarrage de session
1. Lire les 4 documents de référence en début de session.
2. Lister les fichiers récemment modifiés (`git log --oneline -20`).
3. Comprendre où on en est dans le `PLANNING.md`.

### Avant d'écrire du code
- **Toujours** se demander : à quel sprint et à quelle user story cette tâche correspond-elle ?
- Si la demande de l'utilisateur sort du cahier des charges, **le signaler** avant de coder.
- Si une décision technique non documentée doit être prise, **proposer 2-3 options** avec un avis, plutôt que choisir silencieusement.

### Pendant l'écriture
- Découper en commits **petits et atomiques** (un commit = une intention claire).
- Messages de commit en **français**, format conventional commits :
  - `feat(fuel): ajout du modèle Tank avec jaugeage`
  - `fix(sales): correction du calcul du total avec remise`
  - `refactor(core): extraction du BaseModel`
  - `test(journal): tests de la clôture quotidienne`
  - `docs(readme): instructions de démarrage`

### Après l'écriture
- Lancer les tests avant de proposer le travail comme terminé.
- Mettre à jour `PLANNING.md` (cocher les user stories terminées).
- Si le schéma de BDD a évolué : régénérer le diagramme dans `DATABASE_SCHEMA.md`.

---

## ⛔ Anti-patterns à éviter absolument

- ❌ Créer un endpoint qui retourne des données sans filtre de station.
- ❌ Utiliser `User.objects.all()` sans contrôle de permission.
- ❌ Faire des calculs métier côté frontend (les ventes, écarts, etc. sont calculés côté backend).
- ❌ Hardcoder des valeurs métier (prix, seuils, taux TVA) — toujours paramétrable.
- ❌ Ignorer les migrations Django : toujours `makemigrations` + `migrate` après modif de modèle.
- ❌ Mélanger les apps Django (ex : importer un modèle de `sales` dans `fuel` sans interface claire).
- ❌ Créer des composants React de plus de 200 lignes — décomposer.
- ❌ Stocker l'access token JWT dans le `localStorage` — utiliser cookie httpOnly ou mémoire.
- ❌ Supprimer physiquement une vente, un client, une transaction.

---

## 🧭 Quand demander de l'aide / clarifier

Toujours demander clarification dans ces cas :

- Une donnée métier inconnue (seuil d'écart, format de bouteille, type de carburant nouveau).
- Un workflow non documenté (qui valide quoi, quand, comment).
- Un conflit entre deux documents de référence.
- Une fonctionnalité qui touche plusieurs modules (impact transverse).
- Un choix d'architecture irréversible.

---

## 🛠️ Commandes utiles

### Backend
```bash
# Démarrer en dev
docker compose up -d
cd backend && python manage.py runserver

# Migrations
python manage.py makemigrations
python manage.py migrate

# Tests
pytest --cov=apps

# Lint & format
ruff check . && ruff format .
```

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run test
npm run lint
npm run build
```

---

## 📌 Rappels finaux

- **Lire avant de coder.**
- **Demander avant d'inventer.**
- **Tester avant de livrer.**
- **Documenter avant d'oublier.**
