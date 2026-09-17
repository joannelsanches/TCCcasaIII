import express from 'express';
import RotinaController from '../controllers/RotinaController.js';

const router = express.Router();
router.get('/api/rotinas/atualizar-prazos', RotinaController.atualizarPrazos);
router.post('/api/rotinas/atualizar-prazos', RotinaController.atualizarPrazos);

export default router;
