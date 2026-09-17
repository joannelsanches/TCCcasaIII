import 'dotenv/config';
import app from '../app.js';
import { conectarBanco } from '../config/conexao.js';

await conectarBanco();
export default app;
