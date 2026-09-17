import express from 'express';
import PublicController from '../controllers/PublicController.js';
import AuthRoutes from './AuthRoutes.js';
import EstudanteRoutes from './EstudanteRoutes.js';
import EmpresaRoutes from './EmpresaRoutes.js';
import VagaRoutes from './VagaRoutes.js';
import CandidaturaRoutes from './CandidaturaRoutes.js';
import TermoRoutes from './TermoRoutes.js';
import ConvenioRoutes from './ConvenioRoutes.js';
import AvaliacaoRoutes from './AvaliacaoRoutes.js';
import NotificacaoRoutes from './NotificacaoRoutes.js';
import AdminRoutes from './AdminRoutes.js';
import MidiaRoutes from './MidiaRoutes.js';
import RotinaRoutes from './RotinaRoutes.js';

const router = express.Router();
router.get('/', PublicController.inicio);
router.use(AuthRoutes, EstudanteRoutes, EmpresaRoutes, VagaRoutes, CandidaturaRoutes, TermoRoutes, ConvenioRoutes, AvaliacaoRoutes, NotificacaoRoutes, AdminRoutes, MidiaRoutes, RotinaRoutes);
export default router;
