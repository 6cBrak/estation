# Schéma de base de données

**Document complémentaire au :** `CAHIER_DES_CHARGES.md` et `ANNEXE_A_JOURNAL_STATION.md`
**Format :** diagrammes Mermaid (rendus nativement dans VSCode et GitHub).

> **Convention commune :** chaque entité hérite implicitement de `BaseModel` (id UUID, created_at, updated_at, created_by, is_active). Ces champs ne sont pas répétés dans les diagrammes pour la lisibilité.

---

## 1. Vue d'ensemble (par domaine)

```mermaid
flowchart LR
    AUTH[👤 Comptes & Rôles] --> STA[🏢 Stations]
    STA --> FUEL[⛽ Carburant]
    STA --> SHOP[🛒 Boutique]
    STA --> LUB[🛢️ Lubrifiants]
    STA --> SVC[🔧 Services]
    STA --> GAS[🔥 Gaz]
    STA --> PERS[👥 Personnel]
    STA --> SALES[💰 Ventes & Caisse]
    STA --> JOUR[📓 Journal]
    SALES --> CUST[🪪 Clients & Fidélité]
    STA --> SUPP[🚚 Fournisseurs]
    JOUR --> REP[📊 Rapports]
```

---

## 2. Domaine — Comptes & Stations

```mermaid
erDiagram
    User ||--o{ Station : "manage (manager)"
    User }o--|| Station : "assigned to"
    User ||--o{ Role : "has"

    User {
        UUID id PK
        string username UK
        string email UK
        string password_hash
        string first_name
        string last_name
        string phone
        string role "super_admin|manager|cashier|pump_attendant|hr|accountant|customer_pro"
        UUID station_id FK "null si role global"
        boolean is_active
        datetime last_login
    }

    Station {
        UUID id PK
        string code UK "ex: OUA-2030"
        string name
        string address
        string city
        string phone
        UUID manager_id FK
        decimal gauge_tolerance_pct "écart toléré en %"
        decimal cash_tolerance_xof "écart caisse toléré"
        boolean is_active
    }

    Role {
        string code PK
        string name
        json permissions "liste granulaire"
    }
```

---

## 3. Domaine — Carburant

```mermaid
erDiagram
    Station ||--o{ Tank : "has"
    Station ||--o{ Pump : "has"
    Tank ||--|| FuelType : "stores"
    Tank ||--o{ Pump : "feeds"
    Pump ||--o{ PumpNozzle : "has"
    PumpNozzle ||--|| FuelType : "delivers"
    Tank ||--o{ TankReading : "jauged"
    PumpNozzle ||--o{ PumpReading : "indexed"
    Tank ||--o{ StockMovement : "movements"

    FuelType {
        UUID id PK
        string code UK "super|petrole|gasoil"
        string name
        decimal current_unit_price "FCFA / litre"
    }

    Tank {
        UUID id PK
        UUID station_id FK
        UUID fuel_type_id FK
        string label "ex: Cuve 1 SUPER"
        decimal capacity_liters
        decimal current_level_liters
        decimal low_threshold_liters
    }

    Pump {
        UUID id PK
        UUID station_id FK
        UUID tank_id FK
        string label "ex: SUPER 1"
        int display_order
    }

    PumpNozzle {
        UUID id PK
        UUID pump_id FK
        UUID fuel_type_id FK
        string label "Pistolet A"
    }

    TankReading {
        UUID id PK
        UUID tank_id FK
        decimal level_liters
        string reading_type "morning|evening|delivery|adjustment"
        datetime recorded_at
        UUID recorded_by FK
        string notes
    }

    PumpReading {
        UUID id PK
        UUID pump_nozzle_id FK
        UUID journal_id FK
        decimal index_open
        decimal index_close
        decimal volume_sold "calculé"
    }

    StockMovement {
        UUID id PK
        UUID tank_id FK
        string type "inbound|outbound|adjustment"
        decimal quantity_liters
        string reason
        string reference "BL, vente, etc."
        datetime occurred_at
    }
```

---

## 4. Domaine — Ventes & Caisse

