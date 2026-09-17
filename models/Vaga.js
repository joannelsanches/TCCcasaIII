import mongoose from '../config/conexao.js';
import { arquivoImagemSchema, enderecoSchema, historicoStatusSchema } from './schemasComuns.js';

function obrigatoriaForaDoRascunho() {
  return this.status !== 'RASCUNHO';
}

const schema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  titulo: { type: String, required: obrigatoriaForaDoRascunho, trim: true },
  descricao: { type: String, required: obrigatoriaForaDoRascunho, trim: true },
  imagem: arquivoImagemSchema,
  areaAtuacao: { type: mongoose.Schema.Types.ObjectId, ref: 'AreaAtuacao', required: obrigatoriaForaDoRascunho },
  requisitos: { type: String, required: obrigatoriaForaDoRascunho, trim: true },
  requisitosAcademicos: { type: String, trim: true },
  atividades: { type: String, trim: true },
  documentosObrigatorios: [{ type: String, trim: true }],
  modalidade: { type: String, enum: ['PRESENCIAL', 'HIBRIDO', 'REMOTO'], default: 'PRESENCIAL' },
  modalidadeEstagio: { type: String, enum: ['OBRIGATORIO', 'NAO_OBRIGATORIO'], default: 'NAO_OBRIGATORIO' },
  bolsa: { type: Number, min: 0, required: obrigatoriaForaDoRascunho },
  auxilioTransporte: { type: Number, min: 0, default: 0 },
  outrosBeneficios: { type: String, trim: true },
  cargaHoraria: { type: Number, min: 1, max: 40 },
  cargaHorariaDiaria: { type: Number, min: 1, max: 8 },
  cargaHorariaSemanal: { type: Number, min: 1, max: 40 },
  diasSemana: [{ type: String, enum: ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'] }],
  horarioInicio: { type: String, trim: true },
  horarioFim: { type: String, trim: true },
  intervalo: { type: String, trim: true },
  reducaoJornadaAvaliacoes: { type: Boolean, default: true },
  periodoInicio: Date,
  periodoFim: Date,
  localizacao: enderecoSchema,
  localizacaoAntiga: { type: String, trim: true },
  supervisor: {
    nome: { type: String, trim: true },
    cargo: { type: String, trim: true },
    formacao: { type: String, trim: true },
    experiencia: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    telefone: { type: String, trim: true },
    quantidadeEstagiariosAtuais: { type: Number, min: 0, max: 10, default: 0 }
  },
  quantidadeVagas: { type: Number, min: 1, default: 1 },
  cursosCompativeis: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Curso' }],
  campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: obrigatoriaForaDoRascunho },
  prazo: { type: Date, required: obrigatoriaForaDoRascunho },
  dataPublicacao: Date,
  status: {
    type: String,
    enum: ['RASCUNHO', 'PENDENTE_VALIDACAO', 'ABERTA', 'FECHADA', 'REPROVADA', 'CANCELADA'],
    default: 'RASCUNHO'
  },
  justificativaValidacao: { type: String, trim: true },
  dataUltimaValidacao: Date,
  motivoFechamento: { type: String, trim: true },
  historicoStatus: [historicoStatusSchema],
  migracaoPendente: { type: Boolean, default: false }
}, { timestamps: true });

schema.path('cursosCompativeis').validate(function validarCursos(cursos) {
  return this.status === 'RASCUNHO' || (Array.isArray(cursos) && cursos.length > 0);
}, 'Selecione pelo menos um curso compatível.');

export default mongoose.model('Vaga', schema);
