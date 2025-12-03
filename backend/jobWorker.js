import connection from "./config/redis.js";
import { Worker } from "bullmq";
import mongoose from "mongoose";
import dotenv from "dotenv";
import executeCpp from "./controllers/executeCpp.js";
import Job from "./models/jobModel.js";
import executeC from "./controllers/executeC.js";
import executeJava from "./controllers/executeJava.js";
import executeJs from "./controllers/executeJs.js";
import executePy from "./controllers/executePy.js";
import fs from "fs";
import path from "path";
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Worker connected to MongoDB");
  } catch (err) {
    console.error("Worker could not connect to MongoDB...", err);
    process.exit(1);
  }
};

connectDB();

const outputPath = path.join(process.cwd(), "temp", "outputs");

export const jobQueueName = "job-queue";
const NUM_WORKERS = 5;

const safeUnlink = async (p) => {
  if (!p) return;
  try {
    fs.unlinkSync(p);
  } catch (err) {
    console.error("Job failed:", jobFind, error);
  }
};

const worker = new Worker(
  jobQueueName,
  async (job) => {
    const { id: jobId } = job.data;
    const jobFind = await Job.findById(jobId);
    if (!jobFind) {
      console.log("Job not found!");
      return;
    }

    let outputFilePath;

    if (jobFind.language === "java") {
      const className = path.basename(jobFind.filePath).replace(".java", "");
      outputFilePath = path.join(outputPath, `${className}.class`);
    } else if (jobFind.language === "c" || jobFind.language === "cpp") {
      outputFilePath = path.join(outputPath, `${jobId}.out`);
    }

    console.log("Output path : ", outputFilePath);
    console.log("Processing job with ID:", jobId);
    console.log("Fetched Job with input file path:", jobFind.inputFilePath);

    try {
      let output;

      switch (jobFind.language) {
        case "cpp":
          output = await executeCpp(jobFind.filePath, jobFind.inputFilePath);
          break;
        case "py":
          output = await executePy(jobFind.filePath, jobFind.inputFilePath);
          break;
        case "java":
          output = await executeJava(jobFind.filePath, jobFind.inputFilePath);
          break;
        case "c":
          output = await executeC(jobFind.filePath, jobFind.inputFilePath);
          break;
        case "js":
          output = await executeJs(jobFind.filePath, jobFind.inputFilePath);
          break;
        default:
          throw new Error(`Unsupported language: ${jobFind.language}`);
      }

      jobFind.completedAt = new Date();
      jobFind.status = "success";
      jobFind.output = output;
      await jobFind.save();
      console.log("Job completed successfully:", jobFind);
    } catch (error) {
      jobFind.completedAt = new Date();
      jobFind.status = "error";
      jobFind.output = JSON.stringify(error);
      await jobFind.save();
      console.error("Job failed:", jobFind, error);
      throw error;
    } finally {
      safeUnlink(jobFind.filePath).catch(() => {});
      if (jobFind.inputFilePath)
        safeUnlink(jobFind.inputFilePath).catch(() => {});
      safeUnlink(outputFilePath).catch(() => {});
    }
  },
  {
    connection,
    concurrency: NUM_WORKERS,
  }
);
worker.on("failed", (job, error) => {
  console.error(`Job ID ${job.id} failed with reason:`, error.stderr);
});

worker.on("completed", (job) => {
  console.log(`Job ID ${job.id} completed`);
});
