/**
 * params.js — the one convention for changing a module while it is running.
 *
 * Most module settings are read every frame straight out of the `params`
 * object, so changing them live is just writing to that object. A few live in
 * shader uniforms and need one line of work. This covers both:
 *
 *   stage.setParam = createParamSetter(params, {
 *     speed: (value) => { uniforms.uSpeed.value = value; },
 *   });
 *
 * Anything without a handler simply lands in `params`. Anything with one gets
 * written to `params` as well, so a later rebuild starts from the right place.
 */
export function createParamSetter(params, handlers = {}) {
  return function setParam(key, value) {
    params[key] = value;
    const handler = handlers[key];
    if (handler) handler(value);
  };
}
