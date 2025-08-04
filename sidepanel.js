// SideLlama Side Panel JavaScript - Final Corrected Version

class SideLlamaChat {
    constructor() {
        this.currentConversationId = 'conv_' + Date.now();
        this.currentModel = 'qwen2.5:7b'; // Default fallback, will be updated from settings
        this.isTyping = false;
        this.currentlySendingMessage = false; // Track if we're in the middle of sendMessage()
        
        // Track event listeners for cleanup
        this.eventListeners = new Map();
        this.boundMethods = new Map();
        this.messages = [];
        this.contextEnabled = false;
        this.searchEnabled = false;
        this.currentContext = null;
        
        // Simple streaming system (like working old version)
        this.streamingMessageElement = null;
        
        // Attachment system
        this.pendingAttachments = [];
        
        // Stop functionality
        this.currentAbortController = null;
        
        this.settings = { 
            streamingEnabled: true, // Enable streaming by default for better UX
            systemPrompt: '',
            serperApiKey: ''
        };

        this.initializeElements();
        this.bindEvents();
        this.loadSettings().then(() => {
            this.loadInitialData();
        });
        this.setupMessageListener();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.stopButton = document.getElementById('stopButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.currentModelDisplay = document.getElementById('currentModel');
        this.contextStatus = document.getElementById('contextStatus');
        this.menuButton = document.getElementById('menuButton');
        this.dropdownMenu = document.getElementById('dropdownMenu');
        this.modelSelectBtn = document.getElementById('modelSelectBtn');
        this.deleteHistoryBtn = document.getElementById('deleteHistoryBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        
        // Toolbar buttons
        this.contextToggle = document.getElementById('contextToggle');
        this.searchToggle = document.getElementById('searchToggle');
        
        // Other elements
        this.fileInput = document.getElementById('fileInput');
        this.searchContainer = document.getElementById('searchContainer');
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.contextIndicator = document.getElementById('contextIndicator');
        this.contextText = document.getElementById('contextText');
        this.contextClose = document.getElementById('contextClose');
        
        // Quick model switching elements
        this.quickModelSelect = document.getElementById('quickModelSelect');
        this.quickModelName = document.getElementById('quickModelName');
        this.quickModelDropdown = document.getElementById('quickModelDropdown');
        this.modelCapabilities = document.getElementById('modelCapabilities');
        
        // Attachment elements
        this.attachmentsPreview = document.getElementById('attachmentsPreview');
        this.attachmentsList = document.getElementById('attachmentsList');
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get('sideLlamaSettings');
            const savedSettings = result.sideLlamaSettings || {};
            
            // Update current model from settings
            if (savedSettings.defaultModel) {
                this.currentModel = savedSettings.defaultModel;
            }
            
            // Merge with existing settings
            this.settings = {
                ...this.settings,
                ...savedSettings
            };
            
            // Load conversation history if enabled
            if (this.settings.saveHistory !== false) {
                await this.loadConversationHistory();
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    // Helper methods for managing event listeners to prevent memory leaks
    addEventListenerTracked(element, event, handler, options = false) {
        const key = `${element.constructor.name}_${event}_${Math.random()}`;
        this.eventListeners.set(key, { element, event, handler, options });
        element.addEventListener(event, handler, options);
        return key;
    }

    removeEventListenerTracked(key) {
        const listener = this.eventListeners.get(key);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            this.eventListeners.delete(key);
        }
    }

    cleanup() {
        // Remove all tracked event listeners
        for (const [key, listener] of this.eventListeners) {
            listener.element.removeEventListener(listener.event, listener.handler, listener.options);
        }
        this.eventListeners.clear();
        this.boundMethods.clear();
    }

    async loadConversationHistory() {
        try {
            const result = await chrome.storage.local.get('sideLlamaConversation');
            const savedConversation = result.sideLlamaConversation;
            
            if (savedConversation && savedConversation.messages && savedConversation.messages.length > 0) {
                this.messages = savedConversation.messages;
                this.currentConversationId = savedConversation.id || this.currentConversationId;
                
                // Rebuild UI from saved messages
                this.rebuildConversationUI();
                
                console.log(`🦙 Loaded ${this.messages.length} messages from conversation history`);
            }
        } catch (error) {
            console.error('Failed to load conversation history:', error);
        }
    }

    async saveConversationHistory() {
        try {
            if (this.settings.saveHistory === false) {
                return;
            }
            
            // Trim messages to stay within context limits if needed
            const trimmedMessages = this.trimMessagesToContextLimit(this.messages);
            
            const conversationData = {
                id: this.currentConversationId,
                messages: trimmedMessages,
                lastUpdated: Date.now()
            };
            
            await chrome.storage.local.set({ sideLlamaConversation: conversationData });
        } catch (error) {
            console.error('Failed to save conversation history:', error);
        }
    }

    trimMessagesToContextLimit(messages) {
        const contextLength = this.settings.contextLength || 128000;
        const maxHistoryLength = this.settings.maxHistoryLength || 100;
        
        // First, limit by number of messages (O(1) operation)
        if (messages.length <= maxHistoryLength) {
            return messages; // No trimming needed
        }
        
        let trimmedMessages = messages.slice(-maxHistoryLength);
        
        // Fast character estimation with early exit
        const maxChars = contextLength * 3; // Leave buffer space
        let totalChars = 0;
        
        // Count from the end, exit early if under limit
        for (let i = trimmedMessages.length - 1; i >= 0; i--) {
            const messageChars = (trimmedMessages[i].content || '').length;
            totalChars += messageChars;
            
            // Early exit if we're way under the limit (optimization)
            if (i < trimmedMessages.length - 10 && totalChars < maxChars * 0.5) {
                break; // No need to count everything if we're well under limit
            }
            
            if (totalChars > maxChars) {
                // Keep system messages when trimming
                const systemMsgs = trimmedMessages.slice(0, i + 1).filter(msg => msg.role === 'system');
                const recentMsgs = trimmedMessages.slice(i + 1);
                return [...systemMsgs, ...recentMsgs];
            }
        }
        
        return trimmedMessages;
    }

    rebuildConversationUI() {
        // Clear existing UI but keep typing indicator
        const existingIndicator = this.typingIndicator.cloneNode(true);
        this.messagesContainer.innerHTML = '';
        
        // Rebuild messages from history
        this.messages.forEach(msg => {
            if (msg.role === 'user') {
                this.createMessage('user', msg.content, { saveHistory: false });
            } else if (msg.role === 'assistant') {
                this.createMessage('assistant', msg.content, { saveHistory: false });
            } else if (msg.role === 'system') {
                this.createMessage('system', msg.content, { saveHistory: false });
            }
        });
        
        // Re-add typing indicator
        this.messagesContainer.appendChild(existingIndicator);
        this.scrollToBottom();
    }

    async saveModelToSettings(modelName) {
        try {
            const result = await chrome.storage.sync.get('sideLlamaSettings');
            const settings = result.sideLlamaSettings || {};
            settings.defaultModel = modelName;
            
            await chrome.storage.sync.set({ sideLlamaSettings: settings });
            this.settings.defaultModel = modelName;
        } catch (error) {
            console.error('Failed to save model to settings:', error);
        }
    }

    bindEvents() {
        // Use tracked event listeners to prevent memory leaks
        this.addEventListenerTracked(this.sendButton, 'click', () => this.sendMessage());
        this.addEventListenerTracked(this.stopButton, 'click', () => this.stopGeneration());
        this.addEventListenerTracked(this.messageInput, 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.addEventListenerTracked(this.menuButton, 'click', (e) => { e.stopPropagation(); this.toggleMenu(); });
        this.addEventListenerTracked(document, 'click', () => { this.closeMenu(); });
        this.addEventListenerTracked(this.modelSelectBtn, 'click', () => { this.toggleModelSelector(); this.closeMenu(); });
        this.addEventListenerTracked(this.deleteHistoryBtn, 'click', () => { this.clearChat(); this.closeMenu(); });
        this.addEventListenerTracked(this.settingsBtn, 'click', () => { this.openSettings(); this.closeMenu(); });
        
        // Toolbar button events
        this.addEventListenerTracked(this.contextToggle, 'click', () => {
            this.togglePageContext();
        });
        
        this.addEventListenerTracked(this.searchToggle, 'click', () => {
            this.toggleWebSearch();
        });
        
        
        // File input events
        this.addEventListenerTracked(this.fileInput, 'change', (e) => {
            this.handleFileUpload(e);
        });
        
        // Search events
        this.addEventListenerTracked(this.searchButton, 'click', () => {
            this.performWebSearch();
        });
        
        this.addEventListenerTracked(this.searchInput, 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performWebSearch();
            }
        });
        
        // Context indicator close
        this.addEventListenerTracked(this.contextClose, 'click', () => {
            this.contextEnabled = false;
            this.currentContext = null;
            this.contextIndicator.style.display = 'none';
            this.contextToggle.style.color = '';
        });
        
        // Quick model switching events
        this.addEventListenerTracked(this.quickModelSelect, 'click', (e) => {
            e.stopPropagation();
            this.toggleQuickModelDropdown();
        });
        
        // Close dropdown when clicking outside
        this.addEventListenerTracked(document, 'click', (e) => {
            if (!this.quickModelSelect.contains(e.target)) {
                this.closeQuickModelDropdown();
            }
        });
        
        // Image paste functionality - only handle on document level to avoid duplication
        this.addEventListenerTracked(document, 'paste', (e) => {
            // Only handle if focus is on message input or somewhere else in sidepanel
            if (document.activeElement === this.messageInput || !e.target.closest('input, textarea')) {
                this.handlePaste(e);
            }
        });
        
        // Drag and drop functionality
        this.addEventListenerTracked(this.messageInput, 'dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.messageInput.style.backgroundColor = 'var(--accent)';
        });
        
        this.addEventListenerTracked(this.messageInput, 'dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.messageInput.style.backgroundColor = '';
        });
        
        this.addEventListenerTracked(this.messageInput, 'drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.messageInput.style.backgroundColor = '';
            this.handleDrop(e);
        });

