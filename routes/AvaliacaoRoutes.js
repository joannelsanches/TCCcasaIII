import express from 'express';
import AvaliacaoController from '../controllers/AvaliacaoController.js';
import { autenticado, autorizar } from '../middlewares/autenticacao.js';
const router = express.Router();
router.get('/avaliacoes', autenticado, AvaliacaoController.listar);
router.post('/avaliacoes', autenticado, autorizar('ESTUDANTE', 'EMPRESA'), AvaliacaoController.criar);
export default router;
