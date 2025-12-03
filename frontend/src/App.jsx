import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import axiosClient from "../utils/axiosClient";
import "./App.css";

const codeTemplates = {
  cpp: `// C++
#include <iostream>
using namespace std;
int main()
{
    int a, b;
    std::cin >> a >> b;
    std::cout << "The sum is: " << a + b << std::endl;
    return 0;
}`,
  c: `// C
#include <stdio.h>
int main()
{
    int a, b;
    if (scanf("%d %d", &a, &b) == 2)
    {
        printf("The sum is: %d", a + b);
    }
    else
    {
        printf("Invalid input.");
    }
    return 0;
}`,
  py: `# Python
import sys
# Read from standard input
try:
    a = int(sys.stdin.readline())
    b = int(sys.stdin.readline())
    print(f"The sum is: {a + b}")
except (ValueError, TypeError):
    print("Invalid input.")`,
  java: `// Java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        try {
            int a = scanner.nextInt();
            int b = scanner.nextInt();
            System.out.println("The sum is: " + (a + b));
        } catch (Exception e) {
            System.out.println("Invalid input.");
        } finally {
            scanner.close();
        }
    }
}`,
  js: `// JavaScript (Node.js)
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let lines = [];
rl.on('line', (line) => {
  lines.push(line);
});

rl.on('close', () => {
  const [a, b] = lines.map(Number);
  console.log('The sum is:', a + b);
});`,
};

const inputTemplates = {
  cpp: `10 20`,
  c: `10 20`,
  py: `10
20`,
  java: `10 20`,
  js: `10
20`,
};

function App() {
  const [code, setCode] = useState(codeTemplates["cpp"]);
  const [output, setOutput] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [input, setInput] = useState(inputTemplates["cpp"]);
  const [loading, setLoading] = useState(false);
  const [runClicked, setRunClicked] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState("pending");
  const editorRef = useRef(null);

  useEffect(() => {
    setCode(codeTemplates[language]);
    setInput(inputTemplates[language]);
  }, [language]);

  const handleSubmit = async () => {
    setLoading(true);
    setOutput("Running...");
    setRunClicked(true);
    setJobId(null);
    setJobStatus("pending");

    const payload = {
      language,
      code,
      input,
    };

    try {
      const { data } = await axiosClient.post("/run", payload);
      setJobId(data.jobId);

      const intervalId = setInterval(async () => {
        const { data: statusData } = await axiosClient.get(
          `/status/${data.jobId}`
        );

        // console.log(`Job ID: ${data.jobId}, Status: ${statusData.job.status}`);
        setJobStatus(statusData.job.status);

        if (
          statusData.success &&
          (statusData.job.status === "success" ||
            statusData.job.status === "error")
        ) {
          if (statusData.job.status === "success") {
            setOutput(statusData.job.output);
          } else {
            const error = JSON.parse(statusData.job.output);
            const errorMessage =
              error?.error?.stderr ||
              error?.error?.message ||
              "An unexpected error occurred.";
            setOutput(`Error: ${errorMessage}`);
          }
          clearInterval(intervalId);
          setLoading(false);
        }
      }, 500);
    } catch (error) {
      console.error(error.response);
      const errorMessage =
        error.response?.data?.error?.stderr ||
        error.response?.data?.error ||
        "An unexpected error occurred.";
      setOutput(`Error: ${errorMessage}`);
      setLoading(false);
    }
  };

  const handleAiReview = async () => {
    setLoading(true);
    setOutput("Getting AI review...");
    setRunClicked(false);
    setJobId(null);
    setJobStatus("pending");

    const payload = { code };

    try {
      const { data } = await axiosClient.post("/ai-review", payload);
      if (data.success) {
        setOutput(data.review);
      } else {
        setOutput(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("AI Review Error:", error.response);
      const errorMessage =
        error.response?.data?.error || "An unexpected error occurred.";
      setOutput(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleSubmit();
    });
  };

  const monacoLanguageMap = (lang) => {
    switch (lang) {
      case "cpp":
        return "cpp";
      case "c":
        return "c";
      case "py":
        return "python";
      case "java":
        return "java";
      case "js":
        return "javascript";
      default:
        return "plaintext";
    }
  };

  return (
    <div className="h-screen w-full flex flex-col p-4 text-gray-100 bg-gray-800 font-inter">
      <div className="w-full flex-1 rounded-2xl p-8 space-y-6 relative z-10 flex flex-col">
        <h1 className="text-4xl font-extrabold text-center text-white">
          Online Compiler and IDE
        </h1>

        <div className="flex flex-col md:flex-row md:space-x-4 space-y-6 md:space-y-0 flex-1">
          <div className="md:w-2/3 flex flex-col space-y-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <label htmlFor="language-select" className="sr-only">
                  Select Language
                </label>
                <select
                  id="language-select"
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                  }}
                  className="w-full p-3 rounded-xl bg-gray-700 text-white border-2 border-white focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <option value="cpp">C++</option>
                  <option value="c">C</option>
                  <option value="py">Python</option>
                  <option value="java">Java</option>
                  <option value="js">JavaScript</option>
                </select>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <svg
                      className="animate-spin h-5 w-5 mx-auto"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    "Run"
                  )}
                </button>
                <button
                  onClick={handleAiReview}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <svg
                      className="animate-spin h-5 w-5 mx-auto"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    "AI Review"
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 rounded-xl border-2 border-white max-h-[70vh] bg-[#2d3748] flex flex-col">
              <label htmlFor="code-editor" className="sr-only">
                Code Editor
              </label>
              <div className="flex-1 overflow-y-auto">
                <Editor
                  height="100%"
                  language={monacoLanguageMap(language)}
                  value={code}
                  theme="vs-dark"
                  onChange={(value) => setCode(value ?? "")}
                  onMount={handleEditorMount}
                  options={{
                    selectOnLineNumbers: true,
                    roundedSelection: false,
                    readOnly: false,
                    fontSize: 16,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    automaticLayout: true,
                    formatOnType: true,
                    formatOnPaste: true,
                    smoothScrolling: true,
                    glyphMargin: true,
                    folding: true,
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:w-1/3 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Input</h2>
                <button
                  onClick={() => setInput("")}
                  className="text-sm px-4 py-1 rounded-full text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Clear
                </button>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your input here..."
                className="w-full p-4 rounded-xl bg-gray-700 text-white text-sm font-mono border-2 border-white focus:outline-none focus:ring-2 focus:ring-white h-48 overflow-auto resize-none"
              ></textarea>
            </div>

            <div className="space-y-2 flex-1 flex flex-col">
              <h2 className="text-xl font-bold">Output</h2>
              <div className="flex-1 overflow-y-auto rounded-xl border-2 border-white bg-gray-700 p-6 text-sm font-mono text-green-300 whitespace-pre-wrap break-words">
                <pre>{output}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
