# Vouch — Interactive Demo v0.1

**Status:** Build specification for a clickable prototype, not a production-ready service  
**Audience:** Product brands such as JB Air, and their customers  
**Platform:** Next.js web app; desktop-first brand workspace, mobile-first customer experience  
**Demo rule:** No login, Google OAuth, outgoing email, or WhatsApp integration

## 1. What is Vouch?

Vouch helps brands register products, keep warranty records, and manage claims in one place. A brand gives its customer a registration link; the customer enters the unique ID printed on their unit; Vouch connects that ID to the brand's existing order record. The customer then sees a warranty card with the **days remaining** and can raise and track a claim. The brand receives that claim in a structured workspace with the matching product, order, warranty dates, and any attached evidence.

**End-to-end story:** Brand's link → Register unit → Warranty card → Days remaining → Raise claim → Brand reviews and decides → Customer tracks the decision.

This prototype demonstrates the flow with **fictional data**. It does not imply JB Air is already a Vouch customer or partner.

## 2. Critical assumptions and boundaries

- A physical unit has a **typed, stamped unit ID** (not a QR code).
- The brand already has a mapping from **unit ID → order ID → product**. For now, seed that mapping in the demo database; CSV import is not necessary.
- The **delivery date comes from brand/order data**, never from the customer's typed registration form.
- The example warranty is **36 calendar months from the recorded delivery date**. Make the warranty length configurable by product model, rather than hard-coding it everywhere.
- Registration is **automatic** when a valid, eligible unit is found. No brand approval queue for registrations.
- Registration **does not restart or extend** warranty coverage.
- JB Air expects to start shipping in **December 2026**. For interactive examples of already-delivered units, use a fictional sample brand (e.g. **Kestrel Audio**) and fictional past deliveries. Do not use JB Air's logo or imply an endorsement without permission.
- A unit's warranty state (active/expired) is separate from a claim's processing state (submitted/in review/etc.).
- The demo uses **one fictional customer per demo session**; customer accounts and identity verification come later.

## 3. How to show both sides WITHOUT login or email

**Use one shareable demo session and two linked views.** The demo link is **not** an authentication mechanism; it is only a convenient way to keep the same fictional records visible in both tabs.

1. Click **Launch interactive demo** from the marketing site (`/demo`). The backend creates a `DemoSession`, seeds fictional products, orders, units, and a customer, and generates a random, hard-to-guess session ID.
2. Open **Customer view**: `/demo/[sessionId]/customer`.
3. Open **Brand view**: `/demo/[sessionId]/brand` in another tab.
4. Keep a small **Demo switcher** in the top bar: `Customer view | Brand view | Reset demo`. Both views use the *same* session ID and database records.
5. The brand-specific link **Register a product** opens `/demo/[sessionId]/register/kestrel-audio/kestrel-pro`. The customer enters a seeded unit ID to register it.
6. The customer submits a claim. Reloading/opening the Brand view shows that claim; after the brand updates it, the Customer claim page shows the new status. Do **not** fake this with unrelated static screens.
7. **Reset demo** deletes/reseeds only that session's data so the presentation can be repeated.

No sign-in page, OTP, OAuth, Gmail API, or SMTP is needed. For the demo, preselect a fictional customer such as **Aarav Demo**. A customer may type a **contact email** as form data, but Vouch will **not verify it or send anything to it**. Label these screens clearly as a *demo*.

**Privacy/safety boundary:** Anyone possessing a demo session URL can access both demo views. Never put real customer records in this unauthenticated demo. Real brand accounts, access control, secure claim links, and customer ownership verification are required before a live pilot.

## 4. What the visitor sees

### A. Public landing page (marketing)

Use the agreed premium design, but keep it separate from the practical app UI.

**Section 1 — Hero**
- Nearly black background, centered large editorial headline, concise subheading, and `See the demo` CTA.
- Animated orange/copper ambient light or gradient **only inside this first hero section**. It appears as the hero enters view and fades out when the hero scrolls away.
- The rest of the site must **not** repeat the orange glow, rays, particles, or glass overlays.

