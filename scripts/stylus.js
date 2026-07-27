/**
 * Solitude 4.0.0 ships CSS variables that clash with nib's legacy `opacity()`
 * mixin. The theme does not import nib, so render its Stylus with the current
 * compiler directly instead of injecting nib globally. This is deterministic
 * in local development and GitHub Actions, without modifying node_modules.
 */
const stylus = require('stylus');

function getConfig(object, key) {
  const parts = key.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
  let value = object;
  for (const part of parts) {
    if (!value || !Object.hasOwn(value, part)) return '';
    value = value[part];
  }
  return value === undefined || value === null ? '' : value;
}

function renderStylus(data, options, callback) {
  const config = this.config.stylus || {};
  const compiler = stylus(data.text)
    .define('hexo-config', (key) => getConfig(this.theme.config, key.val))
    .use((style) => this.execFilterSync('stylus:renderer', style, { context: this }))
    .set('filename', data.path)
    .set('sourcemap', config.sourcemaps)
    .set('compress', config.compress)
    .set('include css', true);

  compiler.render(callback);
}

renderStylus.disableNunjucks = true;
hexo.extend.renderer.register('styl', 'css', renderStylus);
hexo.extend.renderer.register('stylus', 'css', renderStylus);
