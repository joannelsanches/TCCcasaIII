import mongoose from '../config/conexao.js';
import { arquivoPdfSchema, historicoStatusSchema } from './schemasComuns.js';

function obrigatorioForaDoRascunho() {
  return this.status !== 'RASCUNHO';
}

const schema = new mongoose.Schema(
  {
    empresa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Empresa',
      required: true
    },

    numero: {
      type: String,
      required: obrigatorioForaDoRascunho,
      unique: true,
      sparse: true,
      trim: true
    },

    dataInicial: {
      type: Date,
      required: obrigatorioForaDoRascunho
    },

    dataFinal: {
      type: Date,
      required: obrigatorioForaDoRascunho
    },

    status: {
      type: String,
      enum: ['RASCUNHO', 'AGUARDANDO_ASSINATURAS', 'PENDENTE', 'ATIVO', 'REPROVADO', 'INATIVO', 'VENCIDO'],
      default: 'RASCUNHO'
    },
    pdfAssinado: arquivoPdfSchema,
    assinaturas: [{
      nome: { type: String, trim: true },
      funcao: { type: String, trim: true },
      entidade: { type: String, trim: true },
      papel: { type: String, enum: ['EMPRESA', 'INSTITUICAO'] },
      dataAssinatura: Date
    }],
    dataEnvioAnalise: Date,
    dataAprovacao: Date,
    justificativa: { type: String, trim: true },
    aprovadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    regularizacaoPendente: { type: Boolean, default: false },
    historicoStatus: [historicoStatusSchema]
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Convenio', schema);
