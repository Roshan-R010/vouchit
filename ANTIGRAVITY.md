# Antigravity — Brand Side

Build the brand-facing part of the Vouch v0.1 interactive demo described in `vouch.md`. Work in the existing Next.js 15 / TypeScript / Tailwind / shadcn app and share its Prisma + PostgreSQL data with Codex’s customer side. Keep changes within brand routes and brand UI; coordinate shared schema decisions in `vouch.md` before changing them.

## Own
- Brand claims inbox/dashboard and claim detail/actions; add other brand workspace screens only as needed for the demo’s core workflow.
- Desktop-first operational UI: clear claims table and filters, then show customer, product, stamped unit ID, linked order, trusted delivery/coverage dates, warranty state, issue/evidence, and claim history.
- Support valid review, approve, reject (reason required), request-information (question required), and resolve-after-approval actions. Persist each transition and dated event.

## Shared integration contract
- Use the same `DemoSession` and records as Codex’s customer view; both URLs share the same session ID and database state.
- Follow models, statuses, transitions, routes, fictional seed data, and demo boundaries in `vouch.md`. Scope every read/write by session; validate relationships server-side.
- Customer-submitted claims must appear here with linked order and warranty data. Brand changes must show on the same customer tracking URL after refresh.
- Claim submission’s brand notification is an unsent preview only. No actual email, login, OAuth, or WhatsApp.
- Keep the business dashboard restrained: light neutral UI, one quiet accent, no gradients, glass effects, decorative illustrations, emoji, or invented KPI cards. Do not use real customer data or unauthorized brand assets.

## Done
Brand review/actions persist to the shared data, appear in customer tracking, and meet the relevant `vouch.md` acceptance checks. Keep implementation focused on the founder demo.
