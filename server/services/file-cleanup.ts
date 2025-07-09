import { storage } from "../storage";
import fs from "fs";
import cron from "node-cron";

class FileCleanupService {
  start() {
    // Run cleanup every hour
    cron.schedule("0 * * * *", () => {
      this.cleanupExpiredDocuments();
    });

    // Run immediately on startup
    this.cleanupExpiredDocuments();
  }

  private async cleanupExpiredDocuments() {
    try {
      console.log("Starting document cleanup...");
      
      const userDocuments = await storage.getUserDocuments(1); // This is a workaround - should get all expired docs
      const expiredDocuments = userDocuments.filter(doc => 
        new Date(doc.expiresAt) < new Date()
      );

      for (const doc of expiredDocuments) {
        try {
          // Delete file from filesystem
          if (fs.existsSync(doc.path)) {
            fs.unlinkSync(doc.path);
            console.log(`Deleted file: ${doc.path}`);
          }
          
          // Delete from database
          await storage.deleteDocument(doc.id);
          console.log(`Deleted document record: ${doc.id}`);
        } catch (error) {
          console.error(`Failed to cleanup document ${doc.id}:`, error);
        }
      }

      // Use the storage method to clean up expired documents
      await storage.deleteExpiredDocuments();
      
      console.log(`Cleanup completed. Removed ${expiredDocuments.length} expired documents.`);
    } catch (error) {
      console.error("Document cleanup error:", error);
    }
  }
}

export const fileCleanupService = new FileCleanupService();
