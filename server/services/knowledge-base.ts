import { storage } from "../storage";
import { KnowledgeBase, InsertKnowledgeBase } from "@shared/schema";
import fs from "fs";
import path from "path";
import { geminiService } from "./gemini";

// Import document processing libraries
let pdfParse: any;
let mammoth: any;

// Dynamic imports for document processing libraries
async function loadDocumentLibraries() {
  try {
    pdfParse = await import('pdf-parse');
    mammoth = await import('mammoth');
  } catch (error) {
    console.warn('Document processing libraries not available, falling back to text files only');
  }
}

interface ProcessedKnowledge {
  title: string;
  content: string;
  chunks: string[];
  embedding?: number[];
}

class KnowledgeBaseService {
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      await loadDocumentLibraries();
      this.initialized = true;
    }
  }

  async processAndStoreKnowledge(
    file: Express.Multer.File,
    userId: number,
    customTitle?: string
  ): Promise<KnowledgeBase> {
    await this.initialize();
    
    console.log(`Processing knowledge file: ${file.originalname}`);
    
    try {
      // Extract text from file
      const extractedText = await this.extractTextFromFile(file);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content could be extracted from the file');
      }

      // Create knowledge base entry
      const title = customTitle || this.generateTitle(file.originalname, extractedText);
      const knowledgeData: InsertKnowledgeBase = {
        userId,
        title,
        content: extractedText,
        source: 'file_upload',
        filename: file.originalname,
        mimeType: file.mimetype
      };

      const knowledgeBase = await storage.createKnowledgeBase(knowledgeData);
      
      // Generate embedding for semantic search
      this.generateEmbeddingAsync(knowledgeBase.id, extractedText);
      
      console.log(`Knowledge base entry created: ${title}`);
      return knowledgeBase;
      
    } catch (error) {
      console.error('Error processing knowledge file:', error);
      throw error;
    }
  }

  private async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    const filePath = file.path;
    const mimeType = file.mimetype;
    
    try {
      if (mimeType === 'application/pdf') {
        return await this.extractPdfText(filePath);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.extractDocxText(filePath);
      } else if (mimeType === 'application/msword') {
        return await this.extractDocText(filePath);
      } else if (mimeType === 'text/plain') {
        return fs.readFileSync(filePath, 'utf-8');
      } else {
        // Try to read as text file
        return fs.readFileSync(filePath, 'utf-8');
      }
    } catch (error) {
      console.error(`Error extracting text from ${file.originalname}:`, error);
      throw new Error(`Failed to extract text from ${file.originalname}`);
    }
  }

  private async extractPdfText(filePath: string): Promise<string> {
    if (!pdfParse) {
      throw new Error('PDF processing not available');
    }
    
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse.default(dataBuffer);
    return data.text;
  }

  private async extractDocxText(filePath: string): Promise<string> {
    if (!mammoth) {
      throw new Error('DOCX processing not available');
    }
    
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private async extractDocText(filePath: string): Promise<string> {
    // For older .doc files, we'll try to read as text (limited support)
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error('DOC file format not fully supported. Please convert to DOCX or PDF.');
    }
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
      // Generate embedding in background
      const embedding = await geminiService.generateEmbedding(text.slice(0, 2000)); // Limit text for embedding
      await storage.updateKnowledgeBaseEmbedding(knowledgeId, JSON.stringify(embedding));
      console.log(`Generated embedding for knowledge base entry ${knowledgeId}`);
    } catch (error) {
      console.warn(`Failed to generate embedding for knowledge base entry ${knowledgeId}:`, error.message);
    }
  }

  async searchKnowledge(query: string, userId: number, limit: number = 10): Promise<KnowledgeBase[]> {
    try {
      // Get all user knowledge base entries
      const userKnowledge = await storage.getUserKnowledgeBase(userId);
      
      if (userKnowledge.length === 0) {
        return [];
      }

      // If we have embeddings, use semantic search
      const queryEmbedding = await geminiService.generateEmbedding(query);
      
      // Calculate similarity scores
      const scoredKnowledge = userKnowledge
        .map(kb => {
          let score = 0;
          
          // Text-based search (fallback)
          const contentLower = kb.content.toLowerCase();
          const queryLower = query.toLowerCase();
          if (contentLower.includes(queryLower)) {
            score += 0.5;
          }
          
          // Embedding-based search
          if (kb.embedding && queryEmbedding) {
            try {
              const kbEmbedding = JSON.parse(kb.embedding);
              const similarity = this.cosineSimilarity(queryEmbedding, kbEmbedding);
              score += similarity * 0.8; // Weight embedding similarity higher
            } catch (error) {
              // Skip embedding comparison if parsing fails
            }
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
        const type = kb.mimeType.split('/')[1] || 'unknown';
        stats.fileTypes[type] = (stats.fileTypes[type] || 0) + 1;
      }
    });

    return stats;
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();