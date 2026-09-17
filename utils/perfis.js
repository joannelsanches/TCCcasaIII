import Estudante from '../models/Estudante.js';
import Empresa from '../models/Empresa.js';

export const estudanteLogado = (req) => Estudante.findOne({ usuario: req.session.usuario.id });
export const empresaLogada = (req) => Empresa.findOne({ usuario: req.session.usuario.id });
