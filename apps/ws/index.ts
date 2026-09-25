import { db } from "db";

Bun.serve({
  port: 8081,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    async message(ws, message) {
      await db.orm.public.User.create({
        username: Math.random().toString(),
        password: Math.random().toString(),
      });
      ws.send(message);
    },
  },
});
