const conectores = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

function capitalizarParte(parte) {
  return parte
    .split(/([-'])/u)
    .map((trecho) => /^[-']$/u.test(trecho)
      ? trecho
      : trecho.charAt(0).toLocaleUpperCase('pt-BR') + trecho.slice(1).toLocaleLowerCase('pt-BR'))
    .join('');
}

export function formatarNomeProprio(valor = '') {
  return String(valor)
    .trim()
    .replace(/\s+/gu, ' ')
    .split(' ')
    .map((palavra, indice) => {
      const normalizada = palavra.toLocaleLowerCase('pt-BR');
      return indice > 0 && conectores.has(normalizada) ? normalizada : capitalizarParte(normalizada);
    })
    .join(' ');
}

