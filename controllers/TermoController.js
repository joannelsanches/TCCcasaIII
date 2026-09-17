import { resolve } from 'node:path';
import Termo from '../models/TermoCompromisso.js';
import Candidatura from '../models/Candidatura.js';
import Estudante from '../models/Estudante.js';
import Empresa from '../models/Empresa.js';
import { estudanteLogado, empresaLogada } from '../utils/perfis.js';
import { caminhoPertenceAPasta, metadadosUpload, removerArquivoSeguro } from '../utils/arquivos.js';
import { mensagem, voltarComErro } from '../utils/mensagens.js';
import { validarCPF } from '../utils/validacoes.js';
import { assinaturasTceCompletas, estudanteMenorNaData, papeisObrigatoriosTce } from '../utils/assinaturas.js';
import { buscarConvenioVigente } from '../services/convenios.js';
import { criarNotificacao } from '../services/notificacoes.js';
import { registrarHistoricoStatus } from '../utils/processoEstagio.js';
import {
  DOCUMENTOS_OBRIGATORIOS_INICIAIS,
  TIPOS_DOCUMENTO_TERMO,
  documentosObrigatoriosAprovados,
  statusDocumento
} from '../utils/documentosTermo.js';

function dadosInstitucionaisDoEnv() {
  return {
    nome: String(process.env.INSTITUICAO_NOME || 'Instituto Federal de Educação, Ciência e Tecnologia Sul-rio-grandense').trim(),
    campus: String(process.env.INSTITUICAO_CAMPUS || 'Campus Bagé').trim(),
    cnpj: String(process.env.INSTITUICAO_CNPJ || '').trim(),
    representante: String(process.env.INSTITUICAO_REPRESENTANTE || '').trim()
  };
}

export function completarDadosInstitucionais(termo) {
  const atuais = termo.instituicaoEnsino || {};
  const configurados = dadosInstitucionaisDoEnv();
  termo.instituicaoEnsino = {
    nome: String(atuais.nome || '').trim() || configurados.nome,
    campus: String(atuais.campus || '').trim() || configurados.campus,
    cnpj: String(atuais.cnpj || '').trim() || configurados.cnpj,
    representante: String(atuais.representante || '').trim() || configurados.representante
  };
  return termo;
}

function assinaturasDoFormulario(body) {
  const dados = [
    ['ESTUDANTE', body.assinaturaEstudanteNome, body.assinaturaEstudanteFuncao || 'Estudante', body.assinaturaEstudanteData],
    ['RESPONSAVEL_LEGAL', body.assinaturaResponsavelNome, body.assinaturaResponsavelFuncao || 'Responsável legal', body.assinaturaResponsavelData],
    ['EMPRESA', body.assinaturaEmpresaNome, body.assinaturaEmpresaFuncao, body.assinaturaEmpresaData],
    ['INSTITUICAO', body.assinaturaInstituicaoNome, body.assinaturaInstituicaoFuncao, body.assinaturaInstituicaoData]
  ];
  return dados
    .filter(([, nome]) => String(nome || '').trim())
    .map(([papel, nome, funcao, dataAssinatura]) => ({ papel, nome, funcao, dataAssinatura: dataAssinatura || undefined }));
}

