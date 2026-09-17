import Avaliacao from '../models/Avaliacao.js';
import Candidatura from '../models/Candidatura.js';
import Termo from '../models/TermoCompromisso.js';
import Vaga from '../models/Vaga.js';
import { estudanteLogado, empresaLogada } from '../utils/perfis.js';
import { mensagem } from '../utils/mensagens.js';

async function carregarContexto(req) {
  let candidaturas = [];
  let avaliacoes;
  let view;
  if (req.session.usuario.tipo === 'ESTUDANTE') {
    const estudante = await estudanteLogado(req);
    view = 'estudante/avaliacoes';
    const vagasAvaliadas = await Avaliacao.find({ autor: req.session.usuario.id, tipo: 'AVALIACAO_ESTUDANTE' }).distinct('vaga');
    const termosAprovados = await Termo.find({ estudante: estudante._id, status: 'APROVADO', situacaoEstagio: { $in: ['ENCERRADO', 'RESCINDIDO'] } }).distinct('candidatura');
    candidaturas = await Candidatura.find({ _id: { $in: termosAprovados }, estudante: estudante._id, status: 'SELECIONADO', vaga: { $nin: vagasAvaliadas } }).populate({ path: 'vaga', populate: 'empresa' });
    avaliacoes = await Avaliacao.find({ estudante: estudante._id }).populate('empresa vaga').sort('-data');
  } else if (req.session.usuario.tipo === 'EMPRESA') {
    const empresa = await empresaLogada(req);
    view = 'empresa/avaliacoes';
    const vagas = await Vaga.find({ empresa: empresa._id }).distinct('_id');
    const termosAprovados = await Termo.find({ empresa: empresa._id, status: 'APROVADO', situacaoEstagio: { $in: ['ENCERRADO', 'RESCINDIDO'] } }).distinct('candidatura');
    const feitas = await Avaliacao.find({ autor: req.session.usuario.id, tipo: 'AVALIACAO_EMPRESA' }).select('estudante vaga').lean();
    const paresAvaliados = new Set(feitas.map((item) => `${item.estudante}:${item.vaga}`));
    const selecionadas = await Candidatura.find({ _id: { $in: termosAprovados }, vaga: { $in: vagas }, status: 'SELECIONADO' }).populate({ path: 'estudante', populate: 'usuario' }).populate('vaga');
    candidaturas = selecionadas.filter((item) => !paresAvaliados.has(`${item.estudante?._id}:${item.vaga?._id}`));
    avaliacoes = await Avaliacao.find({ empresa: empresa._id }).populate({ path: 'estudante', populate: 'usuario' }).populate('vaga').sort('-data');
  } else {
    view = 'admin/avaliacoes';
    avaliacoes = await Avaliacao.find().populate({ path: 'estudante', populate: 'usuario' }).populate('empresa vaga autor').sort('-data');
  }
  return { view, candidaturas, avaliacoes };
}

async function renderizar(req, res, { erros = {}, valores = {}, status = 200 } = {}) {
  const contexto = await carregarContexto(req);
  return res.status(status).render(contexto.view, { ...contexto, erros, valores });
}

export default class AvaliacaoController {
  static async listar(req, res) {
    return renderizar(req, res);
  }

  static async criar(req, res) {
    try {
      const nota = Number(req.body.nota);
      const comentario = String(req.body.comentario || '').trim();
      const erros = {};
      if (!Number.isInteger(nota) || nota < 1 || nota > 5) erros.nota = 'Selecione uma nota inteira de 1 a 5 estrelas.';
      if (!comentario) erros.comentario = 'Escreva um comentário sobre a experiência.';
      if (!req.body.candidatura) erros.candidatura = 'Selecione o estágio.';
      if (Object.keys(erros).length) return renderizar(req, res, { erros, valores: req.body, status: 422 });

      const candidatura = await Candidatura.findOne({ _id: req.body.candidatura, status: 'SELECIONADO' }).populate('vaga estudante');
      if (!candidatura) return renderizar(req, res, { erros: { candidatura: 'Candidatura não selecionada.' }, valores: req.body, status: 422 });
      if (!(await Termo.exists({ candidatura: candidatura._id, status: 'APROVADO', situacaoEstagio: { $in: ['ENCERRADO', 'RESCINDIDO'] } }))) {
        return renderizar(req, res, { erros: { candidatura: 'A avaliação fica disponível após o encerramento ou a rescisão do estágio.' }, valores: req.body, status: 422 });
      }

      let tipo;
      if (req.session.usuario.tipo === 'ESTUDANTE') {
        const estudante = await estudanteLogado(req);
        if (String(estudante._id) !== String(candidatura.estudante._id)) return res.status(403).render('erro/403');
        tipo = 'AVALIACAO_ESTUDANTE';
      } else {
        const empresa = await empresaLogada(req);
        if (String(empresa._id) !== String(candidatura.vaga.empresa)) return res.status(403).render('erro/403');
        tipo = 'AVALIACAO_EMPRESA';
      }
      if (await Avaliacao.exists({ estudante: candidatura.estudante._id, vaga: candidatura.vaga._id, tipo })) {
        return renderizar(req, res, { erros: { candidatura: 'Esta avaliação já foi registrada.' }, valores: req.body, status: 422 });
      }
      await Avaliacao.create({ estudante: candidatura.estudante._id, empresa: candidatura.vaga.empresa, vaga: candidatura.vaga._id, autor: req.session.usuario.id, tipo, nota, comentario });
      mensagem(req, 'sucesso', 'Avaliação registrada.');
      return res.redirect('/avaliacoes');
    } catch (erro) {
      const texto = erro.code === 11000 ? 'Esta avaliação já foi registrada.' : 'Não foi possível registrar a avaliação.';
      return renderizar(req, res, { erros: { geral: texto }, valores: req.body, status: erro.code === 11000 ? 422 : 500 });
    }
  }
}
