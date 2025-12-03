import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const outputPath = path.join(process.cwd(), "temp", "outputs");

const executeCpp = (filePath, inputFilePath) => {
  const jobId = path.basename(filePath).split(".")[0];
  const outputFilePath = path.join(outputPath, `${jobId}.out`);

  return new Promise((resolve, reject) => {
    try {
      // console.log("Compiling:", filePath);

      const compile = spawn("g++", [
        "-std=c++17",
        "-O2",
        filePath,
        "-o",
        outputFilePath,
      ]);

      let compileError = "";

      compile.stderr.on("data", (data) => {
        compileError += data.toString();
      });

      compile.on("error", (err) => {
        return reject({ error: "Compilation spawn error", stderr: err });
      });

      compile.on("close", (code) => {
        if (code !== 0) {
          return reject({
            error: "Compilation failed",
            stderr: compileError,
          });
        }

        console.log("Compilation successful. Running:", outputFilePath);
        const run = spawn(outputFilePath, [], {
          cwd: outputPath,
          shell: false,
        });

        let stdout = "";
        let stderr = "";

        if (inputFilePath) {
          try {
            const inputStream = fs.createReadStream(inputFilePath);
            inputStream.pipe(run.stdin);
          } catch (err) {
            return reject({ error: "Input file error", stderr: err });
          }
        }

        run.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        run.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        run.on("error", (err) => {
          return reject({ error: "Runtime spawn error", stderr: err });
        });

        run.on("close", (code) => {
          if (code !== 0) {
            return reject({ error: "Runtime error", stderr });
          }
          resolve(stdout);
        });
      });
    } catch (syncErr) {
      reject({ error: "Unexpected error", stderr: syncErr });
    }
  });
};

export default executeCpp;
