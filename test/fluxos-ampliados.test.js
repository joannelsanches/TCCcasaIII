import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from '../config/conexao.js';
import Candidatura from '../models/Candidatura.js';
import Convenio from '../models/Convenio.js';
import Termo from '../models/TermoCompromisso.js';
import Vaga from '../models/Vaga.js';
import { formatarNomeProprio } from '../utils/formatacao.js';
import { calcularPerfilEmpresa, calcularPerfilEstudante } from '../utils/perfilCompleto.js';
import {
  STATUS_CANDIDATURA,
  montarLinhaTempoEstagio,
  podeTransicionarCandidatura,
  registrarHistoricoStatus
} from '../utils/processoEstagio.js';
import {
  documentosObrigatoriosAprovados,
  montarChecklistDocumentos,
  statusDocumento
} from '../utils/documentosTermo.js';
import {
  assinaturasConvenioCompletas,
  assinaturasTceCompletas,
  estudanteMenorNaData,
  papeisObrigatoriosTce
} from '../utils/assinaturas.js';
import { convenioPodeSerAtivado } from '../services/convenios.js';
import { enviarEmail } from '../services/emailService.js';
import { chaveAvisoIntervalo } from '../services/rotinasAutomaticas.js';

const oid = () => new mongoose.Types.ObjectId();
const fonte = (arquivo) => readFileSync(join(process.cwd(), arquivo), 'utf8');

test('nomes próprios mantêm conectores em minúsculas', () => {
  assert.equal(formatarNomeProprio('  joÃO   DA silva e souza '), 'João da Silva e Souza');
  assert.equal(formatarNomeProprio('empresa exemplo'), 'Empresa Exemplo');
  assert.equal(formatarNomeProprio('maria d\'ávila'), "Maria D'Ávila");
});

test('status da candidatura incluem as novas etapas e estados finais', () => {
  assert.deepEqual(STATUS_CANDIDATURA, [
    'EM_ANALISE',
    'ENTREVISTA',
    'AGUARDANDO_DOCUMENTOS',
    'SELECIONADO',
    'NAO_SELECIONADO',
    'CANCELADO'
  ]);
  assert.equal(podeTransicionarCandidatura('EM_ANALISE', 'ENTREVISTA'), true);
  assert.equal(podeTransicionarCandidatura('ENTREVISTA', 'AGUARDANDO_DOCUMENTOS'), true);
  assert.equal(podeTransicionarCandidatura('AGUARDANDO_DOCUMENTOS', 'SELECIONADO'), true);
  assert.equal(podeTransicionarCandidatura('SELECIONADO', 'EM_ANALISE'), false);
  assert.equal(podeTransicionarCandidatura('CANCELADO', 'SELECIONADO'), false);
});

test('histórico registra status, autor, observação e data', () => {
  const documento = {};
  const autor = oid();
  registrarHistoricoStatus(documento, 'ENTREVISTA', autor, 'Entrevista marcada');
  assert.equal(documento.historicoStatus.length, 1);
  assert.equal(documento.historicoStatus[0].status, 'ENTREVISTA');
  assert.equal(String(documento.historicoStatus[0].alteradoPor), String(autor));
  assert.equal(documento.historicoStatus[0].observacao, 'Entrevista marcada');
  assert.ok(documento.historicoStatus[0].data instanceof Date);
});

test('model de candidatura cria histórico inicial automaticamente', async () => {
  const candidatura = new Candidatura({ estudante: oid(), vaga: oid() });
  await candidatura.validate();
  assert.equal(candidatura.historicoStatus.length, 1);
  assert.equal(candidatura.historicoStatus[0].status, 'EM_ANALISE');
});

test('linha do tempo usa status reais e interrompe cancelamentos', () => {
  const criada = new Date('2026-01-10T12:00:00Z');
  const cancelada = new Date('2026-01-11T12:00:00Z');
  const etapas = montarLinhaTempoEstagio({
    status: 'CANCELADO',
    dataCandidatura: criada,
    dataCancelamento: cancelada,
    historicoStatus: [{ status: 'CANCELADO', data: cancelada }]
  });
  assert.equal(etapas[0].estado, 'CONCLUIDA');
  assert.equal(etapas[1].estado, 'INTERROMPIDA');
  assert.equal(etapas[2].estado, 'PENDENTE');
});

