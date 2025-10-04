import { PromptBuilder, PromptBuilderOptions } from '../../services/ai-providers/prompt-builder.js';
import { FileChange } from '../../services/git.js';

describe('PromptBuilder', () => {
    let promptBuilder: PromptBuilder;
    let mockOptions: PromptBuilderOptions;

    beforeEach(() => {
        promptBuilder = new PromptBuilder();

        mockOptions = {
            jiraTicket: {
                key: 'PROJ-123',
                summary: 'Feature implementation',
                description: 'Implement a new feature for the application',
                issueType: 'Story',
                status: 'In Progress',
                assignee: 'John Doe',
                reporter: 'Jane Doe',
                created: '2023-01-01T00:00:00.000Z',
                updated: '2023-01-02T00:00:00.000Z',
                parentTicket: null
            },
            gitChanges: {
                totalFiles: 2,
                totalInsertions: 50,
                totalDeletions: 10,
                files: [
                    {
                        file: 'src/test.ts',
                        status: 'modified' as const,
                        changes: 35,
                        insertions: 30,
                        deletions: 5,
                        lineNumbers: {
                            added: [10, 11, 12],
                            removed: [5]
                        }
                    },
                    {
                        file: 'src/utils.ts',
                        status: 'modified' as const,
                        changes: 25,
                        insertions: 20,
                        deletions: 5
                    }
                ],
                commits: ['feat: add new feature', 'fix: bug fix']
            }
        };
    });

    describe('buildPrompt', () => {
        it('should build basic prompt with Jira ticket information', () => {
            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('## Jira Ticket Information:');
            expect(prompt).toContain('**Ticket**: PROJ-123');
            expect(prompt).toContain('**Summary**: Feature implementation');
            expect(prompt).toContain('**Type**: Story');
            expect(prompt).toContain('**Status**: In Progress');
            expect(prompt).toContain('**Assignee**: John Doe');
            expect(prompt).toContain('**Reporter**: Jane Doe');
            expect(prompt).toContain('**Description**: Implement a new feature for the application');
        });

        it('should include parent ticket information when available', () => {
            mockOptions.jiraTicket.parentTicket = {
                key: 'PROJ-100',
                summary: 'Parent feature',
                issueType: 'Epic'
            };

            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('**Parent Ticket**: PROJ-100 - Parent feature');
        });

        it('should include Confluence pages when available', () => {
            mockOptions.jiraTicket.confluencePages = [
                {
                    id: '123456',
                    title: 'Requirements Document',
                    content: 'This document contains the requirements for the feature implementation.',
                    url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456'
                }
            ];

            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('## Related Documentation:');
            expect(prompt).toContain('**Requirements Document**: This document contains the requirements for the feature implementation.');
            expect(prompt).toContain('Source: https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456');
        });

        it('should include git changes information', () => {
            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('## Code Changes:');
            expect(prompt).toContain('**Total Files Changed**: 2');
            expect(prompt).toContain('**Total Insertions**: 50');
            expect(prompt).toContain('**Total Deletions**: 10');
            expect(prompt).toContain('**Commits**: feat: add new feature, fix: bug fix');
        });

        it('should include file details with line numbers when repo info available', () => {
            mockOptions.repoInfo = {
                owner: 'testowner',
                repo: 'testrepo',
                currentBranch: 'feature/test'
            };

            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('## Files Modified:');
            expect(prompt).toContain('**src/test.ts** (modified)');
            expect(prompt).toContain('Changes: 35 lines');
            expect(prompt).toContain('Insertions: 30');
            expect(prompt).toContain('Deletions: 5');
            expect(prompt).toContain('File: https://github.com/testowner/testrepo/blob/feature/test/src/test.ts');
            expect(prompt).toContain('Added lines: https://github.com/testowner/testrepo/blob/feature/test/src/test.ts#L10, https://github.com/testowner/testrepo/blob/feature/test/src/test.ts#L11, https://github.com/testowner/testrepo/blob/feature/test/src/test.ts#L12');
            expect(prompt).toContain('Removed lines: https://github.com/testowner/testrepo/blob/feature/test/src/test.ts#L5');
        });

        it('should include diff content when available and not too large', () => {
            mockOptions.diffContent = 'diff --git a/src/test.ts b/src/test.ts\n+console.log("test");\n-console.log("old");';

            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('## Code Diff:');
            expect(prompt).toContain('```diff');
            expect(prompt).toContain('diff --git a/src/test.ts b/src/test.ts');
            expect(prompt).toContain('+console.log("test");');
            expect(prompt).toContain('-console.log("old");');
            expect(prompt).toContain('```');
        });

        it('should include diff summary when diff is too large', () => {
            mockOptions.diffContent = 'a'.repeat(15000); // Large diff

            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('## Code Diff Summary:');
            expect(prompt).not.toContain('```diff');
        });

        it('should include template when provided', () => {
            mockOptions.template = {
                name: 'test-template.md',
                content: '## Description\n{{description}}\n\n## Testing\n{{testing}}'
            };

            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('## Template Context:');
            expect(prompt).toContain('Use this template as a guide for the structure:');
            expect(prompt).toContain('```');
            expect(prompt).toContain('## Description\n{{description}}\n\n## Testing\n{{testing}}');
            expect(prompt).toContain('```');
        });

        it('should include summary when provided', () => {
            const summary = 'This is a test summary of the changes';

            const prompt = promptBuilder.buildPrompt(mockOptions, summary);

            expect(prompt).toContain('## AI-Generated Summary:');
            expect(prompt).toContain('This is a test summary of the changes');
        });

        it('should include instructions for JSON response format', () => {
            const prompt = promptBuilder.buildPrompt(mockOptions);

            expect(prompt).toContain('## Instructions:');
            expect(prompt).toContain('Please generate a comprehensive pull request description');
            expect(prompt).toContain('Format your response as JSON with the following structure:');
            expect(prompt).toContain('```json');
            expect(prompt).toContain('"title": "Clear and descriptive PR title"');
            expect(prompt).toContain('"description": "Detailed description of changes"');
            expect(prompt).toContain('"summary": "Brief summary of the changes"');
        });
    });

    describe('private methods', () => {
        describe('getFileRelevanceDescription', () => {
            it('should identify test files', () => {
                const testFile: FileChange = {
                    file: 'src/unit.spec.ts',
                    status: 'modified',
                    changes: 10,
                    insertions: 8,
                    deletions: 2
                };

                const relevance = promptBuilder['getFileRelevanceDescription'](testFile, mockOptions.jiraTicket);
                expect(relevance).toBe('Contains spec-related changes');
            });

            it('should return empty string for no relevance', () => {
                const testFile: FileChange = {
                    file: 'src/example.ts',
                    status: 'modified',
                    changes: 10,
                    insertions: 8,
                    deletions: 2
                };

                const relevance = promptBuilder['getFileRelevanceDescription'](testFile, mockOptions.jiraTicket);
                expect(relevance).toBe('');
            });

            it('should identify configuration files', () => {
                const configFile: FileChange = {
                    file: 'package.json',
                    status: 'modified',
                    changes: 5,
                    insertions: 3,
                    deletions: 2
                };

                const relevance = promptBuilder['getFileRelevanceDescription'](configFile, mockOptions.jiraTicket);
                expect(relevance).toBe('Configuration file changes');
            });

            it('should identify files by keywords', () => {
                const apiFile: FileChange = {
                    file: 'src/api/endpoints.ts',
                    status: 'modified',
                    changes: 15,
                    insertions: 12,
                    deletions: 3
                };

                const relevance = promptBuilder['getFileRelevanceDescription'](apiFile, mockOptions.jiraTicket);
                expect(relevance).toBe('Contains api-related changes');
            });

            it('should return empty string for no relevance', () => {
                const regularFile: FileChange = {
                    file: 'src/random.ts',
                    status: 'modified',
                    changes: 5,
                    insertions: 3,
                    deletions: 2
                };

                const relevance = promptBuilder['getFileRelevanceDescription'](regularFile, mockOptions.jiraTicket);
                expect(relevance).toBe('');
            });
        });

        describe('extractDiffSummary', () => {
            it('should extract diff summary correctly', () => {
                const diffContent = `diff --git a/src/test.ts b/src/test.ts
index 1234567..abcdefg 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,4 +1,6 @@
 line1
-line2
+line2 modified
+line3 added
 line4
+line5 added
diff --git a/src/utils.ts b/src/utils.ts
index 1234567..abcdefg 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,5 @@
 line1
-line2
+line2 modified
+line3 added`;

                const summary = promptBuilder['extractDiffSummary'](diffContent);

                expect(summary).toContain('b/src/test.ts: +3 -1');
                expect(summary).toContain('b/src/utils.ts: +2 -1');
            });

            it('should limit to first 20 files', () => {
                let diffContent = '';
                for (let i = 0; i < 25; i++) {
                    diffContent += `diff --git a/src/file${i}.ts b/src/file${i}.ts
index 1234567..abcdefg 100644
--- a/src/file${i}.ts
+++ b/src/file${i}.ts
@@ -1,1 +1,2 @@
 line1
+line2
`;
                }

                const summary = promptBuilder['extractDiffSummary'](diffContent);
                expect(summary).toHaveLength(20);
            });
        });

        describe('generateFileUrl', () => {
            it('should generate correct file URL', () => {
                const repoInfo = {
                    owner: 'testowner',
                    repo: 'testrepo',
                    currentBranch: 'feature/test'
                };

                const url = promptBuilder['generateFileUrl'](repoInfo, 'src/test.ts');
                expect(url).toBe('https://github.com/testowner/testrepo/blob/feature/test/src/test.ts');
            });
        });

        describe('generateLineUrl', () => {
            it('should generate correct line URL', () => {
                const repoInfo = {
                    owner: 'testowner',
                    repo: 'testrepo',
                    currentBranch: 'feature/test'
                };

                const url = promptBuilder['generateLineUrl'](repoInfo, 'src/test.ts', 10);
                expect(url).toBe('https://github.com/testowner/testrepo/blob/feature/test/src/test.ts#L10');
            });
        });

        describe('generateLineLinks', () => {
            it('should generate correct line links', () => {
                const repoInfo = {
                    owner: 'testowner',
                    repo: 'testrepo',
                    currentBranch: 'feature/test'
                };

                const links = promptBuilder['generateLineLinks'](repoInfo, 'src/test.ts', [10, 11, 12]);
                expect(links).toBe('https://github.com/testowner/testrepo/blob/feature/test/src/test.ts#L10, https://github.com/testowner/testrepo/blob/feature/test/src/test.ts#L11, https://github.com/testowner/testrepo/blob/feature/test/src/test.ts#L12');
            });

            it('should limit to first 10 line numbers', () => {
                const repoInfo = {
                    owner: 'testowner',
                    repo: 'testrepo',
                    currentBranch: 'feature/test'
                };

                const lineNumbers = Array.from({ length: 15 }, (_, i) => i + 1);
                const links = promptBuilder['generateLineLinks'](repoInfo, 'src/test.ts', lineNumbers);

                const linkCount = links.split(',').length;
                expect(linkCount).toBe(10);
            });
        });
    });
});
