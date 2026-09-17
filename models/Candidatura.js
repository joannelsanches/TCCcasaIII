import mongoose from '../config/conexao.js';
import { historicoStatusSchema } from './schemasComuns.js';

const schema = new mongoose.Schema({
    estudante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Estudante',
      required: true
    },
    vaga: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vaga',
      required: true
    },
    dataCandidatura: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: [
        'EM_ANALISE',
        'ENTREVISTA',
        'AGUARDANDO_DOCUMENTOS',
        'SELECIONADO',
        'NAO_SELECIONADO',
        'CANCELADO'
      ],
      default: 'EM_ANALISE'
    },
    observacaoEmpresa: {
      type: String,
      trim: true
    },
    dataCancelamento: Date,
    motivoCancelamento: { type: String, trim: true, maxlength: 500 },
    historicoStatus: [historicoStatusSchema]
  },
  {
    timestamps: true
  }
);

schema.pre('validate', function preencherHistoricoInicial() {
  if (this.isNew && !this.historicoStatus?.length) {
    this.historicoStatus = [{ status: this.status || 'EM_ANALISE', data: this.dataCandidatura || new Date() }];
  }
});

schema.index(
  { estudante: 1, vaga: 1 },
  { unique: true }
);

export default mongoose.model('Candidatura', schema);
