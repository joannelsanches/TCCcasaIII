import Usuario from '../models/Usuario.js';
import Estudante from '../models/Estudante.js';
import Empresa from '../models/Empresa.js';
import Vaga from '../models/Vaga.js';
import Candidatura from '../models/Candidatura.js';
import Convenio from '../models/Convenio.js';
import Termo from '../models/TermoCompromisso.js';
import Curso from '../models/Curso.js';
import Campus from '../models/Campus.js';
import AreaAtuacao from '../models/AreaAtuacao.js';
import { mensagem, voltarComErro } from '../utils/mensagens.js';
import { escaparRegex, somenteNumeros } from '../utils/validacoes.js';

function lista(valor) {
  return Array.isArray(valor) ? valor.filter(Boolean) : [valor].filter(Boolean);
}

function dadosCurso(body) {
  return {
    nome: body.nome,
    nivel: body.nivel,
    campus: body.campus,
    areasRelacionadas: lista(body.areasRelacionadas),
    regrasEstagio: {
      periodoMinimoObrigatorio: Number(body.periodoMinimoObrigatorio || 1),
      cargaHorariaDiariaMaxima: Number(body.cargaHorariaDiariaMaxima || 6),
      cargaHorariaSemanalMaxima: Number(body.cargaHorariaSemanalMaxima || 30),
      permiteJornada40h: body.permiteJornada40h === 'on',
      exigeConvenio: body.exigeConvenio === 'on',
      permiteEstagioObrigatorio: body.permiteEstagioObrigatorio === 'on',
      permiteEstagioNaoObrigatorio: body.permiteEstagioNaoObrigatorio === 'on'
    }
  };
}

export default class AdminController {
  static async painel(req, res) {
    const [estudantes, empresas, conveniadas, vagasAbertas, vagasPendentes, emEstagio] = await Promise.all([
      Estudante.countDocuments(), Empresa.countDocuments(), Convenio.distinct('empresa', { status: 'ATIVO', dataFinal: { $gte: new Date() }, regularizacaoPendente: { $ne: true }, 'pdfAssinado.caminho': { $exists: true, $ne: '' } }),
      Vaga.countDocuments({ status: 'ABERTA' }), Vaga.countDocuments({ status: 'PENDENTE_VALIDACAO' }), Termo.countDocuments({ status: 'APROVADO', situacaoEstagio: 'EM_ANDAMENTO' })
    ]);
    res.render('admin/painel', { metricas: { estudantes, empresas, conveniadas: conveniadas.length, vagasAbertas, vagasPendentes, emEstagio } });
  }

  static async usuarios(req, res) {
    const tipo = ['ESTUDANTE', 'EMPRESA', 'ADMIN'].includes(req.query.tipo) ? req.query.tipo : '';
    const busca = String(req.query.q || '').trim();
    const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
    const porPagina = 20;
    const filtro = tipo ? { tipo } : {};
    if (busca) {
      const regex = new RegExp(escaparRegex(busca), 'i');
      const numeros = somenteNumeros(busca);
      const [estudantesEncontrados, empresasEncontradas] = await Promise.all([
        Estudante.find({
          $or: [
            { matricula: regex },
            ...(numeros ? [{ cpf: { $regex: escaparRegex(numeros) } }] : [])
          ]
        }).distinct('usuario'),
        Empresa.find({
          $or: [
            { razaoSocial: regex },
            { nomeFantasia: regex },
            ...(numeros ? [{ cnpj: { $regex: escaparRegex(numeros) } }] : [])
          ]
        }).distinct('usuario')
      ]);
      filtro.$or = [{ nome: regex }, { email: regex }, { _id: { $in: [...estudantesEncontrados, ...empresasEncontradas] } }];
    }
    const total = await Usuario.countDocuments(filtro);
    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    const paginaAtual = Math.min(pagina, totalPaginas);
    const usuarios = await Usuario.find(filtro).sort('-dataCriacao').skip((paginaAtual - 1) * porPagina).limit(porPagina);
    const idsUsuarios = usuarios.map((usuario) => usuario._id);
    const [estudantes, empresas] = await Promise.all([
      Estudante.find({ usuario: { $in: idsUsuarios } }).select('usuario cpf matricula matriculaRegular fotoPerfil'),
      Empresa.find({ usuario: { $in: idsUsuarios } }).select('usuario cnpj razaoSocial nomeFantasia logo')
    ]);
    const perfisEstudante = Object.fromEntries(estudantes.map((estudante) => [String(estudante.usuario), estudante]));
    const perfisEmpresa = Object.fromEntries(empresas.map((empresa) => [String(empresa.usuario), empresa]));
    res.render('admin/usuarios', {
      usuarios,
      tipo,
      busca,
      perfisEstudante,
      perfisEmpresa,
      paginacao: { pagina: paginaAtual, totalPaginas, total, porPagina }
    });
  }
  static async alternarUsuario(req, res) {
    const usuario = await Usuario.findById(req.params.id); if (!usuario) return res.status(404).render('erro/404');
    if (String(usuario._id) === req.session.usuario.id) return voltarComErro(req, res, 'Você não pode desativar sua própria conta.', '/admin/usuarios');
    usuario.ativo = !usuario.ativo; await usuario.save(); mensagem(req, 'sucesso', 'Situação do usuário atualizada.'); res.redirect('/admin/usuarios');
  }
  static async alternarMatricula(req, res) {
    const estudante = await Estudante.findOne({ usuario: req.params.id });
    if (!estudante) return res.status(404).render('erro/404');
    estudante.matriculaRegular = !estudante.matriculaRegular;
    await estudante.save();
    mensagem(req, 'sucesso', 'Situação da matrícula atualizada.');
    res.redirect('/admin/usuarios?tipo=ESTUDANTE');
  }

