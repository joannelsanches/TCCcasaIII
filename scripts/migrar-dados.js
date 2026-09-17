import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectarBanco } from '../config/conexao.js';
import mongoose from '../config/conexao.js';
import Empresa from '../models/Empresa.js';
import Vaga from '../models/Vaga.js';
import Curso from '../models/Curso.js';
import Candidatura from '../models/Candidatura.js';
import Termo from '../models/TermoCompromisso.js';
import Convenio from '../models/Convenio.js';
import Notificacao from '../models/Notificacao.js';

const pastaAtual = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(pastaAtual, '..', '.env'), quiet: true });
const simular = process.argv.includes('--simular');

const statusCandidatura = ['EM_ANALISE', 'ENTREVISTA', 'AGUARDANDO_DOCUMENTOS', 'SELECIONADO', 'NAO_SELECIONADO', 'CANCELADO'];

try {
  await conectarBanco();
  const consultas = {
    empresasEnderecoAntigo: { endereco: { $type: 'string' } },
    vagasLocalizacaoAntiga: { localizacao: { $type: 'string' } },
    cursosSemRegras: { regrasEstagio: { $exists: false } },
    candidaturasSemHistorico: { $or: [{ historicoStatus: { $exists: false } }, { historicoStatus: { $size: 0 } }] },
    candidaturasStatusAntigo: { status: { $nin: statusCandidatura } },
    vagasSemStatus: { status: { $exists: false } },
    termosDocumentosAntigos: { documentos: { $elemMatch: { status: { $exists: false } } } },
    termosSemHistorico: { $or: [{ historicoStatus: { $exists: false } }, { historicoStatus: { $size: 0 } }] },
    termosRascunhoComTce: {
      status: 'RASCUNHO',
      $or: [
        { 'tceAssinado.caminho': { $exists: true, $ne: '' } },
        { documentos: { $elemMatch: { tipo: 'TCE', caminho: { $exists: true, $ne: '' } } } }
      ]
    },
    termosComTceLegado: { 'tceAssinado.caminho': { $exists: false }, documentos: { $elemMatch: { tipo: 'TCE', caminho: { $exists: true, $ne: '' } } } },
    conveniosSemPdf: { 'pdfAssinado.caminho': { $exists: false } },
    conveniosAtivosSemPdf: { status: 'ATIVO', 'pdfAssinado.caminho': { $exists: false } },
    notificacoesSemEmail: { email: { $exists: false } }
  };

  const modelos = {
    empresasEnderecoAntigo: Empresa,
    vagasLocalizacaoAntiga: Vaga,
    cursosSemRegras: Curso,
    candidaturasSemHistorico: Candidatura,
    candidaturasStatusAntigo: Candidatura,
    vagasSemStatus: Vaga,
    termosDocumentosAntigos: Termo,
    termosSemHistorico: Termo,
    termosRascunhoComTce: Termo,
    termosComTceLegado: Termo,
    conveniosSemPdf: Convenio,
    conveniosAtivosSemPdf: Convenio,
    notificacoesSemEmail: Notificacao
  };

  const contagens = {};
  for (const [nome, consulta] of Object.entries(consultas)) {
    contagens[nome] = await modelos[nome].collection.countDocuments(consulta);
  }
  console.log(simular ? 'SIMULAÇÃO: nenhum registro será alterado.' : 'Migração iniciada.');
  console.table(contagens);

  if (!simular) {
    await Empresa.collection.updateMany(consultas.empresasEnderecoAntigo, [{
      $set: {
        enderecoAntigo: '$endereco',
        endereco: { logradouro: '$endereco', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' },
        migracaoPendente: true
      }
    }]);

    await Vaga.collection.updateMany(consultas.vagasLocalizacaoAntiga, [{
      $set: {
        localizacaoAntiga: '$localizacao',
        localizacao: { logradouro: '$localizacao', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' },
        modalidade: { $ifNull: ['$modalidade', 'PRESENCIAL'] },
        modalidadeEstagio: { $ifNull: ['$modalidadeEstagio', 'NAO_OBRIGATORIO'] },
        migracaoPendente: true
      }
    }]);

    await Curso.collection.updateMany(consultas.cursosSemRegras, {
      $set: {
        regrasEstagio: {
          periodoMinimoObrigatorio: 1,
          cargaHorariaDiariaMaxima: 6,
          cargaHorariaSemanalMaxima: 30,
          permiteJornada40h: false,
          exigeConvenio: true,
          permiteEstagioObrigatorio: true,
          permiteEstagioNaoObrigatorio: true
        },
        migracaoPendente: true
      }
    });

    await Candidatura.collection.updateMany(consultas.candidaturasStatusAntigo, [{
      $set: {
        status: {
          $switch: {
            branches: [
              { case: { $in: ['$status', ['APROVADO', 'APROVADA', 'SELECIONADA']] }, then: 'SELECIONADO' },
              { case: { $in: ['$status', ['RECUSADO', 'RECUSADA', 'REJEITADO', 'REJEITADA']] }, then: 'NAO_SELECIONADO' },
              { case: { $in: ['$status', ['CANCELADA']] }, then: 'CANCELADO' }
            ],
            default: 'EM_ANALISE'
          }
        }
      }
    }]);
    await Candidatura.collection.updateMany(consultas.candidaturasSemHistorico, [{
      $set: {
        historicoStatus: [{
          status: { $cond: [{ $in: ['$status', statusCandidatura] }, '$status', 'EM_ANALISE'] },
          data: { $ifNull: ['$updatedAt', { $ifNull: ['$dataCandidatura', '$createdAt'] }] },
          observacao: 'Histórico inicial criado pela migração.'
        }]
      }
    }]);

    await Vaga.collection.updateMany(consultas.vagasSemStatus, { $set: { status: 'PENDENTE_VALIDACAO', migracaoPendente: true } });

    await Termo.collection.updateMany(consultas.termosDocumentosAntigos, [{
      $set: {
        documentos: {
          $map: {
            input: { $ifNull: ['$documentos', []] },
            as: 'documento',
            in: {
              $mergeObjects: [
                '$$documento',
                {
                  status: {
                    $cond: [
                      { $eq: ['$$documento.validado', true] },
                      'APROVADO',
                      { $cond: [{ $ne: [{ $ifNull: ['$$documento.caminho', ''] }, ''] }, 'ENVIADO', 'FALTANDO'] }
                    ]
                  },
                  dataEnvio: { $ifNull: ['$$documento.dataEnvio', '$createdAt'] }
                }
              ]
            }
          }
        }
      }
    }]);

    const termosTce = await Termo.collection.find(consultas.termosComTceLegado).toArray();
    for (const termo of termosTce) {
      const tce = [...(termo.documentos || [])].reverse().find((documento) => documento.tipo === 'TCE' && documento.caminho);
      if (!tce) continue;
      await Termo.collection.updateOne({ _id: termo._id }, {
        $set: {
          tceAssinado: {
            caminho: tce.caminho,
            nomeOriginal: tce.nomeOriginal,
            mimetype: tce.mimetype || 'application/pdf',
            dataEnvio: tce.dataEnvio || termo.updatedAt || termo.createdAt
          },
          regularizacaoAssinaturasPendente: true
        }
      });
    }

    await Termo.collection.updateMany(consultas.termosRascunhoComTce, {
      $set: {
        status: 'AGUARDANDO_ASSINATURAS',
        regularizacaoAssinaturasPendente: true
      }
    });

    await Termo.collection.updateMany(consultas.termosSemHistorico, [{
      $set: {
        historicoStatus: [{
          status: { $ifNull: ['$status', 'RASCUNHO'] },
          data: { $ifNull: ['$dataAnalise', { $ifNull: ['$dataEnvioAnalise', { $ifNull: ['$dataSolicitacao', '$createdAt'] }] }] },
          observacao: 'Histórico inicial criado pela migração.'
        }]
      }
    }]);

    await Convenio.collection.updateMany(consultas.conveniosAtivosSemPdf, {
      $set: { regularizacaoPendente: true, justificativa: 'Anexar o PDF assinado e registrar os signatários para regularização.' }
    });
    await Convenio.collection.updateMany({ status: { $ne: 'ATIVO' }, 'pdfAssinado.caminho': { $exists: false } }, {
      $set: { regularizacaoPendente: true }
    });

    await Notificacao.collection.updateMany(consultas.notificacoesSemEmail, {
      $set: { email: { solicitado: false, enviado: false } }
    });

    console.log('Migração concluída. Registros legados foram preservados e marcados para revisão quando necessário.');
  }
} catch (erro) {
  console.error(`Falha na migração: ${erro.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
