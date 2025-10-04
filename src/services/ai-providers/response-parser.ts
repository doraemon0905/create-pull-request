import { AIProvider } from './base.js';

export interface GeneratedPRContent {
  title: string;
  body: string;
  summary?: string;
}

export class ResponseParser {
  parseAIResponse(response: any, provider: AIProvider): GeneratedPRContent {
    const content = this.extractContentFromResponse(response, provider);
    return this.parseResponseContent(content);
  }

  private extractContentFromResponse(response: any, provider: AIProvider): string {
    switch (provider) {
      case 'claude':
        if (!response.content || !response.content[0]?.text) {
          throw new Error('No content received from Claude API');
        }
        return response.content[0].text;

      case 'chatgpt':
        if (!response.choices || !response.choices[0]?.message?.content) {
          throw new Error('No content received from ChatGPT API');
        }
        return response.choices[0].message.content;

      case 'gemini':
        if (!response.candidates || !response.candidates[0]?.content?.parts?.[0]?.text) {
          throw new Error('No content received from Gemini API');
        }
        return response.candidates[0].content.parts[0].text;

      case 'copilot':
        if (!response.choices || !response.choices[0]?.message?.content) {
          throw new Error('No content received from Copilot API');
        }
        return response.choices[0].message.content;

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private parseResponseContent(content: string): GeneratedPRContent {
    // Try to parse as JSON first
    const cleanedContent = this.cleanJSONResponse(content);
    if (this.isValidJSON(cleanedContent)) {
      try {
        const parsed = JSON.parse(cleanedContent);

        return {
          title: parsed.title || this.extractTitle(content),
          body: parsed.description || parsed.body || content,
          summary: parsed.summary
        };
      } catch (error) {
        // If JSON parsing fails, fall back to text extraction
        return this.extractFromText(content);
      }
    }

    // If not JSON, extract from plain text
    return this.extractFromText(content);
  }

  private isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  private cleanJSONResponse(content: string): string {
    // Remove markdown code blocks if present
    let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();

    // Try to extract JSON from mixed content
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return cleaned;
  }

  private extractFromText(content: string): GeneratedPRContent {
    const title = this.extractTitle(content);

    return {
      title: title || 'Pull Request',
      body: content,
      summary: this.extractSummary(content)
    };
  }

  private extractTitle(content: string): string | null {
    // Look for title patterns
    const titlePatterns = [
      /^#\s+(.+)$/m,           // Markdown header
      /^Title:\s*(.+)$/im,     // Title: prefix
      /^##\s+(.+)$/m,         // Markdown subheader
      /^###\s+(.+)$/m         // Markdown sub-subheader
    ];

    for (const pattern of titlePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // If no pattern matches, try to extract first meaningful line
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 10 && trimmed.length < 100) {
        return trimmed;
      }
    }

    return null;
  }

  private extractSummary(content: string): string | undefined {
    // Look for summary patterns
    const summaryPatterns = [
      /^Summary:\s*(.+)$/im,
      /^## Summary\s*\n(.+)$/im,
      /^### Summary\s*\n(.+)$/im
    ];

    for (const pattern of summaryPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Extract first paragraph as summary
    const paragraphs = content.split('\n\n');
    if (paragraphs.length > 0) {
      const firstParagraph = paragraphs[0].trim();
      if (firstParagraph.length > 20 && firstParagraph.length < 200) {
        return firstParagraph;
      }
    }

    return undefined;
  }
}
