# Vouch

Vouch is a warranty management platform connecting brands with their customers.

## Current features

- Brand and customer username/password accounts.
- Shared Prisma database with Supabase support.
- Brand workspace with expandable navigation.
- Brand dashboard with warranty metrics and analytics.
- Product catalog with search, filters, grid/list views, warranty duration, SKUs, and unit counts.
- CSV/XLSX unit import from Products, with column mapping, product matching, preview, duplicate skipping, and import history.
- Product-level registration verification by Unit ID, Order ID, or both; dual mode checks the exact order/unit/product match.
- Product image uploads with crop, zoom, rotate, and replacement controls.
- Customer product registration through brand product links.
- Customer warranty dashboard showing remaining coverage days.
- Customer support and claim tracking.
- One claim per registered product.
- Brand claims inbox with status tabs, product filters, issue-tag filters, search, and reset filters.
- Claim quick-view panel with product image, customer details, timeline, status actions, and full claim view.
- Product-specific issue tags for filtering claims.
- Private claim photos: per-product on/off and 1–3 photo limit, automatic resizing, visible only to the customer and owning brand.
- Approved repair/replacement claims request the customer's address; the brand sees when it arrives and can resolve the claim afterward.

## Run locally

```powershell
npm install
npx prisma generate
npm run dev
```

Create a `.env` file with the shared `DATABASE_URL` and Supabase settings. The database owner should apply schema migrations with:

```powershell
npx prisma migrate deploy
```

For claim photos, add the server-only `SUPABASE_SECRET_KEY` in `.env`. The server uses a private `workspace-images` bucket and creates it on first upload if the key has permission. Never add this key to client-side variables or commit it.

Do not run `db:clear` unless all local records should be deleted.

## Registration emails

Set `RESEND_API_KEY` and `EMAIL_FROM` in the server environment (see `.env.example`).
Apply migrations with `npx prisma migrate deploy`, regenerate the client with
`npm run db:generate`, and restart the API. Customers can update their email under
**Settings**. The email stays on their account and synchronizes to their customer
records; username/password login is unchanged.

Each new registration saves one `EmailOutbox` job in the registration transaction.
The Express server processes jobs every 15 seconds while running. Confirmations
contain the product, brand, and remaining coverage days at registration. Existing
registrations and repeat submissions do not enqueue messages. The sender and
message are saved with the job so retries use the same Resend idempotency key and
payload. `ACCEPTED` means Resend accepted the email, not confirmed inbox delivery.
Transient failures retry up to eight attempts within 23 hours of the first attempt;
permanent failures and expired retries are marked `FAILED` for review. Inspect
`lastError` and the Resend dashboard before manually retrying an uncertain send.
Without an API key, jobs remain pending. Serverless hosting will need a scheduled
worker instead of relying on the Express process timer.

For testing with `onboarding@resend.dev`, use the same recipient email as your
Resend account. Resend rejects other recipients until you verify a sending domain.
For production, configure `EMAIL_FROM` with that domain. Email address verification
and Google sign-in are not part of this initial settings flow.

## Importing units

Open **Brand → Products → Import units**. A file can contain one product's Unit IDs or several products identified by SKU. You can map any source headers, preview valid and skipped rows, then confirm. Reuploading a file adds only new Unit IDs for that brand. Imports do not create warranties.

Unit IDs are trimmed and uppercased for upload and registration; Order IDs and SKUs are trimmed and retain case. New Order IDs in an import are recorded without a delivery date. To make a unit eligible for registration, use its product's **Add or complete a unit** form with the actual Unit ID, Order ID, and delivery date. A unit imported without an Order ID can be completed through the same form. Existing product verification modes remain unchanged until a brand changes them in product settings.
