import dotenv from "dotenv";

dotenv.config();

const buildRedisConnection = () => {
  if (process.env.REDIS_URL) {
    const redisUrl = new URL(process.env.REDIS_URL);
    return {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      tls: redisUrl.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
};

const connection = buildRedisConnection();

export default connection;

// export const redisClient = createClient({
//   username: process.env.REDIS_USERNAME || undefined,
//   password: process.env.REDIS_PASSWORD || undefined,
//   socket: {
//     host: process.env.REDIS_HOST || "127.0.0.1",
//     port: process.env.REDIS_PORT || 6379,
//   },
// });

// redisClient.on("connect", () => {
//   console.log("Redis Connection Established");
// });

// redisClient.on("reconnecting", () => {
//   console.log("Redis reconnecting...");
// });

// redisClient.on("end", () => {
//   console.log("Redis connection closed");
// });

// redisClient.on("error", (err) => {
//   console.log("Redis Client Error:", err.message);
// });

// const RedisConnection = async () => {
//   try {
//     console.log("Redis Connection Starting");
//     await redisClient.connect();
//   } catch (error) {
//     console.log("Redis Connection error " + error);
//   }
//   return redisClient;
// };

// export default RedisConnection;
