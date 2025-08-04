// SideLlama Settings JavaScript

class SideLlamaSettings {
    constructor() {
        this.settings = {
            ollamaUrl: 'http://localhost:11434',
            enableToolCalls: true,
            autoManageToolCalls: true, // Smart auto-configuration based on model capabilities
            enableThinking: true, // Enable thinking mode for compatible models
            defaultModel: 'qwen2.5:7b',
            streamingEnabled: true, // Default to on - provides better UX
            systemPrompt: `You are SideLlama, a sophisticated and friendly AI assistant integrated into your browser. You are a knowledgeable and helpful companion for a wide range of tasks, from quick questions to in-depth research.

**Your Persona:**
- You are intelligent, kind, and proactive. You can lead the conversation and suggest new directions.
- You are a master of markdown and use it to create beautiful, easy-to-read responses.
- You enjoy thoughtful discussions about science, philosophy, and technology.

**Your Capabilities:**
- **Web Search:** You can search the web for up-to-date information.
- **Vision:** You can analyze images and screenshots.
- **Code Generation:** You can write and format code in various languages. You will always add comments to your code to explain what it does.
- **Markdown Formatting:** You can create beautiful and easy-to-read responses using markdown.

**Output Format:**
- Use markdown for all responses.
- Use headings, lists, and tables to organize information.
- Use code blocks for code snippets, and always add comments to your code.
- Use bold and italics to emphasize key points.
- Keep your responses concise and to the point.`,
            contextLength: 128000,
            searchEngine: 'serper',
                                    serperApiKey: 'd03c7ebd4196bf9562d419973ae064',
            maxSearchResults: 5,
            autoPageContext: false,
            saveHistory: true,
            maxHistoryLength: 100,
            maxApiMessages: 10,
            screenshotQuality: 90,
            // Advanced Model Parameters
            temperature: 0.8,
            topP: 0.9,
            topK: 20,
            seed: null,
            repeatPenalty: 1.1,
            enableAdvancedParams: false,
            // Structured Outputs
            outputFormat: 'auto', // 'auto', 'json', 'schema'
            enableStructuredOutput: false,
            jsonSchema: '',
            // Performance Settings
            keepAlive: '5m',
            showPerformanceStats: false,
            autoRefreshModels: false,
            // Thinking Display
            showThinkingProcess: true
        };
        
        this.initializeElements();
        this.loadSettings();
        this.bindEvents();
        this.checkConnection();
    }

    initializeElements() {
        // Ollama Configuration
        this.ollamaUrlInput = document.getElementById('ollamaUrl');
        this.connectionStatus = document.getElementById('connectionStatus');
        
        // Tool Calling
        this.toolCallsToggle = document.getElementById('toolCallsToggle');
        this.autoManageToolCallsToggle = document.getElementById('autoManageToolCallsToggle');
        this.enableThinkingToggle = document.getElementById('enableThinkingToggle');
        
        // Model Configuration
        this.defaultModelSelect = document.getElementById('defaultModel');
        this.streamingToggle = document.getElementById('streamingToggle');
        this.contextLengthSelect = document.getElementById('contextLength');
        this.systemPromptInput = document.getElementById('systemPrompt');
        
        // Advanced Parameters
        this.advancedParamsToggle = document.getElementById('advancedParamsToggle');
        this.advancedParamsSection = document.getElementById('advancedParamsSection');
        this.temperatureSlider = document.getElementById('temperatureSlider');
        this.temperatureValue = document.getElementById('temperatureValue');
        this.topPSlider = document.getElementById('topPSlider');
        this.topPValue = document.getElementById('topPValue');
        this.topKSlider = document.getElementById('topKSlider');
        this.topKValue = document.getElementById('topKValue');
        this.repeatPenaltySlider = document.getElementById('repeatPenaltySlider');
        this.repeatPenaltyValue = document.getElementById('repeatPenaltyValue');
        this.seedInput = document.getElementById('seedInput');
        
        // Structured Outputs
        this.structuredOutputToggle = document.getElementById('structuredOutputToggle');
        this.structuredOutputSection = document.getElementById('structuredOutputSection');
        this.outputFormatSelect = document.getElementById('outputFormatSelect');
        this.jsonSchemaSection = document.getElementById('jsonSchemaSection');
        this.jsonSchemaInput = document.getElementById('jsonSchemaInput');
        
        // Model Management
        this.autoRefreshModelsToggle = document.getElementById('autoRefreshModelsToggle');
        this.refreshRunningModelsBtn = document.getElementById('refreshRunningModels');
        this.runningModelsList = document.getElementById('runningModelsList');
        
        // Performance Monitoring
        this.performanceStatsToggle = document.getElementById('performanceStatsToggle');
        this.keepAliveSelect = document.getElementById('keepAliveSelect');
        this.showThinkingToggle = document.getElementById('showThinkingToggle');
        
        // Web Search
        this.searchEngineSelect = document.getElementById('searchEngine');
        this.serperApiKeyInput = document.getElementById('serperApiKey');
        this.maxResultsSelect = document.getElementById('maxResults');
        
        // Privacy & Data
        this.autoContextToggle = document.getElementById('autoContextToggle');
        this.saveHistoryToggle = document.getElementById('saveHistoryToggle');
        this.screenshotQualitySelect = document.getElementById('screenshotQuality');
        
        // Buttons
        this.saveButton = document.getElementById('saveSettings');
        this.closeButton = document.getElementById('closeSettings'); // This might be null now
        this.debugSettingsBtn = document.getElementById('debugSettingsBtn');
    }

