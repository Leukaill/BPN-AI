import { storage } from '../storage';
import { geminiService } from './gemini';

interface ReportRequest {
  type: 'analysis' | 'assessment' | 'improvement' | 'strategic';
  documentContent: string;
  documentTitle: string;
  userId: number;
  customPrompt?: string;
}

interface ReportResponse {
  title: string;
  content: string;
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  implementationSteps: string[];
  successMetrics: string[];
}

export class ReportGenerator {
  async generateAnalyticalReport(request: ReportRequest): Promise<ReportResponse> {
    const { type, documentContent, documentTitle, customPrompt } = request;
    
    const reportPrompt = this.buildReportPrompt(type, documentContent, documentTitle, customPrompt);
    
    const rawReport = await geminiService.generateResponse(reportPrompt);
    
    return this.parseReportResponse(rawReport, documentTitle);
  }

  private buildReportPrompt(
    type: string,
    content: string,
    title: string,
    customPrompt?: string
  ): string {
    const basePrompt = `You are a senior business analyst tasked with generating a comprehensive analytical report.

DOCUMENT TO ANALYZE:
Title: ${title}
Content: ${content}

REPORT TYPE: ${type.toUpperCase()}

INSTRUCTIONS:
Generate a professional business analysis report with the following structure:

1. EXECUTIVE SUMMARY (2-3 sentences)
2. KEY FINDINGS (3-5 bullet points)
3. STRATEGIC RECOMMENDATIONS (3-5 actionable items)
4. IMPLEMENTATION ROADMAP (clear steps)
5. SUCCESS METRICS (measurable outcomes)

ANALYSIS REQUIREMENTS:
- Identify strengths, weaknesses, and improvement opportunities
- Provide strategic insights and business value assessment
- Focus on actionable recommendations with clear implementation steps
- Use professional business language
- Be specific and data-driven where possible
- Consider operational efficiency, compliance, and best practices

FORMAT REQUIREMENTS:
- Use clear headings and bullet points
- Keep sections concise but comprehensive
- Focus on business value and strategic impact
- Provide specific, actionable recommendations
- Include measurable success criteria

${customPrompt ? `\nADDITIONAL REQUIREMENTS:\n${customPrompt}` : ''}

Generate a strategic business analysis report now:`;

    return basePrompt;
  }

  private parseReportResponse(rawReport: string, title: string): ReportResponse {
    // Extract different sections from the report
    const sections = this.extractSections(rawReport);
    
    return {
      title: `Business Analysis Report: ${title}`,
      content: rawReport,
      executiveSummary: sections.executiveSummary || '',
      keyFindings: sections.keyFindings || [],
      recommendations: sections.recommendations || [],
      implementationSteps: sections.implementationSteps || [],
      successMetrics: sections.successMetrics || []
    };
  }

  private extractSections(content: string): {
    executiveSummary?: string;
    keyFindings?: string[];
    recommendations?: string[];
    implementationSteps?: string[];
    successMetrics?: string[];
  } {
    const sections: any = {};
    
    // Extract Executive Summary
    const execSummaryMatch = content.match(/EXECUTIVE SUMMARY[:\s]*\n([\s\S]*?)(?=\n[A-Z\s]+:|$)/i);
    if (execSummaryMatch) {
      sections.executiveSummary = execSummaryMatch[1].trim();
    }
    
    // Extract Key Findings
    const findingsMatch = content.match(/KEY FINDINGS[:\s]*\n([\s\S]*?)(?=\n[A-Z\s]+:|$)/i);
    if (findingsMatch) {
      sections.keyFindings = this.extractBulletPoints(findingsMatch[1]);
    }
    
    // Extract Recommendations
    const recommendationsMatch = content.match(/RECOMMENDATIONS[:\s]*\n([\s\S]*?)(?=\n[A-Z\s]+:|$)/i);
    if (recommendationsMatch) {
      sections.recommendations = this.extractBulletPoints(recommendationsMatch[1]);
    }
    
    // Extract Implementation Steps
    const implementationMatch = content.match(/IMPLEMENTATION[:\s]*\n([\s\S]*?)(?=\n[A-Z\s]+:|$)/i);
    if (implementationMatch) {
      sections.implementationSteps = this.extractBulletPoints(implementationMatch[1]);
    }
    
    // Extract Success Metrics
    const metricsMatch = content.match(/SUCCESS METRICS[:\s]*\n([\s\S]*?)(?=\n[A-Z\s]+:|$)/i);
    if (metricsMatch) {
      sections.successMetrics = this.extractBulletPoints(metricsMatch[1]);
    }
    
    return sections;
  }

  private extractBulletPoints(text: string): string[] {
    const lines = text.split('\n');
    const bulletPoints: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.match(/^[-•*]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        bulletPoints.push(trimmedLine.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''));
      }
    }
    
    return bulletPoints;
  }

  async generateDocumentAssessment(documentId: number, userId: number): Promise<ReportResponse> {
    const document = await storage.getDocument(documentId);
    
    if (!document || document.userId !== userId) {
      throw new Error('Document not found or access denied');
    }
    
    const content = document.text || document.extractedText || '';
    
    return this.generateAnalyticalReport({
      type: 'assessment',
      documentContent: content,
      documentTitle: document.originalName,
      userId: userId
    });
  }
}

export const reportGenerator = new ReportGenerator();