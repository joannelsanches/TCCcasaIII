import Vaga from '../models/Vaga.js';
import Convenio from '../models/Convenio.js';
import Termo from '../models/TermoCompromisso.js';
import Usuario from '../models/Usuario.js';
import ExecucaoRotina from '../models/ExecucaoRotina.js';
import { criarNotificacao } from './notificacoes.js';
import { montarChecklistDocumentos } from '../utils/documentosTermo.js';

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoDia(data = new Date()) {
  const resultado = new Date(data);
  resultado.setHours(0, 0, 0, 0);
  return resultado;
}

export function chaveAvisoIntervalo(tipo, referencia, data = new Date(), intervaloDias = 7) {
  const faixa = Math.floor(inicioDoDia(data).getTime() / (Math.max(1, intervaloDias) * DIA_MS));
  return `${tipo}:${referencia}:${faixa}`;
}

async function adquirirLock(agora) {
  const bloqueadoAte = new Date(agora.getTime() + 30 * 60 * 1000);
  try {
    return await ExecucaoRotina.findOneAndUpdate(
      {
        nome: 'ATUALIZAR_PRAZOS',
        $or: [
          { executando: { $ne: true } },
          { bloqueadoAte: { $lte: agora } },
          { bloqueadoAte: { $exists: false } }
        ]
      },
      {
        $set: {
          executando: true,
          bloqueadoAte,
          ultimoInicio: agora,
          resultado: { vagasFechadas: 0, conveniosVencidos: 0, avisosCriados: 0, erros: [] }
        },
        $setOnInsert: { nome: 'ATUALIZAR_PRAZOS' }
      },
      { upsert: true, new: true }
    );
  } catch (erro) {
    if (erro.code === 11000) return null;
    throw erro;
  }
}

async function avisar(dados, resultado) {
  try {
    const retorno = await criarNotificacao(dados);
    if (retorno.criada) resultado.avisosCriados += 1;
  } catch (erro) {
    resultado.erros.push(`Aviso: ${erro.message}`);
  }
}

async function fecharVagas(hoje, resultado) {
  const vagas = await Vaga.find({ status: 'ABERTA', prazo: { $lt: hoje } }).populate({ path: 'empresa', populate: 'usuario' });
  for (const vaga of vagas) {
    const atualizada = await Vaga.findOneAndUpdate(
      { _id: vaga._id, status: 'ABERTA' },
      {
        $set: { status: 'FECHADA', motivoFechamento: 'Prazo de candidatura encerrado automaticamente.' },
        $push: { historicoStatus: { status: 'FECHADA', data: new Date(), observacao: 'Fechamento automático por vencimento do prazo.' } }
      }
    );
    if (!atualizada) continue;
    resultado.vagasFechadas += 1;
    if (vaga.empresa?.usuario?._id) {
      await avisar({
        destinatario: vaga.empresa.usuario._id,
        titulo: 'Vaga fechada por vencimento',
        mensagem: `A vaga “${vaga.titulo}” foi fechada porque o prazo de candidatura terminou.`,
        link: '/empresa/vagas',
        tipoEvento: 'VAGA_VENCIDA',
        referencia: vaga._id,
        chaveUnica: `VAGA_VENCIDA:${vaga._id}`
      }, resultado);
    }
  }
}

async function atualizarConvenios(hoje, resultado) {
  const convenios = await Convenio.find({ status: 'ATIVO', dataFinal: { $lt: hoje } }).populate({ path: 'empresa', populate: 'usuario' });
  const administradores = await Usuario.find({ tipo: 'ADMIN', ativo: true }).distinct('_id');
  for (const convenio of convenios) {
    const atualizado = await Convenio.findOneAndUpdate(
      { _id: convenio._id, status: 'ATIVO' },
      {
        $set: { status: 'VENCIDO' },
        $push: { historicoStatus: { status: 'VENCIDO', data: new Date(), observacao: 'Vencimento automático da vigência.' } }
      }
    );
    if (!atualizado) continue;
    resultado.conveniosVencidos += 1;
    const destinatarios = [convenio.empresa?.usuario?._id, ...administradores].filter(Boolean);
    for (const destinatario of destinatarios) {
      await avisar({
        destinatario,
        titulo: 'Convênio vencido',
        mensagem: `O convênio ${convenio.numero || ''} da empresa ${convenio.empresa?.nomeFantasia || ''} venceu.`,
        link: String(destinatario) === String(convenio.empresa?.usuario?._id) ? '/empresa' : '/admin/convenios',
        tipoEvento: 'CONVENIO_VENCIDO',
        referencia: convenio._id,
        chaveUnica: `CONVENIO_VENCIDO:${convenio._id}:${destinatario}`
      }, resultado);
    }
  }

  const dias = Number(process.env.DIAS_AVISO_CONVENIO || 30);
  const limite = new Date(hoje.getTime() + Math.max(1, dias) * DIA_MS);
  const proximos = await Convenio.find({ status: 'ATIVO', dataFinal: { $gte: hoje, $lte: limite } }).populate({ path: 'empresa', populate: 'usuario' });
  for (const convenio of proximos) {
    if (!convenio.empresa?.usuario?._id) continue;
    await avisar({
      destinatario: convenio.empresa.usuario._id,
      titulo: 'Convênio próximo do vencimento',
      mensagem: `O convênio ${convenio.numero || ''} está próximo do fim da vigência.`,
      link: '/empresa',
      tipoEvento: 'CONVENIO_PROXIMO_VENCIMENTO',
      referencia: convenio._id,
      chaveUnica: `CONVENIO_PROXIMO:${convenio._id}:${new Date(convenio.dataFinal).toISOString().slice(0, 10)}`
    }, resultado);
  }
}

