function minutos(horario) {
  if (!/^\d{2}:\d{2}$/.test(String(horario || ''))) return null;
  const [hora, minuto] = horario.split(':').map(Number);
  if (hora > 23 || minuto > 59) return null;
  return hora * 60 + minuto;
}

export function limiteJornada(cursos = []) {
  const regras = cursos.map((curso) => curso.regrasEstagio || {});
  const todosPermitem40 = regras.length > 0 && regras.every((regra) => regra.permiteJornada40h === true);
  const limiteDiario = todosPermitem40
    ? Math.min(...regras.map((regra) => Number(regra.cargaHorariaDiariaMaxima || 8)), 8)
    : Math.min(...regras.map((regra) => Number(regra.cargaHorariaDiariaMaxima || 6)), 6);
  const limiteSemanal = todosPermitem40
    ? Math.min(...regras.map((regra) => Number(regra.cargaHorariaSemanalMaxima || 40)), 40)
    : Math.min(...regras.map((regra) => Number(regra.cargaHorariaSemanalMaxima || 30)), 30);
  return { limiteDiario, limiteSemanal, todosPermitem40 };
}

export function validarDadosEstagio(dados, cursos = []) {
  const obrigatorios = ['titulo', 'descricao', 'areaAtuacao', 'requisitos', 'atividades', 'campus', 'prazo', 'periodoInicio', 'periodoFim'];
  if (obrigatorios.some((campo) => !dados[campo]) || !dados.cursosCompativeis?.length) return 'Preencha todos os campos obrigatórios da vaga.';
  const { limiteDiario, limiteSemanal } = limiteJornada(cursos);
  const diaria = Number(dados.cargaHorariaDiaria);
  const semanal = Number(dados.cargaHorariaSemanal);
  if (!Number.isFinite(diaria) || diaria <= 0 || diaria > limiteDiario) return `A carga diária não pode ultrapassar ${limiteDiario} horas para os cursos escolhidos.`;
  if (!Number.isFinite(semanal) || semanal <= 0 || semanal > limiteSemanal) return `A carga semanal não pode ultrapassar ${limiteSemanal} horas para os cursos escolhidos.`;
  if (!dados.diasSemana?.length || semanal > diaria * dados.diasSemana.length) return 'A carga semanal é incompatível com os dias e a carga diária informados.';
  const inicioHorario = minutos(dados.horarioInicio); const fimHorario = minutos(dados.horarioFim);
  if (inicioHorario === null || fimHorario === null || fimHorario <= inicioHorario) return 'Informe um horário inicial e final válido.';
  if ((fimHorario - inicioHorario) / 60 < diaria) return 'O intervalo entre os horários não comporta a carga diária informada.';
  const inicio = new Date(dados.periodoInicio); const fim = new Date(dados.periodoFim);
  if (Number.isNaN(inicio.valueOf()) || Number.isNaN(fim.valueOf()) || fim <= inicio) return 'O período previsto do estágio é inválido.';
  const doisAnos = new Date(inicio); doisAnos.setFullYear(doisAnos.getFullYear() + 2);
  if (fim > doisAnos) return 'O período na mesma concedente não pode ultrapassar dois anos.';
  if (new Date(dados.prazo) < new Date(new Date().setHours(0, 0, 0, 0))) return 'O prazo da vaga não pode estar encerrado.';
  if (new Date(dados.prazo) >= inicio) return 'O prazo de candidatura deve ser anterior ao início previsto do estágio.';
  if (dados.modalidadeEstagio === 'NAO_OBRIGATORIO' && (Number(dados.bolsa) <= 0 || Number(dados.auxilioTransporte) <= 0)) return 'Estágio não obrigatório exige bolsa-auxílio e auxílio-transporte.';
  if (!dados.supervisor?.nome || !dados.supervisor?.cargo || (!dados.supervisor?.formacao && !dados.supervisor?.experiencia)) return 'Informe os dados e a formação ou experiência do supervisor.';
  if (!Number.isInteger(Number(dados.quantidadeVagas)) || Number(dados.quantidadeVagas) < 1) return 'Informe uma quantidade válida de vagas.';
  return '';
}

export function proximoStatusVaga(statusAtual, acao) {
  const transicoes = {
    ABERTA: { fechar: 'FECHADA', cancelar: 'CANCELADA' },
    FECHADA: { reabrir: 'PENDENTE_VALIDACAO', cancelar: 'CANCELADA' },
    PENDENTE_VALIDACAO: { cancelar: 'CANCELADA' },
    REPROVADA: { reenviar: 'PENDENTE_VALIDACAO', cancelar: 'CANCELADA' }
  };
  return transicoes[statusAtual]?.[acao] || null;
}
