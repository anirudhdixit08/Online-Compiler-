import express from "express";
import dotenv from "dotenv";

import { generateCodeFile, generateInputFile } from "./utils/generateFile.js";
import generateAiResponse from "./controllers/generateAiResponse.js";
import addJobToQueue, { getQueueHealth } from "./jobQueue.js";
import DBConnection from "./config/db.js";
import Job from "./models/jobModel.js";
import cors from "cors";
import {
  SUPPORTED_LANGUAGES,
  JUDGE0_STATUSES,
  decodeMaybeBase64,
  encodeMaybeBase64,
  getLanguageById,
  getLanguageByKey,
  getStatusById,
  hasValidationErrors,
  isTruthyQuery,
  pickFields,
  validateSubmissionPayload,
} from "./judge0Compat.js";

dotenv.config();
const app = express();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const judge0AuthToken = process.env.MY_COMPILER_SECRET;
const requireJudge0Auth = (req, res, next) => {
  const token =
    req.get("X-Auth-Token") ||
    req.get("x-auth-token") ||
    req.query.auth_token;

  if (judge0AuthToken && token === judge0AuthToken) return next();

  return res.status(401).json({ error: "Authentication failed." });
};

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

const DEFAULT_SUBMISSION_FIELDS =
  "stdout,time,memory,stderr,token,compile_output,message,status,status_id,language_id";

const toJudge0Submission = (job, options = {}) => {
  const base64Encoded = Boolean(options.base64Encoded);
  const statusId = job.statusId || (job.status === "success" ? 3 : 1);
  const language = getLanguageById(job.languageId) || getLanguageByKey(job.language);

  const submission = {
    stdout: encodeMaybeBase64(job.stdout, base64Encoded),
    time: job.time || null,
    memory: job.memory ?? null,
    stderr: encodeMaybeBase64(job.stderr, base64Encoded),
    token: String(job._id),
    compile_output: encodeMaybeBase64(job.compileOutput, base64Encoded),
    message: job.message || null,
    status: getStatusById(statusId),
    language_id: job.languageId || language?.id || null,
    language: language ? { id: language.id, name: language.name } : null,
    status_id: statusId,
    created_at: job.submittedAt?.toISOString?.() || null,
    finished_at: job.completedAt?.toISOString?.() || null,
    exit_code: job.exitCode ?? null,
    exit_signal: job.exitSignal ?? null,
    wall_time: job.wallTime || null,
  };

  return pickFields(submission, options.fields || DEFAULT_SUBMISSION_FIELDS);
};

const enqueueSubmission = async (submission, base64Encoded = false) => {
  const language = getLanguageById(submission.language_id);
  const sourceCode = decodeMaybeBase64(submission.source_code, base64Encoded);
  const stdin = decodeMaybeBase64(submission.stdin, base64Encoded);
  const expectedOutput = decodeMaybeBase64(
    submission.expected_output,
    base64Encoded
  );

  const job = await new Job({
    language: language.key,
    languageId: language.id,
    sourceCode,
    stdin,
    expectedOutput,
    startedAt: null,
    status: "pending",
    statusId: 1,
  }).save();

  const filePath = generateCodeFile(language.key, sourceCode, job._id);
  let inputFilePath;
  if (stdin !== undefined && stdin !== null && stdin !== "") {
    inputFilePath = generateInputFile(stdin, job._id);
  }

  job.filePath = filePath;
  job.inputFilePath = inputFilePath;
  await job.save();

  try {
    await addJobToQueue(job._id, {
      delay: 1000,
      removeOnComplete: true,
      timeout: 60000,
    });
  } catch (error) {
    job.status = "error";
    job.statusId = 13;
    job.message = "Failed to enqueue submission";
    await job.save();
    throw error;
  }

  return job;
};

const waitForSubmission = async (token, timeoutMs = 60000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await Job.findById(token);
    if (job && ![1, 2].includes(job.statusId)) return job;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return Job.findById(token);
};

app.get("/languages", (req, res) => {
  res.status(200).json(
    SUPPORTED_LANGUAGES.map(({ id, name }) => ({
      id,
      name,
    }))
  );
});

app.get("/languages/:id", (req, res) => {
  const language = getLanguageById(req.params.id);
  if (!language) {
    return res.status(404).json({ error: "language not found" });
  }

  return res.status(200).json({
    id: language.id,
    name: language.name,
    is_archived: language.is_archived,
  });
});

app.get("/statuses", (req, res) => {
  res.status(200).json(JUDGE0_STATUSES);
});

