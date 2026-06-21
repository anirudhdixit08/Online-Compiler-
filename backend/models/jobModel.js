import mongoose from "mongoose";

const JobSchema = mongoose.Schema({
  language: {
    type: String,
    required: true,
    enum: ["cpp", "py", "java", "c", "js"],
  },
  languageId: {
    type: Number,
  },
  sourceCode: {
    type: String,
  },
  stdin: {
    type: String,
  },
  expectedOutput: {
    type: String,
  },
  filePath: {
    type: String,
  },
  inputFilePath: {
    type: String,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  status: {
    type: String,
    default: "pending",
    enum: ["pending", "processing", "success", "error"],
  },
  statusId: {
    type: Number,
    default: 1,
  },
  output: {
    type: String,
  },
  stdout: {
    type: String,
  },
  stderr: {
    type: String,
  },
  compileOutput: {
    type: String,
  },
  message: {
    type: String,
  },
  exitCode: {
    type: Number,
  },
  exitSignal: {
    type: Number,
  },
  time: {
    type: String,
  },
  wallTime: {
    type: String,
  },
  memory: {
    type: Number,
  },
});

const Job = mongoose.model("job", JobSchema);
export default Job;
