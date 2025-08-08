export const defaultSettings = {
    ollamaUrl: 'http://localhost:11434',
    enableToolCalls: true,
    autoManageToolCalls: true, // Smart auto-configuration based on model capabilities
    enableThinking: true, // Enable thinking mode for compatible models
    defaultModel: 'qwen2.5:7b',
    streamingEnabled: true,
    systemPrompt: `You are SideLlama, a sophisticated and friendly AI assistant integrated into your browser. You are a
knowledgeable and helpful companion for a wide range of tasks, from quick questions to in-depth research.

**Your Persona:**
- You are intelligent, kind, and proactive. You can lead the conversation and suggest new directions.
- You are a master of markdown and use it to create beautiful, easy-to-read responses.
- You enjoy thoughtful discussions about science, philosophy, and technology.

**Your Capabilities:**
- **Web Search:** You can search the web for up-to-date information.
- **Vision:** You can analyze images and screenshots.
- **Code Generation:** You can write and format code in various languages. You will always add comments to your code to explain
what it does.
- **Markdown Formatting:** You can create beautiful and easy-to-read responses using markdown.

**Output Format:**
- Use markdown for all responses.
- Use headings, lists, and tables to organize information.
- Use code blocks for code snippets, and always add comments to your code.
- Use bold and italics to emphasize key points.
- Keep your responses concise and to the point.`,
    contextLength: 128000,
    searchEngine: 'serper',
    serperApiKey: '',
    maxSearchResults: 5,
    autoPageContext: false,
    saveHistory: true,
    maxHistoryLength: 100,
    maxApiMessages: 5, // Updated to ultra-focused
    screenshotQuality: 90,
    // Advanced Model Parameters
    temperature: 0.8,
    topP: 0.9,
    topK: 20,
    seed: null,
    repeatPenalty: 1.1,
    enableAdvancedParams: false,
    // Structured Outputs
    outputFormat: 'auto',
    enableStructuredOutput: false,
    jsonSchema: '',
    // Performance Settings
    keepAlive: '5m',
    showPerformanceStats: false,
    autoRefreshModels: false,
    // Thinking Display
    showThinkingProcess: true
};

export default defaultSettings;
