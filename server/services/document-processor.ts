import { storage } from "../storage";
import { Document } from "@shared/schema";
import fs from "fs";
import path from "path";
import { aiService } from "./ai";

// Import document processing libraries directly
let pdfParse: any;
let mammoth: any;

async function loadDependencies() {
  try {
    // Use require for CommonJS modules
    pdfParse = require("pdf-parse");
    mammoth = require("mammoth");
    console.log("Document processing dependencies loaded successfully");
  } catch (error) {
    console.error("Failed to load document processing dependencies:", error);
    throw error;
  }
}

class DocumentProcessor {
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      await loadDependencies();
      this.initialized = true;
    }
  }

  async processDocument(document: Document): Promise<void> {
    try {
      await this.initialize();
      
      const extractedText = await this.extractText(document);
      if (extractedText && extractedText.trim().length > 0) {
        await storage.updateDocumentText(document.id, extractedText);
        
        // Generate embedding
        try {
          const embedding = await aiService.generateEmbedding(extractedText);
          await storage.updateDocumentEmbedding(document.id, JSON.stringify(embedding));
        } catch (embeddingError) {
          console.error("Embedding generation error:", embeddingError);
        }
        
        console.log(`Document processed: ${document.originalName} (${extractedText.length} characters)`);
      } else {
        console.log(`Failed to extract text from: ${document.originalName}`);
      }
    } catch (error) {
      console.error("Document processing error:", error);
    }
  }

  private async extractText(document: Document): Promise<string | null> {
    try {
      const fileBuffer = fs.readFileSync(document.path);
      
      switch (document.mimeType) {
        case "application/pdf":
          return await this.extractPdfText(fileBuffer);
        
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          return await this.extractDocxText(fileBuffer);
        
        case "application/msword":
          return await this.extractDocText(fileBuffer);
        
        case "text/plain":
          return fileBuffer.toString("utf-8");
        
        default:
          console.warn(`Unsupported file type: ${document.mimeType}`);
          return null;
      }
    } catch (error) {
      console.error("Text extraction error:", error);
      return null;
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string | null> {
    try {
      if (!pdfParse) {
        console.log("PDF parser not loaded, attempting to load...");
        await this.initialize();
      }
      
      if (!pdfParse) {
        throw new Error("PDF parsing library not available");
      }
      
      const data = await pdfParse(buffer);
      return data.text || "";
    } catch (error) {
      console.error("PDF extraction error:", error);
      return null;
    }
  }

  private async extractDocxText(buffer: Buffer): Promise<string | null> {
    try {
      if (!mammoth) {
        console.log("Mammoth not loaded, attempting to load...");
        await this.initialize();
      }
      
      if (!mammoth) {
        throw new Error("DOCX parsing library not available");
      }
      
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch (error) {
      console.error("DOCX extraction error:", error);
      return null;
    }
  }

  private async extractDocText(buffer: Buffer): Promise<string | null> {
    try {
      // For older DOC files, we would need a different library
      // For now, return a placeholder
      return "DOC file processing not yet implemented";
    } catch (error) {
      console.error("DOC extraction error:", error);
      return null;
    }
  }

  async searchDocuments(query: string, userId: number): Promise<Document[]> {
    try {
      const userDocuments = await storage.getUserDocuments(userId);
      const queryEmbedding = await aiService.generateEmbedding(query);
      
      // Simple similarity search (in production, use a proper vector database)
      const scoredDocuments = userDocuments
        .filter(doc => doc.extractedText && doc.embedding)
        .map(doc => {
          const docEmbedding = JSON.parse(doc.embedding!);
          const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
          return { document: doc, similarity };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      return scoredDocuments.map(item => item.document);
    } catch (error) {
      console.error("Document search error:", error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const documentProcessor = new DocumentProcessor();
