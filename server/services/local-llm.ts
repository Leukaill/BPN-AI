interface LocalLLMConfig {
  baseURL: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

class LocalLLMService {
  private config: LocalLLMConfig;

  constructor() {
    this.config = {
      baseURL: process.env.LOCAL_LLM_URL || "http://localhost:11434", // Default Ollama port
      model: process.env.LOCAL_LLM_MODEL || "llama3.1:8b",
      temperature: 0.7,
      maxTokens: 2048
    };
  }

  async generateResponse(prompt: string, options: any = {}): Promise<string> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || this.config.temperature,
            num_predict: options.maxTokens || this.config.maxTokens,
            top_k: options.topK || 40,
            top_p: options.topP || 0.95,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Local LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || "I couldn't generate a response.";
    } catch (error) {
      console.error("Local LLM API error:", error);
      
      // If local LLM is not available, provide a helpful error message
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(`Local LLM not accessible at ${this.config.baseURL}. Please ensure your Llama model is running with API access enabled.`);
      }
      
      throw new Error(`Local LLM error: ${error}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: text
        })
      });

      if (!response.ok) {
        // If embeddings endpoint is not available, fall back to simple embedding
        console.warn("Local LLM embeddings not available, using fallback");
        return this.generateFallbackEmbedding(text);
      }

      const data = await response.json();
      return data.embedding || this.generateFallbackEmbedding(text);
    } catch (error) {
      console.warn("Local LLM embedding error, using fallback:", error);
      return this.generateFallbackEmbedding(text);
    }
  }

  private generateFallbackEmbedding(text: string): number[] {
    // Simple embedding simulation - can be improved with a local embedding model
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const embedding = new Array(768).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length && j < embedding.length; j++) {
        embedding[j] += word.charCodeAt(j) / 1000;
      }
    }
    
    return embedding;
  }

  // Test connection to local LLM
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/tags`, {
        method: 'GET'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Get available models from local LLM
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/tags`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error("Error fetching available models:", error);
      return [];
    }
  }
}

export const localLLMService = new LocalLLMService();