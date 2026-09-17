import multer from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

const tiposImagem = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
]);

export function validarPdf(arquivo) {
  return arquivo?.mimetype === 'application/pdf' && extname(arquivo.originalname).toLowerCase() === '.pdf';
}

export function validarImagem(arquivo) {
  const extensao = extname(arquivo?.originalname || '').toLowerCase();
  return tiposImagem.get(extensao) === arquivo?.mimetype;
}

function criarUpload(pasta, tipo) {
  const destino = join(process.cwd(), 'uploads', pasta);
  mkdirSync(destino, { recursive: true });
  const imagem = tipo === 'imagem';
  return multer({
    storage: multer.diskStorage({
      destination: destino,
      filename: (req, arquivo, cb) => cb(null, `${randomUUID()}${extname(arquivo.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: Number(process.env[imagem ? 'LIMITE_IMAGEM_MB' : 'LIMITE_PDF_MB'] || (imagem ? 3 : 5)) * 1024 * 1024, files: 1 },
    fileFilter: (req, arquivo, cb) => {
      const valido = imagem ? validarImagem(arquivo) : validarPdf(arquivo);
      const mensagem = imagem ? 'Envie somente imagens JPG, PNG ou WebP.' : 'Envie somente arquivos PDF.';
      if (!valido) {
        const erro = new Error(mensagem);
        erro.code = 'ARQUIVO_INVALIDO';
        return cb(erro, false);
      }
      return cb(null, true);
    }
  });
}

export const uploadCurriculo = criarUpload('curriculos', 'pdf');
export const uploadDocumento = criarUpload('documentos', 'pdf');
export const uploadFotoPerfil = criarUpload('estudantes', 'imagem');
export const uploadLogoEmpresa = criarUpload('empresas', 'imagem');
export const uploadImagemVaga = criarUpload('vagas', 'imagem');
