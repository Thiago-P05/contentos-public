/**
 * Branding is deliberately not baked into the components. Self-hosters set
 * NEXT_PUBLIC_APP_NAME to their own name and the sidebar picks it up — no fork
 * or patch needed. The accent colour lives in `--brand` in globals.css.
 *
 * NEXT_PUBLIC_* values are inlined into the client bundle at build time, not
 * read at runtime. Set this before `pnpm build`, or rebuild after changing it —
 * exporting it only for `pnpm start` has no effect.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Acme";
