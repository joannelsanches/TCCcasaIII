import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import ejs from 'ejs';

const base = {
  usuarioLogado: null,
  mensagem: null,
  erros: {},
  valores: {},
  notificacoesNaoLidas: 0,
  formatarData: () => '01/01/2026',
  formatarMoeda: () => 'R$ 1.000,00',
  formatarEndereco: () => 'Bagé/RS',
  formatarLocalizacaoResumida: () => 'Bagé · RS',
  formatarCep: () => '96400-000',
  formatarNomeProprio: (nome = '') => nome,
  montarLinhaTempoEstagio: () => [],
  montarChecklistDocumentos: () => [],
  iniciais: () => 'SI'
};

async function renderizar(view, dados = {}) {
  const html = await ejs.renderFile(join(process.cwd(), 'views', view), { ...base, ...dados });
  assert.match(html, /StartIF/);
}

test('views principais renderizam com estados vazios e dados mínimos', async () => {
  await renderizar('auth/cadastro-empresa.ejs');
  await renderizar('empresa/perfil.ejs', { empresa: { _id: 'e1', nomeFantasia: 'Empresa', razaoSocial: 'Empresa Ltda.', cnpj: '00000000000000', telefone: '', emailContato: '', responsavel: {}, endereco: {}, statusCadastro: 'PENDENTE' }, convenio: null, conclusaoPerfil: { percentual: 0, faltantes: [] } });
  await renderizar('estudante/perfil.ejs', { estudante: { _id: 's1', usuario: { nome: 'Estudante' }, cpf: '', matricula: '', matriculaRegular: false, curso: null, campus: null, competencias: [], endereco: {} }, cursos: [], campi: [], conclusaoPerfil: { percentual: 0, faltantes: [] } });
  await renderizar('empresa/vaga-form.ejs', { vaga: null, cursos: [], campi: [], areas: [] });
  await renderizar('vagas/lista.ejs', { vagas: [], cursos: [], campi: [], areas: [], filtros: {} });
  await renderizar('admin/cadastros.ejs', { campi: [], cursos: [], areas: [], areasAtivas: [] });
  await renderizar('admin/usuarios.ejs', { usuarios: [], perfisEstudante: {}, perfisEmpresa: {}, tipo: '', busca: '', paginacao: { pagina: 1, totalPaginas: 1, total: 0 } });
  await renderizar('estudante/termos.ejs', { termos: [], selecionadas: [] });
  await renderizar('admin/termos.ejs', { termos: [] });
  await renderizar('empresa/avaliacoes.ejs', { candidaturas: [], avaliacoes: [] });
});
