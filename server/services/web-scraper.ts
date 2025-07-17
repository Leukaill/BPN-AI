import { storage } from "../storage";
import { aiService } from "./ai";

// Dynamic import for cheerio
let cheerio: any;

async function loadCheerio() {
  try {
    cheerio = await import("cheerio");
  } catch (error) {
    console.error("Failed to load cheerio:", error);
  }
}

class WebScraper {
  private initialized = false;
  private baseUrl = "https://www.bpn.rw";

  async initialize() {
    if (!this.initialized) {
      await loadCheerio();
      this.initialized = true;
    }
  }

  async scrapeWebsite(): Promise<void> {
    try {
      await this.initialize();
      
      if (!cheerio) {
        console.error("Cheerio not available for web scraping");
        return;
      }

      // Start with the main page
      await this.scrapePage(this.baseUrl);
      
      // Add more pages as needed
      const commonPages = [
        "/about",
        "/services",
        "/contact",
        "/news",
        "/projects",
      ];

      for (const page of commonPages) {
        try {
          await this.scrapePage(`${this.baseUrl}${page}`);
        } catch (error) {
          console.error(`Failed to scrape ${page}:`, error);
        }
      }
    } catch (error) {
      console.error("Web scraping error:", error);
    }
  }

  private async scrapePage(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Denyse-AI-Bot/1.0)",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract title
      const title = $("title").text() || $("h1").first().text() || "Denyse Page";

      // Extract main content
      let content = "";
      
      // Try to find main content areas
      const contentSelectors = [
        "main",
        ".content",
        ".main-content",
        "article",
        ".post-content",
        ".page-content",
        "body",
      ];

      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          break;
        }
      }

      // Clean up content
      content = content
        .replace(/\s+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();

      if (content.length > 100) { // Only store if we have meaningful content
        await storage.upsertDenyseKnowledge(url, title, content);
        
        // Generate embedding for the content
        const embedding = await aiService.generateEmbedding(content);
        
        // Get the stored knowledge to update embedding
        const knowledgeItems = await storage.getDenyseKnowledge();
        const currentItem = knowledgeItems.find(item => item.url === url);
        
        if (currentItem) {
          await storage.updateDenyseKnowledgeEmbedding(currentItem.id, JSON.stringify(embedding));
        }
      }

      // Add delay to be respectful to the server
      await this.delay(1000);
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async searchKnowledge(query: string): Promise<any[]> {
    try {
      const knowledgeItems = await storage.getDenyseKnowledge();
      const queryEmbedding = await aiService.generateEmbedding(query);
      
      // Simple similarity search
      const scoredItems = knowledgeItems
        .filter(item => item.embedding)
        .map(item => {
          const itemEmbedding = JSON.parse(item.embedding!);
          const similarity = this.cosineSimilarity(queryEmbedding, itemEmbedding);
          return { item, similarity };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);

      return scoredItems.map(scored => scored.item);
    } catch (error) {
      console.error("Knowledge search error:", error);
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

export const webScraper = new WebScraper();
