# Documentação do Projeto — Consulta Crédito TOTVS

> Este arquivo foi criado para documentar o funcionamento completo do projeto: o que ele faz, como está organizado, suas dependências e como rodá-lo. Serve tanto como referência pessoal quanto como contexto para dar a qualquer IA (ex: "leia o `documentacao.md` na raiz do projeto e me ajude com X").

## 1. Visão geral

Aplicação web (SPA em React) usada pela equipe financeira/comercial para **consultar a situação de crédito de clientes (empresas) cadastrados no TOTVS Moda**, simular negociações de dívida e gerar documentos de acordo/confissão de dívida (`.docx`) prontos para download.

Principais capacidades:

- Buscar um cliente por CNPJ e exibir: dados cadastrais, limite de crédito, valores vencidos/a vencer, e a lista de duplicatas (títulos) com status de pagamento.
- Exportar a lista de duplicatas em CSV, XLSX, XLS ou PDF.
- Simular um acordo de negociação (parcelamento com juros) sobre as duplicatas vencidas selecionadas.
- Montar um **Acordo de Crédito** completo: selecionar duplicatas, preencher dados das partes (notificado, sócio, avalista, devedor solidário, testemunhas), configurar encargos (juros, multa, honorários, entrada), pré-visualizar o documento Word gerado a partir de um modelo `.docx` e baixá-lo preenchido.
- Controle de acesso duplo: **rede interna** (login com usuário/senha) e **acesso externo** (link com um parâmetro `k` que carrega o CNPJ codificado, sem exigir login).

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework UI | React 19 + React Router DOM 7 |
| Build tool | Vite 7 (`@vitejs/plugin-react-swc`) |
| Requisições HTTP | `fetch` nativo e `axios` (para ViaCEP) |
| Geração de `.docx` | `docxtemplater` + `pizzip` (preenche o template a partir de variáveis) |
| Pré-visualização do `.docx` | `mammoth` (converte `.docx` → HTML) + `dompurify` (sanitiza o HTML antes de renderizar) |
| Exportação de tabelas | `xlsx` (CSV/XLSX/XLS) e `jspdf` + `html2canvas` (PDF) |
| Números por extenso | `extenso` |
| Ícones | `react-icons` |
| Lint | ESLint 9 (flat config) |

> ⚠️ **Atenção**: `dompurify` é usado em `PreviewAcordo.jsx` mas **não está listado em `package.json`** (aparece apenas indiretamente no `package-lock.json`). Isso pode quebrar uma instalação limpa (`npm ci`) em outra máquina. Se isso acontecer, rode `npm install dompurify` e adicione-o às dependências.

## 3. Como rodar o projeto

```bash
npm install        # instala as dependências
npm run dev         # ambiente de desenvolvimento (Vite, com HMR)
npm run build        # gera build de produção em /dist
npm run preview      # serve o build de produção localmente (porta 4173)
npm run lint         # roda o ESLint
```

A aplicação usa `base: '/consulta-credito-totvs/'` (ver `vite.config.js`) — ou seja, em produção ela é servida sob esse subcaminho, não na raiz do domínio.

### Docker / Deploy

- `Dockerfile`: imagem `node:20-alpine`, faz `npm install` + `npm run build` e sobe com `npm run preview -- --host --port 4173`.
- `docker-compose.yaml`: sobe o serviço `consulta-credito-totvs`, mapeia a porta `8083:4173`, injeta variáveis do `.env`, e usa **Traefik** como proxy reverso (roteia `felizacordarcolchoes.com.br/consulta-credito-totvs`).
- `.github/workflows/deploy.yml`: pipeline de deploy automático — a cada push na branch `main`, conecta via SSH na VPS, dá `git pull`, `docker compose down`, `docker compose build --no-cache` e `docker compose up -d`.

## 4. Variáveis de ambiente (`.env`)

O projeto **não versiona um `.env.example`** — as variáveis abaixo foram identificadas lendo o código-fonte. Todas são prefixadas com `VITE_` (obrigatório para o Vite expor no client-side):

