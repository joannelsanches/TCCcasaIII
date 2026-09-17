# Relatório de entrega — StartIF

## Situação da entrega

O código atual do repositório \`joannelsanches/TCCcasaII\` foi mantido como base e ampliado na branch local \`codex/startif-melhorias\`. A arquitetura Express/EJS/Mongoose, as permissões por perfil e os recursos existentes foram preservados. Nenhum push foi realizado.

## Resumo das alterações

- grade de vagas responsiva com quatro, três, duas e uma coluna;
- cards uniformes, imagens padronizadas e textos limitados apenas nas listagens;
- consulta ViaCEP sem jQuery, estados de carregamento/erro e edição manual;
- capitalização reutilizável de nomes em views;
- linha do tempo acessível baseada nos status reais;
- novas etapas e histórico da candidatura;
- cancelamento de candidatura somente pelo estudante dono e em \`EM_ANALISE\`;
- vagas em rascunho, envio posterior, exclusão e duplicação;
- checklist documental por item;
- PDF real assinado para convênio e TCE;
- signatários, datas, análise e bloqueios de aprovação;
- filtros, contadores e leitura em massa de notificações;
- progresso de perfil para estudante e empresa;
- busca administrativa combinada, segura e paginada;
- avisos por e-mail opcionais, sem anexos e sem desfazer operações;
- rotina diária idempotente com lock no MongoDB;
- erros abaixo dos campos e resposta 422;
- migração compatível com os registros antigos;
- revisão visual completa e responsiva.

## Arquivos criados

### Configuração e documentação

- \`.env.example\`
- \`README.md\`

### Controllers, models e rotas

- \`controllers/MidiaController.js\`
- \`controllers/RotinaController.js\`
- \`models/ExecucaoRotina.js\`
- \`models/schemasComuns.js\`
- \`routes/MidiaRoutes.js\`
- \`routes/RotinaRoutes.js\`

### Serviços

- \`services/convenios.js\`
- \`services/emailService.js\`
- \`services/notificacoes.js\`
- \`services/rotinasAutomaticas.js\`

### Scripts e utilitários

- \`scripts/atualizar-prazos.js\`
- \`scripts/dados-demo.js\`
- \`scripts/migrar-dados.js\`
- \`utils/arquivos.js\`
- \`utils/assinaturas.js\`
- \`utils/documentosTermo.js\`
- \`utils/endereco.js\`
- \`utils/formatacao.js\`
- \`utils/perfilCompleto.js\`
- \`utils/processoEstagio.js\`
- \`utils/regrasEstagio.js\`

### Partials

- \`views/partials/campos-endereco.ejs\`
- \`views/partials/checklist-documentos.ejs\`
- \`views/partials/estrelas-display.ejs\`
- \`views/partials/estrelas-form.ejs\`
- \`views/partials/linha-tempo-estagio.ejs\`
- \`views/partials/progresso-perfil.ejs\`
- \`views/partials/vaga-card.ejs\`

### Testes

- \`test/fluxos-ampliados.test.js\`
- \`test/novas-funcionalidades.test.js\`
- \`test/render-dinamico.test.js\`
- \`test/views.test.js\`

## Arquivos modificados

- base: \`app.js\`, \`indexvercell.js\`, \`package.json\`, \`package-lock.json\`, \`vercel.json\`;
- configuração: \`config/upload.js\`;
- controllers: \`AdminController.js\`, \`AuthController.js\`, \`AvaliacaoController.js\`, \`CandidaturaController.js\`, \`ConvenioController.js\`, \`EmpresaController.js\`, \`EstudanteController.js\`, \`NotificacaoController.js\`, \`PublicController.js\`, \`TermoController.js\`, \`VagaController.js\`;
- models: \`Avaliacao.js\`, \`Candidatura.js\`, \`Convenio.js\`, \`Curso.js\`, \`Empresa.js\`, \`Estudante.js\`, \`Notificacao.js\`, \`TermoCompromisso.js\`, \`Vaga.js\`;
- rotas: \`AdminRoutes.js\`, \`AuthRoutes.js\`, \`CandidaturaRoutes.js\`, \`ConvenioRoutes.js\`, \`EmpresaRoutes.js\`, \`EstudanteRoutes.js\`, \`NotificacaoRoutes.js\`, \`TermoRoutes.js\`, \`VagaRoutes.js\`, \`routes/index.js\`;
- cliente: \`public/css/style.css\`, \`public/js/app.js\`;
- scripts/utilitários: \`scripts/criar-admin.js\`, \`utils/validacoes.js\`;
- views administrativas: \`avaliacoes.ejs\`, \`cadastros.ejs\`, \`convenios.ejs\`, \`empresas.ejs\`, \`relatorios.ejs\`, \`termos.ejs\`, \`usuarios.ejs\`, \`vagas.ejs\`;
- views de autenticação: \`cadastro-empresa.ejs\`, \`cadastro-estudante.ejs\`, \`login.ejs\`;
- views da empresa: \`avaliacoes.ejs\`, \`candidato.ejs\`, \`candidatos.ejs\`, \`painel.ejs\`, \`perfil.ejs\`, \`termos.ejs\`, \`vaga-form.ejs\`, \`vagas.ejs\`;
- views do estudante: \`avaliacoes.ejs\`, \`candidaturas.ejs\`, \`historico.ejs\`, \`notificacoes.ejs\`, \`painel.ejs\`, \`perfil.ejs\`, \`termos.ejs\`;
- views comuns/públicas: \`views/partials/cabecalho.ejs\`, \`views/public/inicio.ejs\`, \`views/vagas/detalhes.ejs\`, \`views/vagas/lista.ejs\`;
- documentação: \`RELATORIO_ENTREGA.md\`.

## Arquivo removido

- \`PRA colocar no .ENV .md\`: continha informações que não devem permanecer versionadas. As credenciais compartilhadas anteriormente precisam ser trocadas no provedor.

## Campos adicionados ou ampliados

| Model | Campos principais |
|---|---|
| \`Candidatura\` | novos status, \`historicoStatus\`, \`dataCancelamento\`, \`motivoCancelamento\` |
| \`Vaga\` | \`RASCUNHO\`, \`historicoStatus\`, imagem, localização, modalidade, jornada, período, atividades, benefícios, supervisor, quantidade |
| \`Convenio\` | novos status, \`pdfAssinado\`, \`assinaturas\`, datas de envio/aprovação, justificativa, aprovador, histórico, regularização |
| \`TermoCompromisso\` | \`AGUARDANDO_ASSINATURAS\`, checklist por status, \`tceAssinado\`, assinaturas, histórico, partes, seguro, jornada e situação do estágio |
| \`Notificacao\` | tipo, referência, chave única, leitura e resultado do e-mail |
| \`Estudante\` | foto, telefone, nascimento, endereço e matrícula regular |
| \`Empresa\` | logo, endereço estruturado e estado da validação |
| \`Curso\` | regras configuráveis de estágio |
| \`ExecucaoRotina\` | lock, início, fim e resumo da execução |

## Rotas acrescentadas ou ampliadas

- \`POST /estudante/candidaturas/:id/cancelar\`;
- \`POST /empresa/candidaturas/:id/status\`;
- \`POST /empresa/vagas/:id/duplicar\`;
- \`POST /empresa/vagas/:id/rascunho/excluir\`;
- \`POST /empresa/vagas/:id/reabrir\`;
- \`POST /empresa/vagas/:id/imagem/remover\`;
- \`POST /estudante/perfil/foto/remover\`;
- \`POST /empresa/perfil/logo/remover\`;
- \`POST /notificacoes/marcar-todas-lidas\`;
- \`POST /admin/convenios/:id/pdf\`;
- \`POST /admin/convenios/:id/enviar-analise\`;
- \`GET /convenios/:id/pdf\`;
- \`POST /termos/:id/tce-assinado\`;
- \`GET /termos/:id/tce-assinado\`;
- \`POST /termos/:id/documentos/:documentoId/validar\`;
- \`POST /termos/:id/iniciar\`;
- \`POST /termos/:id/encerrar\`;
- \`POST /termos/:id/rescindir\`;
- \`GET/POST /api/rotinas/atualizar-prazos\`;
- rotas protegidas de mídia para fotos, logos e imagens.

## Dependência adicionada

- \`nodemailer\`: envio SMTP opcional. Quando não configurado, a notificação interna permanece funcional.

## Variáveis acrescentadas ao \`.env.example\`

- \`SMTP_HOST\`, \`SMTP_PORT\`, \`SMTP_SECURE\`, \`SMTP_USER\`, \`SMTP_PASS\`, \`EMAIL_FROM\`;
- \`URL_BASE\`;
- \`DIAS_AVISO_DOCUMENTOS\`, \`DIAS_AVISO_RELATORIO\`, \`DIAS_AVISO_CONVENIO\`;
- \`SEGREDO_ROTINA_PRAZOS\`, \`CRON_SECRET\`;
- dados institucionais e limites de upload foram mantidos/documentados.

## Execução

\`\`\`bash
npm install
cp .env.example .env
npm run migrar:simular
npm run migrar
npm run criar-admin
npm start
\`\`\`

Após modificar o \`.env\`, o servidor deve ser reiniciado.

## Rotina, SMTP e migração

- desenvolvimento/manual: \`npm run atualizar-prazos\`;
- produção/agendador: \`GET /api/rotinas/atualizar-prazos\` com \`Authorization: Bearer <segredo>\`;
- SMTP é opcional e nunca recebe documentos como anexo;
- migração deve ser precedida de backup e simulação;
- convênios ativos antigos sem PDF são preservados e marcados para regularização.

## Checklist de testes

- [x] 50 testes automatizados aprovados;
- [x] todas as views EJS compilam;
- [x] views principais renderizam com dados mínimos/estados vazios;
- [x] aplicação Express inicia e responde por HTTP;
- [x] consulta e validação do CEP;
- [x] capitalização dos nomes;
- [x] grade 4/3/2/1;
- [x] candidatura, transições, histórico e cancelamento;
- [x] rascunho, envio e duplicação de vaga;
- [x] checklist e análise individual;
- [x] bloqueio de convênio/TCE sem PDF e signatários;
- [x] status \`AGUARDANDO_ASSINATURAS\`;
- [x] notificações, contador e filtros;
- [x] busca administrativa paginada;
- [x] cálculo da conclusão do perfil;
- [x] fechamento/vencimento automáticos e lock;
- [x] prevenção de avisos repetidos;
- [x] funcionamento sem SMTP;
- [x] erros junto aos campos e status 422;
- [x] upload, tipo, extensão e confinamento de caminho;
- [x] jornada e endereços;
- [x] migração em modo de simulação;
- [ ] fluxo destrutivo completo em MongoDB externo — não executado por segurança, pois não foi fornecido banco descartável.

## Regras legais/institucionais aplicadas

- matrícula regular, TCE e compatibilidade entre atividades e curso/PPC;
- empresa aprovada e convênio vigente quando exigido;
- professor orientador e supervisor identificado;
- controle informado do limite de dez estagiários por supervisor;
- jornada padrão de 6 horas/dia e 30 horas/semana;
- 40 horas apenas quando a regra administrativa do curso/PPC permitir;
- redução de jornada em avaliações;
- bolsa e auxílio-transporte no estágio não obrigatório;
- seguro cobrindo o período;
- relatórios com periodicidade máxima de seis meses;
- checklist dos documentos de acompanhamento, alteração e encerramento;
- início bloqueado antes da aprovação documental.

## Regras a confirmar com o setor de estágios

- período mínimo e regras particulares de cada PPC;
- dispensa excepcional de convênio;
- representante e dados institucionais vigentes;
- responsabilidade do seguro em cada modalidade;
- formulários e assinaturas adotados no Campus Bagé;
- autenticidade/assinatura digital dos PDFs;
- periodicidade local dos relatórios;
- recesso, limites por quadro de pessoal e demais exceções locais.

## Limitações conhecidas

- O sistema não assina nem verifica criptograficamente os PDFs; armazena o documento assinado e registra a conferência.
- Upload local não é durável em hospedagem serverless; produção precisa de volume persistente ou adaptação para armazenamento externo.
- O store padrão do \`express-session\` fica em memória e deve ser substituído em produção com múltiplas instâncias.
- A validação ponta a ponta contra MongoDB exige um banco descartável separado.
- ViaCEP é auxílio de preenchimento, não prova documental do endereço.
