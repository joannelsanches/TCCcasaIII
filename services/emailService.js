import nodemailer from 'nodemailer';

function escaparHtml(valor = '') {
  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function smtpConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

function criarTransportador() {
  const auth = process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
    : undefined;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true
  });
}

export async function enviarEmail({ para, assunto, mensagem, link }) {
  if (!smtpConfigurado()) return { enviado: false, ignorado: true, erro: 'SMTP não configurado' };
  const urlBase = String(process.env.URL_BASE || 'http://localhost:3001').replace(/\/$/u, '');
  const caminho = String(link || '/notificacoes');
  const url = caminho.startsWith('/') && !caminho.startsWith('//') ? `${urlBase}${caminho}` : `${urlBase}/notificacoes`;
  const texto = `${mensagem}\n\nAcesse o StartIF: ${url}`;
  const html = `<p>${escaparHtml(mensagem)}</p><p><a href="${escaparHtml(url)}">Acessar o StartIF</a></p>`;
  try {
    const info = await criarTransportador().sendMail({
      from: process.env.EMAIL_FROM,
      to: para,
      subject: assunto,
      text: texto,
      html
    });
    return { enviado: true, messageId: info.messageId };
  } catch (erro) {
    return { enviado: false, erro: String(erro.message || 'Falha no envio').slice(0, 500) };
  }
}

