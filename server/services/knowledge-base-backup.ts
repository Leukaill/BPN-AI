import { storage } from "../storage";
import { KnowledgeBase, InsertKnowledgeBase } from "@shared/schema";
import fs from "fs";
import path from "path";
import { localLLMService } from "./local-llm";

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

      // Create knowledge base entry
      const title =
        customTitle ||
        this.generateTitle(file.originalname, extractionResult.text);
      const knowledgeData: InsertKnowledgeBase = {
        userId,
        title,
        content: extractionResult.text,
        source: "file_upload",
        filename: file.originalname,
        mimeType: file.mimetype,
      };

      const knowledgeBase = await storage.createKnowledgeBase(knowledgeData);

      // Generate embedding for semantic search in background
      this.generateEmbeddingAsync(
        knowledgeBase.id,
        extractionResult.text,
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
        // Add options for better text extraction
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      if (!data.text || data.text.trim().length === 0) {
        return {
          text: "",
          success: false,
          method: "pdf",
          error: "PDF contains no extractable text",
        };
      }

      return { text: data.text, success: true, method: "pdf-parse" };
    } catch (error) {
      return { text: "", success: false, method: "pdf", error: error.message };
    }
  }

  private async extractDocxText(filePath: string): Promise<ExtractionResult> {
    if (!mammoth) {
      return {
        text: "",
        success: false,
        method: "docx",
        error: "DOCX parsing library not available",
      };
    }

    try {
      const result = await mammoth.extractRawText({ path: filePath });

      if (!result.value || result.value.trim().length === 0) {
        return {
          text: "",
          success: false,
          method: "docx",
          error: "DOCX contains no extractable text",
        };
      }

      return { text: result.value, success: true, method: "mammoth" };
    } catch (error) {
      return { text: "", success: false, method: "docx", error: error.message };
    }
  }

  private async extractDocText(filePath: string): Promise<ExtractionResult> {
    // For older .doc files, try multiple approaches
    try {
      if (textract) {
        const text = await new Promise<string>((resolve, reject) => {
          textract.fromFileWithPath(filePath, (error: any, text: string) => {
            if (error) reject(error);
            else resolve(text);
          });
        });

        if (text && text.trim().length > 0) {
          return { text, success: true, method: "textract" };
        }
      }

      // Fallback to reading as binary and extracting printable text
      return await this.extractBinaryText(filePath);
    } catch (error) {
      return { text: "", success: false, method: "doc", error: error.message };
    }
  }

  private async extractPlainText(filePath: string): Promise<ExtractionResult> {
    try {
      const text = fs.readFileSync(filePath, "utf-8");
      return { text, success: true, method: "utf-8" };
    } catch (error) {
      return {
        text: "",
        success: false,
        method: "plain-text",
        error: error.message,
      };
    }
  }

  private async extractWithTextract(
    filePath: string,
  ): Promise<ExtractionResult> {
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
        textract.fromFileWithPath(
          filePath,
          { preserveLineBreaks: true },
          (error: any, text: string) => {
            if (error) reject(error);
            else resolve(text);
          },
        );
      });

      if (text && text.trim().length > 0) {
        return { text, success: true, method: "textract" };
      }

      return {
        text: "",
        success: false,
        method: "textract",
        error: "No text extracted",
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

  private async extractWithDifferentEncodings(
    filePath: string,
  ): Promise<ExtractionResult> {
    const encodings = ["utf-8", "latin1", "ascii", "utf16le"];

    for (const encoding of encodings) {
      try {
        const text = fs.readFileSync(filePath, encoding as BufferEncoding);
        if (text && text.trim().length > 0 && this.isValidText(text)) {
          return { text, success: true, method: `encoding-${encoding}` };
        }
      } catch (error) {
        continue;
      }
    }

    return {
      text: "",
      success: false,
      method: "encoding",
      error: "No valid text found with any encoding",
    };
  }

  private async extractBinaryText(filePath: string): Promise<ExtractionResult> {
    try {
      const buffer = fs.readFileSync(filePath);
      let text = "";

      // Extract printable ASCII characters
      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        if (
          (byte >= 32 && byte <= 126) ||
          byte === 9 ||
          byte === 10 ||
          byte === 13
        ) {
          text += String.fromCharCode(byte);
        } else if (byte === 0 && text.length > 0) {
          // Null byte might indicate end of text section
          break;
        }
      }

      // Clean up the extracted text
      text = text.replace(/\s+/g, " ").trim();

      if (text.length > 50) {
        // Minimum viable text length
        return { text, success: true, method: "binary-extraction" };
      }

      return {
        text: "",
        success: false,
        method: "binary",
        error: "Insufficient text extracted from binary",
      };
    } catch (error) {
      return {
        text: "",
        success: false,
        method: "binary",
        error: error.message,
      };
    }
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = [
      ".txt",
      ".md",
      ".csv",
      ".json",
      ".xml",
      ".html",
      ".htm",
      ".rtf",
      ".log",
    ];
    const ext = path.extname(filename).toLowerCase();
    return textExtensions.includes(ext);
  }

  private isValidText(text: string): boolean {
    // Check if text contains reasonable amount of readable characters
    const printableChars = text.replace(/[^\x20-\x7E\n\r\t]/g, "").length;
    const ratio = printableChars / text.length;
    return ratio > 0.5 && text.trim().length > 10;
  }

  private generateTitle(filename: string, content: string): string {
    // Remove file extension and clean up filename
    const baseName = path.basename(filename, path.extname(filename));

    // Try to find a title from the content (first meaningful line)
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines.slice(0, 5)) {
      if (line.length > 5 && line.length < 100) {
        // Check if it looks like a title (not just random text)
        if (!/^\d+$/.test(line) && !/^[^a-zA-Z]*$/.test(line)) {
          return line;
        }
      }
    }

    // Fallback to cleaned filename
    return baseName
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
  }

  private async generateEmbeddingAsync(
    knowledgeId: number,
    text: string,
  ): Promise<void> {
    try {
      // Generate embedding in background with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Embedding generation timeout")),
          30000,
        );
      });

      // Use first 2000 characters for embedding, clean the text
      const cleanText = text.replace(/\s+/g, " ").trim().slice(0, 2000);
      const embeddingPromise = localLLMService.generateEmbedding(cleanText);

      const embedding = (await Promise.race([
        embeddingPromise,
        timeoutPromise,
      ])) as number[];
      await storage.updateKnowledgeBaseEmbedding(
        knowledgeId,
        JSON.stringify(embedding),
      );
      console.log(
        `✓ Generated embedding for knowledge base entry ${knowledgeId}`,
      );
    } catch (error) {
      console.warn(
        `Failed to generate embedding for knowledge base entry ${knowledgeId}:`,
        error.message,
      );
    }
  }

  async searchKnowledge(
    query: string,
    userId: number,
    limit: number = 10,
  ): Promise<KnowledgeBase[]> {
    try {
      const userKnowledge = await storage.getUserKnowledgeBase(userId);

      if (userKnowledge.length === 0) {
        return [];
      }

      // Enhanced text-based search
      const scoredKnowledge = userKnowledge
        .map((kb) => {
          let score = 0;
          const contentLower = kb.content.toLowerCase();
          const queryLower = query.toLowerCase();

          // Exact phrase match gets highest score
          if (contentLower.includes(queryLower)) {
            score += 0.8;
          }

          // Individual word matches with position weighting
          const queryWords = queryLower.split(/\s+/);
          queryWords.forEach((word) => {
            const wordRegex = new RegExp(`\\b${word}\\b`, "gi");
            const matches = contentLower.match(wordRegex);
            if (matches) {
              score += Math.min(matches.length * 0.1, 0.3);
            }
          });

          // Title matches get bonus
          if (kb.title.toLowerCase().includes(queryLower)) {
            score += 0.4;
          }

          // Filename matches get smaller bonus
          if (kb.filename && kb.filename.toLowerCase().includes(queryLower)) {
            score += 0.2;
          }

          return { ...kb, score };
        })
        .filter((kb) => kb.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scoredKnowledge;
    } catch (error) {
      console.error("Error searching knowledge base:", error);
      return [];
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async deleteKnowledge(knowledgeId: number, userId: number): Promise<void> {
    const userKnowledge = await storage.getUserKnowledgeBase(userId);
    const knowledge = userKnowledge.find((kb) => kb.id === knowledgeId);

    if (!knowledge) {
      throw new Error("Knowledge base entry not found or access denied");
    }

    await storage.deleteKnowledgeBase(knowledgeId);
    console.log(`✓ Deleted knowledge base entry ${knowledgeId}`);
  }

  async getUserKnowledgeStats(userId: number): Promise<{
    totalEntries: number;
    totalSize: number;
    fileTypes: { [key: string]: number };
    supportedTypes: string[];
  }> {
    const userKnowledge = await storage.getUserKnowledgeBase(userId);

    const stats = {
      totalEntries: userKnowledge.length,
      totalSize: userKnowledge.reduce((sum, kb) => sum + kb.content.length, 0),
      fileTypes: {} as { [key: string]: number },
      supportedTypes: Array.from(this.supportedMimeTypes),
    };

    // Count file types
    userKnowledge.forEach((kb) => {
      if (kb.mimeType) {
        const type = kb.mimeType.split("/")[1] || "unknown";
        stats.fileTypes[type] = (stats.fileTypes[type] || 0) + 1;
      }
    });

    return stats;
  }

  // New method to test text extraction without storing
  async testTextExtraction(
    file: Express.Multer.File,
  ): Promise<ExtractionResult> {
    await this.initialize();

    try {
      this.validateFile(file);
      return await this.extractTextFromFileWithFallbacks(file);
    } catch (error) {
      return { text: "", success: false, method: "test", error: error.message };
    }
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
let textract: any;