| Variável | Usada em | Finalidade |
|---|---|---|
| `VITE_API_TOTVS_BASE_URL` | `services/totvs.js` | URL base da API do TOTVS Moda |
| `VITE_API_TOTVS_CLIENT_ID` | `services/totvs.js` | Client ID do OAuth (grant `password`) |
| `VITE_API_TOTVS_CLIENT_SECRET` | `services/totvs.js` | Client secret do OAuth |
| `VITE_API_TOTVS_USERNAME` | `services/totvs.js` | Usuário técnico usado para autenticar na API TOTVS |
| `VITE_API_TOTVS_PASSWORD` | `services/totvs.js` | Senha do usuário técnico |
| `VITE_API_URL` | `services/api.js` (legado, ver seção 8.1) | URL base de uma API interna alternativa |
| `VITE_IPS_INTERNOS` | `pages/ConsultaCredito/ConsultaCredito.jsx` | Lista de IPs (separados por vírgula) considerados "rede interna" |

> ⚠️ Como essas variáveis são embutidas no bundle JS (padrão do Vite), **client_id/secret/senha da API TOTVS ficam visíveis no navegador** de quem acessa a aplicação. Vale considerar mover a integração com o TOTVS para um backend próprio caso isso seja uma preocupação de segurança.

## 5. Estrutura de pastas

```
src/
├── App.jsx                     # Rotas da aplicação (React Router)
├── main.jsx                    # Ponto de entrada (ReactDOM.createRoot)
├── assets/                     # Logo
├── constants/
│   └── encargos.js             # Tipos, valores padrão e labels dos "encargos" (juros, multa...)
├── context/
│   ├── ModelosContext.jsx      # Provider que pré-carrega os modelos .docx (public/modelos)
│   └── useModelos.js           # Hook de acesso ao contexto acima
├── pages/
│   ├── Login/                  # Tela de login (usuário/senha fixos em users.json)
│   └── ConsultaCredito/        # Página principal da aplicação
├── components/
│   ├── Header/                 # Cabeçalho + campo de busca por CNPJ
│   ├── InformacoesCadastrais/  # Cartão com dados cadastrais do cliente
│   ├── ResumoCredito/          # Cartões-resumo (limite, utilizado, vencido, atrasos...)
│   ├── SituacaoFinanceira/     # Tabela de duplicatas (busca, filtro, ordenação, exportação)
│   ├── SimuladorNegociacao/    # Modal de simulação simples de negociação
│   ├── AcordoCredito/          # Modal completo de montagem do Acordo de Crédito
│   │   ├── AcordoCredito.jsx
│   │   ├── CampoEncargo.jsx        # Um campo de encargo dinâmico (juros/multa/etc.)
│   │   └── MenuAdicionarEncargo.jsx # Dropdown para adicionar novos encargos
│   ├── PreviewAcordo/          # Modal que renderiza o preview HTML do .docx antes do download
│   ├── PainelAcao/             # (não utilizado atualmente — ver seção 10)
│   └── HistoricoInteracoes/    # (não utilizado atualmente — ver seção 10)
├── services/
│   ├── api.js                  # Camada de API alternativa/legada (ver seção 10)
│   ├── authService.js          # Login persistente ("manter-me conectado") via localStorage
│   ├── dataMapper.js           # Mapeia respostas da API TOTVS para o formato usado na UI
│   ├── encargosCalculos.js     # Cálculo de juros/multa/honorários do Acordo de Crédito
│   ├── pegarIP.js              # Descobre o IP público do usuário (via ipify)
│   └── totvs.js                # Cliente da API TOTVS Moda (token OAuth + endpoints)
└── utils/
    └── exportUtils.js          # Exportação da tabela de duplicatas (CSV/XLSX/XLS/PDF)

public/modelos/                 # Templates .docx usados no Acordo de Crédito
```

## 6. Rotas (`App.jsx`)

A aplicação usa `BrowserRouter` com `basename="/consulta-credito-totvs/"`:

- `/login` → `Login`
- `/` → `ConsultaCredito` (página principal)
- qualquer outra rota → redireciona para `/`

Tudo é envolvido pelo `ModelosProvider`, que carrega os `.docx` de `public/modelos` assim que a aplicação sobe.

## 7. Controle de acesso — dois modos

A lógica fica toda em `ConsultaCredito.jsx`, no `useEffect` de "validarAcesso":

