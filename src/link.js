/**
 * One place that knows the site's URL prefix.
 *
 * A dev server serves this site from "/". GitHub Pages serves a project repo
 * from "/<repo>/". Astro puts whichever one is active into BASE_URL, so every
 * internal link goes through here and no page has to think about it.
 *
 *   link('/')              ->  "/"            or  "/3dWebModules/"
 *   link('/m/enso-void')   ->  "/m/enso-void" or  "/3dWebModules/m/enso-void"
 *
 * External links (github, smartproduction.ge) are full URLs and skip this.
 */
export function link(path = '/') {
  const prefix = import.meta.env.BASE_URL.replace(/\/$/, '');
  return prefix + path;
}
