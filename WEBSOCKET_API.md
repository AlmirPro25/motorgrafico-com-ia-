# SocialConnect WebSocket API Documentation

Esta documentação descreve a API WebSocket para a aplicação SocialConnect, permitindo funcionalidades em tempo real como chat, notificações e status de presença.

## 1. Visão Geral da Conexão WebSocket

*   **Endpoint:** A URL base do seu servidor HTTP (ex: `ws://localhost:3000` ou `wss://api.socialconnect.com`). O Socket.IO usará o mesmo porto que o servidor HTTP por padrão.
*   **Transporte:** Primariamente WebSockets, com fallback para HTTP long-polling (gerenciado pelo Socket.IO).
*   **Autenticação:**
    *   A autenticação é realizada no momento da conexão WebSocket.
    *   O cliente DEVE enviar um token JWT válido através do campo `auth.token` nas opções de handshake do Socket.IO.
    *   **Exemplo (Cliente):**
        ```javascript
        import io from 'socket.io-client';

        const jwtToken = "seu_jwt_token_aqui"; // Obtido após login REST API
        const socket = io("http://localhost:3000", { // Ou sua URL de produção
            auth: {
                token: jwtToken
            },
            transports: ['websocket'] // Opcional: força websocket
        });

        socket.on('connect', () => {
            console.log('Conectado ao servidor WebSocket com ID:', socket.id);
        });

        socket.on('connect_error', (err) => {
            console.error('Erro de conexão WebSocket:', err.message);
            // Se err.message contiver "Authentication error", o token é inválido ou ausente
        });
        ```
    *   Se a autenticação falhar, o servidor rejeitará a conexão.
    *   Se bem-sucedida, o `userId` associado ao token JWT é armazenado em `socket.data.userId` no lado do servidor para uso subsequente.

## 2. Gerenciamento de Salas (Rooms)

Sockets são agrupados em salas para direcionar mensagens e eventos.

*   **Salas de Usuário (User Rooms):**
    *   **Padrão de Nomenclatura:** `user:<userId>` (ex: `user:a1b2c3d4-e5f6-7890-1234-567890abcdef`)
    *   **Entrada:** Cada socket de usuário autenticado é automaticamente adicionado à sua sala de usuário pessoal no momento da conexão.
    *   **Propósito:** Usado para enviar notificações diretas ou atualizações específicas para todas as conexões ativas de um usuário.

*   **Salas de Conversa (Conversation Rooms):**
    *   **Padrão de Nomenclatura:** `conversation:<conversationId>` (ex: `conversation:uuid-da-conversa-123`)
    *   **Entrada:** O cliente deve emitir o evento `join_conversation_room` para entrar.
    *   **Saída:** O cliente pode emitir `leave_conversation_room` ou é automaticamente removido ao desconectar.
    *   **Propósito:** Usado para transmitir mensagens de chat e eventos relacionados a uma conversa específica apenas para seus participantes ativos.

## 3. Lista Detalhada de Eventos WebSocket

### 3.1 Autenticação e Conexão Geral

*   **Evento:** `connect` (Implícito do Socket.IO)
    *   **Direção:** Servidor -> Cliente
    *   **Descrição:** Emitido para o cliente quando a conexão (e autenticação) é bem-sucedida.
    *   **Payload:** Nenhum.
    *   **Salas Relevantes:** Nenhuma (ocorre antes da entrada em salas específicas da aplicação).

*   **Evento:** `disconnect` (Implícito do Socket.IO)
    *   **Direção:** Servidor -> Cliente (e o cliente também pode iniciar)
    *   **Descrição:** Emitido para o cliente quando a conexão é perdida. O servidor também lida com este evento para realizar limpezas, como atualizar o status de presença.
    *   **Payload (Cliente recebe):** `reason` (string, ex: `io server disconnect`, `io client disconnect`, `ping timeout`)
    *   **Salas Relevantes:** O socket é automaticamente removido de todas as salas em que entrou.

*   **Evento:** `connect_error` (Implícito do Socket.IO)
    *   **Direção:** Servidor -> Cliente
    *   **Descrição:** Emitido para o cliente se a conexão não puder ser estabelecida ou a autenticação falhar.
    *   **Payload:** `Error` object (ex: `{ message: "Authentication error: Token not provided." }`)
    *   **Salas Relevantes:** Nenhuma.

*   **Evento (Opcional Sugerido):** `server_error`
    *   **Direção:** Servidor -> Cliente
    *   **Descrição:** Um evento genérico que o servidor pode emitir para um cliente específico se ocorrer um erro ao processar um dos seus eventos emitidos.
    *   **Payload:**
        ```json
        {
            "message": "string", // Mensagem de erro descritiva
            "details": "any" // Opcional: detalhes adicionais do erro
        }
        ```
    *   **Salas Relevantes:** Geralmente emitido diretamente para o socket do cliente.

### 3.2 Chat

