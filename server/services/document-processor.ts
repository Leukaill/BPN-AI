import { storage } from "../storage";
import { Document } from "@shared/schema";
import fs from "fs";
import path from "path";
// Use existing gemini service for embeddings
import { geminiService } from "./gemini";

interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    documentId: number;
    source: string;
    chunkIndex: number;
  };
  embedding?: number[];
}

class DocumentProcessor {
  private documentChunks: Map<number, DocumentChunk[]> = new Map();

  async processDocument(document: Document): Promise<void> {
    try {
      console.log(`Processing document: ${document.originalName}`);
      
      // Step 1: Extract text from document with timeout
      const extractedText = await Promise.race([
        this.extractTextFromFile(document),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Document processing timeout')), 30000)
        )
      ]);
      
      if (!extractedText || extractedText.trim().length === 0) {
        console.log(`Failed to extract text from: ${document.originalName}`);
        await storage.updateDocumentText(document.id, `Document "${document.originalName}" uploaded but text extraction failed.`);
        return;
      }

      // Step 2: Store the full text
      await storage.updateDocumentText(document.id, extractedText);
      console.log(`Stored text for ${document.originalName} (${extractedText.length} characters)`);
      
      // Step 3: Chunk the text for better retrieval
      const chunks = this.chunkText(extractedText);
      console.log(`Created ${chunks.length} chunks from ${document.originalName}`);
      
      // Step 4: Generate embeddings for each chunk (with limited concurrency)
      const documentChunks: DocumentChunk[] = [];
      const BATCH_SIZE = 3; // Process chunks in batches to avoid overload
      
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (chunk, batchIndex) => {
          const chunkIndex = i + batchIndex;
          try {
            const embedding = await this.generateEmbedding(chunk);
            return {
              id: `${document.id}_chunk_${chunkIndex}`,
              content: chunk,
              metadata: {
                documentId: document.id,
                source: document.originalName,
                chunkIndex
              },
              embedding
            };
          } catch (embeddingError) {
            console.warn(`Error generating embedding for chunk ${chunkIndex}:`, embeddingError.message);
            return {
              id: `${document.id}_chunk_${chunkIndex}`,
              content: chunk,
              metadata: {
                documentId: document.id,
                source: document.originalName,
                chunkIndex
              }
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        documentChunks.push(...batchResults);
        
        // Small delay between batches to prevent API rate limiting
        if (i + BATCH_SIZE < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Step 5: Store chunks in memory
      this.documentChunks.set(document.id, documentChunks);
      console.log(`Stored ${documentChunks.length} chunks for ${document.originalName}`);
      
      // Step 6: Store aggregated embedding for the full document
      try {
        const fullDocEmbedding = await this.generateEmbedding(extractedText.slice(0, 1500));
        await storage.updateDocumentEmbedding(document.id, JSON.stringify(fullDocEmbedding));
        console.log(`Generated document embedding for ${document.originalName}`);
      } catch (embeddingError) {
        console.warn("Full document embedding generation failed:", embeddingError.message);
      }
      
      console.log(`✅ Document processed successfully: ${document.originalName} (${extractedText.length} characters, ${chunks.length} chunks)`);
    } catch (error) {
      console.error(`❌ Document processing failed for ${document.originalName}:`, error.message);
      // Ensure we store something in the database even if processing fails
      try {
        await storage.updateDocumentText(document.id, `Document "${document.originalName}" uploaded but processing failed: ${error.message}`);
      } catch (dbError) {
        console.error("Failed to update document with error message:", dbError);
      }
    }
  }

  // Step 1: Extract text from different file types
  private async extractTextFromFile(document: Document): Promise<string> {
    const fileBuffer = fs.readFileSync(document.path);
    
    switch (document.mimeType) {
      case "application/pdf":
        try {
          const pdfParse = await import("pdf-parse");
          const pdfData = await pdfParse.default(fileBuffer);
          return pdfData.text;
        } catch (error) {
          console.error("PDF processing error:", error);
          return `PDF document "${document.originalName}" uploaded but text extraction failed. Please ensure the PDF is not corrupted.`;
        }
      
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try {
          const mammoth = await import("mammoth");
          const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
          return docxResult.value;
        } catch (error) {
          console.error("DOCX processing error:", error);
          return `DOCX document "${document.originalName}" uploaded but text extraction failed.`;
        }
      
      case "application/msword":
        // For .doc files, try to extract with mammoth (limited support)
        try {
          const mammoth = await import("mammoth");
          const docResult = await mammoth.extractRawText({ buffer: fileBuffer });
          return docResult.value;
        } catch (error) {
          console.warn(`Limited support for .doc files: ${document.originalName}`);
          return `Document "${document.originalName}" uploaded but text extraction limited for .doc format. Please convert to .docx for better results.`;
        }
      
      case "text/plain":
        return fileBuffer.toString("utf-8");
      
      default:
        throw new Error(`Unsupported file type: ${document.mimeType}`);
    }
  }

  // Step 2: Split text into manageable chunks with overlap
  private chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;
      if (start >= text.length) break;
    }
    
    return chunks;
  }

  // Step 3: Generate embeddings using Gemini
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await geminiService.generateEmbedding(text);
    } catch (error) {
      console.error("Embedding generation error:", error);
      // Fallback: create a simple hash-based embedding
      return this.createFallbackEmbedding(text);
    }
  }

  // Fallback embedding for when Gemini embeddings fail
  private createFallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const embedding = new Array(768).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length && j < embedding.length; j++) {
        embedding[j] += word.charCodeAt(j) / 1000;
      }
    }
    
    return embedding;
  }

  // Step 4: Calculate cosine similarity between vectors
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Step 5: Find relevant chunks for a query using vector similarity
  async findRelevantChunks(query: string, userId: number, topK: number = 5): Promise<DocumentChunk[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const allChunks: DocumentChunk[] = [];
      
      // Get user's documents
      const userDocuments = await storage.getUserDocuments(userId);
      
      // Collect all chunks from user's documents
      for (const doc of userDocuments) {
        const chunks = this.documentChunks.get(doc.id);
        if (chunks) {
          allChunks.push(...chunks);
        }
      }
      
      if (allChunks.length === 0) {
        return [];
      }
      
      // Calculate similarities
      const similarities = allChunks
        .filter(chunk => chunk.embedding) // Only chunks with embeddings
        .map(chunk => ({
          chunk,
          similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding!)
        }));
      
      // Sort by similarity and return top K
      similarities.sort((a, b) => b.similarity - a.similarity);
      return similarities.slice(0, topK).map(item => item.chunk);
    } catch (error) {
      console.error("Error finding relevant chunks:", error);
      return [];
    }
  }

  // Step 6: Generate context-aware response
  async generateContextualResponse(query: string, userId: number): Promise<string> {
    const relevantChunks = await this.findRelevantChunks(query, userId);
    
    if (relevantChunks.length === 0) {
      return "I don't have any relevant document content to answer your question. Please upload documents first.";
    }
    
    // Build context from relevant chunks
    const context = relevantChunks
      .map(chunk => `Source: ${chunk.metadata.source} (Chunk ${chunk.metadata.chunkIndex + 1})\nContent: ${chunk.content}`)
      .join('\n\n---\n\n');
    
    return context; // Return context for AI service to use
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
