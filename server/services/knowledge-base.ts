import { storage } from "../storage";
import { KnowledgeBase, InsertKnowledgeBase } from "@shared/schema";
import fs from "fs";
import path from "path";
import { geminiService } from "./gemini";

// Document processing libraries - loaded dynamically
let pdfParse: any;
let mammoth: any;

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
      try {
        // Load libraries when first needed
        const pdfParseModule = await import('pdf-parse');
        const mammothModule = await import('mammoth');
        
        pdfParse = pdfParseModule.default;
        mammoth = mammothModule.default;
        
        console.log('Document processing libraries loaded successfully');
      } catch (error) {
        console.warn('Could not load document processing libraries:', error.message);
      }
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
      
      // Generate embedding for semantic search in background
      this.generateEmbeddingAsync(knowledgeBase.id, extractedText).catch(error => {
        console.warn(`Failed to generate embedding for ${knowledgeBase.id}:`, error.message);
      });
      
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
    const data = await pdfParse(dataBuffer);
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