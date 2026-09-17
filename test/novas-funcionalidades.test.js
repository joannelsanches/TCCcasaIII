import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from '../config/conexao.js';
import { validarImagem, validarPdf } from '../config/upload.js';
import { caminhoPertenceAPasta, removerArquivoSeguro } from '../utils/arquivos.js';
import { formatarCep, formatarEndereco, normalizarEndereco, validarEndereco } from '../utils/endereco.js';
import { limiteJornada, proximoStatusVaga, validarDadosEstagio } from '../utils/regrasEstagio.js';
import Avaliacao from '../models/Avaliacao.js';
import Curso from '../models/Curso.js';
import Termo from '../models/TermoCompromisso.js';
import Vaga from '../models/Vaga.js';
import { completarDadosInstitucionais } from '../controllers/TermoController.js';

const oid = () => new mongoose.Types.ObjectId();
const fonte = (arquivo) => readFileSync(join(process.cwd(), arquivo), 'utf8');

test('upload aceita JPG, PNG e WebP com MIME correspondente', () => {
  assert.equal(validarImagem({ originalname: 'logo.jpg', mimetype: 'image/jpeg' }), true);
  assert.equal(validarImagem({ originalname: 'foto.png', mimetype: 'image/png' }), true);
  assert.equal(validarImagem({ originalname: 'vaga.webp', mimetype: 'image/webp' }), true);
});

test('upload rejeita executável, SVG e extensão/MIME adulterados', () => {
  assert.equal(validarImagem({ originalname: 'foto.svg', mimetype: 'image/svg+xml' }), false);
  assert.equal(validarImagem({ originalname: 'foto.exe', mimetype: 'image/jpeg' }), false);
  assert.equal(validarImagem({ originalname: 'foto.jpg', mimetype: 'application/javascript' }), false);
  assert.equal(validarPdf({ originalname: 'curriculo.exe', mimetype: 'application/pdf' }), false);
});

test('remoção de arquivo fica confinada à pasta autorizada', () => {
  const pasta = join(process.cwd(), 'uploads', 'testes');
  mkdirSync(pasta, { recursive: true });
  const arquivo = join(pasta, 'temporario.txt');
  writeFileSync(arquivo, 'teste');
  assert.equal(caminhoPertenceAPasta(arquivo, 'testes'), true);
  assert.equal(removerArquivoSeguro(arquivo, 'testes'), true);
  assert.equal(existsSync(arquivo), false);
  assert.equal(removerArquivoSeguro(join(process.cwd(), 'package.json'), 'testes'), false);
});

