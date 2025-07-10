import { storage } from "../storage";
import { geminiService } from "./gemini";
import { documentProcessor } from "./document-processor";
import { reportGenerator } from "./report-generator";
import { questionGenerator } from "./question-generator";

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
    this.initializeService();
  }

  private async initializeService() {
    console.log("M&E AI Service initialized");
  }

  private async searchRelevantKnowledge(
    prompt: string,
    userId: number,
    options: {
      maxResults?: number;
      minRelevanceScore?: number;
    } = {}
  ): Promise<KnowledgeEntry[]> {
    const { maxResults = 5, minRelevanceScore = 0.1 } = options;

    try {
      const allDocs = await storage.getUserKnowledgeBase(userId);
      
      console.log(`[Knowledge Search] Found ${allDocs.length} total knowledge entries`);

      if (allDocs.length === 0) {
        return [];
      }

      // Convert to KnowledgeEntry format
      const knowledgeEntries: KnowledgeEntry[] = allDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        relevanceScore: 0
      }));

      console.log(`[Knowledge Search] Available document: "${knowledgeEntries[0]?.title}" (${knowledgeEntries[0]?.content.length} chars)`);

      // Enhanced keyword matching
      const keywords = this.extractKeywords(prompt);
      console.log(`[Knowledge Search] Query: "${prompt}" for user ${userId}`);

      const scoredResults = knowledgeEntries.map(doc => {
        let score = 0;
        const docText = (doc.title + " " + doc.content).toLowerCase();
        const promptLower = prompt.toLowerCase();

        // Direct text matching
        if (docText.includes(promptLower)) {
          score += 1.0;
        }

        // Keyword matching
        keywords.forEach(keyword => {
          if (docText.includes(keyword)) {
            score += 0.3;
          }
        });

        // Title matching bonus
        if (doc.title.toLowerCase().includes(promptLower)) {
          score += 0.5;
        }

        console.log(`[Knowledge Search] Document "${doc.title}" scored ${score.toFixed(2)}`);

        return {
          ...doc,
          relevanceScore: score
        };
      });

      // Filter and sort by relevance
      const filteredResults = scoredResults
        .filter(doc => doc.relevanceScore >= minRelevanceScore)
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, maxResults);

      console.log(`[Knowledge Search] Returning ${filteredResults.length} scored results`);

      // If no matches found, return all documents for comprehensive analysis
      if (filteredResults.length === 0) {
        console.log("No matches found, using ALL documents for comprehensive analysis");
        return knowledgeEntries.slice(0, maxResults);
      }

      return filteredResults;
    } catch (error) {
      console.error("Error in knowledge search:", error);
      return [];
    }
  }

  private extractKeywords(prompt: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
      "is", "are", "was", "were", "what", "how", "when", "where", "why", "who", "can", "could",
      "would", "should", "will", "shall", "may", "might", "must", "do", "does", "did", "have",
      "has", "had", "be", "been", "being", "this", "that", "these", "those", "me", "you", "your",
      "tell", "about", "know", "inside", "document", "file", "please", "help", "need", "want"
    ]);

    return prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  private async searchByKeywords(
    keywords: string[],
    allDocs: KnowledgeEntry[]
  ): Promise<KnowledgeEntry[]> {
    const results: KnowledgeEntry[] = [];

    for (const doc of allDocs) {
      let score = 0;
      const docText = (doc.title + " " + doc.content).toLowerCase();

      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (docText.includes(keywordLower)) {
          score += 1;
        }
      });

      if (score > 0) {
        results.push({
          ...doc,
          relevanceScore: score / keywords.length
        });
      }
    }

    return results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  private buildContextualPrompt(
    originalPrompt: string,
    relevantKnowledge: KnowledgeEntry[],
    documentContext: string
  ): string {
    let context = `You are Denyse, an expert Monitoring & Evaluation (M&E) specialist with deep expertise in:

M&E EXPERTISE:
- OECD-DAC evaluation criteria (Relevance, Effectiveness, Efficiency, Impact, Sustainability, Coherence)
- Theory of Change development and validation
- Indicator design and performance measurement
- Results framework development
- Baseline establishment and outcome evaluation
- Impact assessment and attribution analysis
- Stakeholder engagement and participatory evaluation
- Data quality assurance and validation
- M&E system design and capacity building
- Learning and adaptive management

COMMUNICATION STYLE:
- Be intelligent, analytical, and strategic in your thinking
- Focus on providing valuable insights and actionable recommendations
- Be concise and to the point - avoid unnecessary verbosity
- When users ask for reports, generate actual analytical reports with findings and recommendations
- Use professional language while remaining approachable
- Ask clarifying questions only when truly necessary
- Demonstrate deep understanding of M&E processes and best practices
- Structure responses with clear headings and organized information

FORMATTING REQUIREMENTS:
- NEVER use asterisks (*) for emphasis or formatting
- Use clean, professional text without markdown asterisks
- Structure responses with clear headings using plain text
- Use numbered lists (1., 2., 3.) or bullet points (-) for organization
- Maintain consistent paragraph structure with proper spacing
- Focus on actionable insights and practical recommendations
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
- Use clean, professional text without markdown asterisks
- Structure responses with clear headings using plain text
- Use numbered lists (1., 2., 3.) or bullet points (-) for organization
- Maintain consistent paragraph structure with proper spacing
- Focus on actionable insights and practical recommendations

`;

    // Add relevant knowledge base content
    if (relevantKnowledge.length > 0) {
      context += `RELEVANT KNOWLEDGE BASE DOCUMENTS:\n\n`;
      relevantKnowledge.forEach((kb, index) => {
        context += `Document ${index + 1}: ${kb.title}\n`;
        context += `Content: ${kb.content}\n`;
        context += `Relevance Score: ${((kb.relevanceScore || 0) * 100).toFixed(1)}%\n\n`;
      });
    }

    // Add document processor context
    if (documentContext && documentContext.length > 0) {
      context += `DOCUMENT PROCESSOR CONTEXT:\n${documentContext}\n\n`;
    }

    // Add BPN knowledge if available
    context += `BPN KNOWLEDGE BASE:\n`;
    context += `Please check available BPN knowledge for relevant information.\n\n`;

    // Add the user's question and final instructions
    context += `USER QUESTION: ${originalPrompt}\n\n`;

    context += `RESPONSE INSTRUCTIONS:
1. ALWAYS check the knowledge base documents above before responding
2. When users ask for "reports" or "analysis," follow this intelligent workflow:
   a) First, ask clarifying questions to understand their specific needs (unless they indicate they want to skip questions)
   b) Generate customized M&E reports based on their responses
   c) Focus on the specific M&E report type they need (baseline, progress, outcome, impact, evaluation, framework assessment)
3. Be an expert M&E specialist who:
   - Uses professional M&E terminology and frameworks
   - Applies OECD-DAC evaluation criteria
   - Focuses on outcomes, indicators, and impact assessment
   - Provides evidence-based recommendations
   - Considers stakeholder needs and context
4. When asking questions, be strategic and focused - ask only the most important questions that will significantly improve the report quality
5. If users want to skip questions, generate a comprehensive standard M&E report immediately
6. Use professional M&E report formatting with clear sections and bullet points
7. When users request downloads, automatically offer to generate downloadable M&E reports
8. Always focus on learning, accountability, and decision-making support

Remember: You are an expert M&E specialist who creates professional monitoring and evaluation reports that drive program improvement and accountability.`;

    return context;
  }

  private cleanResponseFormatting(response: string): string {
    return response
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\*+/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async handleDownloadRequest(
    response: string,
    userId: number,
    originalPrompt: string
  ): Promise<string> {
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
    const isQuestionResponse = /\b(answer|response|1\.|2\.|3\.|a\.|b\.|c\.|skip questions)\b/i.test(originalPrompt);

    if (!isDownloadRequest && !isReportRequest) {
      return response;
    }

    try {
      // If it's a report request, first ask clarifying questions (unless user is responding to questions)
      if (isReportRequest && !isDownloadRequest && !isQuestionResponse) {
        // Try to find relevant knowledge base documents for enhanced questioning
        const relevantKnowledge = await this.searchRelevantKnowledge(originalPrompt, userId);
        
        if (relevantKnowledge.length > 0) {
          const document = relevantKnowledge[0];
          
          // Check if user wants to skip questions (detect phrases like "just generate", "skip questions", "no questions")
          const skipQuestions = /\b(just generate|skip questions|no questions|direct report|immediately|straight away)\b/i.test(originalPrompt);
          
          if (skipQuestions) {
            // Generate report directly without questions
            const analyticalReport = await reportGenerator.generateAnalyticalReport({
              type: 'me_evaluation',
              documentContent: document.content,
              documentTitle: document.title,
              userId: userId,
              customPrompt: originalPrompt
            });
            
            return analyticalReport.content;
          } else {
            // Generate intelligent questions first
            const questionSet = await questionGenerator.generateContextualQuestions(
              originalPrompt,
              document.content,
              document.title
            );
            
            const questionResponse = `I can definitely help you create a professional M&E report! 

${questionGenerator.formatQuestionsForUser(questionSet)}`;
            
            return questionResponse;
          }
        }
      }

      // If user is responding to questions, process answers and generate report
      if (isReportRequest && isQuestionResponse) {
        const relevantKnowledge = await this.searchRelevantKnowledge("document analysis report", userId);
        
        if (relevantKnowledge.length > 0) {
          const document = relevantKnowledge[0];
          const analyticalReport = await reportGenerator.generateAnalyticalReport({
            type: 'me_evaluation',
            documentContent: document.content,
            documentTitle: document.title,
            userId: userId,
            customPrompt: `Based on user responses: ${originalPrompt}. Generate a customized M&E report.`
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

      // Determine format
      let format = 'txt';
      if (promptLower.includes('html')) {
        format = 'html';
      } else if (promptLower.includes('json')) {
        format = 'json';
      } else if (promptLower.includes('markdown') || promptLower.includes('md')) {
        format = 'md';
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

DOWNLOAD AVAILABLE:
File: ${downloadData.filename}
Format: ${downloadData.format.toUpperCase()}
Size: ${Math.round(downloadData.size / 1024)} KB
Download: ${downloadData.downloadUrl}
Expires: ${new Date(downloadData.expiresAt).toLocaleString()}

Your file has been generated and is ready for download. The download link will expire in 1 hour for security.`;
        
        return enhancedResponse;
      }

      return response;
    } catch (error) {
      console.error('Error handling download request:', error);
      return response;
    }
  }

  async generateResponse(
    prompt: string,
    userId: number,
    options: {
      maxResults?: number;
      includeDocumentContext?: boolean;
    } = {}
  ): Promise<string> {
    const { maxResults = 5, includeDocumentContext = true } = options;

    try {
      console.log(`Generating response for user ${userId}, chat ${prompt.slice(0, 50)}...`);
      console.log(`Original prompt: "${prompt}"`);

      // Search for relevant knowledge
      const relevantKnowledge = await this.searchRelevantKnowledge(prompt, userId, { maxResults });
      console.log(`Found ${relevantKnowledge.length} relevant knowledge entries`);

      // Get document processor context if enabled
      let documentContext = "";
      if (includeDocumentContext) {
        try {
          documentContext = await documentProcessor.generateContextualResponse(prompt, userId);
          console.log(`Document processor context length: ${documentContext.length}`);
        } catch (error) {
          console.error('Error getting document context:', error);
        }
      }

      // Get BPN knowledge
      const bpnKnowledge = await storage.getBpnKnowledge();
      console.log(`BPN knowledge entries: ${bpnKnowledge.length}`);

      // Build contextual prompt
      const contextualPrompt = this.buildContextualPrompt(prompt, relevantKnowledge, documentContext);
      console.log(`Final context length: ${contextualPrompt.length}`);

      // Generate response
      const rawResponse = await geminiService.generateResponse(contextualPrompt);
      console.log(`Generated response length: ${rawResponse.length}`);

      // Clean response formatting
      const cleanResponse = this.cleanResponseFormatting(rawResponse);

      // Handle download requests or report generation
      const finalResponse = await this.handleDownloadRequest(cleanResponse, userId, prompt);

      return finalResponse;

    } catch (error) {
      console.error("AI service error:", error);
      throw new AIServiceError("Failed to generate response", error as Error);
    }
  }

  async generateReport(
    documentId: number,
    userId: number,
    reportType: string = 'evaluation',
    customPrompt?: string
  ): Promise<any> {
    try {
      const document = await storage.getDocument(documentId);
      
      if (!document || document.userId !== userId) {
        throw new Error('Document not found or access denied');
      }

      const content = document.text || document.extractedText || '';
      
      return await reportGenerator.generateAnalyticalReport({
        type: reportType as any,
        documentContent: content,
        documentTitle: document.originalName,
        userId: userId,
        customPrompt: customPrompt
      });
    } catch (error) {
      console.error("Error generating report:", error);
      throw new AIServiceError("Failed to generate report", error as Error);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await geminiService.generateEmbedding(text);
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new AIServiceError("Failed to generate embedding", error as Error);
    }
  }

  async debugKnowledgeAccess(userId: number): Promise<any> {
    try {
      const userKnowledge = await storage.getUserKnowledgeBase(userId);
      const bpnKnowledge = await storage.getBpnKnowledge();
      
      return {
        userKnowledgeCount: userKnowledge.length,
        bpnKnowledgeCount: bpnKnowledge.length,
        userKnowledgeTitles: userKnowledge.map(k => k.title),
        bpnKnowledgeTitles: bpnKnowledge.map(k => k.title)
      };
    } catch (error) {
      console.error("Error debugging knowledge access:", error);
      return { error: error.message };
    }
  }
}

export const aiService = new AIService();