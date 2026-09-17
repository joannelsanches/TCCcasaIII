import Candidatura from '../models/Candidatura.js';
import Vaga from '../models/Vaga.js';
import Termo from '../models/TermoCompromisso.js';
import Empresa from '../models/Empresa.js';
import { estudanteLogado, empresaLogada } from '../utils/perfis.js';
import { mensagem, voltarComErro } from '../utils/mensagens.js';
import { podeTransicionarCandidatura, registrarHistoricoStatus } from '../utils/processoEstagio.js';
import { criarNotificacao } from '../services/notificacoes.js';

export default class CandidaturaController {
  static async candidatar(req, res) {
    try {
      const estudante = await estudanteLogado(req);
      if (!estudante?.matriculaRegular) return voltarComErro(req, res, 'A matrícula precisa ser validada pelo setor de estágios antes da candidatura.', '/estudante/perfil');
      const vaga = await Vaga.findOne({ _id: req.params.vagaId, status: 'ABERTA', prazo: { $gte: new Date() }, cursosCompativeis: estudante.curso });
      if (!vaga) return voltarComErro(req, res, 'Esta vaga não está disponível para o seu curso.', `/vagas/${req.params.vagaId}`);
      if (!estudante.curriculo?.caminho) return voltarComErro(req, res, 'Envie seu currículo antes de se candidatar.', '/estudante/perfil');
      const candidatura = await Candidatura.create({
        estudante: estudante._id,
        vaga: vaga._id,
        historicoStatus: [{ status: 'EM_ANALISE', data: new Date(), alteradoPor: req.session.usuario.id, observacao: 'Candidatura criada.' }]
      });
      const empresa = await Empresa.findById(vaga.empresa).select('usuario');
      if (empresa?.usuario) {
        await criarNotificacao({
          destinatario: empresa.usuario,
          titulo: 'Nova candidatura',
          mensagem: `A vaga “${vaga.titulo}” recebeu uma nova candidatura.`,
          link: `/empresa/candidatos/${vaga._id}`,
          tipoEvento: 'NOVA_CANDIDATURA',
          referencia: candidatura._id,
          chaveUnica: `NOVA_CANDIDATURA:${candidatura._id}`,
          enviarPorEmail: false
        });
      }
      mensagem(req, 'sucesso', 'Candidatura enviada.');
      return res.redirect('/estudante/candidaturas');
    } catch (erro) {
      return voltarComErro(req, res, erro.code === 11000 ? 'Você já se candidatou a esta vaga.' : 'Não foi possível enviar a candidatura.', `/vagas/${req.params.vagaId}`);
    }
  }

  static async atualizar(req, res) {
    const empresa = await empresaLogada(req);
    const candidatura = await Candidatura.findById(req.params.id).populate('vaga').populate({ path: 'estudante', populate: 'usuario' });
    if (!candidatura || String(candidatura.vaga.empresa) !== String(empresa?._id)) return res.status(403).render('erro/403');
    const proximo = String(req.body.status || '');
    if (!podeTransicionarCandidatura(candidatura.status, proximo)) {
      return voltarComErro(req, res, 'Essa mudança de etapa não é permitida.', `/empresa/candidato/${candidatura._id}`);
    }
    candidatura.status = proximo;
    candidatura.observacaoEmpresa = String(req.body.observacaoEmpresa || '').trim();
    registrarHistoricoStatus(candidatura, proximo, req.session.usuario.id, candidatura.observacaoEmpresa);
    await candidatura.save();
    await criarNotificacao({
      destinatario: candidatura.estudante.usuario._id,
      titulo: 'Candidatura atualizada',
      mensagem: `Sua candidatura para “${candidatura.vaga.titulo}” avançou para ${proximo.replaceAll('_', ' ').toLowerCase()}.`,
      link: '/estudante/candidaturas',
      tipoEvento: 'STATUS_CANDIDATURA',
      referencia: candidatura._id,
      chaveUnica: `STATUS_CANDIDATURA:${candidatura._id}:${proximo}:${candidatura.historicoStatus.length}`
    });
    mensagem(req, 'sucesso', 'Etapa da candidatura atualizada.');
    return res.redirect(`/empresa/candidato/${candidatura._id}`);
  }

  static async cancelar(req, res) {
    const estudante = await estudanteLogado(req);
    const candidatura = await Candidatura.findOne({ _id: req.params.id, estudante: estudante?._id }).populate('vaga');
    if (!candidatura) return res.status(404).render('erro/404');
    if (candidatura.status !== 'EM_ANALISE') return voltarComErro(req, res, 'A candidatura só pode ser cancelada enquanto está em análise.', '/estudante/candidaturas');
    if (await Termo.exists({ candidatura: candidatura._id })) return voltarComErro(req, res, 'A candidatura já possui termo e não pode ser cancelada.', '/estudante/candidaturas');

    candidatura.status = 'CANCELADO';
    candidatura.dataCancelamento = new Date();
    candidatura.motivoCancelamento = String(req.body.motivo || '').trim();
    registrarHistoricoStatus(candidatura, 'CANCELADO', req.session.usuario.id, candidatura.motivoCancelamento || 'Cancelada pelo estudante.');
    await candidatura.save();

    const empresa = await Empresa.findById(candidatura.vaga.empresa).select('usuario');
    if (empresa?.usuario) {
      await criarNotificacao({
        destinatario: empresa.usuario,
        titulo: 'Candidatura cancelada',
        mensagem: `Uma candidatura da vaga “${candidatura.vaga.titulo}” foi cancelada pelo estudante.`,
        link: `/empresa/candidatos/${candidatura.vaga._id}`,
        tipoEvento: 'CANDIDATURA_CANCELADA',
        referencia: candidatura._id,
        chaveUnica: `CANDIDATURA_CANCELADA:${candidatura._id}`
      });
    }
    mensagem(req, 'sucesso', 'Candidatura cancelada. O registro continua disponível no histórico.');
    return res.redirect('/estudante/candidaturas');
  }
}
