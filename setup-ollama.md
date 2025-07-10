# Setting Up Ollama for Replit Access

Your Denyse AI Assistant needs to connect to your local Ollama service. Since Replit runs in the cloud, you need to configure Ollama to accept external connections.

## 1. Start Ollama with External Access

Instead of just running `ollama serve`, use:

```bash
OLLAMA_HOST=0.0.0.0 ollama serve
```

This tells Ollama to listen on all network interfaces, not just localhost.

## 2. Find Your Machine's IP Address

**On Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**On Mac/Linux:**
```bash
ifconfig
```
Look for your IP address (usually starts with 192.168.x.x or 10.x.x.x).

**Alternative method:**
```bash
curl ifconfig.me
```
This shows your public IP (use only if on same network as Replit).

## 3. Set Environment Variable in Replit

In your Replit project, go to the "Secrets" tab and add:

- **Key:** `LOCAL_LLM_URL`
- **Value:** `http://YOUR_IP_ADDRESS:11434`

Replace `YOUR_IP_ADDRESS` with the IP you found in step 2.

## 4. Pull Llama 3.1 8B Model

Make sure you have the model:

```bash
ollama pull llama3.1:8b
```

Verify it's available:
```bash
ollama list
```

## 5. Test Connection

You can test if everything works by running this in your terminal:

```bash
curl http://YOUR_IP_ADDRESS:11434/api/tags
```

This should return a JSON response with your available models.

## 6. Configure Firewall (if needed)

Make sure port 11434 is open in your firewall:

**Windows:**
- Open Windows Defender Firewall
- Allow an app through firewall
- Add port 11434

**Mac:**
- System Preferences > Security & Privacy > Firewall
- Add port 11434

**Linux:**
```bash
sudo ufw allow 11434
```

## Troubleshooting

If you're still having connection issues:

1. **Check if Ollama is running:**
   ```bash
   ps aux | grep ollama
   ```

2. **Verify the service is listening on all interfaces:**
   ```bash
   netstat -an | grep 11434
   ```
   You should see `0.0.0.0:11434` not `127.0.0.1:11434`

3. **Test locally first:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

4. **Test from another machine on your network:**
   ```bash
   curl http://YOUR_IP:11434/api/tags
   ```

Once you've completed these steps, your Denyse AI Assistant in Replit should be able to connect to your local Llama 3.1 8B model!