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
  const [jobStatus, setJobStatus] = useState("pending");
  const editorRef = useRef(null);
  const LOGO_FILENAME = "/logo.png";

  useEffect(() => {
    setCode(codeTemplates[language]);
    setInput(inputTemplates[language]);
  }, [language]);

  const handleSubmit = async () => {
    setLoading(true);
    setOutput("Running code...");
    setJobStatus("pending");

    const payload = { language, code, input };

    try {
      const { data } = await axiosClient.post("/run", payload);

      const intervalId = setInterval(async () => {
        const { data: statusData } = await axiosClient.get(
          `/status/${data.jobId}`
        );

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
          setJobStatus(statusData.job.status);
        }
      }, 500);
    } catch (error) {
      console.error(error.response);
      const errorMessage =
        error.response?.data?.error?.stderr ||
        error.response?.data?.error ||
        "Execution failed.";
      setOutput(`Error: ${errorMessage}`);
      setLoading(false);
    }
  };

  const handleAiReview = async () => {
    setLoading(true);
    setOutput("Analyzing code with AI...");

    try {
      const { data } = await axiosClient.post("/ai-review", { code });
      if (data.success) {
        setOutput(data.review);
      } else {
        setOutput(`Error: ${data.error}`);
      }
    } catch (error) {
      setOutput(`Error: ${error.response?.data?.error || "AI Review failed."}`);
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
    const map = {
      cpp: "cpp",
      c: "c",
      py: "python",
      java: "java",
      js: "javascript",
    };
    return map[lang] || "plaintext";
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="h-full w-full bg-slate-900 rounded-[7px] flex items-center justify-center overflow-hidden">
              <img
                src="./logo.svg"
                alt="Logo"
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </div>
          </div>
          <div>
            {/* <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              AlgoForge
            </h1> */}
            <h1 className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
              AlgoForge
            </h1>

            <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">
              Online IDE
            </p>
          </div>
        </div>

        <div className="relative group">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-200 text-sm rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer w-40"
          >
            <option value="cpp">C++ (GCC)</option>
            <option value="c">C (GCC)</option>
            <option value="py">Python 3</option>
            <option value="java">Java JDK</option>
            {/* <option value="js">Node.js</option> */}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col relative border-r border-slate-800">
          <div className="h-12 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Ready
              </span>
              <span>
                main.
                {monacoLanguageMap(language) === "python"
                  ? "py"
                  : monacoLanguageMap(language)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAiReview}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors disabled:opacity-50"
              >
                {loading ? "Thinking..." : "✨ AI Review"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Run Code
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-[#1e1e1e]">
            <Editor
              height="100%"
              language={monacoLanguageMap(language)}
              value={code}
              theme="vs-dark"
              onChange={(value) => setCode(value ?? "")}
              onMount={handleEditorMount}
              options={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                cursorBlinking: "smooth",
                smoothScrolling: true,
              }}
            />
          </div>
        </div>

        <div className="w-full lg:w-[500px] flex flex-col bg-slate-900 border-l border-slate-800">
          <div className="h-48 shrink-0 flex flex-col border-b border-slate-800">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950/50">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Input (Stdin)
              </span>
              <button
                onClick={() => setInput("")}
                className="text-xs text-slate-500 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 w-full p-4 bg-transparent text-slate-300 font-mono text-sm resize-none focus:outline-none focus:bg-slate-800/30 transition-colors"
              placeholder="Enter input here..."
              spellCheck="false"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950/50 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Output
              </span>
              {loading && (
                <span className="text-xs text-indigo-400 animate-pulse">
                  Running...
                </span>
              )}
            </div>
            <div className="flex-1 p-4 bg-[#0d1117] overflow-auto custom-scrollbar">
              <pre
                className={`font-mono text-sm whitespace-pre-wrap break-words ${
                  output.startsWith("Error") ? "text-red-400" : "text-green-400"
                }`}
              >
                {output || (
                  <span className="text-slate-600 italic">
                    Run code to see output...
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
