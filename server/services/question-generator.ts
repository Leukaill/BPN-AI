import { geminiService } from './gemini';

interface QuestionSet {
  context: string;
  questions: Question[];
  reportType: string;
  purpose: string;
}

interface Question {
  id: string;
  question: string;
  type: 'choice' | 'text' | 'scale' | 'multiple';
  options?: string[];
  required: boolean;
  followUp?: string;
  meCategory: 'stakeholder' | 'scope' | 'methodology' | 'indicators' | 'timeline' | 'resources' | 'context';
}

export class QuestionGenerator {
  async generateContextualQuestions(
    userPrompt: string,
    documentContent: string,
    documentTitle: string
  ): Promise<QuestionSet> {
    // Analyze the request to determine report type and generate appropriate questions
    const reportType = this.identifyReportType(userPrompt);
    const questions = this.generateMEQuestions(reportType, documentContent, documentTitle);
    
    return {
      context: `I'd like to understand your specific needs better before generating your M&E report. This will help me create a more targeted and valuable analysis.`,
      questions: questions,
      reportType: reportType,
      purpose: this.getReportPurpose(reportType)
    };
  }

  private identifyReportType(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('baseline') || promptLower.includes('initial')) {
      return 'me_baseline';
    } else if (promptLower.includes('progress') || promptLower.includes('monitoring')) {
      return 'me_progress';
    } else if (promptLower.includes('outcome') || promptLower.includes('result')) {
      return 'me_outcome';
    } else if (promptLower.includes('impact') || promptLower.includes('long-term')) {
      return 'me_impact';
    } else if (promptLower.includes('framework') || promptLower.includes('system')) {
      return 'me_framework_assessment';
    } else {
      return 'me_evaluation';
    }
  }

  private getReportPurpose(reportType: string): string {
    const purposes = {
      me_baseline: 'Establish baseline measurements and assessment framework',
      me_progress: 'Track implementation progress and identify course corrections',
      me_outcome: 'Evaluate short-term results and program effectiveness',
      me_impact: 'Assess long-term transformational changes and sustainability',
      me_framework_assessment: 'Evaluate M&E system design and implementation capacity',
      me_evaluation: 'Conduct comprehensive program evaluation using OECD-DAC criteria'
    };
    
    return purposes[reportType as keyof typeof purposes] || purposes.me_evaluation;
  }

  private generateMEQuestions(reportType: string, documentContent: string, documentTitle: string): Question[] {
    const commonQuestions: Question[] = [
      {
        id: 'stakeholder_primary',
        question: 'Who is the primary audience for this M&E report?',
        type: 'choice',
        options: ['Donors/Funders', 'Program Management', 'Government Partners', 'Beneficiaries', 'Board/Leadership', 'Multiple Stakeholders'],
        required: true,
        meCategory: 'stakeholder'
      },
      {
        id: 'scope_focus',
        question: 'What specific aspect should the report focus on most?',
        type: 'choice',
        options: ['Overall program performance', 'Specific outcomes/impacts', 'Implementation challenges', 'Resource utilization', 'Stakeholder satisfaction', 'Sustainability prospects'],
        required: true,
        meCategory: 'scope'
      },
      {
        id: 'decision_context',
        question: 'What key decisions will this report inform?',
        type: 'text',
        required: true,
        followUp: 'This helps me prioritize the most relevant analysis and recommendations.',
        meCategory: 'context'
      }
    ];

    const typeSpecificQuestions = this.getTypeSpecificQuestions(reportType);
    
    return [...commonQuestions, ...typeSpecificQuestions];
  }

  private getTypeSpecificQuestions(reportType: string): Question[] {
    const questionSets = {
      me_baseline: [
        {
          id: 'baseline_timing',
          question: 'At what stage is this baseline being established?',
          type: 'choice',
          options: ['Pre-implementation', 'Early implementation', 'Mid-implementation review', 'Retrospective baseline'],
          required: true,
          meCategory: 'timeline'
        },
        {
          id: 'baseline_indicators',
          question: 'Which indicator categories are most critical to establish?',
          type: 'multiple',
          options: ['Process indicators', 'Outcome indicators', 'Impact indicators', 'Context indicators', 'All categories'],
          required: true,
          meCategory: 'indicators'
        },
        {
          id: 'baseline_challenges',
          question: 'What are the main challenges in establishing this baseline?',
          type: 'text',
          required: false,
          followUp: 'Understanding challenges helps me provide targeted solutions.',
          meCategory: 'methodology'
        }
      ],

      me_progress: [
        {
          id: 'progress_period',
          question: 'What reporting period does this progress report cover?',
          type: 'choice',
          options: ['Monthly', 'Quarterly', 'Semi-annual', 'Annual', 'Custom period'],
          required: true,
          meCategory: 'timeline'
        },
        {
          id: 'progress_concerns',
          question: 'Are there specific performance areas of concern?',
          type: 'multiple',
          options: ['Behind schedule', 'Budget overruns', 'Low beneficiary engagement', 'Implementation quality', 'External factors impact', 'No major concerns'],
          required: false,
          meCategory: 'scope'
        },
        {
          id: 'progress_adaptations',
          question: 'Have there been any significant program adaptations during this period?',
          type: 'text',
          required: false,
          followUp: 'This helps me analyze adaptive management effectiveness.',
          meCategory: 'context'
        }
      ],

      me_outcome: [
        {
          id: 'outcome_timeframe',
          question: 'What timeframe are you evaluating for outcomes?',
          type: 'choice',
          options: ['6 months', '1 year', '2 years', '3+ years', 'Program completion'],
          required: true,
          meCategory: 'timeline'
        },
        {
          id: 'outcome_beneficiaries',
          question: 'Which beneficiary groups should be analyzed separately?',
          type: 'multiple',
          options: ['Gender disaggregation', 'Age groups', 'Geographic locations', 'Socio-economic status', 'Vulnerability categories', 'No disaggregation needed'],
          required: true,
          meCategory: 'scope'
        },
        {
          id: 'outcome_attribution',
          question: 'How important is establishing attribution vs. contribution?',
          type: 'scale',
          options: ['1 - Contribution focus', '2', '3 - Balanced', '4', '5 - Strong attribution needed'],
          required: true,
          meCategory: 'methodology'
        }
      ],

      me_impact: [
        {
          id: 'impact_timeframe',
          question: 'How long has it been since program completion/major activities?',
          type: 'choice',
          options: ['1-2 years', '3-5 years', '5+ years', 'Program ongoing'],
          required: true,
          meCategory: 'timeline'
        },
        {
          id: 'impact_sustainability',
          question: 'Which sustainability dimensions are most important?',
          type: 'multiple',
          options: ['Financial sustainability', 'Institutional capacity', 'Environmental impact', 'Social/cultural changes', 'Policy influence', 'All dimensions'],
          required: true,
          meCategory: 'scope'
        },
        {
          id: 'impact_scaling',
          question: 'Is scaling or replication a consideration for this assessment?',
          type: 'choice',
          options: ['Yes, very important', 'Somewhat important', 'Not a priority', 'Unknown'],
          required: true,
          meCategory: 'context'
        }
      ],

      me_framework_assessment: [
        {
          id: 'framework_scope',
          question: 'What aspect of the M&E framework needs the most attention?',
          type: 'choice',
          options: ['Theory of Change design', 'Indicator selection', 'Data collection systems', 'Analysis and reporting', 'Utilization for decisions', 'Overall system design'],
          required: true,
          meCategory: 'scope'
        },
        {
          id: 'framework_capacity',
          question: 'What is the current M&E capacity level of the organization?',
          type: 'choice',
          options: ['Beginner - Limited M&E experience', 'Developing - Basic systems in place', 'Proficient - Strong M&E practice', 'Advanced - Sophisticated M&E systems', 'Unknown'],
          required: true,
          meCategory: 'resources'
        },
        {
          id: 'framework_improvements',
          question: 'What specific improvements are you hoping to achieve?',
          type: 'text',
          required: true,
          followUp: 'This helps me focus on the most relevant recommendations.',
          meCategory: 'context'
        }
      ],

      me_evaluation: [
        {
          id: 'evaluation_criteria',
          question: 'Which OECD-DAC evaluation criteria are most important for this evaluation?',
          type: 'multiple',
          options: ['Relevance', 'Effectiveness', 'Efficiency', 'Impact', 'Sustainability', 'Coherence', 'All criteria'],
          required: true,
          meCategory: 'methodology'
        },
        {
          id: 'evaluation_purpose',
          question: 'What is the primary purpose of this evaluation?',
          type: 'choice',
          options: ['Accountability to donors', 'Learning for improvement', 'Decision-making support', 'Program redesign', 'Scaling preparation', 'Multiple purposes'],
          required: true,
          meCategory: 'context'
        },
        {
          id: 'evaluation_independence',
          question: 'What level of evaluation independence is expected?',
          type: 'choice',
          options: ['Internal evaluation', 'External evaluation', 'Mixed approach', 'Independent verification', 'Not specified'],
          required: true,
          meCategory: 'methodology'
        }
      ]
    };

    return questionSets[reportType as keyof typeof questionSets] || questionSets.me_evaluation;
  }

  async generateFollowUpQuestions(
    initialAnswers: Record<string, any>,
    reportType: string
  ): Promise<Question[]> {
    // Generate intelligent follow-up questions based on user's initial answers
    const followUpQuestions: Question[] = [];

    // Example: If user selected "Implementation challenges" as focus, ask about specific challenges
    if (initialAnswers.scope_focus === 'Implementation challenges') {
      followUpQuestions.push({
        id: 'implementation_challenges_detail',
        question: 'What specific implementation challenges would you like the report to address?',
        type: 'multiple',
        options: [
          'Resource constraints',
          'Stakeholder coordination',
          'Technical capacity gaps',
          'External environment changes',
          'Beneficiary engagement',
          'Monitoring system issues'
        ],
        required: false,
        meCategory: 'scope'
      });
    }

    // Example: If user selected donors as primary audience, ask about reporting requirements
    if (initialAnswers.stakeholder_primary === 'Donors/Funders') {
      followUpQuestions.push({
        id: 'donor_requirements',
        question: 'Are there specific donor reporting requirements or formats to consider?',
        type: 'text',
        required: false,
        followUp: 'This helps me align the report with donor expectations.',
        meCategory: 'stakeholder'
      });
    }

    return followUpQuestions;
  }

  formatQuestionsForUser(questionSet: QuestionSet): string {
    const { context, questions, reportType, purpose } = questionSet;
    
    let formattedQuestions = `${context}\n\n`;
    formattedQuestions += `**Report Type:** ${this.getReportTypeDisplayName(reportType)}\n`;
    formattedQuestions += `**Purpose:** ${purpose}\n\n`;
    formattedQuestions += `**Questions to help me create the best M&E report for you:**\n\n`;

    questions.forEach((question, index) => {
      formattedQuestions += `**${index + 1}. ${question.question}**\n`;
      
      if (question.type === 'choice' && question.options) {
        question.options.forEach((option, optIndex) => {
          formattedQuestions += `   ${String.fromCharCode(97 + optIndex)}. ${option}\n`;
        });
      } else if (question.type === 'multiple' && question.options) {
        formattedQuestions += `   (Select all that apply)\n`;
        question.options.forEach((option, optIndex) => {
          formattedQuestions += `   ${String.fromCharCode(97 + optIndex)}. ${option}\n`;
        });
      } else if (question.type === 'scale' && question.options) {
        formattedQuestions += `   Scale: ${question.options.join(' | ')}\n`;
      } else if (question.type === 'text') {
        formattedQuestions += `   (Please provide your answer)\n`;
      }
      
      if (question.followUp) {
        formattedQuestions += `   *${question.followUp}*\n`;
      }
      
      formattedQuestions += `\n`;
    });

    formattedQuestions += `\n**Instructions:**\n`;
    formattedQuestions += `- You can answer with the letter(s) for multiple choice questions\n`;
    formattedQuestions += `- Provide text responses for open-ended questions\n`;
    formattedQuestions += `- Feel free to skip optional questions if not applicable\n`;
    formattedQuestions += `- Or simply say "skip questions" if you'd prefer me to proceed with a standard report\n\n`;
    formattedQuestions += `Once you provide your answers, I'll generate a highly customized M&E report tailored to your specific needs!`;

    return formattedQuestions;
  }

  private getReportTypeDisplayName(reportType: string): string {
    const displayNames = {
      me_baseline: 'M&E Baseline Assessment',
      me_progress: 'M&E Progress Report',
      me_outcome: 'M&E Outcome Evaluation',
      me_impact: 'M&E Impact Assessment',
      me_framework_assessment: 'M&E Framework Assessment',
      me_evaluation: 'Comprehensive M&E Evaluation'
    };
    
    return displayNames[reportType as keyof typeof displayNames] || 'M&E Evaluation';
  }
}

export const questionGenerator = new QuestionGenerator();