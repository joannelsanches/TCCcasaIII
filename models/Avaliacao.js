import mongoose from '../config/conexao.js';

const schema = new mongoose.Schema(
    {
        estudante: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Estudante',
            required: true
        },
        empresa: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Empresa',
            required: true
        },
        vaga: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vaga',
            required: true
        },
        autor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true
        },
        tipo: {
            type: String,
            enum: ['AVALIACAO_ESTUDANTE', 'AVALIACAO_EMPRESA'],
            required: true
        },
        nota: {
            type: Number,
            min: 1,
            max: 5,
            required: true,
            validate: {
                validator: Number.isInteger,
                message: 'A nota deve ser um número inteiro de 1 a 5.'
            }
        },
        comentario: {
            type: String,
            required: true,
            trim: true
        },
        data: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);
schema.index(
    { estudante: 1, vaga: 1, tipo: 1 },
    { unique: true }
);
export default mongoose.model('Avaliacao', schema);