*   **Evento:** `join_conversation_room`
    *   **Direção:** Cliente -> Servidor
    *   **Descrição:** Solicita a entrada do socket do cliente na sala de uma conversa específica para receber mensagens em tempo real.
    *   **Payload:**
        ```json
        {
            "conversationId": "string" // UUID da conversa
        }
        ```
    *   **Ack (Callback do Servidor):**
        ```json
        // Sucesso
        { "status": "ok", "message": "Joined room conversation:<conversationId>" }
        // Erro
        { "status": "error", "message": "Not authorized to join this conversation room." }
        // Erro
        { "status": "error", "message": "conversationId is required." }
        ```
    *   **Salas Relevantes:** Nenhuma (a ação é para entrar na sala `conversation:<conversationId>`).

*   **Evento:** `leave_conversation_room`
    *   **Direção:** Cliente -> Servidor
    *   **Descrição:** Solicita a saída do socket do cliente da sala de uma conversa específica.
    *   **Payload:**
        ```json
        {
            "conversationId": "string" // UUID da conversa
        }
        ```
    *   **Salas Relevantes:** `conversation:<conversationId>` (o socket será removido desta sala).

*   **Evento:** `send_message`
    *   **Direção:** Cliente -> Servidor
    *   **Descrição:** Envia uma nova mensagem para uma conversa. O servidor persistirá a mensagem e a transmitirá para os membros da sala.
    *   **Payload:**
        ```json
        {
            "conversationId": "string", // UUID da conversa
            "content_text": "string", // Conteúdo de texto da mensagem (opcional se houver mídia)
            "content_image_url": "string", // URL de uma imagem (opcional)
            "content_video_url": "string"  // URL de um vídeo (opcional)
        }
        ```
    *   **Ack (Callback do Servidor):**
        ```json
        // Sucesso
        {
            "status": "ok",
            "data": { /* Objeto da Mensagem Salva (ver payload de new_message) */ }
        }
        // Erro
        { "status": "error", "message": "Failed to send message." }
        ```
    *   **Salas Relevantes:** Nenhuma (o servidor encaminhará para `conversation:<conversationId>`).

*   **Evento:** `new_message`
    *   **Direção:** Servidor -> Cliente
    *   **Descrição:** Notifica os clientes na sala de conversa sobre uma nova mensagem.
    *   **Payload:**
        ```json
        {
            "id": "string", // UUID da mensagem
            "conversation_id": "string", // UUID da conversa
            "sender": { // Perfil público do remetente
                "id": "string", // UUID do usuário remetente
                "handle": "string",
                "first_name": "string", // Opcional
                "last_name": "string", // Opcional
                "profile_picture_url": "string" // Opcional
            },
            "content_text": "string", // Opcional
            "content_image_url": "string", // Opcional
            "content_video_url": "string", // Opcional
            "created_at": "string" // Data ISO 8601 (ex: "2023-10-27T10:30:00.000Z")
        }
        ```
    *   **Salas Relevantes:** `conversation:<conversationId>` (emitido para esta sala).

### 3.3 Notificações

*   **Evento:** `new_notification`
    *   **Direção:** Servidor -> Cliente
    *   **Descrição:** Envia uma nova notificação para um usuário específico.
    *   **Payload:**
        ```json
        {
            "id": "string", // UUID da notificação
            "type": "string", // Ex: "new_like", "new_comment_on_post", "new_friend_request", "friend_request_accepted"
            "actor": { // Usuário que realizou a ação
                "id": "string",
                "handle": "string",
                "first_name": "string", // Opcional
                "profile_picture_url": "string" // Opcional
            },
            "target": { // Opcional: entidade relacionada à notificação
                "type": "string", // Ex: "post", "user", "comment"
                "id": "string",   // UUID da entidade alvo
                "title": "string" // Opcional: um snippet ou título (ex: início do post)
            },
            "message": "string", // Mensagem formatada para exibição (ex: "John Doe curtiu seu post.")
            "created_at": "string", // Data ISO 8601
            "read_at": "string | null" // Data ISO 8601 ou null
        }
        ```
    *   **Salas Relevantes:** `user:<recipientUserId>` (emitido para esta sala).

*   **Evento:** `unread_notifications_count_update`
    *   **Direção:** Servidor -> Cliente
    *   **Descrição:** Atualiza a contagem de notificações não lidas para o usuário.
    *   **Payload:**
        ```json
        {
            "unread_count": "number"
        }
        ```
    *   **Salas Relevantes:** `user:<userId>` (emitido para esta sala).

### 3.4 Presença Online/Offline

*   **Evento:** `user_online`
    *   **Direção:** Servidor -> Cliente
    *   **Descrição:** Notifica os amigos de um usuário que ele ficou online.
    *   **Payload:**
        ```json
        {
            "userId": "string", // UUID do usuário que ficou online
            "status": "online"
        }
        ```
    *   **Salas Relevantes:** `user:<friendId>` (emitido para as salas de cada amigo).

*   **Evento:** `user_offline`
    *   **Direção:** Servidor -> Cliente
    *   **Descrição:** Notifica os amigos de um usuário que ele ficou offline.
    *   **Payload:**
        ```json
        {
            "userId": "string", // UUID do usuário que ficou offline
            "status": "offline",
            "lastSeenAt": "string" // Data ISO 8601 de quando o usuário foi visto pela última vez
        }
        ```
    *   **Salas Relevantes:** `user:<friendId>` (emitido para as salas de cada amigo).

```
