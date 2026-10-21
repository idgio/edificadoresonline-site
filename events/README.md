# Awake event site

Standalone Astro site for a separate Cloudflare Pages project at `awake.edificadoresonline.com`. The content in `src/pages/index.astro` has placeholder date, time, location, and registration details; update them before announcing the event.

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
