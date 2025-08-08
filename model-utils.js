// SideLlama Model Utilities - Shared functions for model capability detection
// This eliminates code duplication across service-worker.js and sidepanel.js

class ModelUtils {
    static toolModels = ['llama3.1', 'llama3.2', 'qwen2.5', 'mistral-nemo', 'firefunction', 'command-r'];
    static visionModels = [
        'llava', 'vision', 'qwen2-vl', 'qwen2.5vl', 'minicpm-v', 'bakllava',
        'moondream', 'llama3.2-vision', 'llama4', 'gemma3', 'mistral-small3.1',
        'mistral-small3.2', 'granite3.2-vision', 'llava-phi3', 'llava-llama3'
    ];
    static codeModels = ['codellama', 'codeqwen', 'deepseek-coder', 'starcoder'];
    static thinkingModels = ['qwen2.5-coder', 'deepseek-r1', 'thinking', 'o1', 'reasoning'];

    static getModelCapabilities(modelName) {
        const capabilities = [];
        const name = modelName.toLowerCase();

        if (this.toolModels.some(toolModel => name.includes(toolModel))) {
            capabilities.push('🛠️ Tools');
        }

        if (this.visionModels.some(visionModel => name.includes(visionModel))) {
            capabilities.push('👁️ Vision');
        }

        if (this.codeModels.some(codeModel => name.includes(codeModel))) {
            capabilities.push('💻 Code');
        }

        if (this.thinkingModels.some(thinkingModel => name.includes(thinkingModel))) {
            capabilities.push('🧠 Thinking');
        }

        if (capabilities.length === 0) {
            capabilities.push('💬 Chat');
        }

        return capabilities;
    }

    static isThinkingModel(modelName) {
        const name = modelName.toLowerCase();
        return this.thinkingModels.some(thinkingModel => name.includes(thinkingModel));
    }

    static supportsVision(modelName) {
        const name = modelName.toLowerCase();
        return this.visionModels.some(visionModel => name.includes(visionModel));
    }

    static supportsTools(modelName) {
        const name = modelName.toLowerCase();
        return this.toolModels.some(toolModel => name.includes(toolModel));
    }
}

// Export for both ES6 modules and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModelUtils;
}
if (typeof window !== 'undefined') {
    window.ModelUtils = ModelUtils;
}
