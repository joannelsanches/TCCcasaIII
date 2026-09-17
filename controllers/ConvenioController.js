import { resolve } from 'node:path';
import Convenio from '../models/Convenio.js';
import Empresa from '../models/Empresa.js';
import { empresaLogada } from '../utils/perfis.js';
import { caminhoPertenceAPasta, metadadosUpload, removerArquivoSeguro } from '../utils/arquivos.js';
import { registrarHistoricoStatus } from '../utils/processoEstagio.js';
import { assinaturasConvenioCompletas } from '../utils/assinaturas.js';
import { convenioPodeSerAtivado } from '../services/convenios.js';
import { criarNotificacao } from '../services/notificacoes.js';
import { mensagem, voltarComErro } from '../utils/mensagens.js';

function assinaturasDoFormulario(body) {
  const assinaturas = [];
  if (body.signatarioEmpresaNome) {
    assinaturas.push({
      nome: body.signatarioEmpresaNome,
      funcao: body.signatarioEmpresaFuncao,
      entidade: body.signatarioEmpresaEntidade,
      papel: 'EMPRESA',
      dataAssinatura: body.signatarioEmpresaData || undefined
    });
  }
  if (body.signatarioInstituicaoNome) {
    assinaturas.push({
      nome: body.signatarioInstituicaoNome,
      funcao: body.signatarioInstituicaoFuncao,
      entidade: body.signatarioInstituicaoEntidade || process.env.INSTITUICAO_NOME,
      papel: 'INSTITUICAO',
      dataAssinatura: body.signatarioInstituicaoData || undefined
    });
  }
  return assinaturas;
}

function datasValidas(inicio, fim) {
  return inicio && fim && new Date(fim) > new Date(inicio);
}

async function renderizarLista(res, { erros = {}, valores = {}, status = 200 } = {}) {
  const [convenios, empresas] = await Promise.all([
    Convenio.find().populate('empresa aprovadoPor').sort('-createdAt'),
    Empresa.find().sort('nomeFantasia')
  ]);
  return res.status(status).render('admin/convenios', { convenios, empresas, erros, valores });
}

async function notificarEmpresa(convenio, titulo, texto) {
  const empresa = await Empresa.findById(convenio.empresa).select('usuario');
  if (!empresa?.usuario) return;
  await criarNotificacao({
    destinatario: empresa.usuario,
    titulo,
    mensagem: texto,
    link: '/empresa',
    tipoEvento: 'STATUS_CONVENIO',
    referencia: convenio._id,
    chaveUnica: `STATUS_CONVENIO:${convenio._id}:${convenio.status}:${convenio.historicoStatus?.length || 0}`
  });
}

export default class ConvenioController {
  static async listar(req, res) {
    return renderizarLista(res);
  }

  static async salvar(req, res) {
    const assinaturas = assinaturasDoFormulario(req.body);
    const acao = req.body.acao || 'rascunho';
    const status = acao === 'enviar' ? 'PENDENTE' : acao === 'aguardar_assinaturas' ? 'AGUARDANDO_ASSINATURAS' : 'RASCUNHO';
    try {
      const erros = {};
      if (!req.body.empresa) erros.empresa = 'Selecione a empresa.';
      if (status !== 'RASCUNHO' && !req.body.numero) erros.numero = 'Informe o número do convênio.';
      if (status !== 'RASCUNHO' && !req.body.dataInicial) erros.dataInicial = 'Informe a data inicial.';
      if (status !== 'RASCUNHO' && !req.body.dataFinal) erros.dataFinal = 'Informe a data final.';
      if (req.body.dataInicial && req.body.dataFinal && !datasValidas(req.body.dataInicial, req.body.dataFinal)) erros.dataFinal = 'A data final deve ser posterior à data inicial.';
      if (Object.keys(erros).length) {
        if (req.file) removerArquivoSeguro(req.file.path, 'documentos');
        return renderizarLista(res, { erros, valores: req.body, status: 422 });
      }
      const convenio = new Convenio({
        empresa: req.body.empresa,
        numero: req.body.numero || undefined,
        dataInicial: req.body.dataInicial || undefined,
        dataFinal: req.body.dataFinal || undefined,
        status,
        pdfAssinado: metadadosUpload(req.file),
        assinaturas,
        dataEnvioAnalise: status === 'PENDENTE' ? new Date() : undefined,
        historicoStatus: [{ status, data: new Date(), alteradoPor: req.session.usuario.id, observacao: 'Convênio registrado.' }]
      });
      if (status === 'PENDENTE') {
        const erro = convenioPodeSerAtivado(convenio);
        if (erro) {
          if (req.file) removerArquivoSeguro(req.file.path, 'documentos');
          const campo = /PDF/i.test(erro) ? 'pdfAssinado' : /assinaturas/i.test(erro) ? 'assinaturas' : 'dataFinal';
          return renderizarLista(res, { erros: { [campo]: `Para enviar à análise: ${erro}` }, valores: req.body, status: 422 });
        }
      }
      await convenio.save();
      mensagem(req, 'sucesso', status === 'RASCUNHO' ? 'Rascunho do convênio salvo.' : 'Convênio registrado.');
      return res.redirect('/admin/convenios');
    } catch (erro) {
      if (req.file) removerArquivoSeguro(req.file.path, 'documentos');
      const mensagemErro = erro.code === 11000 ? 'O número do convênio já está cadastrado.' : 'Não foi possível registrar o convênio.';
      return renderizarLista(res, { erros: { [erro.code === 11000 ? 'numero' : 'geral']: mensagemErro }, valores: req.body, status: erro.code === 11000 ? 422 : 500 });
    }
  }