function validarTermoParaEnvio(termo) {
  const tipos = new Set((termo.documentos || []).filter((documento) => documento.caminho).map((documento) => documento.tipo));
  const faltantes = DOCUMENTOS_OBRIGATORIOS_INICIAIS.filter((tipo) => !tipos.has(tipo));
  if (faltantes.length) return `Envie os documentos obrigatórios: ${faltantes.map((tipo) => tipo.replaceAll('_', ' ')).join(', ')}.`;
  if (!termo.tceAssinado?.caminho) return 'Envie o PDF real do TCE assinado.';
  if (!assinaturasTceCompletas(termo)) return `Registre os signatários obrigatórios: ${papeisObrigatoriosTce(termo).join(', ')}.`;
  if (!termo.professorOrientador?.nome || !termo.professorOrientador?.email) return 'Informe o professor orientador.';
  if (!termo.supervisorEmpresa?.nome || (!termo.supervisorEmpresa?.formacao && !termo.supervisorEmpresa?.experiencia)) return 'Os dados do supervisor estão incompletos.';
  if (!termo.seguro?.seguradora || !termo.seguro?.numeroApolice || !termo.seguro?.responsavel) return 'Informe os dados completos do seguro.';
  if (!termo.seguro?.vigenciaInicio || !termo.seguro?.vigenciaFim) return 'Informe a vigência completa do seguro.';
  const variaveisInstitucionais = {
    nome: 'INSTITUICAO_NOME',
    campus: 'INSTITUICAO_CAMPUS',
    cnpj: 'INSTITUICAO_CNPJ',
    representante: 'INSTITUICAO_REPRESENTANTE'
  };
  const ausentes = Object.entries(variaveisInstitucionais)
    .filter(([campo]) => !String(termo.instituicaoEnsino?.[campo] || '').trim())
    .map(([, variavel]) => variavel);
  if (ausentes.length) return `Configure ${ausentes.join(', ')} no .env e reinicie o servidor antes de enviar para análise.`;
  if (!termo.periodo?.inicio || !termo.periodo?.fim || !termo.jornada?.cargaDiaria || !termo.jornada?.cargaSemanal) return 'Período ou jornada do estágio incompletos.';
  return '';
}

async function termoPermitido(req, id) {
  const termo = await Termo.findById(id).populate('estudante empresa');
  if (!termo) return null;
  if (req.session.usuario.tipo === 'ADMIN') return termo;
  if (req.session.usuario.tipo === 'ESTUDANTE' && String(termo.estudante.usuario) === req.session.usuario.id) return termo;
  if (req.session.usuario.tipo === 'EMPRESA' && String(termo.empresa.usuario) === req.session.usuario.id) return termo;
  return false;
}

async function notificarEstudante(termo, titulo, texto, tipoEvento) {
  const estudante = await Estudante.findById(termo.estudante).select('usuario');
  if (!estudante?.usuario) return;
  await criarNotificacao({
    destinatario: estudante.usuario,
    titulo,
    mensagem: texto,
    link: '/termos',
    tipoEvento,
    referencia: termo._id,
    chaveUnica: `${tipoEvento}:${termo._id}:${termo.historicoStatus?.length || 0}`
  });
}

async function carregarPaginaTermos(req) {
  let filtro = {};
  let view = 'admin/termos';
  if (req.session.usuario.tipo === 'ESTUDANTE') {
    const estudante = await estudanteLogado(req);
    filtro.estudante = estudante._id;
    view = 'estudante/termos';
  }
  if (req.session.usuario.tipo === 'EMPRESA') {
    const empresa = await empresaLogada(req);
    filtro.empresa = empresa._id;
    view = 'empresa/termos';
  }
  const termos = await Termo.find(filtro)
    .populate({ path: 'candidatura', populate: 'vaga' })
    .populate({ path: 'estudante', populate: ['usuario', 'curso'] })
    .populate('empresa curso')
    .sort('-dataSolicitacao');
  let selecionadas = [];
  if (req.session.usuario.tipo === 'ESTUDANTE') {
    const estudante = await estudanteLogado(req);
    const usadas = termos.map((termo) => termo.candidatura?._id).filter(Boolean);
    selecionadas = await Candidatura.find({ estudante: estudante._id, status: 'SELECIONADO', _id: { $nin: usadas } }).populate({ path: 'vaga', populate: 'empresa' });
  }
  return { view, termos, selecionadas };
}

async function renderizarPaginaTermos(req, res, { erros = {}, valores = {}, status = 200 } = {}) {
  const pagina = await carregarPaginaTermos(req);
  return res.status(status).render(pagina.view, {
    ...pagina,
    documentosMinimos: DOCUMENTOS_OBRIGATORIOS_INICIAIS,
    erros,
    valores
  });
}

export default class TermoController {
  static async listar(req, res) {
    return renderizarPaginaTermos(req, res);
  }

