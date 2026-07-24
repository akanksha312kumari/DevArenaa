const { Server } = require('socket.io');
const roomHandler = require('./roomHandler');
const duelHandler = require('./duelHandler');
const User = require('../models/User');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // For dev, allow all
      methods: ['GET', 'POST']
    }
  });

  // Keep track of connected users (socketId -> userId)
  const connectedUsers = new Map();

  const broadcastOnlineUsers = async () => {
    try {
      const uniqueUserIds = [...new Set(connectedUsers.values())];
      const users = await User.find({ _id: { $in: uniqueUserIds } })
        .select('username profile.avatar stats.rating');
      io.emit('online_users_update', users);
    } catch (err) {
      console.error('Failed to broadcast online users', err);
    }
  };

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Auth integration: clients must emit 'authenticate' with their userId after connecting
    socket.on('authenticate', (userId) => {
      connectedUsers.set(socket.id, userId);
      socket.join(userId); // Join personal room for direct messages/notifications
      console.log(`Socket ${socket.id} authenticated as User ${userId}`);
      broadcastOnlineUsers();
    });

    // Delegate events to modular handlers
    roomHandler(io, socket, connectedUsers);
    duelHandler(io, socket, connectedUsers);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      connectedUsers.delete(socket.id);
      broadcastOnlineUsers();
    });
  });

  return io;
};

module.exports = initSocket;
