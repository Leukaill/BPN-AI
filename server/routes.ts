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
