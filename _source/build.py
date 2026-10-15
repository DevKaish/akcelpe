#!/usr/bin/env python3
"""Assemble the static Insights pages from partials. Output is plain HTML."""
import json, math, re, html
from html.parser import HTMLParser
from pathlib import Path
from datetime import date

SRC = Path(__file__).parent / "src"
OUT = Path(__file__).parent.parent
data = json.loads((SRC / "articles.json").read_text())
SITE = data["site"]
cats = {c["slug"]: c["label"] for c in data["categories"]}
art = data["articles"][0]

esc = lambda s: html.escape(s, quote=True)

def human(iso):
    d = date.fromisoformat(iso)
    return f"{d.day} {d.strftime('%B %Y')}"

# ---------- body ----------
body = (SRC / "article-body.html").read_text()

def cite(m):
    nums = [n.strip() for n in m.group(1).split(",")]
    links = ", ".join(f'<a href="#src-{n}" aria-label="Source {n}">{n}</a>' for n in nums)
    return f'<sup class="cite">[{links}]</sup>'
body = re.sub(r"\[\[([\d,\s]+)\]\]", cite, body)

class Text(HTMLParser):
    def __init__(self): super().__init__(); self.t = []
    def handle_data(self, d): self.t.append(d)
def plain(fragment):
    p = Text(); p.feed(fragment); return re.sub(r"\s+", " ", "".join(p.t)).strip()


def label_tables(h):
    """Add data-label attributes so tables can stack into labelled rows on phones."""
    def one(m):
        tbl = m.group(0)
        heads = [plain(x) for x in re.findall(r'<th scope="col">(.*?)</th>', tbl, flags=re.S)]
        head, _, tb = tbl.partition("<tbody>")
        def row(rm):
            idx = [0]
            def cell(cm):
                tag, attrs, inner = cm.group(1), cm.group(2), cm.group(3)
                lab = heads[idx[0]] if idx[0] < len(heads) else ""
                idx[0] += 1
                if tag == "th":
                    return "<th%s>%s</th>" % (attrs, inner)
                return '<td data-label="%s"%s>%s</td>' % (html.escape(lab), attrs, inner)
            return re.sub(r"<(td|th)([^>]*)>(.*?)</(?:td|th)>", cell, rm.group(0), flags=re.S)
        tb = re.sub(r"<tr>.*?</tr>", row, tb, flags=re.S)
        return head + "<tbody>" + tb
    return re.sub(r"<table>.*?</table>", one, h, flags=re.S)
body = label_tables(body)

words = len(plain(body).split())
read_min = max(1, math.ceil(words / 220))
art["readingMinutes"] = read_min

# TOC (h2 only)
toc_items = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body, flags=re.S)
def toc_label(t):
    t = plain(t)
    return {"Introduction: why RWA matters in digital finance": "Introduction"}.get(t, t)
toc = "\n".join(f'              <li><a href="#{i}">{html.escape(toc_label(t))}</a></li>' for i, t in toc_items)

# FAQ pairs for structured data (taken from the visible FAQ only)
faq = []
for m in re.finditer(r"<details>\s*<summary>(.*?)</summary>\s*<div class=\"faq__a\">(.*?)</div>\s*</details>", body, flags=re.S):
    faq.append((plain(m.group(1)), plain(m.group(2))))
assert len(faq) >= 5, "FAQ not parsed"

# ---------- share ----------
canon = f"{SITE}{art['url']}"
from urllib.parse import quote
q = lambda s: quote(s, safe="")
share = f'''          <div class="share" data-share>
            <a href="https://www.linkedin.com/sharing/share-offsite/?url={q(canon)}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn (opens in a new tab)">LinkedIn</a>
            <a href="https://twitter.com/intent/tweet?url={q(canon)}&amp;text={q(art['title'])}" target="_blank" rel="noopener noreferrer" aria-label="Share on X (opens in a new tab)">X</a>
            <a href="https://wa.me/?text={q(art['title'] + ' ' + canon)}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp (opens in a new tab)">WhatsApp</a>
            <a href="mailto:?subject={q(art['title'])}&amp;body={q(canon)}" aria-label="Share by email">Email</a>
            <button type="button" data-copy-link><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11"/><path d="M5 15V5h10"/></svg>Copy link</button>
            <button type="button" data-native-share hidden>Share&hellip;</button>
            <p class="share-status" role="status" aria-live="polite"></p>
          </div>'''

