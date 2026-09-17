import { existsSync, unlinkSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

export function pastaUpload(nome) {
  return resolve(process.cwd(), 'uploads', nome);
}

export function caminhoPertenceAPasta(caminho, nomePasta) {
  if (!caminho) return false;
  const base = pastaUpload(nomePasta);
  const arquivo = resolve(caminho);
  const relativo = relative(base, arquivo);
  return Boolean(relativo && !relativo.startsWith('..') && !isAbsolute(relativo));
}

export function removerArquivoSeguro(caminho, nomePasta) {
  if (!caminhoPertenceAPasta(caminho, nomePasta)) return false;
  const arquivo = resolve(caminho);
  if (!existsSync(arquivo)) return true;
  unlinkSync(arquivo);
  return true;
}

export function metadadosUpload(arquivo) {
  if (!arquivo) return undefined;
  return {
    caminho: arquivo.path,
    nomeOriginal: arquivo.originalname,
    mimetype: arquivo.mimetype,
    dataEnvio: new Date()
  };
}

