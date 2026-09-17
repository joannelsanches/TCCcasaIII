import mongoose from '../config/conexao.js';

const schema = new mongoose.Schema({
    nome: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    senhaHash: {
      type: String,
      required: true,
      select: false
    },
    tipo: {
      type: String,
      enum: [
        'ESTUDANTE',
        'EMPRESA',
        'ADMIN'
      ],
      required: true
    },
    funcaoAdministrativa: {
      type: String,
      enum: [
        'ADMINISTRADOR',
        'COORDENADOR',
        'SETOR_ESTAGIOS'
      ],
      default: undefined
    },
    ativo: {
      type: Boolean,
      default: true
    },
    dataCriacao: {
      type: Date,
      default: Date.now
    }
  }
);

export default mongoose.model('Usuario', schema);