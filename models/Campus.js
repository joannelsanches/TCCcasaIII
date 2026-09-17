import mongoose from '../config/conexao.js';

const schema = new mongoose.Schema({
    nome: {
      type: String,
      required: true,
      trim: true
    },
    cidade: {
      type: String,
      required: true,
      trim: true
    },
    ativo: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);
schema.index(
  { nome: 1, cidade: 1 },
  { unique: true }
);

export default mongoose.model('Campus', schema);