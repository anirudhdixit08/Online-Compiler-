import { GoogleGenAI }  from "@google/genai";

const dotenv = require("dotenv");
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API });

const generateAiResponse = async (code) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents:
      "Analyze the following code and provide a list of potential improvements,issues and errors for the code.Dont Write unnecessary stuff and dont recommend about adding comments  and give response in points." +
      code,
  });
  return response.text;
};

module.exports = generateAiResponse;
