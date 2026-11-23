# TruSolar

Marketing site and solar proposal calculator for TruSolar, a residential and
commercial solar design & installation company in the Philippines.

The site is a static, build-free HTML/CSS/JS project — no framework, no
bundler, no backend. It can be served from any static file host (or opened
directly in a browser) with no setup beyond the files in this repo.

## Pages

- **`index.html`** — Landing page: hero, residential/commercial overview,
  "how it works", solar savings calculator promo, ROI comparison, project
  gallery, testimonials, FAQ, and a contact form.
- **`calculator.html`** — "Solar Design Studio": a 5-step wizard that asks
  for property type, electricity usage, project type, and address, then
  generates an instant proposal (system size, monthly/lifetime savings,
  payback period, and a pricing breakdown).

## Project structure

```
.
├── index.html              # Landing page markup
├── calculator.html         # Solar Design Studio wizard markup
├── css/
│   ├── base.css            # Design tokens, fonts, reset, buttons, header (all pages)
│   ├── landing.css         # Styles for index.html
│   └── calculator.css      # Styles for calculator.html
├── js/
│   ├── model.js            # Sizing, savings and pricing model (single source of truth)
│   ├── landing.js          # Nav, tabs, example card, ROI section, contact form
│   └── calculator.js       # Wizard state machine and rendering
├── assets/
│   ├── favicon.svg
│   ├── og-image.png        # Social sharing preview (1200x630)
│   └── fonts/              # Self-hosted Inter and Sora (variable woff2)
├── robots.txt
├── sitemap.xml
└── README.md
```

Both pages share `css/base.css` so colours, type and buttons cannot drift apart.
Every number shown on the site (calculator, homepage example card, savings
projection) comes from `js/model.js`. To change pricing, offset or yield
assumptions, edit the `CONFIG` object at the top of that file.

## Running locally

No build step is required. Serve the directory with any static file server,
for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

## Contact form

The contact form on `index.html` opens the visitor's email client via a
`mailto:` link pre-filled with their submitted details, addressed to
`trusolarph@gmail.com`. There is no backend — submissions are not stored or
processed server-side.

## Notes

- `robots.txt`, `sitemap.xml`, the canonical links and the Open Graph URLs point
  at the Vercel address (`https://tru-solar.vercel.app/`).
  Update them once a custom domain is connected.
- This is proprietary business content for TruSolar, not an open-source
  project, so no license file is included.