async function avisarDocumentos(agora, resultado) {
  const intervalo = Number(process.env.DIAS_AVISO_DOCUMENTOS || 5);
  const termos = await Termo.find({ status: { $in: ['RASCUNHO', 'AGUARDANDO_ASSINATURAS', 'PENDENTE', 'REPROVADO'] } })
    .populate({ path: 'estudante', populate: 'usuario' })
    .populate({ path: 'empresa', populate: 'usuario' });
  for (const termo of termos) {
    const faltantes = montarChecklistDocumentos(termo).filter((item) => item.obrigatorio && item.status !== 'APROVADO');
    if (!faltantes.length) continue;
    const nomes = faltantes.map((item) => item.nome).join(', ');
    for (const destinatario of [termo.estudante?.usuario?._id, termo.empresa?.usuario?._id].filter(Boolean)) {
      await avisar({
        destinatario,
        titulo: 'Documentos do estágio pendentes',
        mensagem: `Ainda há documentos obrigatórios pendentes: ${nomes}.`,
        link: '/termos',
        tipoEvento: 'DOCUMENTOS_PENDENTES',
        referencia: termo._id,
        chaveUnica: `${chaveAvisoIntervalo('DOCUMENTOS_PENDENTES', termo._id, agora, intervalo)}:${destinatario}`,
        intervaloMinimoDias: intervalo,
        referenciaTemporal: agora
      }, resultado);
    }
  }
}

async function avisarRelatorios(hoje, resultado) {
  const antecedencia = Number(process.env.DIAS_AVISO_RELATORIO || 7);
  const limite = new Date(hoje.getTime() + Math.max(1, antecedencia) * DIA_MS);
  const termos = await Termo.find({ situacaoEstagio: 'EM_ANDAMENTO', proximoRelatorio: { $lte: limite } })
    .populate({ path: 'estudante', populate: 'usuario' })
    .populate({ path: 'empresa', populate: 'usuario' });
  for (const termo of termos) {
    const atrasado = new Date(termo.proximoRelatorio) < hoje;
    const tipo = atrasado ? 'RELATORIO_ATRASADO' : 'RELATORIO_PROXIMO';
    const dataPrazo = new Date(termo.proximoRelatorio).toISOString().slice(0, 10);
    for (const destinatario of [termo.estudante?.usuario?._id, termo.empresa?.usuario?._id].filter(Boolean)) {
      await avisar({
        destinatario,
        titulo: atrasado ? 'Relatório de estágio atrasado' : 'Prazo de relatório próximo',
        mensagem: atrasado ? 'O relatório periódico do estágio está atrasado.' : 'O prazo do próximo relatório periódico está próximo.',
        link: '/termos',
        tipoEvento: tipo,
        referencia: termo._id,
        chaveUnica: atrasado
          ? `${chaveAvisoIntervalo(tipo, termo._id, hoje, antecedencia)}:${destinatario}`
          : `${tipo}:${termo._id}:${dataPrazo}:${destinatario}`,
        intervaloMinimoDias: atrasado ? antecedencia : 0,
        referenciaTemporal: hoje
      }, resultado);
    }
  }
}

export async function executarAtualizacaoPrazos({ agora = new Date() } = {}) {
  const lock = await adquirirLock(agora);
  if (!lock) return { executada: false, motivo: 'ROTINA_EM_EXECUCAO' };
  const resultado = { vagasFechadas: 0, conveniosVencidos: 0, avisosCriados: 0, erros: [] };
  const hoje = inicioDoDia(agora);
  try {
    for (const etapa of [fecharVagas, atualizarConvenios, avisarDocumentos, avisarRelatorios]) {
      try {
        await etapa(etapa === avisarDocumentos ? agora : hoje, resultado);
      } catch (erro) {
        resultado.erros.push(erro.message);
      }
    }
    return { executada: true, ...resultado };
  } finally {
    await ExecucaoRotina.findByIdAndUpdate(lock._id, {
      $set: { executando: false, bloqueadoAte: null, ultimoFim: new Date(), resultado }
    });
  }
}
