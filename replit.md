# Denyse AI Assistant

## Overview
Denyse is a luxurious AI chatbot application designed for intelligent document processing and report generation, specifically specializing in Monitoring & Evaluation (M&E). It offers a secure, premium AI assistant experience with document upload capabilities, AI-powered chat, and sophisticated report writing features, all within a Gemini-inspired interface. The project aims to provide a secure and efficient tool for M&E professionals.

## User Preferences
Preferred communication style: Simple, everyday language. User prefers more natural, ChatGPT-like responses - conversational, helpful, and engaging while maintaining professionalism.

M&E Focus: User specifically requested AI to be specialized in Monitoring & Evaluation (M&E) rather than general business analysis. Reports should focus on M&E best practices, frameworks, outcomes, indicators, and impact assessment.

Interactive Questioning: User wants AI to proactively ask clarifying questions before generating reports to better understand user needs and create more targeted, valuable outputs. This should be implemented with "highest creativity" to make the feature exceptional.

## System Architecture

### Full-Stack Architecture
The application features a modern full-stack TypeScript architecture:
-   **Frontend**: React + Vite
-   **Backend**: Node.js + Express
-   **Database**: PostgreSQL with Drizzle ORM
-   **Styling**: Tailwind CSS with shadcn/ui components
-   **Authentication**: Passport.js with local strategy
-   **State Management**: TanStack Query for server state

### UI/UX Design
The design emphasizes a luxurious and modern aesthetic:
-   **Brand Colors**: Turquoise (#00728e), Green (#a8cb63), Grey (#e3e3e3)
-   **Effects**: Custom liquid glassmorphism components
-   **Layout**: Google Gemini-inspired with a left sidebar and main chat area
-   **Responsiveness**: Mobile-first approach
-   **Animations**: Smooth animations with floating elements and morphing effects

### Technical Implementations & Features
-   **Document Processing**: Handles PDF, DOCX, DOC, TXT, HTML, MD, CSV, RTF, JSON files, including text extraction, intelligent chunking, and embedding generation for semantic search. Documents expire after 48 hours for security.
-   **AI Integration**: Utilizes local Large Language Models (LLMs) for chat responses and report generation, with robust error handling and fallback mechanisms. Specialized in M&E, supporting six report types and incorporating OECD-DAC evaluation standards.
-   **Interactive Questioning**: AI generates contextual and stakeholder-focused clarifying questions before report generation, allowing users to customize outputs.
-   **Data Flow**: Secure authentication via Passport.js, chat message processing with document context, and web scraping for knowledge base expansion.
-   **Security**: Features include local data storage, secure session management, strict file validation (type, size, malicious content detection), rate limiting, and document expiration.
-   **Downloadable Content**: AI can generate and provide downloadable files in various formats (TXT, HTML, Markdown, JSON, CSV) with temporary, secure links.
-   **Advanced Message Formatting**: AI responses are formatted with intelligent paragraph breaking, content recognition (headers, lists), and enhanced visual hierarchy for readability.

## External Dependencies

### AI Integration
-   **OpenRouter API** (Primary AI service, fallback)
-   **HuggingFace API** (Alternative AI service)
-   **Local LLM (Ollama)**: Primary AI processing with `gemma3:latest` model, configured via ngrok for local access.

### Document Processing
-   **pdf-parse**: For PDF text extraction.
-   **mammoth**: For DOCX document processing.
-   **cheerio**: For web scraping and HTML parsing.

### Database
-   **Neon Database**: PostgreSQL hosting.
-   **Drizzle ORM**: Type-safe database operations and migrations.
-   **connect-pg-simple**: PostgreSQL session store.

### UI Libraries
-   **Radix UI**: Headless UI components.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Lucide React**: Icon library.
-   **TanStack Query**: Data fetching and caching.

## Recent Changes

### Migration to Replit Environment (August 2025) ✅
- **Successful Environment Migration**: Complete migration from Replit Agent to standard Replit environment
- **Database Configuration**: PostgreSQL database successfully provisioned and all tables created via Drizzle migrations
- **Project Structure Validation**: Full-stack architecture verified with proper client/server separation
- **Security Implementation**: All authentication, file upload, and session management properly configured
- **Application Launch**: Successfully running on port 5000 with all services initialized
- **Clean Migration**: No data loss, all existing features and capabilities preserved