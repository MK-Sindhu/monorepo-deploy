import express from "express";
import { db } from "db";

const app = express();

app.use(express.json());

app.get("/users", async (_req, res) => {
  try {
    const users = await db.orm.public.User.all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/user", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  try {
    const user = await db.orm.public.User.create({ username, password });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(3001);
