export function mensagem(req, tipo, texto) {
  req.session.mensagem = { tipo, texto };
}

export function voltarComErro(req, res, texto, destino) {
  mensagem(req, 'erro', texto);
  return res.redirect(destino);
}
