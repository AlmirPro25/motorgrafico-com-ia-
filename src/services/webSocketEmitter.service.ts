import { Server as SocketIOServer, Socket } from 'socket.io';

class WebSocketEmitterService {
    private io: SocketIOServer | null = null;

    public initialize(ioInstance: SocketIOServer): void {
        if (this.io) {
            console.warn("WebSocketEmitterService already initialized.");
            return;
        }
        this.io = ioInstance;
        console.log("WebSocketEmitterService initialized.");
    }

    public getIO(): SocketIOServer | null {
        if (!this.io) {
            console.error("WebSocketEmitterService not initialized or IO instance is null.");
        }
        return this.io;
    }

    /**
     * Emits an event to all sockets in a specific room (e.g., a conversation).
     * @param room The room identifier (e.g., `conversation:${conversationId}`).
     * @param eventName The name of the event to emit.
     * @param data The data to send with the event.
     * @param senderSocketId Optional. If provided, the event will not be sent to this socket.
     */
    public emitToRoom(room: string, eventName: string, data: any, senderSocketId?: string): void {
        if (!this.io) {
            console.error('Cannot emit event: WebSocketEmitterService not initialized.');
            return;
        }

        if (senderSocketId) {
            // Get the socket object if it exists
            const senderSocket = this.io.sockets.sockets.get(senderSocketId);
            if (senderSocket) {
                senderSocket.to(room).emit(eventName, data);
                 console.log(`Emitted event '${eventName}' to room '${room}' (excluding sender ${senderSocketId})`);
            } else {
                // Fallback if sender socket not found, emit to all (or handle error)
                this.io.to(room).emit(eventName, data);
                console.warn(`Emitted event '${eventName}' to room '${room}'. Sender socket ${senderSocketId} not found, so emitted to all in room.`);
            }
        } else {
            this.io.to(room).emit(eventName, data);
            console.log(`Emitted event '${eventName}' to all in room '${room}'`);
        }
    }

    /**
     * Emits an event directly to a specific user via their known socket ID(s) if available and they are in a specific room.
     * This is more complex as a user might have multiple sockets. Managing user-to-socket mapping is needed for this.
     * For chat, emitting to a conversation room is usually sufficient.
     * Emitting to all sockets of a specific user ID across all rooms/connections:
     */
    public emitToUserSockets(userId: string, eventName: string, data: any): void {
        if (!this.io) {
            console.error('Cannot emit event to user sockets: WebSocketEmitterService not initialized.');
            return;
        }
        // Socket.IO v4 allows addressing all sockets associated with a user if you manage this link.
        // This typically involves joining each socket of a user to a user-specific room: e.g., `socket.join('user:' + socket.data.userId);`
        // Then you can emit to that room.
        // This join happens in `chat.events.ts` or a similar place upon connection.

        const userRoomName = `user:${userId}`;
        this.io.to(userRoomName).emit(eventName, data);
        console.log(`Emitted event '${eventName}' to user room '${userRoomName}'`);
    }


    // Specific emitter for chat messages to a conversation
    public emitToConversation(conversationId: string, eventName: string, data: any, senderSocketId?: string): void {
        const roomName = `conversation:${conversationId}`;
        this.emitToRoom(roomName, eventName, data, senderSocketId);
    }
}

// Export a singleton instance
export const webSocketEmitterService = new WebSocketEmitterService();