**Section 2 — Product showcase**
- Solid black/charcoal background with a **large white dashboard** centered in a subtle computer/window frame.
- Tabs: `Brand dashboard` and `Customer dashboard`; switching tabs switches the preview.
- Brand preview: claims inbox/table + selected claim detail drawer.
- Customer preview: warranty cards with days remaining + claim tracking.
- Static previews are fine here; the **Launch interactive demo** CTA leads to the real connected demo pages.

**Section 3 — Feature stories**
- **No glassmorphism.** Use a confident editorial / soft-neubrutalist style: solid warm off-white or muted-color panels, crisp dark borders, generous spacing, strong typography.
- Include original **pencil/ink-style illustrations**, not emoji or shiny AI-looking icon tiles.
- Feature headlines could be: `NO MORE GOOGLE FORMS`, `STOP CHECKING ORDERS BY HAND`, `EVERY WARRANTY, ACCOUNTED FOR`, `CLAIMS IN ONE PLACE`, `CUSTOMERS KNOW WHAT'S NEXT`.
- Keep claims accurate: **do not advertise automatic emails as working in the current demo**.

### B. Customer screens (mobile-first)

**1. Brand registration page** — `/demo/[sessionId]/register/[brandSlug]/[productSlug]`
- Brand/product name and product image; clean, welcoming layout.
- Form: **Unit ID**, customer name, contact email (demo values okay).
- **Check unit** finds the unit and its associated brand/model/order; never ask for a customer-supplied delivery date.
- Show product name, order reference (masked if necessary), delivery date, and coverage end date once matched.
- **Register warranty** creates one registration and navigates to the customer's product card.
- Invalid unit → friendly error; already-registered unit → show existing card without creating a duplicate; undelivered unit → do not activate registration.

**2. Customer dashboard** — `/demo/[sessionId]/customer`
- Heading: `Your products, covered.` with `Register a product` action.
- Each registered unit gets a **product card** with photo, product name, unit ID, warranty badge, **large N days left**, expiry date, thin progress indicator, and `Raise a claim` button.
- Cards and remaining-day counts must come from the database and the current date, not hard-coded text.
- Show a `Recent claims` section linking to existing tracking pages.
- No account settings, password management, or email login.

**3. Raise claim** — `/demo/[sessionId]/customer/claims/new?unitId=...`
- Product/unit preselected from the card; automatically show warranty validity.
- Fields: issue title, description, optional photos (up to 3 for demo).
- **Submit claim** creates a unique claim reference with status `SUBMITTED` and redirects to a trackable claim page.
- If real file storage is not configured, use clearly labeled seeded sample attachments or omit photo upload; do not pretend a selected local image was uploaded.

**4. Track claim** — `/demo/[sessionId]/customer/claims/[claimId]`
- Claim ID, product, issue, submitted date, latest status, and a compact activity timeline.
- Statuses: `Submitted`, `In review`, `More information needed`, `Approved`, `Rejected`, `Resolved`.
- For `More information needed`, display the brand's question and let the customer reply in the same page; after replying, status returns to `In review`.
- This **same URL** displays subsequent changes. It does not require fresh email messages.

### C. Brand screens (desktop-first)

**5. Claims dashboard** — `/demo/[sessionId]/brand`
- Bright, minimal workspace: sidebar, search/filter row, claims table, unobtrusive status badges.
- Columns: claim ID, customer, product, unit ID, issue, warranty validity, claim status, submitted date.
- Filters: All, New, In review, Needs info, Approved, Rejected, Resolved.
- A new customer claim must appear here from the **same database**.
- Keep metrics simple or leave them out; prioritize the inbox workflow.

**6. Claim detail** — `/demo/[sessionId]/brand/claims/[claimId]`
- Show issue and photos, customer contact, **stamped unit ID**, linked **order ID**, product, trusted delivery date, warranty end date, remaining days, and claim history.
- Actions: **Mark in review**, **Approve**, **Reject** (require reason), **Ask for more information** (require a question), then optionally **Mark resolved** with repair/replacement outcome.
- Every action updates the claim and adds a dated activity event; changes appear in Customer view after navigation/refresh.
- **Approving a claim is not the same as shipping a replacement or resolving it.**

