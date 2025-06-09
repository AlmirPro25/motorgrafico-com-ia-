import { Server as SocketIOServer, Socket }_from_ 'socket.io';
import * as ConversationService from '../services/conversation.service';
import * as MessageService from '../services/message.service';
// Assuming SocketData interface is defined in socket.setup.ts or a shared types file
// For now, let's assume it's: interface SocketData { userId: string; }
// If not, define it here or import. For this example, we assume socket.data.userId exists.

interface CallbackAck {
    status: 'ok' | 'error';
    message?: string;
    data?: any;
}

export const registerChatEventHandlers = (io: SocketIOServer, socket: Socket<any, any, any, { userId: string }>) => {
    const userId = socket.data.userId;

    socket.on('join_conversation_room', async (
        payload: { conversationId: string },
        callback: (ack: CallbackAck) => void
    ) => {
        const { conversationId } = payload;
        if (!conversationId) {
            return callback({ status: 'error', message: 'conversationId is required.' });
        }
        console.log(`User ${userId} attempting to join room for conversation ${conversationId}`);
        try {
            const isParticipant = await ConversationService.isUserParticipant(conversationId, userId);
            if (isParticipant) {
                const roomName = `conversation:${conversationId}`;
                socket.join(roomName);
                console.log(`User ${userId} (Socket ${socket.id}) joined room ${roomName}`);
                callback({ status: 'ok', message: `Joined room ${roomName}` });
            } else {
                console.warn(`User ${userId} failed to join room ${conversationId}: Not a participant.`);
                callback({ status: 'error', message: 'Not authorized to join this conversation room.' });
            }
        } catch (error) {
            console.error(`Error joining conversation room ${conversationId} for user ${userId}:`, error);
            callback({ status: 'error', message: 'Server error while trying to join room.' });
        }
    });

    socket.on('leave_conversation_room', (payload: { conversationId: string }) => {
        const { conversationId } = payload;
        if (!conversationId) {
            console.warn(`User ${userId} tried to leave room without conversationId.`);
            return;
        }
        const roomName = `conversation:${conversationId}`;
        socket.leave(roomName);
        console.log(`User ${userId} (Socket ${socket.id}) left room ${roomName}`);
        // No callback needed usually for leave, it's fire and forget from client.
    });

    socket.on('send_message', async (
        payload: { conversationId: string; content_text?: string; content_image_url?: string; content_video_url?: string },
        callback: (ack: CallbackAck) => void
    ) => {
        const { conversationId, content_text, content_image_url, content_video_url } = payload;
        const senderId = userId;

        if (!conversationId) {
            return callback({ status: 'error', message: 'conversationId is required.' });
        }
        if (!content_text && !content_image_url && !content_video_url) {
            return callback({ status: 'error', message: 'Message content (text, image, or video) is required.' });
        }

        console.log(`User ${senderId} attempting to send message to conversation ${conversationId}`);

        try {
            // The MessageService.sendNewMessage will save to DB and then use WebSocketEmitterService
            // to broadcast to the room.
            const savedMessage = await MessageService.sendNewMessage(
                conversationId,
                senderId,
                { content_text, content_image_url, content_video_url },
                socket.id // Pass socket.id to potentially exclude sender from broadcast if emitter handles it
            );

            // The message is broadcast by the service.
            // We send an ACK to the sender with the saved message.
            callback({ status: 'ok', data: savedMessage });
            console.log(`Message from ${senderId} saved and acknowledged for conversation ${conversationId}. Emitter service will broadcast.`);

        } catch (error: any) {
            console.error(`Error sending message from user ${senderId} to conversation ${conversationId}:`, error);
            callback({ status: 'error', message: error.message || 'Failed to send message.' });
        }
    });

    // Add user to their own user-specific room for direct emits (e.g. notifications)
    const userRoomName = `user:${userId}`;
    socket.join(userRoomName);
    console.log(`User ${userId} (Socket ${socket.id}) joined their user-specific room: ${userRoomName}`);
};
