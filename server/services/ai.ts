import { storage } from "../storage";
import { geminiService } from "./gemini";
import { documentProcessor } from "./document-processor";
import { knowledgeBaseService } from "./knowledge-base";

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
      // Prepare context with ChatGPT-like personality
      let context = `You are Denyse, a conversational and helpful AI assistant for BPN organization. 

Your personality:
- Be natural, warm, and engaging like ChatGPT
- Use conversational language while maintaining professionalism
- Ask follow-up questions when helpful
- Show enthusiasm for helping users
- Acknowledge when you don't know something
- Be empathetic and understanding
- Use examples and analogies to explain complex topics
- Structure responses clearly with headings and bullet points when appropriate

Always aim to be helpful, accurate, and engaging in your responses.\n\n`;
      
      // Check if the prompt references a specific document
      const documentIdMatch = prompt.match(/\[Document:.*?- ID: (\d+)\]/);
      let specificDocument = null;
      
      if (documentIdMatch) {
        const documentId = parseInt(documentIdMatch[1]);
        specificDocument = await storage.getDocument(documentId);
      }
      
      // Clean the prompt from document references
      const cleanPrompt = prompt.replace(/\[Document:.*?- ID: \d+\]/g, '').trim();
      
      // Step 1: Use vector search to find most relevant document chunks
      const relevantContext = await documentProcessor.generateContextualResponse(cleanPrompt, userId);
      
      if (relevantContext && relevantContext !== "I don't have any relevant document content to answer your question. Please upload documents first.") {
        context += "RELEVANT DOCUMENT CONTENT:\n";
        context += relevantContext;
        context += "\n\n";
      }
      
      // Step 2: If there's a specific document referenced, get its full content too
      if (specificDocument && specificDocument.extractedText) {
        context += `SPECIFIC DOCUMENT ANALYSIS:\n`;
        context += `Document: ${specificDocument.originalName}\n`;
        context += `Content: ${specificDocument.extractedText}\n`;
        context += `---\n\n`;
      } else if (specificDocument && !specificDocument.extractedText) {
        context += `DOCUMENT STATUS:\n`;
        context += `Document: ${specificDocument.originalName}\n`;
        context += `Status: Document is still being processed or text extraction failed.\n`;
        context += `---\n\n`;
      }
      
      // Step 3: Add user knowledge base for additional context
      const userKnowledge = await knowledgeBaseService.searchKnowledge(cleanPrompt, userId, 3);
      if (userKnowledge.length > 0) {
        context += "USER KNOWLEDGE BASE:\n";
        userKnowledge.forEach(kb => {
          context += `- ${kb.title}: ${kb.content.slice(0, 300)}...\n`;
        });
        context += "\n";
      }
      
      // Step 4: Add BPN knowledge for additional context
      const bpnKnowledge = await storage.getBpnKnowledge();
      if (bpnKnowledge.length > 0) {
        context += "BPN Organization Knowledge:\n";
        bpnKnowledge.slice(0, 2).forEach(kb => {
          context += `- ${kb.title}: ${kb.content.slice(0, 200)}...\n`;
        });
        context += "\n";
      }
      
      // Step 5: Add the user question and instructions
      context += `User Question: ${cleanPrompt}\n\n`;
      context += `Instructions: 
- Provide a comprehensive, detailed response based on the document content and knowledge base above
- When referencing specific information, cite the source document and chunk number
- If analyzing documents, provide specific insights, recommendations, and actionable feedback
- Be conversational and engaging, like you're having a natural conversation with a colleague
- Use "I" statements and personal touches to make responses feel more human
- Ask clarifying questions when appropriate to better help the user`;

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