## 5. Exactly three simulated emails

We are **not sending emails** in this demo. Record three *notification previews* in the database and show them under an optional `Demo notifications` panel so the founder can understand what would be sent later.

| Trigger | Intended recipient | Preview subject | Contains |
|---|---|---|---|
| Warranty registered | Customer | `Your warranty is registered` | Product, unit, coverage dates |
| Claim submitted | Customer | `We received your warranty claim` | Claim ID and track-claim link |
| Claim submitted | Brand | `New warranty claim` | Claim ID and dashboard link only, no customer details |

**No email is generated on approval, rejection, or information requests in v0.1.** The customer checks the **same claim tracking page** for changes. The UI must not claim emails were sent; use the label **Preview — not sent**.

## 6. Database design (PostgreSQL + Prisma)

Use **PostgreSQL (Neon)** with **Prisma ORM**. One database is enough. Create these tables/models:

| Table | Key attributes (suggested types) | Purpose |
|---|---|---|
| `DemoSession` | `id UUID PK`, `createdAt timestamp`, `expiresAt timestamp?` | Isolated sample dataset and matching customer/brand views |
| `Brand` | `id UUID PK`, `demoSessionId UUID FK`, `name text`, `slug text`, `supportEmail text?` | Demo brand/workspace; unique `(demoSessionId, slug)` |
| `ProductModel` | `id UUID PK`, `brandId UUID FK`, `name text`, `slug text`, `sku text?`, `imageUrl text?`, `warrantyMonths int` | Product catalog and coverage policy; unique `(brandId, slug)` |
| `Customer` | `id UUID PK`, `demoSessionId UUID FK`, `name text`, `email text` | Fictional customer profile; unique `(demoSessionId, email)` |
| `PurchaseOrder` | `id UUID PK`, `brandId UUID FK`, `customerId UUID? FK`, `orderNumber text`, `orderedOn date?`, `deliveredOn date?` | Brand-trusted order and delivery information; unique `(brandId, orderNumber)` |
| `ProductUnit` | `id UUID PK`, `brandId UUID FK`, `productModelId UUID FK`, `purchaseOrderId UUID FK`, `serialNumber text`, `createdAt timestamp` | Unique physical unit linked to model + order; unique `(brandId, serialNumber)` |
| `WarrantyRegistration` | `id UUID PK`, `unitId UUID FK UNIQUE`, `customerId UUID FK`, `registeredAt timestamp`, `coverageStartsOn date`, `coverageEndsOn date` | One registration per unit; calculated coverage snapshot |
| `WarrantyClaim` | `id UUID PK`, `registrationId UUID FK`, `reference text UNIQUE`, `issueTitle text`, `description text`, `status enum`, `decisionReason text?`, `resolutionMethod enum?`, `submittedAt timestamp`, `updatedAt timestamp`, `resolvedAt timestamp?` | Main claim record and its current state |
| `ClaimAttachment` | `id UUID PK`, `claimId UUID FK`, `fileName text`, `mimeType text`, `storageKey text`, `sizeBytes int?`, `createdAt timestamp` | Optional evidence references; files live in object storage, not PostgreSQL |
| `ClaimMessage` | `id UUID PK`, `claimId UUID FK`, `senderRole enum`, `body text`, `createdAt timestamp` | Brand questions and customer replies |
| `ClaimEvent` | `id UUID PK`, `claimId UUID FK`, `actorRole enum`, `fromStatus enum?`, `toStatus enum?`, `note text?`, `createdAt timestamp` | Tracking timeline and audit trail |
| `DemoNotification` | `id UUID PK`, `demoSessionId UUID FK`, `type enum`, `recipientLabel text`, `subject text`, `previewBody text`, `relatedId UUID?`, `createdAt timestamp` | In-app preview of 3 intended emails; nothing is actually sent |

**Enums**

