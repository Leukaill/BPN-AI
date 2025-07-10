import { storage } from "../storage";
import { geminiService } from "./gemini";
import { documentProcessor } from "./document-processor";
import { knowledgeBaseService } from "./knowledge-base";

// Custom error classes to match routes.ts
class AIServiceError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = "AIServiceError";
  }
}

interface AIResponse {
  content: string;
  sources?: string[];
}

interface KnowledgeEntry {
  id: number;
  title: string;
  content: string;
  relevanceScore?: number;
}

class AIService {
  constructor() {
    // Initialize any required services
  }

  private async searchRelevantKnowledge(
    prompt: string,
    userId: number,
  ): Promise<KnowledgeEntry[]> {
    try {
      // Get all user documents first
      const allDocs = await storage.getUserKnowledgeBase(userId);
      console.log(`[Knowledge Search] Found ${allDocs.length} total knowledge entries`);
      
      if (allDocs.length === 0) {
        return [];
      }

      // Log available documents
      allDocs.forEach(doc => {
        console.log(`[Knowledge Search] Available document: "${doc.title}" (${doc.content.length} chars)`);
      });

      // First, try specific knowledge base search with embedding similarity
      const specificMatches = await knowledgeBaseService.searchKnowledge(
        prompt,
        userId,
        10,
      );

      // Log scoring results
      specificMatches.forEach(doc => {
        console.log(`[Knowledge Search] Document "${doc.title}" scored ${(doc as any).relevanceScore || 'N/A'}`);
      });

      // Use a much lower threshold for relevance - be more inclusive
      const relevantMatches = specificMatches.filter(doc => {
        const score = (doc as any).relevanceScore || 0;
        return score > 0.01; // Very low threshold
      });

      console.log(`[Knowledge Search] Returning ${relevantMatches.length} scored results`);

      if (relevantMatches.length > 0) {
        console.log(`Found ${relevantMatches.length} specific knowledge matches`);
        return relevantMatches;
      }

      // If no specific matches, try broader search with keywords
      const keywords = this.extractKeywords(prompt);
      const broadMatches = await this.searchByKeywords(keywords, userId);

      if (broadMatches.length > 0) {
        console.log(`Found ${broadMatches.length} broad keyword matches`);
        return broadMatches;
      }

      // Last resort: return ALL documents for comprehensive analysis
      console.log(`No matches found, using ALL ${allDocs.length} documents for comprehensive analysis`);
      return allDocs;
    } catch (error) {
      console.error("Knowledge search error:", error);
      throw new AIServiceError("Failed to search knowledge base", error as Error);
    }
  }

  private extractKeywords(prompt: string): string[] {
    // Enhanced keyword extraction with better coverage
    const stopWords = [
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
      "is", "are", "was", "were", "what", "how", "when", "where", "why", "who", "can", "could",
      "would", "should", "will", "shall", "may", "might", "must", "do", "does", "did", "have",
      "has", "had", "be", "been", "being", "this", "that", "these", "those", "me", "you", "your",
      "tell", "about", "know", "inside", "document", "file"
    ];

    const keywords = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.includes(word));