  static async solicitar(req, res) {
    try {
      const estudante = await Estudante.findOne({ usuario: req.session.usuario.id }).populate('curso');
      if (!estudante?.matriculaRegular) return renderizarPaginaTermos(req, res, { erros: { geral: 'A matrícula precisa estar regular para solicitar o termo.' }, valores: req.body, status: 422 });
      if (!estudante.dataNascimento) return renderizarPaginaTermos(req, res, { erros: { geral: 'Informe sua data de nascimento no perfil antes de solicitar o termo.' }, valores: req.body, status: 422 });
      if (await Termo.exists({ estudante: estudante._id, status: 'APROVADO', situacaoEstagio: { $in: ['NAO_INICIADO', 'EM_ANDAMENTO'] } })) return renderizarPaginaTermos(req, res, { erros: { geral: 'Já existe um estágio aprovado ou em andamento.' }, valores: req.body, status: 422 });
      const candidatura = await Candidatura.findOne({ _id: req.body.candidatura, estudante: estudante._id, status: 'SELECIONADO' }).populate({ path: 'vaga', populate: 'empresa' });
      if (!candidatura) return renderizarPaginaTermos(req, res, { erros: { candidatura: 'A candidatura precisa estar selecionada.' }, valores: req.body, status: 422 });
      const vaga = candidatura.vaga;
      if (vaga.modalidadeEstagio === 'OBRIGATORIO' && Number(estudante.semestre || 0) < Number(estudante.curso.regrasEstagio?.periodoMinimoObrigatorio || 1)) return renderizarPaginaTermos(req, res, { erros: { candidatura: 'Você ainda não atingiu o período mínimo configurado para estágio obrigatório.' }, valores: req.body, status: 422 });
      const convenio = await buscarConvenioVigente(vaga.empresa._id);
      if (estudante.curso.regrasEstagio?.exigeConvenio !== false && !convenio) return renderizarPaginaTermos(req, res, { erros: { candidatura: 'O convênio assinado da empresa não está vigente ou precisa de regularização.' }, valores: req.body, status: 422 });
      const professor = {
        nome: req.body.orientadorNome,
        cargo: req.body.orientadorCargo,
        formacao: req.body.orientadorFormacao,
        email: req.body.orientadorEmail,
        telefone: req.body.orientadorTelefone
      };
      const erros = {};
      if (!professor.nome) erros.orientadorNome = 'Informe o nome do professor orientador.';
      if (!professor.email || !/^\S+@\S+\.\S+$/.test(professor.email)) erros.orientadorEmail = 'Informe um e-mail válido do professor orientador.';
      for (const campo of ['seguroResponsavel', 'seguradora', 'numeroApolice', 'seguroVigenciaInicio', 'seguroVigenciaFim']) {
        if (!req.body[campo]) erros[campo] = 'Campo obrigatório.';
      }
      if (req.body.seguroVigenciaInicio && req.body.seguroVigenciaFim && new Date(req.body.seguroVigenciaFim) < new Date(req.body.seguroVigenciaInicio)) erros.seguroVigenciaFim = 'A vigência final deve ser posterior à inicial.';
      if (estudanteMenorNaData(estudante.dataNascimento, vaga.periodoInicio)) {
        if (!req.body.representanteLegalNome) erros.representanteLegalNome = 'Informe o responsável legal.';
        if (!validarCPF(req.body.representanteLegalCpf)) erros.representanteLegalCpf = 'Informe um CPF válido do responsável legal.';
      }
      if (Object.keys(erros).length) return renderizarPaginaTermos(req, res, { erros, valores: req.body, status: 422 });
      const termo = await Termo.create({
        candidatura: candidatura._id,
        estudante: estudante._id,
        empresa: vaga.empresa._id,
        curso: estudante.curso._id,
        matricula: estudante.matricula,
        estudanteDataNascimento: estudante.dataNascimento,
        concedente: {
          razaoSocial: vaga.empresa.razaoSocial,
          cnpj: vaga.empresa.cnpj,
          representante: vaga.empresa.responsavel?.nome,
          cargoRepresentante: vaga.empresa.responsavel?.cargo
        },
        instituicaoEnsino: dadosInstitucionaisDoEnv(),
        representanteLegal: { nome: req.body.representanteLegalNome, cpf: req.body.representanteLegalCpf },
        professorOrientador: professor,
        supervisorEmpresa: vaga.supervisor,
        modalidade: vaga.modalidadeEstagio,
        planoAtividades: vaga.atividades || req.body.planoAtividades,
        periodo: { inicio: vaga.periodoInicio, fim: vaga.periodoFim },
        jornada: {
          cargaDiaria: vaga.cargaHorariaDiaria,
          cargaSemanal: vaga.cargaHorariaSemanal || vaga.cargaHoraria,
          diasSemana: vaga.diasSemana,
          horarioInicio: vaga.horarioInicio,
          horarioFim: vaga.horarioFim,
          intervalo: vaga.intervalo,
          reducaoEmAvaliacoes: vaga.reducaoJornadaAvaliacoes !== false
        },
        bolsa: vaga.bolsa,
        auxilioTransporte: vaga.auxilioTransporte,
        outrosBeneficios: vaga.outrosBeneficios,
        seguro: {
          responsavel: req.body.seguroResponsavel,
          seguradora: req.body.seguradora,
          numeroApolice: req.body.numeroApolice,
          vigenciaInicio: req.body.seguroVigenciaInicio,
          vigenciaFim: req.body.seguroVigenciaFim
        },
        status: 'RASCUNHO',
        historicoStatus: [{ status: 'RASCUNHO', data: new Date(), alteradoPor: req.session.usuario.id, observacao: 'Rascunho criado.' }]
      });
      const empresa = await Empresa.findById(termo.empresa).select('usuario');
      if (empresa?.usuario) {
        await criarNotificacao({
          destinatario: empresa.usuario,
          titulo: 'Termo em preparação',
          mensagem: 'Um estudante selecionado iniciou o rascunho do termo de compromisso.',
          link: '/termos',
          tipoEvento: 'TERMO_RASCUNHO',
          referencia: termo._id,
          chaveUnica: `TERMO_RASCUNHO:${termo._id}`,
          enviarPorEmail: false
        });
      }
      mensagem(req, 'sucesso', 'Rascunho criado. Envie o TCE assinado e complete o checklist documental.');
      return res.redirect('/termos');
    } catch (erro) {
      return renderizarPaginaTermos(req, res, {
        erros: { geral: erro.code === 11000 ? 'Já existe um termo para esta candidatura.' : 'Não foi possível criar o termo.' },
        valores: req.body,
        status: erro.code === 11000 ? 422 : 500
      });
    }
  }