1. **Descobre o IP público** do usuário (`pegarIP.js`, via `api.ipify.org`).
2. Compara com a lista `VITE_IPS_INTERNOS`:
   - **Se o IP é interno**: exige login (usuário/senha fixos, ver seção 7.1). Se não estiver logado nem tiver um "login permanente" válido, redireciona para `/login`. Usuário interno pode buscar qualquer CNPJ livremente pela barra de busca do `Header` e tem acesso ao botão **Acordo de Crédito**.
   - **Se o IP não é interno (acesso externo)**: não pede login. Em vez disso, espera um parâmetro de URL `?k=...` — uma string em **Base64 URL-safe** contendo o CNPJ do cliente. O `k` é decodificado, validado (14 dígitos) e salvo em `sessionStorage` (`externo-k`) para persistir durante a sessão mesmo que o usuário recarregue sem o parâmetro na URL. Após decodificar, a busca do cliente é feita automaticamente. Esse fluxo é pensado para links enviados diretamente ao cliente (sem exigir login) mostrando **apenas** a consulta daquele CNPJ — o botão de Acordo de Crédito fica oculto.

### 7.1 Login (rede interna)

- Credenciais fixas em `src/pages/Login/users.json` (`{"user": "financeiro", "senha": "123"}`) — **não há backend de autenticação**, é apenas um "portão" simples para a rede interna.
- Ao logar, grava `sessionStorage.setItem("usuario-logado", "true")`.
- Se o checkbox "Manter-me conectado" for marcado, `authService.js` salva em `localStorage` (`permanentLogin`) o usuário e o horário do último acesso (fuso `America/Sao_Paulo`). Esse login permanece válido por **3 dias** (`PERMANENT_LOGIN_DAYS`); a cada validação bem-sucedida a data é atualizada (`updateLastAccessDate`).

## 8. Fluxo principal de dados (busca por CNPJ)

Ao chamar `handleSearch(cnpj)` em `ConsultaCredito.jsx`:

1. Limpa o CNPJ (`limparCnpj` — remove tudo que não é dígito) e valida 14 dígitos.
2. Dispara **3 chamadas em paralelo** à API TOTVS (`services/totvs.js`):
   - `searchLegalEntities(cnpj)` → dados cadastrais (endereço, telefone, e-mail, classificação).
   - `searchCustomerFinancialBalance(cnpj)` → limite de crédito e saldo em aberto.
   - `searchDocuments(cnpj)` → lista de títulos/duplicatas (parcelas).
3. Cada resposta é convertida pelo `services/dataMapper.js` para o formato usado pelos componentes:
   - `mapLegalEntityToDadosCadastrais` — monta razão social, CNPJ formatado, endereço (com fallback de bairro via **ViaCEP** se a API TOTVS não trouxer), telefone formatado etc.
   - `mapFinancialBalanceToResumoCredito` — soma limites/saldos, calcula maior atraso, atraso médio dos últimos 12 meses, contagem de títulos vencidos/a vencer.
   - `mapDocumentsToDuplicatas` — transforma cada documento em uma linha de duplicata com status calculado (`Pago`, `Pago com Atraso`, `Pago Parcialmente`, `Vencido`, `Vence Hoje`, `A Vencer`).
4. Os três resultados alimentam os componentes `InformacoesCadastrais`, `ResumoCredito` e `SituacaoFinanceira`.

### 8.1 `services/totvs.js` — cliente da API TOTVS Moda

- Faz autenticação OAuth2 (`grant_type=password`) contra `/api/totvsmoda/authorization/v2/token`, guardando o token em memória (`accessToken`/`tokenExpiresAt`) e renovando automaticamente quando expira ou quando a API retorna `401`.
- `makeRequest` é o helper central: injeta o Bearer token e reenvia a requisição uma vez em caso de 401.
- Endpoints usados:
  - `searchLegalEntities(cnpj)` — dados da pessoa jurídica.
  - `searchCustomerFinancialBalance(cnpjCnpj)` — saldo financeiro/limite (filtra pela filial `branchCodeList: [3]`).
  - `searchDocuments(cpfCnpj)` — títulos em aberto/pagos (também filtra `branchCodeList: [3]`).

### 8.2 `services/api.js` — camada alternativa (não utilizada atualmente)

Esse arquivo implementa um fluxo parecido (`getCliente`, `getTitulosFuturos`, `getTitulosVencidos`, `mapClienteToDadosCadastrais`, `mapTituloToDuplicata`, `calcularResumo`) apontando para `VITE_API_URL`, mas **não está importado em nenhum lugar do código atual** (`ConsultaCredito.jsx` usa `totvs.js` + `dataMapper.js`). Provavelmente é uma versão anterior da integração, mantida no repositório mas fora de uso. Ver seção 10.

## 9. Componentes principais