    // Include important terms even if they're shorter
    const importantShortTerms = ["ai", "bpn", "pdf", "doc", "it"];
    const shortTerms = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => importantShortTerms.includes(word));

    return [...new Set([...keywords, ...shortTerms])].slice(0, 8); // More keywords for better matching
  }

  private async searchByKeywords(
    keywords: string[],
    userId: number,
  ): Promise<KnowledgeEntry[]> {
    const allKnowledge = await storage.getUserKnowledgeBase(userId);

    return allKnowledge
      .map((kb) => {
        const content = (kb.title + " " + kb.content).toLowerCase();
        const matches = keywords.filter((keyword) => content.includes(keyword));

        return {
          ...kb,
          relevanceScore: matches.length / keywords.length,
        };
      })
      .filter((kb) => kb.relevanceScore > 0)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 5);
  }

  private buildContextualPrompt(
    originalPrompt: string,
    relevantKnowledge: KnowledgeEntry[],
    specificDocument: any = null,
    documentContext: string = "",
    bpnKnowledge: any[] = [],
  ): string {
    let context = `You are Denyse, a conversational and helpful AI assistant for BPN organization.

CRITICAL INSTRUCTIONS:
- You have access to the user's uploaded documents and knowledge base
- When users ask about documents, surveys, reports, or any content, you MUST reference the specific information provided below
- Always cite the source document when referencing information
- Be specific and detailed in your responses, using actual data and quotes from the documents
- Never claim you don't have access to information that is clearly provided in the context below

Your personality:
- Be natural, warm, and engaging like ChatGPT
- Use conversational language while maintaining professionalism
- Ask follow-up questions when helpful
- Show enthusiasm for helping users
- Acknowledge when you don't know something (but first check the provided context)
- Be empathetic and understanding
- Use examples and analogies to explain complex topics
- Structure responses clearly with headings and bullet points when appropriate

`;

    // Add specific document context if available
    if (specificDocument && specificDocument.extractedText) {
      context += `SPECIFIC DOCUMENT REQUESTED:\n`;
      context += `Document: ${specificDocument.originalName}\n`;
      context += `Content: ${specificDocument.extractedText}\n`;
      context += `---\n\n`;
    }

    // Add vector search results
    if (
      documentContext &&
      documentContext !==
        "I don't have any relevant document content to answer your question. Please upload documents first."
    ) {
      context += `DOCUMENT PROCESSOR RESULTS:\n`;
      context += documentContext;
      context += `\n---\n\n`;
    }

    // Add relevant knowledge base entries with full content
    if (relevantKnowledge.length > 0) {
      context += `RELEVANT KNOWLEDGE BASE DOCUMENTS:\n`;
      relevantKnowledge.forEach((kb, index) => {
        context += `\nDOCUMENT ${index + 1}: ${kb.title}\n`;
        context += `Content: ${kb.content}\n`;
        if ((kb as any).score) {
          context += `Relevance Score: ${((kb as any).score * 100).toFixed(1)}%\n`;
        }
        context += `---\n`;
      });
      context += `\n`;
    }

    // Add BPN organizational knowledge
    if (bpnKnowledge.length > 0) {
      context += `BPN ORGANIZATION KNOWLEDGE:\n`;
      bpnKnowledge.forEach((kb) => {
        context += `Topic: ${kb.title}\n`;
        context += `Information: ${kb.content}\n`;
        context += `---\n`;
      });
      context += `\n`;
    }

    // Add the user's question and final instructions
    context += `USER QUESTION: ${originalPrompt}\n\n`;

    context += `RESPONSE INSTRUCTIONS:
1. ALWAYS check the knowledge base documents above before responding
2. If the user asks about ANY document, survey, analysis, or content mentioned in the knowledge base, provide detailed information from that specific content
3. Quote relevant sections and cite the source document title
4. If you find relevant information in the knowledge base, structure your response around that information
5. Use natural, conversational language as if you're discussing documents you've personally reviewed
6. If the question can be answered using the provided context, do NOT claim you don't have access to the information
7. When referencing data or findings, be specific and include actual numbers, percentages, or quotes when available
8. If multiple documents are relevant, synthesize information from all relevant sources

Remember: You have access to all the document content shown above. Use it to provide comprehensive, informed responses.`;

    return context;
  }

  async generateResponse(
    prompt: string,
    userId: number,
    chatId: number,
  ): Promise<string> {
    try {
      console.log(`Generating response for user ${userId}, chat ${chatId}`);
      console.log(`Original prompt: "${prompt}"`);

      // Extract document ID if referenced
      const documentIdMatch = prompt.match(/\[Document:.*?- ID: (\d+)\]/);
      let specificDocument = null;

      if (documentIdMatch) {
        const documentId = parseInt(documentIdMatch[1]);
        specificDocument = await storage.getDocument(documentId);
        console.log(
          `Specific document requested: ${specificDocument?.originalName}`,
        );
      }

      // Clean the prompt
      const cleanPrompt = prompt
        .replace(/\[Document:.*?- ID: \d+\]/g, "")
        .trim();

      // Get relevant knowledge using enhanced search
      const relevantKnowledge = await this.searchRelevantKnowledge(
        cleanPrompt,
        userId,
      );
      console.log(
        `Found ${relevantKnowledge.length} relevant knowledge entries`,
      );

      // Get vector search results
      const documentContext =
        await documentProcessor.generateContextualResponse(cleanPrompt, userId);
      console.log(
        `Document processor context length: ${documentContext?.length || 0}`,
      );

      // Get BPN knowledge
      const bpnKnowledge = await storage.getBpnKnowledge();
      console.log(`BPN knowledge entries: ${bpnKnowledge.length}`);

      // Build comprehensive context
      const contextualPrompt = this.buildContextualPrompt(
        cleanPrompt,
        relevantKnowledge,
        specificDocument,
        documentContext,
        bpnKnowledge.slice(0, 3), // Limit BPN knowledge to avoid context overflow
      );

      console.log(`Final context length: ${contextualPrompt.length}`);

      // Generate response
      const response = await geminiService.generateResponse(contextualPrompt);
      console.log(`Generated response length: ${response.length}`);

      return response;
    } catch (error) {
      console.error("AI service error:", error);
      return "I apologize, but I'm experiencing technical difficulties. Please try again later.";
    }
  }

  async generateReport(
    prompt: string,
    documentIds: number[],
    userId: number,
  ): Promise<string> {
    try {
      console.log(`Generating report for ${documentIds.length} documents`);

      const documents = await Promise.all(
        documentIds.map((id) => storage.getDocument(id)),
      );

      const validDocuments = documents.filter(
        (doc) =>
          doc && doc.userId === userId && (doc.text || doc.extractedText),
      );

      if (validDocuments.length === 0) {
        return "No valid documents found for report generation. Please ensure documents are uploaded and processed successfully.";
      }

      let reportContext = `You are Denyse, an AI assistant specialized in document analysis and report generation.

REPORT GENERATION INSTRUCTIONS:
- Analyze all provided documents thoroughly
- Create a comprehensive, well-structured report
- Include specific data, quotes, and findings from the documents
- Use clear headings and sections
- Provide actionable insights and recommendations
- Cite sources when referencing specific information

DOCUMENTS TO ANALYZE:
`;

      validDocuments.forEach((doc, index) => {
        const content = doc!.text || doc!.extractedText || "";
        reportContext += `\n[DOCUMENT ${index + 1}]\n`;
        reportContext += `Title: ${doc!.originalName}\n`;
        reportContext += `Content: ${content}\n`;
        reportContext += `---\n`;
      });

      reportContext += `\nREPORT REQUIREMENTS:\n${prompt}\n\n`;
      reportContext += `Please generate a detailed, professional report that addresses all requirements and provides insights based on the document analysis. Structure the report with clear sections and include specific references to the source documents.`;

      console.log(`Report context length: ${reportContext.length}`);

      const report = await geminiService.generateResponse(reportContext);
      console.log(`Generated report length: ${report.length}`);

      return report;
    } catch (error) {
      console.error("Report generation error:", error);
      return "Failed to generate report. Please try again later.";
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return await geminiService.generateEmbedding(text);
  }

  // Debug method to test knowledge base access
  async debugKnowledgeAccess(userId: number): Promise<any> {
    try {
      const allKnowledge = await storage.getUserKnowledgeBase(userId);
      const bpnKnowledge = await storage.getBpnKnowledge();

      return {
        userKnowledgeCount: allKnowledge.length,
        bpnKnowledgeCount: bpnKnowledge.length,
        sampleUserKnowledge: allKnowledge.slice(0, 2).map((kb) => ({
          title: kb.title,
          contentPreview: kb.content.slice(0, 100) + "...",
        })),
        sampleBpnKnowledge: bpnKnowledge.slice(0, 2).map((kb) => ({
          title: kb.title,
          contentPreview: kb.content.slice(0, 100) + "...",
        })),
      };
    } catch (error) {
      console.error("Debug knowledge access error:", error);
      return { error: error.message };
    }
  }
}

export const aiService = new AIService();
