// Quick test script for ngrok connection
const testNgrokConnection = async () => {
  const url = "https://e95d8e25239a.ngrok-free.app/api/tags";
  
  try {
    console.log("Testing ngrok connection...");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "Denyse-AI-Assistant/1.0"
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    console.log("Response status:", response.status);
    if (response.ok) {
      const data = await response.json();
      console.log("Available models:", data.models?.map(m => m.name) || "None");
    } else {
      console.log("Response not OK:", await response.text());
    }
  } catch (error) {
    console.log("Connection error:", error.message);
  }
};

testNgrokConnection();