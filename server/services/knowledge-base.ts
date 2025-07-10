import { storage } from "../storage";
import { KnowledgeBase, InsertKnowledgeBase } from "@shared/schema";
import fs from "fs";
import path from "path";
import { geminiService } from "./gemini";

// Document processing libraries - loaded dynamically
let pdfParse: any;
let mammoth: any;
let textract: any;

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
          pdfParse = module.default;
          break;
        case "mammoth":
          mammoth = module.default;
          break;
        case "textract":
          textract = module;
          break;
      }
      console.log(`✓ ${moduleName} loaded successfully`);
    } catch (error) {
      console.warn(`⚠ Could not load ${moduleName}:`, error.message);
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
      throw new Error("No file provided");
    }

    if (!file.path || !fs.existsSync(file.path)) {
      throw new Error("File path does not exist");
    }

    const stats = fs.statSync(file.path);
    if (stats.size === 0) {
      throw new Error("File is empty");
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (stats.size > maxSize) {
      throw new Error("File size exceeds 50MB limit");
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
    if (!pdfParse) {
      return {
        text: "",
        success: false,
        method: "pdf",
        error: "PDF parsing library not available",
      };
    }

    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer, {
        max: 0, // Parse all pages
        version: 'v1.10.100'
      });
      
      return {
        text: data.text,
        success: true,
        method: "pdf-parse",
      };
    } catch (error) {
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

  private sanitizeText(text: string): string {
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
      
      const embeddingPromise = geminiService.generateEmbedding(text.slice(0, 2000)); // Limit text for embedding
      
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
      // Get all user knowledge base entries
      const userKnowledge = await storage.getUserKnowledgeBase(userId);
      
      if (userKnowledge.length === 0) {
        return [];
      }

      // Simple text-based search first
      const scoredKnowledge = userKnowledge
        .map(kb => {
          let score = 0;
          
          // Text-based search
          const contentLower = kb.content.toLowerCase();
          const queryLower = query.toLowerCase();
          
          // Exact phrase match gets highest score
          if (contentLower.includes(queryLower)) {
            score += 0.8;
          }
          
          // Individual word matches
          const queryWords = queryLower.split(/\s+/);
          queryWords.forEach(word => {
            if (contentLower.includes(word)) {
              score += 0.2 / queryWords.length;
            }
          });
          
          // Title matches get bonus
          if (kb.title.toLowerCase().includes(queryLower)) {
            score += 0.3;
          }
          
          return { ...kb, score };
        })
        .filter(kb => kb.score > 0.1) // Filter out very low scores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

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
      throw new Error('Knowledge base entry not found or access denied');
    }
    
    await storage.deleteKnowledgeBase(knowledgeId);
    console.log(`Deleted knowledge base entry ${knowledgeId}`);
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