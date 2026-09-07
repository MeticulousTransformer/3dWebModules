/**
 * The module sources, as text, for the "lift this module" panel.
 *
 * This is a BUILD-TIME file. It eagerly imports every module's source as a
 * string, which is exactly what you do not want in a browser bundle — so it is
 * only ever imported from .astro frontmatter, never from a client script.
 */
const sources = import.meta.glob('./*.js', { query: '?raw', import: 'default', eager: true });
const libSources = import.meta.glob('../lib/*.js', { query: '?raw', import: 'default', eager: true });

export function getSource(id) {
  return sources[`./${id}.js`] ?? '';
}

export function getLibSource(name) {
  return libSources[`../lib/${name}`] ?? '';
}

/**
 * Which shared files a module needs, read straight out of its own import lines.
 * No hand-maintained list to fall out of date.
 */
export function getDependencies(id) {
  const matches = [...getSource(id).matchAll(/from '\.\.\/lib\/([\w-]+\.js)'/g)];
  return [...new Set(matches.map((match) => match[1]))].sort();
}

/** Rough size of the module file on its own, in lines and bytes. */
export function getSourceStats(id) {
  const source = getSource(id);
  return {
    lines: source.split('\n').length,
    bytes: new TextEncoder().encode(source).length,
  };
}
