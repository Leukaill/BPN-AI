import { storage } from "../storage";
import { Document } from "@shared/schema";
import fs from "fs";
import path from "path";
import { aiService } from "./ai";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

class DocumentProcessorFallback {
  
  async processDocument(document: Document): Promise<void> {
    try {
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
        
        console.log(`Document processed (fallback): ${document.originalName} (${extractedText.length} characters)`);
      } else {
        console.log(`Failed to extract text from: ${document.originalName}`);
      }
    } catch (error) {
      console.error("Document processing error (fallback):", error);
    }
  }

  private async extractText(document: Document): Promise<string | null> {
    try {
      const fileBuffer = fs.readFileSync(document.path);
      
      switch (document.mimeType) {
        case "application/pdf":
          return await this.extractPdfTextFallback(document.path);
        
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          return await this.extractDocxTextFallback(document.path);
        
        case "application/msword":
          return await this.extractDocTextFallback(document.path);
        
        case "text/plain":
          return fileBuffer.toString("utf-8");
        
        default:
          console.warn(`Unsupported file type: ${document.mimeType}`);
          return null;
      }
    } catch (error) {
      console.error("Text extraction error (fallback):", error);
      return null;
    }
  }

  private async extractPdfTextFallback(filePath: string): Promise<string | null> {
    try {
      // Try using system pdftotext if available
      const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
      return stdout.trim();
    } catch (error) {
      console.error("PDF extraction error (fallback):", error);
      return "PDF content could not be extracted. Please try a different file format.";
    }
  }

  private async extractDocxTextFallback(filePath: string): Promise<string | null> {
    try {
      // Try using system tools or direct fallback
      const { stdout } = await execAsync(`python3 -c "
import zipfile
import xml.etree.ElementTree as ET
import sys
try:
    with zipfile.ZipFile('${filePath}', 'r') as zip_ref:
        content = zip_ref.read('word/document.xml')
        root = ET.fromstring(content)
        text = ''
        for elem in root.iter():
            if elem.text:
                text += elem.text + ' '
        print(text.strip())
except Exception as e:
    print('Error extracting DOCX:', e, file=sys.stderr)
"`);
      return stdout.trim() || "DOCX content could not be extracted. Please try a different file format.";
    } catch (error) {
      console.error("DOCX extraction error (fallback):", error);
      return "DOCX content could not be extracted. Please try a different file format.";
    }
  }

  private async extractDocTextFallback(filePath: string): Promise<string | null> {
    try {
      // Try using antiword if available
      const { stdout } = await execAsync(`antiword "${filePath}"`);
      return stdout.trim();
    } catch (error) {
      console.error("DOC extraction error (fallback):", error);
      return "DOC content could not be extracted. Please try a different file format.";
    }
  }
}

export const documentProcessorFallback = new DocumentProcessorFallback();