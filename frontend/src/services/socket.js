import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io('http://localhost:3000', {
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

  joinTable(gameType, tableId, mode) {
    this.socket.emit('joinTable', { gameType, tableId, mode });
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
}

export default new SocketService();
