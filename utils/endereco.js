import { somenteNumeros } from './validacoes.js';

export function normalizarEndereco(body, prefixo) {
  return {
    logradouro: String(body[`${prefixo}Logradouro`] || '').trim(),
    numero: String(body[`${prefixo}Numero`] || '').trim(),
    complemento: String(body[`${prefixo}Complemento`] || '').trim(),
    bairro: String(body[`${prefixo}Bairro`] || '').trim(),
    cidade: String(body[`${prefixo}Cidade`] || '').trim(),
    estado: String(body[`${prefixo}Estado`] || '').trim().toUpperCase(),
    cep: somenteNumeros(body[`${prefixo}Cep`] || '')
  };
}

export function enderecoVazio(endereco) {
  return !endereco || !Object.values(endereco).some(Boolean);
}

export function validarEndereco(endereco, obrigatorio = true) {
  if (!obrigatorio && enderecoVazio(endereco)) return { valido: true };
  const obrigatorios = ['logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep'];
  if (obrigatorios.some((campo) => !endereco?.[campo])) {
    return { valido: false, mensagem: 'Preencha o endereço completo.' };
  }
  if (!/^[A-Z]{2}$/.test(endereco.estado)) return { valido: false, mensagem: 'Informe o estado com duas letras.' };
  if (!/^\d{8}$/.test(endereco.cep)) return { valido: false, mensagem: 'Informe um CEP válido com oito números.' };
  return { valido: true };
}

export function errosEndereco(endereco, prefixo, obrigatorio = true) {
  if (!obrigatorio && enderecoVazio(endereco)) return {};
  const erros = {};
  const rotulos = {
    logradouro: 'Informe o logradouro.',
    numero: 'Informe o número.',
    bairro: 'Informe o bairro.',
    cidade: 'Informe a cidade.',
    estado: 'Informe o estado.',
    cep: 'Informe o CEP.'
  };
  for (const [campo, texto] of Object.entries(rotulos)) {
    if (!endereco?.[campo]) erros[`${prefixo}${campo.charAt(0).toUpperCase()}${campo.slice(1)}`] = texto;
  }
  if (endereco?.estado && !/^[A-Z]{2}$/.test(endereco.estado)) erros[`${prefixo}Estado`] = 'Use a sigla do estado com duas letras.';
  if (endereco?.cep && !/^\d{8}$/.test(endereco.cep)) erros[`${prefixo}Cep`] = 'Informe um CEP com oito números.';
  return erros;
}

export function formatarCep(cep) {
  const numero = somenteNumeros(cep);
  return numero.length === 8 ? `${numero.slice(0, 5)}-${numero.slice(5)}` : (cep || '—');
}

export function formatarEndereco(endereco, legado = '') {
  if (typeof endereco === 'string') return endereco || legado || '—';
  if (!endereco || enderecoVazio(endereco)) return legado || '—';
  const primeira = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
  const segunda = [endereco.complemento, endereco.bairro].filter(Boolean).join(' — ');
  const terceira = [endereco.cidade, endereco.estado].filter(Boolean).join('/');
  const partes = [primeira, segunda, terceira, endereco.cep ? `CEP ${formatarCep(endereco.cep)}` : ''].filter(Boolean);
  return partes.join(' · ');
}

export function formatarLocalizacaoResumida(endereco, legado = '') {
  if (typeof endereco === 'string') return endereco || legado || '—';
  if (!endereco || enderecoVazio(endereco)) return legado || '—';
  return [endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean).join(' · ') || legado || '—';
}
