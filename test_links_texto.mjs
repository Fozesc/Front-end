import assert from 'node:assert/strict';
import { partesComLinks } from './src/utils/textoComLinks.js';

assert.deepEqual(partesComLinks('Entrar em www.nfse.gov.br. Depois emitir'), [
  { texto: 'Entrar em ' }, { texto: 'www.nfse.gov.br', url: 'https://www.nfse.gov.br' }, { texto: '. Depois emitir' }]);
assert.deepEqual(partesComLinks('(https://a.com/x?y=1), fim'), [
  { texto: '(' }, { texto: 'https://a.com/x?y=1', url: 'https://a.com/x?y=1' }, { texto: '), fim' }]);
assert.deepEqual(partesComLinks('javascript:alert(1) e data:text/html'), [{ texto: 'javascript:alert(1) e data:text/html' }]);
assert.deepEqual(partesComLinks('linha 1\nlinha 2'), [{ texto: 'linha 1\nlinha 2' }]);
assert.deepEqual(partesComLinks(null), []);
assert.equal(partesComLinks('a http://x.com b https://y.com').filter(p => p.url).length, 2);
console.log('OK: links no texto dos guias (www. ganha https, pontuacao fora, javascript:/data: ficam texto, quebra de linha mantida).');
