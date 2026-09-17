import Convenio from '../models/Convenio.js';
import { assinaturasConvenioCompletas } from '../utils/assinaturas.js';

export function convenioPodeSerAtivado(convenio) {
  if (!convenio?.pdfAssinado?.caminho) return 'Anexe o PDF assinado do convênio.';
  if (!assinaturasConvenioCompletas(convenio)) return 'Registre as assinaturas da empresa e da instituição.';
  if (!convenio.dataInicial || !convenio.dataFinal || new Date(convenio.dataFinal) <= new Date(convenio.dataInicial)) return 'A vigência do convênio é inválida.';
  return '';
}

export async function buscarConvenioVigente(empresaId, referencia = new Date()) {
  const convenios = await Convenio.find({
    empresa: empresaId,
    status: 'ATIVO',
    dataInicial: { $lte: referencia },
    dataFinal: { $gte: referencia },
    regularizacaoPendente: { $ne: true },
    'pdfAssinado.caminho': { $exists: true, $ne: '' }
  }).sort('-dataFinal');
  return convenios.find(assinaturasConvenioCompletas) || null;
}

export async function existeConvenioVigente(empresaId, referencia = new Date()) {
  return Boolean(await buscarConvenioVigente(empresaId, referencia));
}

