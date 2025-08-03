// SideLlama Service Worker - Final Corrected Version

// Import shared utilities
importScripts('shared-utils.js');
importScripts('model-utils.js');

class OllamaService {
    constructor() {
        this.baseURL = 'http://localhost:11434';
        this.settings = {};
        this.activeRequests = new Map(); // Track multiple concurrent requests by ID
        this.requestCounter = 0; // Generate unique request IDs
        this.modelUsageStats = new Map(); // Track model usage for smart preloading
        this.lastUsedModels = []; // Keep track of recently used models
        this.initializeService();
    }

    async initializeService() {
        await this.loadSettings();
        await this.loadModelUsageStats();
        console.log('🦙 SideLlama service initialized');
        
        // Preload the most frequently used model on startup
        this.preloadFrequentlyUsedModel();
    }

    async loadModelUsageStats() {
        try {
            const result = await chrome.storage.local.get('modelUsageStats');
            if (result.modelUsageStats) {
                this.modelUsageStats = new Map(result.modelUsageStats);
            }
        } catch (error) {
            console.error('Failed to load model usage stats:', error);
        }
    }

    async saveModelUsageStats() {
        try {
            // Limit the number of models tracked to prevent storage bloat
            const statsArray = Array.from(this.modelUsageStats.entries());
            const limitedStats = statsArray.slice(0, 20); // Keep only top 20 models
            
            await chrome.storage.local.set({
                modelUsageStats: limitedStats
            });
        } catch (error) {
            console.error('Failed to save model usage stats:', error);
        }
    }

    trackModelUsage(modelName) {
        // Update usage count
        const currentCount = this.modelUsageStats.get(modelName) || 0;
        this.modelUsageStats.set(modelName, currentCount + 1);
        
        // Update recently used models list
        this.lastUsedModels = this.lastUsedModels.filter(m => m !== modelName);
        this.lastUsedModels.unshift(modelName);
        if (this.lastUsedModels.length > 5) {
            this.lastUsedModels.pop();
        }
        
        // Save stats
        this.saveModelUsageStats();
        
        console.log(`🦙 Model usage tracked: ${modelName} (${currentCount + 1} times)`);
    }

    async preloadFrequentlyUsedModel() {
        if (this.modelUsageStats.size === 0) return;
        
        // Find the most frequently used model
        let mostUsedModel = '';
        let maxUsage = 0;
        
        for (const [model, usage] of this.modelUsageStats) {
            if (usage > maxUsage) {
                maxUsage = usage;
                mostUsedModel = model;
            }
        }
        
        if (mostUsedModel && maxUsage > 2) { // Only preload if used more than twice
            console.log(`🦙 Preloading frequently used model: ${mostUsedModel}`);
            await this.preloadModel(mostUsedModel);
        }
    }