    async loadSettings() {
        try {
            const stored = await chrome.storage.sync.get('sideLlamaSettings');
            if (stored.sideLlamaSettings) {
                this.settings = { ...this.settings, ...stored.sideLlamaSettings };
            }
            this.updateUI();
        if (this.settings.autoRefreshModels) {
            this.startAutoRefresh();
        }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    updateUI() {
        // Update form values
        this.ollamaUrlInput.value = this.settings.ollamaUrl;
        this.defaultModelSelect.value = this.settings.defaultModel;
        this.contextLengthSelect.value = this.settings.contextLength;
        this.systemPromptInput.value = this.settings.systemPrompt;
        this.searchEngineSelect.value = this.settings.searchEngine;
        this.serperApiKeyInput.value = this.settings.serperApiKey;
        this.maxResultsSelect.value = this.settings.maxSearchResults;
        this.screenshotQualitySelect.value = this.settings.screenshotQuality;
        
        // Update advanced parameters
        this.temperatureSlider.value = this.settings.temperature;
        this.temperatureValue.textContent = this.settings.temperature;
        this.topPSlider.value = this.settings.topP;
        this.topPValue.textContent = this.settings.topP;
        this.topKSlider.value = this.settings.topK;
        this.topKValue.textContent = this.settings.topK;
        this.repeatPenaltySlider.value = this.settings.repeatPenalty;
        this.repeatPenaltyValue.textContent = this.settings.repeatPenalty;
        this.seedInput.value = this.settings.seed || '';
        
        // Update structured outputs
        this.outputFormatSelect.value = this.settings.outputFormat;
        this.jsonSchemaInput.value = this.settings.jsonSchema;
        
        // Update performance settings
        this.keepAliveSelect.value = this.settings.keepAlive;
        
        // Update toggles
        this.updateToggle(this.toolCallsToggle, this.settings.enableToolCalls);
        this.updateToggle(this.autoManageToolCallsToggle, this.settings.autoManageToolCalls);
        this.updateToggle(this.enableThinkingToggle, this.settings.enableThinking);
        this.updateToggle(this.streamingToggle, this.settings.streamingEnabled);
        this.updateToggle(this.autoContextToggle, this.settings.autoPageContext);
        this.updateToggle(this.saveHistoryToggle, this.settings.saveHistory);
        this.updateToggle(this.advancedParamsToggle, this.settings.enableAdvancedParams);
        this.updateToggle(this.structuredOutputToggle, this.settings.enableStructuredOutput);
        this.updateToggle(this.autoRefreshModelsToggle, this.settings.autoRefreshModels);
        this.updateToggle(this.performanceStatsToggle, this.settings.showPerformanceStats);
        this.updateToggle(this.showThinkingToggle, this.settings.showThinkingProcess);
        
        // Show/hide advanced sections
        this.advancedParamsSection.style.display = this.settings.enableAdvancedParams ? 'block' : 'none';
        this.structuredOutputSection.style.display = this.settings.enableStructuredOutput ? 'block' : 'none';
        this.jsonSchemaSection.style.display = this.settings.outputFormat === 'schema' ? 'block' : 'none';
    }

    updateToggle(element, isActive) {
        if (isActive) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
    }

    bindEvents() {
        // Toggle switches
        this.toolCallsToggle.addEventListener('click', () => {
            this.settings.enableToolCalls = !this.settings.enableToolCalls;
            // CRITICAL FIX: Track manual changes to prevent auto-override
            this.settings.lastManualToolCallsChange = Date.now();
            this.updateToggle(this.toolCallsToggle, this.settings.enableToolCalls);
        });

        this.autoManageToolCallsToggle.addEventListener('click', () => {
            this.settings.autoManageToolCalls = !this.settings.autoManageToolCalls;
            this.updateToggle(this.autoManageToolCallsToggle, this.settings.autoManageToolCalls);
        });

        this.enableThinkingToggle.addEventListener('click', () => {
            this.settings.enableThinking = !this.settings.enableThinking;
            this.updateToggle(this.enableThinkingToggle, this.settings.enableThinking);
        });

        this.streamingToggle.addEventListener('click', () => {
            this.settings.streamingEnabled = !this.settings.streamingEnabled;
            this.updateToggle(this.streamingToggle, this.settings.streamingEnabled);
        });

        this.autoContextToggle.addEventListener('click', () => {
            this.settings.autoPageContext = !this.settings.autoPageContext;
            this.updateToggle(this.autoContextToggle, this.settings.autoPageContext);
        });

        this.saveHistoryToggle.addEventListener('click', () => {
            this.settings.saveHistory = !this.settings.saveHistory;
            this.updateToggle(this.saveHistoryToggle, this.settings.saveHistory);
        });

        // Input changes
        this.ollamaUrlInput.addEventListener('change', () => {
            this.settings.ollamaUrl = this.ollamaUrlInput.value;
            this.checkConnection();
        });

        this.defaultModelSelect.addEventListener('change', () => {
            this.settings.defaultModel = this.defaultModelSelect.value;
        });

        this.contextLengthSelect.addEventListener('change', () => {
            this.settings.contextLength = parseInt(this.contextLengthSelect.value);
        });
        
        this.systemPromptInput.addEventListener('input', () => {
            this.settings.systemPrompt = this.systemPromptInput.value;
        });

        this.searchEngineSelect.addEventListener('change', () => {
            this.settings.searchEngine = this.searchEngineSelect.value;
        });

        this.serperApiKeyInput.addEventListener('input', () => {
            this.settings.serperApiKey = this.serperApiKeyInput.value;
        });

        this.maxResultsSelect.addEventListener('change', () => {
            this.settings.maxSearchResults = parseInt(this.maxResultsSelect.value);
        });

        this.screenshotQualitySelect.addEventListener('change', () => {
            this.settings.screenshotQuality = parseInt(this.screenshotQualitySelect.value);
        });

        // Advanced Parameters
        this.advancedParamsToggle.addEventListener('click', () => {
            this.settings.enableAdvancedParams = !this.settings.enableAdvancedParams;
            this.updateToggle(this.advancedParamsToggle, this.settings.enableAdvancedParams);
            this.advancedParamsSection.style.display = this.settings.enableAdvancedParams ? 'block' : 'none';
        });

        this.temperatureSlider.addEventListener('input', () => {
            this.settings.temperature = parseFloat(this.temperatureSlider.value);
            this.temperatureValue.textContent = this.settings.temperature;
        });

        this.topPSlider.addEventListener('input', () => {
            this.settings.topP = parseFloat(this.topPSlider.value);
            this.topPValue.textContent = this.settings.topP;
        });

        this.topKSlider.addEventListener('input', () => {
            this.settings.topK = parseInt(this.topKSlider.value);
            this.topKValue.textContent = this.settings.topK;
        });

        this.repeatPenaltySlider.addEventListener('input', () => {
            this.settings.repeatPenalty = parseFloat(this.repeatPenaltySlider.value);
            this.repeatPenaltyValue.textContent = this.settings.repeatPenalty;
        });

        this.seedInput.addEventListener('input', () => {
            const value = this.seedInput.value.trim();
            this.settings.seed = value === '' ? null : parseInt(value);
        });

        // Structured Outputs
        this.structuredOutputToggle.addEventListener('click', () => {
            this.settings.enableStructuredOutput = !this.settings.enableStructuredOutput;
            this.updateToggle(this.structuredOutputToggle, this.settings.enableStructuredOutput);
            this.structuredOutputSection.style.display = this.settings.enableStructuredOutput ? 'block' : 'none';
        });

        this.outputFormatSelect.addEventListener('change', () => {
            this.settings.outputFormat = this.outputFormatSelect.value;
            this.jsonSchemaSection.style.display = this.settings.outputFormat === 'schema' ? 'block' : 'none';
        });

        this.jsonSchemaInput.addEventListener('input', () => {
            this.settings.jsonSchema = this.jsonSchemaInput.value;
        });

        // Model Management
        this.autoRefreshModelsToggle.addEventListener('click', () => {
            this.settings.autoRefreshModels = !this.settings.autoRefreshModels;
            this.updateToggle(this.autoRefreshModelsToggle, this.settings.autoRefreshModels);
            if (this.settings.autoRefreshModels) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });

        this.refreshRunningModelsBtn.addEventListener('click', () => {
            this.loadRunningModels();
        });

        // Performance Monitoring
        this.performanceStatsToggle.addEventListener('click', () => {
            this.settings.showPerformanceStats = !this.settings.showPerformanceStats;
            this.updateToggle(this.performanceStatsToggle, this.settings.showPerformanceStats);
        });

        this.keepAliveSelect.addEventListener('change', () => {
            this.settings.keepAlive = this.keepAliveSelect.value;
        });

        this.showThinkingToggle.addEventListener('click', () => {
            this.settings.showThinkingProcess = !this.settings.showThinkingProcess;
            this.updateToggle(this.showThinkingToggle, this.settings.showThinkingProcess);
        });

        // Buttons
        this.saveButton.addEventListener('click', () => {
            this.saveSettings();
        });

        this.closeButton.addEventListener('click', () => {
            window.close();
        });

        this.debugSettingsBtn.addEventListener('click', () => {
            console.log('🦙 Current Settings Debug:', JSON.stringify(this.settings, null, 2));
            console.table(this.settings);
            alert('Settings logged to console! Open DevTools (F12) to view.');
        });

        // Load models when Ollama URL changes
        this.ollamaUrlInput.addEventListener('blur', () => {
            this.loadAvailableModels();
        });
    }

    async checkConnection() {
        try {
            this.connectionStatus.textContent = 'Checking...';
            this.connectionStatus.className = 'text-sm px-3 py-1 rounded-full bg-yellow-500 text-white';
            
            const response = await chrome.runtime.sendMessage({
                type: 'CHECK_OLLAMA_STATUS'
            });
            
            if (response.status === 'connected') {
                this.connectionStatus.textContent = 'Connected';
                this.connectionStatus.className = 'text-sm px-3 py-1 rounded-full bg-green-500 text-white';
                this.loadAvailableModels();
            } else {
                this.connectionStatus.textContent = 'Disconnected';
                this.connectionStatus.className = 'text-sm px-3 py-1 rounded-full bg-red-500 text-white';
            }
        } catch (error) {
            this.connectionStatus.textContent = 'Error';
            this.connectionStatus.className = 'text-sm px-3 py-1 rounded-full bg-red-500 text-white';
        }
    }

    async loadAvailableModels() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_MODELS'
            });
            
