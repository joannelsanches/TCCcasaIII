export const STATUS_CANDIDATURA = [
  'EM_ANALISE',
  'ENTREVISTA',
  'AGUARDANDO_DOCUMENTOS',
  'SELECIONADO',
  'NAO_SELECIONADO',
  'CANCELADO'
];

const transicoesCandidatura = {
  EM_ANALISE: ['ENTREVISTA', 'AGUARDANDO_DOCUMENTOS', 'SELECIONADO', 'NAO_SELECIONADO'],
  ENTREVISTA: ['AGUARDANDO_DOCUMENTOS', 'SELECIONADO', 'NAO_SELECIONADO'],
  AGUARDANDO_DOCUMENTOS: ['ENTREVISTA', 'SELECIONADO', 'NAO_SELECIONADO']
};

export function proximosStatusCandidatura(status) {
  return transicoesCandidatura[status] || [];
}

export function podeTransicionarCandidatura(atual, proximo) {
  return proximosStatusCandidatura(atual).includes(proximo);
}

export function registrarHistoricoStatus(documento, status, alteradoPor, observacao = '') {
  if (!Array.isArray(documento.historicoStatus)) documento.historicoStatus = [];
  documento.historicoStatus.push({
    status,
    data: new Date(),
    alteradoPor: alteradoPor || undefined,
    observacao: String(observacao || '').trim()
  });
}

function dataStatus(historico = [], status) {
  return [...historico].reverse().find((item) => item.status === status)?.data;
}

function etapa(chave, titulo) {
  return { chave, titulo, estado: 'PENDENTE', simbolo: '○', descricao: 'Pendente', data: null };
}

function marcar(item, estado, descricao, data = null) {
  const simbolos = { CONCLUIDA: '✓', ATUAL: '●', PENDENTE: '○', INTERROMPIDA: '!', REJEITADA: '×' };
  Object.assign(item, { estado, descricao, data, simbolo: simbolos[estado] || '○' });
}

export function montarLinhaTempoEstagio(candidatura, termo = null) {
  const etapas = [
    etapa('candidatura', 'Candidatura'),
    etapa('selecao', 'Seleção'),
    etapa('termo', 'Termo'),
    etapa('aprovacao', 'Aprovação'),
    etapa('inicio', 'Estágio iniciado'),
    etapa('encerramento', 'Encerramento')
  ];
  if (!candidatura) return etapas;

  const historicoCandidatura = candidatura.historicoStatus || [];
  marcar(etapas[0], 'CONCLUIDA', 'Candidatura registrada', candidatura.dataCandidatura || candidatura.createdAt);

  if (candidatura.status === 'CANCELADO' || candidatura.status === 'NAO_SELECIONADO') {
    marcar(
      etapas[1],
      candidatura.status === 'CANCELADO' ? 'INTERROMPIDA' : 'REJEITADA',
      candidatura.status === 'CANCELADO' ? 'Cancelada pelo estudante' : 'Não selecionado',
      candidatura.dataCancelamento || dataStatus(historicoCandidatura, candidatura.status)
    );
    return etapas;
  }

  if (candidatura.status === 'SELECIONADO') {
    marcar(etapas[1], 'CONCLUIDA', 'Estudante selecionado', dataStatus(historicoCandidatura, 'SELECIONADO'));
  } else {
    const descricoes = {
      EM_ANALISE: 'Em análise',
      ENTREVISTA: 'Entrevista',
      AGUARDANDO_DOCUMENTOS: 'Aguardando documentos'
    };
    marcar(etapas[1], 'ATUAL', descricoes[candidatura.status] || 'Em seleção', dataStatus(historicoCandidatura, candidatura.status));
    return etapas;
  }

  if (!termo) return etapas;
  const historicoTermo = termo.historicoStatus || [];
  if (['RASCUNHO', 'AGUARDANDO_ASSINATURAS'].includes(termo.status)) {
    marcar(etapas[2], 'ATUAL', termo.status === 'RASCUNHO' ? 'Rascunho em preparação' : 'Aguardando assinaturas', dataStatus(historicoTermo, termo.status) || termo.dataSolicitacao);
    return etapas;
  }

  marcar(etapas[2], 'CONCLUIDA', 'Termo enviado', termo.dataEnvioAnalise || dataStatus(historicoTermo, 'PENDENTE'));
  if (termo.status === 'REPROVADO') {
    marcar(etapas[3], 'REJEITADA', 'Correção solicitada', termo.dataAnalise || dataStatus(historicoTermo, 'REPROVADO'));
    return etapas;
  }
  if (termo.status === 'PENDENTE') {
    marcar(etapas[3], 'ATUAL', 'Em análise institucional', termo.dataEnvioAnalise);
    return etapas;
  }
  if (termo.status !== 'APROVADO') return etapas;

  marcar(etapas[3], 'CONCLUIDA', 'Termo aprovado', termo.dataAprovacao || dataStatus(historicoTermo, 'APROVADO'));
  if (termo.situacaoEstagio === 'NAO_INICIADO') {
    marcar(etapas[4], 'ATUAL', 'Aguardando início', null);
    return etapas;
  }
  marcar(etapas[4], 'CONCLUIDA', 'Estágio iniciado', termo.dataInicioEfetivo);
  if (['ENCERRADO', 'RESCINDIDO'].includes(termo.situacaoEstagio)) {
    marcar(etapas[5], termo.situacaoEstagio === 'ENCERRADO' ? 'CONCLUIDA' : 'INTERROMPIDA', termo.situacaoEstagio === 'ENCERRADO' ? 'Estágio encerrado' : 'Estágio rescindido', termo.dataEncerramento);
  } else {
    marcar(etapas[5], 'ATUAL', 'Estágio em andamento', null);
  }
  return etapas;
}
