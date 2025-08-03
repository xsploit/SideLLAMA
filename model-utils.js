// SideLlama Model Utilities - Shared functions for model capability detection
// This eliminates code duplication across service-worker.js and sidepanel.js

class ModelUtils {
    static getModelCapabilities(modelName) {
        const capabilities = [];
        const name = modelName.toLowerCase();
        
        // Check for tool calling support
        const toolModels = ['llama3.1', 'llama3.2', 'qwen2.5', 'mistral-nemo', 'firefunction', 'command-r'];
        if (toolModels.some(toolModel => name.includes(toolModel))) {
            capabilities.push('🛠️ Tools');
        }
        
        // Check for vision support
        const visionModels = [
            'llava', 'vision', 'qwen2-vl', 'qwen2.5vl', 'minicpm-v', 'bakllava', 
            'moondream', 'llama3.2-vision', 'llama4', 'gemma3', 'mistral-small3.1', 
            'mistral-small3.2', 'granite3.2-vision', 'llava-phi3', 'llava-llama3'
        ];
        if (visionModels.some(visionModel => name.includes(visionModel))) {
            capabilities.push('👁️ Vision');
        }
        
        // Check for code support
        const codeModels = ['codellama', 'codeqwen', 'deepseek-coder', 'starcoder'];
        if (codeModels.some(codeModel => name.includes(codeModel))) {
            capabilities.push('💻 Code');
        }
        
        // Check for thinking models
        const thinkingModels = ['qwen2.5-coder', 'deepseek-r1', 'thinking', 'o1', 'reasoning'];
        if (thinkingModels.some(thinkingModel => name.includes(thinkingModel))) {
            capabilities.push('🧠 Thinking');
        }
        
        // Default to chat if no specific capabilities
        if (capabilities.length === 0) {
            capabilities.push('💬 Chat');
        }
        
        return capabilities;
    }
    
    static isThinkingModel(modelName) {
        const thinkingModels = ['qwen2.5-coder', 'deepseek-r1', 'thinking', 'o1', 'reasoning'];
        const name = modelName.toLowerCase();
        return thinkingModels.some(thinkingModel => name.includes(thinkingModel));
    }
    
    static supportsVision(modelName) {
        const visionModels = [
            'llava', 'vision', 'qwen2-vl', 'qwen2.5vl', 'minicpm-v', 'bakllava', 
            'moondream', 'llama3.2-vision', 'llama4', 'gemma3', 'mistral-small3.1', 
            'mistral-small3.2', 'granite3.2-vision', 'llava-phi3', 'llava-llama3'
        ];
        const name = modelName.toLowerCase();
        return visionModels.some(visionModel => name.includes(visionModel));
    }
    
    static supportsTools(modelName) {
        const toolModels = ['llama3.1', 'llama3.2', 'qwen2.5', 'mistral-nemo', 'firefunction', 'command-r'];
        const name = modelName.toLowerCase();
        return toolModels.some(toolModel => name.includes(toolModel));
    }
}

// Export for both ES6 modules and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModelUtils;
}
if (typeof window !== 'undefined') {
    window.ModelUtils = ModelUtils;
}