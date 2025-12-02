import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const outputPath = path.join(process.cwd(), "temp", "outputs");

const executeCpp = (filePath, inputFilepath) => {
  const jobId = path.basename(filePath).split(".")[0];
  const outputFilePath = path.join(outputPath, `${jobId}.out`);
  console.log(outputFilePath);
};
