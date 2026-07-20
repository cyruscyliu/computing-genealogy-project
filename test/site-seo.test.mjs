import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const siteUrl = "https://cyruscyliu.github.io/computing-genealogy-project/";
const verificationToken = "uhY_iMR2ujA2nMscHcO282oSXovOn9GHkbaRBZMxJVI";

async function readHomepage() {
  return readFile(new URL("../site/index.html", import.meta.url), "utf8");
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map((match) =>
    JSON.parse(match[1]),
  );
}

test("homepage retains canonical, Google verification, and factual structured data", async () => {
  const html = await readHomepage();
  assert.ok(html.includes(`<link rel="canonical" href="${siteUrl}" />`));
  assert.ok(html.includes(`<meta name="google-site-verification" content="${verificationToken}" />`));

  const blocks = jsonLdBlocks(html);
  const website = blocks.find((block) => block["@type"] === "WebSite");
  const dataset = blocks.find((block) => block["@type"] === "Dataset");

  assert.deepEqual(website, {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Computing Genealogy Explorer",
    alternateName: "Computing Genealogy Project",
    description:
      "Explore computer science academic genealogy: PhD advisors, students, institutions, and lineage networks across security research.",
    url: siteUrl,
    inLanguage: "en",
  });
  assert.equal(dataset?.name, "Computing Genealogy Explorer Dataset");
  assert.equal(dataset?.url, siteUrl);
  assert.equal(dataset?.isAccessibleForFree, true);
  assert.equal(
    dataset?.distribution?.contentUrl,
    `${siteUrl}data/generated/lineage-dataset.json`,
  );
});

test("sitemap exposes every canonical public page", async () => {
  const sitemap = await readFile(new URL("../site/sitemap.xml", import.meta.url), "utf8");
  for (const page of ["", "faq.html", "missing-profiles.html"]) {
    assert.ok(sitemap.includes(`<loc>${siteUrl}${page}</loc>`));
  }
});

test("local lineage tab precedes the overview graph tab", async () => {
  const html = await readHomepage();
  assert.ok(html.indexOf('id="graphTabLocalLineage"') < html.indexOf('id="graphTabForce"'));
});

test("homepage provides a visible GitHub Sponsors support link", async () => {
  const [html, css] = await Promise.all([
    readHomepage(),
    readFile(new URL("../site/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /href="https:\/\/github\.com\/sponsors\/cyruscyliu"/);
  assert.doesNotMatch(css, /\.site-footer \.footer-sponsor,\s*\.site-footer \.footer-contact\s*\{\s*display: none;/);
});

test("mobile layout keeps Find relation after the people search", async () => {
  const css = await readFile(new URL("../site/styles.css", import.meta.url), "utf8");
  const orderStart = css.lastIndexOf(".graph-panel > .search-row:first-of-type");
  const orderEnd = css.indexOf("\n}", orderStart);
  const mobileOrder = css.slice(orderStart, orderEnd);
  assert.ok(orderStart >= 0);
  assert.ok(mobileOrder.indexOf(".relationship-tool") < mobileOrder.indexOf(".graph-tabs"));
  assert.ok(mobileOrder.indexOf(".relationship-result") < mobileOrder.indexOf(".graph-tabs"));
});
