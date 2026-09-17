import Vaga from '../models/Vaga.js';
import Empresa from '../models/Empresa.js';
import Curso from '../models/Curso.js';
import Campus from '../models/Campus.js';
import AreaAtuacao from '../models/AreaAtuacao.js';
import Estudante from '../models/Estudante.js';
import { empresaLogada } from '../utils/perfis.js';
import { escaparRegex } from '../utils/validacoes.js';
import { errosEndereco, normalizarEndereco, validarEndereco } from '../utils/endereco.js';
import { metadadosUpload, removerArquivoSeguro } from '../utils/arquivos.js';
import { proximoStatusVaga, validarDadosEstagio } from '../utils/regrasEstagio.js';
import { registrarHistoricoStatus } from '../utils/processoEstagio.js';
import { existeConvenioVigente } from '../services/convenios.js';
import { criarNotificacoes } from '../services/notificacoes.js';
import { mensagem, voltarComErro } from '../utils/mensagens.js';

async function opcoes() {
  return Promise.all([
    Curso.find({ ativo: true }).populate('campus').sort('nome'),
    Campus.find({ ativo: true }).sort('nome'),
    AreaAtuacao.find({ ativo: true }).sort('nome')
  ]);
}

function lista(valor) {
  return Array.isArray(valor) ? valor.filter(Boolean) : [valor].filter(Boolean);
}

function opcional(valor, conversor = (item) => item) {
  return valor === undefined || valor === null || valor === '' ? undefined : conversor(valor);
}

function campoDoErro(texto = '') {
  const regras = [
    [/carga diária/i, 'cargaHorariaDiaria'],
    [/carga semanal/i, 'cargaHorariaSemanal'],
    [/dias/i, 'diasSemana'],
    [/horário/i, 'horarioInicio'],
    [/período/i, 'periodoInicio'],
    [/prazo/i, 'prazo'],
    [/curso/i, 'cursosCompativeis'],
    [/campus/i, 'campus'],
    [/área/i, 'areaAtuacao'],
    [/supervisor/i, 'supervisorNome'],
    [/bolsa|auxílio/i, 'bolsa'],
    [/endereço|cep|estado/i, 'localizacaoCep']
  ];
  return regras.find(([padrao]) => padrao.test(texto))?.[1] || 'geral';
}

async function renderizarFormulario(res, { vaga = null, valores = {}, erros = {}, status = 200 }) {
  const [cursos, campi, areas] = await opcoes();
  return res.status(status).render('empresa/vaga-form', { vaga, cursos, campi, areas, valores, erros });
}

function errosCamposObrigatorios(dados) {
  const erros = {};
  const textos = {
    titulo: 'Informe o título da vaga.',
    descricao: 'Informe a descrição pública.',
    areaAtuacao: 'Selecione a área de atuação.',
    requisitos: 'Informe os requisitos para candidatura.',
    atividades: 'Informe as atividades do estágio.',
    campus: 'Selecione o campus relacionado.',
    prazo: 'Informe o prazo de candidatura.',
    periodoInicio: 'Informe o início previsto.',
    periodoFim: 'Informe o fim previsto.',
    cargaHorariaDiaria: 'Informe a carga horária diária.',
    cargaHorariaSemanal: 'Informe a carga horária semanal.',
    horarioInicio: 'Informe o horário inicial.',
    horarioFim: 'Informe o horário final.',
    quantidadeVagas: 'Informe a quantidade de vagas.',
    bolsa: 'Informe o valor da bolsa, mesmo quando for zero.',
    auxilioTransporte: 'Informe o auxílio-transporte, mesmo quando for zero.'
  };
  for (const [campo, texto] of Object.entries(textos)) {
    if (dados[campo] === undefined || dados[campo] === null || dados[campo] === '') erros[campo] = texto;
  }
  if (!dados.cursosCompativeis?.length) erros.cursosCompativeis = 'Selecione pelo menos um curso compatível.';
  if (!dados.diasSemana?.length) erros.diasSemana = 'Selecione pelo menos um dia da semana.';
  if (!dados.supervisor?.nome) erros.supervisorNome = 'Informe o nome do supervisor.';
  if (!dados.supervisor?.cargo) erros.supervisorCargo = 'Informe o cargo do supervisor.';
  if (!dados.supervisor?.formacao && !dados.supervisor?.experiencia) erros.supervisorFormacao = 'Informe a formação ou a experiência do supervisor.';
  Object.assign(erros, errosEndereco(dados.localizacao, 'localizacao', dados.modalidade !== 'REMOTO'));
  return erros;
}

