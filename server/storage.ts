import { users, chats, messages, documents, denyseKnowledge, knowledgeBase, type User, type InsertUser, type Chat, type InsertChat, type Message, type InsertMessage, type Document, type InsertDocument, type DenyseKnowledge, type KnowledgeBase, type InsertKnowledgeBase } from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, lt } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat management
  getUserChats(userId: number): Promise<Chat[]>;
  getChat(id: number): Promise<Chat | undefined>;
  createChat(userId: number, chat: InsertChat): Promise<Chat>;
  updateChatTitle(id: number, title: string): Promise<void>;
  deleteChat(id: number): Promise<void>;
  
  // Message management
  getChatMessages(chatId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Document management
  createDocument(document: InsertDocument): Promise<Document>;
  getUserDocuments(userId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  updateDocumentText(id: number, text: string): Promise<void>;
  updateDocumentEmbedding(id: number, embedding: string): Promise<void>;
  deleteExpiredDocuments(): Promise<void>;
  deleteDocument(id: number): Promise<void>;
  
  // Denyse Knowledge management
  getDenyseKnowledge(): Promise<DenyseKnowledge[]>;
  upsertDenyseKnowledge(url: string, title: string, content: string): Promise<void>;
  updateDenyseKnowledgeEmbedding(id: number, embedding: string): Promise<void>;
  
  // Knowledge base management
  createKnowledgeBase(knowledgeBase: InsertKnowledgeBase): Promise<KnowledgeBase>;
  getUserKnowledgeBase(userId: number): Promise<KnowledgeBase[]>;
  updateKnowledgeBaseEmbedding(id: number, embedding: string): Promise<void>;
  deleteKnowledgeBase(id: number): Promise<void>;
  
  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    // Create session store with compatible pool configuration
    this.sessionStore = new PostgresSessionStore({ 
      pool: pool as any, 
      createTableIfMissing: true 
    });
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Chat management
  async getUserChats(userId: number): Promise<Chat[]> {
    return await db.select().from(chats).where(eq(chats.userId, userId)).orderBy(desc(chats.updatedAt));
  }

  async getChat(id: number): Promise<Chat | undefined> {
    const [chat] = await db.select().from(chats).where(eq(chats.id, id));
    return chat || undefined;
  }

  async createChat(userId: number, chat: InsertChat): Promise<Chat> {
    const [newChat] = await db.insert(chats).values({ ...chat, userId }).returning();
    return newChat;
  }

  async updateChatTitle(id: number, title: string): Promise<void> {
    await db.update(chats).set({ title, updatedAt: new Date() }).where(eq(chats.id, id));
  }

  async deleteChat(id: number): Promise<void> {
    // Delete messages first due to foreign key constraint
    await db.delete(messages).where(eq(messages.chatId, id));
    await db.delete(chats).where(eq(chats.id, id));
  }

  // Message management
  async getChatMessages(chatId: number): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    
    // Update chat's updatedAt timestamp
    await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, message.chatId));
    
    return newMessage;
  }

  // Document management
  async createDocument(document: InsertDocument): Promise<Document> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours from now
    
    const [newDocument] = await db.insert(documents).values({
      ...document,
      expiresAt,
    }).returning();
    
    return newDocument;
  }

  async getUserDocuments(userId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async updateDocumentText(id: number, text: string): Promise<void> {
    await db.update(documents).set({ extractedText: text }).where(eq(documents.id, id));
  }

  async updateDocumentEmbedding(id: number, embedding: string): Promise<void> {
    await db.update(documents).set({ embedding }).where(eq(documents.id, id));
  }

  async deleteExpiredDocuments(): Promise<void> {
    await db.delete(documents).where(lt(documents.expiresAt, new Date()));
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Denyse Knowledge management
  async getDenyseKnowledge(): Promise<DenyseKnowledge[]> {
    return await db.select().from(denyseKnowledge).orderBy(desc(denyseKnowledge.lastScraped));
  }

  async upsertDenyseKnowledge(url: string, title: string, content: string): Promise<void> {
    await db.insert(denyseKnowledge).values({
      url,
      title,
      content,
      lastScraped: new Date(),
    }).onConflictDoUpdate({
      target: denyseKnowledge.url,
      set: {
        title,
        content,
        lastScraped: new Date(),
      },
    });
  }

  async updateDenyseKnowledgeEmbedding(id: number, embedding: string): Promise<void> {
    await db.update(denyseKnowledge).set({ embedding }).where(eq(denyseKnowledge.id, id));
  }

  // Knowledge base management
  async createKnowledgeBase(knowledgeBaseData: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const [newKnowledgeBase] = await db.insert(knowledgeBase).values(knowledgeBaseData).returning();
    return newKnowledgeBase;
  }

  async getUserKnowledgeBase(userId: number): Promise<KnowledgeBase[]> {
    return await db.select().from(knowledgeBase).where(eq(knowledgeBase.userId, userId)).orderBy(desc(knowledgeBase.createdAt));
  }

  async updateKnowledgeBaseEmbedding(id: number, embedding: string): Promise<void> {
    await db.update(knowledgeBase).set({ embedding }).where(eq(knowledgeBase.id, id));
  }

  async deleteKnowledgeBase(id: number): Promise<void> {
    await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
  }
}

export const storage = new DatabaseStorage();
