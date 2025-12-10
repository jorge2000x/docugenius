import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!genAI) {
    if (!process.env.API_KEY) {
        console.warn("API_KEY is missing from environment");
        return null;
    }
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return genAI;
};

export const generateTextImprovement = async (
  currentText: string,
  instruction: string
): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "Error: API Key not configured.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Context: "${currentText}". Instruction: ${instruction}. Return only the improved/generated text without extra commentary.`,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating content. Please check your API limits or key.";
  }
};