test('linha do tempo avança até o encerramento somente com dados registrados', () => {
  const candidatura = {
    status: 'SELECIONADO',
    dataCandidatura: new Date('2026-01-01T12:00:00Z'),
    historicoStatus: [{ status: 'SELECIONADO', data: new Date('2026-01-03T12:00:00Z') }]
  };
  const termo = {
    status: 'APROVADO',
    situacaoEstagio: 'ENCERRADO',
    dataEnvioAnalise: new Date('2026-01-05T12:00:00Z'),
    dataAprovacao: new Date('2026-01-06T12:00:00Z'),
    dataInicioEfetivo: new Date('2026-02-01T12:00:00Z'),
    dataEncerramento: new Date('2026-08-01T12:00:00Z')
  };
  assert.deepEqual(
    montarLinhaTempoEstagio(candidatura, termo).map((item) => item.estado),
    ['CONCLUIDA', 'CONCLUIDA', 'CONCLUIDA', 'CONCLUIDA', 'CONCLUIDA', 'CONCLUIDA']
  );
});

test('vaga incompleta pode ser rascunho, mas não pode ser enviada', async () => {
  await assert.doesNotReject(() => new Vaga({ empresa: oid(), status: 'RASCUNHO' }).validate());
  await assert.rejects(() => new Vaga({ empresa: oid(), status: 'PENDENTE_VALIDACAO' }).validate());
});

test('duplicação de vaga cria rascunho e não reutiliza imagem nem datas', () => {
  const controller = fonte('controllers/VagaController.js');
  assert.match(controller, /status:\s*'RASCUNHO'/u);
  assert.match(controller, /imagem:\s*undefined/u);
  assert.match(controller, /prazo:\s*undefined/u);
  assert.match(controller, /periodoInicio:\s*undefined/u);
  assert.match(controller, /periodoFim:\s*undefined/u);
  assert.match(controller, /empresa:\s*empresa\._id/u);
});

