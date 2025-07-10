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
      maxTokens: parseInt(process.env.LOCAL_LLM_MAX_TOKENS || "256"),
      timeout: parseInt(process.env.LOCAL_LLM_TIMEOUT || "120000"), // Increased to 2 minutes
      retries: parseInt(process.env.LOCAL_LLM_RETRIES || "2"),
    };
    console.log(
      `[LocalLLM] Configured with URL: ${this.config.baseURL}, Model: ${this.config.model}`,
    );
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
      console.log(`[LocalLLM] Making request to: ${url}`);
      console.log(
        `[LocalLLM] Request options:`,
        JSON.stringify(options, null, 2),
      );

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(
        `[LocalLLM] Response status: ${response.status} ${response.statusText}`,
      );
      console.log(
        `[LocalLLM] Response headers:`,
        Object.fromEntries(response.headers.entries()),
      );

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      console.error(
        `[LocalLLM] Request failed (attempt ${retryCount + 1}):`,
        error,
      );

      if (retryCount < (this.config.retries || 2)) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff with max 5s
        console.warn(
          `[LocalLLM] Retrying in ${delay}ms... (${retryCount + 1}/${this.config.retries})`,
        );
        await this.delay(delay);
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

    console.log(
      `[LocalLLM] Generating response for prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}"`,
    );

    // Check connection if needed
    if (!this.isConnected || this.shouldCheckConnection()) {
      console.log(
        `[LocalLLM] Checking connection to ${this.config.baseURL}...`,
      );
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
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          num_predict: Math.min(
            options.maxTokens ?? this.config.maxTokens ?? 256,
            1000,
          ),
          top_k: options.topK ?? 40,
          top_p: options.topP ?? 0.95,
          stop: options.stop,
        },
      };

      console.log(
        `[LocalLLM] Request body:`,
        JSON.stringify(requestBody, null, 2),
      );

      const response = await this.makeRequest(
        `${this.config.baseURL}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "Denyse-AI-Assistant/1.0",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LocalLLM] API Error Response:`, errorText);
        throw new Error(
          `Local LLM API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const responseText = await response.text();
      console.log(`[LocalLLM] Raw response:`, responseText);

      let data: OllamaGenerateResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[LocalLLM] Failed to parse JSON response:`, parseError);
        throw new Error(
          `Invalid JSON response from local LLM: ${responseText}`,
        );
      }

      if (!data.response && data.response !== "") {
        console.error(`[LocalLLM] No response field in data:`, data);
        throw new Error("No response received from local LLM");
      }

      console.log(`[LocalLLM] Generated response: "${data.response}"`);
      return data.response;
    } catch (error) {
      console.error("[LocalLLM] Generation error:", error);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Request timed out after ${this.config.timeout}ms`);
        }
        if (
          error.message.includes("fetch") ||
          error.message.includes("network") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND")
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
   * Test connection with detailed logging
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(
        `[LocalLLM] Testing connection to ${this.config.baseURL}/api/tags...`,
      );

      const response = await this.makeRequest(
        `${this.config.baseURL}/api/tags`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        },
      );

      this.isConnected = response.ok;
      this.lastConnectionCheck = Date.now();

      if (response.ok) {
        console.log(`[LocalLLM] Connection successful!`);
        const data = await response.json();
        console.log(
          `[LocalLLM] Available models:`,
          data.models?.map((m) => m.name) || [],
        );
      } else {
        console.error(
          `[LocalLLM] Connection failed: ${response.status} ${response.statusText}`,
        );
      }

      return this.isConnected;
    } catch (error) {
      console.error("[LocalLLM] Connection test failed:", error);
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
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        },
      );

      if (!response.ok) {
        console.error(
          `[LocalLLM] Failed to get models: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      const data: OllamaTagsResponse = await response.json();
      const models = data.models?.map((model) => model.name) || [];
      console.log(`[LocalLLM] Available models:`, models);
      return models;
    } catch (error) {
      console.error("[LocalLLM] Error fetching available models:", error);
      return [];
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName?: string): Promise<OllamaModel | null> {
    try {
      const response = await this.makeRequest(
        `${this.config.baseURL}/api/tags`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data: OllamaTagsResponse = await response.json();
      const targetModel = modelName || this.config.model;
      return data.models.find((model) => model.name === targetModel) || null;
    } catch (error) {
      console.error("[LocalLLM] Error fetching model info:", error);
      return null;
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName?: string): Promise<boolean> {
    const models = await this.getAvailableModels();
    const targetModel = modelName || this.config.model;
    const available = models.includes(targetModel);
    console.log(`[LocalLLM] Model "${targetModel}" available: ${available}`);
    return available;
  }

  /**
   * Get service status with detailed information
   */
  async getStatus(): Promise<{
    connected: boolean;
    baseURL: string;
    model: string;
    modelAvailable: boolean;
    availableModels: string[];
    lastError?: string;
  }> {
    let lastError: string | undefined;

    try {
      const connected = await this.testConnection();
      const availableModels = connected ? await this.getAvailableModels() : [];
      const modelAvailable = availableModels.includes(this.config.model);

      return {
        connected,
        baseURL: this.config.baseURL,
        model: this.config.model,
        modelAvailable,
        availableModels,
        lastError,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      return {
        connected: false,
        baseURL: this.config.baseURL,
        model: this.config.model,
        modelAvailable: false,
        availableModels: [],
        lastError,
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LocalLLMConfig>): void {
    console.log(`[LocalLLM] Updating config:`, newConfig);
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
      console.log(`[LocalLLM] Getting details for model: ${targetModel}`);

      const response = await this.makeRequest(
        `${this.config.baseURL}/api/show`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ name: targetModel }),
        },
      );

      if (!response.ok) {
        console.error(
          `[LocalLLM] Failed to get model details: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const data = await response.json();
      console.log(`[LocalLLM] Model details:`, data);

      return {
        name: data.name || targetModel,
        size: data.size || "Unknown",
        digest: data.digest || "Unknown",
        modified: data.modified_at || "Unknown",
        template: data.template || "Unknown",
        parameters: data.parameters || {},
        modelfile: data.modelfile || "Unknown",
      };
    } catch (error) {
      console.error(
        `[LocalLLM] Error fetching model details for ${modelName}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Validate that the configured model is available and working
   */
  async validateModel(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      console.log(`[LocalLLM] Validating model: ${this.config.model}`);

      // Check if model is available
      const availableModels = await this.getAvailableModels();
      if (!availableModels.includes(this.config.model)) {
        return {
          success: false,
          message: `Model "${this.config.model}" not found. Available models: ${availableModels.join(", ") || "None"}. Please run: ollama pull ${this.config.model}`,
        };
      }

      // Test the model with a simple request
      try {
        console.log(`[LocalLLM] Testing model with simple request...`);
        const testResponse = await this.generateResponse(
          "Hello! Please respond with just 'Hi'",
          {
            temperature: 0.1,
            maxTokens: 50,
          },
        );

        if (!testResponse || testResponse.trim() === "") {
          return {
            success: false,
            message: `Model "${this.config.model}" is available but not responding properly. Check your Ollama service.`,
          };
        }

        // Get model details
        const modelDetails = await this.getModelDetails(this.config.model);

        return {
          success: true,
          message: `Model "${this.config.model}" is working properly. Response: "${testResponse.trim()}"`,
          details: modelDetails,
        };
      } catch (testError) {
        console.error(`[LocalLLM] Model test failed:`, testError);
        return {
          success: false,
          message: `Model "${this.config.model}" test failed: ${testError.message}`,
        };
      }
    } catch (error) {
      console.error(`[LocalLLM] Model validation error:`, error);
      return {
        success: false,
        message: `Error validating model "${this.config.model}": ${error.message}`,
      };
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
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            model: this.config.model,
            prompt: text,
          }),
        },
      );

      if (!response.ok) {
        console.warn("[LocalLLM] Embeddings not available, using fallback");
        return this.generateFallbackEmbedding(text);
      }

      const data = await response.json();
      return data.embedding || this.generateFallbackEmbedding(text);
    } catch (error) {
      console.warn("[LocalLLM] Embedding error, using fallback:", error);
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
   * Health check method to diagnose issues
   */
  async healthCheck(): Promise<{
    overall: "healthy" | "unhealthy" | "degraded";
    checks: {
      connection: boolean;
      modelAvailable: boolean;
      canGenerate: boolean;
    };
    details: any;
  }> {
    console.log(`[LocalLLM] Starting health check...`);

    const checks = {
      connection: false,
      modelAvailable: false,
      canGenerate: false,
    };

    let details: any = {};

    try {
      // Test connection
      checks.connection = await this.testConnection();
      if (!checks.connection) {
        details.connectionError = "Failed to connect to Ollama service";
      }

      // Check if model is available
      if (checks.connection) {
        checks.modelAvailable = await this.isModelAvailable();
        if (!checks.modelAvailable) {
          const availableModels = await this.getAvailableModels();
          details.modelError = `Model "${this.config.model}" not available. Available: ${availableModels.join(", ")}`;
        }
      }

      // Test generation
      if (checks.connection && checks.modelAvailable) {
        try {
          const testResponse = await this.generateResponse("Test", {
            maxTokens: 10,
          });
          checks.canGenerate = testResponse && testResponse.trim().length > 0;
          details.testResponse = testResponse;
        } catch (genError) {
          details.generationError = genError.message;
        }
      }

      let overall: "healthy" | "unhealthy" | "degraded" = "unhealthy";
      if (checks.connection && checks.modelAvailable && checks.canGenerate) {
        overall = "healthy";
      } else if (checks.connection && checks.modelAvailable) {
        overall = "degraded";
      }

      console.log(`[LocalLLM] Health check completed:`, { overall, checks });

      return { overall, checks, details };
    } catch (error) {
      console.error(`[LocalLLM] Health check failed:`, error);
      return {
        overall: "unhealthy",
        checks,
        details: { error: error.message },
      };
    }
  }
}

export const localLLMService = new LocalLLMService();