  static async enviarDocumento(req, res) {
    const estudante = await estudanteLogado(req);
    const termo = await Termo.findOne({
      _id: req.params.id,
      estudante: estudante._id,
      status: { $in: ['RASCUNHO', 'AGUARDANDO_ASSINATURAS', 'REPROVADO', 'APROVADO'] },
      situacaoEstagio: { $in: ['NAO_INICIADO', 'EM_ANDAMENTO'] }
    });
    if (!termo || !req.file) {
      if (req.file) removerArquivoSeguro(req.file.path, 'documentos');
      return voltarComErro(req, res, 'Termo ou PDF inválido.', '/termos');
    }
    if (!TIPOS_DOCUMENTO_TERMO.includes(req.body.tipoDocumento)) {
      removerArquivoSeguro(req.file.path, 'documentos');
      return voltarComErro(req, res, 'Tipo de documento inválido.', '/termos');
    }
    const acompanhamento = ['RELATORIO', 'TERMO_ADITIVO', 'TERMO_REALIZACAO', 'TERMO_RESCISAO', 'OUTRO'];
    if (termo.status === 'APROVADO' && !acompanhamento.includes(req.body.tipoDocumento)) {
      removerArquivoSeguro(req.file.path, 'documentos');
      return voltarComErro(req, res, 'Após a aprovação, envie somente documentos de acompanhamento ou encerramento.', '/termos');
    }
    const anterior = [...termo.documentos].reverse().find((documento) => documento.tipo === req.body.tipoDocumento && documento.status === 'REJEITADO');
    const caminhoAnterior = anterior?.caminho;
    if (anterior) {
      Object.assign(anterior, {
        nome: req.body.nomeDocumento || anterior.nome,
        ...metadadosUpload(req.file),
        status: 'ENVIADO',
        dataEnvio: new Date(),
        dataAnalise: undefined,
        analisadoPor: undefined,
        motivoRejeicao: '',
        validado: false
      });
    } else {
      termo.documentos.push({
        tipo: req.body.tipoDocumento,
        nome: req.body.nomeDocumento || 'Documento do estágio',
        ...metadadosUpload(req.file),
        status: 'ENVIADO',
        dataEnvio: new Date(),
        validado: false
      });
    }
    if (termo.status === 'REPROVADO') termo.status = termo.tceAssinado?.caminho ? 'AGUARDANDO_ASSINATURAS' : 'RASCUNHO';
    await termo.save();
    if (caminhoAnterior) removerArquivoSeguro(caminhoAnterior, 'documentos');
    mensagem(req, 'sucesso', anterior ? 'Documento rejeitado substituído.' : 'Documento enviado para o checklist.');
    return res.redirect('/termos');
  }

