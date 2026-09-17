export const TIPOS_DOCUMENTO_TERMO = [
  'PLANO_ATIVIDADES',
  'APOLICE_SEGURO',
  'COMPROVANTE_MATRICULA',
  'AVALIACAO_INSTALACOES',
  'RELATORIO',
  'TERMO_ADITIVO',
  'TERMO_REALIZACAO',
  'TERMO_RESCISAO',
  'OUTRO'
];

export const DOCUMENTOS_OBRIGATORIOS_INICIAIS = [
  'PLANO_ATIVIDADES',
  'APOLICE_SEGURO',
  'COMPROVANTE_MATRICULA',
  'AVALIACAO_INSTALACOES'
];

export const ROTULOS_DOCUMENTOS = {
  TCE_ASSINADO: 'TCE assinado',
  PLANO_ATIVIDADES: 'Plano de atividades',
  APOLICE_SEGURO: 'Apólice de seguro',
  COMPROVANTE_MATRICULA: 'Comprovante de matrícula',
  AVALIACAO_INSTALACOES: 'Avaliação das instalações',
  RELATORIO: 'Relatório periódico',
  TERMO_ADITIVO: 'Termo aditivo',
  TERMO_REALIZACAO: 'Termo de realização',
  TERMO_RESCISAO: 'Termo de rescisão',
  OUTRO: 'Outro documento'
};

export function statusDocumento(documento) {
  if (documento?.status) return documento.status;
  if (documento?.validado === true) return 'APROVADO';
  if (documento?.caminho) return 'ENVIADO';
  return 'FALTANDO';
}

export function montarChecklistDocumentos(termo) {
  const documentos = termo?.documentos || [];
  const tipos = [...DOCUMENTOS_OBRIGATORIOS_INICIAIS];
  for (const documento of documentos) {
    if (!tipos.includes(documento.tipo)) tipos.push(documento.tipo);
  }
  const checklist = [{
    tipo: 'TCE_ASSINADO',
    nome: ROTULOS_DOCUMENTOS.TCE_ASSINADO,
    obrigatorio: true,
    status: termo?.tceAssinado?.caminho ? (termo.status === 'APROVADO' ? 'APROVADO' : 'ENVIADO') : 'FALTANDO',
    arquivo: termo?.tceAssinado || null,
    especial: true
  }];
  for (const tipo of tipos) {
    const documento = [...documentos].reverse().find((item) => item.tipo === tipo);
    checklist.push({
      tipo,
      nome: documento?.nome || ROTULOS_DOCUMENTOS[tipo] || tipo.replaceAll('_', ' '),
      obrigatorio: DOCUMENTOS_OBRIGATORIOS_INICIAIS.includes(tipo),
      status: statusDocumento(documento),
      documento: documento || null
    });
  }
  return checklist;
}

export function documentosObrigatoriosAprovados(termo) {
  if (!termo?.tceAssinado?.caminho) return false;
  return DOCUMENTOS_OBRIGATORIOS_INICIAIS.every((tipo) => {
    const documento = [...(termo.documentos || [])].reverse().find((item) => item.tipo === tipo);
    return statusDocumento(documento) === 'APROVADO';
  });
}