async function validarPublicacao(empresa, dados) {
  const erros = errosCamposObrigatorios(dados);
  if (Object.keys(erros).length) return erros;
  if (empresa.statusCadastro !== 'APROVADO') return { geral: 'O cadastro da empresa precisa estar aprovado.' };
  if (!(await existeConvenioVigente(empresa._id))) return { geral: 'É necessário possuir convênio ativo, assinado e vigente para enviar a vaga.' };
  const erro = await VagaController.validarDados(dados);
  return erro ? { [campoDoErro(erro)]: erro } : {};
}

export default class VagaController {
  static async listar(req, res) {
    const filtro = { status: 'ABERTA', prazo: { $gte: new Date() } };
    const { q, curso, campus, area, localizacao, cidade, bairro, modalidade } = req.query;
    if (curso) filtro.cursosCompativeis = curso;
    if (campus) filtro.campus = campus;
    if (area) filtro.areaAtuacao = area;
    if (modalidade) filtro.modalidade = modalidade;
    const condicoes = [];
    const termoLocal = cidade || bairro || localizacao;
    if (termoLocal) {
      const regex = { $regex: escaparRegex(termoLocal), $options: 'i' };
      const campos = localizacao
        ? [{ 'localizacao.cidade': regex }, { 'localizacao.bairro': regex }, { 'localizacao.logradouro': regex }, { localizacaoAntiga: regex }]
        : cidade ? [{ 'localizacao.cidade': regex }, { localizacaoAntiga: regex }] : [{ 'localizacao.bairro': regex }, { localizacaoAntiga: regex }];
      condicoes.push({ $or: campos });
    }
    if (q) {
      const regex = { $regex: escaparRegex(q), $options: 'i' };
      const empresas = await Empresa.find({ $or: [{ nomeFantasia: regex }, { razaoSocial: regex }] }).distinct('_id');
      condicoes.push({ $or: [{ titulo: regex }, { descricao: regex }, { requisitos: regex }, { atividades: regex }, { empresa: { $in: empresas } }] });
    }
    if (condicoes.length) filtro.$and = condicoes;
    const [vagas, cursos, campi, areas] = await Promise.all([
      Vaga.find(filtro).populate('empresa areaAtuacao campus cursosCompativeis').sort('-dataPublicacao'),
      ...await opcoes()
    ]);
    return res.render('vagas/lista', { vagas, cursos, campi, areas, filtros: req.query });
  }

  static async detalhes(req, res) {
    const vaga = await Vaga.findById(req.params.id).populate('empresa areaAtuacao campus cursosCompativeis');
    if (!vaga) return res.status(404).render('erro/404');
    if (vaga.status !== 'ABERTA') {
      let permitido = req.session.usuario?.tipo === 'ADMIN';
      if (req.session.usuario?.tipo === 'EMPRESA') {
        const empresa = await empresaLogada(req);
        permitido = String(vaga.empresa?._id) === String(empresa?._id);
      }
      if (!permitido) return res.status(404).render('erro/404');
    }
    return res.render('vagas/detalhes', { vaga });
  }

  static async minhas(req, res) {
    const empresa = await empresaLogada(req);
    const vagas = await Vaga.find({ empresa: empresa._id }).populate('areaAtuacao campus').sort('-createdAt');
    return res.render('empresa/vagas', { vagas });
  }

  static async formulario(req, res) {
    let vaga = null;
    if (req.params.id) {
      const empresa = await empresaLogada(req);
      vaga = await Vaga.findOne({ _id: req.params.id, empresa: empresa._id });
      if (!vaga) return res.status(403).render('erro/403');
      if (vaga.status === 'CANCELADA') return voltarComErro(req, res, 'Uma vaga cancelada não pode ser editada ou reaberta.', '/empresa/vagas');
    }
    return renderizarFormulario(res, { vaga, valores: {}, erros: {} });
  }

