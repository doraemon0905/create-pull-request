import { AIProvider } from './base.js';
export interface GeneratedPRContent {
    title: string;
    body: string;
    summary?: string;
}
export declare class ResponseParser {
    parseAIResponse(response: any, provider: AIProvider): GeneratedPRContent;
    private extractContentFromResponse;
    private parseResponseContent;
    private isValidJSON;
    private cleanJSONResponse;
    private extractFromText;
    private extractTitle;
    private extractSummary;
}
//# sourceMappingURL=response-parser.d.ts.map