  static async enviarTceAssinado(req, res) {
    const estudante = await estudanteLogado(req);
    const termo = await Termo.findOne({ _id: req.params.id, estudante: estudante._id, status: { $in: ['RASCUNHO', 'AGUARDANDO_ASSINATURAS', 'REPROVADO'] } });
    if (!termo || !req.file) {
      if (req.file) removerArquivoSeguro(req.file.path, 'documentos');
      return voltarComErro(req, res, 'Selecione o PDF assinado do TCE.', '/termos');
    }
    const anterior = termo.tceAssinado?.caminho;
    termo.tceAssinado = metadadosUpload(req.file);
    termo.assinaturas = assinaturasDoFormulario(req.body);
    termo.status = 'AGUARDANDO_ASSINATURAS';
    termo.regularizacaoAssinaturasPendente = !assinaturasTceCompletas(termo);
    termo.justificativa = '';
    registrarHistoricoStatus(termo, 'AGUARDANDO_ASSINATURAS', req.session.usuario.id, 'TCE assinado anexado e signatários registrados.');
    await termo.save();
    if (anterior) removerArquivoSeguro(anterior, 'documentos');
    const empresa = await Empresa.findById(termo.empresa).select('usuario');
    if (empresa?.usuario) {
      await criarNotificacao({
        destinatario: empresa.usuario,
        titulo: 'Termo aguardando assinaturas',
        mensagem: termo.regularizacaoAssinaturasPendente
          ? 'O TCE foi anexado, mas ainda faltam signatários obrigatórios.'
          : 'O TCE assinado e os signatários foram registrados e aguardam o envio para análise.',
        link: '/termos',
        tipoEvento: 'TERMO_AGUARDANDO_ASSINATURAS',
        referencia: termo._id,
        chaveUnica: `TERMO_AGUARDANDO_ASSINATURAS:${termo._id}:${termo.historicoStatus.length}`
      });
    }
    mensagem(req, 'sucesso', termo.regularizacaoAssinaturasPendente ? 'TCE salvo. Ainda faltam signatários obrigatórios.' : 'TCE assinado e signatários registrados.');
    return res.redirect('/termos');
  }

  static async enviarAnalise(req, res) {
    const estudante = await estudanteLogado(req);
    const termo = await Termo.findOne({ _id: req.params.id, estudante: estudante._id, status: { $in: ['RASCUNHO', 'AGUARDANDO_ASSINATURAS', 'REPROVADO'] } });
    if (!termo) return res.status(404).render('erro/404');
    completarDadosInstitucionais(termo);
    const erro = validarTermoParaEnvio(termo);
    if (erro) return voltarComErro(req, res, erro, '/termos');
    termo.status = 'PENDENTE';
    termo.justificativa = '';
    termo.dataEnvioAnalise = new Date();
    termo.regularizacaoAssinaturasPendente = false;
    termo.documentos.forEach((documento) => {
      if (documento.status === 'ENVIADO') documento.status = 'EM_ANALISE';
    });
    registrarHistoricoStatus(termo, 'PENDENTE', req.session.usuario.id, 'Enviado para análise institucional.');
    await termo.save();
    mensagem(req, 'sucesso', 'Termo e checklist enviados para análise institucional.');
    return res.redirect('/termos');
  }

