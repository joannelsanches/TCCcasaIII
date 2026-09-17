import mongoose from '../config/conexao.js';
import { arquivoImagemSchema, enderecoSchema } from './schemasComuns.js';

const schema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      unique: true
    },

    cpf: {
      type: String,
      required: true,
      unique: true
    },

    matricula: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    matriculaRegular: {
      type: Boolean,
      default: false
    },

    dataNascimento: Date,

    telefone: { type: String, trim: true },

    endereco: enderecoSchema,

    curso: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curso',
      required: true
    },

    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: true
    },

    semestre: {
      type: Number,
      min: 1,
      max: 20
    },

    turno: {
      type: String,
      enum: [
        'MANHÃ',
        'TARDE',
        'NOITE',
        'INTEGRAL'
      ]
    },

    disponibilidade: {
      type: String,
      trim: true
    },

    competencias: [
      {
        type: String,
        trim: true
      }
    ],

    curriculo: {
      caminho: String,
      nomeOriginal: String,
      mimetype: String,
      dataEnvio: Date
    },

    fotoPerfil: arquivoImagemSchema,

    historicoEstagios: [
      {
        vaga: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vaga'
        },

        empresa: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Empresa'
        },

        dataInicio: Date,

        dataFim: Date
      }
    ]
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Estudante', schema);