    async preloadModel(modelName) {
        try {
            // Send empty message to load model into memory
            await fetch(`${this.baseURL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelName,
                    messages: [],
                    stream: false
                })
            });
            console.log(`🦙 Model preloaded: ${modelName}`);
        } catch (error) {
            console.warn(`Failed to preload model ${modelName}:`, error);
        }
    }

    async loadSettings() {
        const result = await chrome.storage.sync.get('sideLlamaSettings');
        
        // Default settings that match settings.js
        const defaultSettings = {
            ollamaUrl: 'http://localhost:11434',
            enableToolCalls: true,
            autoManageToolCalls: true, // Smart auto-configuration based on model capabilities
            enableThinking: true, // Enable thinking mode for compatible models
            defaultModel: 'qwen2.5:7b',
            streamingEnabled: true,
            systemPrompt: 'You are a helpful AI assistant named SideLlama.',
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
        
        this.settings = result.sideLlamaSettings || defaultSettings;
        
        // Merge any missing settings with defaults (for existing users)
        this.settings = { ...defaultSettings, ...this.settings };
    }

    trimMessagesToContextLimit(messages) {
        const maxMessages = this.settings.maxApiMessages || 5;
        
        // Simple approach: keep system prompt + last N messages
        if (messages.length <= maxMessages) {
            return messages;
        }
        
        // Find system prompt and preserve it
        const systemPrompt = messages.find(msg => msg.role === 'system');
        const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
        
        // Take the most recent messages (minus 1 slot for system prompt if it exists)
        const keepCount = systemPrompt ? maxMessages - 1 : maxMessages;
        const recentMessages = nonSystemMessages.slice(-keepCount);
        
        // Combine system prompt (if exists) + recent messages
        const result = systemPrompt ? [systemPrompt, ...recentMessages] : recentMessages;
        
        const trimmedCount = messages.length - result.length;
        if (trimmedCount > 0) {
            console.log(`🦙 Context trimmed: ${messages.length} → ${result.length} messages`);
            
            // Send context info to sidepanel for UI display
            this.sendToSidePanel({
                type: 'CONTEXT_INFO',
                data: {
                    messageCount: result.length,
                    trimmedCount: trimmedCount,
                    totalMessages: messages.length
                }
            });
        }
        
        return result;
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.baseURL}/api/tags`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return { status: 'connected' };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    async loadModels() {
        try {
            const response = await fetch(`${this.baseURL}/api/tags`);
            const data = await response.json();
            
            // Enhanced model info with capabilities
            const enhancedModels = (data.models || []).map(model => ({
                ...model,
                displayName: model.name,
                size: this.formatBytes(model.size),
                capabilities: this.getModelCapabilities(model),
                family: model.details?.family || 'unknown',
                parameterSize: model.details?.parameter_size || 'unknown'
            }));
            
            return { success: true, models: enhancedModels };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getModelCapabilities(model) {
        // Handle both model objects and model name strings
        const modelName = typeof model === 'string' ? model : model.name;
        // Use shared utility to eliminate code duplication
        return ModelUtils.getModelCapabilities(modelName);
    }

    isThinkingModel(modelName) {
        // Use shared utility to eliminate code duplication
        return ModelUtils.isThinkingModel(modelName);
    }

    formatBytes(bytes) {
        // Use shared utility to eliminate code duplication
        return SharedUtils.formatBytes(bytes);
    }

    async pullModel(modelName, progressCallback = null) {
        try {
            const response = await fetch(`${this.baseURL}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelName, stream: true })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (progressCallback) {
                            progressCallback(data);
                        }
                        if (data.status === 'success') {
                            return { success: true };
                        }
                    } catch (e) {
                        console.warn('Failed to parse pull progress:', line, e);
                    }
                }
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteModel(modelName) {
        try {
            const response = await fetch(`${this.baseURL}/api/delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelName })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getModelInfo(modelName) {
        try {
            const response = await fetch(`${this.baseURL}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelName })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const data = await response.json();
            return { success: true, modelInfo: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getRunningModels() {
        try {
            const response = await fetch(`${this.baseURL}/api/ps`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const data = await response.json();
            return { success: true, models: data.models || [] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendMessage(data, sender) {
        await this.loadSettings();
        const { message, model, context, messages, image, images, imageAttachments } = data;
        const streamingEnabled = this.settings.streamingEnabled;
        
        // Generate unique request ID for this request
        const requestId = ++this.requestCounter;
        
        // Track model usage for smart preloading
        this.trackModelUsage(model);
        
        // Get tab ID - handle both direct calls and sidepanel context
        let tabId = sender.tab?.id;
        if (!tabId) {
            // If no tab ID from sender, get active tab
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                tabId = tabs[0]?.id;
            } catch (error) {
                console.warn('Could not get active tab for context:', error);
            }
        }

        // Trim messages to fit context length - use 128k max with proper trimming
        let apiMessages = messages ? this.trimMessagesToContextLimit(messages) : [];
        
        // Always ensure system prompt is present and current
        const systemPromptContent = this.settings.systemPrompt || 'You are a helpful AI assistant named SideLlama.';
        const existingSystemMsg = apiMessages.find(msg => msg.role === 'system');
        
        if (existingSystemMsg) {
            // Update existing system prompt to latest settings
            existingSystemMsg.content = systemPromptContent;
            console.log('🦙 Updated system prompt:', systemPromptContent.substring(0, 100) + '...');
        } else {
            // Add system prompt at the beginning
            apiMessages.unshift({ role: 'system', content: systemPromptContent });
            console.log('🦙 Added system prompt:', systemPromptContent.substring(0, 100) + '...');
        }
        
        // Add the current user message (check for duplicates first)
        const lastMessage = apiMessages[apiMessages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== message) {
            apiMessages.push({ role: 'user', content: message });
        }

        // Handle images (new imageAttachments format, legacy images array, or single image)
        if (imageAttachments && imageAttachments.length > 0) {
            const lastUserMessage = apiMessages[apiMessages.length - 1];
            try {
                // Convert data URLs to base64 for Ollama API
                lastUserMessage.images = imageAttachments.map(att => {
                    if (!att.dataUrl || !att.dataUrl.includes(',')) {
                        throw new Error(`Invalid image data URL format for ${att.filename || 'unknown file'}`);
                    }
                    const base64Data = att.dataUrl.split(',')[1];
                    if (!base64Data) {
                        throw new Error(`No base64 data found for ${att.filename || 'unknown file'}`);
                    }
                    return base64Data;
                });
            } catch (error) {
                throw new Error(`Image processing failed: ${error.message}`);
            }
        } else if (images && images.length > 0) {
            const lastUserMessage = apiMessages[apiMessages.length - 1];
            lastUserMessage.images = images;
        } else if (image) {
            const lastUserMessage = apiMessages[apiMessages.length - 1];
            lastUserMessage.images = [image];
        }

        if (context) {
            apiMessages.splice(-1, 0, { role: 'system', content: `Context: ${context.title} - ${context.content.substring(0, 4000)}...` });
        }

        const requestBody = {
            model,
            messages: apiMessages,
            stream: streamingEnabled,
        };

        // Only add tools if enabled in settings, model supports tools, and no images are present
        // Images and tools can't be used together in most vision models
        const hasImages = apiMessages.some(msg => msg.images && msg.images.length > 0);
        const modelSupportsTools = ModelUtils.supportsTools(model);
        
        if (this.settings.enableToolCalls && modelSupportsTools && !hasImages) {
            requestBody.tools = this.getBuiltInTools();
        }

        // Add thinking support for thinking models
        if (this.isThinkingModel(model)) {
            requestBody.think = this.settings.enableThinking !== false; // Default to true for thinking models
        }

        // Add advanced parameters if enabled
        if (this.settings.enableAdvancedParams) {
            const options = {};
            
            if (this.settings.temperature !== undefined) {
                options.temperature = this.settings.temperature;
            }
            if (this.settings.topP !== undefined) {
                options.top_p = this.settings.topP;
            }
            if (this.settings.topK !== undefined) {
                options.top_k = this.settings.topK;
            }
            if (this.settings.repeatPenalty !== undefined) {
                options.repeat_penalty = this.settings.repeatPenalty;
            }
            if (this.settings.seed !== null && this.settings.seed !== undefined) {
                options.seed = this.settings.seed;
            }
            
            if (Object.keys(options).length > 0) {
                requestBody.options = options;
            }
        }

        // Add structured output formatting
        if (this.settings.enableStructuredOutput && this.settings.outputFormat !== 'auto') {
            if (this.settings.outputFormat === 'json') {
                requestBody.format = 'json';
            } else if (this.settings.outputFormat === 'schema' && this.settings.jsonSchema) {
                try {
                    // Validate JSON schema before sending
                    JSON.parse(this.settings.jsonSchema);
                    requestBody.format = this.settings.jsonSchema;
                } catch (error) {
                    console.warn('Invalid JSON schema, falling back to normal format:', error);
                }
            }
        }

        // Add keep-alive setting
        if (this.settings.keepAlive) {
            requestBody.keep_alive = this.settings.keepAlive;
        }


        try {
            // Create abort controller for this specific request
            const abortController = new AbortController();
            this.activeRequests.set(requestId, abortController);
            
            const response = await fetch(`${this.baseURL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: abortController.signal
            });

            if (!response.ok) {
                let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorBody = await response.text();
                    if (errorBody) {
                        errorDetail += ` - ${errorBody}`;
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
                throw new Error(errorDetail);
            }

            if (streamingEnabled) {
                await this.handleStreamingResponse(response, tabId, apiMessages, model);
            } else {
                const result = await response.json();
                if (result.message.tool_calls) {
                    await this.handleToolCalls(result.message.tool_calls, apiMessages, model, tabId);
                } else {
                    this.sendToSidePanel({ type: 'FINAL_RESPONSE', data: { success: true, message: result.message.content } });
                }
            }
            return { success: true };
        } catch (error) {
            if (error.name === 'AbortError') {
                this.sendToSidePanel({ type: 'FINAL_RESPONSE', data: { success: false, error: 'Generation stopped by user' } });
                return { success: false, error: 'Generation stopped by user' };
            }
            console.error('Failed to send message:', error);
            this.sendToSidePanel({ type: 'FINAL_RESPONSE', data: { success: false, error: error.message } });
            return { success: false, error: error.message };
        } finally {
            // Clean up the specific request
            this.activeRequests.delete(requestId);
        }
    }

    stopGeneration() {
        // Abort all active requests
        let abortedCount = 0;
        for (const [requestId, abortController] of this.activeRequests) {
            abortController.abort();
            abortedCount++;
        }
        this.activeRequests.clear();
        
        if (abortedCount > 0) {
            return { success: true, message: `Stopped ${abortedCount} active generation(s)` };
        } else {
            return { success: false, message: 'No active generation to stop' };
        }
    }

    async handleStreamingResponse(response, tabId, originalMessages, model) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let buffer = '';
        let toolCalls = [];
        
        // Performance tracking
        const startTime = Date.now();
        let tokenCount = 0;
        let firstTokenTime = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        
                        // Get the new content chunk
                        const newContent = data.message?.content || '';
                        if (newContent) {
                            fullResponse += newContent;
                            tokenCount += newContent.split(/\s+/).length; // Rough token estimation
                            if (!firstTokenTime) {
                                firstTokenTime = Date.now();
                            }
                        }
                        
                        if (data.message?.tool_calls) {
                            toolCalls = toolCalls.concat(data.message.tool_calls);
                        }
                        
                        // Send ONLY the new content chunk for natural streaming
                        const streamData = { 
                            content: newContent,  // Send raw content (including <think> tags)
                            done: data.done 
                        };
                        
                        // Only send if there's actual new content or it's done
                        if (newContent || data.done) {
                            this.sendToSidePanel({ 
                                type: 'STREAMING_RESPONSE', 
                                data: streamData
                            });
                        }
                        
                        if (data.done) {
                            // Calculate performance stats
                            const endTime = Date.now();
                            const totalTime = endTime - startTime;
                            const timeToFirstToken = firstTokenTime ? firstTokenTime - startTime : totalTime;
                            const tokensPerSecond = tokenCount > 0 ? (tokenCount / (totalTime / 1000)) : 0;
                            
                            // Send performance stats if enabled
                            if (this.settings.showPerformanceStats && tokenCount > 0) {
                                this.sendToSidePanel({
                                    type: 'PERFORMANCE_STATS',
                                    data: {
                                        totalTime,
                                        timeToFirstToken,
                                        tokenCount,
                                        tokensPerSecond: tokensPerSecond.toFixed(2),
                                        model
                                    }
                                });
                            }
                            
                            if (toolCalls.length > 0) {
                                await this.handleToolCalls(toolCalls, originalMessages, model, tabId);
                            }
                            return;
                        }
                    } catch (e) {
                        console.warn('Failed to parse streaming chunk:', line, e);
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                console.log('🛑 Stream aborted by user');
                this.sendToSidePanel({ type: 'FINAL_RESPONSE', data: { success: false, error: 'Generation stopped by user' } });
            } else {
                console.error('Streaming error:', error);
                this.sendToSidePanel({ type: 'FINAL_RESPONSE', data: { success: false, error: error.message || 'Streaming error occurred' } });
            }
        } finally {
            // Clean up reader
            try {
                reader.releaseLock();
            } catch (e) {
                // Reader may already be released
            }
        }
    }
    
    async handleToolCalls(toolCalls, originalMessages, model, tabId) {
        this.sendToSidePanel({ type: 'SYSTEM_MESSAGE', data: `🛠️ Using ${toolCalls.length} tool(s)...` });
        let toolMessages = [...originalMessages, { role: 'assistant', content: null, tool_calls: toolCalls }];

        for (const toolCall of toolCalls) {
            const toolResult = await this.executeToolCall(toolCall, tabId);
            toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult.result || { error: toolResult.error }) });
        }

        const finalRequestBody = { model, messages: toolMessages, stream: true };
        const finalResponse = await fetch(`${this.baseURL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalRequestBody)
        });

        if (!finalResponse.ok) throw new Error(`HTTP ${finalResponse.status}: ${finalResponse.statusText}`);
        await this.handleStreamingResponse(finalResponse, tabId, toolMessages, model);
    }

    getBuiltInTools() {
        return [
            { type: 'function', function: { name: 'web_search', description: 'Search the web for current information', parameters: { type: 'object', properties: { query: { type: 'string', description: 'The search query' } }, required: ['query'] } } },
            { type: 'function', function: { name: 'get_page_context', description: 'Get the context and content of the current webpage', parameters: { type: 'object', properties: {} } } }
        ];
    }

    async executeToolCall(toolCall, tabId) {
        const { name, arguments: args } = toolCall.function;
        try {
            switch (name) {
                case 'web_search': return await this.performWebSearch(args.query);
                case 'get_page_context': return await this.extractPageContext(tabId);
                default: return { success: false, error: `Unknown tool: ${name}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async performWebSearch(query) {
        try {
            const apiKey = this.settings.serperApiKey;
            if (!apiKey) {
                throw new Error('Serper API key not configured. Please add your API key in settings.');
            }
            
            // Validate and sanitize search query
            const sanitizedQuery = this.sanitizeSearchQuery(query);
            if (!sanitizedQuery) {
                throw new Error('Invalid search query provided.');
            }
            
            const response = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ q: sanitizedQuery }) });
            if (!response.ok) throw new Error(`Serper API error: ${response.status}`);
            const data = await response.json();
            return { success: true, result: data.organic || [] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    sanitizeSearchQuery(query) {
        if (!query || typeof query !== 'string') {
            return null;
        }
        
        // Trim and limit length
        const trimmed = query.trim();
        if (trimmed.length === 0 || trimmed.length > 500) {
            return null;
        }
        
        // Remove potentially dangerous characters while keeping useful ones
        const sanitized = trimmed
            .replace(/[<>'"&\x00-\x1F\x7F]/g, '') // Remove HTML/control chars
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        
        return sanitized.length > 0 ? sanitized : null;
    }

    async extractPageContext(tabId) {
        try {
            if (!tabId) throw new Error('Tab ID not available');
            
            // Use content script to extract page context properly
            const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    // Try to get cached context first
                    const cached = sessionStorage.getItem('sideLlamaPageContext');
                    if (cached) {
                        return JSON.parse(cached);
                    }
                    
                    // Extract page content if not cached
                    return {
                        title: document.title || 'Untitled Page',
                        url: window.location.href,
                        content: document.body.innerText.substring(0, 8000),
                        timestamp: Date.now()
                    };
                }
            });
            
            if (!result?.result) {
                throw new Error('No content extracted from page');
            }
            
            return { success: true, context: result.result };
        } catch (error) {
            console.error('Failed to extract page context:', error);
            return { success: false, error: error.message };
        }
    }

    async takeScreenshot(tabId = null) {
        try {
            console.log('🖼️ Starting screenshot capture...', { tabId });
            
            // Get the window ID from the tab if tabId is provided
            let windowId = null;
            if (tabId) {
                const tab = await chrome.tabs.get(tabId);
                windowId = tab.windowId;
            }
            
            // chrome.tabs.captureVisibleTab captures the active tab in the specified window
            const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { 
                format: 'png', 
                quality: 90 
            });
            
            if (!dataUrl) {
                throw new Error('Failed to capture screenshot - no data returned');
            }
            
            console.log('✅ Screenshot captured successfully, size:', dataUrl.length);
            return { success: true, result: { dataUrl } };
        } catch (error) {
            console.error('❌ Screenshot error:', error);
            
            // Provide more helpful error messages
            let errorMessage = error.message;
            if (error.message.includes('activeTab') || error.message.includes('permission')) {
                errorMessage = 'Missing activeTab permission. Please make sure the extension has access to the current tab.';
            } else if (error.message.includes('cannot capture') || error.message.includes('chrome://') || error.message.includes('chrome-extension://')) {
                errorMessage = 'Cannot capture screenshot of this page (chrome:// pages and extension pages are not allowed)';
            } else if (error.message.includes('No tab with id')) {
                errorMessage = 'Tab not found or no longer exists';
            }
            
            return { success: false, error: errorMessage };
        }
    }