  static dados(body) {
    const semanal = opcional(body.cargaHorariaSemanal || body.cargaHoraria, Number);
    return {
      titulo: opcional(String(body.titulo || '').trim()),
      descricao: opcional(String(body.descricao || '').trim()),
      areaAtuacao: opcional(body.areaAtuacao),
      requisitos: opcional(String(body.requisitos || '').trim()),
      requisitosAcademicos: opcional(String(body.requisitosAcademicos || '').trim()),
      atividades: opcional(String(body.atividades || '').trim()),
      documentosObrigatorios: String(body.documentosObrigatorios || '').split(',').map((item) => item.trim()).filter(Boolean),
      modalidade: body.modalidade || 'PRESENCIAL',
      modalidadeEstagio: body.modalidadeEstagio || 'NAO_OBRIGATORIO',
      bolsa: opcional(body.bolsa, Number),
      auxilioTransporte: opcional(body.auxilioTransporte, Number),
      outrosBeneficios: opcional(String(body.outrosBeneficios || '').trim()),
      cargaHoraria: semanal,
      cargaHorariaDiaria: opcional(body.cargaHorariaDiaria, Number),
      cargaHorariaSemanal: semanal,
      diasSemana: lista(body.diasSemana),
      horarioInicio: opcional(body.horarioInicio),
      horarioFim: opcional(body.horarioFim),
      intervalo: opcional(body.intervalo),
      reducaoJornadaAvaliacoes: body.reducaoJornadaAvaliacoes === 'on',
      periodoInicio: opcional(body.periodoInicio),
      periodoFim: opcional(body.periodoFim),
      localizacao: normalizarEndereco(body, 'localizacao'),
      supervisor: {
        nome: opcional(body.supervisorNome),
        cargo: opcional(body.supervisorCargo),
        formacao: opcional(body.supervisorFormacao),
        experiencia: opcional(body.supervisorExperiencia),
        email: opcional(body.supervisorEmail),
        telefone: opcional(body.supervisorTelefone),
        quantidadeEstagiariosAtuais: opcional(body.supervisorQuantidadeAtual, Number) ?? 0
      },
      quantidadeVagas: opcional(body.quantidadeVagas, Number),
      cursosCompativeis: lista(body.cursosCompativeis),
      campus: opcional(body.campus),
      prazo: opcional(body.prazo)
    };
  }

  static async validarDados(dados) {
    const cursos = await Curso.find({ _id: { $in: dados.cursosCompativeis }, ativo: true });
    if (!dados.cursosCompativeis.length || cursos.length !== dados.cursosCompativeis.length) return 'Selecione somente cursos ativos.';
    const [campusAtivo, areaAtiva] = await Promise.all([
      Campus.exists({ _id: dados.campus, ativo: true }),
      AreaAtuacao.exists({ _id: dados.areaAtuacao, ativo: true })
    ]);
    if (!campusAtivo || !areaAtiva) return 'Selecione um campus e uma área de atuação ativos.';
    const erro = validarDadosEstagio(dados, cursos);
    if (erro) return erro;
    const endereco = validarEndereco(dados.localizacao, dados.modalidade !== 'REMOTO');
    if (!endereco.valido) return endereco.mensagem;
    if (dados.modalidadeEstagio === 'OBRIGATORIO' && cursos.some((curso) => curso.regrasEstagio?.permiteEstagioObrigatorio === false)) return 'Um dos cursos não permite estágio obrigatório.';
    if (dados.modalidadeEstagio === 'NAO_OBRIGATORIO' && cursos.some((curso) => curso.regrasEstagio?.permiteEstagioNaoObrigatorio === false)) return 'Um dos cursos não permite estágio não obrigatório.';
    if (Number(dados.supervisor.quantidadeEstagiariosAtuais || 0) + Number(dados.quantidadeVagas || 0) > 10) return 'O supervisor não pode acompanhar mais de 10 estagiários simultaneamente.';
    return '';
  }

