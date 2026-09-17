import mongoose from '../config/conexao.js';

const schema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  executando: { type: Boolean, default: false },
  bloqueadoAte: Date,
  ultimoInicio: Date,
  ultimoFim: Date,
  resultado: {
    vagasFechadas: { type: Number, default: 0 },
    conveniosVencidos: { type: Number, default: 0 },
    avisosCriados: { type: Number, default: 0 },
    erros: [{ type: String }]
  }
}, { timestamps: true });

export default mongoose.model('ExecucaoRotina', schema);
