const assert = require('assert');
const TemplateEngine = require('../src/lib/TemplateEngine');
const path = require('path');
const { describe, it } = require('node:test');

const engine = new TemplateEngine(path.join(process.cwd(), 'src/templates'));

describe('TemplateEngine', () => {
  it('renders variables and escapes HTML', () => {
    const out = engine.render('Hello {{name}}', { name: '<b>Bob</b>' });
    assert.strictEqual(out, 'Hello &lt;b&gt;Bob&lt;/b&gt;');
  });

  it('supports arrays and dot syntax', () => {
    const out = engine.render('Items: {{#items}}[{{.}}]{{/items}}', { items: ['a', 'b'] });
    assert.strictEqual(out, 'Items: [a][b]');
  });

  it('supports object loops and conditionals', () => {
    const tpl = '{{#show}}Hi {{name}}{{/show}}';
    const out1 = engine.render(tpl, { show: true, name: 'Alice' });
    const out2 = engine.render(tpl, { show: false, name: 'Alice' });
    assert.strictEqual(out1, 'Hi Alice');
    assert.strictEqual(out2, '');
  });

  it('does not escape htmlContent/content', () => {
    const out = engine.render('X: {{htmlContent}} Y: {{content}}', { htmlContent: '<b>x</b>', content: '<i>y</i>' });
    assert.strictEqual(out, 'X: <b>x</b> Y: <i>y</i>');
  });
});
