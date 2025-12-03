import express from "express";
import dotenv from "dotenv";

import { generateCodeFile, generateInputFile } from "./utils/generateFile.js";
import addJobToQueue from "./jobQueue.js";
import DBConnection from "./config/db.js";
import Job from "./models/jobModel.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function InitializeConnection() {
  try {
    await DBConnection();
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

app.post("/run", async (req, res) => {
  try {
    const { language = "cpp", code, input } = req.body;
    if (code === undefined) {
      return res.status(400).json({ success: false, error: "Empty code!" });
    }
    try {
      let job = await new Job({
        language,
        startedAt: new Date(),
      }).save();

      const jobId = job._id;
      const filePath = generateCodeFile(language, code, jobId);

      let inputFilePath;
      if (input) {
        inputFilePath = generateInputFile(input, jobId);
      }

      job.filePath = filePath;
      job.inputFilePath = inputFilePath;
      await job.save();

      addJobToQueue(jobId, {
        delay: 1000,
        removeOnComplete: true,
        timeout: 60000,
      });
      console.log(`Job added to queue with ID: ${jobId}`);

      res.status(201).json({ success: true, jobId, language, code });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error: error });
    }
  } catch (error) {}
});

app.get("/status/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  if (!jobId) {
    return res.status(400).json({ success: false, error: "Missing jobId!" });
  }
  try {
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found." });
    }
    return res.status(200).json({ success: true, job });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: JSON.stringify(error) });
  }
});

const PORT = process.env.PORT;
app.get("/", (req, res) => {
  res.send("This is Anirudh using this port for online compiler backend!");
});

app.listen(PORT, () => {
  console.log("Server is running on port ", PORT);
});
