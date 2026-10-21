# Awake event site

Standalone Astro site for a separate Cloudflare Pages project at `awake.edificadoresonline.com`. The event is November 14, 2026 at 5:30 p.m. at Templo Edificadores.

## Post-event reveal

The GE LIFE, GE LIGHT, and GE LEAD sections and the leader section are intentionally absent from the public page and build. Publish them no earlier than November 15, 2026, after the event reveal. This static site requires a new deployment to show them. The original group names and descriptions are in the supplied GE Brand Book; get approved leader names and a real team photo before adding the leader section.

The public FAQ uses “Pronto compartiremos más detalles” as placeholder copy for “¿Qué pasará esa noche?”. Replace it with approved copy when available.

## Local development

Use Node 22 (`nvm use` reads `.nvmrc`), then run `npm install` and `npm run dev` from this folder. `npm run build` writes the static site to `dist/`.

## Cloudflare Pages with Git integration

- Repository: `idgio/edificadoresonline-site`
- Create a **Pages** project, for example `edificadoresonline-awake`.
- Production branch: `events-deployment` (created from `main` after committing this folder, then pushed to GitHub).
- Root directory (advanced): `events`.
- Framework preset: `Astro`.
- Build command: `npm run build`
- Build output directory: `dist`.
- Optional build watch include path: `events/*`.

The `events` root directory makes Pages build only this Astro project, and `dist` makes it publish only its generated files. After the first deployment works at its `pages.dev` URL, open the Pages project's **Custom domains > Set up a domain** and enter `awake.edificadoresonline.com`. If `edificadoresonline.com` DNS is managed in the same Cloudflare account, confirm the CNAME record Cloudflare proposes. If DNS is managed elsewhere, create a CNAME for `awake` pointing to the project's `pages.dev` hostname after adding the domain in Pages.
