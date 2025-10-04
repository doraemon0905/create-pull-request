import { ResponseParser } from '../../services/ai-providers/response-parser.js';
import { AIProvider } from '../../services/ai-providers/base.js';

describe('ResponseParser', () => {
    let parser: ResponseParser;

    beforeEach(() => {
        parser = new ResponseParser();
    });

    describe('parseAIResponse', () => {
        it('should parse Claude response correctly', () => {
            const response = {
                content: [
                    { text: 'Generated response content' }
                ]
            };

            const result = parser.parseAIResponse(response, 'claude');

            expect(result).toEqual({
                title: 'Generated response content',
                body: 'Generated response content',
                summary: 'Generated response content'
            });
        });

        it('should parse ChatGPT response correctly', () => {
            const response = {
                choices: [
                    {
                        message: {
                            content: 'Generated response content'
                        }
                    }
                ]
            };

            const result = parser.parseAIResponse(response, 'chatgpt');

            expect(result).toEqual({
                title: 'Generated response content',
                body: 'Generated response content',
                summary: 'Generated response content'
            });
        });

        it('should parse Gemini response correctly', () => {
            const response = {
                candidates: [
                    {
                        content: {
                            parts: [
                                { text: 'Generated response content' }
                            ]
                        }
                    }
                ]
            };

            const result = parser.parseAIResponse(response, 'gemini');

            expect(result).toEqual({
                title: 'Generated response content',
                body: 'Generated response content',
                summary: 'Generated response content'
            });
        });

        it('should parse Copilot response correctly', () => {
            const response = {
                choices: [
                    {
                        message: {
                            content: 'Generated response content'
                        }
                    }
                ]
            };

            const result = parser.parseAIResponse(response, 'copilot');

            expect(result).toEqual({
                title: 'Generated response content',
                body: 'Generated response content',
                summary: 'Generated response content'
            });
        });

        it('should throw error for unknown provider', () => {
            const response = { content: 'test' };

            expect(() => parser.parseAIResponse(response, 'unknown' as AIProvider))
                .toThrow('Unknown provider: unknown');
        });
    });

    describe('extractContentFromResponse', () => {
        it('should extract content from Claude response', () => {
            const response = {
                content: [
                    { text: 'Claude response' }
                ]
            };

            const content = parser['extractContentFromResponse'](response, 'claude');
            expect(content).toBe('Claude response');
        });

        it('should throw error for invalid Claude response', () => {
            const response = {
                content: []
            };

            expect(() => parser['extractContentFromResponse'](response, 'claude'))
                .toThrow('No content received from Claude API');
        });

        it('should extract content from ChatGPT response', () => {
            const response = {
                choices: [
                    {
                        message: {
                            content: 'ChatGPT response'
                        }
                    }
                ]
            };

            const content = parser['extractContentFromResponse'](response, 'chatgpt');
            expect(content).toBe('ChatGPT response');
        });

        it('should throw error for invalid ChatGPT response', () => {
            const response = {
                choices: []
            };

            expect(() => parser['extractContentFromResponse'](response, 'chatgpt'))
                .toThrow('No content received from ChatGPT API');
        });

        it('should extract content from Gemini response', () => {
            const response = {
                candidates: [
                    {
                        content: {
                            parts: [
                                { text: 'Gemini response' }
                            ]
                        }
                    }
                ]
            };

            const content = parser['extractContentFromResponse'](response, 'gemini');
            expect(content).toBe('Gemini response');
        });

        it('should throw error for invalid Gemini response', () => {
            const response = {
                candidates: []
            };

            expect(() => parser['extractContentFromResponse'](response, 'gemini'))
                .toThrow('No content received from Gemini API');
        });

        it('should extract content from Copilot response', () => {
            const response = {
                choices: [
                    {
                        message: {
                            content: 'Copilot response'
                        }
                    }
                ]
            };

            const content = parser['extractContentFromResponse'](response, 'copilot');
            expect(content).toBe('Copilot response');
        });

        it('should throw error for invalid Copilot response', () => {
            const response = {
                choices: []
            };

            expect(() => parser['extractContentFromResponse'](response, 'copilot'))
                .toThrow('No content received from Copilot API');
        });
    });

    describe('parseResponseContent', () => {
        it('should parse valid JSON response', () => {
            const jsonContent = '{"title": "Test Title", "description": "Test Description", "summary": "Test Summary"}';

            const result = parser['parseResponseContent'](jsonContent);

            expect(result).toEqual({
                title: 'Test Title',
                body: 'Test Description',
                summary: 'Test Summary'
            });
        });

        it('should parse JSON with markdown code blocks', () => {
            const jsonContent = '```json\n{"title": "Test Title", "description": "Test Description"}\n```';

            const result = parser['parseResponseContent'](jsonContent);

            expect(result).toEqual({
                title: 'Test Title',
                body: 'Test Description',
                summary: undefined
            });
        });

        it('should extract JSON from mixed content', () => {
            const mixedContent = 'Here is the response:\n{"title": "Test Title", "description": "Test Description"}\nEnd of response';

            const result = parser['parseResponseContent'](mixedContent);

            expect(result).toEqual({
                title: 'Test Title',
                body: 'Test Description',
                summary: undefined
            });
        });

        it('should fall back to text extraction when JSON parsing fails', () => {
            const invalidJson = '{"title": "Test Title", "description": "Test Description"'; // Missing closing brace

            const result = parser['parseResponseContent'](invalidJson);

            expect(result.title).toBe('{"title": "Test Title", "description": "Test Description"');
            expect(result.body).toBe(invalidJson);
        });

        it('should extract from plain text with markdown header', () => {
            const textContent = '# Test Title\n\nThis is the description content.';

            const result = parser['parseResponseContent'](textContent);

            expect(result).toEqual({
                title: 'Test Title',
                body: textContent,
                summary: undefined
            });
        });

        it('should extract from plain text with Title prefix', () => {
            const textContent = 'Title: Test Title\n\nThis is the description content.';

            const result = parser['parseResponseContent'](textContent);

            expect(result).toEqual({
                title: 'Test Title',
                body: textContent,
                summary: undefined
            });
        });

        it('should extract from plain text with subheader', () => {
            const textContent = '## Test Title\n\nThis is the description content.';

            const result = parser['parseResponseContent'](textContent);

            expect(result).toEqual({
                title: 'Test Title',
                body: textContent,
                summary: undefined
            });
        });

        it('should extract first meaningful line as title when no patterns match', () => {
            const textContent = 'This is a meaningful title that should be extracted\n\nThis is the description content.';

            const result = parser['parseResponseContent'](textContent);

            expect(result).toEqual({
                title: 'This is a meaningful title that should be extracted',
                body: textContent,
                summary: 'This is a meaningful title that should be extracted'
            });
        });

        it('should use default title when no meaningful line found', () => {
            const textContent = 'Short\n\nThis is the description content.';

            const result = parser['parseResponseContent'](textContent);

            expect(result).toEqual({
                title: 'This is the description content.',
                body: textContent,
                summary: undefined
            });
        });
    });

    describe('isValidJSON', () => {
        it('should return true for valid JSON', () => {
            expect(parser['isValidJSON']('{"key": "value"}')).toBe(true);
        });

        it('should return false for invalid JSON', () => {
            expect(parser['isValidJSON']('{"key": "value"')).toBe(false);
        });

        it('should return false for non-JSON string', () => {
            expect(parser['isValidJSON']('plain text')).toBe(false);
        });
    });

    describe('cleanJSONResponse', () => {
        it('should remove markdown code blocks', () => {
            const content = '```json\n{"key": "value"}\n```';
            const cleaned = parser['cleanJSONResponse'](content);
            expect(cleaned).toBe('{"key": "value"}');
        });

        it('should trim whitespace', () => {
            const content = '  {"key": "value"}  ';
            const cleaned = parser['cleanJSONResponse'](content);
            expect(cleaned).toBe('{"key": "value"}');
        });

        it('should extract JSON from mixed content', () => {
            const content = 'Here is the JSON: {"key": "value"} and more text';
            const cleaned = parser['cleanJSONResponse'](content);
            expect(cleaned).toBe('{"key": "value"}');
        });

        it('should handle content without JSON', () => {
            const content = 'plain text content';
            const cleaned = parser['cleanJSONResponse'](content);
            expect(cleaned).toBe('plain text content');
        });
    });

    describe('extractFromText', () => {
        it('should extract title and body from text', () => {
            const content = '# Test Title\n\nThis is the body content.';

            const result = parser['extractFromText'](content);

            expect(result).toEqual({
                title: 'Test Title',
                body: content,
                summary: undefined
            });
        });

        it('should use default title when none found', () => {
            const content = 'This is just body content.';

            const result = parser['extractFromText'](content);

            expect(result).toEqual({
                title: 'This is just body content.',
                body: content,
                summary: 'This is just body content.'
            });
        });
    });

    describe('extractTitle', () => {
        it('should extract markdown header', () => {
            const content = '# Test Title\n\nContent';
            const title = parser['extractTitle'](content);
            expect(title).toBe('Test Title');
        });

        it('should extract Title prefix', () => {
            const content = 'Title: Test Title\n\nContent';
            const title = parser['extractTitle'](content);
            expect(title).toBe('Test Title');
        });

        it('should extract subheader', () => {
            const content = '## Test Title\n\nContent';
            const title = parser['extractTitle'](content);
            expect(title).toBe('Test Title');
        });

        it('should extract sub-subheader', () => {
            const content = '### Test Title\n\nContent';
            const title = parser['extractTitle'](content);
            expect(title).toBe('Test Title');
        });

        it('should extract first meaningful line', () => {
            const content = 'This is a meaningful title that should be extracted\n\nContent';
            const title = parser['extractTitle'](content);
            expect(title).toBe('This is a meaningful title that should be extracted');
        });

        it('should return null when no meaningful line found', () => {
            const content = 'Short\n\nContent';
            const title = parser['extractTitle'](content);
            expect(title).toBeNull();
        });

        it('should handle case insensitive Title prefix', () => {
            const content = 'title: Test Title\n\nContent';
            const title = parser['extractTitle'](content);
            expect(title).toBe('Test Title');
        });
    });

    describe('extractSummary', () => {
        it('should extract Summary prefix', () => {
            const content = 'Summary: This is a summary\n\nMore content';
            const summary = parser['extractSummary'](content);
            expect(summary).toBe('This is a summary');
        });

        it('should extract markdown summary section', () => {
            const content = '## Summary\nThis is a summary\n\nMore content';
            const summary = parser['extractSummary'](content);
            expect(summary).toBe('This is a summary');
        });

        it('should extract subheader summary section', () => {
            const content = '### Summary\nThis is a summary\n\nMore content';
            const summary = parser['extractSummary'](content);
            expect(summary).toBe('This is a summary');
        });

        it('should extract first paragraph as summary', () => {
            const content = 'This is a good summary paragraph that explains the changes.\n\nMore detailed content follows.';
            const summary = parser['extractSummary'](content);
            expect(summary).toBe('This is a good summary paragraph that explains the changes.');
        });

        it('should return undefined when no suitable summary found', () => {
            const content = 'Short\n\nMore content';
            const summary = parser['extractSummary'](content);
            expect(summary).toBeUndefined();
        });

        it('should handle case insensitive Summary prefix', () => {
            const content = 'summary: This is a summary\n\nMore content';
            const summary = parser['extractSummary'](content);
            expect(summary).toBe('This is a summary');
        });
    });
});