```mermaid
erDiagram
    CashSession ||--o{ Sale : "contains"
    Sale ||--o{ SaleItem : "lines"
    Sale ||--o{ Payment : "paid by"
    Sale }o--o| Customer : "for"
    Sale }o--o| Vehicle : "vehicle"
    User ||--o{ CashSession : "opens"
    Station ||--o{ CashSession : "has"

    CashSession {
        UUID id PK
        UUID station_id FK
        UUID cashier_id FK
        UUID shift_id FK
        datetime opened_at
        datetime closed_at
        decimal opening_amount_xof
        decimal counted_amount_xof
        decimal expected_amount_xof "calculé"
        decimal variance_xof "calculé"
        string status "open|closed|validated"
        string notes
    }

    Sale {
        UUID id PK
        UUID session_id FK
        UUID customer_id FK
        UUID vehicle_id FK
        string sale_number UK "séquentiel"
        decimal subtotal_xof
        decimal discount_xof
        decimal total_xof
        string status "completed|cancelled"
        datetime sold_at
    }

    SaleItem {
        UUID id PK
        UUID sale_id FK
        string item_type "fuel|lubricant|product|service|gas"
        UUID item_ref_id "polymorphique"
        string label "snapshot du nom"
        decimal quantity
        decimal unit_price_xof
        decimal subtotal_xof
        decimal vat_rate
    }

    Payment {
        UUID id PK
        UUID sale_id FK
        string method "cash|mobile_money|card_tpe|ticket|credit"
        decimal amount_xof
        string reference "txn ID, n° ticket…"
    }
```

---

## 5. Domaine — Boutique, Lubrifiants, Services, Gaz

```mermaid
erDiagram
    ProductCategory ||--o{ Product : "categorizes"
    Station ||--o{ ProductStock : "stocks"
    Product ||--o{ ProductStock : "stocked"

    LubricantBrand ||--o{ LubricantProduct : "has"
    Station ||--o{ LubricantStock : "stocks"
    LubricantProduct ||--o{ LubricantStock : "stocked"

    Station ||--o{ ServiceCatalogItem : "offers"
    Station ||--o{ GasBottleStock : "stocks"
    GasBottleFormat ||--o{ GasBottleStock : "format"

    ProductCategory {
        UUID id PK
        string name UK
    }

    Product {
        UUID id PK
        UUID category_id FK
        string code UK
        string barcode
        string name
        decimal purchase_price_xof
        decimal sale_price_xof
        decimal vat_rate
    }

    ProductStock {
        UUID id PK
        UUID product_id FK
        UUID station_id FK
        decimal quantity
        decimal low_threshold
    }

    LubricantBrand {
        UUID id PK
        string name UK "Delvac|Accel|Hydrol|…"
    }

    LubricantProduct {
        UUID id PK
        UUID brand_id FK
        string code UK "DELVAC_DM12_15W40"
        string name
        string grade "15W40, 20W50…"
        string packaging "1L, 4L, 18kg…"
        decimal purchase_price_xof
        decimal sale_price_boutique_xof
        decimal sale_price_piste_xof
    }

    LubricantStock {
        UUID id PK
        UUID lubricant_id FK
        UUID station_id FK
        decimal quantity
    }

    ServiceCatalogItem {
        UUID id PK
        UUID station_id FK
        string code "graissage|vidange|lavage|autre"
        string name
        decimal default_price_xof
    }

    GasBottleFormat {
        UUID id PK
        decimal weight_kg UK "1.25, 6, 12.5…"
        string label
        decimal sale_price_xof
        decimal deposit_xof "consigne"
    }

    GasBottleStock {
        UUID id PK
        UUID format_id FK
        UUID station_id FK
        int quantity
    }
```

---

## 6. Domaine — Personnel

```mermaid
erDiagram
    User ||--|| Employee : "1:1"
    Station ||--o{ Employee : "employs"
    Station ||--o{ Shift : "defines"
    Employee ||--o{ ShiftAssignment : "assigned"
    Shift ||--o{ ShiftAssignment : "fills"
    Employee ||--o{ Attendance : "clocks"

    Employee {
        UUID id PK
        UUID user_id FK
        UUID station_id FK
        string employee_number UK
        string position "gerant|caissier|pompiste|…"
        date hire_date
        decimal base_salary_xof
        string status "active|suspended|terminated"
        string id_document_url
        string contract_url
    }

    Shift {
        UUID id PK
        UUID station_id FK
        string name "matin|apres-midi|nuit"
        time start_time
        time end_time
    }

    ShiftAssignment {
        UUID id PK
        UUID employee_id FK
        UUID shift_id FK
        date assignment_date
    }

    Attendance {
        UUID id PK
        UUID employee_id FK
        date attendance_date
        datetime check_in
        datetime check_out
        decimal hours_worked "calculé"
        string status "present|late|absent|justified"
        string notes
    }
```