  static async criar(req, res) {
    const empresa = await empresaLogada(req);
    const dados = VagaController.dados(req.body);
    const enviar = req.body.acao === 'enviar';
    try {
      if (enviar) {
        const erros = await validarPublicacao(empresa, dados);
        if (Object.keys(erros).length) {
          if (req.file) removerArquivoSeguro(req.file.path, 'vagas');
          return renderizarFormulario(res, { valores: req.body, erros, status: 422 });
        }
      }
      const status = enviar ? 'PENDENTE_VALIDACAO' : 'RASCUNHO';
      const vaga = await Vaga.create({
        ...dados,
        empresa: empresa._id,
        imagem: metadadosUpload(req.file),
        status,
        historicoStatus: [{ status, data: new Date(), alteradoPor: req.session.usuario.id, observacao: enviar ? 'Enviada para validação.' : 'Rascunho criado.' }]
      });
      mensagem(req, 'sucesso', enviar ? 'Vaga enviada para validação do IFSul.' : 'Rascunho salvo. Você pode continuar depois.');
      return res.redirect(enviar ? '/empresa/vagas' : `/empresa/vagas/${vaga._id}/editar`);
    } catch (erro) {
      if (req.file) removerArquivoSeguro(req.file.path, 'vagas');
      return renderizarFormulario(res, { valores: req.body, erros: { geral: 'Confira os dados informados.' }, status: 422 });
    }
  }

  static async editar(req, res) {
    const empresa = await empresaLogada(req);
    const vaga = await Vaga.findOne({ _id: req.params.id, empresa: empresa._id });
    if (!vaga) {
      if (req.file) removerArquivoSeguro(req.file.path, 'vagas');
      return res.status(403).render('erro/403');
    }
    if (vaga.status === 'CANCELADA') return voltarComErro(req, res, 'Vagas canceladas não podem ser alteradas.', '/empresa/vagas');
    const imagemAnterior = vaga.imagem?.caminho;
    const dados = VagaController.dados(req.body);
    const enviar = req.body.acao === 'enviar';
    try {
      if (!enviar && !['RASCUNHO', 'REPROVADA'].includes(vaga.status)) {
        if (req.file) removerArquivoSeguro(req.file.path, 'vagas');
        return voltarComErro(req, res, 'Somente rascunhos ou vagas reprovadas podem voltar a rascunho.', '/empresa/vagas');
      }
      if (enviar) {
        const erros = await validarPublicacao(empresa, dados);
        if (Object.keys(erros).length) {
          if (req.file) removerArquivoSeguro(req.file.path, 'vagas');
          return renderizarFormulario(res, { vaga, valores: req.body, erros, status: 422 });
        }
      }
      const status = enviar ? 'PENDENTE_VALIDACAO' : 'RASCUNHO';
      Object.assign(vaga, dados, {
        status,
        justificativaValidacao: enviar ? '' : vaga.justificativaValidacao,
        migracaoPendente: false
      });
      if (req.file) vaga.imagem = metadadosUpload(req.file);
      registrarHistoricoStatus(vaga, status, req.session.usuario.id, enviar ? 'Enviada para validação.' : 'Rascunho atualizado.');
      await vaga.save();
      if (req.file && imagemAnterior) removerArquivoSeguro(imagemAnterior, 'vagas');
      mensagem(req, 'sucesso', enviar ? 'Vaga enviada para validação.' : 'Rascunho atualizado.');
      return res.redirect(enviar ? '/empresa/vagas' : `/empresa/vagas/${vaga._id}/editar`);
    } catch (erro) {
      if (req.file) removerArquivoSeguro(req.file.path, 'vagas');
      return renderizarFormulario(res, { vaga, valores: req.body, erros: { geral: 'Não foi possível salvar a vaga.' }, status: 422 });
    }
  }