test('endereço é normalizado, validado e formatado', () => {
  const endereco = normalizarEndereco({ enderecoLogradouro: 'Rua A', enderecoNumero: '10', enderecoBairro: 'Centro', enderecoCidade: 'Bagé', enderecoEstado: 'rs', enderecoCep: '96400-000' }, 'endereco');
  assert.deepEqual(endereco, { logradouro: 'Rua A', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Bagé', estado: 'RS', cep: '96400000' });
  assert.equal(validarEndereco(endereco).valido, true);
  assert.equal(formatarCep(endereco.cep), '96400-000');
  assert.match(formatarEndereco(endereco), /Bagé\/RS/);
});

test('endereço é obrigatório para presencial e opcional para remoto', () => {
  assert.equal(validarEndereco({}, true).valido, false);
  assert.equal(validarEndereco({}, false).valido, true);
});

test('limite padrão de jornada é 6h diárias e 30h semanais', () => {
  assert.deepEqual(limiteJornada([{ regrasEstagio: {} }]), { limiteDiario: 6, limiteSemanal: 30, todosPermitem40: false });
});

test('40 horas depende da configuração de todos os cursos', () => {
  const regrasEstagio = { cargaHorariaDiariaMaxima: 6, cargaHorariaSemanalMaxima: 40, permiteJornada40h: true };
  assert.equal(limiteJornada([{ regrasEstagio }, { regrasEstagio }]).limiteSemanal, 40);
});

test('validação institucional bloqueia jornada, período e benefícios inválidos', () => {
  const base = { titulo: 'Vaga', descricao: 'Descrição', areaAtuacao: oid(), requisitos: 'Requisitos', atividades: 'Atividades', campus: oid(), prazo: new Date(Date.now() + 86400000), periodoInicio: new Date(Date.now() + 172800000), periodoFim: new Date(Date.now() + 864000000), cursosCompativeis: [oid()], cargaHorariaDiaria: 7, cargaHorariaSemanal: 30, diasSemana: ['SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA'], horarioInicio: '08:00', horarioFim: '14:00', modalidadeEstagio: 'NAO_OBRIGATORIO', bolsa: 1000, auxilioTransporte: 100, supervisor: { nome: 'Pessoa', cargo: 'Analista', formacao: 'TI' }, quantidadeVagas: 1 };
  assert.match(validarDadosEstagio(base, [{ regrasEstagio: {} }]), /carga diária/i);
});

test('transições de fechamento e reabertura são estritas', () => {
  assert.equal(proximoStatusVaga('ABERTA', 'fechar'), 'FECHADA');
  assert.equal(proximoStatusVaga('FECHADA', 'reabrir'), 'PENDENTE_VALIDACAO');
  assert.equal(proximoStatusVaga('CANCELADA', 'reabrir'), null);
  assert.equal(proximoStatusVaga('REPROVADA', 'reenviar'), 'PENDENTE_VALIDACAO');
});

test('model de avaliação aceita somente nota inteira de 1 a 5', async () => {
  const dados = { estudante: oid(), empresa: oid(), vaga: oid(), autor: oid(), tipo: 'AVALIACAO_ESTUDANTE', comentario: 'Boa experiência' };
  await assert.rejects(() => new Avaliacao({ ...dados, nota: 4.5 }).validate());
  await assert.rejects(() => new Avaliacao({ ...dados, nota: 6 }).validate());
  await assert.doesNotReject(() => new Avaliacao({ ...dados, nota: 5 }).validate());
});

test('curso exige pelo menos uma área relacionada', async () => {
  await assert.rejects(() => new Curso({ nome: 'Curso', nivel: 'TÉCNICO', campus: oid(), areasRelacionadas: [] }).validate());
});

test('vaga possui imagem, endereço, modalidade e jornada estruturada', () => {
  for (const caminho of ['imagem', 'localizacao.logradouro', 'modalidade', 'modalidadeEstagio', 'cargaHorariaDiaria', 'cargaHorariaSemanal', 'supervisor.nome']) assert.ok(Vaga.schema.path(caminho), caminho);
});

test('termo possui partes, seguro, jornada e situação do estágio', () => {
  for (const caminho of ['concedente.razaoSocial', 'instituicaoEnsino.nome', 'professorOrientador.nome', 'supervisorEmpresa.nome', 'seguro.numeroApolice', 'jornada.cargaSemanal', 'situacaoEstagio']) assert.ok(Termo.schema.path(caminho), caminho);
});

test('termos antigos recebem os dados institucionais ausentes do ambiente', () => {
  const anteriores = {
    nome: process.env.INSTITUICAO_NOME,
    campus: process.env.INSTITUICAO_CAMPUS,
    cnpj: process.env.INSTITUICAO_CNPJ,
    representante: process.env.INSTITUICAO_REPRESENTANTE
  };
  process.env.INSTITUICAO_NOME = 'Instituto Federal';
  process.env.INSTITUICAO_CAMPUS = 'Campus Bagé';
  process.env.INSTITUICAO_CNPJ = '10.729.992/0007-31';
  process.env.INSTITUICAO_REPRESENTANTE = 'Representante institucional';
  const termo = { instituicaoEnsino: { nome: 'Instituto Federal', campus: 'Campus Bagé', cnpj: '', representante: '' } };
  completarDadosInstitucionais(termo);
  assert.equal(termo.instituicaoEnsino.cnpj, '10.729.992/0007-31');
  assert.equal(termo.instituicaoEnsino.representante, 'Representante institucional');
  for (const [chave, valor] of Object.entries(anteriores)) {
    const nome = `INSTITUICAO_${chave.toUpperCase()}`;
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
});

test('rotas incluem remoção de imagens, reabertura e exclusão institucional', () => {
  assert.match(fonte('routes/EmpresaRoutes.js'), /logo\/remover/);
  assert.match(fonte('routes/EstudanteRoutes.js'), /foto\/remover/);
  assert.match(fonte('routes/VagaRoutes.js'), /:id\/reabrir/);
  assert.match(fonte('routes/AdminRoutes.js'), /:tipo\/:id\/excluir/);
});

test('avaliação usa radios acessíveis e não select de nota', () => {
  const parcial = fonte('views/partials/estrelas-form.ejs');
  assert.match(parcial, /type="radio"/);
  assert.match(parcial, /name="nota"/);
  assert.match(parcial, /required/);
});

test('formulários de imagem usam multipart e formatos permitidos', () => {
  for (const arquivo of ['views/auth/cadastro-empresa.ejs', 'views/empresa/perfil.ejs', 'views/estudante/perfil.ejs', 'views/empresa/vaga-form.ejs']) {
    const conteudo = fonte(arquivo);
    assert.match(conteudo, /multipart\/form-data/);
    assert.match(conteudo, /image\/webp/);
  }
});

test('formulário da vaga contém modalidades e endereço estruturado', () => {
  const conteudo = fonte('views/empresa/vaga-form.ejs');
  assert.match(conteudo, /PRESENCIAL/);
  assert.match(conteudo, /HIBRIDO/);
  assert.match(conteudo, /REMOTO/);
  assert.match(conteudo, /campos-endereco/);
});

test('views não contêm cercas Markdown literais', () => {
  assert.doesNotMatch(fonte('views/empresa/avaliacoes.ejs'), /```/);
  assert.doesNotMatch(fonte('views/auth/cadastro-estudante.ejs'), /```/);
});
