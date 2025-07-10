# Denyse - BPN AI Assistant

## Overview

This is a modern, luxurious AI chatbot application built for internal use at BPN organization. The application features a Gemini-inspired interface with BPN brand colors, document upload capabilities, and AI-powered chat functionality. Denyse is designed to be a secure, premium AI assistant that can process documents, answer questions, and help with report writing.

## User Preferences

Preferred communication style: Simple, everyday language. User prefers more natural, ChatGPT-like responses - conversational, helpful, and engaging while maintaining professionalism.

M&E Focus: User specifically requested AI to be specialized in Monitoring & Evaluation (M&E) rather than general business analysis. Reports should focus on M&E best practices, frameworks, outcomes, indicators, and impact assessment.

Interactive Questioning: User wants AI to proactively ask clarifying questions before generating reports to better understand user needs and create more targeted, valuable outputs. This should be implemented with "highest creativity" to make the feature exceptional.

## System Architecture

### Full-Stack Architecture
The application uses a modern full-stack TypeScript architecture with:
- **Frontend**: React + Vite with TypeScript
- **Backend**: Node.js + Express with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Passport.js with local strategy
- **State Management**: TanStack Query for server state

### Project Structure
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript schemas and types
- `components.json` - shadcn/ui configuration
- `drizzle.config.ts` - Database configuration

## Key Components

### Frontend Architecture
- **React with TypeScript** - Main frontend framework
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Component library with custom BPN theming
- **TanStack Query** - Server state management
- **Wouter** - Lightweight routing library

### Backend Architecture
- **Express.js** - Web application framework
- **TypeScript** - Type safety throughout the stack
- **Drizzle ORM** - Type-safe database operations
- **Passport.js** - Authentication middleware
- **Multer** - File upload handling
- **Session management** - PostgreSQL session store

### Database Schema
Key entities include:
- **Users** - Authentication and user management
- **Chats** - Chat sessions with titles and metadata
- **Messages** - Individual chat messages with role (user/assistant)
- **Documents** - Uploaded files with text extraction and embeddings
- **BPN Knowledge** - Scraped website content from bpn.rw

