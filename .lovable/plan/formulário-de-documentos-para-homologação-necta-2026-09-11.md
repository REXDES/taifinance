# Formulário de documentos para homologação Necta

## Situação atual confirmada

Antes de enviar um estabelecimento para homologação, o Tai Finance já exige:

- **Identificação:** nome/razão social, CPF ou CNPJ válido e tipo de pessoa.
- **Pessoa física:** data de nascimento.
- **Pessoa jurídica:** data de abertura e natureza jurídica.
- **Contato:** e-mail válido e telefone com DDD.
- **Atividade:** ramo de atividade (MCC).
- **Endereço:** CEP, logradouro, número, bairro, cidade e UF.
- **Conta bancária:** banco, agência e conta com dígito.

O cadastro também possui campos complementares: nome fantasia, faturamento mensal, horários e dias de funcionamento, titular e documento da conta, tipo de conta, chave PIX, WhatsApp e Instagram.

Hoje, o sistema envia esses dados para criação do estabelecimento, mas **ainda não possui envio de documentos para homologação**. A estrutura local tem espaço para registrar documentos, porém não é utilizada. O aceite de termos existe apenas em “Meu Perfil”, é opcional e não está integrado ao envio feito na tela de Estabelecimentos.

## O que será construído

### 1. Link seguro para o cliente

- A equipe cria uma solicitação de homologação e envia um link individual ao cliente.
- O cliente acessa sem entrar no Tai Finance, mediante link temporário e protegido.
- Cada solicitação fica vinculada à empresa correta, preservando o isolamento entre empresas.
- O link poderá expirar e ser reenviado pela equipe.

### 2. Formulário adaptado ao tipo de pessoa

O formulário atenderá **pessoa física e pessoa jurídica**, exibindo apenas o que se aplica ao cadastro escolhido.

Etapas:

1. Identificação e contato.
2. Dados da atividade.
3. Endereço.
4. Dados bancários.
5. Responsáveis/sócios, quando exigidos para pessoa jurídica.
6. Documentos.
7. Termos e revisão final.

Os dados já existentes serão preenchidos automaticamente. O cliente completa somente o que faltar.

### 3. Documentos para homologação

- Integrar o envio ao endpoint de documentos do estabelecimento na Necta.
- Aceitar somente **JPG, JPEG e PDF**, conforme o contrato já identificado.
- Antes da implementação, conferir no contrato vigente da Necta a lista completa de categorias aceitas; não serão inventados tipos de documento.
- Exibir a lista aplicável a PF ou PJ, incluindo os tipos já identificados no contrato, como selfie e documento de identificação.
- Para PJ, permitir documentos da empresa e dos responsáveis quando a Necta solicitar.
- Mostrar arquivo enviado, situação, rejeição e opção de substituição.
- Validar formato, tamanho, quantidade e obrigatoriedade antes do envio.

### 4. Termos e consentimento

- Trazer os termos pendentes da Necta para a etapa final.
- Registrar o aceite do cliente com data, termo e versão.
- Vincular assinatura e documentos ao estabelecimento correto.
- Impedir o envio final enquanto houver documento obrigatório ou termo pendente.

### 5. Acompanhamento interno

Na tela administrativa, a equipe verá por solicitação:

- Cliente e empresa vinculada.
- Percentual de preenchimento.
- Dados ou documentos pendentes.
- Situação: rascunho, aguardando cliente, pronto para envio, em análise, homologado ou recusado.
- Motivo de rejeição e ação para solicitar correção ao cliente.
- Histórico de envios, substituições e aceite de termos.

### 6. Segurança

- Arquivos ficarão privados e acessíveis apenas pelo cliente do link e pela equipe autorizada.
- O navegador não receberá credenciais da Necta.
- O servidor validará vínculo, validade do link, tipo e tamanho do arquivo em toda operação.
- Links de visualização serão temporários.
- Ações relevantes ficarão registradas para auditoria.

## Detalhes técnicos

- Criar solicitações e tokens de acesso com validade e uso controlado.
- Criar registros estruturados para documentos, responsáveis, termos e histórico, em vez de depender apenas do campo JSON existente.
- Criar armazenamento privado para os arquivos com limite por arquivo.
- Criar uma função dedicada para receber os arquivos e encaminhá-los em multipart para `POST /establishments/{id}/documents`.
- Ajustar o envio da homologação para validar documentos e termos antes da submissão.
- Manter o cadastro e os arquivos isolados por empresa e aplicar permissões no banco e no armazenamento.

## Critérios de conclusão

- Um cliente PF e um cliente PJ conseguem abrir seus links, completar os dados, anexar documentos e aceitar termos.
- A equipe consegue revisar pendências e enviar à Necta sem acessar arquivos de outra empresa.
- Arquivos inválidos ou campos incompletos são bloqueados com mensagem clara.
- Uma rejeição permite correção e reenvio sem criar outro estabelecimento.
- O status retornado pela Necta aparece tanto para o cliente quanto para a equipe.
