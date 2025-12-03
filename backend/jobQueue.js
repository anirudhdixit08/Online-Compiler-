import connection from "./config/redis.js";
import { Queue } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

export const jobQueueName = "job-queue";
export const jobQueue = new Queue(jobQueueName, { connection });

const addJobToQueue = async (jobId, options = { timeout: 10000 }) => {
  try {
    await jobQueue.add("execute-code", { id: jobId }, options);
    // console.log(`Job with ID ${jobId} successfully added to the queue.`);
  } catch (error) {
    console.error(`Failed to add job with ID ${jobId} to the queue:`, error);
  } finally {
    // console.log("Done with function addJobToQueue");
  }
};

export default addJobToQueue;
