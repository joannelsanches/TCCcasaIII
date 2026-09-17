import { resolve } from 'node:path';
import Estudante from '../models/Estudante.js';
import Vaga from '../models/Vaga.js';
import Candidatura from '../models/Candidatura.js';
import Termo from '../models/TermoCompromisso.js';
import Curso from '../models/Curso.js';
import Campus from '../models/Campus.js';
import { estudanteLogado } from '../utils/perfis.js';
import { mensagem, voltarComErro } from '../utils/mensagens.js';
import { enderecoVazio, errosEndereco, normalizarEndereco } from '../utils/endereco.js';
import { caminhoPertenceAPasta, metadadosUpload, removerArquivoSeguro } from '../utils/arquivos.js';
import { calcularPerfilEstudante } from '../utils/perfilCompleto.js';

async function renderizarPerfil(req, res, { erros = {}, valores = {}, status = 200 } = {}) {
  const [estudante, cursos, campi] = await Promise.all([
    Estudante.findOne({ usuario: req.session.usuario.id }).populate('usuario curso campus'),
    Curso.find({ ativo: true }).sort('nome'),
    Campus.find({ ativo: true }).sort('nome')
  ]);
  return res.status(status).render('estudante/perfil', {
    estudante,
    cursos,
    campi,
    conclusaoPerfil: calcularPerfilEstudante(estudante, estudante.usuario),
    erros,
    valores
  });
}

export default class EstudanteController {
  static async painel(req, res) {
    const estudante = await Estudante.findOne({ usuario: req.session.usuario.id }).populate('usuario curso campus');
    if (!estudante) return res.status(404).render('erro/404');
    const [candidaturas, termos, vagas] = await Promise.all([
      Candidatura.countDocuments({ estudante: estudante._id }),
      Termo.countDocuments({ estudante: estudante._id, status: { $in: ['RASCUNHO', 'AGUARDANDO_ASSINATURAS', 'PENDENTE'] } }),
      Vaga.find({ status: 'ABERTA', prazo: { $gte: new Date() }, cursosCompativeis: estudante.curso._id }).populate('empresa areaAtuacao').sort('-dataPublicacao').limit(8)
    ]);
    res.render('estudante/painel', { estudante, candidaturas, termos, vagas, conclusaoPerfil: calcularPerfilEstudante(estudante, estudante.usuario) });
  }

  static async perfil(req, res) {
    return renderizarPerfil(req, res);
  }

  static async atualizarPerfil(req, res) {
    const estudante = await estudanteLogado(req);
    if (!estudante) return res.status(404).render('erro/404');
    const fotoAnterior = estudante.fotoPerfil?.caminho;
    try {
      const endereco = normalizarEndereco(req.body, 'endereco');
      const erros = errosEndereco(endereco, 'endereco', false);
      if (!req.body.curso) erros.curso = 'Selecione o curso.';
      if (!req.body.campus) erros.campus = 'Selecione o campus.';
      if (req.body.semestre && (!Number.isInteger(Number(req.body.semestre)) || Number(req.body.semestre) < 1 || Number(req.body.semestre) > 20)) erros.semestre = 'Informe um período entre 1 e 20.';
      const [cursoAtivo, campusAtivo] = await Promise.all([
        req.body.curso ? Curso.exists({ _id: req.body.curso, ativo: true }) : null,
        req.body.campus ? Campus.exists({ _id: req.body.campus, ativo: true }) : null
      ]);
      if (req.body.curso && !cursoAtivo) erros.curso = 'Selecione um curso ativo.';
      if (req.body.campus && !campusAtivo) erros.campus = 'Selecione um campus ativo.';
      if (Object.keys(erros).length) {
        if (req.file) removerArquivoSeguro(req.file.path, 'estudantes');
        return renderizarPerfil(req, res, { erros, valores: req.body, status: 422 });
      }
      estudante.curso = req.body.curso;
      estudante.campus = req.body.campus;
      estudante.semestre = req.body.semestre || undefined;
      estudante.turno = req.body.turno || undefined;
      estudante.disponibilidade = req.body.disponibilidade;
      estudante.competencias = String(req.body.competencias || '').split(',').map((item) => item.trim()).filter(Boolean);
      estudante.dataNascimento = req.body.dataNascimento || undefined;
      estudante.telefone = req.body.telefone;
      if (!enderecoVazio(endereco)) estudante.endereco = endereco;
      if (req.file) estudante.fotoPerfil = metadadosUpload(req.file);
      await estudante.save();
      if (req.file && fotoAnterior) removerArquivoSeguro(fotoAnterior, 'estudantes');
      mensagem(req, 'sucesso', 'Perfil acadêmico atualizado.');
      res.redirect('/estudante/perfil');
    } catch (erro) {
      if (req.file) removerArquivoSeguro(req.file.path, 'estudantes');
      return renderizarPerfil(req, res, { erros: { geral: 'Não foi possível atualizar o perfil.' }, valores: req.body, status: 422 });
    }
  }