```ts
ClaimStatus =
  | 'SUBMITTED' | 'UNDER_REVIEW' | 'INFO_REQUESTED'
  | 'APPROVED' | 'REJECTED' | 'RESOLVED';
ActorRole = 'CUSTOMER' | 'BRAND' | 'SYSTEM';
ResolutionMethod = 'REPAIR' | 'REPLACEMENT';
NotificationType =
  | 'WARRANTY_REGISTERED' | 'CLAIM_SUBMITTED_CUSTOMER'
  | 'CLAIM_SUBMITTED_BRAND';
```

**Relationships**

```text
DemoSession 1 ──* Brand 1 ──* ProductModel
      │             ├──* PurchaseOrder 1 ──* ProductUnit
      ├──* Customer │                    ProductUnit *──1 ProductModel
      └──* DemoNotification                  │
              Customer 1 ──* WarrantyRegistration *──1 ProductUnit
                                        │
                                        └──* WarrantyClaim
                                               ├──* ClaimAttachment
                                               ├──* ClaimMessage
                                               └──* ClaimEvent
```

**Data integrity rules**

- **Unit ID is not order ID.** A serial is unique within its brand and points to exactly one order and product model.
- A unit can have **one warranty registration** and **multiple claims**.
- The order/model/unit must belong to the **same brand**, and the demo customer/brand must belong to the **same DemoSession**. Validate this in server-side code, including on writes.
- The registration start date is the order's **deliveredOn**; end date is start plus `warrantyMonths` **calendar months**, consistently defined as valid through the displayed expiry date.
- Display `daysRemaining = max(0, calendarDaysBetween(today, coverageEndsOn))`. Recalculate every render/request; **do not store daysRemaining** in the DB.
- Derive warranty status from the dates (`ACTIVE`, `EXPIRED`, `NOT_DELIVERED`), **not** from a claim status.
- Reject duplicate registration; an unknown ID or model mismatch must not create a new unit automatically.
- Apply strict server-side status transitions. Examples: `SUBMITTED → UNDER_REVIEW`, `UNDER_REVIEW → INFO_REQUESTED`, `INFO_REQUESTED → UNDER_REVIEW` on customer reply, `UNDER_REVIEW → APPROVED/REJECTED`, `APPROVED → RESOLVED` after repair/replacement. A rejected claim should not become resolved unless the business rules explicitly change later.
- `ClaimEvent` and `DemoNotification` should be created in the **same database transaction** as the action that triggers them.
- Index claim `status`, `submittedAt`, registration `unitId`, and unit `serialNumber`; always scope reads and writes by demo session.
- Real ownership checking (such as order-associated email verification) is a **production requirement**. A stamped unit ID alone is not robust proof of purchase or ownership.

## 7. Routes and API operations

| Route | What it does |
|---|---|
| `/` | Landing page (hero, tabbed showcase, feature stories) |
| `/demo` | Create/reset an isolated demo session and redirect to its starting page |
| `/demo/[sessionId]/register/[brandSlug]/[productSlug]` | Brand-provided product registration link |
| `/demo/[sessionId]/customer` | Warranty card dashboard |
| `/demo/[sessionId]/customer/claims/new` | New claim form (`unitId` query parameter) |
| `/demo/[sessionId]/customer/claims/[claimId]` | Claim status and reply page |
| `/demo/[sessionId]/brand` | Brand claim inbox |
| `/demo/[sessionId]/brand/claims/[claimId]` | Claim detail and decisions |
| `/demo/[sessionId]/notifications` | Preview-only notification list (optional) |

Suggested server/API actions (Next.js Server Actions or Route Handlers; either is fine):

- `createDemoSession()` → session ID and seeded dataset.
- `findEligibleUnit(sessionId, brandSlug, productSlug, serialNumber)` → safe, limited match data.
- `registerWarranty(sessionId, unitId, customerInput)` → persisted registration + notification preview.
- `listCustomerProducts(sessionId, customerId)` → cards with computed coverage state.
- `submitClaim(sessionId, registrationId, issueTitle, description, attachmentKeys[])` → claim + two notification previews.
- `listBrandClaims(sessionId, brandId, filters)` → table rows.
- `getClaim(sessionId, claimId, view)` → linked unit/order/registration/events.
- `changeClaimStatus(sessionId, claimId, action, note?)` → validated transition + event.
- `replyToInfoRequest(sessionId, claimId, reply)` → message + transition + event.
- `resetDemoSession(sessionId)` → reseed only the chosen fictional session.