---

## 7. Domaine — Clients & Fidélité

```mermaid
erDiagram
    Customer ||--o{ Vehicle : "owns"
    Customer ||--|| LoyaltyAccount : "has"
    LoyaltyAccount ||--o{ LoyaltyTransaction : "movements"
    Customer ||--o{ CreditAccount : "has"
    CreditAccount ||--o{ CreditTransaction : "movements"
    Customer ||--o{ Sale : "purchases"

    Customer {
        UUID id PK
        string type "individual|professional"
        string full_name
        string company_name
        string ifu "Identifiant Fiscal"
        string rccm
        string phone
        string email
        string address
    }

    Vehicle {
        UUID id PK
        UUID customer_id FK
        string plate UK
        string vehicle_type
        string driver_name
    }

    LoyaltyAccount {
        UUID id PK
        UUID customer_id FK
        string card_number UK
        int points_balance
    }

    LoyaltyTransaction {
        UUID id PK
        UUID account_id FK
        UUID sale_id FK
        int points_delta
        string type "earned|redeemed|expired"
    }

    CreditAccount {
        UUID id PK
        UUID customer_id FK
        decimal credit_limit_xof
        decimal current_balance_xof
        boolean is_blocked
    }

    CreditTransaction {
        UUID id PK
        UUID credit_account_id FK
        UUID sale_id FK
        string type "purchase|payment|adjustment"
        decimal amount_xof
        datetime occurred_at
    }
```

---

## 8. Domaine — Fournisseurs & Approvisionnement

```mermaid
erDiagram
    Supplier ||--o{ PurchaseOrder : "supplies"
    Station ||--o{ PurchaseOrder : "orders"
    PurchaseOrder ||--o{ PurchaseOrderItem : "lines"
    PurchaseOrder ||--o{ Delivery : "delivered"
    Delivery ||--o{ DeliveryItem : "lines"

    Supplier {
        UUID id PK
        string name
        string type "fuel|shop|both"
        string contact
        string ifu
        string rccm
        string phone
        string payment_terms
    }

    PurchaseOrder {
        UUID id PK
        UUID supplier_id FK
        UUID station_id FK
        string order_number UK
        date order_date
        string status "draft|sent|partial|received|cancelled"
        decimal total_xof
    }

    PurchaseOrderItem {
        UUID id PK
        UUID order_id FK
        string item_type "fuel|lubricant|product|gas"
        UUID item_ref_id
        decimal quantity
        decimal unit_price_xof
    }

    Delivery {
        UUID id PK
        UUID order_id FK
        date delivery_date
        UUID received_by FK
        string bl_number "bon de livraison"
        decimal tank_level_before "pour fuel"
        decimal tank_level_after "pour fuel"
        string notes
    }

    DeliveryItem {
        UUID id PK
        UUID delivery_id FK
        string item_type
        UUID item_ref_id
        decimal quantity_ordered
        decimal quantity_received
        decimal variance "calculé"
    }
```

---

## 9. Domaine — Journal de Station (cœur métier)