  static async atualizarDocumento(req, res) {
    const convenio = await Convenio.findById(req.params.id);
    if (!convenio || !req.file) {
      if (req.file) removerArquivoSeguro(req.file.path, 'documentos');
      return voltarComErro(req, res, 'Selecione um PDF válido.', '/admin/convenios');
    }
    const anterior = convenio.pdfAssinado?.caminho;
    convenio.pdfAssinado = metadadosUpload(req.file);
    const assinaturas = assinaturasDoFormulario(req.body);
    if (assinaturas.length) convenio.assinaturas = assinaturas;
    convenio.regularizacaoPendente = !assinaturasConvenioCompletas(convenio);
    if (convenio.status === 'RASCUNHO') convenio.status = 'AGUARDANDO_ASSINATURAS';
    registrarHistoricoStatus(convenio, convenio.status, req.session.usuario.id, 'PDF assinado atualizado.');
    await convenio.save();
    if (anterior) removerArquivoSeguro(anterior, 'documentos');
    mensagem(req, 'sucesso', 'PDF e signatários do convênio atualizados.');
    return res.redirect('/admin/convenios');
  }

  static async enviarAnalise(req, res) {
    const convenio = await Convenio.findOne({ _id: req.params.id, status: { $in: ['RASCUNHO', 'AGUARDANDO_ASSINATURAS', 'REPROVADO'] } });
    if (!convenio) return voltarComErro(req, res, 'O convênio não pode ser enviado nesta etapa.', '/admin/convenios');
    const erro = convenioPodeSerAtivado(convenio);
    if (erro) return voltarComErro(req, res, erro, '/admin/convenios');
    convenio.status = 'PENDENTE';
    convenio.dataEnvioAnalise = new Date();
    convenio.justificativa = '';
    convenio.regularizacaoPendente = false;
    registrarHistoricoStatus(convenio, 'PENDENTE', req.session.usuario.id, 'Enviado para análise.');
    await convenio.save();
    mensagem(req, 'sucesso', 'Convênio enviado para análise.');
    return res.redirect('/admin/convenios');
  }

  static async status(req, res) {
    const convenio = await Convenio.findById(req.params.id);
    if (!convenio) return res.status(404).render('erro/404');
    const novoStatus = String(req.body.status || '');
    const transicoes = {
      PENDENTE: ['ATIVO', 'REPROVADO'],
      ATIVO: ['INATIVO'],
      REPROVADO: ['AGUARDANDO_ASSINATURAS'],
      INATIVO: [],
      VENCIDO: []
    };
    if (!transicoes[convenio.status]?.includes(novoStatus)) return voltarComErro(req, res, 'Essa mudança de status não é permitida.', '/admin/convenios');
    if (novoStatus === 'ATIVO') {
      const erro = convenioPodeSerAtivado(convenio);
      if (erro) return voltarComErro(req, res, erro, '/admin/convenios');
      if (new Date(convenio.dataFinal) < new Date()) return voltarComErro(req, res, 'Não é possível ativar um convênio vencido.', '/admin/convenios');
      convenio.dataAprovacao = new Date();
      convenio.aprovadoPor = req.session.usuario.id;
      convenio.regularizacaoPendente = false;
    }
    if (novoStatus === 'REPROVADO' && !String(req.body.justificativa || '').trim()) return voltarComErro(req, res, 'Informe a justificativa da reprovação.', '/admin/convenios');
    convenio.status = novoStatus;
    convenio.justificativa = novoStatus === 'REPROVADO' ? req.body.justificativa.trim() : '';
    registrarHistoricoStatus(convenio, novoStatus, req.session.usuario.id, convenio.justificativa);
    await convenio.save();
    if (novoStatus === 'ATIVO') await Empresa.findByIdAndUpdate(convenio.empresa, { statusCadastro: 'APROVADO' });
    await notificarEmpresa(convenio, 'Convênio atualizado', `O convênio ${convenio.numero || ''} passou para ${novoStatus.replaceAll('_', ' ').toLowerCase()}.`);
    mensagem(req, 'sucesso', 'Situação do convênio atualizada.');
    return res.redirect('/admin/convenios');
  }

  static async pdf(req, res) {
    const convenio = await Convenio.findById(req.params.id).populate('empresa');
    if (!convenio?.pdfAssinado?.caminho) return res.status(404).render('erro/404');
    let permitido = req.session.usuario.tipo === 'ADMIN';
    if (req.session.usuario.tipo === 'EMPRESA') {
      const empresa = await empresaLogada(req);
      permitido = String(empresa?._id) === String(convenio.empresa?._id);
    }
    if (!permitido) return res.status(403).render('erro/403');
    if (!caminhoPertenceAPasta(convenio.pdfAssinado.caminho, 'documentos')) return res.status(403).render('erro/403');
    return res.download(resolve(convenio.pdfAssinado.caminho), convenio.pdfAssinado.nomeOriginal);
  }
}
