import { localLLMService } from "./local-llm";
import { llmErrorHandler } from "./llm-error-handler";

/**
 * Comprehensive connection test and diagnostics for Local LLM
 */
export class LLMConnectionTest {
  /**
   * Run a comprehensive test of the local LLM connection
   */
  static async runFullTest(): Promise<{
    overall: "success" | "warning" | "failure";
    results: any;
    recommendations: string[];
  }> {
    const results: any = {
      connection: null,
      models: null,
      modelAvailability: null,
      responseGeneration: null,
      embeddings: null,
      performance: null
    };

    const recommendations: string[] = [];
    let warningCount = 0;
    let errorCount = 0;

    // Test 1: Basic Connection
    console.log("Testing basic connection...");
    try {
      const startTime = Date.now();
      const connected = await localLLMService.testConnection();
      const connectionTime = Date.now() - startTime;
      
      results.connection = {
        success: connected,
        responseTime: connectionTime,
        baseURL: localLLMService.getConfig().baseURL
      };

      if (!connected) {
        errorCount++;
        recommendations.push("Ensure Ollama is running: ollama serve");
        recommendations.push("Check if your LOCAL_LLM_URL is accessible from Replit");
      } else if (connectionTime > 5000) {
        warningCount++;
        recommendations.push("Connection is slow. Consider using a faster network or local endpoint");
      }
    } catch (error) {
      errorCount++;
      results.connection = { success: false, error: error.message };
      recommendations.push("Connection failed. Check your network and LLM service status");
    }

    // Test 2: Model Availability
    console.log("Testing model availability...");
    try {
      const availableModels = await localLLMService.getAvailableModels();
      const configuredModel = localLLMService.getConfig().model;
      const isAvailable = availableModels.includes(configuredModel);

      results.models = {
        available: availableModels,
        configured: configuredModel,
        isConfiguredAvailable: isAvailable
      };

      if (!isAvailable) {
        errorCount++;
        recommendations.push(`Pull your model: ollama pull ${configuredModel}`);
        if (availableModels.length > 0) {
          recommendations.push(`Or use an available model: ${availableModels.slice(0, 3).join(", ")}`);
        }
      }
    } catch (error) {
      errorCount++;
      results.models = { error: error.message };
      recommendations.push("Failed to fetch available models. Check LLM service status");
    }

    // Test 3: Response Generation
    console.log("Testing response generation...");
    try {
      const testPrompt = "Say 'Hello' in exactly one word.";
      const startTime = Date.now();
      const response = await localLLMService.generateResponse(testPrompt, {
        temperature: 0.1,
        maxTokens: 10
      });
      const responseTime = Date.now() - startTime;

      results.responseGeneration = {
        success: true,
        response: response.slice(0, 50),
        responseTime: responseTime,
        promptLength: testPrompt.length,
        responseLength: response.length
      };

      if (responseTime > 30000) {
        warningCount++;
        recommendations.push("Response generation is slow. Consider using a smaller model or increasing resources");
      }

      if (!response || response.length === 0) {
        warningCount++;
        recommendations.push("Empty response received. Check model configuration");
      }
    } catch (error) {
      errorCount++;
      results.responseGeneration = { success: false, error: error.message };
      recommendations.push("Response generation failed. Check model availability and configuration");
    }

    // Test 4: Embeddings
    console.log("Testing embeddings...");
    try {
      const testText = "This is a test sentence for embedding generation.";
      const startTime = Date.now();
      const embedding = await localLLMService.generateEmbedding(testText);
      const embeddingTime = Date.now() - startTime;

      results.embeddings = {
        success: true,
        dimensions: embedding.length,
        responseTime: embeddingTime,
        sampleValues: embedding.slice(0, 5)
      };

      if (embedding.length === 768) {
        // This indicates fallback embedding was used
        warningCount++;
        recommendations.push("Using fallback embeddings. Your model may not support embeddings natively");
      }
    } catch (error) {
      warningCount++;
      results.embeddings = { success: false, error: error.message, usingFallback: true };
      recommendations.push("Embedding generation failed, using fallback method");
    }

    // Test 5: Performance Benchmark
    console.log("Running performance benchmark...");
    try {
      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          localLLMService.generateResponse(`Count to ${i + 1}`, {
            temperature: 0.1,
            maxTokens: 20
          })
        );
      }

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / 3;

      results.performance = {
        parallelRequests: 3,
        totalTime: totalTime,
        averageTime: avgTime,
        requestsPerSecond: (3000 / totalTime).toFixed(2)
      };

      if (avgTime > 15000) {
        warningCount++;
        recommendations.push("Performance is below optimal. Consider upgrading your hardware or using a smaller model");
      }
    } catch (error) {
      warningCount++;
      results.performance = { error: error.message };
      recommendations.push("Performance test failed. Check system resources and model configuration");
    }

    // Determine overall status
    let overall: "success" | "warning" | "failure";
    if (errorCount > 0) {
      overall = "failure";
    } else if (warningCount > 0) {
      overall = "warning";
    } else {
      overall = "success";
    }

    return {
      overall,
      results,
      recommendations
    };
  }

  /**
   * Quick health check
   */
  static async quickCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    message: string;
    details: any;
  }> {
    try {
      const status = await llmErrorHandler.getServiceStatus();
      
      if (status.status === "ready") {
        return {
          status: "healthy",
          message: "Local LLM is functioning properly",
          details: status.details
        };
      } else if (status.status === "model_unavailable") {
        return {
          status: "degraded",
          message: status.message,
          details: status.details
        };
      } else {
        return {
          status: "unhealthy",
          message: status.message,
          details: status.details
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Health check failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }
}

export const llmConnectionTest = LLMConnectionTest;