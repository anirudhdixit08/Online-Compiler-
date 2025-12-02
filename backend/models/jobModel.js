import mongoose from "mongoose";

const JobSchema = mongoose.Schema({
  language: {
    type: String,
    required: true,
    enum: ["cpp", "py","java","c","js"],
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
    enum: ["pending", "success", "error"],
  },
  output: {
    type: String,
  },
});

module.exports = mongoose.model("job", JobSchema);