**Important:** Do not trust `brandId`, `customerId`, or a requested claim ID merely because the client sent it. Check the associated session/brand/unit relationships on the server.

## 8. Seed dataset (fictional)

Create at least one demo session with a fictional brand **Kestrel Audio** and customer **Aarav Demo** (`aarav@example.test`). Suggested records:

| Serial number | Product | Order | Delivered | Initial state |
|---|---|---|---|---|
| `KST-10482` | Kestrel Pro Headphones | `ORD-201` | 2026-10-05 | Unregistered — use for live registration |
| `KST-10483` | Kestrel Pro Headphones | `ORD-202` | 2026-09-12 | Registered, active |
| `KST-20511` | Kestrel Charge 20K | `ORD-203` | 2026-08-20 | Registered, active |
| `KST-30909` | Kestrel Pro Headphones | `ORD-204` | 2026-10-08 | Registered, with sample in-review claim |

Apply **36 months** coverage to these demo products. All dates/remaining days must be computed from actual fixture data and the running date; do not put fixed remaining-day numbers in JSX. Seed some claim events and attachments for the existing sample claim.

Use coherent branded product photography or polished illustrations without copying JB Air's assets.

## 9. Interactive walkthrough for Shiv (about 2–3 minutes of clicks)

1. Open the website. Show the hero briefly, then scroll to the **white brand/customer dashboard previews**; switch between the two tabs.
2. Click **Launch interactive demo**, then **Register a product** in Customer view.
3. Explain: "This is the link your customer would get from the brand." Enter `KST-10482`, show the matched order/coverage, and register.
4. Go to the Customer dashboard: show the **new warranty card** and days left.
5. Click **Raise a claim**, enter `Left earcup has stopped working` with a short description, and submit. Show the claim ID and tracking page.
6. Open **Brand view** in another tab. The exact new claim appears with its unit ID, order ID, and valid warranty, without manually hunting for them.
7. Click **Ask for more information** or **Approve**. Return to the same Customer tracking link and show its updated status. If asking for information, reply as the customer and show the claim return to review.
8. Optionally open **Demo notifications** to show the three preview templates and say: "In this prototype, nothing is actually emailed. We can wire that up after validating the flow."
9. Ask Shiv where the unit-to-order mapping currently lives and whether this workflow would actually save time versus his email/WhatsApp process.

**How to present it:** "This is a rough interactive prototype using fictional data. The registration and claims flow works across the customer and brand screens; email delivery and account logins are intentionally not connected yet."

## 10. Tech stack and local setup

Use the planned existing Vouch stack:

- **Next.js 15** (App Router), **TypeScript**, **Tailwind CSS**, **shadcn/ui**.
- **Prisma** + **PostgreSQL on Neon** for demo sessions, brands, units, warranties, and claims.
- Date handling: consistent date-only semantics for deliveries and expiry (e.g. `date-fns` utilities plus explicit timezone choices).
- Optional private object storage for real claim photos; **do not store image files inside relational table columns**.
- **No NextAuth, OAuth secrets, Resend, SMTP, WhatsApp API, or SMS provider** for this demo.

Example environment file:

```dotenv
DATABASE_URL="postgresql://..."
# Only if implementing actual uploaded claim files:
# OBJECT_STORAGE_...="..."
```

Typical development steps after implementing the schema and routes:

```bash
npm install
npx prisma migrate dev --name init_vouch_demo
npx prisma db seed
npm run dev
```

Keep sample data resettable and the seed idempotent. For deployment, use persistent Postgres (not in-memory state); otherwise changes won't carry from Customer to Brand across requests. Never publish the `.env` file.

## 11. Build order and definition of done

**Build order**
1. Set up DB schema, fictional seed, and `/demo` session creator.
2. Build customer product registration and warranty card with real countdown.
3. Build claim submission, persisted claim records, and customer tracking page.
4. Build brand claims table, claim detail, and status changes.
5. Build optional seeded photos, message/reply support, and three simulated notification previews.
6. Polish both dashboard UIs and the marketing landing page; connect the interactive demo CTA.