# ---------- JSON-LD ----------
def ld(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

og_image = f"{SITE}/assets/img/insights/what-is-rwa-og.png"
logo_url = f"{SITE}/assets/img/akcelpe-logo-brand.png"
publisher = {"@type": "Organization", "name": "AKCEL Group", "url": SITE + "/",
             "logo": {"@type": "ImageObject", "url": logo_url}}

article_ld = {"@context": "https://schema.org", "@graph": [
    {"@type": "BlogPosting", "@id": canon + "#article",
     "mainEntityOfPage": {"@type": "WebPage", "@id": canon},
     "headline": art["title"], "description": art["summary"], "alternativeHeadline": art["subtitle"],
     "image": [og_image], "datePublished": art["datePublished"], "dateModified": art["dateModified"],
     "author": {"@type": "Organization", "name": "AKCELPE Editorial Team", "url": SITE + "/"},
     "publisher": publisher, "inLanguage": "en-GB", "articleSection": cats[art["categories"][0]],
     "keywords": "real-world assets, RWA, tokenisation, tokenization, digital finance",
     "wordCount": words, "isAccessibleForFree": True},
    {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Insights", "item": SITE + "/insights/"},
        {"@type": "ListItem", "position": 3, "name": "What Is RWA?", "item": canon}]},
    {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": qn, "acceptedAnswer": {"@type": "Answer", "text": an}} for qn, an in faq]},
]}

listing_url = SITE + "/insights/"
listing_ld = {"@context": "https://schema.org", "@graph": [
    {"@type": "CollectionPage", "@id": listing_url, "url": listing_url, "name": "Insights & Perspectives",
     "description": "Educational articles from AKCELPE on real-world assets, tokenisation, real estate, digital finance and investor risk.",
     "inLanguage": "en-GB", "isPartOf": {"@type": "WebSite", "name": "AKCELPE", "url": SITE + "/"},
     "mainEntity": {"@type": "ItemList", "itemListElement": [
         {"@type": "ListItem", "position": i + 1, "url": SITE + a["url"], "name": a["title"]}
         for i, a in enumerate(data["articles"])]}},
    {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Insights", "item": listing_url}]},
]}


def localize(page, prefix):
    """Make asset links relative to the page so it works from file://, a subfolder, or the site root."""
    return re.sub(r'(href|src)="/assets/', lambda m: '%s="%sassets/' % (m.group(1), prefix), page)

# ---------- header/footer ----------
header_t = (SRC / "header.html").read_text()
footer = (SRC / "footer.html").read_text()
hdr_listing = header_t.replace("{{AC_GROUP}}", ' aria-current="page"').replace("{{AC_INSIGHTS}}", ' aria-current="page"')
hdr_article = header_t.replace("{{AC_GROUP}}", ' aria-current="page"').replace("{{AC_INSIGHTS}}", "")

# ---------- article page ----------
meta_desc = "A beginner's guide to real-world assets (RWA): how tokenisation works, potential benefits, key risks and what to verify before evaluating any product."
meta_title = "What Is RWA? Real-World Assets & Tokenisation Explained | AKCELPE"
page = (SRC / "article.html").read_text()
subs = {
    "META_TITLE": esc(meta_title), "META_DESC": esc(meta_desc), "CANON": canon, "TITLE_ATTR": esc(art["title"] if False else meta_title.split(" | ")[0]),
    "OG_IMAGE": og_image, "IMG_ALT": esc(art["imageAlt"]), "DATE_PUB": art["datePublished"], "DATE_MOD": art["dateModified"],
    "CAT_PRIMARY": esc(cats[art["categories"][0]]), "CAT_PRIMARY_SLUG": art["categories"][0],
    "TITLE": esc(art["title"]).replace("Real-World", '<span style="white-space:nowrap">Real-World</span>'), "SUBTITLE": esc(art["subtitle"]), "DATE_HUMAN": human(art["datePublished"]),
    "READ_MIN": str(read_min), "IMG": art["image"], "TOC": toc, "SHARE": share, "BODY": body, "SLUG": art["slug"],
    "JSONLD": ld(article_ld), "HEADER": hdr_article, "FOOTER": footer,
}
for k, v in subs.items():
    page = page.replace("{{" + k + "}}", v)
assert "{{" not in page, re.findall(r"\{\{[A-Z_]+\}\}", page)
(OUT / "blog/what-is-rwa").mkdir(parents=True, exist_ok=True)
(OUT / "blog/what-is-rwa/index.html").write_text(localize(page, "../../"))

# ---------- listing page ----------
chips = ['          <button type="button" class="chip" data-cat="" aria-pressed="true">All</button>']
for c in data["categories"]:
    chips.append(f'          <button type="button" class="chip" data-cat="{c["slug"]}" aria-pressed="false">{esc(c["label"])}</button>')

def card(a):
    return f'''        <li><article class="card">
          <div class="card__media"><img src="{a['image']}" alt="{esc(a['imageAlt'])}" width="1600" height="900" loading="lazy"></div>
          <div class="card__body">
            <span class="tag">{esc(cats[a['categories'][0]])}</span>
            <h3 class="card__title"><a href="{a['url']}">{esc(a['title'])}</a></h3>
            <p class="card__summary">{esc(a['summary'])}</p>
            <p class="meta"><span>{human(a['datePublished'])}</span><span>{a['readingMinutes']} min read</span></p>
          </div>
        </article></li>'''

# no-JS fallback lists every published article; JS replaces it
nojs = "\n".join(card(a) for a in data["articles"])
lst = (SRC / "listing.html").read_text()
lsubs = {
    "JSONLD": ld(listing_ld), "HEADER": hdr_listing, "FOOTER": footer, "CHIPS": "\n".join(chips), "NOSCRIPT_CARDS": nojs,
    "F_URL": art["url"], "F_IMG": art["image"], "F_CAT": esc(cats[art["categories"][0]]), "F_TITLE": esc(art["title"]),
    "F_SUBTITLE": esc(art["subtitle"]), "F_DATE": human(art["datePublished"]), "F_READ": str(read_min),
}
for k, v in lsubs.items():
    lst = lst.replace("{{" + k + "}}", v)
assert "{{" not in lst, re.findall(r"\{\{[A-Z_]+\}\}", lst)
(OUT / "insights").mkdir(parents=True, exist_ok=True)
(OUT / "insights/index.html").write_text(localize(lst, "../"))

# ---------- shared data for the browser ----------
js = "/* Generated from articles.json. Edit the data source, then rebuild. */\nwindow.AKCEL_ARTICLES = " + json.dumps(
    {"categories": data["categories"], "articles": data["articles"]}, ensure_ascii=False, indent=2) + ";\n"
(OUT / "assets/js/articles-data.js").write_text(js)

print(f"words={words} read_min={read_min} faq={len(faq)} toc={len(toc_items)} desc_len={len(meta_desc)} title_len={len(meta_title)}")