  static async duplicar(req, res) {
    const empresa = await empresaLogada(req);
    const original = await Vaga.findOne({ _id: req.params.id, empresa: empresa._id }).lean();
    if (!original) return res.status(403).render('erro/403');
    const campos = [
      'titulo', 'descricao', 'areaAtuacao', 'requisitos', 'requisitosAcademicos', 'atividades',
      'documentosObrigatorios', 'modalidade', 'modalidadeEstagio', 'bolsa', 'auxilioTransporte',
      'outrosBeneficios', 'cargaHoraria', 'cargaHorariaDiaria', 'cargaHorariaSemanal', 'diasSemana',
      'horarioInicio', 'horarioFim', 'intervalo', 'reducaoJornadaAvaliacoes', 'localizacao',
      'localizacaoAntiga', 'supervisor', 'quantidadeVagas', 'cursosCompativeis', 'campus'
    ];
    const copia = Object.fromEntries(campos.filter((campo) => original[campo] !== undefined).map((campo) => [campo, original[campo]]));
    copia.titulo = original.titulo ? `${original.titulo} (cópia)` : 'Cópia de vaga';
    const vaga = await Vaga.create({
      ...copia,
      empresa: empresa._id,
      status: 'RASCUNHO',
      periodoInicio: undefined,
      periodoFim: undefined,
      prazo: undefined,
      imagem: undefined,
      historicoStatus: [{ status: 'RASCUNHO', data: new Date(), alteradoPor: req.session.usuario.id, observacao: `Duplicada da vaga ${original._id}.` }]
    });
    mensagem(req, 'sucesso', 'Cópia criada como rascunho. Revise o prazo e o período antes de enviar.');
    return res.redirect(`/empresa/vagas/${vaga._id}/editar`);
  }

  static async excluirRascunho(req, res) {
    const empresa = await empresaLogada(req);
    const vaga = await Vaga.findOneAndDelete({ _id: req.params.id, empresa: empresa._id, status: 'RASCUNHO' });
    if (!vaga) return voltarComErro(req, res, 'Somente rascunhos da própria empresa podem ser excluídos.', '/empresa/vagas');
    if (vaga.imagem?.caminho) removerArquivoSeguro(vaga.imagem.caminho, 'vagas');
    mensagem(req, 'sucesso', 'Rascunho excluído.');
    return res.redirect('/empresa/vagas');
  }

  static async removerImagem(req, res) {
    const empresa = await empresaLogada(req);
    const vaga = await Vaga.findOne({ _id: req.params.id, empresa: empresa._id });
    if (!vaga) return res.status(403).render('erro/403');
    const caminho = vaga.imagem?.caminho;
    vaga.imagem = undefined;
    await vaga.save();
    if (caminho) removerArquivoSeguro(caminho, 'vagas');
    mensagem(req, 'sucesso', 'Imagem da vaga removida.');
    return res.redirect(`/empresa/vagas/${vaga._id}/editar`);
  }

  static async alterarSituacao(req, res) {
    const empresa = await empresaLogada(req);
    const vaga = await Vaga.findOne({ _id: req.params.id, empresa: empresa._id });
    if (!vaga) return res.status(403).render('erro/403');
    const novoStatus = proximoStatusVaga(vaga.status, req.body.acao);
    if (!novoStatus || ['reabrir', 'reenviar'].includes(req.body.acao)) return voltarComErro(req, res, 'Ação incompatível com a situação atual da vaga.', '/empresa/vagas');
    vaga.status = novoStatus;
    registrarHistoricoStatus(vaga, novoStatus, req.session.usuario.id, novoStatus === 'FECHADA' ? 'Fechada pela empresa.' : 'Cancelada pela empresa.');
    await vaga.save();
    mensagem(req, 'sucesso', novoStatus === 'FECHADA' ? 'Vaga fechada.' : 'Vaga cancelada.');
    return res.redirect('/empresa/vagas');
  }

