import mongoose from '../config/conexao.js';

const schema = new mongoose.Schema({
    destinatario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    titulo: {
      type: String,
      required: true,
      trim: true
    },
    mensagem: {
      type: String,
      required: true,
      trim: true
    },
    lida: {
      type: Boolean,
      default: false
    },
    data: {
      type: Date,
      default: Date.now
    },
    link: {
      type: String,
      trim: true
    },
    dataLeitura: Date,
    tipoEvento: { type: String, trim: true },
    referencia: { type: String, trim: true },
    chaveUnica: { type: String, trim: true },
    email: {
      solicitado: { type: Boolean, default: false },
      enviado: { type: Boolean, default: false },
      dataEnvio: Date,
      erro: { type: String, trim: true }
    }
  },
  {
    timestamps: true
  }
);

schema.index({ chaveUnica: 1 }, { unique: true, sparse: true });

export default mongoose.model('Notificacao', schema);