### UI/UX Design
- **BPN Brand Colors**: Turquoise (#00728e), Green (#a8cb63), Grey (#e3e3e3)
- **Liquid Glass Effects** - Custom glassmorphism components
- **Google Gemini-inspired Layout** - Left sidebar with main chat area
- **Responsive Design** - Mobile-first approach
- **Smooth Animations** - Floating elements and morphing effects

## Data Flow

### Authentication Flow
1. User registration/login via Passport.js local strategy
2. Session management with PostgreSQL store
3. Protected routes requiring authentication
4. Password hashing with scrypt

### Chat Flow
1. User creates new chat or selects existing chat
2. Messages sent through REST API to backend
3. AI service processes message with document context
4. Response generated using external AI APIs (OpenRouter/HuggingFace)
5. Messages stored in database with metadata

### Document Processing Flow
1. File upload via multer middleware
2. Document validation (PDF, DOCX, DOC, TXT)
3. Text extraction using pdf-parse/mammoth
4. Embedding generation for semantic search
5. Document expires after 48 hours for security

### Web Scraping Flow
1. Automated scraping of bpn.rw website
2. Content extraction using cheerio
3. Storage in bpn_knowledge table
4. Embedding generation for context retrieval

## External Dependencies

### AI Integration
- **OpenRouter API** - Primary AI service for chat responses
- **HuggingFace API** - Alternative AI service
- **Future Integration** - Planned local LLM support (Ollama)

### Document Processing
- **pdf-parse** - PDF text extraction
- **mammoth** - DOCX document processing
- **cheerio** - Web scraping and HTML parsing

### Database
- **Neon Database** - PostgreSQL hosting
- **Drizzle ORM** - Database operations and migrations
- **connect-pg-simple** - PostgreSQL session store

### UI Libraries
- **Radix UI** - Headless UI components
- **Tailwind CSS** - Styling framework
- **Lucide React** - Icon library
- **TanStack Query** - Data fetching and caching

## Deployment Strategy

### Development Environment
- **Vite Dev Server** - Hot module replacement
- **tsx** - TypeScript execution for development
- **Concurrent development** - Frontend and backend running together

### Production Build
- **Vite Build** - Optimized frontend bundle
- **esbuild** - Backend bundling for production
- **Static file serving** - Express serves built frontend

### Database Management
- **Drizzle Kit** - Database migrations and schema management
- **Environment variables** - Secure configuration management
- **Connection pooling** - Efficient database connections

### Security Considerations
- **Local data storage** - All user data stays on premises
- **Session security** - Secure session management
- **File validation** - Strict file type and size limits
- **Document expiration** - 48-hour automatic cleanup
- **Future offline capability** - Designed for local LLM integration

## Recent Changes (July 2025)

### Migration from Replit Agent to Replit Environment ✅
- **Database Setup**: Successfully migrated PostgreSQL database with all required tables
- **Knowledge Base Import**: Fixed document processing libraries (pdf-parse, mammoth) with proper dynamic loading
- **File Processing**: Fully functional PDF, DOCX, DOC, and TXT file processing for knowledge base
- **AI Integration**: Google Generative AI API properly configured for embeddings and responses
- **Security**: All authentication and file upload security measures properly implemented
- **Performance**: Document processing now handles large files efficiently with proper error handling

### AI Response Formatting Enhancement ✅
- **Clean Text Output**: Enhanced AI service to remove asterisks (*) from responses for better readability
- **Improved Formatting**: Added automatic response cleanup to ensure clean, professional text output
- **Better User Experience**: Responses now use natural, flowing text without markdown-style formatting
- **Consistent Styling**: Both chat responses and report generation now produce clean, readable text

### Enhanced Document Processing System ✅
- **Fixed PDF Text Extraction**: Resolved PDF binary data issues with improved validation and error handling
- **Enhanced File Upload System**: Increased file size limit to 50MB and added support for more file types
- **Improved Search Algorithm**: Lowered search thresholds for better document discovery and more inclusive results
- **Better AI Responses**: Enhanced context building to provide detailed answers with actual document content
- **Robust Error Handling**: Added comprehensive fallback mechanisms for document processing

### Advanced Message Formatting System ✅
- **Intelligent Paragraph Breaking**: Automatically breaks long AI responses into readable paragraphs
- **Smart Content Recognition**: Identifies headers, subheadings, numbered sections, and list items
- **Enhanced Visual Hierarchy**: Improved spacing, font weights, and color coding for different content types
- **Responsive Design**: Better text layout with proper line spacing and justified text alignment
- **Professional Styling**: Clean, modern appearance with BPN brand colors and consistent formatting

### Downloadable Content Generation System ✅
- **Automatic Download Detection**: AI recognizes when users request downloadable files
- **Multiple Format Support**: Generate files in TXT, HTML, Markdown, JSON, and CSV formats
- **Smart Filename Generation**: Automatically extracts meaningful filenames from user requests
- **Secure Download Links**: Temporary download URLs with 1-hour expiration for security
- **Interactive Download Components**: Beautiful download buttons with progress indicators and file information
- **Professional File Formatting**: Generated files include proper headers, timestamps, and BPN branding

### Recent Changes (January 2025)

### Enhanced Upload System & Security Overhaul ✅
- **Advanced Error Handling**: Custom error classes (ValidationError, ProcessingError, AIServiceError) with detailed user feedback
- **Rate Limiting**: API-wide (100 req/15min) and upload-specific (10 uploads/15min) protection against abuse
- **File Security**: Directory traversal protection, UUID filename generation, malicious content detection
- **Enhanced File Support**: Expanded to 50MB limit with support for PDF, DOCX, DOC, TXT, HTML, MD, CSV, RTF, JSON
- **Improved User Experience**: Real-time error messages, upload progress tracking, success notifications
- **Robust Validation**: Server-side file validation with MIME type and extension checking

### Document Processing System Upgrade ✅
- **Advanced Chunking System**: Implemented intelligent text chunking with 1000-character chunks and 200-character overlap
- **Vector Embeddings**: Full Google Gemini integration for semantic search using cosine similarity
- **Robust Error Handling**: Added timeouts, batch processing, and fallback mechanisms to prevent crashes
- **Performance Optimization**: Batched embedding generation and memory-based chunk storage
- **Enhanced File Support**: Improved PDF, DOCX, DOC, and TXT processing with dynamic imports

### Core Workflow Implementation ✅
1. **Upload → Validate & Secure** (enhanced security with rate limiting and malicious content detection)
2. **Extract → Process text** (pdf-parse, mammoth libraries with fallback mechanisms)
3. **Chunk → Embed → Store** (intelligent chunking with overlap and vector embeddings)
4. **Query → Search → Generate** (vector similarity search with contextual AI responses)

### AI Intelligence & M&E Expertise Overhaul ✅
- **M&E Specialization**: Complete transformation from generic business analysis to specialized Monitoring & Evaluation expertise
- **Professional M&E Report Generation**: Six specialized report types (baseline, progress, outcome, impact, evaluation, framework assessment)
- **OECD-DAC Evaluation Standards**: Integration of international evaluation criteria and best practices
- **Intelligent Questioning System**: Proactive clarifying questions before report generation to ensure targeted, valuable outputs
- **Context-Aware Report Types**: Automatic detection of report type based on user requests and document content
- **Enhanced Report Templates**: Professional M&E report structures with executive summaries, findings, recommendations, and implementation steps

### Interactive Questioning Feature ✅
- **Contextual Question Generation**: AI analyzes user requests and documents to generate relevant clarifying questions
- **Stakeholder-Focused Questions**: Questions tailored to different audiences (donors, management, beneficiaries, government partners)
- **Report-Type Specific Questions**: Specialized questions for baseline, progress, outcome, impact, evaluation, and framework assessments
- **Intelligent Follow-up**: Dynamic follow-up questions based on user responses for deeper customization
- **User Choice Options**: Users can answer questions for customized reports or skip questions for standard reports
- **Professional Question Categories**: Questions organized by M&E categories (stakeholder, scope, methodology, indicators, timeline, resources, context)

### Local LLM Integration (July 2025) ✅
- **Local Llama 3.1 8B Support**: Complete migration from Google Gemini to local Llama 3.1 8B model
- **Ollama API Integration**: Full support for local LLM API calls with configurable endpoints
- **Environment Configuration**: LOCAL_LLM_URL and LOCAL_LLM_MODEL environment variables for customization
- **Connection Testing**: Built-in API endpoint `/api/llm/test` to verify local LLM connectivity and available models
- **Enhanced Privacy**: All AI processing now happens locally without external API dependencies
- **Fallback Embeddings**: Local embedding generation with automatic fallback mechanisms

### Configuration for Local LLM
- **Default URL**: http://localhost:11434 (standard Ollama port)
- **Default Model**: llama3.1:8b
- **API Endpoints**: Compatible with Ollama API format
- **Test Endpoint**: GET /api/llm/test (requires authentication)

### Future Enhancements
- **Microsoft Graph Integration** - SharePoint and OneDrive support
- **Vector Database** - Upgrade from memory storage to persistent vector DB
- **Model Management** - Dynamic model switching and management interface