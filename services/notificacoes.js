import Notificacao from '../models/Notificacao.js';
import Usuario from '../models/Usuario.js';
import { enviarEmail } from './emailService.js';

export async function criarNotificacao({
  destinatario,
  titulo,
  mensagem,
  link = '/notificacoes',
  tipoEvento,
  referencia,
  chaveUnica,
  enviarPorEmail = true,
  intervaloMinimoDias = 0,
  referenciaTemporal = new Date()
}) {
  const referenciaNormalizada = referencia ? String(referencia) : undefined;
  const intervalo = Number(intervaloMinimoDias || 0);
  if (intervalo > 0 && tipoEvento && referenciaNormalizada) {
    const limite = new Date(new Date(referenciaTemporal).getTime() - intervalo * 24 * 60 * 60 * 1000);
    const recente = await Notificacao.exists({
      destinatario,
      tipoEvento,
      referencia: referenciaNormalizada,
      data: { $gte: limite }
    });
    if (recente) return { criada: false, duplicada: true, intervalo: true };
  }

  let notificacao;
  try {
    notificacao = await Notificacao.create({
      destinatario,
      titulo,
      mensagem,
      link,
      tipoEvento,
      referencia: referenciaNormalizada,
      chaveUnica,
      email: { solicitado: enviarPorEmail }
    });
  } catch (erro) {
    if (erro.code === 11000 && chaveUnica) return { criada: false, duplicada: true };
    throw erro;
  }

  if (!enviarPorEmail) return { criada: true, notificacao };
  const usuario = await Usuario.findById(destinatario).select('email ativo');
  if (!usuario?.ativo || !usuario.email) return { criada: true, notificacao, email: { enviado: false, ignorado: true } };

  const resultadoEmail = await enviarEmail({ para: usuario.email, assunto: titulo, mensagem, link });
  notificacao.email.enviado = resultadoEmail.enviado;
  notificacao.email.dataEnvio = resultadoEmail.enviado ? new Date() : undefined;
  notificacao.email.erro = resultadoEmail.enviado ? undefined : resultadoEmail.erro;
  await notificacao.save();
  return { criada: true, notificacao, email: resultadoEmail };
}

export async function criarNotificacoes(destinatarios, dados) {
  const resultados = [];
  for (const destinatario of destinatarios) {
    resultados.push(await criarNotificacao({ ...dados, destinatario }));
  }
  return resultados;
}
