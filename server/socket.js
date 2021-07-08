const io = require("socket.io")(process.env.PORT || 8081, {
  cors: {
    origin: true,
  },
});

module.exports = { io };
