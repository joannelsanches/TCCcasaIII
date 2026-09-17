import 'dotenv/config';
import app from './app.js';
import { conectarBanco } from './config/conexao.js';

const porta = process.env.PORT || 3001;

try {
  await conectarBanco();
  app.listen(porta, () => console.log(`StartIF disponível em http://localhost:${porta}`));
} catch (erro) {
  console.error('Não foi possível iniciar o StartIF:', erro.message);
  process.exit(1);
}