```mermaid
erDiagram
    Station ||--o{ StationJournal : "logs"
    User ||--o{ StationJournal : "filled by manager"
    StationJournal ||--o{ JournalFuelLine : "fuel section"
    StationJournal ||--o{ JournalLubricantLine : "lubricants section"
    StationJournal ||--o{ JournalSalesRecap : "recap section"
    StationJournal ||--|| JournalPaymentSummary : "payments"
    Pump ||--o{ JournalFuelLine : "for pump"
    LubricantProduct ||--o{ JournalLubricantLine : "for product"

    StationJournal {
        UUID id PK
        UUID station_id FK
        string journal_number UK "séquentiel par station"
        date journal_date UK "1 par station/jour"
        UUID manager_id FK
        string status "draft|closed|validated"
        datetime opened_at
        datetime closed_at
        datetime validated_at
        UUID validated_by FK
        string pdf_url
        string pdf_hash "intégrité"
        string notes
    }

    JournalFuelLine {
        UUID id PK
        UUID journal_id FK
        UUID pump_id FK
        decimal index_open "repris J-1"
        decimal index_close
        decimal output_volume "calc: close-open"
        decimal return_volume
        decimal sold_volume "calc"
        decimal received_volume
        decimal theoretical_stock "calc"
        decimal gauged_stock_open "repris J-1"
        decimal gauged_stock_close
        decimal gauge_diff "calc"
        string diff_comment "obligatoire si > seuil"
    }

    JournalLubricantLine {
        UUID id PK
        UUID journal_id FK
        UUID lubricant_id FK
        decimal stock_open
        decimal purchased_qty
        decimal sold_qty "calc depuis ventes"
        decimal stock_close_theoretical "calc"
        decimal gauged_qty "inventaire"
        decimal diff "calc"
    }

    JournalSalesRecap {
        UUID id PK
        UUID journal_id FK
        string category "super|petrole|gasoil|lubs_boutique|lubs_piste|graissage|vidange|lavage|autres|boutique|gaz"
        decimal qty
        decimal unit_price_xof
        decimal daily_value_xof
        decimal previous_day_cumul_xof
        decimal monthly_cumul_xof
        decimal previous_month_total_xof
    }

    JournalPaymentSummary {
        UUID id PK
        UUID journal_id FK
        decimal cash_amount_xof
        decimal tickets_amount_xof
        decimal tpe_amount_xof
        decimal mobile_money_amount_xof
        decimal credit_amount_xof
        decimal total_xof "calc"
    }
```

---

## 10. Domaine — Audit & Sécurité (transverse)

```mermaid
erDiagram
    User ||--o{ AuditLog : "actions"
    User ||--o{ LoginAttempt : "attempts"

    AuditLog {
        UUID id PK
        UUID user_id FK
        string action "create|update|delete|cancel|validate"
        string entity_type
        UUID entity_id
        json before_state
        json after_state
        string ip_address
        string user_agent
        datetime occurred_at
    }

    LoginAttempt {
        UUID id PK
        UUID user_id FK
        string username_attempted
        boolean success
        string ip_address
        datetime attempted_at
    }
```

---

## 11. Index recommandés (PostgreSQL)

Pour garantir la performance, créer ces index dès les premières migrations :

```sql
-- Filtre station partout
CREATE INDEX idx_user_station ON accounts_user(station_id) WHERE is_active = true;
CREATE INDEX idx_sale_station_date ON sales_sale(session_id, sold_at);
CREATE INDEX idx_journal_station_date ON journal_stationjournal(station_id, journal_date);

-- Recherches fréquentes
CREATE INDEX idx_customer_phone ON customers_customer(phone);
CREATE INDEX idx_vehicle_plate ON customers_vehicle(plate);
CREATE INDEX idx_product_barcode ON shop_product(barcode);

-- Audit log (lectures par entité)
CREATE INDEX idx_audit_entity ON core_auditlog(entity_type, entity_id);
CREATE INDEX idx_audit_user_date ON core_auditlog(user_id, occurred_at DESC);

-- Contraintes d'unicité métier
CREATE UNIQUE INDEX uniq_journal_per_station_per_day
    ON journal_stationjournal(station_id, journal_date);
CREATE UNIQUE INDEX uniq_open_session_per_cashier
    ON sales_cashsession(cashier_id) WHERE status = 'open';
```

---

## 12. Règles d'intégrité critiques

À implémenter en contraintes BDD ou en validation Django :

1. **Un seul journal "draft" par station à un instant T.**
2. **Une seule session de caisse "open" par caissier à un instant T.**
3. **L'index de fermeture d'une pompe ≥ index d'ouverture.**
4. **Total des paiements d'une vente = total de la vente** (tolérance 1 FCFA pour arrondi).
5. **Stock d'un produit / lubrifiant ≥ 0** après chaque mouvement.
6. **Vente à crédit → solde après vente ≤ plafond crédit.**
7. **Une vente ne peut être enregistrée que sur une session de caisse "open".**
8. **Un journal ne peut être clôturé que si toutes les lignes pompes ont un index de fermeture.**
