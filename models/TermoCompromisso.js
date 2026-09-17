import mongoose from '../config/conexao.js';
import { arquivoPdfSchema, historicoStatusSchema } from './schemasComuns.js';

const pessoaAcompanhamento = {
  nome: { type: String, trim: true },
  cargo: { type: String, trim: true },
  formacao: { type: String, trim: true },
  experiencia: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  telefone: { type: String, trim: true },
  quantidadeEstagiariosAtuais: { type: Number, min: 0, max: 10, default: 0 }
};

const schema = new mongoose.Schema({
  candidatura: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidatura', required: true, unique: true },
  estudante: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudante', required: true },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  curso: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
  matricula: { type: String, trim: true },
  estudanteDataNascimento: Date,
  concedente: {
    razaoSocial: String,
    cnpj: String,
    representante: String,
    cargoRepresentante: String
  },
  instituicaoEnsino: {
    nome: { type: String, default: 'Instituto Federal de Educação, Ciência e Tecnologia Sul-rio-grandense' },
    campus: { type: String, default: 'Campus Bagé' },
    cnpj: String,
    representante: String
  },
  representanteLegal: { nome: String, cpf: String },
  professorOrientador: pessoaAcompanhamento,
  supervisorEmpresa: pessoaAcompanhamento,
  modalidade: { type: String, enum: ['OBRIGATORIO', 'NAO_OBRIGATORIO'] },
  planoAtividades: { type: String, required: true, trim: true },
  periodo: { inicio: Date, fim: Date },
  jornada: {
    cargaDiaria: Number,
    cargaSemanal: Number,
    diasSemana: [String],
    horarioInicio: String,
    horarioFim: String,
    intervalo: String,
    reducaoEmAvaliacoes: { type: Boolean, default: true }
  },
  bolsa: { type: Number, min: 0, default: 0 },
  auxilioTransporte: { type: Number, min: 0, default: 0 },
  outrosBeneficios: String,
  seguro: {
    responsavel: { type: String, enum: ['CONCEDENTE', 'INSTITUICAO', 'ESTUDANTE'] },
    seguradora: String,
    numeroApolice: String,
    vigenciaInicio: Date,
    vigenciaFim: Date
  },
  validacoesInstitucionais: {
    cadastroEmpresaAprovado: { type: Boolean, default: false },
    convenioVigente: { type: Boolean, default: false },
    matriculaRegular: { type: Boolean, default: false },
    compatibilidadeCursoPpc: { type: Boolean, default: false },
    jornadaHorarioEscolar: { type: Boolean, default: false },
    supervisorApto: { type: Boolean, default: false },
    instalacoesAvaliadas: { type: Boolean, default: false },
    documentosCompletos: { type: Boolean, default: false }
  },
  documentos: [{
    tipo: {
      type: String,
      enum: ['TCE', 'PLANO_ATIVIDADES', 'APOLICE_SEGURO', 'COMPROVANTE_MATRICULA', 'RELATORIO', 'TERMO_ADITIVO', 'TERMO_REALIZACAO', 'AVALIACAO_INSTALACOES', 'TERMO_RESCISAO', 'OUTRO'],
      default: 'OUTRO'
    },
    nome: String,
    nomeOriginal: String,
    caminho: String,
    mimetype: String,
    status: {
      type: String,
      enum: ['FALTANDO', 'ENVIADO', 'EM_ANALISE', 'APROVADO', 'REJEITADO'],
      default: 'ENVIADO'
    },
    dataEnvio: { type: Date, default: Date.now },
    dataAnalise: Date,
    analisadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    motivoRejeicao: { type: String, trim: true },
    validado: { type: Boolean, default: false }
  }],
  tceAssinado: arquivoPdfSchema,
  assinaturas: [{
    nome: { type: String, trim: true },
    papel: {
      type: String,
      enum: ['ESTUDANTE', 'RESPONSAVEL_LEGAL', 'EMPRESA', 'INSTITUICAO']
    },
    funcao: { type: String, trim: true },
    dataAssinatura: Date
  }],
  regularizacaoAssinaturasPendente: { type: Boolean, default: false },
  dataSolicitacao: { type: Date, default: Date.now },
  dataEnvioAnalise: Date,
  dataAnalise: Date,
  status: {
    type: String,
    enum: ['RASCUNHO', 'AGUARDANDO_ASSINATURAS', 'PENDENTE', 'APROVADO', 'REPROVADO'],
    default: 'RASCUNHO'
  },
  situacaoEstagio: {
    type: String,
    enum: ['NAO_INICIADO', 'EM_ANDAMENTO', 'ENCERRADO', 'RESCINDIDO'],
    default: 'NAO_INICIADO'
  },
  justificativa: { type: String, trim: true },
  dataAprovacao: Date,
  dataInicioEfetivo: Date,
  periodicidadeRelatoriosMeses: { type: Number, min: 1, max: 6, default: 6 },
  proximoRelatorio: Date,
  dataEncerramento: Date,
  historicoStatus: [historicoStatusSchema]
}, { timestamps: true });

export default mongoose.model('TermoCompromisso', schema);
