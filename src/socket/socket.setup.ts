import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { registerChatEventHandlers } from './chat.events';
import { webSocketEmitterService } from '../services/webSocketEmitter.service';
import * as UserDB from '../models/user.db'; // For updateUserPresence
import * as FriendDB from '../models/friend.db'; // For getUserFriends
import { PublicUserProfile } from '../models/user.types'; // For friend list type

interface SocketData {
    userId: string;
    // Potentially other data you might want to store per socket instance
}

export const setupSocketIO = (httpServer: HttpServer): SocketIOServer => {
    const io = new SocketIOServer<any, any, any, SocketData>(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173", // Default for Vite React dev
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Middleware for JWT Authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: Token not provided.'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
            socket.data.userId = decoded.userId; // Attach userId to socket object
            next();
        } catch (err) {
            console.error("Socket authentication error:", err);
            return next(new Error('Authentication error: Invalid token.'));
        }
    });

    io.on('connection', (socket: Socket<any, any, any, SocketData>) => {
        if (!socket.data.userId) {
            console.error("Socket connected without userId in socket.data. This shouldn't happen if auth middleware is working.");
            socket.disconnect(true);
            return;
        }
        const currentUserId = socket.data.userId;
        console.log(`User connected via WebSocket: ${currentUserId} with socket ID: ${socket.id}`);

        // 1. Update presence to online
        UserDB.updateUserPresence(currentUserId, true, new Date())
            .then(async () => {
                // 2. Get friends
                // Assuming getUserFriends returns a list of PublicUserProfile or objects with an 'id' field for friend's userId
                // For simplicity, not using pagination here. In a real app, consider if this list can be very large.
                const friends: PublicUserProfile[] = await FriendDB.getUserFriends(currentUserId, { page: 1, limit: 5000 }); // High limit for now

                // 3. Emit 'user_online' to friends
                friends.forEach(friend => {
                    if (friend.id !== currentUserId) { // Should not happen if getUserFriends is correct
                        webSocketEmitterService.emitToUser(friend.id, 'user_online', { userId: currentUserId, status: 'online' });
                    }
                });
                console.log(`User ${currentUserId} marked as online and friends notified.`);
            })
            .catch(err => console.error(`Error updating presence or notifying friends for ${currentUserId} on connect:`, err));

        // Register event handlers for this socket (e.g., chat, notifications)
        registerChatEventHandlers(io, socket); // This also adds user to their own user:${userId} room

        socket.on('disconnect', async (reason) => {
            console.log(`User disconnected: ${currentUserId} (Socket ID: ${socket.id}). Reason: ${reason}`);

            // Wait a brief moment to allow for immediate reconnects before checking other sockets
            // This is a common strategy but can be adjusted or made more sophisticated.
            setTimeout(async () => {
                try {
                    const userRoomName = `user:${currentUserId}`;
                    const socketsInUserRoom = io.sockets.adapter.rooms.get(userRoomName);
                    const otherConnectionsExist = socketsInUserRoom ? socketsInUserRoom.size > 0 : false;

                    console.log(`Checking other connections for ${currentUserId}: found ${socketsInUserRoom ? socketsInUserRoom.size : 0} in room ${userRoomName}`);

                    if (!otherConnectionsExist) {
                        await UserDB.updateUserPresence(currentUserId, false, new Date());
                        const friends: PublicUserProfile[] = await FriendDB.getUserFriends(currentUserId, { page: 1, limit: 5000 });
                        const offlinePayload = { userId: currentUserId, status: 'offline', lastSeenAt: new Date().toISOString() };

                        friends.forEach(friend => {
                             if (friend.id !== currentUserId) {
                                webSocketEmitterService.emitToUser(friend.id, 'user_offline', offlinePayload);
                            }
                        });
                        console.log(`User ${currentUserId} marked as offline, last_seen updated, and friends notified.`);
                    } else {
                        console.log(`User ${currentUserId} still has other active connections. Not marking as offline.`);
                    }
                } catch (err) {
                    console.error(`Error updating presence or notifying friends for ${currentUserId} on disconnect:`, err);
                }
            }, 500); // 500ms delay, adjust as needed
        });
    });

    // Initialize Emitter Service
    webSocketEmitterService.initialize(io);

    console.log('Socket.IO server initialized and attached to HTTP server.');
    return io;
};