  static async removerFoto(req, res) {
    const estudante = await estudanteLogado(req);
    if (!estudante) return res.status(404).render('erro/404');
    const caminho = estudante.fotoPerfil?.caminho;
    estudante.fotoPerfil = undefined;
    await estudante.save();
    if (caminho) removerArquivoSeguro(caminho, 'estudantes');
    mensagem(req, 'sucesso', 'Foto de perfil removida.');
    res.redirect('/estudante/perfil');
  }

  static async enviarCurriculo(req, res) {
    if (!req.file) return voltarComErro(req, res, 'Selecione um currículo em PDF.', '/estudante/perfil');
    const estudante = await estudanteLogado(req);
    const anterior = estudante.curriculo?.caminho;
    try {
      estudante.curriculo = metadadosUpload(req.file);
      await estudante.save();
      if (anterior) removerArquivoSeguro(anterior, 'curriculos');
      mensagem(req, 'sucesso', 'Currículo atualizado com segurança.');
      res.redirect('/estudante/perfil');
    } catch (erro) {
      removerArquivoSeguro(req.file.path, 'curriculos');
      voltarComErro(req, res, 'Não foi possível atualizar o currículo.', '/estudante/perfil');
    }
  }

  static async curriculoProtegido(req, res) {
    const estudante = await Estudante.findById(req.params.id);
    if (!estudante?.curriculo?.caminho) return res.status(404).render('erro/404');
    let permitido = req.session.usuario.tipo === 'ADMIN' || String(estudante.usuario) === req.session.usuario.id;
    if (!permitido && req.session.usuario.tipo === 'EMPRESA') {
      const empresa = await (await import('../models/Empresa.js')).default.findOne({ usuario: req.session.usuario.id });
      const vagas = await Vaga.find({ empresa: empresa._id }).distinct('_id');
      permitido = Boolean(await Candidatura.exists({ estudante: estudante._id, vaga: { $in: vagas } }));
    }
    if (!permitido) return res.status(403).render('erro/403');
    if (!caminhoPertenceAPasta(estudante.curriculo.caminho, 'curriculos')) return res.status(403).render('erro/403');
    res.download(resolve(estudante.curriculo.caminho), estudante.curriculo.nomeOriginal);
  }

  static async candidaturas(req, res) {
    const estudante = await estudanteLogado(req);
    const candidaturas = await Candidatura.find({ estudante: estudante._id }).populate({ path: 'vaga', populate: [{ path: 'empresa' }, { path: 'areaAtuacao' }] }).sort('-dataCandidatura');
    const termos = await Termo.find({ candidatura: { $in: candidaturas.map((item) => item._id) } });
    const termosPorCandidatura = Object.fromEntries(termos.map((termo) => [String(termo.candidatura), termo]));
    res.render('estudante/candidaturas', { candidaturas, termosPorCandidatura });
  }

  static async historico(req, res) {
    const estudante = await Estudante.findOne({ usuario: req.session.usuario.id }).populate('historicoEstagios.vaga historicoEstagios.empresa');
    res.render('estudante/historico', { historico: estudante.historicoEstagios });
  }
}
