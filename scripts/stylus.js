/**
 * Butterfly 的 Stylus 源码依赖 nib。显式加载该依赖，保持本地与部署构建一致，
 * 且不修改主题目录中的任何文件。
 */
const stylus = require('stylus');
const nib = require('nib');

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
    .use(nib())
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