### `Header`
Cabeçalho fixo com logo e, **apenas quando `redeInterna=true`**, um campo de busca por CNPJ (dispara `onSearch` ao clicar em "Buscar" ou pressionar Enter).

### `InformacoesCadastrais`
Cartão com razão social, nome fantasia, CNPJ, IE, endereço, telefones, e-mail, divisão de negócios e data de abertura. Tem atalhos rápidos: abrir WhatsApp (`wa.me`), enviar e-mail (`mailto:`), abrir o **Simulador de Negociação** e (se `ipInterno`) abrir o **Acordo de Crédito**.

### `ResumoCredito`
Grade de cartões com limite total, utilizado, disponível (com barra de progresso percentual), parcelas vencidas/a vencer, data da última revisão, maior atraso, média de atraso em 12 meses e contagem de títulos vencidos/a vencer.

### `SituacaoFinanceira`
Tabela de duplicatas com:
- Busca por número de duplicata/parcela.
- Filtro multi-seleção por status de pagamento.
- Ordenação clicável em qualquer coluna.
- Exportação (CSV, XLSX, XLS, PDF) via `utils/exportUtils.js`.

### `SimuladorNegociacao`
Modal simples e independente (não usa `constants/encargos.js`): permite selecionar duplicatas vencidas e simular **Quitação à vista** ou **Parcelamento** com juros compostos fixos de **5% a.m.** embutidos no próprio componente. Usado para uma estimativa rápida, sem gerar documento.

### `AcordoCredito` (o módulo mais complexo do projeto)
Modal completo para montar e gerar o documento de acordo:
- **Seleção de duplicatas** vencidas/a vencer (exclui as já pagas).
- **Dados das partes**: Notificado (pré-preenchido com os dados cadastrais do cliente), Sócio, Avalista e Devedor Solidário — cada um em um bloco expansível, com máscaras de CPF/CNPJ/CEP/RG e **auto-preenchimento de endereço via ViaCEP** ao digitar um CEP válido (exceto para o Notificado). Valida CPF (dígitos verificadores) e sinaliza quando inválido.
- **Encargos** (`constants/encargos.js` + `services/encargosCalculos.js`):
  - Campos fixos sempre presentes: `juros_mora` e `parcelas_pagas`.
  - Campos adicionáveis dinamicamente (`MenuAdicionarEncargo`): `juros_mensal`, `juros_parcelamento`, `multa`, `honorarios`, `entrada` — cada um pode ser removido/reconfigurado (`CampoEncargo`), incluindo se o juro é **simples** ou **composto**.
  - O cálculo (`calcularSimulacaoComEncargos`) trata separadamente pagamento **à vista** (juros simples sobre o subtotal) e **parcelado** (aplica primeiro os juros mensais e depois os juros de parcelamento, cada um podendo ser simples ou composto, sobre a base já com multa/honorários).
- **Testemunhas**: dois campos fixos, pré-preenchidos com nomes/CPFs padrão (hardcoded em `dataMapper.js → buildInitialPartes`), mas editáveis.
- **Geração de documento**: monta um objeto `dadosBaseDocumento` com todas as variáveis do template (valores formatados em R$, por extenso, tabelas de parcelas geradas dinamicamente — `TABELA_1`, `TABELA_2`, `TABELA_3` — e todos os campos de partes com placeholder `_____` quando vazios). Usa `PizZip` + `Docxtemplater` para injetar essas variáveis no `.docx` selecionado (carregado via `ModelosContext`) e oferece:
  - **Prévia** (abre `PreviewAcordo`, que converte o `.docx` gerado em HTML via `mammoth` e sanitiza com `DOMPurify`).
  - **Download** do `.docx` final (nome do arquivo: `acordo_<cnpj>_<timestamp>.docx`).

### `PreviewAcordo`
Modal que recebe o buffer do `.docx` já preenchido, converte para HTML (`mammoth`) e renderiza sanitizado (`DOMPurify`). Tem botão para baixar o `.docx` final.

### `CampoEncargo` / `MenuAdicionarEncargo`
Subcomponentes de UI do `AcordoCredito` para, respectivamente, editar um encargo já adicionado e escolher um novo encargo a adicionar dentre os que ainda faltam (`ORDEM_ENCARGOS` menos os já presentes).

## 10. Componentes/serviços não utilizados atualmente

Ao rastrear os imports de `App.jsx`/`ConsultaCredito.jsx`, os seguintes arquivos **existem no repositório mas não são referenciados por nenhuma tela ativa**:

