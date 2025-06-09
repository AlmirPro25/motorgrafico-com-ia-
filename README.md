# SocialConnect API Backend

Backend da plataforma SocialConnect, construído com Node.js, Express.js, TypeScript e PostgreSQL. Esta API fornece a base para todas as funcionalidades da aplicação, incluindo autenticação de usuários, interações sociais, mensagens em tempo real e mais.

## Funcionalidades Principais

*   **Autenticação de Usuários:** Registro, login, gerenciamento de sessão com JWT.
*   **Perfis de Usuário:** Criação e atualização de perfis, incluindo informações como bio, fotos, e status de presença.
*   **Configurações de Usuário:** Gerenciamento de preferências de privacidade, notificações, tema e idioma.
*   **Sistema de Amizades:** Envio, aceitação, recusa de pedidos de amizade e listagem de amigos.
*   **Posts no Feed:** Criação, visualização, curtidas e comentários em posts.
*   **Grupos:** Criação, gerenciamento de membros, posts específicos de grupos e controle de acesso (público/privado).
*   **Eventos:** Criação, gerenciamento de eventos, RSVPs e comentários em eventos.
*   **Marketplace:** Listagem de itens para venda, busca e gerenciamento de categorias.
*   **Chat em Tempo Real:** Mensagens diretas entre usuários com Socket.IO.
*   **Notificações em Tempo Real:** Alertas sobre interações sociais (curtidas, comentários, pedidos de amizade, etc.) via Socket.IO.
*   **Status de Presença:** Indicação de status online/offline de usuários em tempo real.

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

