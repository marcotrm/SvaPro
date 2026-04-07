# SvaPro — Piano di Fix Sistemico

## Problemi Identificati

### 403 Errori API
- Origine: `ResolveTenant` middleware tornava 403 per mismatch `X-Tenant-Code`
- Fix applicato: ignora header per utenti non-superadmin
- Rimanente: server vecchio ancora in cache → **usare sempre `php artisan config:clear` dopo deploy**

### CSS Rotto (Root Cause)
Le pagine usano una mistura di 3 sistemi CSS:
1. `sp-*` classes (NUOVO sistema custom)
2. `card-v3`, `btn-v3-*`, `badge-v3`, `table-v3` (VECCHIO sistema legacy)
3. Tailwind utilities (`flex`, `grid`, `text-sm`, `rounded-*`)

**Soluzione**: Aggiungere shim CSS che mappa le classi vecchie alle nuove variabili.

## Fix Plan

### Step 1: CSS Compat Layer
Aggiungere al `app.css` tutti gli alias legacy → new system

### Step 2: 403 Fix Permanente
- `RefreshTenant` per admin_cliente usa sempre `user.tenant_id`

### Step 3: POS Correlati + Dual Payment
- Cross-selling visibile sotto la ricerca
- Modal pagamento con Cash+Card simultanei

## Pagine da Fixare
| Pagina | Problema | Priorità |
|---|---|---|
| OrdersPage | `card-v3`, `btn-v3-*`, `table-v3`, `badge-v3` | Alta |
| CustomersPage | stesse classi legacy | Alta |
| SuppliersPage | stesse classi legacy | Alta |
| InventoryPage | 403 + classi legacy | Alta |
| ReturnsPage | 403 + classi legacy | Alta |
| InvoicesPage | classi legacy | Media |
| EmployeesPage | classi legacy | Media |
| PromotionsPage | classi legacy | Media |
| PurchaseOrdersPage | classi legacy | Media |
| SupplierInvoicesPage | classi legacy | Media |
