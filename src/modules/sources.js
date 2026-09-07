/**
 * Build-time only.
 *
 * Two eager globs live here: one pulls every module's source in as text for
 * the "lift this module" panel, the other imports the modules properly so the
 * site can read their `defaults` export and build sliders from the real values
 * instead of a second copy that drifts.
 *
 * Both are exactly what you do not want in a browser bundle, which is why this
 * file is only ever imported from .astro frontmatter, never from a client
 * script. Importing a module here is safe: nothing touches the DOM until
 * create() is called.
 */
const sources = import.meta.glob('./*.js', { query: '?raw', import: 'default', eager: true });
const libSources = import.meta.glob('../lib/*.js', { query: '?raw', import: 'default', eager: true });
const modules = import.meta.glob(['./*.js', '!./index.js', '!./sources.js'], { eager: true });

export function getSource(id) {
  return sources[`./${id}.js`] ?? '';
}

export function getLibSource(name) {
  return libSources[`../lib/${name}`] ?? '';
}

/** The module's own `defaults` object — the single source of truth for its knobs. */
export function getDefaults(id) {
  return modules[`./${id}.js`]?.defaults ?? {};
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

/**
 * Resolve a control's starting value: the schema may override, otherwise it
 * comes from the module. An override is only used where a module's default is
 * 0, meaning "work it out from the device at start-up".
 */
export function resolveControls(module) {
  const defaults = getDefaults(module.id);
  return (module.controls ?? []).map((control) => ({
    ...control,
    type: control.type ?? 'range',
    value: control.value ?? defaults[control.key],
  }));
}
