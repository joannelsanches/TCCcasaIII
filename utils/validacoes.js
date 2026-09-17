export const somenteNumeros = (valor = '') => String(valor).replace(/\D/g, '');

function validarDocumento(valor, tamanho) {
  const numero = somenteNumeros(valor);
  if (numero.length !== tamanho || /^(\d)\1+$/.test(numero)) return false;
  const calcular = (base, pesos) => {
    const soma = base.split('').reduce((total, digito, i) => total + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (tamanho === 11) {
    const d1 = calcular(numero.slice(0, 9), [10,9,8,7,6,5,4,3,2]);
    const d2 = calcular(numero.slice(0, 10), [11,10,9,8,7,6,5,4,3,2]);
    return numero.endsWith(`${d1}${d2}`);
  }
  const d1 = calcular(numero.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const d2 = calcular(numero.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return numero.endsWith(`${d1}${d2}`);
}

export const validarCPF = (valor) => validarDocumento(valor, 11);
export const validarCNPJ = (valor) => validarDocumento(valor, 14);

export function emailInstitucionalValido(email) {
  const dominios = (process.env.DOMINIOS_INSTITUCIONAIS || 'ifsul.edu.br,academico.ifsul.edu.br')
    .split(',').map((item) => item.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  const dominio = String(email).toLowerCase().split('@')[1];
  return Boolean(dominio && dominios.some((permitido) => dominio === permitido || dominio.endsWith(`.${permitido}`)));
}

export const escaparRegex = (texto = '') => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
