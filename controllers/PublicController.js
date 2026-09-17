import Vaga from '../models/Vaga.js';
import Estudante from '../models/Estudante.js';
import Empresa from '../models/Empresa.js';

export default class PublicController {
  static async inicio(req, res) {
    const [vagas, estudantes, empresas] = await Promise.all([
      Vaga.find({ status: 'ABERTA', prazo: { $gte: new Date() } }).populate('empresa areaAtuacao').sort('-dataPublicacao').limit(8),
      Estudante.countDocuments(), Empresa.countDocuments()
    ]);
    res.render('public/inicio', { vagas, estudantes, empresas });
  }
}
