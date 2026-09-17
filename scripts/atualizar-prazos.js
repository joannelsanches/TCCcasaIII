import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectarBanco } from '../config/conexao.js';
import mongoose from '../config/conexao.js';
import { executarAtualizacaoPrazos } from '../services/rotinasAutomaticas.js';

const pastaAtual = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(pastaAtual, '..', '.env'), quiet: true });

try {
  await conectarBanco();
  const resultado = await executarAtualizacaoPrazos();
  console.log(JSON.stringify(resultado, null, 2));
  if (!resultado.executada) process.exitCode = 2;
} catch (erro) {
  console.error(`Falha ao atualizar prazos: ${erro.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

