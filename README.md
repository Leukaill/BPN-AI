# Denyse AI Assistant

A luxurious AI chatbot application designed for intelligent document processing and Monitoring & Evaluation (M&E) report generation.

## Features

- 🤖 Specialized M&E AI Assistant with interactive questioning
- 📄 Document processing (PDF, DOCX, DOC, TXT, HTML, MD, CSV, RTF, JSON)
- 💬 Intelligent chat with document context
- 📊 Professional M&E report generation (6 types)
- 🔐 Secure authentication and file management
- 🎨 Modern, responsive UI with Gemini-inspired design
- ⬇️ Downloadable content in multiple formats

## Quick Start

### Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (copy `.env.example` to `.env`)
4. Push database schema: `npm run db:push`
5. Start development server: `npm run dev`

### Production Deployment

#### Deploy to Render

1. Connect your GitHub repository to Render
2. Use the included `render.yaml` configuration
3. Set your environment variables in Render dashboard
4. Deploy!

#### Manual Deployment

1. Build the application: `npm run build`
2. Set environment variables
3. Start the production server: `npm start`

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secure session secret

Optional:
- `LOCAL_LLM_URL` - Local LLM service URL
- `OPENROUTER_API_KEY` - OpenRouter API key
- `HUGGINGFACE_API_KEY` - HuggingFace API key

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: shadcn/ui components with custom theming
- **Authentication**: Passport.js with local strategy

## License

MIT License