import Empresa from '../models/Empresa.js';
import Vaga from '../models/Vaga.js';
import Candidatura from '../models/Candidatura.js';
import Convenio from '../models/Convenio.js';
import Termo from '../models/TermoCompromisso.js';
import { empresaLogada } from '../utils/perfis.js';
import { mensagem, voltarComErro } from '../utils/mensagens.js';
import { errosEndereco, normalizarEndereco } from '../utils/endereco.js';
import { metadadosUpload, removerArquivoSeguro } from '../utils/arquivos.js';
import { somenteNumeros, validarCNPJ } from '../utils/validacoes.js';
import { calcularPerfilEmpresa } from '../utils/perfilCompleto.js';
import { proximosStatusCandidatura } from '../utils/processoEstagio.js';

async function renderizarPerfil(req, res, { erros = {}, valores = {}, status = 200 } = {}) {
  const empresa = await Empresa.findOne({ usuario: req.session.usuario.id }).populate('usuario');
  const convenio = await Convenio.findOne({ empresa: empresa._id }).sort('-dataFinal');
  return res.status(status).render('empresa/perfil', {
    empresa,
    convenio,
    conclusaoPerfil: calcularPerfilEmpresa(empresa, empresa.usuario),
    erros,
    valores
  });
}

export default class EmpresaController {
  static async painel(req, res) {
    const empresa = await Empresa.findOne({ usuario: req.session.usuario.id }).populate('usuario');
    const idsVagas = await Vaga.find({ empresa: empresa._id }).distinct('_id');
    const [vagasAbertas, candidaturas, convenio] = await Promise.all([
      Vaga.countDocuments({ empresa: empresa._id, status: 'ABERTA' }),
      Candidatura.countDocuments({ vaga: { $in: idsVagas } }),
      Convenio.findOne({ empresa: empresa._id }).sort('-dataFinal')
    ]);
    res.render('empresa/painel', { empresa, vagasAbertas, candidaturas, convenio, conclusaoPerfil: calcularPerfilEmpresa(empresa, empresa.usuario) });
  }

  static async perfil(req, res) {
    return renderizarPerfil(req, res);
  }

  static async atualizarPerfil(req, res) {
    const empresa = await empresaLogada(req);
    if (!empresa) return res.status(404).render('erro/404');
    const logoAnterior = empresa.logo?.caminho;
    try {
      const endereco = normalizarEndereco(req.body, 'endereco');
      const erros = errosEndereco(endereco, 'endereco');
      for (const campo of ['nomeFantasia', 'telefone', 'emailContato', 'responsavelNome', 'responsavelCargo']) {
        if (!String(req.body[campo] || '').trim()) erros[campo] = 'Campo obrigatório.';
      }
      if (empresa.statusCadastro !== 'APROVADO') {
        if (!String(req.body.razaoSocial || '').trim()) erros.razaoSocial = 'Campo obrigatório.';
        if (!validarCNPJ(req.body.cnpj)) erros.cnpj = 'CNPJ inválido.';
      }
      if (Object.keys(erros).length) {
        if (req.file) removerArquivoSeguro(req.file.path, 'empresas');
        return renderizarPerfil(req, res, { erros, valores: req.body, status: 422 });
      }
      empresa.nomeFantasia = req.body.nomeFantasia;
      if (empresa.statusCadastro !== 'APROVADO') {
        empresa.cnpj = somenteNumeros(req.body.cnpj);
        empresa.razaoSocial = req.body.razaoSocial;
      }
      empresa.endereco = endereco;
      empresa.telefone = req.body.telefone;
      empresa.emailContato = req.body.emailContato;
      empresa.responsavel = { nome: req.body.responsavelNome, cargo: req.body.responsavelCargo };
      empresa.descricao = req.body.descricao;
      empresa.migracaoPendente = false;
      if (req.file) empresa.logo = metadadosUpload(req.file);
      await empresa.save();
      if (req.file && logoAnterior) removerArquivoSeguro(logoAnterior, 'empresas');
      mensagem(req, 'sucesso', 'Perfil da empresa atualizado.');
      res.redirect('/empresa/perfil');
    } catch (erro) {
      if (req.file) removerArquivoSeguro(req.file.path, 'empresas');
      return renderizarPerfil(req, res, { erros: { geral: 'Não foi possível atualizar o perfil.' }, valores: req.body, status: 422 });
    }
  }

  static async removerLogo(req, res) {
    const empresa = await empresaLogada(req);
    if (!empresa) return res.status(404).render('erro/404');
    const caminho = empresa.logo?.caminho;
    empresa.logo = undefined;
    await empresa.save();
    if (caminho) removerArquivoSeguro(caminho, 'empresas');
    mensagem(req, 'sucesso', 'Logo removida.');
    res.redirect('/empresa/perfil');
  }

  static async candidatos(req, res) {
    const empresa = await empresaLogada(req);
    const vaga = await Vaga.findOne({ _id: req.params.vagaId, empresa: empresa._id });
    if (!vaga) return res.status(403).render('erro/403');
    const candidaturas = await Candidatura.find({ vaga: vaga._id }).populate({ path: 'estudante', populate: ['usuario', 'curso', 'campus'] }).sort('-dataCandidatura');
    res.render('empresa/candidatos', { vaga, candidaturas });
  }

  static async candidato(req, res) {
    const empresa = await empresaLogada(req);
    const candidatura = await Candidatura.findById(req.params.id).populate({ path: 'estudante', populate: ['usuario', 'curso', 'campus'] }).populate('vaga');
    if (!candidatura || String(candidatura.vaga.empresa) !== String(empresa._id)) return res.status(403).render('erro/403');
    const termo = await Termo.findOne({ candidatura: candidatura._id });
    res.render('empresa/candidato', { candidatura, termo, proximosStatus: proximosStatusCandidatura(candidatura.status) });
  }
}
