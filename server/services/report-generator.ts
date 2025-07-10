import { storage } from '../storage';
import { localLLMService } from './local-llm';

interface ReportRequest {
  type: 'me_progress' | 'me_outcome' | 'me_impact' | 'me_evaluation' | 'me_baseline' | 'me_framework_assessment';
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
  meIndicators?: string[];
  outcomes?: string[];
  lessons?: string[];
}

export class ReportGenerator {
  async generateAnalyticalReport(request: ReportRequest): Promise<ReportResponse> {
    const { type, documentContent, documentTitle, customPrompt } = request;
    
    const reportPrompt = this.buildReportPrompt(type, documentContent, documentTitle, customPrompt);
    
    const { llmErrorHandler } = await import("./llm-error-handler");
    const rawReport = await llmErrorHandler.generateResponse(reportPrompt, {
      temperature: 0.6, // Slightly lower temperature for more consistent reports
      maxTokens: 3000,  // More tokens for detailed reports
      topK: 30,
      topP: 0.9
    }, `${type} report generation`);
    
    return this.parseReportResponse(rawReport, documentTitle);
  }

  private buildReportPrompt(
    type: string,
    content: string,
    title: string,
    customPrompt?: string
  ): string {
    const mePromptTemplates = {
      me_progress: `You are a senior Monitoring & Evaluation (M&E) specialist with expertise in progress reporting and performance assessment.

DOCUMENT TO ANALYZE:
Title: ${title}
Content: ${content}

REPORT TYPE: M&E PROGRESS REPORT

Generate a comprehensive M&E progress report with the following structure:

1. EXECUTIVE SUMMARY
   - Overall progress status against targets
   - Key achievements and challenges
   - Critical decisions needed

2. PERFORMANCE AGAINST INDICATORS
   - Process indicators (activities implemented)
   - Outcome indicators (short-term results)
   - Progress towards targets (with percentages)
   - Variance analysis and explanations

3. RESULTS FRAMEWORK ANALYSIS
   - Theory of Change validation
   - Assumptions testing
   - Risk assessment and mitigation
   - External factors impact

4. LESSONS LEARNED & ADAPTATIONS
   - What worked well and why
   - Challenges encountered and solutions
   - Adaptive management decisions
   - Best practices identified

5. RECOMMENDATIONS FOR NEXT PERIOD
   - Priority actions for improvement
   - Resource allocation suggestions
   - Risk mitigation strategies
   - Course corrections needed

6. DATA QUALITY ASSESSMENT
   - Data collection completeness
   - Reliability and validity issues
   - Recommendations for improvement

M&E FOCUS AREAS:
- Analyze progress against SMART indicators
- Assess data quality and collection methods
- Evaluate stakeholder engagement effectiveness
- Review resource utilization efficiency
- Identify capacity building needs
- Assess sustainability prospects`,

      me_outcome: `You are an expert M&E evaluator specializing in outcome assessment and impact evaluation.

DOCUMENT TO ANALYZE:
Title: ${title}
Content: ${content}

REPORT TYPE: M&E OUTCOME EVALUATION

Generate a comprehensive outcome evaluation report with the following structure:

1. EXECUTIVE SUMMARY
   - Key outcome achievements
   - Attribution assessment
   - Overall program effectiveness

2. OUTCOME ANALYSIS
   - Outcome indicators performance
   - Target achievement analysis
   - Beneficiary impact assessment
   - Unintended consequences identification

3. EFFECTIVENESS ASSESSMENT
   - Theory of Change validation
   - Causal pathway analysis
   - Contribution vs attribution
   - External factor influence

4. EQUITY & INCLUSION ANALYSIS
   - Disaggregated data analysis (gender, age, location)
   - Vulnerable group impact
   - Accessibility assessment
   - Inclusion effectiveness

5. SUSTAINABILITY EVALUATION
   - Institutional capacity assessment
   - Financial sustainability analysis
   - Environmental sustainability
   - Social sustainability factors

6. LESSONS LEARNED
   - Successful strategies identified
   - Implementation challenges
   - Contextual factors influence
   - Scalability potential

OUTCOME EVALUATION FOCUS:
- Measure short and medium-term changes
- Assess program effectiveness and efficiency
- Evaluate stakeholder satisfaction
- Analyze cost-effectiveness
- Identify scaling opportunities
- Assess sustainability prospects`,

      me_impact: `You are a senior M&E expert specializing in impact assessment and long-term evaluation.

DOCUMENT TO ANALYZE:
Title: ${title}
Content: ${content}

REPORT TYPE: M&E IMPACT ASSESSMENT

Generate a comprehensive impact assessment report with the following structure:

1. EXECUTIVE SUMMARY
   - Overall impact statement
   - Key transformational changes
   - Long-term sustainability outlook

2. IMPACT INDICATORS ANALYSIS
   - Long-term outcome achievement
   - Transformational change evidence
   - Beneficiary life improvements
   - Systemic change indicators

3. ATTRIBUTION & CONTRIBUTION ANALYSIS
   - Program contribution to impact
   - External factor influence
   - Counterfactual analysis
   - Alternative explanation assessment

4. SUSTAINABILITY ASSESSMENT
   - Institutional sustainability
   - Financial sustainability
   - Environmental sustainability
   - Social/cultural sustainability

5. UNINTENDED CONSEQUENCES
   - Positive unintended effects
   - Negative unintended effects
   - Spillover effects analysis
   - Risk mitigation effectiveness

6. SCALING & REPLICATION POTENTIAL
   - Scalability assessment
   - Replication opportunities
   - Adaptation requirements
   - Resource implications

IMPACT ASSESSMENT FOCUS:
- Measure long-term transformational changes
- Assess sustainable development contribution
- Evaluate system-level changes
- Analyze cost-benefit ratios
- Identify policy implications
- Assess sector-wide influence`,

      me_evaluation: `You are a comprehensive M&E evaluator with expertise in full program evaluation.

DOCUMENT TO ANALYZE:
Title: ${title}
Content: ${content}

REPORT TYPE: COMPREHENSIVE M&E EVALUATION

Generate a comprehensive program evaluation report with the following structure:

1. EXECUTIVE SUMMARY
   - Overall program performance
   - Key evaluation findings
   - Critical recommendations

2. RELEVANCE EVALUATION
   - Alignment with needs and priorities
   - Stakeholder relevance assessment
   - Contextual appropriateness
   - Strategic fit analysis

3. EFFECTIVENESS ASSESSMENT
   - Objective achievement analysis
   - Output and outcome delivery
   - Quality of results
   - Stakeholder satisfaction

4. EFFICIENCY EVALUATION
   - Resource utilization analysis
   - Cost-effectiveness assessment
   - Time management evaluation
   - Process efficiency review

5. IMPACT & SUSTAINABILITY
   - Long-term change evidence
   - Sustainability prospects
   - Institutional capacity
   - Environmental considerations

6. COHERENCE & COORDINATION
   - Internal coherence assessment
   - External coherence analysis
   - Coordination effectiveness
   - Synergy identification

EVALUATION CRITERIA FOCUS:
- Apply OECD-DAC evaluation criteria
- Use mixed-methods evaluation approach
- Ensure stakeholder participation
- Maintain evaluation independence
- Focus on learning and accountability
- Provide actionable recommendations`,

      me_baseline: `You are an M&E baseline specialist with expertise in establishing measurement baselines.

DOCUMENT TO ANALYZE:
Title: ${title}
Content: ${content}

REPORT TYPE: M&E BASELINE ASSESSMENT

Generate a comprehensive baseline assessment report with the following structure:

1. EXECUTIVE SUMMARY
   - Baseline establishment purpose
   - Key baseline findings
   - Measurement framework readiness

2. INDICATOR BASELINE VALUES
   - Process indicator baselines
   - Outcome indicator baselines
   - Impact indicator baselines
   - Data source reliability

3. CONTEXT ANALYSIS
   - Socio-economic context
   - Political environment
   - Cultural considerations
   - Environmental factors

4. STAKEHOLDER MAPPING
   - Primary stakeholders analysis
   - Secondary stakeholders identification
   - Stakeholder capacity assessment
   - Engagement strategy recommendations

5. DATA COLLECTION SYSTEMS
   - Data collection methods assessment
   - Data quality evaluation
   - Collection frequency recommendations
   - Capacity building needs

6. MEASUREMENT FRAMEWORK
   - Theory of Change validation
   - Indicator framework assessment
   - Measurement plan recommendations
   - Reporting system design

BASELINE ASSESSMENT FOCUS:
- Establish credible measurement baselines
- Assess data collection feasibility
- Evaluate measurement system capacity
- Identify data quality improvements
- Recommend measurement protocols
- Establish comparison benchmarks`,

      me_framework_assessment: `You are an M&E framework expert specializing in evaluating monitoring and evaluation systems.

DOCUMENT TO ANALYZE:
Title: ${title}
Content: ${content}

REPORT TYPE: M&E FRAMEWORK ASSESSMENT

Generate a comprehensive M&E framework assessment report with the following structure:

1. EXECUTIVE SUMMARY
   - Framework strengths and weaknesses
   - Critical improvement areas
   - Implementation readiness

2. FRAMEWORK DESIGN ANALYSIS
   - Theory of Change quality
   - Results framework coherence
   - Indicator selection appropriateness
   - Measurement plan feasibility

3. INSTITUTIONAL CAPACITY ASSESSMENT
   - M&E system capacity
   - Staff skills and competencies
   - Resource allocation adequacy
   - Technology infrastructure

4. DATA MANAGEMENT EVALUATION
   - Data collection systems
   - Data quality assurance
   - Data analysis capabilities
   - Reporting mechanisms

5. UTILIZATION & LEARNING
   - Decision-making integration
   - Learning culture assessment
   - Feedback loop effectiveness
   - Adaptive management capacity

6. FRAMEWORK IMPROVEMENT PLAN
   - Priority enhancement areas
   - Capacity building recommendations
   - System strengthening actions
   - Implementation timeline

M&E FRAMEWORK FOCUS:
- Evaluate framework design quality
- Assess institutional M&E capacity
- Review data management systems
- Evaluate learning and adaptation
- Recommend system improvements
- Provide implementation guidance`
    };

    const selectedTemplate = mePromptTemplates[type as keyof typeof mePromptTemplates] || mePromptTemplates.me_evaluation;
    
    return `${selectedTemplate}

${customPrompt ? `\nADDITIONAL REQUIREMENTS:\n${customPrompt}` : ''}

FORMAT REQUIREMENTS:
- Use professional M&E terminology
- Include specific data and evidence
- Provide actionable recommendations
- Use clear headings and bullet points
- Focus on learning and improvement
- Maintain evaluation standards

Generate the M&E report now:`;
  }

  private parseReportResponse(rawReport: string, title: string): ReportResponse {
    // Extract different sections from the report
    const sections = this.extractSections(rawReport);
    
    return {
      title: `M&E Report: ${title}`,
      content: rawReport,
      executiveSummary: sections.executiveSummary || '',
      keyFindings: sections.keyFindings || [],
      recommendations: sections.recommendations || [],
      implementationSteps: sections.implementationSteps || [],
      successMetrics: sections.successMetrics || [],
      meIndicators: sections.meIndicators || [],
      outcomes: sections.outcomes || [],
      lessons: sections.lessons || []
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