import bcrypt from 'bcryptjs';
import Usuario from '../models/Usuario.js';
import Estudante from '../models/Estudante.js';
import Empresa from '../models/Empresa.js';
import Curso from '../models/Curso.js';
import Campus from '../models/Campus.js';
import { emailInstitucionalValido, somenteNumeros, validarCNPJ, validarCPF } from '../utils/validacoes.js';
import { errosEndereco, normalizarEndereco } from '../utils/endereco.js';
import { metadadosUpload, removerArquivoSeguro } from '../utils/arquivos.js';
import { mensagem, voltarComErro } from '../utils/mensagens.js';

async function opcoesEstudante() {
  const [cursos, campi] = await Promise.all([
    Curso.find({ ativo: true }).sort('nome'),
    Campus.find({ ativo: true }).sort('nome')
  ]);
  return { cursos, campi };
}

function valoresSemSenha(body) {
  const { senha, confirmarSenha, ...valores } = body;
  return valores;
}

function temErros(erros) {
  return Object.keys(erros).length > 0;
}

export default class AuthController {
  static loginForm(req, res) { res.render('auth/login', { valores: {}, erros: {} }); }
  static escolhaCadastro(req, res) { res.render('auth/escolha-cadastro'); }

  static async cadastroEstudanteForm(req, res) {
    res.render('auth/cadastro-estudante', { ...await opcoesEstudante(), valores: {}, erros: {} });
  }

  static async cadastroEmpresaForm(req, res) { res.render('auth/cadastro-empresa', { valores: {}, erros: {} }); }

  static async cadastrarEstudante(req, res) {
    let usuario;
    try {
      const { nome, email, senha, confirmarSenha, cpf, matricula, curso, campus } = req.body;
      const erros = {};
      for (const campo of ['nome', 'email', 'cpf', 'matricula', 'curso', 'campus']) if (!req.body[campo]) erros[campo] = 'Campo obrigatório.';
      if (!senha) erros.senha = 'Informe uma senha.';
      else if (senha.length < 8) erros.senha = 'Use pelo menos 8 caracteres.';
      if (senha !== confirmarSenha) erros.confirmarSenha = 'As senhas não coincidem.';
      if (email && !emailInstitucionalValido(email)) erros.email = 'Use um e-mail institucional permitido.';
      if (cpf && !validarCPF(cpf)) erros.cpf = 'CPF inválido.';
      if (temErros(erros)) return res.status(422).render('auth/cadastro-estudante', { ...await opcoesEstudante(), erros, valores: valoresSemSenha(req.body) });
      usuario = await Usuario.create({ nome, email, senhaHash: await bcrypt.hash(senha, 12), tipo: 'ESTUDANTE' });
      await Estudante.create({ usuario: usuario._id, cpf: somenteNumeros(cpf), matricula, curso, campus });
      mensagem(req, 'sucesso', 'Cadastro realizado. Agora você pode entrar.');
      return res.redirect('/login');
    } catch (erro) {
      if (usuario) await Usuario.findByIdAndDelete(usuario._id);
      const erros = { geral: erro.code === 11000 ? 'E-mail, CPF ou matrícula já cadastrado.' : 'Não foi possível realizar o cadastro.' };
      return res.status(erro.code === 11000 ? 422 : 500).render('auth/cadastro-estudante', { ...await opcoesEstudante(), erros, valores: valoresSemSenha(req.body) });
    }
  }

  static async cadastrarEmpresa(req, res) {
    let usuario;
    const falhar = (erros, status = 422) => {
      if (req.file) removerArquivoSeguro(req.file.path, 'empresas');
      return res.status(status).render('auth/cadastro-empresa', { erros, valores: valoresSemSenha(req.body) });
    };
    try {
      const { nome, email, senha, confirmarSenha, cnpj, razaoSocial, nomeFantasia, telefone, emailContato, responsavelNome, responsavelCargo } = req.body;
      const endereco = normalizarEndereco(req.body, 'endereco');
      const erros = errosEndereco(endereco, 'endereco');
      for (const campo of ['nome', 'email', 'cnpj', 'razaoSocial', 'nomeFantasia', 'telefone', 'responsavelNome', 'responsavelCargo']) if (!req.body[campo]) erros[campo] = 'Campo obrigatório.';
      if (!senha) erros.senha = 'Informe uma senha.';
      else if (senha.length < 8) erros.senha = 'Use pelo menos 8 caracteres.';
      if (senha !== confirmarSenha) erros.confirmarSenha = 'As senhas não coincidem.';
      if (cnpj && !validarCNPJ(cnpj)) erros.cnpj = 'CNPJ inválido.';
      if (temErros(erros)) return falhar(erros);
      usuario = await Usuario.create({ nome, email, senhaHash: await bcrypt.hash(senha, 12), tipo: 'EMPRESA' });
      await Empresa.create({
        usuario: usuario._id,
        cnpj: somenteNumeros(cnpj),
        razaoSocial,
        nomeFantasia,
        endereco,
        telefone,
        emailContato: emailContato || email,
        responsavel: { nome: responsavelNome, cargo: responsavelCargo },
        descricao: req.body.descricao,
        logo: metadadosUpload(req.file)
      });
      mensagem(req, 'sucesso', 'Empresa cadastrada. O convênio será analisado pelo IFSul.');
      return res.redirect('/login');
    } catch (erro) {
      if (usuario) await Usuario.findByIdAndDelete(usuario._id);
      if (req.file) removerArquivoSeguro(req.file.path, 'empresas');
      return falhar({ geral: erro.code === 11000 ? 'E-mail ou CNPJ já cadastrado.' : 'Não foi possível cadastrar a empresa.' }, erro.code === 11000 ? 422 : 500);
    }
  }

  static async entrar(req, res) {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const usuario = await Usuario.findOne({ email }).select('+senhaHash');
      if (!email) return res.status(422).render('auth/login', { erros: { email: 'Informe o e-mail.' }, valores: { email } });
      if (!req.body.senha) return res.status(422).render('auth/login', { erros: { senha: 'Informe a senha.' }, valores: { email } });
      if (!usuario || !(await bcrypt.compare(req.body.senha || '', usuario.senhaHash))) return res.status(422).render('auth/login', { erros: { geral: 'E-mail ou senha inválidos.' }, valores: { email } });
      if (!usuario.ativo) return res.status(403).render('auth/login', { erros: { geral: 'Esta conta está inativa. Procure o setor de estágios.' }, valores: { email } });
      await new Promise((resolve, reject) => req.session.regenerate((erro) => erro ? reject(erro) : resolve()));
      req.session.usuario = { id: String(usuario._id), nome: usuario.nome, tipo: usuario.tipo, funcaoAdministrativa: usuario.funcaoAdministrativa };
      const destinos = { ESTUDANTE: '/estudante', EMPRESA: '/empresa', ADMIN: '/admin' };
      return res.redirect(destinos[usuario.tipo]);
    } catch (erro) { return res.status(500).render('auth/login', { erros: { geral: 'Não foi possível entrar.' }, valores: { email: String(req.body.email || '') } }); }
  }

  static sair(req, res) { req.session.destroy(() => res.redirect('/')); }
}
