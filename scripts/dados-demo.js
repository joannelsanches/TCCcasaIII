import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectarBanco } from '../config/conexao.js';
import mongoose from '../config/conexao.js';
import Campus from '../models/Campus.js';
import AreaAtuacao from '../models/AreaAtuacao.js';
import Curso from '../models/Curso.js';

const pastaAtual = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(pastaAtual, '..', '.env'), quiet: true });

try {
  await conectarBanco();
  const campus = await Campus.findOneAndUpdate(
    { nome: 'Campus Bagé', cidade: 'Bagé' },
    { $setOnInsert: { ativo: true } },
    { upsert: true, new: true }
  );
  const area = await AreaAtuacao.findOneAndUpdate(
    { nome: 'Tecnologia da Informação' },
    { $setOnInsert: { ativo: true } },
    { upsert: true, new: true }
  );
  await Curso.findOneAndUpdate(
    { nome: 'Técnico em Informática', campus: campus._id },
    {
      $setOnInsert: {
        nivel: 'TÉCNICO',
        areasRelacionadas: [area._id],
        ativo: true,
        regrasEstagio: {
          periodoMinimoObrigatorio: 1,
          cargaHorariaDiariaMaxima: 6,
          cargaHorariaSemanalMaxima: 30,
          permiteJornada40h: false,
          exigeConvenio: true,
          permiteEstagioObrigatorio: true,
          permiteEstagioNaoObrigatorio: true
        }
      }
    },
    { upsert: true, new: true, runValidators: true }
  );
  console.log('Dados institucionais de demonstração cadastrados.');
} catch (erro) {
  console.error(`Não foi possível criar os dados de demonstração: ${erro.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