test('cancelamento de candidatura é restrito ao estado EM_ANALISE e preserva o registro', () => {
  const controller = fonte('controllers/CandidaturaController.js');
  assert.match(controller, /candidatura\.status !== 'EM_ANALISE'/u);
  assert.match(controller, /Termo\.exists\(\{ candidatura:/u);
  assert.match(controller, /candidatura\.status = 'CANCELADO'/u);
  assert.match(controller, /dataCancelamento = new Date/u);
  assert.doesNotMatch(controller, /findOneAndDelete/u);
});

test('checklist converte documentos legados e exige todos os itens iniciais', () => {
  assert.equal(statusDocumento({ caminho: 'arquivo.pdf', validado: true }), 'APROVADO');
  assert.equal(statusDocumento({ caminho: 'arquivo.pdf', validado: false }), 'ENVIADO');
  assert.equal(statusDocumento(null), 'FALTANDO');

  const documentos = ['PLANO_ATIVIDADES', 'APOLICE_SEGURO', 'COMPROVANTE_MATRICULA', 'AVALIACAO_INSTALACOES']
    .map((tipo) => ({ tipo, status: 'APROVADO', caminho: `${tipo}.pdf` }));
  const termo = { status: 'PENDENTE', tceAssinado: { caminho: 'tce.pdf' }, documentos };
  const checklist = montarChecklistDocumentos(termo);
  assert.equal(checklist.filter((item) => item.obrigatorio).length, 5);
  assert.equal(documentosObrigatoriosAprovados(termo), true);
  termo.documentos[0].status = 'REJEITADO';
  assert.equal(documentosObrigatoriosAprovados(termo), false);
});

test('convênio só pode ser ativado com PDF, assinaturas e vigência válida', () => {
  const base = {
    dataInicial: new Date('2026-01-01T12:00:00Z'),
    dataFinal: new Date('2027-01-01T12:00:00Z'),
    assinaturas: [
      { papel: 'EMPRESA', nome: 'Responsável', dataAssinatura: new Date() },
      { papel: 'INSTITUICAO', nome: 'Representante', dataAssinatura: new Date() }
    ]
  };
  assert.match(convenioPodeSerAtivado(base), /PDF/u);
  const completo = { ...base, pdfAssinado: { caminho: 'documentos/convenio.pdf' } };
  assert.equal(assinaturasConvenioCompletas(completo), true);
  assert.equal(convenioPodeSerAtivado(completo), '');
  assert.match(convenioPodeSerAtivado({ ...completo, dataFinal: base.dataInicial }), /vigência/u);
});

test('model de convênio aceita rascunho incompleto e exige dados fora dele', async () => {
  await assert.doesNotReject(() => new Convenio({ empresa: oid(), status: 'RASCUNHO' }).validate());
  await assert.rejects(() => new Convenio({ empresa: oid(), status: 'PENDENTE' }).validate());
});

test('TCE exige estudante, empresa, instituição e responsável quando menor', () => {
  const referencia = new Date('2026-02-01T12:00:00Z');
  assert.equal(estudanteMenorNaData(new Date('2010-03-01T12:00:00Z'), referencia), true);
  assert.equal(estudanteMenorNaData(new Date('2000-03-01T12:00:00Z'), referencia), false);

  const termo = {
    estudanteDataNascimento: new Date('2010-03-01T12:00:00Z'),
    periodo: { inicio: referencia },
    assinaturas: ['ESTUDANTE', 'EMPRESA', 'INSTITUICAO'].map((papel) => ({ papel, nome: papel, dataAssinatura: referencia }))
  };
  assert.ok(papeisObrigatoriosTce(termo).includes('RESPONSAVEL_LEGAL'));
  assert.equal(assinaturasTceCompletas(termo), false);
  termo.assinaturas.push({ papel: 'RESPONSAVEL_LEGAL', nome: 'Responsável', dataAssinatura: referencia });
  assert.equal(assinaturasTceCompletas(termo), true);
});

test('models do termo guardam PDF assinado, assinaturas e análise individual', () => {
  for (const caminho of [
    'tceAssinado.caminho',
    'assinaturas.papel',
    'documentos.status',
    'documentos.dataAnalise',
    'documentos.analisadoPor',
    'documentos.motivoRejeicao',
    'historicoStatus.status'
  ]) assert.ok(Termo.schema.path(caminho), caminho);
});

test('conclusão do perfil informa percentual e campos faltantes', () => {
  const estudante = calcularPerfilEstudante({
    cpf: '1', matricula: '2', curso: oid(), campus: oid(), semestre: 2, turno: 'MANHA',
    dataNascimento: new Date(), telefone: '1', endereco: { cidade: 'Bagé' }, disponibilidade: 'Manhã',
    competencias: ['JavaScript'], fotoPerfil: { caminho: 'foto.jpg' }, curriculo: {}
  }, { nome: 'Aluno' });
  assert.equal(estudante.percentual, 93);
  assert.deepEqual(estudante.faltantes, ['currículo']);

  const empresa = calcularPerfilEmpresa({
    razaoSocial: 'Empresa Ltda.', nomeFantasia: 'Empresa', cnpj: '1', telefone: '1',
    emailContato: 'contato@example.com', endereco: { cidade: 'Bagé' }, responsavel: { nome: 'Pessoa', cargo: 'Cargo' },
    descricao: 'Descrição', logo: {}
  });
  assert.equal(empresa.percentual, 89);
  assert.deepEqual(empresa.faltantes, ['logo']);
});

test('ViaCEP preenche endereço com fetch e mantém validação local', () => {
  const javascript = fonte('public/js/app.js');
  assert.match(javascript, /https:\/\/viacep\.com\.br\/ws\/\$\{cep\}\/json\//u);
  assert.match(javascript, /Consultando CEP/u);
  assert.match(javascript, /CEP não encontrado/u);
  assert.match(javascript, /AbortController/u);
  assert.match(javascript, /logradouro/u);
  assert.match(javascript, /bairro/u);
  assert.match(javascript, /localidade/u);
  assert.match(javascript, /uf/u);
  assert.match(fonte('utils/endereco.js'), /\^\\d\{8\}\$/u);
});

test('grade de vagas possui quatro, três, duas e uma coluna responsiva', () => {
  const css = fonte('public/css/style.css');
  assert.match(css, /\.jobs-grid\s*\{[^}]*repeat\(4,/su);
  assert.match(css, /max-width:\s*1200px[\s\S]*\.jobs-grid[^}]*repeat\(3,/u);
  assert.match(css, /max-width:\s*980px[\s\S]*\.jobs-grid[^}]*repeat\(2,/u);
  assert.match(css, /max-width:\s*680px[\s\S]*\.jobs-grid[^}]*grid-template-columns:\s*1fr/u);
  assert.match(css, /-webkit-line-clamp/u);
});

test('página inicial oferece entrada visível no conteúdo e no menu móvel', () => {
  const inicio = fonte('views/public/inicio.ejs');
  const cabecalho = fonte('views/partials/cabecalho.ejs');
  const css = fonte('public/css/style.css');
  assert.match(inicio, /href="\/login"[\s\S]*Entrar/u);
  assert.match(cabecalho, /mobile-login[\s\S]*href="\/login"/u);
  assert.match(css, /\.mobile-login\s*\{\s*display:\s*inline-flex/u);
});

test('notificações têm filtros, contador e alteração em POST', () => {
  const controller = fonte('controllers/NotificacaoController.js');
  const rotas = fonte('routes/NotificacaoRoutes.js');
  const app = fonte('app.js');
  assert.match(controller, /\['todas', 'nao_lidas', 'lidas'\]/u);
  assert.match(controller, /destinatario:\s*req\.session\.usuario\.id/u);
  assert.match(rotas, /router\.post\('\/notificacoes\/marcar-todas-lidas'/u);
  assert.match(app, /notificacoesNaoLidas/u);
  assert.match(app, /lida:\s*false/u);
});

test('busca administrativa combina perfis, escapa regex e pagina no banco', () => {
  const controller = fonte('controllers/AdminController.js');
  assert.match(controller, /escaparRegex/u);
  assert.match(controller, /Estudante\.find/u);
  assert.match(controller, /Empresa\.find/u);
  assert.match(controller, /\.skip\(/u);
  assert.match(controller, /\.limit\(/u);
  assert.match(controller, /countDocuments/u);
});

test('e-mail desativado não falha quando SMTP não está configurado', async () => {
  const anteriorHost = process.env.SMTP_HOST;
  const anteriorFrom = process.env.EMAIL_FROM;
  delete process.env.SMTP_HOST;
  delete process.env.EMAIL_FROM;
  try {
    const resultado = await enviarEmail({ para: 'teste@example.com', assunto: 'Teste', mensagem: 'Teste', link: '/notificacoes' });
    assert.deepEqual(resultado, { enviado: false, ignorado: true, erro: 'SMTP não configurado' });
  } finally {
    if (anteriorHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = anteriorHost;
    if (anteriorFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = anteriorFrom;
  }
});

test('chave dos avisos permanece estável dentro da faixa configurada', () => {
  const primeira = chaveAvisoIntervalo('DOCUMENTOS', 'termo-1', new Date('2026-01-02T12:00:00Z'), 5);
  const repetida = chaveAvisoIntervalo('DOCUMENTOS', 'termo-1', new Date('2026-01-04T12:00:00Z'), 5);
  const futura = chaveAvisoIntervalo('DOCUMENTOS', 'termo-1', new Date('2026-01-08T12:00:00Z'), 5);
  assert.equal(primeira, repetida);
  assert.notEqual(primeira, futura);
  assert.match(fonte('services/notificacoes.js'), /intervaloMinimoDias/u);
});

test('rotina automática fecha vagas, vence convênios e possui lock', () => {
  const servico = fonte('services/rotinasAutomaticas.js');
  assert.match(servico, /status:\s*'ABERTA',\s*prazo:\s*\{ \$lt: hoje \}/u);
  assert.match(servico, /status:\s*'FECHADA'/u);
  assert.match(servico, /status:\s*'ATIVO',\s*dataFinal:\s*\{ \$lt: hoje \}/u);
  assert.match(servico, /status:\s*'VENCIDO'/u);
  assert.match(servico, /executando:\s*true/u);
  assert.match(servico, /bloqueadoAte/u);
});

test('migração preserva dados e modo simulação não executa alterações', () => {
  const migracao = fonte('scripts/migrar-dados.js');
  assert.match(migracao, /process\.argv\.includes\('--simular'\)/u);
  assert.match(migracao, /if \(!simular\)/u);
  assert.match(migracao, /regularizacaoPendente:\s*true/u);
  assert.match(migracao, /AGUARDANDO_ASSINATURAS/u);
  assert.match(migracao, /APROVADO/u);
  assert.match(migracao, /ENVIADO/u);
});

test('principais formulários exibem erros por campo e controllers retornam 422', () => {
  for (const view of [
    'views/auth/login.ejs',
    'views/auth/cadastro-estudante.ejs',
    'views/auth/cadastro-empresa.ejs',
    'views/estudante/perfil.ejs',
    'views/empresa/perfil.ejs',
    'views/empresa/vaga-form.ejs',
    'views/admin/convenios.ejs',
    'views/estudante/termos.ejs',
    'views/estudante/avaliacoes.ejs',
    'views/empresa/avaliacoes.ejs'
  ]) assert.match(fonte(view), /field-error/u, view);

  for (const controller of [
    'controllers/AuthController.js',
    'controllers/EstudanteController.js',
    'controllers/EmpresaController.js',
    'controllers/VagaController.js',
    'controllers/ConvenioController.js',
    'controllers/TermoController.js',
    'controllers/AvaliacaoController.js'
  ]) assert.match(fonte(controller), /422/u, controller);
});

test('aplicação Express inicializa e responde por HTTP sem consultar o banco', async (t) => {
  const { default: app } = await import('../app.js');
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => servidor.close());
  await once(servidor, 'listening');

  const endereco = servidor.address();
  const resposta = await fetch(`http://127.0.0.1:${endereco.port}/rota-inexistente`);
  assert.equal(resposta.status, 404);
  assert.match(await resposta.text(), /não encontrada|404/iu);
});
