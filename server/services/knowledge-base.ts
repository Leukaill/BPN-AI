import { storage } from "../storage";
import { KnowledgeBase, InsertKnowledgeBase } from "@shared/schema";
import fs from "fs";
import path from "path";
import { localLLMService } from "./local-llm";

// Custom error classes to match routes.ts
class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "ValidationError";
  }
}

class ProcessingError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = "ProcessingError";
  }
}

// Document processing libraries - loaded dynamically
let pdfParse: any;
let mammoth: any;
let textract: any;

// Try to load libraries at module level as fallback
try {
  pdfParse = require("pdf-parse");
} catch (e) {
  console.log("pdf-parse not available at module level");
}

try {
  mammoth = require("mammoth");
} catch (e) {
  console.log("mammoth not available at module level");
}

interface ProcessedKnowledge {
  title: string;
  content: string;
  chunks: string[];
  embedding?: number[];
}

interface ExtractionResult {
  text: string;
  success: boolean;
  method: string;
  error?: string;
}

class KnowledgeBaseService {
  private initialized = false;
  private readonly supportedMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/html",
    "text/markdown",
    "text/csv",
    "application/rtf",
    "application/json",
  ]);

  async initialize() {
    if (!this.initialized) {
      try {
        // Load libraries when first needed with better error handling
        const loadPromises = [
          this.loadLibrary("pdf-parse", "pdfParse"),
          this.loadLibrary("mammoth", "mammoth"),
          this.loadLibrary("textract", "textract"), // For additional format support
        ];

        await Promise.allSettled(loadPromises);

        console.log("Document processing libraries initialization complete");
      } catch (error) {
        console.warn("Error during library initialization:", error.message);
      }
      this.initialized = true;
    }
  }

  private async loadLibrary(
    moduleName: string,
    globalVar: string,
  ): Promise<void> {
    try {
      const module = await import(moduleName);
      switch (globalVar) {
        case "pdfParse":
          // Handle both CommonJS and ES6 module formats
          pdfParse = module.default || module;
          break;
        case "mammoth":
          mammoth = module.default || module;
          break;
        case "textract":
          textract = module.default || module;
          break;
      }
      console.log(`✓ ${moduleName} loaded successfully`);
    } catch (error) {
      console.warn(`⚠ Could not load ${moduleName}:`, error.message);
      // For pdf-parse, try alternative approach
      if (moduleName === "pdf-parse") {
        try {
          const altModule = require("pdf-parse");
          pdfParse = altModule;
          console.log(`✓ ${moduleName} loaded via require`);
        } catch (requireError) {
          console.warn(`⚠ Could not load ${moduleName} via require:`, requireError.message);
        }
      }
    }
  }

  async processAndStoreKnowledge(
    file: Express.Multer.File,
    userId: number,
    customTitle?: string,
  ): Promise<KnowledgeBase> {
    await this.initialize();

    console.log(
      `Processing knowledge file: ${file.originalname} (${file.mimetype})`,
    );

    try {
      // Validate file before processing
      this.validateFile(file);

      // Extract text from file with multiple fallback methods
      const extractionResult =
        await this.extractTextFromFileWithFallbacks(file);

      if (
        !extractionResult.success ||
        !extractionResult.text ||
        extractionResult.text.trim().length === 0
      ) {
        throw new Error(
          `No text content could be extracted from the file. ${extractionResult.error || ""}`,
        );
      }

      console.log(`✓ Text extracted using method: ${extractionResult.method}`);
      console.log(`✓ Extracted ${extractionResult.text.length} characters`);

      // Sanitize text to remove null bytes and invalid UTF-8 sequences
      const sanitizedText = this.sanitizeText(extractionResult.text);
      console.log(`✓ Sanitized text: ${sanitizedText.length} characters`);

      // Create knowledge base entry
      const title =
        customTitle ||
        this.generateTitle(file.originalname, extractionResult.text);
      const knowledgeData: InsertKnowledgeBase = {
        userId,
        title,
        content: sanitizedText,
        source: "file_upload",
        filename: file.originalname,
        mimeType: file.mimetype,
      };

      const knowledgeBase = await storage.createKnowledgeBase(knowledgeData);

      // Generate embedding for semantic search in background
      this.generateEmbeddingAsync(
        knowledgeBase.id,
        sanitizedText,
      ).catch((error) => {
        console.warn(
          `Failed to generate embedding for ${knowledgeBase.id}:`,
          error.message,
        );
      });

      console.log(`✓ Knowledge base entry created: ${title}`);
      return knowledgeBase;
    } catch (error) {
      console.error("Error processing knowledge file:", error);
      throw error;
    } finally {
      // Clean up temp file if it exists
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.warn("Could not clean up temp file:", cleanupError.message);
        }
      }
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new ValidationError("No file provided");
    }

    if (!file.path || !fs.existsSync(file.path)) {
      throw new ValidationError("File path does not exist");
    }

    const stats = fs.statSync(file.path);
    if (stats.size === 0) {
      throw new ValidationError("File is empty");
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (stats.size > maxSize) {
      throw new ValidationError("File size exceeds 50MB limit");
    }

    // Additional security check for file content
    const buffer = fs.readFileSync(file.path, { encoding: null });
    if (this.containsMaliciousContent(buffer)) {
      throw new ValidationError("File contains potentially malicious content");
    }

    console.log(
      `✓ File validation passed: ${file.originalname} (${stats.size} bytes)`,
    );
  }

  private async extractTextFromFileWithFallbacks(
    file: Express.Multer.File,
  ): Promise<ExtractionResult> {
    const filePath = file.path;
    const mimeType = file.mimetype;
    const originalName = file.originalname;

    console.log(
      `Attempting text extraction from: ${originalName} (${mimeType})`,
    );

    // Try primary extraction method based on MIME type
    let result = await this.tryPrimaryExtraction(
      filePath,
      mimeType,
      originalName,
    );

    if (result.success) {
      return result;
    }

    console.log(
      `Primary extraction failed: ${result.error}. Trying fallback methods...`,
    );

    // Try fallback methods
    result = await this.tryFallbackExtractions(filePath, originalName);

    return result;
  }

  private async tryPrimaryExtraction(
    filePath: string,
    mimeType: string,
    originalName: string,
  ): Promise<ExtractionResult> {
    try {
      if (mimeType === "application/pdf") {
        return await this.extractPdfText(filePath);
      } else if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        return await this.extractDocxText(filePath);
      } else if (mimeType === "application/msword") {
        return await this.extractDocText(filePath);
      } else if (
        mimeType?.startsWith("text/") ||
        this.isTextFile(originalName)
      ) {
        return await this.extractPlainText(filePath);
      } else {
        return {
          text: "",
          success: false,
          method: "unknown",
          error: "Unsupported MIME type",
        };
      }
    } catch (error) {
      return {
        text: "",
        success: false,
        method: "primary",
        error: error.message,
      };
    }
  }

  private async tryFallbackExtractions(
    filePath: string,
    originalName: string,
  ): Promise<ExtractionResult> {
    const fallbackMethods = [
      // Try as plain text
      () => this.extractPlainText(filePath),
      // Try textract if available
      () => this.extractWithTextract(filePath),
      // Try reading with different encodings
      () => this.extractWithDifferentEncodings(filePath),
      // Try binary text extraction
      () => this.extractBinaryText(filePath),
    ];

    for (const method of fallbackMethods) {
      try {
        const result = await method();
        if (result.success && result.text.trim().length > 0) {
          return result;
        }
      } catch (error) {
        console.log(`Fallback method failed: ${error.message}`);
        continue;
      }
    }

    return {
      text: "",
      success: false,
      method: "all_fallbacks",
      error: "All extraction methods failed",
    };
  }

  private async extractPdfText(filePath: string): Promise<ExtractionResult> {
    // Try to ensure pdf-parse is loaded
    if (!pdfParse) {
      try {
        pdfParse = require("pdf-parse");
        console.log("✓ pdf-parse loaded via require in extractPdfText");
      } catch (e) {
        return {
          text: "",
          success: false,
          method: "pdf",
          error: "PDF parsing library not available",
        };
      }
    }

    try {
      const dataBuffer = fs.readFileSync(filePath);
      
      // Additional validation to ensure it's a valid PDF
      if (!dataBuffer.subarray(0, 4).toString().includes('%PDF')) {
        throw new Error('File does not appear to be a valid PDF');
      }
      
      console.log(`Attempting to parse PDF with buffer size: ${dataBuffer.length} bytes`);
      
      const data = await pdfParse(dataBuffer, {
        max: 0, // Parse all pages
      });
      
      console.log(`PDF parse result: ${data.text ? data.text.length : 0} characters extracted`);
      
      // Validate extracted text is readable and not binary data
      if (!data.text || data.text.length < 10) {
        throw new Error('No readable text found in PDF');
      }
      
      // Check if extracted text contains too many binary characters
      const binaryCharCount = (data.text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g) || []).length;
      const binaryRatio = binaryCharCount / data.text.length;
      
      if (binaryRatio > 0.3) {
        throw new Error('Extracted text contains too much binary data');
      }
      
      console.log(`✓ Successfully extracted ${data.text.length} characters from PDF`);
      
      return {
        text: data.text.trim(),
        success: true,
        method: "pdf-parse",
      };
    } catch (error) {
      console.log(`PDF extraction failed: ${error.message}`);
      return {
        text: "",
        success: false,
        method: "pdf",
        error: error.message,
      };
    }
  }

  private async extractDocxText(filePath: string): Promise<ExtractionResult> {
    if (!mammoth) {
      return {
        text: "",
        success: false,
        method: "docx",
        error: "Mammoth library not available",
      };
    }

    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return {
        text: result.value,
        success: true,
        method: "mammoth",
      };
    } catch (error) {
      return {
        text: "",
        success: false,
        method: "docx",
        error: error.message,
      };
    }
  }

  private async extractDocText(filePath: string): Promise<ExtractionResult> {
    // Try mammoth first for .doc files
    if (mammoth) {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        return {
          text: result.value,
          success: true,
          method: "mammoth-doc",
        };
      } catch (error) {
        console.log("Mammoth failed for .doc file, trying fallback");
      }
    }

    // Fallback to plain text reading
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      return {
        text,
        success: true,
        method: "plain-text-fallback",
      };
    } catch (error) {
      return {
        text: "",
        success: false,
        method: "doc",
        error: "DOC file format not fully supported. Please convert to DOCX or PDF.",
      };
    }
  }

  private async extractPlainText(filePath: string): Promise<ExtractionResult> {
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      return {
        text,
        success: true,
        method: "plain-text",
      };
    } catch (error) {
      return {
        text: "",
        success: false,
        method: "plain-text",
        error: error.message,
      };
    }
  }

  private async extractWithTextract(filePath: string): Promise<ExtractionResult> {
    if (!textract) {
      return {
        text: "",
        success: false,
        method: "textract",
        error: "Textract library not available",
      };
    }

    try {
      const text = await new Promise<string>((resolve, reject) => {
        textract.fromFileWithPath(filePath, (error: any, text: string) => {
          if (error) {
            reject(error);
          } else {
            resolve(text);
          }
        });
      });

      return {
        text,
        success: true,
        method: "textract",
      };
    } catch (error) {
      return {
        text: "",
        success: false,
        method: "textract",
        error: error.message,
      };
    }
  }

  private async extractWithDifferentEncodings(filePath: string): Promise<ExtractionResult> {
    const encodings = ['utf-8', 'latin1', 'ascii', 'utf16le'];
    
    for (const encoding of encodings) {
      try {
        const text = fs.readFileSync(filePath, encoding as BufferEncoding);
        if (text.trim().length > 0) {
          return {
            text,
            success: true,
            method: `encoding-${encoding}`,
          };
        }
      } catch (error) {
        continue;
      }
    }

    return {
      text: "",
      success: false,
      method: "encoding",
      error: "Failed to read with any encoding",
    };
  }

  private async extractBinaryText(filePath: string): Promise<ExtractionResult> {
    try {
      const buffer = fs.readFileSync(filePath);
      // Extract readable text from binary data
      const text = buffer.toString('binary')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        .trim();
      
      if (text.length > 0) {
        return {
          text,
          success: true,
          method: "binary-text",
        };
      }
    } catch (error) {
      // Continue to failure
    }

    return {
      text: "",
      success: false,
      method: "binary",
      error: "No readable text found in binary data",
    };
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.rtf'];
    const ext = path.extname(filename).toLowerCase();
    return textExtensions.includes(ext);
  }

  private containsMaliciousContent(buffer: Buffer): boolean {
    // Basic security checks for malicious file content
    const content = buffer.toString('binary');
    
    // Check for script injection patterns
    const scriptPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
    ];
    
    return scriptPatterns.some(pattern => pattern.test(content));
  }

  private sanitizeText(text: string): string {
    if (!text) return "";
    
    // Check for binary/corrupted data patterns
    const binaryCharCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g) || []).length;
    const binaryRatio = binaryCharCount / text.length;
    
    if (binaryRatio > 0.2) {
      throw new ValidationError('Text contains too much binary/corrupted data');
    }
    
    // Check for PDF internal structure indicators
    if (text.includes('%PDF-') || (text.includes('obj') && text.includes('endobj'))) {
      throw new ValidationError('Text appears to be raw PDF structure data, not readable content');
    }
    
    // Remove null bytes and other problematic characters
    let sanitized = text
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters except \t, \n, \r
      .replace(/\uFFFD/g, '') // Remove replacement characters
      .trim();

    // Ensure valid UTF-8 by re-encoding
    try {
      sanitized = Buffer.from(sanitized, 'utf8').toString('utf8');
    } catch (error) {
      console.warn('Text encoding issue, using fallback sanitization');
      // Fallback: remove all non-printable characters
      sanitized = sanitized.replace(/[^\x20-\x7E\x0A\x0D\x09]/g, '');
    }

    return sanitized;
  }

  private generateTitle(filename: string, content: string): string {
    // Remove file extension and clean up filename
    const baseName = path.basename(filename, path.extname(filename));
    
    // Try to find a title from the content (first line that looks like a title)
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    for (const line of lines.slice(0, 3)) {
      if (line.trim().length > 10 && line.trim().length < 100) {
        return line.trim();
      }
    }
    
    // Fallback to filename
    return baseName.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private async generateEmbeddingAsync(knowledgeId: number, text: string): Promise<void> {
    try {
      // Generate embedding in background with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Embedding generation timeout')), 30000); // 30 second timeout
      });
      
      const embeddingPromise = localLLMService.generateEmbedding(text.slice(0, 2000)); // Limit text for embedding
      
      const embedding = await Promise.race([embeddingPromise, timeoutPromise]) as number[];
      await storage.updateKnowledgeBaseEmbedding(knowledgeId, JSON.stringify(embedding));
      console.log(`Generated embedding for knowledge base entry ${knowledgeId}`);
    } catch (error) {
      console.warn(`Failed to generate embedding for knowledge base entry ${knowledgeId}:`, error.message);
      // Don't throw - this is background processing
    }
  }

  async searchKnowledge(query: string, userId: number, limit: number = 10): Promise<KnowledgeBase[]> {
    try {
      console.log(`[Knowledge Search] Query: "${query}" for user ${userId}`);
      
      // Get all user knowledge base entries
      const userKnowledge = await storage.getUserKnowledgeBase(userId);
      console.log(`[Knowledge Search] Found ${userKnowledge.length} total knowledge entries`);
      
      if (userKnowledge.length === 0) {
        console.log(`[Knowledge Search] No knowledge base entries found for user ${userId}`);
        return [];
      }

      // Log the available documents
      userKnowledge.forEach(kb => {
        console.log(`[Knowledge Search] Available document: "${kb.title}" (${kb.content.length} chars)`);
      });

      // Enhanced text-based search with multiple matching strategies
      const scoredKnowledge = userKnowledge
        .map(kb => {
          let score = 0;
          
          // Text-based search
          const contentLower = kb.content.toLowerCase();
          const titleLower = kb.title.toLowerCase();
          const queryLower = query.toLowerCase();
          
          // Extract keywords from query for better matching
          const queryWords = queryLower
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2);
          
          // Exact phrase match gets highest score
          if (contentLower.includes(queryLower)) {
            score += 1.0;
          }
          
          // Title exact match gets very high score
          if (titleLower.includes(queryLower)) {
            score += 0.9;
          }
          
          // Individual word matches in content
          queryWords.forEach(word => {
            if (contentLower.includes(word)) {
              score += 0.3;
            }
            // Word in title gets extra score
            if (titleLower.includes(word)) {
              score += 0.4;
            }
          });
          
          // Partial matches for key terms
          const keyTerms = ['aguka', 'program', 'training', 'questionnaire', 'survey', 'sessions'];
          keyTerms.forEach(term => {
            if (queryLower.includes(term) && (contentLower.includes(term) || titleLower.includes(term))) {
              score += 0.5;
            }
          });
          
          // Give a base score to any document if no specific matches found
          if (score === 0 && queryWords.some(word => word.length > 3)) {
            score = 0.05; // Very small base score to ensure documents are considered
          }
          
          console.log(`[Knowledge Search] Document "${kb.title}" scored ${score.toFixed(2)}`);
          return { ...kb, score };
        })
        .filter(kb => kb.score > 0.01) // Very low threshold - be very inclusive
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      console.log(`[Knowledge Search] Returning ${scoredKnowledge.length} scored results`);
      return scoredKnowledge;
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  async deleteKnowledge(knowledgeId: number, userId: number): Promise<void> {
    // Verify ownership before deletion
    const userKnowledge = await storage.getUserKnowledgeBase(userId);
    const knowledge = userKnowledge.find(kb => kb.id === knowledgeId);
    
    if (!knowledge) {
      throw new ValidationError('Knowledge base entry not found or access denied');
    }
    
    try {
      await storage.deleteKnowledgeBase(knowledgeId);
      console.log(`✓ Deleted knowledge base entry ${knowledgeId}`);
    } catch (error) {
      throw new ProcessingError('Failed to delete knowledge base entry', error as Error);
    }
  }

  async getUserKnowledgeStats(userId: number): Promise<{
    totalEntries: number;
    totalSize: number;
    fileTypes: { [key: string]: number };
  }> {
    const userKnowledge = await storage.getUserKnowledgeBase(userId);
    
    const stats = {
      totalEntries: userKnowledge.length,
      totalSize: userKnowledge.reduce((sum, kb) => sum + kb.content.length, 0),
      fileTypes: {} as { [key: string]: number }
    };

    // Count file types
    userKnowledge.forEach(kb => {
      if (kb.mimeType) {
        stats.fileTypes[kb.mimeType] = (stats.fileTypes[kb.mimeType] || 0) + 1;
      }
    });

    return stats;
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();