app.get("/health", async (req, res) => {
  try {
    const queue = await getQueueHealth();
    return res.status(200).json({
      ok: true,
      queue,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return res.status(503).json({
      ok: false,
      error: "Queue health check failed",
    });
  }
});

app.post("/submissions", async (req, res) => {
  const base64Encoded = isTruthyQuery(req.query.base64_encoded);
  const wait = isTruthyQuery(req.query.wait);
  const validationErrors = validateSubmissionPayload(req.body);

  if (hasValidationErrors(validationErrors)) {
    return res.status(422).json(validationErrors);
  }

  try {
    const job = await enqueueSubmission(req.body, base64Encoded);

    if (!wait) {
      return res.status(201).json({ token: String(job._id) });
    }

    const completedJob = await waitForSubmission(job._id);
    return res
      .status(201)
      .json(
        toJudge0Submission(completedJob || job, {
          base64Encoded,
          fields: req.query.fields,
        })
      );
  } catch (error) {
    console.error("Error creating Judge0 submission:", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

app.get("/submissions", async (req, res) => {
  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.per_page || 20);

  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: `invalid page: ${req.query.page}` });
  }

  if (!Number.isInteger(perPage) || perPage < 1) {
    return res
      .status(400)
      .json({ error: `invalid per_page: ${req.query.per_page}` });
  }

  try {
    const totalCount = await Job.countDocuments();
    const totalPages = Math.ceil(totalCount / perPage);
    const jobs = await Job.find()
      .sort({ submittedAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    return res.status(200).json({
      submissions: jobs.map((job) =>
        toJudge0Submission(job, {
          base64Encoded: isTruthyQuery(req.query.base64_encoded),
          fields: req.query.fields,
        })
      ),
      meta: {
        current_page: page,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
        total_pages: totalPages,
        total_count: totalCount,
      },
    });
  } catch (error) {
    console.error("Error listing Judge0 submissions:", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

app.get("/submissions/batch", async (req, res) => {
  const tokens = String(req.query.tokens || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const validTokens = tokens.filter((token) => /^[a-f\d]{24}$/i.test(token));

  if (tokens.length === 0) {
    return res.status(400).json({ error: "tokens parameter is required" });
  }

  try {
    const jobs = await Job.find({ _id: { $in: validTokens } });
    const byToken = new Map(jobs.map((job) => [String(job._id), job]));
    const base64Encoded = isTruthyQuery(req.query.base64_encoded);

    return res.status(200).json({
      submissions: tokens
        .map((token) => byToken.get(token))
        .filter(Boolean)
        .map((job) =>
          toJudge0Submission(job, {
            base64Encoded,
            fields: req.query.fields,
          })
        ),
    });
  } catch (error) {
    console.error("Error getting Judge0 submission batch:", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

app.post("/submissions/batch", requireJudge0Auth, async (req, res) => {
  const base64Encoded = isTruthyQuery(req.query.base64_encoded);
  const submissions = Array.isArray(req.body?.submissions)
    ? req.body.submissions
    : [];

  try {
    const results = [];

    for (const submission of submissions) {
      const validationErrors = validateSubmissionPayload(submission);

      if (hasValidationErrors(validationErrors)) {
        results.push(validationErrors);
        continue;
      }

      const job = await enqueueSubmission(submission, base64Encoded);
      results.push({ token: String(job._id) });
    }

    return res.status(201).json(results);
  } catch (error) {
    console.error("Error creating Judge0 submission batch:", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

app.get("/submissions/:token", async (req, res) => {
  try {
    const job = await Job.findById(req.params.token);
    if (!job) {
      return res.status(404).json({ error: "submission not found" });
    }

    return res.status(200).json(
      toJudge0Submission(job, {
        base64Encoded: isTruthyQuery(req.query.base64_encoded),
        fields: req.query.fields,
      })
    );
  } catch (error) {
    return res.status(404).json({ error: "submission not found" });
  }
});

app.post("/run", async (req, res) => {
  try {
    const { language = "cpp", code, input } = req.body;
    if (code === undefined) {
      return res.status(400).json({ success: false, error: "Empty code!" });
    }
    try {
      const languageInfo = getLanguageByKey(language);
      if (!languageInfo) {
        return res.status(400).json({
          success: false,
          error: `Unsupported language: ${language}`,
        });
      }

      let job = await new Job({
        language,
        languageId: languageInfo.id,
        sourceCode: code,
        stdin: input,
        status: "pending",
        statusId: 1,
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

      await addJobToQueue(jobId, {
        delay: 1000,
        removeOnComplete: true,
        timeout: 60000,
      });
      // console.log(`Job added to queue with ID: ${jobId}`);

      res.status(201).json({ success: true, jobId, language, code });
    } catch (error) {
      // console.error(error);
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

app.post("/ai-review", async (req, res) => {
  if (!req.body || req.body.code === undefined) {
    return res.status(400).json({
      success: false,
      error: "Empty or invalid request body. Please provide a 'code' property.",
    });
  }

  const { code, language, input } = req.body;
  if (code === undefined) {
    return res.status(404).json({ success: false, error: "Empty code!" });
  }
  try {
    const aiResponse = await generateAiResponse(code);
    res.status(200).json({ success: true, review: aiResponse });
  } catch (error) {
    console.error("Error in getting AI Review !", error);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while getting the AI review.",
    });
  }
});

const PORT = process.env.PORT;
app.get("/", (req, res) => {
  res.send("This is Anirudh using this port for online compiler backend!");
});

// app.listen(PORT, () => {
//   console.log("Server is running on Port ", PORT);
// });