  static async documento(req, res) {
    const termo = await Termo.findOne({ 'documentos._id': req.params.documentoId }).populate('estudante empresa');
    if (!termo) return res.status(404).render('erro/404');
    const permitido = await termoPermitido(req, termo._id);
    if (!permitido) return res.status(403).render('erro/403');
    const documento = termo.documentos.id(req.params.documentoId);
    if (!documento || !caminhoPertenceAPasta(documento.caminho, 'documentos')) return res.status(403).render('erro/403');
    return res.download(resolve(documento.caminho), documento.nomeOriginal);
  }

  static async tceAssinado(req, res) {
    const termo = await termoPermitido(req, req.params.id);
    if (termo === false) return res.status(403).render('erro/403');
    if (!termo) return res.status(404).render('erro/404');
    if (!termo.tceAssinado?.caminho || !caminhoPertenceAPasta(termo.tceAssinado.caminho, 'documentos')) return res.status(404).render('erro/404');
    return res.download(resolve(termo.tceAssinado.caminho), termo.tceAssinado.nomeOriginal);
  }

  static async validarDocumento(req, res) {
    const termo = await Termo.findById(req.params.id);
    const documento = termo?.documentos.id(req.params.documentoId);
    if (!termo || !documento) return res.status(404).render('erro/404');
    if (!['PENDENTE', 'APROVADO'].includes(termo.status)) return voltarComErro(req, res, 'O documento não está em uma etapa de análise.', '/termos');
    const aprovar = req.body.decisao === 'aprovar';
    const motivo = String(req.body.motivoRejeicao || '').trim();
    if (!aprovar && !motivo) return voltarComErro(req, res, 'Informe o motivo da rejeição do documento.', '/termos');
    documento.status = aprovar ? 'APROVADO' : 'REJEITADO';
    documento.validado = aprovar;
    documento.dataAnalise = new Date();
    documento.analisadoPor = req.session.usuario.id;
    documento.motivoRejeicao = aprovar ? '' : motivo;
    if (aprovar && documento.tipo === 'RELATORIO') {
      const proximo = new Date();
      proximo.setMonth(proximo.getMonth() + Number(termo.periodicidadeRelatoriosMeses || 6));
      termo.proximoRelatorio = proximo > new Date(termo.periodo.fim) ? termo.periodo.fim : proximo;
    }
    await termo.save();
    if (!aprovar) await notificarEstudante(termo, 'Documento rejeitado', `O documento “${documento.nome || documento.tipo}” precisa ser substituído. Motivo: ${motivo}`, 'DOCUMENTO_REJEITADO');
    mensagem(req, 'sucesso', `Documento ${aprovar ? 'aprovado' : 'rejeitado'}.`);
    return res.redirect('/termos');
  }

