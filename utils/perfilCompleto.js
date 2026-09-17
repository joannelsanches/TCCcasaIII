import { enderecoVazio } from './endereco.js';

function calcular(itens) {
  const faltantes = itens.filter((item) => !item.completo).map((item) => item.rotulo);
  const preenchidos = itens.length - faltantes.length;
  return {
    percentual: Math.round((preenchidos / itens.length) * 100),
    faltantes
  };
}

export function calcularPerfilEstudante(estudante, usuario = estudante?.usuario) {
  const itens = [
    ['nome', usuario?.nome],
    ['CPF', estudante?.cpf],
    ['matrícula', estudante?.matricula],
    ['curso', estudante?.curso],
    ['campus', estudante?.campus],
    ['semestre', estudante?.semestre],
    ['turno', estudante?.turno],
    ['data de nascimento', estudante?.dataNascimento],
    ['telefone', estudante?.telefone],
    ['endereço', estudante?.endereco && !enderecoVazio(estudante.endereco)],
    ['disponibilidade', estudante?.disponibilidade],
    ['competências', estudante?.competencias?.length],
    ['foto', estudante?.fotoPerfil?.caminho],
    ['currículo', estudante?.curriculo?.caminho]
  ].map(([rotulo, completo]) => ({ rotulo, completo: Boolean(completo) }));
  return calcular(itens);
}

export function calcularPerfilEmpresa(empresa, usuario = empresa?.usuario) {
  const itens = [
    ['razão social', empresa?.razaoSocial],
    ['nome fantasia', empresa?.nomeFantasia],
    ['CNPJ', empresa?.cnpj],
    ['telefone', empresa?.telefone],
    ['e-mail', empresa?.emailContato || usuario?.email],
    ['endereço', empresa?.endereco && !enderecoVazio(empresa.endereco)],
    ['responsável', empresa?.responsavel?.nome && empresa?.responsavel?.cargo],
    ['descrição', empresa?.descricao],
    ['logo', empresa?.logo?.caminho]
  ].map(([rotulo, completo]) => ({ rotulo, completo: Boolean(completo) }));
  return calcular(itens);
}