    sendToSidePanel(message) {
        chrome.runtime.sendMessage(message).catch(err => {
            if (!err.message.includes('Receiving end does not exist')) {
                console.error('Send to sidepanel error:', err);
            }
        });
    }
}

const ollamaService = new OllamaService();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handleAsync = async () => {
        switch (request.type) {
            case 'CHECK_OLLAMA_STATUS': return await ollamaService.checkConnection();
            case 'GET_MODELS': return await ollamaService.loadModels();
            case 'SEND_MESSAGE': return await ollamaService.sendMessage(request.data, sender);
            case 'STOP_GENERATION': return ollamaService.stopGeneration();
            case 'EXTRACT_PAGE_CONTEXT': 
                // Get the current active tab since sidepanel doesn't have tab context
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tabs.length) {
                    return { success: false, error: 'No active tab found' };
                }
                return await ollamaService.extractPageContext(tabs[0].id);
            case 'WEB_SEARCH':
                const searchResult = await ollamaService.performWebSearch(request.query);
                return { success: searchResult.success, results: searchResult.result || [] };
            case 'TAKE_SCREENSHOT':
                // Get the current active tab to ensure proper context
                const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!currentTabs.length) {
                    return { success: false, error: 'No active tab found' };
                }
                return await ollamaService.takeScreenshot(currentTabs[0].id);
            case 'EXECUTE_TOOL':
                if (request.toolCall?.function?.name === 'take_screenshot') {
                    // takeScreenshot automatically captures the active tab
                    return await ollamaService.takeScreenshot();
                }
                return { success: false, error: 'Unknown tool' };
            case 'OPEN_SETTINGS': chrome.runtime.openOptionsPage(); return { success: true };
            case 'GET_SETTINGS': await ollamaService.loadSettings(); return { success: true, settings: ollamaService.settings };
            case 'SETTINGS_UPDATED': 
                await ollamaService.loadSettings(); 
                console.log('🦙 Settings reloaded in service worker');
                return { success: true };
            case 'PULL_MODEL': 
                const pullResult = await ollamaService.pullModel(request.modelName, (progress) => {
                    // Send progress updates to sidepanel
                    ollamaService.sendToSidePanel({
                        type: 'MODEL_PULL_PROGRESS',
                        data: progress
                    });
                });
                return pullResult;
            case 'DELETE_MODEL': 
                return await ollamaService.deleteModel(request.modelName);
            case 'GET_MODEL_INFO': 
                return await ollamaService.getModelInfo(request.modelName);
            case 'GET_RUNNING_MODELS':
                return await ollamaService.getRunningModels();
            case 'OPEN_SIDE_PANEL':
                // Open sidepanel when keyboard shortcut is used
                const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTabs.length > 0) {
                    await chrome.sidePanel.open({ tabId: activeTabs[0].id });
                }
                return { success: true };
            case 'SUMMARIZE_PAGE':
                // Handle keyboard shortcut for page summarization
                const activeTabsForSummary = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTabsForSummary.length > 0) {
                    await chrome.sidePanel.open({ tabId: activeTabsForSummary[0].id });
                    // Give sidepanel time to load then trigger summarization
                    setTimeout(async () => {
                        try {
                            const contextResult = await ollamaService.extractPageContext(activeTabsForSummary[0].id);
                            if (contextResult.success) {
                                const context = contextResult.context;
                                const summaryPrompt = `Please provide a concise summary of this webpage:\n\n**Title:** ${context.title}\n**URL:** ${context.url}\n\n**Content:**\n${context.content}`;
                                
                                ollamaService.sendToSidePanel({
                                    type: 'ADD_USER_MESSAGE',
                                    data: { message: `📄 Summarize this page: ${context.title}` }
                                });
                                
                                ollamaService.sendToSidePanel({
                                    type: 'SEND_AI_MESSAGE',
                                    data: { 
                                        message: summaryPrompt,
                                        context: context
                                    }
                                });
                            }
                        } catch (error) {
                            console.error('Failed to summarize page:', error);
                        }
                    }, 500);
                }
                return { success: true };
            case 'EXPLAIN_SELECTION':
                // Handle keyboard shortcut for selection explanation
                const activeTabsForExplain = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTabsForExplain.length > 0 && request.selection) {
                    await chrome.sidePanel.open({ tabId: activeTabsForExplain[0].id });
                    // Give sidepanel time to load then trigger explanation
                    setTimeout(async () => {
                        try {
                            const contextResult = await ollamaService.extractPageContext(activeTabsForExplain[0].id);
                            const context = contextResult.success ? contextResult.context : { title: 'Unknown Page', content: '' };
                            
                            const explanationPrompt = `Please explain this selected text from the webpage "${context.title}":\n\n**Selected Text:**\n"${request.selection}"\n\n**Page Context:**\n${context.content.substring(0, 2000)}`;
                            
                            ollamaService.sendToSidePanel({
                                type: 'ADD_USER_MESSAGE',
                                data: { message: `🔍 Explain: "${request.selection}"` }
                            });
                            
                            ollamaService.sendToSidePanel({
                                type: 'SEND_AI_MESSAGE',
                                data: { 
                                    message: explanationPrompt,
                                    context: context
                                }
                            });
                        } catch (error) {
                            console.error('Failed to explain selection:', error);
                        }
                    }, 500);
                }
                return { success: true };
            default: return { success: false, error: 'Unknown request type' };
        }
    };
    handleAsync().then(sendResponse);
    return true;
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'sidellama-parent',
        title: 'SideLlama',
        contexts: ['page', 'selection']
    });
    
    chrome.contextMenus.create({
        id: 'sidellama-open',
        parentId: 'sidellama-parent',
        title: 'Open SideLlama',
        contexts: ['page']
    });
    
    chrome.contextMenus.create({
        id: 'sidellama-summarize',
        parentId: 'sidellama-parent', 
        title: 'Summarize page',
        contexts: ['page']
    });
    
    chrome.contextMenus.create({
        id: 'sidellama-explain',
        parentId: 'sidellama-parent',
        title: 'Explain selection', 
        contexts: ['selection']
    });
    
    chrome.contextMenus.create({
        id: 'sidellama-screenshot',
        parentId: 'sidellama-parent',
        title: 'Take Screenshot',
        contexts: ['page']
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
    
    // Give the sidepanel time to load
    await new Promise(resolve => setTimeout(resolve, 500));

    switch (info.menuItemId) {
        case 'sidellama-open':
            // Just opening the panel is enough
            break;
            
        case 'sidellama-summarize':
            try {
                // Extract page context
                const contextResult = await ollamaService.extractPageContext(tab.id);
                if (contextResult.success) {
                    const context = contextResult.context;
                    const summaryPrompt = `Please provide a concise summary of this webpage:\n\n**Title:** ${context.title}\n**URL:** ${context.url}\n\n**Content:**\n${context.content}`;
                    
                    // Send the message directly to sidepanel as if user typed it
                    ollamaService.sendToSidePanel({
                        type: 'ADD_USER_MESSAGE',
                        data: { message: `📄 Summarize this page: ${context.title}` }
                    });
                    
                    // Send AI request using current conversation
                    ollamaService.sendToSidePanel({
                        type: 'SEND_AI_MESSAGE',
                        data: { 
                            message: summaryPrompt,
                            context: context
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to summarize page:', error);
                ollamaService.sendToSidePanel({
                    type: 'SYSTEM_MESSAGE',
                    data: `❌ Failed to summarize page: ${error.message}`
                });
            }
            break;
            
        case 'sidellama-explain':
            if (info.selectionText) {
                try {
                    console.log('Explaining selection:', info.selectionText);
                    
                    // Get page context for better explanation
                    const contextResult = await ollamaService.extractPageContext(tab.id);
                    const context = contextResult.success ? contextResult.context : { title: 'Unknown Page', content: '' };
                    
                    console.log('Got context for explanation:', context.title);
                    
                    const explanationPrompt = `Please explain this selected text from the webpage "${context.title}":\n\n**Selected Text:**\n"${info.selectionText}"\n\n**Page Context:**\n${context.content.substring(0, 2000)}`;
                    
                    // Send the user message to sidepanel chat
                    ollamaService.sendToSidePanel({
                        type: 'ADD_USER_MESSAGE',
                        data: { message: `🔍 Explain: "${info.selectionText}"` }
                    });
                    
                    // Send AI request using current conversation
                    ollamaService.sendToSidePanel({
                        type: 'SEND_AI_MESSAGE',
                        data: { 
                            message: explanationPrompt,
                            context: context
                        }
                    });
                } catch (error) {
                    console.error('Failed to explain selection:', error);
                    ollamaService.sendToSidePanel({
                        type: 'SYSTEM_MESSAGE',
                        data: `❌ Failed to explain selection: ${error.message}`
                    });
                }
            } else {
                console.log('No selection text found');
                ollamaService.sendToSidePanel({
                    type: 'SYSTEM_MESSAGE',
                    data: '❌ No text selected for explanation'
                });
            }
            break;
        
        case 'sidellama-screenshot':
            try {
                console.log('Taking screenshot for current tab');
                const screenshotResult = await ollamaService.takeScreenshot(tab.id);
                console.log('Screenshot result:', screenshotResult);
                
                if (screenshotResult.success) {
                    // Send screenshot to sidepanel
                    ollamaService.sendToSidePanel({
                        type: 'DISPLAY_SCREENSHOT',
                        dataUrl: screenshotResult.result.dataUrl
                    });
                } else {
                    console.error('Screenshot failed:', screenshotResult.error);
                    // Send error to sidepanel
                    ollamaService.sendToSidePanel({
                        type: 'SYSTEM_MESSAGE',
                        data: `❌ Screenshot failed: ${screenshotResult.error}`
                    });
                }
            } catch (error) {
                console.error('Failed to take screenshot:', error);
                // Send error to sidepanel
                ollamaService.sendToSidePanel({
                    type: 'SYSTEM_MESSAGE',
                    data: `Screenshot error: ${error.message}`
                });
            }
            break;
    }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
