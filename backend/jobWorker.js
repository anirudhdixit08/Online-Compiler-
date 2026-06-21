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
import { normalizeOutput, stripAnsi } from "./judge0Compat.js";
dotenv.config();

process.on("unhandledRejection", (reason) => {
  console.error("Worker unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Worker uncaught exception:", error);
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Worker connected to MongoDB");
  } catch (err) {
    console.error("Worker could not connect to MongoDB...", err);
    process.exit(1);
  }
};

await connectDB();

const outputPath = path.join(process.cwd(), "temp", "outputs");

export const jobQueueName = "job-queue";
const NUM_WORKERS = 5;

const safeUnlink = async (p) => {
  if (!p) return;
  try {
    fs.unlinkSync(p);
  } catch (err) {
    console.error(`Could not delete temp file ${p}:`, err.message);
  }
};

const worker = new Worker(
  jobQueueName,
  async (job) => {
    const { id: jobId } = job.data;
    const jobFind = await Job.findById(jobId);
    if (!jobFind) {
      // console.log("Job not found!");
      return;
    }

    let outputFilePath;
    jobFind.status = "processing";
    jobFind.statusId = 2;
    jobFind.startedAt = new Date();
    await jobFind.save();

    if (jobFind.language === "java") {
      const className = path.basename(jobFind.filePath).replace(".java", "");
      outputFilePath = path.join(outputPath, `${className}.class`);
    } else if (jobFind.language === "c" || jobFind.language === "cpp") {
      outputFilePath = path.join(outputPath, `${jobId}.out`);
    }

    // console.log("Output path : ", outputFilePath);
    // console.log("Processing job with ID:", jobId);
    // console.log("Fetched Job with input file path:", jobFind.inputFilePath);

    try {
      const startedAt = process.hrtime.bigint();
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

      const endedAt = process.hrtime.bigint();
      const elapsedSeconds = Number(endedAt - startedAt) / 1_000_000_000;
      const expectedOutput =
        jobFind.expectedOutput === undefined ? null : jobFind.expectedOutput;
      const cleanOutput = stripAnsi(output);
      const accepted =
        expectedOutput === null ||
        normalizeOutput(cleanOutput) === normalizeOutput(expectedOutput);

      jobFind.completedAt = new Date();
      jobFind.status = accepted ? "success" : "error";
      jobFind.statusId = accepted ? 3 : 4;
      jobFind.output = cleanOutput;
      jobFind.stdout = cleanOutput || null;
      jobFind.stderr = null;
      jobFind.compileOutput = null;
      jobFind.message = accepted ? null : "Wrong Answer";
      jobFind.exitCode = 0;
      jobFind.time = elapsedSeconds.toFixed(3);
      jobFind.wallTime = elapsedSeconds.toFixed(3);
      jobFind.memory = null;
      await jobFind.save();
      // console.log("Job completed successfully:", jobFind);
    } catch (error) {
      jobFind.completedAt = new Date();
      jobFind.status = "error";
      jobFind.statusId = error?.error?.toLowerCase().includes("compilation")
        ? 6
        : 11;
      jobFind.output = null;
      jobFind.stdout = null;
      jobFind.stderr =
        jobFind.statusId === 6
          ? null
          : stripAnsi(error?.stderr || error?.message || "");
      jobFind.compileOutput =
        jobFind.statusId === 6
          ? stripAnsi(error?.stderr || error?.message || "")
          : null;
      jobFind.message = error?.error || "Execution failed";
      jobFind.exitCode = jobFind.statusId === 6 ? null : 1;
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
  console.error(
    `Job ID ${job?.id || "unknown"} failed with reason:`,
    error?.stderr || error?.message || error
  );
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

// worker.on("completed", (job) => {
// console.log(`Job ID ${job.id} completed`);
// });
