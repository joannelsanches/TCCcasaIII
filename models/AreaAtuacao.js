import mongoose from '../config/conexao.js';

const schema = new mongoose.Schema(
    {
        nome: {
            type: String,
            required: true,
            unique: true,
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

export default mongoose.model('AreaAtuacao', schema);