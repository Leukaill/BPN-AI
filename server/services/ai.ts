import { storage } from "../storage";
import { geminiService } from "./gemini";
import { documentProcessor } from "./document-processor";
import { reportGenerator } from "./report-generator";
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
- Be intelligent, analytical, and strategic in your thinking
- Focus on providing valuable insights and actionable recommendations
- Be concise and to the point - avoid unnecessary verbosity
- When users ask for reports, generate actual analytical reports with findings and recommendations
- Use professional language while remaining approachable
- Ask clarifying questions only when truly necessary
- Demonstrate deep understanding of business processes and best practices
- Structure responses with clear headings and organized information

FORMATTING REQUIREMENTS:
- NEVER use asterisks (*) for emphasis or formatting
- Use clean, readable text without markdown asterisks
- For emphasis, use CAPITAL LETTERS or rephrase for natural emphasis
- Use proper paragraph structure with double line breaks between paragraphs
- When listing items, use numbers (1., 2., 3.) or simple dashes (-)
- Keep text formatting simple and clean
- Avoid any markdown-style formatting like *text*, **text**, or ***text***
- Write in a natural, flowing style that's easy to read
- Separate different topics or sections with blank lines
- Use proper paragraph breaks to improve readability
- Each paragraph should contain 2-4 sentences maximum
- Group related information together in logical paragraphs

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
2. When users ask for "reports" or "analysis," generate actual analytical reports with:
   - Executive Summary
   - Key Findings 
   - Recommendations
   - Implementation Steps
   - Success Metrics
3. Be concise and strategic - avoid lengthy explanations unless specifically requested
4. Focus on actionable insights and practical recommendations
5. If asked to "generate a report" based on a document, create an analytical assessment of that document's effectiveness, gaps, and improvement opportunities
6. Use professional report formatting with clear sections and bullet points
7. When users request downloads, automatically offer to generate downloadable reports
8. Synthesize information from multiple sources to provide comprehensive analysis

