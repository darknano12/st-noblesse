# 🏰 PocketBase Backend Guide — st.noblesse

This directory contains the database schema, starter seed data, and server-side hooks for **st.noblesse** (Maison de Haute Parfumerie).

---

## ⚡ Quick Start (Local Development)

### 1. Download PocketBase
Download the single binary for your operating system from the [official PocketBase releases](https://pocketbase.io/docs/):
- **Windows:** `pocketbase_windows_amd64.zip`
- Extract `pocketbase.exe` into the `pocketbase/` folder (or project root).

### 2. Start the Server
Run in PowerShell / Terminal:
```powershell
./pocketbase.exe serve --http="127.0.0.1:8090"
```

The server will be available at:
- **REST API:** `http://127.0.0.1:8090/api/`
- **Admin Dashboard:** `http://127.0.0.1:8090/_/`

---

## 📋 Schema Import & Collections

The database schema is defined in [`pocketbase/pb_schema.json`](file:///c:/Users/Alithis/Desktop/st.noblesse/pocketbase/pb_schema.json).

### Collections included:
1. **`products`**
   - `name` (Text, required): Perfume name (e.g. *Azure Épure*)
   - `slug` (Text, unique): URL-safe identifier (e.g. `azure-epure`)
   - `family` (Select): `fresh` | `oriental` | `woody` | `floral`
   - `gender` (Select): `Unisex` | `Men` | `Women`
   - `badge` (Text, optional): Luxury badge (`Signature`, `Limited Edition`)
   - `desc` (Text): Story & description
   - `notes_top`, `notes_heart`, `notes_base` (JSON array): Olfactory pyramid notes
   - `price_50` (Number): Price in EUR for 50ml flacon (e.g. 89)
   - `price_100` (Number): Price in EUR for 100ml flacon (e.g. 129)
   - `rating` (Number): Average score (e.g. 4.9)
   - `reviews_count` (Number): Total reviews count
   - `image` (Text): Asset reference key or uploaded image

2. **`reviews`**
   - `author` (Text): Reviewer name
   - `content` (Text): Review quote
   - `location` (Text): City / fragrance reference
   - `rating` (Number): Stars (1–5)

3. **`orders`**
   - `stripe_session_id` (Text, unique)
   - `customer_email` (Email)
   - `items` (JSON): Ordered items list
   - `total` (Number): Amount paid in EUR
   - `currency` (Text): Default `EUR`
   - `status` (Select): `pending` | `paid` | `failed`

### To import via Admin UI:
1. Open `http://127.0.0.1:8090/_/`.
2. Navigate to **Settings** (`⚙️`) → **Import collections**.
3. Paste or load [`pb_schema.json`](file:///c:/Users/Alithis/Desktop/st.noblesse/pocketbase/pb_schema.json) and click **Import**.

---

## 💳 Stripe Integration & JS Hooks

Server hooks are located in [`pb_hooks/stripe.pb.js`](file:///c:/Users/Alithis/Desktop/st.noblesse/pb_hooks/stripe.pb.js). PocketBase automatically loads this file on start.

### Endpoints created:
1. `POST /api/create-checkout-session`
   - Calculates true product prices from the PocketBase database (protects against client price tampering).
   - Applies complimentary shipping for orders over €150 (otherwise €15 delivery).
   - Creates a Stripe Checkout Session via Stripe REST API.
   - If `STRIPE_SECRET_KEY` is not set or set to test mode, gracefully simulates successful order completion with local mock checkout.

2. `POST /api/stripe-webhook`
   - Listens to Stripe `checkout.session.completed` events.
   - Automatically writes a record to the `orders` collection with status `paid`.

### Environment Variables:
```env
STRIPE_SECRET_KEY=sk_test_...   # Your Stripe Secret API key
SITE_URL=http://localhost:3000  # Frontend base URL for success/cancel redirects
```