**Done when all checks pass**

- [ ] A fresh demo link generates isolated sample data with no sign-in.
- [ ] A brand-specific registration URL accepts a seeded unit ID and rejects random IDs.
- [ ] Registering a unit creates **exactly one** product warranty card.
- [ ] The card displays the actual expiry and recalculated days remaining.
- [ ] A submitted claim appears in Brand view **with the linked order and valid warranty**.
- [ ] Brand decisions show on the **same Customer tracking URL** (refresh allowed).
- [ ] Asking for more information and the customer reply work end to end.
- [ ] Exactly three **unsent** email previews are created at the designated triggers.
- [ ] No email is actually sent; no login/password/OAuth flow is required.
- [ ] Reset demo lets the founder repeat the entire journey safely.
- [ ] No real customer data or unauthorized brand assets appear in the demo.
- [ ] Landing page has orange ambient glow **only in the hero**, a black showcase section with a white dashboard and switching tabs, and **solid, non-glass** illustrated feature cards.

## 12. Explicitly out of scope (not forgotten)

Brand logins and roles; customer accounts and email verification; real email delivery; SMS or WhatsApp integration; CSV upload and ecommerce integrations; analytics; billing; AI support; QR codes; automated repairs/replacements; real shipment tracking; advanced warranty exceptions; multi-agent assignment; verified production-grade access to customer records.

**Goal of v0.1:** Demonstrate that a registered unit becomes a tracked warranty card, and a claim becomes an actionable brand ticket **without rechecking product/order/warranty information by hand**. Validate that workflow with a real founder *before* building all the integrations.






## Business Dashboard — Design Rules

The business dashboard should feel extremely simple, professional and operational.

Use the attached references as the visual direction: **clean SaaS software, not a flashy startup dashboard.**

### Visual style

- Light/off-white background.
- Mostly black, white and neutral gray.
- One restrained Vouch accent color only where necessary.
- No gradients.
- No glassmorphism.
- No decorative effects.
- No random colored cards.
- No emojis.
- No illustrations inside the actual dashboard.
- No oversized marketing-style headings.
- No unnecessary charts or KPI cards.
- Use one consistent modern sans-serif font throughout the application.
- Small, subtle borders instead of heavy shadows.
- Consistent spacing and corner radius.

The dashboard should feel closer to **Intercom, Linear, Stripe or Tella** than a generic admin-dashboard template.

### Left navigation

The sidebar should be especially clean.

Vouch logo at the top.

Navigation:

Dashboard  
Claims  
Products  
Customers

Settings near the bottom.

Use simple monochrome line icons beside navigation items.

The active item should use a very subtle background or indicator. Do not turn the entire item into a brightly colored button.

Keep the sidebar narrow, spacious and visually quiet.

### Dashboard content

Prioritize actual work over analytics.

The main dashboard should immediately show things such as:

**Recent claims**

Customer | Product | Issue | Warranty | Status | Date

and

**Recently registered products**

Customer | Product | Unit ID | Registered | Warranty remaining

Do not fill the page with fake metrics just because there is empty space.

### Claims

The Claims page should behave like a clean inbox/table.

Filters at the top:

All · New · In Review · Approved · Rejected · Resolved

Clicking a claim should open either a clean detail page or side panel containing:

- Customer
- Product
- Unit ID
- Order ID
- Warranty status
- Issue description
- Customer-uploaded photos
- Claim history

Actions:

**Approve** · **Ask for more info** · **Reject**

### Products

The Products page lets the brand:

- Add a product.
- Set its warranty duration.
- Upload a product image.
- View registered units.
- Copy its warranty registration link.

Example:

`Vouch / JB Air Pro`

Warranty: 3 years  
Registered units: 684

**Copy registration link**

The brand can place this link on its website, packaging, documentation or customer communication.

### Overall principle

The landing page can be expressive.

The dashboard should not be.

**Landing page = brand personality.**

**Business dashboard = software that gets out of the user's way.**

Every component in the business dashboard should exist because the brand needs it to register products, inspect warranties or process claims.