// Navigation, from the labels in home.md (header and footer notes).
// A target that is not built renders as plain text, like any hidden link.
export const MAIN_NAV = [
  { label: 'Stones', href: '/stones/', match: ['/stones/'] },
  { label: 'Find Your Stone', href: '/#find-your-stone', match: ['/crystals-for/'] },
  { label: 'Rituals', href: '/rituals/moon-water/', match: ['/rituals/'] },
  { label: 'Moon', href: '/moon/', match: ['/moon/'] },
  { label: 'Tools', href: '/tools/crystal-care-checker/', match: ['/tools/', '/compare/'] },
  { label: 'Field Notes', href: '/#field-notes', match: [] },
];

export const FOOTER_NAV = [
  { label: 'Stone Atlas', href: '/stones/' },
  { label: 'Find Your Stone', href: '/#find-your-stone' },
  { label: 'Moon', href: '/moon/' },
  { label: 'Care Checker', href: '/tools/crystal-care-checker/' },
  { label: 'Label Decoder', href: '/tools/crystal-label-decoder/' },
  { label: 'About Iris Holloway', href: '/about/' },
  { label: 'Editorial Policy', href: '/editorial-policy/' },
  { label: 'How We Use AI', href: '/editorial-policy/#how-we-use-ai' },
  { label: 'Sources & Methods', href: '/sources/' },
  { label: 'Contact', href: '/contact/' },
];

export const SITE_NAME = 'Crystal & Ritual';
export const TAGLINE = 'What your stone really is, where its meaning comes from, and what you can actually do with it.';
export const DISCLAIMER = 'Beliefs are shared as beliefs. Crystals are not a substitute for medical care.';
export const AUTHOR = 'Iris Holloway';
export const AUTHOR_LINE = 'Iris Holloway is the pen name of the editor of Crystal & Ritual. She starts with the stone itself, labels every belief as a belief and checks every fact against the sources listed at the end of each page.';

/** Path part of a nav href, to test it against the built set. */
export const pathOf = (href) => href.split('#')[0] || '/';