*   [Node.js](https://nodejs.org/) (versão 16.x ou superior recomendada)
*   [NPM](https://www.npmjs.com/) (geralmente vem com Node.js) ou [Yarn](https://yarnpkg.com/)
*   [PostgreSQL](https://www.postgresql.org/) (versão 12.x ou superior recomendada)
*   Opcional: [Docker](https://www.docker.com/) (se preferir rodar o PostgreSQL em um container)

## Configuração Inicial

1.  **Clonar o Repositório:**
    ```bash
    git clone <URL_DO_REPOSITORIO_AQUI>
    cd socialconnect-backend
    ```

2.  **Instalar Dependências:**
    Usando NPM:
    ```bash
    npm install
    ```
    Ou usando Yarn:
    ```bash
    yarn install
    ```

## Configuração de Variáveis de Ambiente

As variáveis de ambiente são usadas para configurar aspectos sensíveis ou específicos do ambiente da aplicação.

1.  Copie o arquivo de exemplo `.env.example` para um novo arquivo chamado `.env`:
    ```bash
    cp .env.example .env
    ```

2.  Abra o arquivo `.env` e edite as variáveis conforme necessário. As variáveis mais importantes incluem:
    *   `PORT`: Porta em que o servidor irá rodar (ex: `3000` ou `3001`).
    *   `PGHOST`: Host do seu servidor PostgreSQL (ex: `localhost`).
    *   `PGUSER`: Nome de usuário do PostgreSQL.
    *   `PGDATABASE`: Nome do banco de dados PostgreSQL para a aplicação.
    *   `PGPASSWORD`: Senha do usuário PostgreSQL.
    *   `PGPORT`: Porta do servidor PostgreSQL (ex: `5432`).
    *   `JWT_SECRET`: Uma chave secreta longa e aleatória para assinar os tokens JWT.
    *   `JWT_EXPIRES_IN`: Tempo de expiração para os tokens JWT (ex: `1d`, `7d`, `1h`).
    *   `FRONTEND_URL`: URL base do frontend (para configuração CORS do Socket.IO, ex: `http://localhost:5173`).
    *   `NODE_ENV`: Ambiente da aplicação (ex: `development`, `production`, `test`).

## Configuração do Banco de Dados

1.  **Criar Usuário e Banco de Dados:**
    Certifique-se de que o PostgreSQL está rodando. Você precisará criar um usuário e um banco de dados para a aplicação, conforme configurado no seu arquivo `.env`.
    Exemplo usando `psql`:
    ```sql
    CREATE USER seu_usuario_db WITH PASSWORD 'sua_senha_db';
    CREATE DATABASE socialconnect_db OWNER seu_usuario_db;
    -- (Opcional) Se necessário para extensões como uuid-ossp:
    -- \c socialconnect_db
    -- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    ```

2.  **Executar DDLs (Data Definition Language):**
    As definições de tabelas (schemas) para cada funcionalidade (Usuários, Posts, Notificações, etc.) foram fornecidas nas instruções de implementação de cada fase. **Você precisará executar manualmente esses scripts SQL no seu banco de dados `socialconnect_db` para criar todas as tabelas e tipos necessários.** Consulte a documentação de cada fase ou os arquivos de schema SQL do projeto (se consolidados) para obter os DDLs completos.

## Scripts Disponíveis

Os seguintes scripts estão disponíveis no `package.json` e podem ser executados com `npm run <script_name>` ou `yarn <script_name>`:

*   `build`: Compila o código TypeScript para JavaScript (geralmente para a pasta `dist/`).
    ```bash
    npm run build
    ```
*   `start`: Inicia o servidor em modo de produção a partir dos arquivos compilados na pasta `dist/`.
    ```bash
    npm run start
    ```
*   `dev`: Inicia o servidor em modo de desenvolvimento com `nodemon` e `ts-node`, reiniciando automaticamente em alterações de código.
    ```bash
    npm run dev
    ```
*   `test`: (Placeholder - adaptar se testes foram configurados) Executa os testes automatizados.
    ```bash
    npm run test
    ```

## Estrutura do Projeto

A estrutura de pastas do projeto é organizada da seguinte forma:

```
socialconnect-backend/
├── src/
│   ├── config/         # Configurações (DB, Socket.IO setup, etc.)
│   ├── controllers/    # Controladores (lógica de requisição/resposta HTTP)
│   ├── middlewares/    # Middlewares Express (autenticação, erro, etc.)
│   ├── models/         # Definições de tipos, interfaces e funções de interação com o BD (arquivos *.types.ts e *.db.ts)
│   ├── routes/         # Definições de rotas da API REST
│   ├── services/       # Lógica de negócios da aplicação
│   ├── socket/         # Lógica relacionada ao WebSocket (handlers de eventos, setup)
│   └── index.ts        # Ponto de entrada principal da aplicação, setup do servidor Express e Socket.IO
├── tests/              # (Opcional) Testes automatizados
├── .env.example        # Arquivo de exemplo para variáveis de ambiente
├── .gitignore          # Arquivos e pastas ignorados pelo Git
├── openapi.yaml        # Documentação da API REST (OpenAPI 3.0)
├── package.json        # Metadados do projeto e dependências
├── README.md           # Este arquivo
└── tsconfig.json       # Configurações do compilador TypeScript
```

## Documentação da API

*   **API REST:** A documentação detalhada dos endpoints da API REST está disponível no arquivo `openapi.yaml` na raiz do projeto. Você pode usar ferramentas como o [Swagger Editor](https://editor.swagger.io/) ou [Swagger UI](https://swagger.io/tools/swagger-ui/) para visualizar esta documentação de forma interativa.
*   **API WebSocket:** A documentação para os eventos e funcionalidades WebSocket está disponível no arquivo `WEBSOCKET_API.md`.

## Como Contribuir

Contribuições são bem-vindas! Por favor, siga as diretrizes de contribuição do projeto (se houver um arquivo `CONTRIBUTING.md`, caso contrário, este é um placeholder).

1.  Faça um Fork do projeto.
2.  Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`).
3.  Faça commit das suas alterações (`git commit -m 'Add some AmazingFeature'`).
4.  Faça push para a branch (`git push origin feature/AmazingFeature`).
5.  Abra um Pull Request.

---

Desenvolvido para a plataforma SocialConnect.
```
