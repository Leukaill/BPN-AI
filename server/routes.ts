import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertChatSchema, insertMessageSchema } from "@shared/schema";
import { aiService } from "./services/ai";
import { documentProcessor } from "./services/document-processor";
import { webScraper } from "./services/web-scraper";
import { knowledgeBaseService } from "./services/knowledge-base";
import { db } from "./db";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, DOCX, DOC, and TXT files are allowed."));
    }
  },
});

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Chat routes
  app.get("/api/chats", requireAuth, async (req, res) => {
    try {
      const chats = await storage.getUserChats(req.user.id);
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chats" });
    }
  });

  app.post("/api/chats", requireAuth, async (req, res) => {
    try {
      const validatedData = insertChatSchema.parse(req.body);
      const chat = await storage.createChat(req.user.id, validatedData);
      res.status(201).json(chat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid chat data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create chat" });
      }
    }
  });

  app.get("/api/chats/:id/messages", requireAuth, async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const chat = await storage.getChat(chatId);
      
      if (!chat || chat.userId !== req.user.id) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      const messages = await storage.getChatMessages(chatId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/chats/:id/messages", requireAuth, async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const chat = await storage.getChat(chatId);
      
      if (!chat || chat.userId !== req.user.id) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        chatId,
      });
      
      const userMessage = await storage.createMessage(validatedData);
      
      // Generate AI response
      const aiResponse = await aiService.generateResponse(
        validatedData.content,
        req.user.id,
        chatId
      );
      
      const assistantMessage = await storage.createMessage({
        chatId,
        role: "assistant",
        content: aiResponse,
      });
      
      // Update chat title if this is the first message
      const messages = await storage.getChatMessages(chatId);
      if (messages.length === 2) { // First user message and AI response
        const title = validatedData.content.slice(0, 50) + (validatedData.content.length > 50 ? "..." : "");
        await storage.updateChatTitle(chatId, title);
      }
      
      res.json({ userMessage, assistantMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid message data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create message" });
      }
    }
  });

  app.delete("/api/chats/:id", requireAuth, async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const chat = await storage.getChat(chatId);
      
      if (!chat || chat.userId !== req.user.id) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      await storage.deleteChat(chatId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });

  // Document routes
  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getUserDocuments(req.user.id);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const document = await storage.createDocument({
        userId: req.user.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      });
      
      // Process document immediately and wait for completion
      await documentProcessor.processDocument(document);
      
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Reprocess document endpoint
  app.post("/api/documents/:id/reprocess", requireAuth, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this document" });
      }

      // Force reprocess the document
      await documentProcessor.processDocument(document);
      
      // Get updated document
      const updatedDocument = await storage.getDocument(documentId);
      
      res.json(updatedDocument);
    } catch (error) {
      console.error("Document reprocessing error:", error);
      res.status(500).json({ message: "Failed to reprocess document" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      
      if (!document || document.userId !== req.user.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Delete file from filesystem
      if (fs.existsSync(document.path)) {
        fs.unlinkSync(document.path);
      }
      
      await storage.deleteDocument(documentId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Report generation route
  app.post("/api/reports", requireAuth, async (req, res) => {
    try {
      const { prompt, documentIds } = req.body;
      
      if (!prompt || !Array.isArray(documentIds)) {
        return res.status(400).json({ message: "Invalid request data" });
      }
      
      const report = await aiService.generateReport(prompt, documentIds, req.user.id);
      
      res.json({ report });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // BPN Knowledge routes
  app.get("/api/bpn-knowledge", requireAuth, async (req, res) => {
    try {
      const knowledge = await storage.getBpnKnowledge();
      res.json(knowledge);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch BPN knowledge" });
    }
  });

  app.post("/api/bpn-knowledge/scrape", requireAuth, async (req, res) => {
    try {
      await webScraper.scrapeWebsite();
      res.json({ message: "Web scraping initiated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate web scraping" });
    }
  });

  // Knowledge Base routes
  app.get("/api/knowledge-base", requireAuth, async (req, res) => {
    try {
      const knowledge = await storage.getUserKnowledgeBase(req.user.id);
      res.json(knowledge);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge base" });
    }
  });

  app.get("/api/knowledge-base/stats", requireAuth, async (req, res) => {
    try {
      const stats = await knowledgeBaseService.getUserKnowledgeStats(req.user.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge base stats" });
    }
  });

  app.post("/api/knowledge-base/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const title = req.body.title || undefined;
      const knowledgeBase = await knowledgeBaseService.processAndStoreKnowledge(
        req.file,
        req.user.id,
        title
      );

      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(201).json(knowledgeBase);
    } catch (error) {
      console.error("Knowledge base upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload knowledge base file" });
    }
  });

  app.delete("/api/knowledge-base/:id", requireAuth, async (req, res) => {
    try {
      const knowledgeId = parseInt(req.params.id);
      await knowledgeBaseService.deleteKnowledge(knowledgeId, req.user.id);
      res.status(204).send();
    } catch (error) {
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to delete knowledge base entry" });
      }
    }
  });

  // Database connection status
  app.get("/api/database/status", requireAuth, async (req, res) => {
    try {
      // Test database connection
      await db.execute("SELECT 1");
      
      // Get database stats
      const userCount = await db.execute("SELECT COUNT(*) as count FROM users");
      const chatCount = await db.execute("SELECT COUNT(*) as count FROM chats");
      const knowledgeCount = await db.execute("SELECT COUNT(*) as count FROM knowledge_base");
      
      res.json({
        status: "connected",
        healthy: true,
        stats: {
          users: userCount.rows?.[0]?.count || 0,
          chats: chatCount.rows?.[0]?.count || 0,
          knowledgeBase: knowledgeCount.rows?.[0]?.count || 0
        },
        lastChecked: new Date().toISOString()
      });
    } catch (error) {
      console.error("Database status check failed:", error);
      res.json({
        status: "error",
        healthy: false,
        error: error.message,
        lastChecked: new Date().toISOString()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
