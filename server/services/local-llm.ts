interface LocalLLMConfig {
  baseURL: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options: {
    temperature: number;
    num_predict: number;
    top_k: number;
    top_p: number;
    stop?: string[];
  };
}

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

class LocalLLMService {
  private config: LocalLLMConfig;
  private isConnected: boolean = false;
  private lastConnectionCheck: number = 0;
  private connectionCheckInterval: number = 30000; // 30 seconds

  constructor() {
    this.config = {
      baseURL: process.env.LOCAL_LLM_URL || "http://localhost:11434",
      model: process.env.LOCAL_LLM_MODEL || "llama3.1:8b",
      temperature: parseFloat(process.env.LOCAL_LLM_TEMPERATURE || "0.7"),
      maxTokens: parseInt(process.env.LOCAL_LLM_MAX_TOKENS || "2048"),
      timeout: parseInt(process.env.LOCAL_LLM_TIMEOUT || "30000"), // 30 seconds
      retries: parseInt(process.env.LOCAL_LLM_RETRIES || "3"),
    };
    console.log(`[LocalLLM] Configured with URL: ${this.config.baseURL}, Model: ${this.config.model}`);
  }

  /**
   * Makes a request with timeout and retry logic
   */
  private async makeRequest(
    url: string,
    options: RequestInit,
    retryCount: number = 0,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (retryCount < (this.config.retries || 3)) {
        console.warn(
          `Request failed, retrying... (${retryCount + 1}/${this.config.retries})`,
        );
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.makeRequest(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validates the prompt before sending
   */
  private validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error("Prompt cannot be empty");
    }

    if (prompt.length > 50000) {
      throw new Error("Prompt too long (max 50,000 characters)");
    }
  }

  /**
   * Checks if we need to test connection again
   */
  private shouldCheckConnection(): boolean {
    const now = Date.now();
    return now - this.lastConnectionCheck > this.connectionCheckInterval;
  }

  /**
   * Generate response from local LLM with enhanced error handling
   */
  async generateResponse(prompt: string, options: any = {}): Promise<string> {
    this.validatePrompt(prompt);

    // Check connection if needed
    if (!this.isConnected || this.shouldCheckConnection()) {
      const connected = await this.testConnection();
      if (!connected) {
        throw new Error(
          `Local LLM not accessible at ${this.config.baseURL}. ` +
            `Please ensure Ollama is running and the model "${this.config.model}" is available.`,
        );
      }
    }

    try {
      const requestBody: OllamaGenerateRequest = {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || this.config.temperature || 0.7,
          num_predict: options.maxTokens || this.config.maxTokens || 2048,
          top_k: options.topK || 40,
          top_p: options.topP || 0.95,
          stop: options.stop || undefined,
        },
      };

      const response = await this.makeRequest(
        `${this.config.baseURL}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Local LLM API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data: OllamaGenerateResponse = await response.json();

      if (!data.response) {
        throw new Error("No response received from local LLM");
      }

      return data.response;
    } catch (error) {
      console.error("Local LLM API error:", error);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Request timed out after ${this.config.timeout}ms`);
        }
        if (
          error.message.includes("fetch") ||
          error.message.includes("network")
        ) {
          this.isConnected = false;
          throw new Error(
            `Cannot connect to local LLM at ${this.config.baseURL}. ` +
              `Please check if Ollama is running and accessible.`,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Generate embeddings (with better fallback)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text for embedding cannot be empty");
    }

    try {
      const response = await this.makeRequest(
        `${this.config.baseURL}/api/embeddings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            prompt: text,
          }),
        },
      );

      if (!response.ok) {
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

  /**
   * Improved fallback embedding using a simple but more effective method
   */
  private generateFallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const embedding = new Array(768).fill(0);

    // Simple hash-based embedding
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
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  /**
   * Test connection with better error reporting
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${this.config.baseURL}/api/tags`,
        { method: "GET" },
      );

      this.isConnected = response.ok;
      this.lastConnectionCheck = Date.now();

      return this.isConnected;
    } catch (error) {
      console.error("Connection test failed:", error);
      this.isConnected = false;
      this.lastConnectionCheck = Date.now();
      return false;
    }
  }

  /**
   * Get available models with better error handling
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest(
        `${this.config.baseURL}/api/tags`,
        { method: "GET" },
      );

      if (!response.ok) {
        return [];
      }

      const data: OllamaTagsResponse = await response.json();
      return data.models?.map((model) => model.name) || [];
    } catch (error) {
      console.error("Error fetching available models:", error);
      return [];
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName?: string): Promise<OllamaModel | null> {
    try {
      const models = await this.getAvailableModels();
      const targetModel = modelName || this.config.model;

      if (!models.includes(targetModel)) {
        return null;
      }

      const response = await this.makeRequest(
        `${this.config.baseURL}/api/tags`,
        { method: "GET" },
      );

      if (!response.ok) {
        return null;
      }

      const data: OllamaTagsResponse = await response.json();
      return data.models.find((model) => model.name === targetModel) || null;
    } catch (error) {
      console.error("Error fetching model info:", error);
      return null;
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName?: string): Promise<boolean> {
    const models = await this.getAvailableModels();
    const targetModel = modelName || this.config.model;
    return models.includes(targetModel);
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    connected: boolean;
    baseURL: string;
    model: string;
    modelAvailable: boolean;
    availableModels: string[];
  }> {
    const connected = await this.testConnection();
    const availableModels = connected ? await this.getAvailableModels() : [];
    const modelAvailable = availableModels.includes(this.config.model);

    return {
      connected,
      baseURL: this.config.baseURL,
      model: this.config.model,
      modelAvailable,
      availableModels,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LocalLLMConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = false; // Force reconnection check
  }

  /**
   * Get current configuration
   */
  getConfig(): LocalLLMConfig {
    return { ...this.config };
  }

  /**
   * Get detailed model information
   */
  async getModelDetails(modelName?: string): Promise<any> {
    try {
      const targetModel = modelName || this.config.model;
      
      const response = await this.makeRequest(
        `${this.config.baseURL}/api/show`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: targetModel }),
        },
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        name: data.name || targetModel,
        size: data.size || 'Unknown',
        digest: data.digest || 'Unknown',
        modified: data.modified_at || 'Unknown',
        template: data.template || 'Unknown',
        parameters: data.parameters || {},
        modelfile: data.modelfile || 'Unknown'
      };
    } catch (error) {
      console.error(`Error fetching model details for ${modelName}:`, error);
      return null;
    }
  }

  /**
   * Validate that Llama 3.1 8B is available and working
   */
  async validateLlamaModel(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // Check if llama3.1:8b is available
      const availableModels = await this.getAvailableModels();
      if (!availableModels.includes('llama3.1:8b')) {
        return {
          success: false,
          message: `Llama 3.1 8B not found. Available models: ${availableModels.join(', ') || 'None'}. Please run: ollama pull llama3.1:8b`
        };
      }

      // Test the model with a simple request
      try {
        const testResponse = await this.generateResponse("Hello", {
          temperature: 0.1,
          maxTokens: 10
        });
        
        if (!testResponse) {
          return {
            success: false,
            message: `Llama 3.1 8B is available but not responding properly. Check your Ollama service.`
          };
        }

        // Get model details
        const modelDetails = await this.getModelDetails('llama3.1:8b');

        return {
          success: true,
          message: `Llama 3.1 8B is working properly`,
          details: modelDetails
        };
      } catch (testError) {
        return {
          success: false,
          message: `Llama 3.1 8B failed test: ${testError.message}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error validating Llama 3.1 8B: ${error.message}`
      };
    }
  }
}

export const localLLMService = new LocalLLMService();
