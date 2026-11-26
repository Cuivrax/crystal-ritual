// Navigation, from the labels in home.md (header and footer notes).
// A target that is not built renders as plain text, like any hidden link.
// Six sections, each with a real hub. "sub" lists the pages of the drop-down; "auto" fills it with the hub's built children.
export const MAIN_NAV = [
  { label: 'Stone Atlas', href: '/stones/', match: ['/stones/', '/chakras/', '/shapes/', '/identify/', '/guides/'], sub: [
    { label: 'All Stones A To Z', href: '/stones/' },
    { label: 'Identify A Crystal', href: '/identify/crystal-identification-guide/' },
    { label: 'Chakra Stones', href: '/chakras/' },
    { label: 'Raw Vs Tumbled', href: '/guides/raw-vs-tumbled-crystals/' },
  ] },
  { label: 'Find Your Stone', href: '/crystals-for/', match: ['/crystals-for/'], auto: true, prefix: 'For ' },
  { label: 'Birthstones & Zodiac', href: '/birthstones/', match: ['/birthstones/', '/zodiac/'], sub: [
    { label: 'Birthstones By Month', href: '/birthstones/' },
    { label: 'Zodiac Crystals', href: '/zodiac/' },
    { label: 'Birthstone Finder', href: '/tools/birthstone-finder/' },
  ] },
  { label: 'Moon', href: '/moon/', match: ['/moon/', '/rituals/'], sub: [
    { label: "Tonight's Moon", href: '/moon/' },
    { label: 'Full Moon Calendar', href: '/moon/full-moon-calendar/' },
    { label: 'Your Birthday Moon', href: '/moon/birthday-moon/' },
    { label: 'Moon Water', href: '/rituals/moon-water/' },
  ] },
  { label: 'Care', href: '/care/', match: ['/care/', '/tools/crystal-care-checker/'], sub: [
    { label: 'Crystal Care Checker', href: '/tools/crystal-care-checker/' },
    { label: 'Crystals That Can\'t Go In Water', href: '/care/crystals-that-cant-go-in-water/' },
    { label: 'How To Cleanse Crystals', href: '/care/how-to-cleanse-crystals/' },
    { label: 'How To Charge Crystals', href: '/care/how-to-charge-crystals/' },
  ] },
  { label: 'Real Or Fake', href: '/real-or-fake/', match: ['/real-or-fake/', '/compare/', '/tools/crystal-label-decoder/'], sub: [
    { label: 'Crystal Label Decoder', href: '/tools/crystal-label-decoder/' },
    { label: 'How To Tell If Crystals Are Real', href: '/real-or-fake/how-to-tell-if-crystals-are-real/' },
    { label: 'Is Your Citrine Real', href: '/real-or-fake/citrine/' },
    { label: 'Garnet Vs Ruby', href: '/compare/garnet-vs-ruby/' },
    { label: 'Opal Vs Opalite', href: '/compare/opal-vs-opalite/' },
  ] },
];

export const FOOTER_NAV = [
  { title: 'Explore', items: [
    { label: 'Stone Atlas', href: '/stones/' },
    { label: 'Find Your Stone', href: '/crystals-for/' },
    { label: 'Birthstones', href: '/birthstones/' },
    { label: 'Zodiac Crystals', href: '/zodiac/' },
    { label: 'Moon', href: '/moon/' },
    { label: 'Crystal Care', href: '/care/' },
    { label: 'Real Or Fake', href: '/real-or-fake/' },
  ] },
  { title: 'Tools', items: [
    { label: 'Care Checker', href: '/tools/crystal-care-checker/' },
    { label: 'Label Decoder', href: '/tools/crystal-label-decoder/' },
    { label: 'Birthstone Finder', href: '/tools/birthstone-finder/' },
    { label: 'Full Moon Calendar', href: '/moon/full-moon-calendar/' },
  ] },
  { title: 'About', items: [
    { label: 'About Iris Holloway', href: '/about/' },
    { label: 'Editorial Policy', href: '/editorial-policy/' },
    { label: 'How We Use AI', href: '/editorial-policy/#how-we-use-ai' },
    { label: 'Sources & Methods', href: '/sources/' },
    { label: 'Contact', href: '/contact/' },
  ] },
];

export const SITE_NAME = 'Crystal & Ritual';
export const TAGLINE = 'What your stone really is, where its meaning comes from, and what you can actually do with it.';
export const DISCLAIMER = 'Beliefs are shared as beliefs. Crystals are not a substitute for medical care.';
export const AUTHOR = 'Iris Holloway';
export const AUTHOR_LINE = 'Iris Holloway is the pen name of the editor of Crystal & Ritual. She starts with the stone itself, labels every belief as a belief and checks every fact against the sources listed at the end of each page.';

/** Path part of a nav href, to test it against the built set. */
export const pathOf = (href) => href.split('#')[0] || '/';
