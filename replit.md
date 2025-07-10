# Denyse - BPN AI Assistant

## Overview

This is a modern, luxurious AI chatbot application built for internal use at BPN organization. The application features a Gemini-inspired interface with BPN brand colors, document upload capabilities, and AI-powered chat functionality. Denyse is designed to be a secure, premium AI assistant that can process documents, answer questions, and help with report writing.

## User Preferences

Preferred communication style: Simple, everyday language. User prefers more natural, ChatGPT-like responses - conversational, helpful, and engaging while maintaining professionalism.

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

### Recent Changes (January 2025)

### Document Processing System Upgrade ✅
- **Advanced Chunking System**: Implemented intelligent text chunking with 1000-character chunks and 200-character overlap
- **Vector Embeddings**: Full Google Gemini integration for semantic search using cosine similarity
- **Robust Error Handling**: Added timeouts, batch processing, and fallback mechanisms to prevent crashes
- **Performance Optimization**: Batched embedding generation and memory-based chunk storage
- **Enhanced File Support**: Improved PDF, DOCX, DOC, and TXT processing with dynamic imports

### Core Workflow Implementation ✅
1. **Upload → Extract text** (pdf-parse, mammoth libraries)
2. **Process → Chunk + embed + store** (intelligent chunking with overlap)
3. **Query → Find similar chunks → Generate response** (vector similarity search)

### Future Enhancements
- **Microsoft Graph Integration** - SharePoint and OneDrive support
- **Local LLM Support** - Ollama integration for offline AI
- **Toggle modes** - Switch between online and local AI
- **Vector Database** - Upgrade from memory storage to persistent vector DB