  static async analisar(req, res) {
    const termo = await Termo.findOne({ _id: req.params.id, status: 'PENDENTE' }).populate('estudante candidatura empresa curso');
    if (!termo) return voltarComErro(req, res, 'O termo não está aguardando análise.', '/termos');
    completarDadosInstitucionais(termo);
    const aprovar = req.body.decisao === 'aprovar';
    if (!aprovar && !String(req.body.justificativa || '').trim()) return voltarComErro(req, res, 'Informe a justificativa.', '/termos');
    if (aprovar) {
      const erro = validarTermoParaEnvio(termo);
      if (erro) return voltarComErro(req, res, erro, '/termos');
      if (!documentosObrigatoriosAprovados(termo)) return voltarComErro(req, res, 'Aprove individualmente todos os documentos obrigatórios antes do termo.', '/termos');
      const confirmacoes = ['compatibilidadeCursoPpc', 'jornadaHorarioEscolar', 'supervisorApto', 'instalacoesAvaliadas'];
      if (confirmacoes.some((campo) => req.body[campo] !== 'on')) return voltarComErro(req, res, 'Confirme todas as validações institucionais.', '/termos');
      if (!termo.estudante.matriculaRegular) return voltarComErro(req, res, 'A matrícula do estudante não está validada.', '/termos');
      if (await Termo.exists({ _id: { $ne: termo._id }, estudante: termo.estudante._id, status: 'APROVADO', situacaoEstagio: { $in: ['NAO_INICIADO', 'EM_ANDAMENTO'] } })) return voltarComErro(req, res, 'O estudante já possui outro estágio aprovado ou em andamento.', '/termos');
      if (termo.empresa.statusCadastro !== 'APROVADO') return voltarComErro(req, res, 'O cadastro da empresa não está aprovado.', '/termos');
      const convenioVigente = await buscarConvenioVigente(termo.empresa._id);
      if (termo.curso?.regrasEstagio?.exigeConvenio !== false && !convenioVigente) return voltarComErro(req, res, 'O convênio assinado não está vigente.', '/termos');
      if (Number(termo.jornada.cargaDiaria) > Number(termo.curso?.regrasEstagio?.cargaHorariaDiariaMaxima || 6) || Number(termo.jornada.cargaSemanal) > Number(termo.curso?.regrasEstagio?.cargaHorariaSemanalMaxima || 30)) return voltarComErro(req, res, 'A jornada ultrapassa a regra do curso.', '/termos');
      if (termo.modalidade === 'NAO_OBRIGATORIO' && (Number(termo.bolsa) <= 0 || Number(termo.auxilioTransporte) <= 0)) return voltarComErro(req, res, 'Estágio não obrigatório exige bolsa e auxílio-transporte.', '/termos');
      if (Number(termo.supervisorEmpresa?.quantidadeEstagiariosAtuais || 0) >= 10) return voltarComErro(req, res, 'O supervisor já alcançou o limite de 10 estagiários.', '/termos');
      if (new Date(termo.seguro.vigenciaInicio) > new Date(termo.periodo.inicio) || new Date(termo.seguro.vigenciaFim) < new Date(termo.periodo.fim)) return voltarComErro(req, res, 'O seguro deve cobrir todo o período do estágio.', '/termos');
      termo.validacoesInstitucionais = {
        cadastroEmpresaAprovado: true,
        convenioVigente: Boolean(convenioVigente) || termo.curso?.regrasEstagio?.exigeConvenio === false,
        matriculaRegular: true,
        compatibilidadeCursoPpc: true,
        jornadaHorarioEscolar: true,
        supervisorApto: true,
        instalacoesAvaliadas: true,
        documentosCompletos: true
      };
    }
    termo.status = aprovar ? 'APROVADO' : 'REPROVADO';
    termo.justificativa = aprovar ? '' : req.body.justificativa.trim();
    termo.dataAnalise = new Date();
    termo.dataAprovacao = aprovar ? new Date() : undefined;
    registrarHistoricoStatus(termo, termo.status, req.session.usuario.id, termo.justificativa);
    await termo.save();
    await notificarEstudante(termo, 'Termo de compromisso analisado', `Seu termo foi ${aprovar ? 'aprovado' : 'reprovado'}.`, aprovar ? 'TERMO_APROVADO' : 'TERMO_REPROVADO');
    mensagem(req, 'sucesso', 'Análise do termo registrada.');
    return res.redirect('/termos');
  }

