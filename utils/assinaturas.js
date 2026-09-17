function possuiAssinatura(assinaturas, papel) {
  return assinaturas.some((assinatura) => assinatura.papel === papel && assinatura.nome && assinatura.dataAssinatura);
}

export function assinaturasConvenioCompletas(convenio) {
  const assinaturas = convenio?.assinaturas || [];
  return possuiAssinatura(assinaturas, 'EMPRESA') && possuiAssinatura(assinaturas, 'INSTITUICAO');
}

export function estudanteMenorNaData(dataNascimento, referencia = new Date()) {
  if (!dataNascimento) return false;
  const nascimento = new Date(dataNascimento);
  const data = new Date(referencia);
  let idade = data.getFullYear() - nascimento.getFullYear();
  const antesAniversario = data.getMonth() < nascimento.getMonth()
    || (data.getMonth() === nascimento.getMonth() && data.getDate() < nascimento.getDate());
  if (antesAniversario) idade -= 1;
  return idade < 18;
}

export function papeisObrigatoriosTce(termo) {
  const papeis = ['ESTUDANTE', 'EMPRESA', 'INSTITUICAO'];
  if (estudanteMenorNaData(termo?.estudanteDataNascimento, termo?.periodo?.inicio || new Date())) {
    papeis.push('RESPONSAVEL_LEGAL');
  }
  return papeis;
}

export function assinaturasTceCompletas(termo) {
  const assinaturas = termo?.assinaturas || [];
  return papeisObrigatoriosTce(termo).every((papel) => possuiAssinatura(assinaturas, papel));
}

