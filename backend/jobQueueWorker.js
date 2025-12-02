import connection from "./config/redis";
import { Queue, Worker } from "bullmq";
import mongoose from "mongoose";
import dotenv from "dotenv";
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

export const jobQueueName = "job-queue";
export const jobQueue = new Queue(jobQueueName, { connection });
const NUM_WORKERS = 5;

const worker = new Worker(
  jobQueueName,
  async (job) => {
    const { id: jobId } = job.data;
    const jobFind = await Job.findById(jobId);
    if (!jobFind) {
      console.log("Job not found!");
      return;
    }
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
    }
  },
  {
    connection,
    concurrency: NUM_WORKERS,
  }
);
worker.on("failed", (job, error) => {
  console.error(`Job ID ${job.id} failed with reason:`, error.message);
});

worker.on("completed", (job) => {
  console.log(`Job ID ${job.id} completed`);
});

export const addJobToQueue = async (jobId, options = { timeout: 10000 }) => {
  try {
    await jobQueue.add("execute-code", { id: jobId }, options);
    console.log(`Job with ID ${jobId} successfully added to the queue.`);
  } catch (error) {
    console.error(`Failed to add job with ID ${jobId} to the queue:`, error);
  } finally {
    console.log("Done with function addJobToQueue");
  }
};
