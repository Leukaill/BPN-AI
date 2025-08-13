# Deployment Guide

## Production Environment Setup

### Required Environment Variables

```bash
DATABASE_URL=postgresql://username:password@hostname:port/database
NODE_ENV=production
SESSION_SECRET=your-secure-random-string-here
PORT=5000
```

### Optional Environment Variables

```bash
# AI Service Configuration
LOCAL_LLM_URL=https://your-llm-service.com
LOCAL_LLM_MODEL=gemma3:latest
OPENROUTER_API_KEY=your-openrouter-key
HUGGINGFACE_API_KEY=your-huggingface-key

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
UPLOAD_RATE_LIMIT_MAX=10
MAX_FILE_SIZE=52428800
```

## Deployment Options

### 1. Render.com (Recommended)

1. Fork/clone this repository to your GitHub
2. Connect your GitHub repository to Render
3. Use the included `render.yaml` configuration
4. Set environment variables in Render dashboard:
   - `DATABASE_URL` (from your PostgreSQL database)
   - `SESSION_SECRET` (generate a secure random string)
5. Deploy!

### 2. Railway

1. Connect your GitHub repository to Railway
2. Add a PostgreSQL database service
3. Set environment variables:
   ```bash
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   SESSION_SECRET=your-secure-session-secret
   NODE_ENV=production
   ```
4. Deploy using build command: `npm run build`
5. Start command: `npm start`

### 3. Vercel (with external database)

1. Connect repository to Vercel
2. Set up external PostgreSQL (Neon, Supabase, etc.)
3. Configure environment variables
4. Build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 4. Docker

1. Build the Docker image:
   ```bash
   docker build -t denyse-ai .
   ```

2. Run the container:
   ```bash
   docker run -p 5000:5000 \
     -e DATABASE_URL=your-database-url \
     -e SESSION_SECRET=your-session-secret \
     -e NODE_ENV=production \
     denyse-ai
   ```

### 5. Manual VPS Deployment

1. Clone repository on your server
2. Install Node.js 20+
3. Install dependencies: `npm install`
4. Set environment variables
5. Build: `npm run build`
6. Start with PM2:
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name denyse-ai
   pm2 save
   pm2 startup
   ```

## Database Setup

### Using Neon (Recommended for serverless)

1. Create account at neon.tech
2. Create new project
3. Copy connection string to `DATABASE_URL`
4. Run migrations: `npm run db:push`

### Using Railway PostgreSQL

1. Add PostgreSQL service in Railway
2. Use `${{Postgres.DATABASE_URL}}` as DATABASE_URL
3. Migrations run automatically on deployment

### Using Supabase

1. Create project at supabase.com
2. Go to Settings > Database
3. Copy connection string (transaction mode)
4. Set as DATABASE_URL environment variable

## Troubleshooting

### Database Connection Issues
- Ensure DATABASE_URL includes all required parameters
- Check if database accepts connections from your deployment platform
- Verify SSL requirements (most cloud databases require SSL)

### Build Failures
- Check Node.js version (requires 18+)
- Ensure all dependencies are in package.json
- Verify TypeScript compilation with `npm run check`

### Runtime Issues
- Check application logs for detailed error messages
- Verify all required environment variables are set
- Ensure port 5000 is accessible (or configure PORT variable)

## Production Checklist

- [ ] DATABASE_URL configured with production database
- [ ] SESSION_SECRET set to secure random string
- [ ] NODE_ENV=production
- [ ] SSL/TLS enabled (handled by platform)
- [ ] Database migrations applied
- [ ] File uploads working (check disk space/permissions)
- [ ] Error monitoring configured
- [ ] Backup strategy for database
- [ ] Domain/DNS configured (if custom domain)

## Security Notes

- Never commit real environment variables to git
- Use strong, unique SESSION_SECRET
- Keep dependencies updated
- Monitor for security vulnerabilities
- Use HTTPS in production
- Implement proper rate limiting
- Regular database backups