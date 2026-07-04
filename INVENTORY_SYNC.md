# Inventory Sync Middleware

## Directory Structure

```text
server/src/models/InventorySyncProduct.js
server/src/routes/inventorySyncRoutes.js
server/src/services/googleSheetsInventoryService.js
server/src/services/googleMerchantSyncService.js
server/src/services/inventorySyncService.js
server/src/services/websiteProductSyncService.js
server/src/utils/inventoryMapper.js
```

## Data Flow

```text
Master spreadsheet (1xlDAl...)
  tab "Products"  ← you edit here; stock writes on orders go here
        │
        │  IMPORTRANGE (Google Sheets — automatic)
        ▼
GMC spreadsheet (1LKXER...)
  tab "from MasterSheet(products)"  ← website sync reads from here
        │
        │  formulas / feed pipeline
        ▼
  tab "Sheet1"  ← Google Merchant Center feed
```

1. `POST /api/inventory/sync` reads **`from MasterSheet(products)`** on the GMC spreadsheet.
2. Each row is transformed with `mapSheetRowToWebsiteProduct`.
3. MongoDB stores the source row hash and transformed payload hash in `InventorySyncProduct`.
4. Changed rows are upserted into the website `Product` collection.
5. Changed rows are pushed to Google Merchant Center when `GOOGLE_MERCHANT_ID` is configured.
6. `POST /webhooks/orders` receives sales events and updates the Sheet `Stock` cell from the website's current stock (checkout already reduced website stock).

For this store's native checkout flow, set `INVENTORY_SYNC_ON_ORDERS=true` after Google Sheets auth is configured. Paid Stripe orders will then push stock to the Google Sheet automatically.

**Important:** `POST /api/inventory/sync` reads the Google Sheet and updates the website. It does **not** write website sales back to the sheet. Running sync after a sale will not update column `Stock` in the sheet.

| Action | Endpoint |
| --- | --- |
| Sheet → website import/update | `POST /api/inventory/sync` |
| Sale → Google Sheet stock | `POST /webhooks/orders` or enable `INVENTORY_SYNC_ON_ORDERS=true` |
| Fix one paid order manually | `POST /api/inventory/push-order/:orderId` |

## Google Sheet Mapping

| Sheet Column | Website Field |
| --- | --- |
| `Name` | `name` |
| `Desc.` | `description` |
| `Price (Local)` | `price` |
| `price (API)` | `comparePrice` |
| `Website Category` if present, else last part of `Google Category` | SEO-friendly website `category` |
| `Google Category` | Merchant Center `googleProductCategory` |
| `Brand`, `active_ingredient`, `dosage_form` | comma-separated `tags` |
| `MPN` | `sku` |
| `Barcode` | `barcode`, and `sku` fallback |
| `Stock` | `stock`, `isPublished` |
| `Image URLs`, `image (extra)` | clean comma-separated `imageUrls` |
| `Link` (optional Merchant sheet column G) | stored as `productLinkPath` so the domain can change later |

`isPublished` is `true` when stock is greater than `0`; `isFeatured` defaults to `false`.

For SEO, the website does not use the full Google taxonomy as the storefront category. For example, `Health & Beauty > Health Care > Fitness & Nutrition > Vitamins & Supplements` becomes `Vitamins & Supplements` on the website, while the full path is still sent to Google Merchant Center.

During each sync, categories with fewer than `INVENTORY_MIN_CATEGORY_PRODUCT_COUNT` synced products are collapsed into `INVENTORY_OTHER_CATEGORY_NAME`. Blank or uncategorized products also go into `Other Categories`. This keeps storefront filters broad enough for SEO and usability.

Merchant Center links are generated from `SITE_URL` plus the product path. Do not store the staging IP/domain as permanent data. If the Merchant sheet has a full `Link` value in column G, the sync keeps only the path (for example `/product/example-slug`) and rebuilds the full URL from the current `SITE_URL`. When the domain changes, update `SITE_URL` to `https://evolvepharmacy.com` and run a full sync to refresh Merchant links.

