import { localLLMService } from "./local-llm";

/**
 * Enhanced error handling wrapper for Local LLM Service
 * Provides standardized error messages and fallback strategies
 */
export class LLMErrorHandler {
  /**
   * Wrapper for generateResponse with enhanced error handling
   */
  static async generateResponse(
    prompt: string,
    options: any = {},
    context: string = "general"
  ): Promise<string> {
    try {
      // Validate inputs
      if (!prompt || prompt.trim().length === 0) {
        throw new Error("Cannot generate response: prompt is empty");
      }

      const response = await localLLMService.generateResponse(prompt, options);
      
      if (!response || response.trim().length === 0) {
        throw new Error("Local LLM returned an empty response");
      }

      return response;
    } catch (error) {
      console.error(`LLM Error in ${context}:`, error);
      
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes("timeout")) {
          throw new Error(
            `Request timed out while generating ${context}. Your local LLM may be overloaded. Please try again or check your model configuration.`
          );
        }
        
        if (error.message.includes("not accessible") || error.message.includes("Cannot connect") || error.message.includes("ECONNREFUSED")) {
          throw new Error(
            `Cannot connect to your local LLM for ${context}. Please check:\n` +
            `1. Ollama is running: ollama serve\n` +
            `2. Set LOCAL_LLM_URL to your machine's IP (not localhost): http://YOUR_IP:11434\n` +
            `3. Your model "${process.env.LOCAL_LLM_MODEL || 'llama3.1:8b'}" is available: ollama list\n` +
            `4. Your firewall allows connections on port 11434\n` +
            `5. Ollama is configured to accept external connections\n` +
            `Current URL: ${process.env.LOCAL_LLM_URL || 'http://localhost:11434'}`
          );
        }
        
        if (error.message.includes("model") && error.message.includes("not")) {
          throw new Error(
            `Model "${process.env.LOCAL_LLM_MODEL || 'llama3.1:8b'}" is not available. ` +
            `Please check your model name or pull the model using: ollama pull ${process.env.LOCAL_LLM_MODEL || 'llama3.1:8b'}`
          );
        }
        
        if (error.message.includes("too long")) {
          throw new Error(
            `The ${context} prompt is too long for your model. Please try with shorter content or increase your model's context window.`
          );
        }
      }
      
      // Generic fallback error
      throw new Error(
        `Failed to generate ${context} using your local LLM. Please check your connection and model configuration. Original error: ${error.message}`
      );
    }
  }

  /**
   * Wrapper for generateEmbedding with enhanced error handling
   */
  static async generateEmbedding(
    text: string,
    context: string = "document processing"
  ): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error("Cannot generate embedding: text is empty");
      }

      return await localLLMService.generateEmbedding(text);
    } catch (error) {
      console.warn(`Embedding generation failed in ${context}, using fallback:`, error);
      
      // Always fall back to local embedding for embeddings
      // This ensures the system continues to work even if the LLM doesn't support embeddings
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate a deterministic fallback embedding
   */
  private static generateFallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const embedding = new Array(768).fill(0);

    // Enhanced hash-based embedding
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;

      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
      }

      // Distribute hash across embedding dimensions
      for (let k = 0; k < 10 && k < embedding.length; k++) {
        embedding[(hash + k * 77) % embedding.length] += (hash % 1000) / 1000;
      }
    }

    // Normalize the embedding
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  /**
   * Get service status with user-friendly messages
   */
  static async getServiceStatus(): Promise<{
    status: string;
    message: string;
    details: any;
  }> {
    try {
      const status = await localLLMService.getStatus();
      
      if (!status.connected) {
        return {
          status: "disconnected",
          message: "Your local LLM is not accessible. Please check your connection and configuration.",
          details: status
        };
      }
      
      if (!status.modelAvailable) {
        return {
          status: "model_unavailable",
          message: `Your configured model "${status.model}" is not available. Available models: ${status.availableModels.join(", ")}`,
          details: status
        };
      }
      
      return {
        status: "ready",
        message: `Local LLM is ready using model "${status.model}"`,
        details: status
      };
    } catch (error) {
      return {
        status: "error",
        message: `Failed to check LLM status: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Test the connection with detailed feedback
   */
  static async testConnection(): Promise<{
    success: boolean;
    message: string;
    recommendations?: string[];
  }> {
    try {
      const connected = await localLLMService.testConnection();
      
      if (!connected) {
        return {
          success: false,
          message: "Cannot connect to your local LLM",
          recommendations: [
            "Start Ollama: ollama serve",
            "Set LOCAL_LLM_URL to your machine's IP: http://YOUR_IP:11434 (not localhost)",
            "Configure Ollama for external access: OLLAMA_HOST=0.0.0.0 ollama serve",
            "Ensure port 11434 is open in your firewall",
            "Verify Replit can reach your machine's IP address",
            "Test connection: curl http://YOUR_IP:11434/api/tags"
          ]
        };
      }
      
      const models = await localLLMService.getAvailableModels();
      const configuredModel = process.env.LOCAL_LLM_MODEL || "llama3.1:8b";
      
      if (!models.includes(configuredModel)) {
        return {
          success: false,
          message: `Connected but model "${configuredModel}" not found`,
          recommendations: [
            `Pull your model: ollama pull ${configuredModel}`,
            `Or choose from available models: ${models.join(", ")}`,
            "Update your LOCAL_LLM_MODEL environment variable"
          ]
        };
      }
      
      return {
        success: true,
        message: `Successfully connected to local LLM with model "${configuredModel}"`
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        recommendations: [
          "Check your network connection",
          "Verify Ollama is running",
          "Check your LOCAL_LLM_URL configuration"
        ]
      };
    }
  }
}

export const llmErrorHandler = LLMErrorHandler;