// Tiny helpers over hast trees (the HTML syntax tree produced by remark-rehype).
import { toString } from 'hast-util-to-string';
import { toHtml } from 'hast-util-to-html';

export const textOf = (node) => (node ? toString(node) : '');

export const isEl = (n, tag) => Boolean(n && n.type === 'element' && (!tag || (Array.isArray(tag) ? tag.includes(n.tagName) : n.tagName === tag)));

export const isBlank = (n) => n && n.type === 'text' && !n.value.trim();

export function el(tagName, properties = {}, children = []) {
  return { type: 'element', tagName, properties, children: Array.isArray(children) ? children : [children] };
}

export const txt = (value) => ({ type: 'text', value });
export const raw = (value) => ({ type: 'raw', value });

export function addClass(node, ...names) {
  const cur = node.properties.className || [];
  const list = Array.isArray(cur) ? cur : String(cur).split(/\s+/);
  node.properties.className = [...new Set([...list, ...names.filter(Boolean)])];
  return node;
}

export function hasClass(node, name) {
  const c = node?.properties?.className;
  return Array.isArray(c) ? c.includes(name) : String(c || '').split(/\s+/).includes(name);
}

/** Children without whitespace-only text nodes. */
export const meaningful = (children = []) => children.filter((c) => !isBlank(c) && c.type !== 'comment');

export function firstChildEl(node) {
  return meaningful(node.children || [])[0];
}

/**
 * Depth-first walk. The callback may return
 *   undefined (continue), "skip" (do not enter this node),
 *   or an array of nodes that replaces the current node (walk resumes after them).
 */
export function walk(node, fn, parent = null) {
  const kids = node.children;
  if (!kids) return;
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    const r = fn(child, i, node);
    if (Array.isArray(r)) {
      kids.splice(i, 1, ...r);
      i += r.length - 1;
      continue;
    }
    if (r === 'skip') continue;
    walk(child, fn, node);
  }
}

export function html(nodes) {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  return toHtml({ type: 'root', children: list }, { allowDangerousHtml: true });
}

/** The leading <strong> of a paragraph or list item, with its label text (trailing period removed). */
export function leadStrong(node) {
  const kids = meaningful(node.children || []);
  let first = kids[0];
  if (isEl(first, 'p')) first = meaningful(first.children)[0];
  if (!isEl(first, 'strong')) return null;
  const label = textOf(first).trim();
  return { node: first, label, key: label.replace(/[.:]\s*$/, '').trim().toLowerCase() };
}

/** Removes the leading strong of a node and the space after it. */
export function dropLeadStrong(container) {
  const kids = container.children;
  const i = kids.findIndex((c) => !isBlank(c));
  if (i < 0 || !isEl(kids[i], 'strong')) return null;
  const [strong] = kids.splice(i, 1);
  const next = kids[i];
  if (next && next.type === 'text') next.value = next.value.replace(/^\s+/, '');
  return strong;
}

export function slugify(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function makeSlugger() {
  const seen = new Map();
  return (text) => {
    const base = slugify(text) || 'section';
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}
