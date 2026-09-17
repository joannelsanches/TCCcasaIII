# StartIF

Sistema web para oferta e gerenciamento de estágios de estudantes do IFSul – Campus Bagé. Esta versão continua o código do repositório \`TCCcasaII\`, preservando Express, EJS, JavaScript, CSS, MongoDB/Mongoose, Multer, sessões e bcryptjs.

## Requisitos

- Node.js 20 ou mais recente;
- npm;
- MongoDB local ou MongoDB Atlas;
- um banco separado para testes manuais.

## Instalação

\`\`\`bash
npm install
cp .env.example .env
\`\`\`

Preencha o \`.env\` e reinicie o servidor sempre que alterar suas variáveis. O Node carrega o arquivo apenas na inicialização. Não publique o \`.env\`.

### Variáveis de ambiente

| Variável | Obrigatória | Finalidade |
|---|---:|---|
| \`MONGODB_URI\` | sim | conexão do MongoDB |
| \`SESSION_SECRET\` | sim em produção | assinatura da sessão |
| \`DOMINIOS_INSTITUCIONAIS\` | sim | domínios de estudante, separados por vírgula e sem \`@\` |
| \`LIMITE_PDF_MB\` | sim | limite de currículo e documentos |
| \`LIMITE_IMAGEM_MB\` | sim | limite de foto, logo e imagem da vaga |
| \`ADMIN_NOME\`, \`ADMIN_EMAIL\`, \`ADMIN_SENHA\`, \`ADMIN_FUNCAO\` | para criar o primeiro admin | dados usados somente pelo script |
| \`INSTITUICAO_NOME\`, \`INSTITUICAO_CAMPUS\`, \`INSTITUICAO_CNPJ\`, \`INSTITUICAO_REPRESENTANTE\` | para enviar TCE à análise | identificação institucional do termo |
| \`SMTP_HOST\`, \`SMTP_PORT\`, \`SMTP_SECURE\`, \`SMTP_USER\`, \`SMTP_PASS\`, \`EMAIL_FROM\` | não | envio opcional de e-mails |
| \`URL_BASE\` | para links por e-mail | endereço público da aplicação |
| \`DIAS_AVISO_DOCUMENTOS\` | não | intervalo mínimo dos avisos documentais |
| \`DIAS_AVISO_RELATORIO\` | não | antecedência e repetição de avisos de relatório |
| \`DIAS_AVISO_CONVENIO\` | não | antecedência de vencimento do convênio |
| \`SEGREDO_ROTINA_PRAZOS\` ou \`CRON_SECRET\` | para endpoint agendado | protege a rotina automática |
| \`PORT\`, \`NODE_ENV\` | não | porta e modo de execução |

\`ADMIN_SENHA\` precisa ter pelo menos 12 caracteres e não pode ser uma senha comum. Se aparecer “Complete os dados institucionais”, confira os quatro campos \`INSTITUICAO_*\`, salve o arquivo e pare/inicie novamente o servidor.

> Segurança: uma URI do MongoDB e uma senha foram compartilhadas durante o desenvolvimento. Troque a senha do usuário no MongoDB Atlas e atualize o \`.env\`; retirar a credencial do arquivo atual não a remove de mensagens ou do histórico Git.

## Primeira execução

\`\`\`bash
npm run demo
npm run criar-admin
npm start
\`\`\`

A aplicação abre, por padrão, em [http://localhost:3001](http://localhost:3001). Para desenvolvimento com reinicialização automática:

\`\`\`bash
npm run dev
\`\`\`

O administrador usa \`ADMIN_EMAIL\` e \`ADMIN_SENHA\`. Estudantes e empresas fazem cadastro pelas páginas públicas.

## Recursos implementados

- autenticação e autorização separadas para estudante, empresa e administrador;
- cards de vagas em grade responsiva de quatro, três, duas e uma coluna;
- busca pública e do estudante, detalhes completos e imagens protegidas;
- preenchimento de endereço por CEP com ViaCEP, máscara visual e validação local no servidor;
- capitalização de nomes com conectores preservados;
- indicador acessível de conclusão do perfil;
- candidatura com etapas \`EM_ANALISE\`, \`ENTREVISTA\`, \`AGUARDANDO_DOCUMENTOS\`, \`SELECIONADO\`, \`NAO_SELECIONADO\` e \`CANCELADO\`;
- transições controladas, histórico, cancelamento pelo estudante e notificação;
- linha do tempo real de candidatura, seleção, termo, aprovação, início e encerramento;
- vaga como \`RASCUNHO\`, envio posterior, duplicação segura e reabertura sujeita a validação;
- checklist documental com análise individual e motivo de rejeição;
- PDF assinado real do convênio e do TCE, ambos em armazenamento protegido;
- registro dos signatários e bloqueio de aprovação sem PDF/assinaturas obrigatórias;
- notificações filtráveis, contador no menu e ação “Marcar todas como lidas”;
- avisos internos e e-mail SMTP opcional sem anexos;
- busca administrativa combinada e paginada;
- rotina diária idempotente para vagas, convênios, documentos e relatórios;
- validações junto aos campos com HTTP 422 e preservação dos valores não sigilosos;
- uploads separados, UUID, limite, MIME/extensão e remoção confinada à pasta correta;
- CSS responsivo com a paleta do StartIF, foco visível e redução de movimentos.

## Fluxos dos documentos reais

O sistema não assina digitalmente documentos. O convênio e o TCE são elaborados/assinados fora da plataforma ou em ferramenta institucional e depois enviados em PDF. O StartIF guarda o arquivo real, registra signatários/datas e controla análise e acesso.

### Convênio

\`RASCUNHO → AGUARDANDO_ASSINATURAS → PENDENTE → ATIVO\`

Um convênio só pode ficar ativo com PDF, assinatura da empresa e assinatura da instituição, além de vigência válida.

### Termo de Compromisso

\`RASCUNHO → AGUARDANDO_ASSINATURAS → PENDENTE → APROVADO\`

O envio à análise exige PDF assinado e assinaturas do estudante, empresa e instituição. Para estudante menor na data de início, também exige responsável legal. O estágio só inicia após aprovação institucional e checklist obrigatório aprovado.

## Rotina automática

Execução manual:

\`\`\`bash
npm run atualizar-prazos
\`\`\`

Execução por agendador:

\`\`\`bash
curl -H "Authorization: Bearer SEU_SEGREDO" \
  http://localhost:3001/api/rotinas/atualizar-prazos
\`\`\`

Também é aceito o cabeçalho \`x-cron-secret\`. O \`vercel.json\` agenda a URL diariamente às 06:00 UTC. Configure \`CRON_SECRET\` ou \`SEGREDO_ROTINA_PRAZOS\` na hospedagem. Um lock no MongoDB impede duas execuções simultâneas.

A rotina:

- fecha vagas abertas com prazo vencido;
- marca convênios ativos vencidos e avisa empresa/administração;
- avisa sobre convênios próximos do fim;
- avisa estudante e empresa sobre documentos obrigatórios pendentes;
- avisa relatórios próximos e atrasados;
- usa chaves únicas e intervalos para não duplicar avisos;
- registra início, fim, quantidades e erros em \`ExecucaoRotina\`.

## E-mail SMTP

Preencha as variáveis \`SMTP_*\`, \`EMAIL_FROM\` e \`URL_BASE\`. Se SMTP não estiver configurado ou falhar, a alteração do banco e a notificação interna continuam funcionando. O sistema envia apenas resumo e link autenticado; PDFs, CPF e CNPJ não são enviados por e-mail.

## Migração dos dados existentes

Faça backup do MongoDB. Primeiro execute a simulação:

\`\`\`bash
npm run migrar:simular
\`\`\`

Depois de conferir as contagens:

\`\`\`bash
npm run migrar
\`\`\`

A migração:

- preserva endereços/localizações antigas e marca o que precisa de revisão;
- cria regras padrão para cursos antigos;
- cria histórico para candidaturas e termos antigos;
- converte status antigos de candidatura;
- converte \`validado: true\` em \`APROVADO\`, arquivo não validado em \`ENVIADO\` e ausência em \`FALTANDO\`;
- associa TCE legado ao campo próprio sem apagar o documento;
- marca convênios ativos sem PDF como pendentes de regularização, sem apagá-los;
- inicializa metadados de e-mail nas notificações.

O modo \`migrar:simular\` apenas consulta e exibe contagens.

## Rotas acrescentadas

| Método e rota | Finalidade |
|---|---|
| \`POST /estudante/candidaturas/:id/cancelar\` | cancelar candidatura própria elegível |
| \`POST /empresa/candidaturas/:id/status\` | avançar etapa com transição controlada |
| \`POST /empresa/vagas/:id/duplicar\` | criar cópia em rascunho |
| \`POST /empresa/vagas/:id/rascunho/excluir\` | excluir rascunho próprio |
| \`POST /empresa/vagas/:id/reabrir\` | solicitar revalidação |
| \`POST /notificacoes/marcar-todas-lidas\` | marcar somente notificações do usuário |
| \`POST /admin/convenios/:id/pdf\` | substituir PDF assinado |
| \`POST /admin/convenios/:id/enviar-analise\` | avançar o convênio |
| \`GET /convenios/:id/pdf\` | download autorizado |
| \`POST /termos/:id/tce-assinado\` | enviar/substituir TCE assinado |
| \`GET /termos/:id/tce-assinado\` | download autorizado |
| \`POST /termos/:id/documentos/:documentoId/validar\` | aprovar/rejeitar item |
| \`GET/POST /api/rotinas/atualizar-prazos\` | executar rotina protegida |

As rotas anteriores de perfil, currículo, imagens, vagas, candidatura, avaliação, relatórios, convênios e termos permanecem.

## Testes

\`\`\`bash
npm test
\`\`\`

A suíte verifica models, transições, histórico, rascunhos, duplicação, cancelamento, PDFs e signatários, checklist, CEP, nomes, grade responsiva, acesso visível ao login, notificações, busca, SMTP desativado, rotina/lock, migração, validações por campo, uploads, jornada, EJS e inicialização HTTP.

Não foi executado teste destrutivo contra o banco Atlas informado. Para um teste ponta a ponta, use um banco temporário separado e percorra Estudante → Empresa → Administrador.

## Regras institucionais modeladas

A referência principal é a [Lei nº 11.788/2008](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11788.htm), junto aos [documentos de estágio da Reitoria do IFSul](https://www.ifsul.edu.br/estagio/documentos-de-estagio) e aos [documentos do Campus Bagé](https://www.bage.ifsul.edu.br/estagio/documentos-de-estagio).

Foram modelados matrícula regular, TCE, compatibilidade com curso/PPC, orientador, supervisor, limite informado de dez estagiários por supervisor, jornada diária/semanal, redução em avaliações, seguro, bolsa/auxílio no estágio não obrigatório, relatórios em até seis meses, documentos de acompanhamento e bloqueio do início antes da aprovação.

### Confirmação necessária com o setor de estágios

- período mínimo e exceções de jornada de cada PPC;
- hipóteses locais de dispensa de convênio;
- dados e representante institucional vigentes;
- responsáveis por seguro e aprovação em cada modalidade;
- conjunto exato de formulários e assinaturas usado atualmente;
- periodicidade local dos relatórios;
- procedimento de autenticidade/assinatura digital;
- regras locais de recesso, vagas por quadro de pessoal e situações excepcionais.

## Limitações conhecidas

- O sistema registra arquivo e metadados das assinaturas, mas não valida criptograficamente uma assinatura digital.
- \`uploads/\` é armazenamento local e protegido. Em hospedagem serverless, como Vercel, o disco é efêmero; para produção, hospede em servidor com volume persistente ou adapte o mesmo serviço de arquivos para armazenamento durável.
- \`express-session\` usa o armazenamento padrão em memória. Para múltiplas instâncias de produção, deve ser trocado por um store persistente compatível com sessões.
- ViaCEP auxilia o preenchimento, mas não comprova que o endereço existe; o usuário pode corrigir os dados e o backend revalida o formato.
- Regras específicas não publicadas do Campus Bagé continuam configuráveis e precisam de validação institucional.
