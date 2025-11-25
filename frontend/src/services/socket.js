import { io } from 'socket.io-client';

// Use environment variable or fallback to same origin (for production with reverse proxy)
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to game server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from game server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getLobby(gameType) {
    this.socket.emit('getLobby', { gameType });
  }

  createTable(gameType, tableName) {
    this.socket.emit('createTable', { gameType, tableName });
  }

  joinTable(gameType, tableId, mode = 'multiplayer', seatNumber = null) {
    this.socket.emit('joinTable', { gameType, tableId, mode, seatNumber });
  }

  leaveTable() {
    this.socket.emit('leaveTable');
  }

  gameAction(action, data = {}) {
    this.socket.emit('gameAction', { action, ...data });
  }

  on(event, callback) {
    this.socket.on(event, callback);
  }

  off(event, callback) {
    this.socket.off(event, callback);
  }

  get id() {
    return this.socket?.id;
  }
}

export default new SocketService();
