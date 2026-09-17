import mongoose from '../config/conexao.js';

export const arquivoImagemSchema = new mongoose.Schema({
  caminho: String,
  nomeOriginal: String,
  mimetype: String,
  dataEnvio: Date
}, { _id: false });

export const arquivoPdfSchema = new mongoose.Schema({
  caminho: String,
  nomeOriginal: String,
  mimetype: { type: String, enum: ['application/pdf'] },
  dataEnvio: Date
}, { _id: false });

export const historicoStatusSchema = new mongoose.Schema({
  status: { type: String, required: true },
  data: { type: Date, default: Date.now },
  alteradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  observacao: { type: String, trim: true }
}, { _id: true });

export const enderecoSchema = new mongoose.Schema({
  logradouro: { type: String, trim: true },
  numero: { type: String, trim: true },
  complemento: { type: String, trim: true },
  bairro: { type: String, trim: true },
  cidade: { type: String, trim: true },
  estado: { type: String, trim: true, uppercase: true, match: /^[A-Z]{2}$/ },
  cep: { type: String, trim: true, match: /^\d{8}$/ }
}, { _id: false });