  static async empresas(req, res) {
    const empresas = await Empresa.find().populate('usuario').sort('nomeFantasia');
    const convenios = await Convenio.find({ empresa: { $in: empresas.map((e) => e._id) } }).sort('-dataFinal');
    const ultimoConvenio = Object.fromEntries(convenios.map((c) => [String(c.empresa), c]));
    res.render('admin/empresas', { empresas, ultimoConvenio });
  }
  static async statusEmpresa(req, res) {
    const permitidos = ['PENDENTE', 'APROVADO', 'REPROVADO'];
    if (!permitidos.includes(req.body.status)) return voltarComErro(req, res, 'Situação inválida.', '/admin/empresas');
    await Empresa.findByIdAndUpdate(req.params.id, { statusCadastro: req.body.status, dataValidacaoCadastro: new Date() });
    mensagem(req, 'sucesso', 'Cadastro da empresa atualizado.'); res.redirect('/admin/empresas');
  }

  static async cadastros(req, res) {
    const [campi, cursos, areas] = await Promise.all([Campus.find().sort('nome'), Curso.find().populate('campus areasRelacionadas').sort('nome'), AreaAtuacao.find().sort('nome')]);
    res.render('admin/cadastros', { campi, cursos, areas, areasAtivas: areas.filter((area) => area.ativo) });
  }
  static async criarCampus(req, res) { try { await Campus.create({ nome: req.body.nome, cidade: req.body.cidade }); mensagem(req, 'sucesso', 'Campus cadastrado.'); res.redirect('/admin/cadastros'); } catch { voltarComErro(req, res, 'Campus já cadastrado ou inválido.', '/admin/cadastros'); } }
  static async criarArea(req, res) { try { await AreaAtuacao.create({ nome: req.body.nome }); mensagem(req, 'sucesso', 'Área cadastrada.'); res.redirect('/admin/cadastros'); } catch { voltarComErro(req, res, 'Área já cadastrada ou inválida.', '/admin/cadastros'); } }
  static async criarCurso(req, res) {
    try {
      const dados = dadosCurso(req.body);
      if (!dados.areasRelacionadas.length) return voltarComErro(req, res, 'Selecione pelo menos uma área ativa.', '/admin/cadastros');
      const quantidadeAreas = await AreaAtuacao.countDocuments({ _id: { $in: dados.areasRelacionadas }, ativo: true });
      if (quantidadeAreas !== dados.areasRelacionadas.length) return voltarComErro(req, res, 'Selecione somente áreas ativas.', '/admin/cadastros');
      await Curso.create(dados); mensagem(req, 'sucesso', 'Curso cadastrado.'); res.redirect('/admin/cadastros');
    } catch { voltarComErro(req, res, 'Curso já cadastrado ou inválido.', '/admin/cadastros'); }
  }
  static async atualizarCurso(req, res) {
    try {
      const dados = dadosCurso(req.body);
      dados.migracaoPendente = false;
      if (!dados.areasRelacionadas.length) return voltarComErro(req, res, 'Selecione pelo menos uma área ativa.', '/admin/cadastros');
      const quantidadeAreas = await AreaAtuacao.countDocuments({ _id: { $in: dados.areasRelacionadas }, ativo: true });
      if (quantidadeAreas !== dados.areasRelacionadas.length) return voltarComErro(req, res, 'Selecione somente áreas ativas.', '/admin/cadastros');
      const curso = await Curso.findByIdAndUpdate(req.params.id, dados, { runValidators: true, new: true });
      if (!curso) return res.status(404).render('erro/404');
      mensagem(req, 'sucesso', 'Curso atualizado.'); res.redirect('/admin/cadastros');
    } catch { voltarComErro(req, res, 'Não foi possível atualizar o curso.', '/admin/cadastros'); }
  }
  static async alternarCadastro(req, res) {
    const modelos = { campus: Campus, curso: Curso, area: AreaAtuacao }; const Model = modelos[req.params.tipo];
    if (!Model) return res.status(404).render('erro/404');
    const item = await Model.findById(req.params.id); if (!item) return res.status(404).render('erro/404'); item.ativo = !item.ativo; await item.save();
    mensagem(req, 'sucesso', 'Situação atualizada.'); res.redirect('/admin/cadastros');
  }

