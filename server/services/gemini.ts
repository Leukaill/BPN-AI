import { GoogleGenAI } from "@google/genai";

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return response.text || "I couldn't generate a response.";
    } catch (error) {
      console.error("Gemini API error:", error);
      throw new Error(`Gemini API error: ${error}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Simple embedding simulation - in production, use a real embedding service
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const embedding = new Array(768).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length && j < embedding.length; j++) {
        embedding[j] += word.charCodeAt(j) / 1000;
      }
    }
    
    return embedding;
  }
}

export const geminiService = new GeminiService();