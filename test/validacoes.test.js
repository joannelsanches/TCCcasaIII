import test from 'node:test';
import assert from 'node:assert/strict';
import { emailInstitucionalValido, validarCNPJ, validarCPF } from '../utils/validacoes.js';

function criarDocumento(base, pesos1, pesos2) {
  const digito = (texto, pesos) => { const resto = texto.split('').reduce((s, d, i) => s + Number(d) * pesos[i], 0) % 11; return resto < 2 ? 0 : 11 - resto; };
  const d1 = digito(base, pesos1); const d2 = digito(`${base}${d1}`, pesos2); return `${base}${d1}${d2}`;
}

test('valida CPF calculado e rejeita repetição', () => {
  const cpf = criarDocumento('123456789', [10,9,8,7,6,5,4,3,2], [11,10,9,8,7,6,5,4,3,2]);
  assert.equal(validarCPF(cpf), true); assert.equal(validarCPF('11111111111'), false);
});

test('valida CNPJ calculado e rejeita formato curto', () => {
  const cnpj = criarDocumento('123456780001', [5,4,3,2,9,8,7,6,5,4,3,2], [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  assert.equal(validarCNPJ(cnpj), true); assert.equal(validarCNPJ('123'), false);
});

test('restringe cadastro ao domínio institucional configurado', () => {
  process.env.DOMINIOS_INSTITUCIONAIS = 'academico.ifsul.edu.br';
  assert.equal(emailInstitucionalValido('estudante.bg00@academico.ifsul.edu.br'), true);
  assert.equal(emailInstitucionalValido('estudante@exemplo.com'), false);
});
