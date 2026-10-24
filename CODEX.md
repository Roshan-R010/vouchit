# Codex — Customer Side

Build the customer-facing part of the Vouch v0.1 interactive demo described in `vouch.md`. Work in the existing Next.js 15 / TypeScript / Tailwind / shadcn app and share its Prisma + PostgreSQL data with the brand side. Keep changes within customer routes and shared server/data code needed for the agreed contract; coordinate shared schema decisions in `vouch.md` before changing them.

## Own
- `/demo` session entry/reset flow as needed, plus the customer registration, product dashboard, new claim, and claim tracking screens.
- Mobile-first customer UX: register a stamped unit ID, show trusted order delivery/coverage details, view warranty days remaining, submit and track a claim, and reply to an information request.
- Persist all changes through the shared database and session-scoped server actions/handlers. Customer registration must not set delivery dates or restart coverage.

## Shared integration contract
- Use the same `DemoSession` and records as Antigravity’s brand view; customer and brand URLs share the same session ID.
- Follow the models, statuses, transitions, routes, fictional seed data, and demo boundaries in `vouch.md`. Scope every read/write by session; validate relationships server-side.
- Claim submission creates a `SUBMITTED` claim and the specified two unsent notification previews. Registration creates its one unsent preview. No actual email, login, OAuth, or WhatsApp.
- Keep status changes visible at the same tracking URL after refresh. Use the shared claim events/activity history; do not fake state with unrelated static screens.
- Do not use real customer data or JB Air branding/assets without permission. Label the experience as a demo.

## Done
Customer flows work against persisted shared demo data and meet the relevant `vouch.md` acceptance checks. Keep the implementation focused; defer production accounts, delivery integrations, and unrelated polish.
