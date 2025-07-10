import type { Express, Request, Response, NextFunction } from "express";
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
import fs from "fs/promises";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";

// Enhanced error handling interface
interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Custom error classes
class ValidationError extends Error {
  constructor(
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// Configure enhanced multer with better security
const uploadDir = path.join(process.cwd(), "uploads");

const ensureUploadDir = async () => {
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
};

// Initialize upload directory
ensureUploadDir().catch(console.error);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      // Generate unique filename to prevent conflicts
      const uniqueSuffix = randomUUID();
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
    fields: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/html",
      "text/markdown",
      "text/csv",
      "application/rtf",
      "application/json",
    ];

    const allowedExtensions = [
      ".pdf",
      ".docx",
      ".doc",
      ".txt",
      ".html",
      ".md",
      ".csv",
      ".rtf",
      ".json",
    ];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // Validate file name to prevent directory traversal
    const safeName = path.basename(file.originalname);
    if (safeName !== file.originalname) {
      return cb(new Error("Invalid file name"));
    }

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Allowed types: ${allowedExtensions.join(", ")}`,
        ),
      );
    }
  },
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: "Too many uploads from this IP, please try again later.",
});

// Enhanced authentication middleware
function requireAuth(req: any, res: Response, next: NextFunction) {
  try {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedError("Authentication required");
    }

    if (!req.user || !req.user.id) {
      throw new UnauthorizedError("Invalid user session");
    }

    next();
  } catch (error) {
    next(error);
  }
}

// Async error handler wrapper
const asyncHandler =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Input validation helpers
const validateChatId = (id: string): number => {
  const chatId = parseInt(id);
  if (isNaN(chatId) || chatId <= 0) {
    throw new ValidationError("Invalid chat ID");
  }
  return chatId;
};

const validateDocumentId = (id: string): number => {
  const documentId = parseInt(id);
  if (isNaN(documentId) || documentId <= 0) {
    throw new ValidationError("Invalid document ID");
  }
  return documentId;
};

// Enhanced file cleanup utility
const safeFileDelete = async (filePath: string): Promise<void> => {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
  } catch (error) {
    console.warn(`Failed to delete file ${filePath}:`, error);
  }
};

// Chat ownership validation
const validateChatOwnership = async (chatId: number, userId: number) => {
  const chat = await storage.getChat(chatId);
  if (!chat) {
    throw new NotFoundError("Chat not found");
  }
  if (chat.userId !== userId) {
    throw new UnauthorizedError("Not authorized to access this chat");
  }
  return chat;
};

// Document ownership validation
const validateDocumentOwnership = async (
  documentId: number,
  userId: number,
) => {
  const document = await storage.getDocument(documentId);
  if (!document) {
    throw new NotFoundError("Document not found");
  }
  if (document.userId !== userId) {
    throw new UnauthorizedError("Not authorized to access this document");
  }
  return document;
};

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Apply rate limiting to all API routes
  app.use("/api", apiLimiter);

  // Enhanced error handling middleware
  const errorHandler = (
    error: ApiError,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    console.error("API Error:", {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      user: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: "Validation Error",
        message: error.message,
        details: error.details,
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    if (error instanceof UnauthorizedError) {
      return res.status(401).json({
        error: "Unauthorized",
        message: error.message,
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid request data",
        details: error.errors,
      });
    }

    // Multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "File Too Large",
          message: "File size exceeds 50MB limit",
        });
      }
      return res.status(400).json({
        error: "Upload Error",
        message: error.message,
      });
    }

    // Generic server error
    res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  };

  // CHAT ROUTES
  app.get(
    "/api/chats",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const chats = await storage.getUserChats(req.user.id);
      res.json(chats);
    }),
  );

  app.post(
    "/api/chats",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const validatedData = insertChatSchema.parse(req.body);
      const chat = await storage.createChat(req.user.id, validatedData);
      res.status(201).json(chat);
    }),
  );

  app.get(
    "/api/chats/:id/messages",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const chatId = validateChatId(req.params.id);
      await validateChatOwnership(chatId, req.user.id);

      const messages = await storage.getChatMessages(chatId);
      res.json(messages);
    }),
  );

  app.post(
    "/api/chats/:id/messages",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const chatId = validateChatId(req.params.id);
      await validateChatOwnership(chatId, req.user.id);

      const validatedData = insertMessageSchema.parse({
        ...req.body,
        chatId,
      });

      // Validate message content
      if (!validatedData.content?.trim()) {
        throw new ValidationError("Message content cannot be empty");
      }

      const userMessage = await storage.createMessage(validatedData);

      // Generate AI response with error handling
      let aiResponse: string;
      try {
        aiResponse = await aiService.generateResponse(
          validatedData.content,
          req.user.id,
          chatId,
        );
      } catch (aiError) {
        console.error("AI service error:", aiError);
        aiResponse =
          "I apologize, but I'm experiencing technical difficulties. Please try again later.";
      }

      const assistantMessage = await storage.createMessage({
        chatId,
        role: "assistant",
        content: aiResponse,
      });

      // Update chat title if this is the first message
      const messages = await storage.getChatMessages(chatId);
      if (messages.length === 2) {
        const title =
          validatedData.content.slice(0, 50) +
          (validatedData.content.length > 50 ? "..." : "");
        await storage.updateChatTitle(chatId, title);
      }

      res.json({ userMessage, assistantMessage });
    }),
  );

  app.delete(
    "/api/chats/:id",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const chatId = validateChatId(req.params.id);
      await validateChatOwnership(chatId, req.user.id);

      await storage.deleteChat(chatId);
      res.status(204).send();
    }),
  );

  // DOCUMENT ROUTES
  app.get(
    "/api/documents",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const documents = await storage.getUserDocuments(req.user.id);
      res.json(documents);
    }),
  );

  app.post(
    "/api/documents",
    requireAuth,
    uploadLimiter,
    upload.single("file"),
    asyncHandler(async (req: any, res: Response) => {
      if (!req.file) {
        throw new ValidationError("No file uploaded");
      }

      let document;
      try {
        document = await storage.createDocument({
          userId: req.user.id,
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
        });

        // Process document with timeout and error handling
        const processingTimeout = setTimeout(() => {
          console.warn(`Document processing timeout for ${document.id}`);
        }, 30000); // 30 second timeout warning

        try {
          await documentProcessor.processDocument(document);
          clearTimeout(processingTimeout);
        } catch (processingError) {
          clearTimeout(processingTimeout);
          console.error("Document processing error:", processingError);
          // Don't throw error here - document is uploaded but processing failed
          // The user can try reprocessing later
        }

        res.status(201).json(document);
      } catch (error) {
        // Clean up file if document creation failed
        if (req.file?.path) {
          await safeFileDelete(req.file.path);
        }
        throw error;
      }
    }),
  );

  app.post(
    "/api/documents/:id/reprocess",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const documentId = validateDocumentId(req.params.id);
      const document = await validateDocumentOwnership(documentId, req.user.id);

      // Check if file still exists
      try {
        await fs.access(document.path);
      } catch {
        throw new NotFoundError("Document file not found on server");
      }

      await documentProcessor.processDocument(document);
      const updatedDocument = await storage.getDocument(documentId);

      res.json(updatedDocument);
    }),
  );

  app.delete(
    "/api/documents/:id",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const documentId = validateDocumentId(req.params.id);
      const document = await validateDocumentOwnership(documentId, req.user.id);

      // Delete file from filesystem
      await safeFileDelete(document.path);

      await storage.deleteDocument(documentId);
      res.status(204).send();
    }),
  );

  // REPORT GENERATION ROUTE
  app.post(
    "/api/reports",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const { prompt, documentIds } = req.body;

      if (!prompt?.trim()) {
        throw new ValidationError("Report prompt is required");
      }

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        throw new ValidationError("At least one document ID is required");
      }

      // Validate all document IDs are numbers and belong to user
      const validatedDocumentIds = documentIds.map((id) => {
        const docId = parseInt(id);
        if (isNaN(docId) || docId <= 0) {
          throw new ValidationError(`Invalid document ID: ${id}`);
        }
        return docId;
      });

      // Verify document ownership
      await Promise.all(
        validatedDocumentIds.map((id) =>
          validateDocumentOwnership(id, req.user.id),
        ),
      );

      const report = await aiService.generateReport(
        prompt,
        validatedDocumentIds,
        req.user.id,
      );
      res.json({ report });
    }),
  );

  // BPN KNOWLEDGE ROUTES
  app.get(
    "/api/bpn-knowledge",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const knowledge = await storage.getBpnKnowledge();
      res.json(knowledge);
    }),
  );

  app.post(
    "/api/bpn-knowledge/scrape",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      // Add timeout for web scraping
      const scrapePromise = webScraper.scrapeWebsite();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Web scraping timeout")), 60000),
      );

      await Promise.race([scrapePromise, timeoutPromise]);
      res.json({ message: "Web scraping completed successfully" });
    }),
  );

  // KNOWLEDGE BASE ROUTES
  app.get(
    "/api/knowledge-base",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const knowledge = await storage.getUserKnowledgeBase(req.user.id);
      res.json(knowledge);
    }),
  );

  app.get(
    "/api/knowledge-base/stats",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const stats = await knowledgeBaseService.getUserKnowledgeStats(
        req.user.id,
      );
      res.json(stats);
    }),
  );

  app.post(
    "/api/knowledge-base/upload",
    requireAuth,
    uploadLimiter,
    upload.single("file"),
    asyncHandler(async (req: any, res: Response) => {
      if (!req.file) {
        throw new ValidationError("No file uploaded");
      }

      const title = req.body.title?.trim() || undefined;

      try {
        const knowledgeBase =
          await knowledgeBaseService.processAndStoreKnowledge(
            req.file,
            req.user.id,
            title,
          );

        res.status(201).json(knowledgeBase);
      } finally {
        // Always clean up uploaded file
        await safeFileDelete(req.file.path);
      }
    }),
  );

  app.delete(
    "/api/knowledge-base/:id",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const knowledgeId = validateDocumentId(req.params.id);
      await knowledgeBaseService.deleteKnowledge(knowledgeId, req.user.id);
      res.status(204).send();
    }),
  );

  // DATABASE STATUS ROUTE
  app.get(
    "/api/database/status",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      // Test database connection with timeout
      const connectionTest = db.execute("SELECT 1");
      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Database connection timeout")),
          5000,
        ),
      );

      await Promise.race([connectionTest, timeout]);

      // Get database stats
      const [userCount, chatCount, knowledgeCount] = await Promise.all([
        db.execute("SELECT COUNT(*) as count FROM users"),
        db.execute("SELECT COUNT(*) as count FROM chats"),
        db.execute("SELECT COUNT(*) as count FROM knowledge_base"),
      ]);

      res.json({
        status: "connected",
        healthy: true,
        stats: {
          users: userCount.rows?.[0]?.count || 0,
          chats: chatCount.rows?.[0]?.count || 0,
          knowledgeBase: knowledgeCount.rows?.[0]?.count || 0,
        },
        lastChecked: new Date().toISOString(),
      });
    }),
  );

  // DOWNLOAD GENERATION ROUTES
  app.post(
    "/api/downloads/generate",
    requireAuth,
    asyncHandler(async (req: any, res: Response) => {
      const { content, filename, format } = req.body;

      if (!content?.trim()) {
        throw new ValidationError("Content is required for download generation");
      }

      if (!filename?.trim()) {
        throw new ValidationError("Filename is required");
      }

      const allowedFormats = ['txt', 'md', 'json', 'csv', 'html'];
      const fileFormat = format || 'txt';

      if (!allowedFormats.includes(fileFormat)) {
        throw new ValidationError(`Format must be one of: ${allowedFormats.join(', ')}`);
      }

      // Generate unique filename
      const uniqueId = randomUUID();
      const safeFilename = filename.replace(/[^a-zA-Z0-9\-_]/g, '_');
      const fullFilename = `${safeFilename}_${uniqueId}.${fileFormat}`;
      const filePath = path.join(uploadDir, fullFilename);

      // Create downloads directory if it doesn't exist
      const downloadsDir = path.join(uploadDir, 'downloads');
      try {
        await fs.access(downloadsDir);
      } catch {
        await fs.mkdir(downloadsDir, { recursive: true });
      }

      const downloadPath = path.join(downloadsDir, fullFilename);

      // Process content based on format
      let processedContent = content;
      
      if (fileFormat === 'html') {
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
        ${content.replace(/\n/g, '<br>')}
    </div>
</body>
</html>`;
      } else if (fileFormat === 'md') {
        processedContent = `# ${safeFilename}

*Generated by Denyse AI Assistant - ${new Date().toLocaleString()}*

---

${content}`;
      } else if (fileFormat === 'json') {
        processedContent = JSON.stringify({
          title: safeFilename,
          content: content,
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

      res.json({
        downloadId: uniqueId,
        filename: fullFilename,
        format: fileFormat,
        size: processedContent.length,
        downloadUrl: `/api/downloads/${uniqueId}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
      });
    }),
  );

  app.get(
    "/api/downloads/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const downloadId = req.params.id;
      
      if (!downloadId || !/^[a-f0-9-]{36}$/.test(downloadId)) {
        throw new ValidationError("Invalid download ID");
      }

      const downloadsDir = path.join(uploadDir, 'downloads');
      
      // Find file with this ID
      try {
        const files = await fs.readdir(downloadsDir);
        const targetFile = files.find(file => file.includes(downloadId));
        
        if (!targetFile) {
          throw new NotFoundError("Download file not found or expired");
        }

        const filePath = path.join(downloadsDir, targetFile);
        
        // Check if file still exists
        await fs.access(filePath);
        
        // Get file stats
        const stats = await fs.stat(filePath);
        
        // Set appropriate headers
        const ext = path.extname(targetFile).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
          '.txt': 'text/plain',
          '.md': 'text/markdown',
          '.json': 'application/json',
          '.csv': 'text/csv',
          '.html': 'text/html'
        };
        
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `attachment; filename="${targetFile}"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        // Stream file to response
        const fileStream = await fs.readFile(filePath);
        res.send(fileStream);
        
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw error;
        }
        throw new NotFoundError("Download file not found or expired");
      }
    }),
  );

  // Health check endpoint
  app.get(
    "/api/health",
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }),
  );

  // Apply error handling middleware
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
