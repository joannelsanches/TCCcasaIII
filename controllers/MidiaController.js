import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Empresa from '../models/Empresa.js';
import Estudante from '../models/Estudante.js';
import Vaga from '../models/Vaga.js';
import Candidatura from '../models/Candidatura.js';
import { caminhoPertenceAPasta } from '../utils/arquivos.js';

function enviar(res, arquivo, pasta, privado = false) {
  if (!arquivo?.caminho || !caminhoPertenceAPasta(arquivo.caminho, pasta) || !existsSync(resolve(arquivo.caminho))) {
    return res.status(404).end();
  }
  res.setHeader('Cache-Control', privado ? 'private, max-age=300' : 'public, max-age=3600');
  res.type(arquivo.mimetype || 'application/octet-stream');
  return res.sendFile(resolve(arquivo.caminho));
}

export default class MidiaController {
  static async logoEmpresa(req, res) {
    const empresa = await Empresa.findById(req.params.id).select('logo');
    return enviar(res, empresa?.logo, 'empresas');
  }

  static async imagemVaga(req, res) {
    const vaga = await Vaga.findById(req.params.id).select('imagem status empresa');
    if (!vaga) return res.status(404).end();
    if (vaga.status !== 'ABERTA') {
      const usuario = req.session.usuario;
      if (!usuario) return res.status(404).end();
      let permitido = usuario.tipo === 'ADMIN';
      if (!permitido && usuario.tipo === 'EMPRESA') {
        const empresa = await Empresa.findOne({ usuario: usuario.id }).select('_id');
        permitido = String(empresa?._id) === String(vaga.empresa);
      }
      if (!permitido && usuario.tipo === 'ESTUDANTE') {
        const estudante = await Estudante.findOne({ usuario: usuario.id }).select('_id');
        permitido = Boolean(estudante && await Candidatura.exists({ estudante: estudante._id, vaga: vaga._id }));
      }
      if (!permitido) return res.status(404).end();
    }
    return enviar(res, vaga?.imagem, 'vagas');
  }

  static async fotoEstudante(req, res) {
    const estudante = await Estudante.findById(req.params.id).select('usuario fotoPerfil');
    if (!estudante) return res.status(404).end();
    let permitido = req.session.usuario.tipo === 'ADMIN' || String(estudante.usuario) === req.session.usuario.id;
    if (!permitido && req.session.usuario.tipo === 'EMPRESA') {
      const empresa = await Empresa.findOne({ usuario: req.session.usuario.id });
      const vagas = await Vaga.find({ empresa: empresa?._id }).distinct('_id');
      permitido = Boolean(await Candidatura.exists({ estudante: estudante._id, vaga: { $in: vagas } }));
    }
    if (!permitido) return res.status(403).end();
    return enviar(res, estudante.fotoPerfil, 'estudantes', true);
  }
}
