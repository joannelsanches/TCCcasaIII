import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ejs from 'ejs';

function listar(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? listar(caminho) : [caminho];
  });
}

test('todas as views EJS compilam', () => {
  const views = listar(join(process.cwd(), 'views')).filter((arquivo) => arquivo.endsWith('.ejs'));
  assert.ok(views.length >= 40);
  for (const arquivo of views) {
    assert.doesNotThrow(() => ejs.compile(readFileSync(arquivo, 'utf8'), { filename: arquivo }), arquivo);
  }
});