Remember: You are an intelligent business analyst who provides strategic insights and actionable recommendations.`;

    return context;
  }

  private cleanResponseFormatting(response: string): string {
    // Remove asterisks used for emphasis and clean up formatting
    return response
      // Remove bold asterisks (**text** or ***text***)
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // Remove italic asterisks (*text*)
      .replace(/\*([^*]+)\*/g, '$1')
      // Remove any remaining standalone asterisks
      .replace(/\*+/g, '')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      // Clean up multiple line breaks
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async handleDownloadRequest(
    response: string,
    userId: number,
    originalPrompt: string,
  ): Promise<string> {
    // Check if user is requesting a download
    const downloadKeywords = [
      'download', 'save', 'export', 'file', 'document', 'generate file',
      'create file', 'download this', 'save this', 'export this',
      'give me a file', 'can i download', 'make it downloadable'
    ];
    
    const promptLower = originalPrompt.toLowerCase();
    const isDownloadRequest = downloadKeywords.some(keyword => 
      promptLower.includes(keyword)
    );

    const isReportRequest = /\b(report|analysis|assessment|generate.*report|create.*report)\b/i.test(originalPrompt);

    if (!isDownloadRequest && !isReportRequest) {
      return response;
    }

    try {
      // If it's a report request, generate an analytical report
      if (isReportRequest && !isDownloadRequest) {
        // Try to find relevant knowledge base documents for enhanced report
        const relevantKnowledge = await this.searchRelevantKnowledge(originalPrompt, userId);
        
        if (relevantKnowledge.length > 0) {
          const document = relevantKnowledge[0];
          const analyticalReport = await reportGenerator.generateAnalyticalReport({
            type: 'analysis',
            documentContent: document.content,
            documentTitle: document.title,
            userId: userId,
            customPrompt: originalPrompt
          });
          
          return analyticalReport.content;
        }
      }

      // Extract filename from prompt or use default
      let filename = 'denyse_response';
      const filenameMatch = promptLower.match(/(?:save|download|export|file|document)(?:\s+(?:as|to|named?))?\s+["']?([a-zA-Z0-9\-_\s]+)["']?/);
      if (filenameMatch) {
        filename = filenameMatch[1].trim().replace(/\s+/g, '_');
      } else {
        // Try to extract a meaningful filename from the context
        const contextMatch = promptLower.match(/(?:report|analysis|summary|document|file)(?:\s+(?:on|about|for))?\s+([a-zA-Z0-9\-_\s]+)/);
        if (contextMatch) {
          filename = contextMatch[1].trim().replace(/\s+/g, '_');
        }
      }

      // Determine format based on content or user request
      let format = 'txt';
      if (promptLower.includes('html') || promptLower.includes('webpage')) {
        format = 'html';
      } else if (promptLower.includes('markdown') || promptLower.includes('md')) {
        format = 'md';
      } else if (promptLower.includes('json')) {
        format = 'json';
      } else if (promptLower.includes('csv')) {
        format = 'csv';
      }

      // Generate download using internal storage (bypass API authentication issues)
      const { randomUUID } = await import('crypto');
      const fs = await import('fs/promises');
      const path = await import('path');

      const uniqueId = randomUUID();
      const safeFilename = filename.replace(/[^a-zA-Z0-9\-_]/g, '_');
      const fullFilename = `${safeFilename}_${uniqueId}.${format}`;
      
      // Create downloads directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads');
      const downloadsDir = path.join(uploadDir, 'downloads');
      try {
        await fs.access(downloadsDir);
      } catch {
        await fs.mkdir(downloadsDir, { recursive: true });
      }

      const downloadPath = path.join(downloadsDir, fullFilename);

      // Process content based on format
      let processedContent = response;
      
      if (format === 'html') {
        processedContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeFilename}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        h1, h2, h3 { color: #00728e; }
        .header { border-bottom: 2px solid #00728e; padding-bottom: 10px; margin-bottom: 30px; }
        .content { max-width: 800px; }
        .timestamp { color: #666; font-size: 0.9em; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${safeFilename}</h1>
        <p class="timestamp">Generated by Denyse AI Assistant - ${new Date().toLocaleString()}</p>
    </div>
    <div class="content">
        ${response.replace(/\n/g, '<br>')}
    </div>
</body>
</html>`;
      } else if (format === 'md') {
        processedContent = `# ${safeFilename}

*Generated by Denyse AI Assistant - ${new Date().toLocaleString()}*

---

${response}`;
      } else if (format === 'json') {
        processedContent = JSON.stringify({
          title: safeFilename,
          content: response,
          generatedBy: "Denyse AI Assistant",
          timestamp: new Date().toISOString(),
          format: "json"
        }, null, 2);
      }

      // Write file
      await fs.writeFile(downloadPath, processedContent, 'utf8');

      // Schedule file cleanup after 1 hour
      setTimeout(async () => {
        try {
          await fs.unlink(downloadPath);
        } catch (error) {
          console.error('Error cleaning up download file:', error);
        }
      }, 60 * 60 * 1000); // 1 hour

      const downloadData = {
        downloadId: uniqueId,
        filename: fullFilename,
        format: format,
        size: processedContent.length,
        downloadUrl: `/api/downloads/${uniqueId}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      };

      if (downloadData) {
        
        // Enhance the response with download link
        const enhancedResponse = `${response}

---

📁 DOWNLOAD AVAILABLE

I've generated a downloadable file for you:

• File: ${downloadData.filename}
• Format: ${downloadData.format.toUpperCase()}
• Size: ${Math.round(downloadData.size / 1024)} KB
• Expires: ${new Date(downloadData.expiresAt).toLocaleString()}

🔗 Download Link: ${downloadData.downloadUrl}

Click the link above to download your file. The download will expire in 1 hour for security purposes.`;

        return enhancedResponse;
      }
    } catch (error) {
      console.error('Error generating download:', error);
      // Return original response if download generation fails
      return response + '\n\n(Note: Download generation temporarily unavailable)';
    }

    return response;
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
      const rawResponse = await geminiService.generateResponse(contextualPrompt);
      console.log(`Generated response length: ${rawResponse.length}`);

      // Clean up formatting to remove asterisks and improve readability
      const cleanResponse = this.cleanResponseFormatting(rawResponse);
      
      // Check if user requested a download and handle it
      const finalResponse = await this.handleDownloadRequest(cleanResponse, userId, cleanPrompt);
      
      return finalResponse;
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

FORMATTING REQUIREMENTS:
- NEVER use asterisks (*) for emphasis or formatting
- Use clean, readable text without markdown asterisks
- For emphasis, use CAPITAL LETTERS or rephrase for natural emphasis
- Use proper paragraph structure with double line breaks between paragraphs
- When listing items, use numbers (1., 2., 3.) or simple dashes (-)
- Keep text formatting simple and clean
- Avoid any markdown-style formatting like *text*, **text**, or ***text***
- Write in a natural, flowing style that's easy to read
- Separate different topics or sections with blank lines
- Use proper paragraph breaks to improve readability
- Each paragraph should contain 2-4 sentences maximum
- Group related information together in logical paragraphs

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

      const rawReport = await geminiService.generateResponse(reportContext);
      console.log(`Generated report length: ${rawReport.length}`);

      // Clean up formatting to remove asterisks and improve readability
      const cleanReport = this.cleanResponseFormatting(rawReport);
      
      return cleanReport;
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
