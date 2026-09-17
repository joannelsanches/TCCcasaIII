import express from 'express';
import MidiaController from '../controllers/MidiaController.js';
import { autenticado } from '../middlewares/autenticacao.js';

const router = express.Router();
router.get('/midia/empresas/:id/logo', MidiaController.logoEmpresa);
router.get('/midia/vagas/:id/imagem', MidiaController.imagemVaga);
router.get('/midia/estudantes/:id/foto', autenticado, MidiaController.fotoEstudante);
export default router;

