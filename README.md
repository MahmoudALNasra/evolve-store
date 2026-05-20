# eStore — MERN E-Commerce Platform

Full-stack MERN e-commerce app with Stripe payments, Google OAuth, Cloudinary image uploads, and Excel-based bulk product management.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS v4 |
| Backend | Node.js + Express |
| Database | MongoDB (local dev → Atlas prod) |
| Auth | JWT + Google OAuth 2.0 |
| Payments | Stripe Checkout Sessions + Webhooks |
| Images | Cloudinary (file upload + URL link) |
| State | Zustand |

---

## Project Structure

```
ecommerce/
├── client/          # React + Vite frontend
└── server/          # Express API
```

---

## Quick Start

### 1. Server setup

```bash
cd server
npm install
cp .env.example .env   # fill in your values
npm run dev            # starts on http://localhost:5000
```

### 2. Client setup

```bash
cd client
npm install
cp .env.example .env   # fill in your values
npm run dev            # starts on http://localhost:5173
```

---

## Environment Variables

### `server/.env`

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string (local: `mongodb://localhost:27017/estore`) |
| `JWT_SECRET` | Any long random string |
| `JWT_EXPIRE` | Token expiry e.g. `7d` |
| `CLIENT_URL` | Frontend URL e.g. `http://localhost:5173` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5000/api/auth/google/callback` |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |
| `STRIPE_SECRET_KEY` | From Stripe dashboard (use `sk_test_...` for dev) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI or dashboard webhook settings |

### `client/.env`

| Variable | Description |
|---|---|
| `VITE_STRIPE_PUBLIC_KEY` | From Stripe dashboard (`pk_test_...` for dev) |

---

## Admin Access

The **first user to register** is automatically assigned the `admin` role. All subsequent users are `user` by default.

Admin panel is available at `/admin`.

---

## Bulk Product Operations (Excel)

Both templates are downloadable directly from the Admin Panel → Products page.

### Bulk Add (`/admin/products` → Import Excel)
Download the template, fill it in, upload the `.xlsx` file.

| Column | Description |
|---|---|
| `name` | Product name (required) |
| `description` | Product description |
| `price` | Selling price |
| `comparePrice` | Original price (for sale badge) |
| `category` | Category name |
| `tags` | Comma-separated tags |
| `sku` | Unique SKU identifier |
| `barcode` | Barcode string |
| `stock` | Initial stock quantity |
| `weight` | Weight in kg |
| `isPublished` | `true` or `false` |
| `isFeatured` | `true` or `false` |
| `imageUrls` | Comma-separated image URLs |

### Bulk Restock (`/admin/products` → Bulk Restock)

| Column | Description |
|---|---|
| `sku` | Must match existing product SKU |
| `qty_to_add` | Amount to add to current stock |

---

## Stripe Webhook (local testing)

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Copy the webhook secret printed and set it as `STRIPE_WEBHOOK_SECRET` in `server/.env`.

---

## Deployment

- **Frontend** → Vercel (`npm run build`, set `VITE_*` env vars in dashboard)
- **Backend** → DigitalOcean App Platform or Droplet, set env vars, use `npm start`
- **Database** → MongoDB Atlas (update `MONGO_URI` to Atlas connection string)
- **Stripe webhook** → Register endpoint in Stripe dashboard for production URL
