import { users, chats, messages, documents, bpnKnowledge, type User, type InsertUser, type Chat, type InsertChat, type Message, type InsertMessage, type Document, type InsertDocument, type BpnKnowledge } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lt } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

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
  
  // BPN Knowledge management
  getBpnKnowledge(): Promise<BpnKnowledge[]>;
  upsertBpnKnowledge(url: string, title: string, content: string): Promise<void>;
  updateBpnKnowledgeEmbedding(id: number, embedding: string): Promise<void>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
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

  // BPN Knowledge management
  async getBpnKnowledge(): Promise<BpnKnowledge[]> {
    return await db.select().from(bpnKnowledge).orderBy(desc(bpnKnowledge.lastScraped));
  }

  async upsertBpnKnowledge(url: string, title: string, content: string): Promise<void> {
    await db.insert(bpnKnowledge).values({
      url,
      title,
      content,
      lastScraped: new Date(),
    }).onConflictDoUpdate({
      target: bpnKnowledge.url,
      set: {
        title,
        content,
        lastScraped: new Date(),
      },
    });
  }

  async updateBpnKnowledgeEmbedding(id: number, embedding: string): Promise<void> {
    await db.update(bpnKnowledge).set({ embedding }).where(eq(bpnKnowledge.id, id));
  }
}

export const storage = new DatabaseStorage();
