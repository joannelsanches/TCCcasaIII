export function autenticado(req, res, next) {
  if (!req.session.usuario) {
    req.session.mensagem = { tipo: 'erro', texto: 'Faça login para continuar.' };
    return res.redirect('/login');
  }
  next();
}

export function autorizar(...tipos) {
  return (req, res, next) => {
    if (!req.session.usuario || !tipos.includes(req.session.usuario.tipo)) return res.status(403).render('erro/403');
    next();
  };
}

export function visitante(req, res, next) {
  if (!req.session.usuario) return next();
  const destinos = { ESTUDANTE: '/estudante', EMPRESA: '/empresa', ADMIN: '/admin' };
  return res.redirect(destinos[req.session.usuario.tipo]);
}
