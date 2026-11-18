// Which external URLs a page may show.
//
// Sources list (end of page). Only URLs whose domain is in the "reference" tier of
// source_tiers.json, plus gutenberg.org, archive.org, doi.org, PubMed, perseus.tufts.edu and .gov, .edu
// (and .mil, for the US Naval Observatory moon data) domains. Dealer pages and other
// crystal guides stay in the frontmatter and are never shown, the owner does not
// advertise which guides we read.
//
// Links in the body. Same rule, plus a short list of non-reference sites that are
// not crystal guides (crisis lines, health information, museum records, the IMA list,
// image credits). Any other external link keeps its words and loses its anchor.
import { hostOf } from './urls.mjs';

const ALWAYS_REFERENCE = ['gutenberg.org', 'archive.org', 'doi.org', 'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'perseus.tufts.edu'];

export const BODY_LINK_ALLOW = [
  '988lifeline.org',
  'clevelandclinic.org',
  'merriam-webster.com',
  'n2t.net',
  'cnmnc.units.it',
  'boa.unimib.it',
  'ideas.repec.org',
  'econpapers.repec.org',
  'psychologicalscience.org',
  'wethecurious.org',
  'metmuseum.github.io',
  'theosophical.org',
  'clearnumerology.com',
];

// Image credit links, needed for CC BY attribution, only in figure captions.
export const CREDIT_LINK_ALLOW = ['commons.wikimedia.org', 'wikimedia.org', 'creativecommons.org', 'flickr.com', 'si.edu', 'n2t.net', 'unsplash.com', 'pixabay.com'];

function matches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function isGovLike(host) {
  // .gov, .edu, .mil, and country forms such as gov.au, ac.uk style .edu.au
  return /(^|\.)(gov|edu|mil)(\.[a-z]{2})?$/.test(host);
}

export function makeSourcePolicy(tiers = {}) {
  const reference = [...new Set([...(tiers.reference || []), ...ALWAYS_REFERENCE])].map((d) => d.toLowerCase().replace(/^www\./, ''));
  const dealer = (tiers.dealer || []).map((d) => d.toLowerCase().replace(/^www\./, ''));

  function isReferenceUrl(url) {
    const host = hostOf(url);
    if (!host) return false;
    if (dealer.some((d) => matches(host, d))) return false;
    if (isGovLike(host)) return true;
    return reference.some((d) => matches(host, d));
  }

  function isBodyLinkAllowed(url) {
    if (isReferenceUrl(url)) return true;
    const host = hostOf(url);
    if (!host) return false;
    if (dealer.some((d) => matches(host, d))) return false;
    return BODY_LINK_ALLOW.some((d) => matches(host, d));
  }

  function isCreditLinkAllowed(url) {
    const host = hostOf(url);
    if (!host) return false;
    return isReferenceUrl(url) || CREDIT_LINK_ALLOW.some((d) => matches(host, d));
  }

  function tierOf(url) {
    const host = hostOf(url);
    if (!host) return 'none';
    if (dealer.some((d) => matches(host, d))) return 'dealer';
    if (isReferenceUrl(url)) return 'reference';
    return 'other';
  }

  return { isReferenceUrl, isBodyLinkAllowed, isCreditLinkAllowed, tierOf, reference, dealer };
}

// A bare domain written in plain text, such as "crystals.com" or "wemystic.fr".
const DOMAIN_TOKEN_RX = /\b((?:[a-z0-9-]+\.)+(?:com|net|org|co|fr|de|uk|ca|au|br|io|info|shop|site|dev|es|it|ch|jp|nl|be|us))\b/gi;

export function domainsInText(text) {
  return [...String(text).matchAll(DOMAIN_TOKEN_RX)].map((m) => m[1].toLowerCase().replace(/^www\./, ''));
}

/** The one line that stands for every "crystal guides" or "lore collection" item of a page. */
export const GUIDES_LINE = {
  before: 'Modern associations as described in popular crystal books and guides, rated on our five-facet scale, see ',
  link: 'How We Rate',
  href: '/sources/',
};

/**
 * Decides what happens to one item of a Sources list.
 *   links, the external URLs in the item. text, its plain text.
 * Returns
 *   "replace" when it mentions "lore collection" or "crystal guides" (the layout shows GUIDES_LINE once),
 *   "drop" when it mentions Wikipedia, when all its links point outside the reference tier,
 *          or when it names a non-reference domain in plain text,
 *   "keep" otherwise (book citations without links stay).
 */
export function sourceItemVerdict({ links = [], text = '' }, policy) {
  if (/lore collection|crystal guides/i.test(text)) return 'replace';
  if (/wikipedia/i.test(text) || links.some((u) => /wikipedia\.org/i.test(u))) return 'drop';
  if (links.length) {
    return links.some((u) => policy.isReferenceUrl(u)) ? 'keep' : 'drop';
  }
  const named = domainsInText(text);
  if (named.some((d) => !policy.isReferenceUrl(`https://${d}/`))) return 'drop';
  return 'keep';
}

/** Filters a plain list of URLs (frontmatter sources) to the ones a page may show. */
export function shownSourceUrls(urls = [], policy) {
  const seen = new Set();
  return urls.filter((u) => {
    if (!policy.isReferenceUrl(u) || seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}