- `src/components/PainelAcao/PainelAcao.jsx` — formulário de "Registrar Cobrança" (canal de contato, resultado, observações).
- `src/components/HistoricoInteracoes/HistoricoInteracoes.jsx` — timeline de interações com o cliente.
- `src/services/api.js` — camada de API alternativa (`VITE_API_URL`), substituída pela integração direta com o TOTVS (`totvs.js` + `dataMapper.js`).

Provavelmente fazem parte de uma funcionalidade de "histórico de cobrança" ainda não finalizada/reintegrada. Vale confirmar com quem desenvolveu antes de removê-los, já que podem estar em progresso.

## 11. Modelos de documento (`public/modelos`)

Três templates `.docx` (usam a sintaxe de placeholders do Docxtemplater, ex.: `{NOME_NOT}`, tabelas com loop `{#TABELA_1}...{/TABELA_1}`):

- `confisao-boleto.docx` — Confissão de Dívida (tipo "Acordo de Crédito").
- `notificacao-confisao-divida.docx` — Notificação de Confissão de Dívida.
- `notificacao-nf-compra.docx` — Notificação de NF de Compra.

A lista e o mapeamento nome↔arquivo ficam em `src/context/ModelosContext.jsx` (`LISTA_MODELOS`). Para adicionar um novo modelo: colocar o `.docx` em `public/modelos/`, adicioná-lo em `LISTA_MODELOS`, e garantir que as variáveis usadas no template existam em `dadosBaseDocumento` (montado em `AcordoCredito.jsx`) ou em `mapPartesToTemplateVariables` (`dataMapper.js`).

## 12. Constantes de encargos (`src/constants/encargos.js`)

Fonte única de verdade para os tipos de encargo do Acordo de Crédito:

- `TIPOS_ENCARGO` — enum dos tipos (`juros_mensal`, `juros_parcelamento`, `juros_mora`, `multa`, `honorarios`, `entrada`, `parcelas_pagas`).
- `VALORES_PADRAO` — valor inicial e se é juro simples/composto por padrão ao adicionar cada tipo.
- `LABELS_ENCARGO` — rótulo exibido na UI.
- `ORDEM_ENCARGOS` — ordem de exibição no menu "Adicionar Encargo" (exclui os campos fixos).
- `CAMPOS_FIXOS` — `juros_mora` e `parcelas_pagas`, sempre presentes e não removíveis.
- Helpers `ehJuros`, `ehValorMonetario`, `ehQuantidade`, `ehCampoFixo` — usados para decidir o símbolo (`%`, `R$`, `Qtd`) e o comportamento de cada campo na UI.

## 13. Pontos de atenção / dívidas técnicas

- **Credenciais de login fixas e em texto puro** em `src/pages/Login/users.json`, versionado no Git. Não é um mecanismo de autenticação seguro — serve apenas como barreira simples para a rede interna.
- **`dompurify` ausente do `package.json`** (ver seção 2) — risco de quebra em instalação limpa.
- **Segredos da API TOTVS expostos no bundle do client** (ver seção 4) — qualquer pessoa pode inspecionar o JS de produção e extrair `client_id`/`client_secret`/usuário/senha.
- **Componentes órfãos** (`PainelAcao`, `HistoricoInteracoes`) e **serviço órfão** (`api.js`) — ver seção 10.
- **Nomes de testemunhas hardcoded** em `dataMapper.js → buildInitialPartes` — específico do negócio atual, mas fica "escondido" dentro do mapper em vez de configurável.
- Sem testes automatizados no projeto (nenhuma dependência de teste em `package.json`).

## 14. Como pedir ajuda a uma IA sobre este projeto

Basta indicar: *"Leia o arquivo `documentacao.md` na raiz do projeto para entender o contexto completo antes de me ajudar."* Esse documento cobre a arquitetura, o fluxo de dados, os principais componentes/serviços e os pontos de atenção conhecidos — deve ser suficiente para a IA entender o "porquê" das coisas sem precisar reler o projeto inteiro do zero. Ainda assim, para tarefas específicas, aponte também o(s) arquivo(s) relevante(s) (ex.: "meche no cálculo de juros, veja `src/services/encargosCalculos.js`").

> Este documento reflete o estado do código em 2026-07-14. Se a estrutura do projeto mudar significativamente (novas telas, troca de API, remoção dos componentes órfãos etc.), vale atualizar este arquivo.
