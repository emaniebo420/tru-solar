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
│   ├── landing.css         # Styles for index.html
│   └── calculator.css      # Styles for calculator.html
├── js/
│   ├── landing.js          # Behavior for index.html (FAQ, tabs, contact form)
│   └── calculator.js       # Wizard state machine + proposal calculations
├── assets/
│   └── favicon.svg
├── robots.txt
├── sitemap.xml
└── README.md
```

CSS and JS are split per-page rather than shared, since `index.html` and
`calculator.html` use slightly different design tokens (`:root` variables).
Keeping them separate avoids accidentally changing one page's look while
editing the other.

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

- `robots.txt` and `sitemap.xml` reference a placeholder domain
  (`https://www.trusolar.ph`). Update these once a production domain is
  finalized.
- This is proprietary business content for TruSolar, not an open-source
  project, so no license file is included.
