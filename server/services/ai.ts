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
      const relevantDocs = userDocuments.filter(doc => doc.text && doc.text.length > 0);
      
      // Get BPN knowledge for context
      const bpnKnowledge = await storage.getBpnKnowledge();
      
      // Prepare context
      let context = "You are BPN AI Assistant, a helpful AI assistant for BPN organization. You are professional, knowledgeable, and provide accurate information.\n\n";
      
      // Check if the prompt references a specific document
      const documentIdMatch = prompt.match(/\[Document:.*?- ID: (\d+)\]/);
      let specificDocument = null;
      
      if (documentIdMatch) {
        const documentId = parseInt(documentIdMatch[1]);
        specificDocument = await storage.getDocument(documentId);
      }
      
      // If there's a specific document referenced, prioritize it
      if (specificDocument && specificDocument.text) {
        context += `SPECIFIC DOCUMENT TO ANALYZE:\n`;
        context += `Document: ${specificDocument.originalName}\n`;
        context += `Content: ${specificDocument.text}\n`;
        context += `---\n\n`;
      }
      
      if (relevantDocs.length > 0) {
        context += "Available documents for additional context:\n";
        relevantDocs.forEach(doc => {
          if (!specificDocument || doc.id !== specificDocument.id) {
            context += `Document: ${doc.originalName}\n`;
            context += `Content: ${doc.text?.slice(0, 1000)}${doc.text && doc.text.length > 1000 ? "..." : ""}\n`;
            context += `---\n`;
          }
        });
        context += "\n";
      }
      
      if (bpnKnowledge.length > 0) {
        context += "BPN Organization Knowledge:\n";
        bpnKnowledge.slice(0, 3).forEach(kb => {
          context += `- ${kb.title}: ${kb.content.slice(0, 300)}...\n`;
        });
        context += "\n";
      }
      
      // Clean the prompt from document references
      const cleanPrompt = prompt.replace(/\[Document:.*?- ID: \d+\]/g, '').trim();
      
      context += `User question: ${cleanPrompt}\n\n`;
      context += "Please provide a comprehensive response based on the available information. If you analyze documents, provide specific insights from their content. If you reference any documents or knowledge base articles, mention them clearly in your response.";

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
        doc && doc.userId === userId && doc.text
      );

      if (validDocuments.length === 0) {
        return "No valid documents found for report generation.";
      }

      let reportContext = "Generate a comprehensive report based on the following documents:\n\n";
      
      validDocuments.forEach(doc => {
        reportContext += `Document: ${doc!.originalName}\n`;
        reportContext += `Content: ${doc!.text}\n\n`;
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
