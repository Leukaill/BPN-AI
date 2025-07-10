// Test simple generation with Gemma model
const testGeneration = async () => {
  const url = "https://e95d8e25239a.ngrok-free.app/api/generate";
  
  try {
    console.log("Testing simple generation with Gemma...");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "Denyse-AI-Assistant/1.0"
      },
      body: JSON.stringify({
        model: "gemma3:latest",
        prompt: "Hi",
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 20  // Very short response
        }
      }),
      signal: AbortSignal.timeout(60000) // 1 minute timeout
    });
    
    console.log("Response status:", response.status);
    if (response.ok) {
      const data = await response.json();
      console.log("Generated text:", data.response);
      console.log("Success! Model is working.");
    } else {
      console.log("Response not OK:", response.status, await response.text());
    }
  } catch (error) {
    console.log("Generation error:", error.message);
  }
};

testGeneration();