        // Cleanup on page unload to prevent memory leaks
        this.addEventListenerTracked(window, 'beforeunload', () => {
            this.cleanup();
        });
    }

    async loadInitialData() {
        try {
            const settingsResult = await this.sendChromeMessage({ type: 'GET_SETTINGS' });
            if (settingsResult.success) {
                this.settings = { ...this.settings, ...settingsResult.settings };
            }
            const status = await this.sendChromeMessage({ type: 'CHECK_OLLAMA_STATUS' });
            if (status.status !== 'connected') {
                this.showError('Ollama connection failed.');
            }
            
            // Update UI with loaded model
            this.updateModelDisplay();
            
            // Initialize model capabilities display
            this.updateModelCapabilitiesDisplay();
            
            // Initialize input placeholder
            this.updateInputPlaceholder();
        } catch (error) {
            this.showError('Initialization failed.');
            console.error(error);
        }
    }
    
    updateModelDisplay() {
        // Update all model display elements
        if (this.currentModelDisplay) {
            this.currentModelDisplay.textContent = this.currentModel;
        }
        if (this.quickModelName) {
            this.quickModelName.textContent = this.currentModel;
        }
    }

    updateModelCapabilitiesDisplay() {
        const capabilities = this.getModelCapabilitiesFromName(this.currentModel);
        if (this.modelCapabilities) {
            this.modelCapabilities.textContent = capabilities.join(' • ');
        }
    }

    setupMessageListener() {
        if (typeof chrome === 'undefined' || !chrome.runtime) return;
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                switch (message.type) {
                    case 'STREAMING_RESPONSE':
                        this.handleStreamingResponse(message.data);
                        break;
                    case 'FINAL_RESPONSE':
                        this.handleUnifiedResponse(message.data);
                        break;
                    case 'CONTEXT_INFO':
                        this.showContextStatus(message.data.messageCount, message.data.trimmedCount);
                        break;
                    case 'SYSTEM_MESSAGE':
                        this.addSystemMessage(message.data);
                        break;
                    case 'ADD_USER_MESSAGE':
                        this.addUserMessageWithAttachments(message.data.message);
                        break;
                    case 'SEND_AI_MESSAGE':
                        this.handleAIMessageRequest(message.data);
                        break;
                    case 'CONTEXT_MENU_ACTION':
                        this.handleContextMenuAction(message.data);
                        break;
                    case 'MODEL_PULL_PROGRESS':
                        this.handleModelPullProgress(message.data);
                        break;
                    case 'CONTEXT_MENU_SCREENSHOT':
                        const attachmentId = `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const filename = `screenshot-${timestamp}.png`;
                        const dataUrl = message.dataUrl;

                        // Estimate size from dataUrl length (base64 is ~4/3 of original size)
                        const size = dataUrl.length * 0.75;

                        const attachment = {
                            id: attachmentId,
                            file: null, // No file object available
                            filename: filename,
                            type: 'image/png',
                            dataUrl: dataUrl,
                            size: size,
                            isTextFile: false
                        };
                        
                        this.pendingAttachments.push(attachment);
                        this.renderAttachmentPreview(attachment);
                        this.showAttachmentsPreview();
                        this.addSystemMessage('📸 Screenshot added to message input.');
                        break;
                }
            }
            catch (error) {
                console.error('Error handling message:', error);
                this.showError('Error processing message.');
            }
            // No return true needed as we are not using sendResponse in the sidepanel
        });
    }

    async handleContextMenuAction(data) {
        const { action, selectionText } = data;
        const contextResult = await this.sendChromeMessage({ type: 'EXTRACT_PAGE_CONTEXT' });
        if (!contextResult.success) {
            this.showError('Failed to get page context.');
            return;
        }
        const context = contextResult.context;
        let prompt = '';
        let userMessage = '';

        if (action === 'summarize') {
            userMessage = `📄 Summarize this page: ${context.title}`;
            prompt = `Please provide a concise summary of this webpage:\n\n**Title:** ${context.title}\n**URL:** ${context.url}\n\n**Content:**\n${context.content}`;
        }
        else if (action === 'explain' && selectionText) {
            userMessage = `🔍 Explain: "${selectionText.substring(0, 50)}..."`;
            prompt = `Please explain this selected text from the webpage "${context.title}":\n\n**Selected Text:**\n"${selectionText}"\n\n**Page Context:**\n${context.content.substring(0, 2000)}`;
        }

        if (prompt) {
            this.addUserMessageWithAttachments(userMessage);
            this.showTyping();
            this.sendChromeMessage({
                type: 'SEND_MESSAGE',
                data: { message: prompt, model: this.currentModel, messages: this.messages, context }
            }).catch(error => {
                this.hideTyping();
                this.showError(error.message);
            });
        }
    }


    // ===== SIMPLE STREAMING SYSTEM (WORKING VERSION) =====
    
    prepareStreamingMessage() {
        // Create streaming message element (like old working version)
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = `
            <div class="flex flex-col gap-2 p-3">
                <div class="flex items-center gap-2">
                    <span class="relative flex shrink-0 overflow-hidden ring-border size-6 rounded-lg bg-white p-0.5 ring">
                        <div class="aspect-square size-full bg-blue-500 rounded flex items-center justify-center text-white text-xs">
                            🤖
                        </div>
                    </span>
                    <div class="font-mono text-xs font-bold">${this.currentModel}</div>
                </div>
                <div class="flex flex-col gap-1">
                    <div class="text-sm">
                        <p class="mb-4 whitespace-pre-wrap last:mb-0 streaming-content"></p>
                    </div>
                    <div class="text-muted-foreground text-xs">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>
        `;
        
        // Insert before typing indicator to maintain proper order
        if (this.typingIndicator && this.typingIndicator.parentNode === this.messagesContainer) {
            this.messagesContainer.insertBefore(messageDiv, this.typingIndicator);
        } else {
            this.messagesContainer.appendChild(messageDiv);
        }
        
        this.streamingMessageElement = messageDiv.querySelector('.streaming-content');
        
        // Don't fully hide typing yet - keep stop button visible during streaming
        // Only hide the typing indicator dots, but keep stop button active
        const typingElement = document.getElementById('typingIndicator');
        if (typingElement) {
            typingElement.classList.remove('show');
        }
        
        this.scrollToBottom();
    }

    handleStreamingResponse(data) {
        if (!this.streamingMessageElement) {
            this.prepareStreamingMessage();
        }
        
        if (this.streamingMessageElement) {
            // Simple streaming - just add content to the message
            
            // For natural streaming, only append NEW content, not the full response
            if (data.content && data.content.length > 0) {
                // Append only the new chunk for natural character-by-character display
                this.streamingMessageElement.textContent += data.content;
                this.scrollToBottom();
            }
            
            if (data.done) {
                // Streaming is complete - cleanup and re-enable input
                this.finishStreaming();
            }
        }
    }
    
    finishStreaming() {
        // CRITICAL FIX: Clear sending flag when streaming is complete
        this.currentlySendingMessage = false;
        // Clean up streaming state
        this.hideTyping();  // This will hide stop button and show send button
        this.hideThinkingIndicator();
        
        // Save the final message to conversation history
        if (this.streamingMessageElement && this.streamingMessageElement.textContent.trim()) {
            this.messages.push({ 
                role: 'assistant', 
                content: this.streamingMessageElement.textContent.trim(), 
                timestamp: Date.now() 
            });
            this.saveConversationHistory();
        }
        
        this.streamingMessageElement = null;
        this.enableUserInput();
        console.log('🦙 Streaming completed - input re-enabled');
    }
    
    showThinkingIndicator(thinkingText) {
        let thinkingDiv = document.getElementById('thinkingIndicator');
        if (!thinkingDiv) {
            thinkingDiv = document.createElement('div');
            thinkingDiv.id = 'thinkingIndicator';
            thinkingDiv.className = 'thinking-indicator p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-2';
            thinkingDiv.innerHTML = `
                <div class="flex items-center justify-between cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180')">
                    <div class="text-xs font-semibold text-blue-400">🧠 AI Thinking Process</div>
                    <svg class="chevron w-3 h-3 text-blue-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
                <div class="thinking-content hidden text-xs text-blue-300 max-h-32 overflow-y-auto mt-2 font-mono whitespace-pre-wrap bg-black/20 p-2 rounded border border-blue-500/20"></div>
            `;
            
            // Insert before typing indicator
            if (this.typingIndicator && this.typingIndicator.parentNode === this.messagesContainer) {
                this.messagesContainer.insertBefore(thinkingDiv, this.typingIndicator);
            } else {
                this.messagesContainer.appendChild(thinkingDiv);
            }
        }
        
        const thinkingContent = thinkingDiv.querySelector('.thinking-content');
        if (thinkingContent) {
            thinkingContent.textContent = thinkingText;
        }
        
        this.scrollToBottom();
    }
    

    hideThinkingIndicator() {
        const thinkingDiv = document.getElementById('thinkingIndicator');
        if (thinkingDiv) {
            thinkingDiv.remove();
        }
    }

    showContextStatus(messageCount = null, trimmedCount = null) {
        if (!this.contextStatus) return;
        
        let statusText = '📝 Context: Processing conversation history';
        if (messageCount && trimmedCount) {
            statusText = `📝 Context: Sending ${messageCount} messages (${trimmedCount} summarized)`;
        } else if (messageCount) {
            statusText = `📝 Context: Sending ${messageCount} recent messages`;
        }
        
        this.contextStatus.textContent = statusText;
        this.contextStatus.classList.remove('hidden');
    }

    hideContextStatus() {
        if (this.contextStatus) {
            this.contextStatus.classList.add('hidden');
        }
    }

    handleUnifiedResponse(data) {
        // CRITICAL FIX: Clear sending flag when response is complete
        this.currentlySendingMessage = false;
        this.hideTyping();
        this.hideContextStatus();
        this.enableUserInput(); // Re-enable input for non-streaming responses
        
        if (data.success && data.message && data.message.trim()) {
            this.addAssistantMessage(data.message);
        }
        else if (!data.success) {
            this.showError(data.error || 'An unknown error occurred.');
        }
    }
    
    handleAIMessageRequest(data) {
        // Handle AI message requests from service worker (context menus, etc.)
        this.showTyping();
        
        // Send the AI request through the normal message system
        this.sendChromeMessage({
            type: 'SEND_MESSAGE',
            data: {
                message: data.message,
                model: data.model || this.currentModel,
                context: data.context,
                conversationId: data.conversationId || this.currentConversationId,
                stream: this.settings.streamingEnabled,
                messages: this.messages
            }
        }).catch(error => {
            this.hideTyping();
            this.showError('Failed to send AI request: ' + error.message);
        });
    }




    // ===== UNIFIED MESSAGE DISPLAY SYSTEM =====
    
    createMessage(role, content = '', options = {}) {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-item';
        messageDiv.id = messageId;
        
        if (role === 'user') {
            messageDiv.innerHTML = `
                <div class="flex justify-end p-3">
                    <div class="max-w-[80%] flex flex-col space-y-1">
                        <div class="bg-muted rounded-2xl rounded-br-sm px-4 py-2">
                            <div class="text-sm whitespace-pre-wrap">${this.formatText(content)}</div>
                        </div>
                        <div class="text-muted-foreground text-xs text-right">${timestamp}</div>
                    </div>
                </div>
            `;
        } else if (role === 'assistant') {
            messageDiv.innerHTML = `
                <div class="flex flex-col gap-2 p-3">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xs">🤖</div>
                        <div class="font-mono text-xs font-bold">${this.currentModel}</div>
                        <div class="text-xs text-muted-foreground ml-auto">${timestamp}</div>
                    </div>
                    <div class="message-content text-sm">
                        <div class="content-text whitespace-pre-wrap ${options.streaming ? 'streaming' : ''} ${options.typing ? 'typing' : ''}">${this.formatText(content)}</div>
                    </div>
                </div>
            `;
        } else if (role === 'system') {
            messageDiv.innerHTML = `
                <div class="flex justify-center p-2">
                    <div class="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        ${this.formatText(content)}
                    </div>
                </div>
            `;
        }
        
        // Add to container before typing indicator (maintains proper order)
        if (this.typingIndicator && this.typingIndicator.parentNode === this.messagesContainer) {
            this.messagesContainer.insertBefore(messageDiv, this.typingIndicator);
        } else {
            this.messagesContainer.appendChild(messageDiv);
        }
        this.scrollToBottom();
        
        // Add to conversation history (except system messages and typing indicators)
        if (role !== 'system' && !options.typing && options.saveHistory !== false) {
            this.messages.push({ role, content, timestamp });
            // Auto-save conversation history
            this.saveConversationHistory();
        }
        
        return messageDiv;
    }
    
    updateMessage(messageElement, content) {
        const contentElement = messageElement.querySelector('.content-text');
        if (contentElement) {
            contentElement.innerHTML = this.formatText(content);
            this.scrollToBottom();
        }
    }
    
    formatText(text) {
        if (text === null || text === undefined) return '';
        
        let html = this.escapeHtml(String(text))
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: hsl(var(--muted)); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>')
            .replace(/\n/g, '<br>');
        
        // Secure link handling with URL sanitization
        html = html.replace(/https?:\/\/[^\s<]+/g, (match) => {
            const sanitizedUrl = this.sanitizeUrl(match);
            if (sanitizedUrl) {
                return `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${this.escapeHtml(match)}</a>`;
            }
            return this.escapeHtml(match); // Return as plain text if invalid
        });
        
        return html;
    }

    sanitizeUrl(url) {
        try {
            const parsed = new URL(url);
            // Only allow http and https protocols
            if (['http:', 'https:'].includes(parsed.protocol)) {
                return parsed.href;
            }
            return null; // Reject javascript:, data:, etc.
        } catch (e) {
            return null; // Invalid URL
        }
    }
    
    escapeHtml(text) {
        // Use shared utility to eliminate code duplication
        return SharedUtils.escapeHtml(text);
    }
    
    
    addAssistantMessage(content, streaming = false) {
        return this.createMessage('assistant', content, { streaming });
    }
    
    addSystemMessage(content) {
        return this.createMessage('system', content);
    }
    
    showError(message) {
        // Skip showing user-initiated stop messages as errors since we handle them separately
        if (typeof message === 'string' && message.includes('Generation stopped by user')) {
            return; // Don't show user stops as errors
        }
        
        // Clean up the error message to prevent duplication
        let cleanMessage = message;
        if (typeof message === 'string') {
            // Remove existing "❌ Error:" prefix if present
            cleanMessage = message.replace(/^❌\s*Error:\s*/i, '');
            // Remove "HTTP 400: Bad Request - " prefix that might be duplicated
            cleanMessage = cleanMessage.replace(/^HTTP \d{3}:\s*[^-]*-\s*/, '');
        }
        this.addSystemMessage(`❌ Error: ${cleanMessage}`);
    }

    toggleSearch() {
        this.searchContainer.style.display = this.searchContainer.style.display === 'none' ? 'block' : 'none';
    }
    
    async sendChromeMessage(message, options = {}) {
        const { 
            expectSuccess = false, 
            showErrorToUser = false, 
            customErrorMessage = null 
        } = options;
        
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    const error = new Error(chrome.runtime.lastError.message);
                    if (showErrorToUser) {
                        this.showError(customErrorMessage || error.message);
                    }
                    return reject(error);
                }
                
                // Auto-handle success checking and error display
                if (expectSuccess && response && !response.success) {
                    const error = new Error(response.error || 'Operation failed');
                    if (showErrorToUser) {
                        this.showError(customErrorMessage || response.error || 'Operation failed');
                    }
                    return reject(error);
                }
                
                resolve(response);
            });
        });
    }

    // Page Context Methods
    async togglePageContext() {
        this.contextEnabled = !this.contextEnabled;
        
        if (this.contextEnabled) {
            try {
                const response = await this.sendChromeMessage({ type: 'EXTRACT_PAGE_CONTEXT' });
                if (response.success) {
                    this.currentContext = response.context; // Fixed: use response.context
                    this.contextIndicator.style.display = 'flex';
                    this.contextText.textContent = `Context: ${this.currentContext.title}`;
                    this.contextToggle.style.color = '#22c55e';
                    this.addSystemMessage(`📄 Page context enabled: ${this.currentContext.title}`);
                } else {
                    this.contextEnabled = false;
                    this.showError('Failed to extract page context: ' + (response.error || 'Unknown error'));
                }
            } catch (error) {
                this.contextEnabled = false;
                this.showError('Failed to extract page context: ' + error.message);
            }
        } else {
            this.currentContext = null;
            this.contextIndicator.style.display = 'none';
            this.contextToggle.style.color = '';
            this.addSystemMessage('📄 Page context disabled');
        }
    }

    // Web Search Methods  
    toggleWebSearch() {
        this.searchEnabled = !this.searchEnabled;
        
        if (this.searchEnabled) {
            this.searchContainer.style.display = 'block';
            this.searchToggle.style.color = '#3b82f6';
            this.addSystemMessage('🔍 Web search enabled');
        } else {
            this.searchContainer.style.display = 'none';
            this.searchToggle.style.color = '';
            this.addSystemMessage('🔍 Web search disabled');
        }
    }

    async performWebSearch() {
        const query = this.searchInput.value.trim();
        if (!query) return;
        
        try {
            this.addSystemMessage(`🔍 Searching for: ${query}`);
            
            const response = await this.sendChromeMessage({
                type: 'WEB_SEARCH',
                query: query,
                maxResults: 5
            });
            
            if (response.success && response.results.length > 0) {
                // Format search results for AI context
                let searchContext = `Search results for "${query}":\n\n`;
                response.results.forEach((result, index) => {
                    searchContext += `${index + 1}. **${result.title}**\n`;
                    searchContext += `   ${result.snippet}\n`;
                    searchContext += `   Source: ${result.link}\n\n`;
                });
                
                // Add user message showing the search
                this.addUserMessageWithAttachments(`🔍 Search: ${query}`);
                
                // Send search results to AI for analysis
                this.disableUserInput();
                this.showTyping();
                
                const aiResponse = await this.sendChromeMessage({
                    type: 'SEND_MESSAGE',
                    data: {
                        message: `Please analyze and summarize these search results:\n\n${searchContext}`,
                        model: this.currentModel,
                        conversationId: this.currentConversationId,
                        stream: this.settings.streamingEnabled,
                        messages: this.messages
                    }
                });
                
                // Clear search input
                this.searchInput.value = '';
                
                if (!aiResponse.success) {
                    this.hideTyping();
                    this.enableUserInput();
                    this.showError('Failed to analyze search results: ' + (aiResponse.error || 'Unknown error'));
                }
            } else {
                this.addSystemMessage('❌ No search results found');
            }
        } catch (error) {
            this.showError('Search failed: ' + error.message);
        }
    }

    displaySearchResults(results) {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'search-results';
        
        const header = document.createElement('div');
        header.innerHTML = `<strong>🔍 Search Results (${results.length})</strong>`;
        resultsDiv.appendChild(header);

        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'search-result';
            
            // Create elements safely with textContent instead of innerHTML
            const link = document.createElement('a');
            link.href = this.sanitizeUrl(result.link) || '#';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'search-result-title';
            link.textContent = result.title || 'Untitled';
            
            const snippet = document.createElement('div');
            snippet.className = 'search-result-snippet';
            snippet.textContent = result.snippet || '';
            
            resultDiv.appendChild(link);
            resultDiv.appendChild(snippet);
            resultsDiv.appendChild(resultDiv);
        });

        // Insert before typing indicator to maintain proper order
        if (this.typingIndicator && this.typingIndicator.parentNode === this.messagesContainer) {
            this.messagesContainer.insertBefore(resultsDiv, this.typingIndicator);
        } else {
            this.messagesContainer.appendChild(resultsDiv);
        }
        this.scrollToBottom();
    }

    // Screenshot Methods
    async takeScreenshot() {
        try {
            this.addSystemMessage('📸 Taking screenshot...');
            
            const response = await this.sendChromeMessage({
                type: 'TAKE_SCREENSHOT'
            });
            
            if (response.success) {
                // Auto-paste screenshot into chat for AI analysis
                this.addUserMessageWithAttachments('📸 Screenshot captured - please analyze this image');
                
                // Send screenshot to AI for analysis if using vision model
                const supportsVision = this.currentModel.toLowerCase().includes('vision') || 
                                      this.currentModel.toLowerCase().includes('llava') ||
                                      this.currentModel.toLowerCase().includes('qwen2-vl');
                
                if (supportsVision) {
                    this.disableUserInput();
                    this.showTyping();
                    
                    const aiResponse = await this.sendChromeMessage({
                        type: 'SEND_MESSAGE',
                        data: {
                            message: 'Please analyze this screenshot and describe what you see.',
                            model: this.currentModel,
                            conversationId: this.currentConversationId,
                            stream: this.settings.streamingEnabled,
                            messages: this.messages,
                            images: [response.result.dataUrl.split(',')[1]]
                        }
                    });
                    
                    if (!aiResponse.success) {
                        this.hideTyping();
                        this.enableUserInput();
                        this.showError('Failed to analyze screenshot: ' + (aiResponse.error || 'Unknown error'));
                    }
                } else {
                    // If not a vision model, just display the screenshot
                    this.displayScreenshot(response.result.dataUrl);
                    this.addSystemMessage('💡 Tip: Use a vision model like qwen2-vl:7b or llava for automatic image analysis');
                }
            } else {
                // Check if it's a permission issue
                if (response.needsPermission) {
                    this.showError('📸 Screenshot permission needed: Please right-click on the page and select "SideLlama → Take Screenshot" to grant permission.');
                    this.addSystemMessage('💡 Tip: Context menu screenshots work because they automatically grant the required permissions.');
                } else {
                    this.showError('Screenshot failed: ' + (response.error || 'Unknown error'));
                }
            }
        } catch (error) {
            this.showError('Screenshot failed: ' + error.message);
        }
    }

    // Screenshot Methods - Used by context menu
    async takeScreenshot() {
        try {
            this.addSystemMessage('📸 Taking screenshot...');
            
            const response = await this.sendChromeMessage({
                type: 'TAKE_SCREENSHOT'
            });
            
            if (response.success) {
                // Auto-paste screenshot into chat for AI analysis
                this.addUserMessageWithAttachments('📸 Screenshot captured - please analyze this image');
                
                // Send screenshot to AI for analysis if using vision model
                const supportsVision = this.currentModel.toLowerCase().includes('vision') || 
                                      this.currentModel.toLowerCase().includes('llava') ||
                                      this.currentModel.toLowerCase().includes('qwen2-vl');
                
                if (supportsVision) {
                    this.disableUserInput();
                    this.showTyping();
                    
                    const aiResponse = await this.sendChromeMessage({
                        type: 'SEND_MESSAGE',
                        data: {
                            message: 'Please analyze this screenshot and describe what you see.',
                            model: this.currentModel,
                            conversationId: this.currentConversationId,
                            stream: this.settings.streamingEnabled,
                            messages: this.messages,
                            images: [response.result.dataUrl.split(',')[1]]
                        }
                    });
                    
                    if (!aiResponse.success) {
                        this.hideTyping();
                        this.enableUserInput();
                        this.showError('Failed to analyze screenshot: ' + (aiResponse.error || 'Unknown error'));
                    }
                } else {
                    // If not a vision model, just display the screenshot
                    this.displayScreenshot(response.result.dataUrl);
                    this.addSystemMessage('💡 Tip: Use a vision model like qwen2-vl:7b or llava for automatic image analysis');
                }
            } else {
                // Check if it's a permission issue
                if (response.needsPermission) {
                    this.showError('📸 Screenshot permission needed: Please right-click on the page and select "SideLlama → Take Screenshot" to grant permission.');
                    this.addSystemMessage('💡 Tip: Context menu screenshots work because they automatically grant the required permissions.');
                } else {
                    this.showError('Screenshot failed: ' + (response.error || 'Unknown error'));
                }
            }
        } catch (error) {
            this.showError('Screenshot failed: ' + error.message);
        }
    }

    displayScreenshot(dataUrl) {
        const screenshotDiv = document.createElement('div');
        screenshotDiv.className = 'screenshot-display p-3';
        
        screenshotDiv.innerHTML = `
            <div class="border border-border rounded-lg overflow-hidden">
                <img src="${dataUrl}" alt="Screenshot" class="w-full max-w-sm mx-auto rounded-lg">
                <div class="p-2 text-xs text-muted-foreground text-center">
                    📸 Screenshot captured - Click to enlarge
                </div>
            </div>
        `;
        
        const img = screenshotDiv.querySelector('img');
        img.addEventListener('click', () => {
            const newTab = window.open();
            newTab.document.write(`<img src="${dataUrl}" style="max-width: 100%; height: auto;">`);
        });
        
        // Insert before typing indicator to maintain proper order
        if (this.typingIndicator && this.typingIndicator.parentNode === this.messagesContainer) {
            this.messagesContainer.insertBefore(screenshotDiv, this.typingIndicator);
        } else {
            this.messagesContainer.appendChild(screenshotDiv);
        }
        this.scrollToBottom();
    }

    // File Upload Methods
    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        files.forEach(file => {
            this.addAttachment(file, file.name);
        });
        
        // Clear the input
        event.target.value = '';
    }

    // Image Paste Methods
    handlePaste(event) {
        const clipboardData = event.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const items = Array.from(clipboardData.items);
        const fileItems = items.filter(item => item.type.startsWith('image/') || item.type.startsWith('application/') || item.type.startsWith('text/plain'));
        
        if (fileItems.length > 0) {
            // Check if we have files (not just text)
            const hasFiles = fileItems.some(item => !item.type.startsWith('text/plain'));
            
            if (hasFiles) {
                event.preventDefault(); // Prevent default paste behavior for files
                
                fileItems.forEach((item, index) => {
                    if (item.type.startsWith('text/plain')) return; // Skip plain text
                    
                    const file = item.getAsFile();
                    if (file) {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const extension = file.type.split('/')[1] || 'file';
                        const filename = `pasted-${timestamp}-${index + 1}.${extension}`;
                        
                        this.addAttachment(file, filename);
                    }
                });
            }
        }
        // For text paste, let the normal behavior continue
    }

    // Drag and Drop Methods
    handleDrop(event) {
        const files = Array.from(event.dataTransfer.files);
        
        if (files.length > 0) {
            files.forEach(file => {
                this.addAttachment(file, file.name);
            });
        }
    }

    // Attachment Management
    addAttachment(file, filename) {
        const attachmentId = `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Check if it's a text-based file
        const isTextFile = this.isTextFile(file, filename);
        
        if (isTextFile) {
            // Read as text for text files
            const textReader = new FileReader();
            textReader.onload = (e) => {
                const attachment = {
                    id: attachmentId,
                    file: file,
                    filename: filename,
                    type: file.type,
                    size: file.size,
                    content: e.target.result,
                    isTextFile: true
                };
                
                this.pendingAttachments.push(attachment);
                this.renderAttachmentPreview(attachment);
                this.showAttachmentsPreview();
            };
            textReader.readAsText(file);
        } else {
            // Read as data URL for images and other files
            const reader = new FileReader();
            reader.onload = (e) => {
                const attachment = {
                    id: attachmentId,
                    file: file,
                    filename: filename,
                    type: file.type,
                    dataUrl: e.target.result,
                    size: file.size,
                    isTextFile: false
                };
                
                this.pendingAttachments.push(attachment);
                this.renderAttachmentPreview(attachment);
                this.showAttachmentsPreview();
            };
            reader.readAsDataURL(file);
        }
    }

    isTextFile(file, filename) {
        const textTypes = [
            'text/plain', 'text/markdown', 'text/html', 'text/css', 'text/javascript',
            'application/json', 'application/xml', 'text/xml'
        ];
        
        const textExtensions = [
            '.txt', '.md', '.js', '.py', '.html', '.css', '.json', '.xml', '.yaml', '.yml',
            '.csv', '.log', '.sql', '.sh', '.bat', '.php', '.rb', '.go', '.rs', '.java',
            '.cpp', '.c', '.h', '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.ini', '.conf'
        ];
        
        // Check by MIME type
        if (textTypes.includes(file.type)) {
            return true;
        }
        
        // Check by file extension
        const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return textExtensions.includes(extension);
    }

    renderAttachmentPreview(attachment) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'attachment-preview';
        previewDiv.dataset.attachmentId = attachment.id;
        
        let content = '';
        if (attachment.type.startsWith('image/')) {
            content = `<img src="${attachment.dataUrl}" alt="${attachment.filename}" title="${attachment.filename}">`;
        } else if (attachment.isTextFile && attachment.content) {
            // Show text content preview
            const previewText = attachment.content.length > 100 
                ? attachment.content.substring(0, 100) + '...' 
                : attachment.content;
            const icon = this.getFileIcon(attachment.type, attachment.filename);
            content = `
                <div class="text-file-preview" title="${attachment.filename}">
                    <div class="file-header">
                        <span class="file-icon">${icon}</span>
                        <span class="file-name">${attachment.filename}</span>
                    </div>
                    <div class="file-content-preview">${this.escapeHtml(previewText)}</div>
                </div>
            `;
        } else {
            // File icon for other files
            const icon = this.getFileIcon(attachment.type, attachment.filename);
            content = `<div class="attachment-icon" title="${attachment.filename}">${icon}<br><small>${attachment.filename}</small></div>`;
        }
        
        previewDiv.innerHTML = `
            ${content}
            <div class="attachment-remove" data-attachment-id="${attachment.id}" title="Remove">×</div>
        `;
        
        // Add remove event
        previewDiv.querySelector('.attachment-remove').addEventListener('click', () => {
            this.removeAttachment(attachment.id);
        });
        
        this.attachmentsList.appendChild(previewDiv);
    }

    getFileIcon(mimeType, filename = '') {
        const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        
        // Check by file extension first (more specific)
        switch (extension) {
            case '.js': case '.jsx': case '.ts': case '.tsx': return '⚡';
            case '.py': return '🐍';
            case '.java': return '☕';
            case '.cpp': case '.c': case '.h': return '⚙️';
            case '.php': return '🐘';
            case '.rb': return '💎';
            case '.go': return '🐹';
            case '.rs': return '🦀';
            case '.html': case '.htm': return '🌐';
            case '.css': return '🎨';
            case '.json': return '📋';
            case '.xml': return '📄';
            case '.md': return '📖';
            case '.txt': case '.log': return '📝';
            case '.csv': return '📊';
            case '.sql': return '🗃️';
            case '.yml': case '.yaml': return '⚙️';
            case '.sh': case '.bat': return '⚡';
        }
        
        // Fall back to MIME type
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('text')) return '📝';
        if (mimeType.includes('word')) return '📄';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋';
        if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
        return '📎';
    }

    removeAttachment(attachmentId) {
        // Remove from pending attachments
        this.pendingAttachments = this.pendingAttachments.filter(att => att.id !== attachmentId);
        
        // Remove from DOM
        const previewElement = document.querySelector(`[data-attachment-id="${attachmentId}"]`);
        if (previewElement) {
            previewElement.remove();
        }
        
        // Hide attachments preview if empty
        if (this.pendingAttachments.length === 0) {
            this.hideAttachmentsPreview();
        }
    }

    showAttachmentsPreview() {
        this.attachmentsPreview.classList.remove('hidden');
    }

    hideAttachmentsPreview() {
        this.attachmentsPreview.classList.add('hidden');
    }

    clearAttachments() {
        this.pendingAttachments = [];
        this.attachmentsList.innerHTML = '';
        this.hideAttachmentsPreview();
    }



    // UI Helper Methods
    toggleMenu() {
        this.dropdownMenu.classList.toggle('show');
    }

    closeMenu() {
        this.dropdownMenu.classList.remove('show');
    }

    toggleModelSelector() {
        // Load and display model selector with management options
        this.showModelSelector();
    }

    async showModelSelector() {
        try {
            // Get current models using enhanced sendChromeMessage
            const response = await this.sendChromeMessage(
                { type: 'GET_MODELS' }, 
                { expectSuccess: true, showErrorToUser: true, customErrorMessage: 'Failed to load models' }
            );
            this.displayModelSelector(response.models);
        } catch (error) {
            // Error already shown to user by sendChromeMessage
            console.error('Model loading failed:', error);
        }
    }

    displayModelSelector(models) {
        // Create model selector overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-hidden flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">Model Selector</h3>
                    <button class="close-selector text-gray-500 hover:text-gray-700">✕</button>
                </div>
                
                <div class="mb-4">
                    <div class="flex gap-2">
                        <input type="text" class="model-input flex-1 px-3 py-2 border rounded" placeholder="Model name (e.g., qwen2.5:7b)">
                        <button class="pull-model-btn bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Pull</button>
                    </div>
                </div>
                
                <div class="flex-1 overflow-y-auto">
                    <div class="models-list"></div>
                </div>
            </div>
        `;

        // Add model list
        const modelsList = overlay.querySelector('.models-list');
        models.forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item p-3 border-b cursor-pointer hover:bg-gray-50 flex justify-between items-center';
            
            const isSelected = model.name === this.currentModel;
            
            modelItem.innerHTML = `
                <div class="flex-1" data-model="${model.name}">
                    <div class="flex items-center gap-2">
                        <div class="radio ${isSelected ? 'selected' : ''}"></div>
                        <div>
                            <div class="font-medium">${model.displayName}</div>
                            <div class="text-sm text-gray-500">
                                ${model.capabilities.join(' • ')} • ${model.size} • ${model.parameterSize}
                            </div>
                        </div>
                    </div>
                </div>
                <button class="delete-model text-red-500 hover:text-red-700 ml-2" data-model="${model.name}">🗑️</button>
            `;
            
            modelsList.appendChild(modelItem);
        });

        // Add event listeners
        overlay.querySelector('.close-selector').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.pull-model-btn').addEventListener('click', () => this.handlePullModel(overlay));
        
        overlay.querySelectorAll('.model-item > div').forEach(item => {
            item.addEventListener('click', () => {
                const modelName = item.dataset.model;
                this.selectModel(modelName);
                overlay.remove();
            });
        });

        overlay.querySelectorAll('.delete-model').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const modelName = btn.dataset.model;
                this.handleDeleteModel(modelName, overlay);
            });
        });

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        document.body.appendChild(overlay);
    }

    async handlePullModel(overlay) {
        const input = overlay.querySelector('.model-input');
        const modelName = input.value.trim();
        if (!modelName) return;

        try {
            this.addSystemMessage(`📥 Pulling model: ${modelName}...`);
            
            const response = await this.sendChromeMessage({
                type: 'PULL_MODEL',
                modelName: modelName
            });

            if (response.success) {
                this.addSystemMessage(`✅ Successfully pulled model: ${modelName}`);
                input.value = '';
                // Refresh model list
                setTimeout(() => this.showModelSelector(), 1000);
                overlay.remove();
            } else {
                this.showError('Failed to pull model: ' + response.error);
            }
        } catch (error) {
            this.showError('Failed to pull model: ' + error.message);
        }
    }

    async handleDeleteModel(modelName, overlay) {
        if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;

        try {
            this.addSystemMessage(`🗑️ Deleting model: ${modelName}...`);
            
            const response = await this.sendChromeMessage({
                type: 'DELETE_MODEL',
                modelName: modelName
            });

            if (response.success) {
                this.addSystemMessage(`✅ Successfully deleted model: ${modelName}`);
                // Refresh model list
                setTimeout(() => this.showModelSelector(), 1000);
                overlay.remove();
            } else {
                this.showError('Failed to delete model: ' + response.error);
            }
        } catch (error) {
            this.showError('Failed to delete model: ' + error.message);
        }
    }

    handleModelPullProgress(data) {
        // Show pull progress in real-time
        if (data.status && data.status.includes('downloading')) {
            const percent = data.completed && data.total ? 
                Math.round((data.completed / data.total) * 100) : 0;
            this.addSystemMessage(`📥 Downloading: ${percent}% (${data.status})`);
        } else if (data.status) {
            this.addSystemMessage(`📥 ${data.status}`);
        }
    }

    async selectModel(modelName) {
        // CRITICAL FIX: Only stop generation if we're switching models outside of a sendMessage() flow
        // Don't stop generation if we're in the middle of sending a message (model auto-switch)
        if (this.isTyping && !this.currentlySendingMessage) {
            console.log('🛑 Stopping generation before model switch');
            await this.stopGeneration();
        } else if (this.isTyping && this.currentlySendingMessage) {
            console.log('🔄 Model switching during message send - not stopping generation');
        }
        
        this.currentModel = modelName;
        
        // Smart tool call auto-configuration based on model capabilities
        await this.autoConfigureToolCalls(modelName);
        
        // Save to settings
        await this.saveModelToSettings(modelName);
        
        // Get model info to show capabilities
        try {
            const modelInfo = await this.sendChromeMessage({ 
                type: 'GET_MODEL_INFO', 
                modelName: modelName 
            });
            
            if (modelInfo.success) {
                // Show model with capabilities
                const capabilities = this.getModelCapabilitiesFromName(modelName);
                this.currentModelDisplay.innerHTML = `
                    <span class="font-medium">${modelName}</span>
                    <div class="text-xs text-gray-500">${capabilities.join(' • ')}</div>
                `;
            } else {
                this.currentModelDisplay.textContent = modelName;
            }
        } catch (error) {
            this.currentModelDisplay.textContent = modelName;
        }
        
        // Update input placeholder based on new model capabilities
        this.updateInputPlaceholder();
        
        this.addSystemMessage(`🔄 Switched to ${modelName}`);
    }

    getModelCapabilitiesFromName(modelName) {
        // Use shared utility to eliminate code duplication
        return ModelUtils.getModelCapabilities(modelName);
    }

    async autoConfigureToolCalls(modelName) {
        // Smart auto-configuration of tool calls based on model capabilities
        const isVisionModel = ModelUtils.supportsVision(modelName);
        const isToolModel = ModelUtils.supportsTools(modelName);
        
        // Get current settings to check if we should auto-manage
        const result = await chrome.storage.sync.get('sideLlamaSettings');
        const currentSettings = result.sideLlamaSettings || {};
        
        // Only auto-configure if user hasn't manually overridden (default: auto-manage enabled)
        const autoManage = currentSettings.autoManageToolCalls !== false;
        
        // CRITICAL FIX: Add grace period to prevent overriding recent manual changes
        const lastManualChange = currentSettings.lastManualToolCallsChange || 0;
        const gracePeriod = 30000; // 30 seconds grace period
        const recentManualChange = (Date.now() - lastManualChange) < gracePeriod;
        
        if (autoManage && !recentManualChange) {
            let newToolCallsState = currentSettings.enableToolCalls;
            let message = '';
            
            if (isVisionModel && currentSettings.enableToolCalls) {
                // Vision model detected - turn OFF tool calls
                newToolCallsState = false;
                message = '🔧 Auto-disabled tool calls (vision model detected)';
            } else if (isToolModel && !isVisionModel && !currentSettings.enableToolCalls) {
                // Tool-capable model detected - turn ON tool calls
                newToolCallsState = true;
                message = '🔧 Auto-enabled tool calls (tool-capable model detected)';
            }
            
            // Update settings if changed
            if (newToolCallsState !== currentSettings.enableToolCalls) {
                const updatedSettings = {
                    ...currentSettings,
                    enableToolCalls: newToolCallsState
                };
                
                await chrome.storage.sync.set({ sideLlamaSettings: updatedSettings });
                this.settings.enableToolCalls = newToolCallsState;
                
                // Notify user about auto-adjustment
                this.addSystemMessage(message + ' (override in settings)');
                
                // Inform service worker of setting change
                await this.sendChromeMessage({
                    type: 'SETTINGS_UPDATED',
                    settings: updatedSettings
                });
            }
        }
    }

    // ===== QUICK MODEL SWITCHING =====
    
    async toggleQuickModelDropdown() {
        if (this.quickModelDropdown.classList.contains('show')) {
            this.closeQuickModelDropdown();
        } else {
            await this.showQuickModelDropdown();
        }
    }
    
    closeQuickModelDropdown() {
        this.quickModelDropdown.classList.remove('show');
    }
    
    async showQuickModelDropdown() {
        try {
            // Get current models using enhanced sendChromeMessage
            const response = await this.sendChromeMessage(
                { type: 'GET_MODELS' }, 
                { expectSuccess: true, showErrorToUser: true, customErrorMessage: 'Failed to load models' }
            );
            this.populateQuickModelDropdown(response.models);
            this.quickModelDropdown.classList.add('show');
        } catch (error) {
            // Error already shown to user by sendChromeMessage
            console.error('Quick model loading failed:', error);
        }
    }
    
    populateQuickModelDropdown(models) {
        this.quickModelDropdown.innerHTML = '';
        
        // Add header with manage option
        const header = document.createElement('div');
        header.className = 'quick-model-item border-b-2 border-border';
        header.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <span class="text-xs font-semibold text-muted-foreground">Quick Switch</span>
                <button class="text-xs text-primary hover:text-primary/80" id="manageModelsBtn">Manage</button>
            </div>
        `;
        this.quickModelDropdown.appendChild(header);
        
        // Add manage button event
        header.querySelector('#manageModelsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeQuickModelDropdown();
            this.toggleModelSelector();
        });
        
        // Add model options
        models.forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = `quick-model-item ${model.name === this.currentModel ? 'selected' : ''}`;
            
            const capabilities = this.getModelCapabilitiesFromName(model.name);
            const displayName = model.name.length > 20 ? model.name.substring(0, 18) + '...' : model.name;
            
            modelItem.innerHTML = `
                <div class="model-name">
                    <span class="font-medium">${displayName}</span>
                    <div class="model-badges">
                        ${capabilities.slice(0, 2).map(cap => `<span class="model-badge">${cap}</span>`).join('')}
                    </div>
                </div>
                <div class="model-size">${model.size || 'Unknown'}</div>
            `;
            
            modelItem.addEventListener('click', () => {
                this.quickSelectModel(model.name);
                this.closeQuickModelDropdown();
            });
            
            this.quickModelDropdown.appendChild(modelItem);
        });
    }
    
    async quickSelectModel(modelName) {
        // CRITICAL FIX: Only stop generation if we're switching models outside of a sendMessage() flow
        if (this.isTyping && !this.currentlySendingMessage) {
            console.log('🛑 Stopping generation before quick model switch');
            await this.stopGeneration();
        } else if (this.isTyping && this.currentlySendingMessage) {
            console.log('🔄 Quick model switching during message send - not stopping generation');
        }
        
        // Update current model
        this.currentModel = modelName;
        
        // Smart tool call auto-configuration based on model capabilities
        await this.autoConfigureToolCalls(modelName);
        
        // Save to settings
        await this.saveModelToSettings(modelName);
        
        // Update UI elements
        this.quickModelName.textContent = modelName;
        this.currentModelDisplay.textContent = modelName;
        
        // Update capabilities display
        const capabilities = this.getModelCapabilitiesFromName(modelName);
        this.modelCapabilities.textContent = capabilities.join(' • ');
        
        // Update typing indicator model name
        const typingModelName = document.getElementById('typingModelName');
        if (typingModelName) {
            typingModelName.textContent = modelName;
        }
        
        // Update input placeholder based on new model capabilities
        this.updateInputPlaceholder();
        
        // Show system message
        this.addSystemMessage(`🔄 Quick switched to ${modelName}`);
        
        console.log(`🦙 Quick switched to model: ${modelName}`);
    }

    async clearChat() {
        // Clear all messages
        this.messagesContainer.innerHTML = '';
        this.messages = [];
        this.currentConversationId = 'conv_' + Date.now();
        
        // Clear saved conversation history
        try {
            await chrome.storage.local.remove('sideLlamaConversation');
        } catch (error) {
            console.error('Failed to clear saved conversation:', error);
        }
        
        this.addSystemMessage('🗑️ Chat history cleared.');
    }

    openSettings() {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }

    showTyping() {
        this.isTyping = true;
        const typingElement = document.getElementById('typingIndicator');
        if (typingElement) {
            typingElement.classList.add('show');
        }
        this.sendButton.disabled = true;
        this.sendButton.classList.add('hidden');
        this.stopButton.classList.remove('hidden');
        this.scrollToBottom();
    }

    hideTyping() {
        this.isTyping = false;
        const typingElement = document.getElementById('typingIndicator');
        if (typingElement) {
            typingElement.classList.remove('show');
        }
        this.sendButton.disabled = false;
        this.sendButton.classList.remove('hidden');
        this.stopButton.classList.add('hidden');
        this.hideContextStatus(); // Hide context status when response is complete
    }

    async stopGeneration() {
        try {
            const response = await this.sendChromeMessage({
                type: 'STOP_GENERATION'
            });
            
            this.hideTyping();
            if (response.success) {
                this.addSystemMessage('⏹️ Generation stopped by user');
            } else {
                this.addSystemMessage('⚠️ No active generation to stop');
            }
        } catch (error) {
            this.hideTyping();
            this.addSystemMessage('❌ Failed to stop generation');
        }
    }
    
    disableUserInput() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
        this.messageInput.placeholder = "SideLlama is responding...";
    }
    
    enableUserInput() {
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        this.updateInputPlaceholder();
        this.messageInput.focus(); // Focus back to input when done
    }
    
    updateInputPlaceholder() {
        const supportsVision = this.currentModel.toLowerCase().includes('vision') || 
                              this.currentModel.toLowerCase().includes('llava') ||
                              this.currentModel.toLowerCase().includes('qwen2-vl');
        
        if (supportsVision) {
            this.messageInput.placeholder = "Ask something... (📎 Paste or drop images here)";
        } else {
            this.messageInput.placeholder = "Ask something... (💡 Use vision model for images)";
        }
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        });
    }

    async sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content && this.pendingAttachments.length === 0) return;

        // CRITICAL FIX: Mark that we're currently sending a message (prevents model switch from stopping)
        this.currentlySendingMessage = true;
        
        // Disable user input while processing
        this.disableUserInput();
        
        // Show context status and typing indicator
        this.showContextStatus();
        this.showTyping();

        try {
            // Process attachments and build full message content
            let fullMessage = content;
            
            if (this.pendingAttachments.length > 0) {
                // Process text files - include their content in the message
                const textAttachments = this.pendingAttachments.filter(att => att.isTextFile && att.content);
                if (textAttachments.length > 0) {
                    const fileContents = textAttachments.map(att => {
                        return `\n\n**File: ${att.filename}**\n\`\`\`\n${att.content}\n\`\`\``;
                    }).join('');
                    
                    fullMessage = content + fileContents;
                }
            }
            
            // Prepare message data with conversation history
            const messageData = {
                message: fullMessage,
                model: this.currentModel,
                conversationId: this.currentConversationId,
                stream: this.settings.streamingEnabled,
                messages: this.messages // Pass current conversation history
            };
            
            // Debug: Check if we're using a vision model with images
            if (this.pendingAttachments.length > 0) {
                const hasImages = this.pendingAttachments.some(att => att.type.startsWith('image/'));
                
                if (hasImages) {
                    // Get REAL model capabilities from Ollama API instead of guessing from name
                    console.log(`🔍 Checking real model capabilities for: ${this.currentModel}`);
                    const modelInfoResponse = await this.sendChromeMessage({ 
                        type: 'GET_MODEL_INFO', 
                        modelName: this.currentModel 
                    });
                    
                    let isVisionModel = false;
                    if (modelInfoResponse.success && modelInfoResponse.modelInfo.capabilities) {
                        isVisionModel = modelInfoResponse.modelInfo.capabilities.includes('vision');
                        console.log(`✅ Real API capabilities for ${this.currentModel}:`, modelInfoResponse.modelInfo.capabilities);
                    } else {
                        // Fallback to name-based detection if API fails
                        isVisionModel = ModelUtils.supportsVision(this.currentModel);
                        console.log(`⚠️ API failed for ${this.currentModel}, using fallback name-based detection: ${isVisionModel}`);
                    }
                    
                    if (!isVisionModel) {
                        console.warn(`❌ Model ${this.currentModel} does not support vision - auto-switching...`);
                        
                        // Try to auto-switch to a vision model
                        const response = await this.sendChromeMessage({ type: 'GET_MODELS' });
                        const availableModels = response.success ? response.models : [];
                        
                        // Find vision models using REAL API capabilities
                        const visionModels = [];
                        for (const model of availableModels) {
                            const modelInfo = await this.sendChromeMessage({ 
                                type: 'GET_MODEL_INFO', 
                                modelName: model.name 
                            });
                            if (modelInfo.success && modelInfo.modelInfo.capabilities?.includes('vision')) {
                                visionModels.push(model);
                                console.log(`✅ Found vision model: ${model.name}`);
                            }
                        }
                        
                        if (visionModels.length > 0) {
                            const suggestedModel = visionModels[0].name;
                            console.log(`🔄 Auto-switching from ${this.currentModel} to vision model: ${suggestedModel}`);
                            
                            // Switch to the vision model
                            await this.selectModel(suggestedModel);
                            
                            // CRITICAL FIX: Update messageData model
                            messageData.model = suggestedModel;
                            
                            this.showContextStatus(`✅ Switched to vision model "${suggestedModel}" for image processing`);
                            console.log(`✅ Model switch completed - now using: ${this.currentModel}`);
                        } else {
                            // No vision models available - show error and prevent sending
                            this.showError(`❌ No vision models available. Please install a vision model like llava:latest, llava:7b, or qwen2-vl:latest.`);
                            this.enableUserInput();
                            this.clearAttachments();
                            return;
                        }
                    } else {
                        console.log(`✅ Model ${this.currentModel} supports vision - proceeding with image processing`);
                    }
                }
            }

            // Add user message with attachments after model switching logic
            this.addUserMessageWithAttachments(content);
            this.messageInput.value = '';
            
            // Add context if enabled
            if (this.contextEnabled && this.currentContext) {
                messageData.context = this.currentContext;
            }
            
            // Add images if any (vision models only support images, not other files)
            if (this.pendingAttachments.length > 0) {
                const imageAttachments = this.pendingAttachments.filter(att => att.type.startsWith('image/'));
                if (imageAttachments.length > 0) {
                    // Send full attachment objects so service worker can process them
                    messageData.imageAttachments = imageAttachments;
                }
            }
            
            const response = await this.sendChromeMessage({
                type: 'SEND_MESSAGE',
                data: messageData
            });

            // Clear attachments after sending
            this.clearAttachments();

            // Response will come via message listener - don't create anything here
            if (!response.success) {
                this.hideTyping();
                this.enableUserInput(); // Re-enable on error
                this.showError(response.error || 'Failed to send message');
            }
            // Success case: just wait for STREAMING_RESPONSE or FINAL_RESPONSE message
        } catch (error) {
            // CRITICAL FIX: Clear sending flag on error
            this.currentlySendingMessage = false;
            this.hideTyping();
            this.enableUserInput(); // Re-enable on error
            this.showError('Failed to send message: ' + error.message);
        }
    }

    addUserMessageWithAttachments(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-item';
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let attachmentsHtml = '';
        if (this.pendingAttachments.length > 0) {
            attachmentsHtml = '<div class="message-attachments flex gap-2 flex-wrap mb-2">';
            this.pendingAttachments.forEach(attachment => {
                if (attachment.type.startsWith('image/')) {
                    attachmentsHtml += `
                        <div class="attachment-in-message">
                            <img src="${attachment.dataUrl}" alt="${attachment.filename}" 
                                 class="max-w-xs rounded-lg cursor-pointer hover:opacity-80"
                                 onclick="window.open().document.write('<img src=\\'${attachment.dataUrl}\\' style=\\'max-width: 100%; height: auto;\\'>')">
                            <div class="text-xs text-muted-foreground mt-1">${attachment.filename}</div>
                        </div>
                    `;
                } else {
                    const icon = this.getFileIcon(attachment.type, attachment.filename);
                    attachmentsHtml += `
                        <div class="attachment-in-message flex items-center gap-2 p-2 bg-muted rounded border">
                            <span class="text-xl">${icon}</span>
                            <div class="text-xs">
                                <div class="font-medium">${attachment.filename}</div>
                                <div class="text-muted-foreground">${this.formatFileSize(attachment.size)}</div>
                            </div>
                        </div>
                    `;
                }
            });
            attachmentsHtml += '</div>';
        }
        
        messageDiv.innerHTML = `
            <div class="flex justify-end p-3">
                <div class="max-w-[80%] flex flex-col space-y-1">
                    <div class="bg-muted rounded-2xl rounded-br-sm px-4 py-2">
                        ${attachmentsHtml}
                        ${content ? `<div class="text-sm whitespace-pre-wrap">${this.formatText(content)}</div>` : ''}
                    </div>
                    <div class="text-muted-foreground text-xs text-right">${timestamp}</div>
                </div>
            </div>
        `;
        
        // Insert before typing indicator to maintain proper order
        if (this.typingIndicator && this.typingIndicator.parentNode === this.messagesContainer) {
            this.messagesContainer.insertBefore(messageDiv, this.typingIndicator);
        } else {
            this.messagesContainer.appendChild(messageDiv);
        }
        this.scrollToBottom();
        
        // Add to conversation history
        let messageContent = content;
        if (this.pendingAttachments.length > 0) {
            const attachmentsList = this.pendingAttachments.map(att => `[${att.filename}]`).join(', ');
            messageContent = `${content} [Attachments: ${attachmentsList}]`.trim();
        }
        this.messages.push({ role: 'user', content: messageContent, timestamp });
        
        // Auto-save conversation history
        this.saveConversationHistory();
        
        return messageDiv;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

}

document.addEventListener('DOMContentLoaded', () => { new SideLlamaChat(); });
console.log('🦙 SideLlama Corrected Panel Loaded');