If `GOOGLE_MERCHANT_FEED_SHEET_ID` is configured, each inventory sync writes the generated product URL to the Merchant feed sheet's link column. For the current feed, that is `Sheet1` column `G`, so `GOOGLE_MERCHANT_FEED_LINK_COLUMN=7`.

## Required Environment Variables

```env
INVENTORY_SYNC_ENABLED=false
INVENTORY_SYNC_ON_ORDERS=false
INVENTORY_SYNC_INTERVAL_MS=900000
INVENTORY_MIN_CATEGORY_PRODUCT_COUNT=2
INVENTORY_OTHER_CATEGORY_NAME=Other Categories
INVENTORY_WEBHOOK_SECRET=change-this-shared-secret
GOOGLE_MASTER_SHEET_ID=1xlDAlbKki5lwI91_Jw1pTe6mhyxIwEmp2_tJ6vOYMag
GOOGLE_MASTER_SHEET_NAME=Products
INVENTORY_SYNC_MASTER_FIRST=false
GOOGLE_INVENTORY_SHEET_ID=1LKXERqfQUOssj3WadUxIgwoPdcOyRcJGf8itFwTnhjk
GOOGLE_INVENTORY_SHEET_NAME=from MasterSheet(products)
GOOGLE_INVENTORY_RANGE='from MasterSheet(products)'!A:O
GOOGLE_INVENTORY_STOCK_COLUMN=10
GOOGLE_STOCK_SHEET_ID=1xlDAlbKki5lwI91_Jw1pTe6mhyxIwEmp2_tJ6vOYMag
GOOGLE_STOCK_SHEET_NAME=Products
GOOGLE_MERCHANT_FEED_SHEET_ID=1LKXERqfQUOssj3WadUxIgwoPdcOyRcJGf8itFwTnhjk
GOOGLE_MERCHANT_FEED_SHEET_NAME=Sheet1
GOOGLE_MERCHANT_FEED_LINK_COLUMN=7
GOOGLE_USE_APPLICATION_DEFAULT=false
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_MERCHANT_ID=your_merchant_center_id
GOOGLE_MERCHANT_CONTENT_LANGUAGE=en
GOOGLE_MERCHANT_TARGET_COUNTRY=US
GOOGLE_MERCHANT_CHANNEL=online
GOOGLE_MERCHANT_CURRENCY=USD
```

If your organization blocks service account key creation with `iam.disableServiceAccountKeyCreation`, use local Application Default Credentials instead:

```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/content
```

Then set `GOOGLE_USE_APPLICATION_DEFAULT=true` in local `.env`. The Google account you log in with must have edit access to the Google Sheet. For production, prefer a keyless identity setup such as workload identity / service account impersonation instead of downloading JSON keys.

If service account keys are allowed, share the Google Sheet with the service account email as an editor.

## Manual Sync

```bash
curl -X POST http://localhost:5000/api/inventory/sync \
  -H "x-inventory-webhook-secret: change-this-shared-secret"
```

## Order Webhook Payload

```json
{
  "orderId": "example-order-id",
  "websiteStockAlreadyReduced": false,
  "items": [
    { "sku": "MAS-OSTEO-60", "quantity": 2 },
    { "barcode": "311845181756", "quantity": 1 }
  ]
}
```

Send it to:

```text
POST /webhooks/orders
```

## Vercel Deployment Note

Do not rely on `setInterval` for periodic sync on Vercel serverless functions. Keep `INVENTORY_SYNC_ENABLED=false` and configure Vercel Cron to call:

```text
POST /api/inventory/sync
```

If you use Vercel deployment hooks or continuous deployment triggers as part of inventory publishing, wait at least 60 seconds after triggering a rebuild before starting follow-up validation or sync actions. This gives Vercel time to register the deployment and avoids racing against an in-progress build.