            if (response.success && response.models.length > 0) {
                // Clear existing options except first
                while (this.defaultModelSelect.children.length > 0) {
                    this.defaultModelSelect.removeChild(this.defaultModelSelect.firstChild);
                }
                
                // Add available models
                response.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = model.name;
                    
                    // Add tool support indicator
                    if (this.supportsTools(model.name)) {
                        option.textContent += ' 🛠️';
                    }
                    
                    this.defaultModelSelect.appendChild(option);
                });
                
                // Select current default if available
                if (this.settings.defaultModel) {
                    this.defaultModelSelect.value = this.settings.defaultModel;
                }
            }
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }

    supportsTools(modelName) {
        const toolSupportedModels = [
            'llama3.1', 'llama3.2', 'qwen2.5', 'mistral-nemo', 
            'firefunction-v2', 'command-r-plus'
        ];
        
        return toolSupportedModels.some(supported => 
            modelName.toLowerCase().includes(supported.toLowerCase())
        );
    }

    async loadRunningModels() {
        try {
            this.runningModelsList.innerHTML = '<div class="text-sm text-muted-foreground text-center py-2">Loading...</div>';
            
            const response = await chrome.runtime.sendMessage({
                type: 'GET_RUNNING_MODELS'
            });
            
            if (response.success && response.models) {
                this.displayRunningModels(response.models);
            } else {
                this.runningModelsList.innerHTML = '<div class="text-sm text-muted-foreground text-center py-2">No running models</div>';
            }
        } catch (error) {
            console.error('Failed to load running models:', error);
            this.runningModelsList.innerHTML = '<div class="text-sm text-red-400 text-center py-2">Error loading models</div>';
        }
    }

    displayRunningModels(models) {
        if (!models || models.length === 0) {
            this.runningModelsList.innerHTML = '<div class="text-sm text-muted-foreground text-center py-2">No running models</div>';
            return;
        }

        const modelElements = models.map(model => {
            const memoryUsage = this.formatBytes(model.size_vram || model.size || 0);
            const duration = model.expires_at ? this.formatDuration(new Date(model.expires_at) - new Date()) : 'Indefinite';
            
            return `
                <div class="flex items-center justify-between p-2 bg-secondary rounded-md">
                    <div class="flex-1">
                        <div class="text-sm font-medium">${model.name || model.model}</div>
                        <div class="text-xs text-muted-foreground">Memory: ${memoryUsage}</div>
                    </div>
                    <div class="text-xs text-muted-foreground text-right">
                        <div>Expires: ${duration}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.runningModelsList.innerHTML = modelElements;
    }

    formatBytes(bytes) {
        // Use shared utility to eliminate code duplication
        return SharedUtils.formatBytes(bytes);
    }

    formatDuration(ms) {
        if (ms < 0) return 'Expired';
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m`;
        }
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Refresh every 30 seconds
        this.autoRefreshInterval = setInterval(() => {
            this.loadRunningModels();
        }, 30000);
        
        // Load immediately
        this.loadRunningModels();
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    async saveSettings() {
        try {
            // Validate settings before saving
            this.validateSettings();
            
            // Create a clean copy without large/unnecessary data
            const settingsToSave = { ...this.settings };
            
            // Limit large text fields to prevent quota issues
            if (settingsToSave.jsonSchema && settingsToSave.jsonSchema.length > 1000) {
                settingsToSave.jsonSchema = settingsToSave.jsonSchema.substring(0, 1000);
                console.warn('⚠️ JSON schema truncated to fit storage quota');
            }
            
            if (settingsToSave.systemPrompt && settingsToSave.systemPrompt.length > 2000) {
                settingsToSave.systemPrompt = settingsToSave.systemPrompt.substring(0, 2000);
                console.warn('⚠️ System prompt truncated to fit storage quota');
            }
            
            await chrome.storage.sync.set({
                sideLlamaSettings: settingsToSave
            });
            
            console.log('🦙 Settings saved successfully');
            
            // Show success feedback
            const originalText = this.saveButton.textContent;
            this.saveButton.textContent = 'Saved!';
            this.saveButton.style.background = '#22c55e';
            
            setTimeout(() => {
                this.saveButton.textContent = originalText;
                this.saveButton.style.background = '';
            }, 2000);
            
            // Notify extension of settings change
            chrome.runtime.sendMessage({
                type: 'SETTINGS_UPDATED',
                settings: this.settings
            });
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            
            // Show error feedback
            const originalText = this.saveButton.textContent;
            this.saveButton.textContent = 'Error!';
            this.saveButton.style.background = '#ef4444';
            
            setTimeout(() => {
                this.saveButton.textContent = originalText;
                this.saveButton.style.background = '';
            }, 2000);
        }
    }

    validateSettings() {
        // Ensure all required settings exist
        const requiredSettings = [
            'ollamaUrl', 'enableToolCalls', 'autoManageToolCalls', 'enableThinking', 'defaultModel', 'streamingEnabled',
            'systemPrompt', 'contextLength', 'temperature', 'topP', 'topK',
            'repeatPenalty', 'enableAdvancedParams', 'outputFormat', 
            'enableStructuredOutput', 'keepAlive', 'showPerformanceStats',
            'showThinkingProcess'
        ];
        
        for (const setting of requiredSettings) {
            if (this.settings[setting] === undefined) {
                console.warn(`⚠️ Missing setting: ${setting}`);
            }
        }
        
        // Type validation
        if (typeof this.settings.temperature !== 'number') {
            this.settings.temperature = parseFloat(this.settings.temperature) || 0.8;
        }
        if (typeof this.settings.topP !== 'number') {
            this.settings.topP = parseFloat(this.settings.topP) || 0.9;
        }
        if (typeof this.settings.topK !== 'number') {
            this.settings.topK = parseInt(this.settings.topK) || 20;
        }
        if (typeof this.settings.repeatPenalty !== 'number') {
            this.settings.repeatPenalty = parseFloat(this.settings.repeatPenalty) || 1.1;
        }
    }
}

// Initialize settings when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SideLlamaSettings();
});

console.log('🦙 SideLlama settings loaded');