  static async reabrir(req, res) {
    const empresa = await empresaLogada(req);
    const vaga = await Vaga.findOne({ _id: req.params.id, empresa: empresa._id });
    if (!vaga) return res.status(403).render('erro/403');
    if (proximoStatusVaga(vaga.status, 'reabrir') !== 'PENDENTE_VALIDACAO') return voltarComErro(req, res, 'Somente vagas fechadas podem solicitar reabertura.', '/empresa/vagas');
    if (empresa.statusCadastro !== 'APROVADO' || !(await existeConvenioVigente(empresa._id))) return voltarComErro(req, res, 'É necessário cadastro aprovado e convênio assinado vigente para reabrir.', '/empresa/vagas');
    if (!vaga.prazo || new Date(vaga.prazo) < new Date(new Date().setHours(0, 0, 0, 0))) return voltarComErro(req, res, 'Atualize o prazo encerrado antes de solicitar a reabertura.', `/empresa/vagas/${vaga._id}/editar`);
    vaga.status = 'PENDENTE_VALIDACAO';
    vaga.justificativaValidacao = '';
    registrarHistoricoStatus(vaga, 'PENDENTE_VALIDACAO', req.session.usuario.id, 'Reabertura solicitada.');
    await vaga.save();
    mensagem(req, 'sucesso', 'Reabertura enviada para nova validação administrativa.');
    return res.redirect('/empresa/vagas');
  }

  static async pendentes(req, res) {
    const vagas = await Vaga.find({ status: 'PENDENTE_VALIDACAO' }).populate('empresa areaAtuacao campus cursosCompativeis').sort('createdAt');
    return res.render('admin/vagas', { vagas });
  }

  static async validar(req, res) {
    const vaga = await Vaga.findOne({ _id: req.params.id, status: 'PENDENTE_VALIDACAO' }).populate('empresa cursosCompativeis');
    if (!vaga) return voltarComErro(req, res, 'A vaga não está aguardando validação.', '/admin/vagas');
    const aprovar = req.body.decisao === 'aprovar';
    if (!aprovar && !String(req.body.justificativa || '').trim()) return voltarComErro(req, res, 'Informe a justificativa da reprovação.', '/admin/vagas');
    if (aprovar) {
      if (vaga.migracaoPendente) return voltarComErro(req, res, 'A vaga migrada precisa ser revisada e reenviada pela empresa.', '/admin/vagas');
      if (vaga.empresa.statusCadastro !== 'APROVADO' || !(await existeConvenioVigente(vaga.empresa._id))) return voltarComErro(req, res, 'A empresa precisa ter cadastro aprovado e convênio assinado vigente.', '/admin/vagas');
      if (!vaga.prazo || new Date(vaga.prazo) < new Date(new Date().setHours(0, 0, 0, 0))) return voltarComErro(req, res, 'A vaga está com o prazo encerrado.', '/admin/vagas');
      const dadosValidacao = vaga.toObject();
      dadosValidacao.cursosCompativeis = vaga.cursosCompativeis.map((curso) => curso._id);
      const erro = await VagaController.validarDados(dadosValidacao);
      if (erro) return voltarComErro(req, res, erro, '/admin/vagas');
    }
    const status = aprovar ? 'ABERTA' : 'REPROVADA';
    vaga.status = status;
    vaga.justificativaValidacao = aprovar ? '' : req.body.justificativa.trim();
    vaga.dataUltimaValidacao = new Date();
    if (aprovar) vaga.dataPublicacao = new Date();
    registrarHistoricoStatus(vaga, status, req.session.usuario.id, aprovar ? 'Aprovada pelo setor de estágios.' : vaga.justificativaValidacao);
    await vaga.save();

    const destinatarios = aprovar
      ? await Estudante.find({ curso: { $in: vaga.cursosCompativeis.map((curso) => curso._id) } }).distinct('usuario')
      : [vaga.empresa.usuario];
    await criarNotificacoes(destinatarios, {
      titulo: aprovar ? 'Nova vaga compatível' : 'Vaga reprovada',
      mensagem: aprovar ? `A vaga “${vaga.titulo}” combina com seu curso.` : `A vaga “${vaga.titulo}” precisa de ajustes.`,
      link: aprovar ? `/vagas/${vaga._id}` : '/empresa/vagas',
      tipoEvento: aprovar ? 'VAGA_APROVADA' : 'VAGA_REPROVADA',
      referencia: vaga._id,
      chaveUnica: undefined,
      enviarPorEmail: false
    });
    mensagem(req, 'sucesso', `Vaga ${aprovar ? 'aprovada' : 'reprovada'}.`);
    return res.redirect('/admin/vagas');
  }
}
