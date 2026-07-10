const socketAuth = require("./socketAuth");
const registerChatHandlers = require("./chatHandlers");

/**
 * Wires authentication + event handlers onto a Socket.io server instance.
 * @param {import("socket.io").Server} io
 */
const initSocket = (io) => {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    registerChatHandlers(io, socket);
  });
};

module.exports = initSocket;
