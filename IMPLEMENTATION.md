# AKCELPE Insights: implementation guide

Static HTML, CSS and vanilla JS. No framework, no build step on the server, no CMS. It matches the live site's stack (hand-written `.html` pages).

## Routes created

| Route | File | Purpose |
|---|---|---|
| `/insights/` | `insights/index.html` | Listing: hero, featured article, search, category filters, pagination, research links |
| `/blog/what-is-rwa/` | `blog/what-is-rwa/index.html` | Article template carrying the first article |

Canonicals are `https://akcelpe.com/insights/` and `https://akcelpe.com/blog/what-is-rwa/`. The live site currently uses `name.html` URLs. These two routes need the host to serve a folder's `index.html`. If it can't, rename to `insights.html` and `blog/what-is-rwa.html` and update the canonicals, `og:url`, share links and `url` fields in `_source/src/articles.json`.

## Opening and hosting

Asset links (CSS, JS, images) are **relative**, so the pages are styled whether you double-click `insights/index.html`, host the folder anywhere, or deploy at the site root. Links to the rest of akcelpe.com (`/ecosystem.html`, `/rwa-global.html`, etc.) are root-relative on purpose and only resolve on the live domain, so they will not work from a double-clicked local copy.

## Files

```
assets/css/insights.css            design tokens + every component (single file)
assets/js/insights.js              search, filters, pagination, TOC highlight, share/copy, related articles
assets/js/articles-data.js         GENERATED article index read by the browser
assets/img/akcelpe-logo-brand.png  the supplied logo, untouched
assets/img/akcelpe-logo-brand-trim.png   same artwork, empty canvas trimmed (no recolouring or redrawing)
assets/img/insights/what-is-rwa-cover.svg   16:9 feature image (original diagram)
assets/img/insights/what-is-rwa-og.png      1200x630 social image
insights/index.html, blog/what-is-rwa/index.html   deployable pages
_source/                           partials + build.py that generate the two pages
```

Only the first five groups above and the two pages need deploying. `_source/` is optional.

## Adding an article

1. Add an entry to `_source/src/articles.json` (slug, url, title, subtitle, summary, categories, dates, image, alt text).
2. Create the article page from `_source/src/article.html` + a body partial (the build currently has one article hard-wired; generalising it to a loop is a small change).
3. Run `python3 _source/build.py`. It recomputes reading time, the table of contents, citations, FAQ and Article structured data, and regenerates `articles-data.js`.

Pagination appears automatically past 9 articles. The featured article is whichever entry has `"featured": true`.

## Integration steps needed from you

1. **Header, footer and tokens.** I could not read the live stylesheet (the sandbox could only reach HTML, not CSS files). The header and footer replicate the live navigation links and legal text, but their styling is an approximation. Replace both with the site's own partials/classes, and map the `:root` tokens at the top of `insights.css` to the site's existing variables. Tokens use the palette from your brief.
2. **Add Insights to navigation.** The pages add an "Insights" link under Group, after Research Centre, and in the footer. Add the same link to the shared header/footer on the rest of the site.
3. **Sitemap and robots.** Add both URLs to `sitemap.xml`; the human sitemap page currently lists Blog/Insights as "not built".
4. **Favicon.** Pages link `/favicon.ico`; confirm it exists.

## Decisions to confirm

- **Article copy.** The supplied copy was not included, so I drafted the article from your outline. Facts come only from the primary sources listed in the article (FSB, IOSCO, BIS, FCA, Dubai Land Department, EUR-Lex, HM Land Registry). It contains no yields, returns, approvals or product claims. Replace or review against your copy before publishing.
- **Author and dates.** Byline is "AKCELPE Editorial Team" and the date is 15 October 2026. Both are placeholders for your approved name and actual publication date (also in the structured data).
- **Imagery.** I had no photography. The feature image is a restrained original diagram. Swap in licensed real-estate or infrastructure photography when available (16:9, update alt text).
- **FCA Digital Securities Sandbox** (source 8). The page would not load during checking, so that mention is limited to what the Research Centre says. Please check it.
- **Newsletter.** Omitted, as the site has no configured subscription mechanism.

## What was tested

Run in headless Chromium against a local server, at 1440, 820, 390 and 320 px:
- Table-of-contents anchors scroll and highlight; copy-link writes the canonical URL to the clipboard; FAQ accordions open; no duplicate IDs, broken anchors or console errors; no horizontal overflow.
- Listing search, category filters, pagination, URL deep links, empty state, reset and error state. These were exercised with temporary 14-article test data that is not in the project.
- Text/background colour pairs all meet WCAG AA (4.5:1). The brand grey #777 and green #30B040 do not at small sizes, so neither is used for text. Skip link, focus outlines, alt text, form labels and landmarks verified.
- One H1 per page; Article, Breadcrumb and FAQ structured data parse as valid JSON-LD.

Not done: deployment, publication, CMS connection, a full axe-core audit (package registry unreachable), real-device testing, and a Lighthouse speed run. Run these on the staging site.
