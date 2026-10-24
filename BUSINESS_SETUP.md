# Business workspace

Open `/demo?view=brand`, or use **Brand view** from a customer demo. The same browser resumes its last workspace. Keep the session URL when sharing between tabs.

1. Open **Products → Add product**. Set the product name, optional SKU/photo, and warranty in months.
2. Add the first unit's stamped ID, order reference, and recorded delivery date. You can add more units later. Undelivered units become eligible after **Record delivery**.
3. Save the product and copy its registration link. The customer sees the saved image and warranty policy, checks their unit, and registers it.
4. The product then appears on the customer dashboard with remaining warranty days. Claims submitted there appear in **Claims**, and business decisions appear at the same customer tracking URL.

Brand name and support email can be edited under **Settings**. Existing registration links remain stable. Warranty duration edits affect future registrations; existing coverage snapshots stay intact.

Images are real PNG/JPEG/WebP uploads (up to 5 MB), and product records store the image URL rather than image bytes. When `SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY` are configured, Vouch creates a public `product-images` bucket when needed and stores uploads there. Without those values, development uploads fall back to `.vouch/uploads` and survive app restarts on this computer. Public HTTPS image URLs also work.

The existing Prisma schema supports these features; no new tables or migration are required. Sessions remain an unauthenticated demo using fictional customer identities. **Reset demo** replaces that session's products, units, registrations, and claims with the sample dataset.