  static async iniciar(req, res) {
    const termo = await Termo.findOne({ _id: req.params.id, status: 'APROVADO', situacaoEstagio: 'NAO_INICIADO' }).populate('estudante candidatura');
    if (!termo) return voltarComErro(req, res, 'O termo ainda não está aprovado ou o estágio já iniciou.', '/termos');
    if (!termo.tceAssinado?.caminho || !assinaturasTceCompletas(termo) || !documentosObrigatoriosAprovados(termo)) return voltarComErro(req, res, 'O TCE assinado, os signatários e os documentos obrigatórios precisam estar validados.', '/termos');
    if (new Date(termo.periodo.inicio) > new Date()) return voltarComErro(req, res, 'O estágio não pode iniciar antes do período previsto.', '/termos');
    termo.situacaoEstagio = 'EM_ANDAMENTO';
    termo.dataInicioEfetivo = new Date();
    registrarHistoricoStatus(termo, 'ESTAGIO_EM_ANDAMENTO', req.session.usuario.id, 'Início registrado após aprovação documental.');
    const proximo = new Date(termo.dataInicioEfetivo);
    proximo.setMonth(proximo.getMonth() + Number(termo.periodicidadeRelatoriosMeses || 6));
    termo.proximoRelatorio = proximo > new Date(termo.periodo.fim) ? termo.periodo.fim : proximo;
    await termo.save();
    const existe = termo.estudante.historicoEstagios.some((item) => String(item.vaga) === String(termo.candidatura.vaga));
    if (!existe) {
      termo.estudante.historicoEstagios.push({ vaga: termo.candidatura.vaga, empresa: termo.empresa, dataInicio: termo.dataInicioEfetivo });
      await termo.estudante.save();
    }
    mensagem(req, 'sucesso', 'Início do estágio registrado.');
    return res.redirect('/termos');
  }

  static async encerrar(req, res) {
    const termo = await Termo.findOne({ _id: req.params.id, status: 'APROVADO', situacaoEstagio: 'EM_ANDAMENTO' }).populate('estudante candidatura');
    if (!termo) return voltarComErro(req, res, 'O estágio não está em andamento.', '/termos');
    const tiposAprovados = new Set(termo.documentos.filter((documento) => statusDocumento(documento) === 'APROVADO').map((documento) => documento.tipo));
    if (!tiposAprovados.has('RELATORIO') || !tiposAprovados.has('TERMO_REALIZACAO')) return voltarComErro(req, res, 'Aprove ao menos um relatório e o termo de realização antes de encerrar.', '/termos');
    termo.situacaoEstagio = 'ENCERRADO';
    termo.dataEncerramento = new Date();
    registrarHistoricoStatus(termo, 'ESTAGIO_ENCERRADO', req.session.usuario.id, 'Encerramento registrado.');
    await termo.save();
    const historico = termo.estudante.historicoEstagios.find((item) => String(item.vaga) === String(termo.candidatura.vaga));
    if (historico) { historico.dataFim = termo.dataEncerramento; await termo.estudante.save(); }
    mensagem(req, 'sucesso', 'Encerramento do estágio registrado.');
    return res.redirect('/termos');
  }

  static async rescindir(req, res) {
    const termo = await Termo.findOne({ _id: req.params.id, status: 'APROVADO', situacaoEstagio: 'EM_ANDAMENTO' }).populate('estudante candidatura');
    if (!termo) return voltarComErro(req, res, 'O estágio não está em andamento.', '/termos');
    if (!String(req.body.justificativa || '').trim()) return voltarComErro(req, res, 'Informe o motivo da rescisão.', '/termos');
    if (!termo.documentos.some((documento) => documento.tipo === 'TERMO_RESCISAO' && statusDocumento(documento) === 'APROVADO')) return voltarComErro(req, res, 'Aprove o termo de rescisão antes de registrar a rescisão.', '/termos');
    termo.situacaoEstagio = 'RESCINDIDO';
    termo.justificativa = req.body.justificativa.trim();
    termo.dataEncerramento = new Date();
    registrarHistoricoStatus(termo, 'ESTAGIO_RESCINDIDO', req.session.usuario.id, termo.justificativa);
    await termo.save();
    const historico = termo.estudante.historicoEstagios.find((item) => String(item.vaga) === String(termo.candidatura.vaga));
    if (historico) { historico.dataFim = termo.dataEncerramento; await termo.estudante.save(); }
    mensagem(req, 'sucesso', 'Rescisão do estágio registrada.');
    return res.redirect('/termos');
  }
}
