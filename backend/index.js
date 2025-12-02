import express from "express";
import dotenv from "dotenv";

import { generateCodeFile } from "./utils/generateFile.js";
import DBConnection from "./config/db.js";
import RedisConnection from "./config/redis.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function InitializeConnection() {
    console.log('Starting Connection!');
    try {
        await Promise.all([DBConnection(), RedisConnection()]);
        console.log("Connection to Mongo, CloudinaryEstablished!");
        app.listen(process.env.PORT, () => {
            console.log(`Server listening on Port ${process.env.PORT}`);
        });
    } catch (error) {
        console.error("CRITICAL: Initialization failed. Server did not start.");
        console.error(error);
        process.exit(1); 
    }
}

InitializeConnection();

app.get("/", (req, res) => {
  res.send("This is Anirudh using this port for online compiler backend!");
});

app.post("/run", (req, res) => {
  try {
    const { language = "cpp", code } = req.body;
    if (code === undefined) {
      return res.status(400).json({ success: false, error: "Empty code!" });
    }
    res.status(201).json({ language, code });
  } catch (error) {}
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log("Server is running on port ", PORT);
});
