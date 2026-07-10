// In-memory online-user tracking. Fine for the current single-instance
// deployment; if the backend is ever scaled horizontally, this would need
// to move to a shared store (e.g. Redis) alongside the Socket.io Redis
// adapter - not needed today.
const onlineSockets = new Map(); // userId -> Set<socketId>

const addSocket = (userId, socketId) => {
  if (!onlineSockets.has(userId)) {
    onlineSockets.set(userId, new Set());
  }
  onlineSockets.get(userId).add(socketId);
};

/** Returns true if this was the user's last open socket (i.e. now offline). */
const removeSocket = (userId, socketId) => {
  const sockets = onlineSockets.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineSockets.delete(userId);
    return true;
  }
  return false;
};

const isOnline = (userId) => onlineSockets.has(userId);

module.exports = { addSocket, removeSocket, isOnline };
