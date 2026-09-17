import { executarAtualizacaoPrazos } from '../services/rotinasAutomaticas.js';

function segredoRecebido(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/iu, '');
  return bearer || String(req.headers['x-cron-secret'] || '');
}

export default class RotinaController {
  static async atualizarPrazos(req, res) {
    const segredosAceitos = [process.env.SEGREDO_ROTINA_PRAZOS, process.env.CRON_SECRET]
      .map((valor) => String(valor || ''))
      .filter(Boolean);
    if (!segredosAceitos.length || !segredosAceitos.includes(segredoRecebido(req))) {
      return res.status(401).json({ erro: 'Não autorizado.' });
    }
    const resultado = await executarAtualizacaoPrazos();
    return res.status(resultado.executada ? 200 : 409).json(resultado);
  }
}
