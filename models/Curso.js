import mongoose from '../config/conexao.js';

const schema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true
    },

    nivel: {
      type: String,
      enum: [
        'TÉCNICO',
        'SUPERIOR',
        'PÓS-GRADUAÇÃO'
      ],
      required: true
    },

    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: true
    },

    areasRelacionadas: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AreaAtuacao' }],
      validate: {
        validator: (areas) => Array.isArray(areas) && areas.length > 0,
        message: 'Selecione pelo menos uma área relacionada.'
      }
    },

    regrasEstagio: {
      periodoMinimoObrigatorio: { type: Number, min: 1, max: 20, default: 1 },
      cargaHorariaDiariaMaxima: { type: Number, min: 1, max: 8, default: 6 },
      cargaHorariaSemanalMaxima: { type: Number, min: 1, max: 40, default: 30 },
      permiteJornada40h: { type: Boolean, default: false },
      exigeConvenio: { type: Boolean, default: true },
      permiteEstagioObrigatorio: { type: Boolean, default: true },
      permiteEstagioNaoObrigatorio: { type: Boolean, default: true }
    },

    ativo: {
      type: Boolean,
      default: true
    },

    migracaoPendente: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

schema.index(
  { nome: 1, campus: 1 },
  { unique: true }
);

export default mongoose.model('Curso', schema);
