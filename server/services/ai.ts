import { storage } from "../storage";
import { geminiService } from "./gemini";

interface AIResponse {
  content: string;
  sources?: string[];
}

class AIService {
  constructor() {
    // Initialize any required services
  }

  async generateResponse(prompt: string, userId: number, chatId: number): Promise<string> {
    try {
      // Get user's documents for context
      const userDocuments = await storage.getUserDocuments(userId);
      const relevantDocs = userDocuments.filter(doc => doc.extractedText);
      
      // Get BPN knowledge for context
      const bpnKnowledge = await storage.getBpnKnowledge();
      
      // Prepare context
      let context = "You are BPN AI Assistant, a helpful AI assistant for BPN organization. You are professional, knowledgeable, and provide accurate information.\n\n";
      
      if (relevantDocs.length > 0) {
        context += "Available documents:\n";
        relevantDocs.forEach(doc => {
          context += `- ${doc.originalName}: ${doc.extractedText?.slice(0, 500)}...\n`;
        });
        context += "\n";
      }
      
      if (bpnKnowledge.length > 0) {
        context += "BPN Knowledge Base:\n";
        bpnKnowledge.slice(0, 3).forEach(kb => {
          context += `- ${kb.title}: ${kb.content.slice(0, 300)}...\n`;
        });
        context += "\n";
      }
      
      context += `User question: ${prompt}\n\n`;
      context += "Please provide a helpful response based on the available information. If you reference any documents or knowledge base articles, mention them in your response.";

      return await geminiService.generateResponse(context);
    } catch (error) {
      console.error("AI service error:", error);
      return "I apologize, but I'm experiencing technical difficulties. Please try again later.";
    }
  }



  async generateReport(prompt: string, documentIds: number[], userId: number): Promise<string> {
    try {
      const documents = await Promise.all(
        documentIds.map(id => storage.getDocument(id))
      );

      const validDocuments = documents.filter(doc => 
        doc && doc.userId === userId && doc.extractedText
      );

      if (validDocuments.length === 0) {
        return "No valid documents found for report generation.";
      }

      let reportContext = "Generate a comprehensive report based on the following documents:\n\n";
      
      validDocuments.forEach(doc => {
        reportContext += `Document: ${doc!.originalName}\n`;
        reportContext += `Content: ${doc!.extractedText}\n\n`;
      });

      reportContext += `Report Requirements: ${prompt}\n\n`;
      reportContext += "Please create a detailed, well-structured report that addresses the requirements and draws insights from the provided documents.";

      return await geminiService.generateResponse(reportContext);
    } catch (error) {
      console.error("Report generation error:", error);
      return "Failed to generate report. Please try again later.";
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return await geminiService.generateEmbedding(text);
  }
}

export const aiService = new AIService();