  static async excluirCadastro(req, res) {
    const { tipo, id } = req.params;
    const modelos = { campus: Campus, curso: Curso, area: AreaAtuacao };
    const Model = modelos[tipo];
    if (!Model) return res.status(404).render('erro/404');
    const item = await Model.findById(id);
    if (!item) return res.status(404).render('erro/404');
    let dependencias = [];
    if (tipo === 'campus') {
      const [estudantes, empresas, cursos, vagas] = await Promise.all([
        Estudante.countDocuments({ campus: id }), Empresa.countDocuments({ campus: id }), Curso.countDocuments({ campus: id }), Vaga.countDocuments({ campus: id })
      ]);
      dependencias = [['estudante(s)', estudantes], ['empresa(s)', empresas], ['curso(s)', cursos], ['vaga(s)', vagas]];
    }
    if (tipo === 'curso') {
      const [estudantes, vagas, termos] = await Promise.all([
        Estudante.countDocuments({ curso: id }), Vaga.countDocuments({ cursosCompativeis: id }), Termo.countDocuments({ curso: id })
      ]);
      dependencias = [['estudante(s)', estudantes], ['vaga(s)', vagas], ['termo(s)', termos]];
    }
    if (tipo === 'area') {
      const [cursos, vagas] = await Promise.all([Curso.countDocuments({ areasRelacionadas: id }), Vaga.countDocuments({ areaAtuacao: id })]);
      dependencias = [['curso(s)', cursos], ['vaga(s)', vagas]];
    }
    const emUso = dependencias.filter(([, quantidade]) => quantidade > 0);
    if (emUso.length) {
      const texto = emUso.map(([nome, quantidade]) => `${quantidade} ${nome}`).join(', ');
      return voltarComErro(req, res, `Não foi possível excluir: o registro está em uso por ${texto}. Desative-o se necessário.`, '/admin/cadastros');
    }
    await Model.findByIdAndDelete(id);
    mensagem(req, 'sucesso', 'Registro excluído.');
    res.redirect('/admin/cadastros');
  }

  static async relatorios(req, res) {
    const filtroVaga = {};
    if (req.query.empresa) filtroVaga.empresa = req.query.empresa;
    const vagas = req.query.empresa ? await Vaga.find(filtroVaga).distinct('_id') : null;
    const filtro = {};
    if (req.query.status && ['EM_ANALISE', 'ENTREVISTA', 'AGUARDANDO_DOCUMENTOS', 'SELECIONADO', 'NAO_SELECIONADO', 'CANCELADO'].includes(req.query.status)) filtro.status = req.query.status;
    if (vagas) filtro.vaga = { $in: vagas };
    if (req.query.inicio || req.query.fim) filtro.dataCandidatura = {};
    if (req.query.inicio) filtro.dataCandidatura.$gte = new Date(req.query.inicio);
    if (req.query.fim) filtro.dataCandidatura.$lte = new Date(`${req.query.fim}T23:59:59`);
    let candidaturas = await Candidatura.find(filtro).populate({ path: 'estudante', populate: ['usuario', 'curso'] }).populate({ path: 'vaga', populate: 'empresa' }).sort('-dataCandidatura');
    if (req.query.curso) candidaturas = candidaturas.filter((c) => String(c.estudante.curso?._id) === req.query.curso);
    if (req.query.formato === 'csv') {
      const limpar = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
      const linhas = [['Estudante','Curso','Empresa','Vaga','Status','Data'], ...candidaturas.map((c) => [c.estudante.usuario.nome,c.estudante.curso?.nome,c.vaga.empresa.nomeFantasia,c.vaga.titulo,c.status,new Date(c.dataCandidatura).toLocaleDateString('pt-BR')])];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="relatorio-startif.csv"');
      return res.send('\uFEFF' + linhas.map((l) => l.map(limpar).join(';')).join('\n'));
    }
    const [cursos, empresas] = await Promise.all([Curso.find({ ativo: true }).sort('nome'), Empresa.find().sort('nomeFantasia')]);
    res.render('admin/relatorios', { candidaturas, cursos, empresas, filtros: req.query });
  }
}
