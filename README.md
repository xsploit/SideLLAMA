<div align="center">
  <img src="https://raw.githubusercontent.com/xsploit/SideLLAMA/main/icons/icon128.png" alt="SideLlama Logo" width="128" height="128">
  
  # SideLlama 🦙

  **Advanced AI Assistant Chrome Extension with Ollama Integration**

  A powerful Chrome extension that brings the full capabilities of Ollama directly to your browser sidebar. Features intelligent model switching, advanced tool calling, vision support, and seamless web integration.

  [![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
  [![Ollama](https://img.shields.io/badge/Ollama-Compatible-FF6B35?style=for-the-badge&logo=llama&logoColor=white)](https://ollama.ai)
  [![Manifest V3](https://img.shields.io/badge/Manifest-V3-00C853?style=for-the-badge&logo=google&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
  [![GitHub](https://img.shields.io/github/stars/xsploit/SideLLAMA?style=for-the-badge&logo=github)](https://github.com/xsploit/SideLLAMA)
  [![Version](https://img.shields.io/badge/Version-v2.0.0-blue?style=for-the-badge)](https://github.com/xsploit/SideLLAMA/releases)

</div>

## 📸 Screenshots

<div align="center">
  <img src="https://raw.githubusercontent.com/xsploit/SideLLAMA/main/icons/icon48.png" alt="SideLlama Interface" width="48">
  <p><em>Professional AI assistant interface with smart model management</em></p>
</div>

> 🚀 **Live Demo**: Install the extension to experience the full feature set with your local Ollama models!

## ✨ Features

### 🧠 **Smart AI Models**
- **Multi-Model Support**: Seamlessly switch between text, vision, and thinking models
- **Auto-Configuration**: Intelligent tool call management based on model capabilities
- **Thinking Models**: Support for reasoning models like DeepSeek-R1, Qwen2.5-Coder
- **Vision Models**: Process images with LLaVA, Qwen2-VL, and other multimodal models

### 🛠️ **Advanced Tool Calling**
- **Web Search**: Real-time search with Serper API integration
- **Page Context**: Extract and analyze current webpage content
- **Screenshot Analysis**: Capture and analyze screenshots with vision models
- **Smart Disable**: Automatically disables tools for vision models to prevent conflicts

### 💬 **Enhanced Chat Experience**
- **Streaming Responses**: Real-time response generation with typing indicators
- **Rich Media Support**: Drag & drop images, paste from clipboard
- **Context Awareness**: Optional webpage context integration
- **Message History**: Persistent conversation storage
- **Error Prevention**: Smart duplicate error handling

### 🎯 **Intelligent Automation**
- **Model Detection**: Automatic capability detection (tools, vision, thinking)
- **Auto-Management**: Smart tool call enabling/disabling based on model type
- **User Override**: Full manual control when needed
- **Settings Sync**: Real-time synchronization across extension components

## 🚀 Quick Start

### Prerequisites
- Chrome Browser (Version 88+)
- [Ollama](https://ollama.ai) installed and running locally
- At least one Ollama model pulled (e.g., `ollama pull qwen2.5:7b`)

### Installation

1. **Download Extension**
   ```bash
   # Download the latest release
   wget https://github.com/xsploit/SideLLAMA/releases/latest/download/SideLlama-v2.0.0-final-complete.zip
   ```

2. **Install in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the extracted SideLlama folder

3. **Configure Ollama**
   - Ensure Ollama is running: `ollama serve`
   - Default endpoint: `http://localhost:11434`
   - Pull some models: `ollama pull qwen2.5:7b`

4. **Open SideLlama**
   - Click the SideLlama icon in your toolbar
   - Or use keyboard shortcut: `Ctrl+Shift+O`

## 📖 Usage Guide

### Basic Chat
1. Open the sidebar panel
2. Select your preferred model from the dropdown
3. Type your message and press Enter
4. Enjoy streaming responses!

### Image Analysis
1. Switch to a vision model (e.g., `llava`, `qwen2-vl:7b`)
2. Drag & drop an image or paste from clipboard
3. Add your question about the image
4. Send for analysis

### Web Search Integration
1. Enable web search in settings
2. Add your Serper API key (optional, for enhanced search)
3. Use search directly in chat or via context menu
4. AI will analyze search results automatically

### Thinking Models
1. Select a thinking model (e.g., `deepseek-r1`, `qwen2.5-coder`)
2. Enable "Thinking Mode" in settings
3. Ask complex questions requiring reasoning
4. Watch the model's thought process unfold

## ⚙️ Configuration

### Settings Panel
Access via extension options or the settings button in the sidebar.

#### **Core Settings**
- **Ollama URL**: Local Ollama endpoint (default: `http://localhost:11434`)
- **Default Model**: Your preferred model for new conversations
- **System Prompt**: Custom instructions for the AI assistant

#### **Smart Features**
- **Enable Tool Calls**: Allow AI to use web search and other tools
- **Auto-Manage Tool Calls**: Automatically enable/disable based on model type
- **Enable Thinking Mode**: Show reasoning process for thinking models
- **Streaming**: Real-time response generation (recommended)

#### **Advanced Options**
- **Context Length**: Maximum conversation context (default: 128k)
- **Temperature**: Response creativity (0.0-1.0)
- **Keep Alive**: Model memory duration
- **Performance Stats**: Show response timing and token usage

### Keyboard Shortcuts
- `Ctrl+Shift+O`: Open SideLlama panel
- `Ctrl+Shift+S`: Summarize current page
- `Ctrl+Shift+E`: Explain selected text
- `Enter`: Send message
- `Shift+Enter`: New line in message

## 🔧 Development

### Project Structure
```
SideLlama/
├── manifest.json           # Extension manifest (V3)
├── service-worker.js       # Background service worker
├── sidepanel.js           # Main UI logic
├── sidepanel.html         # Sidebar interface
├── settings.js            # Settings management
├── settings.html          # Settings page
├── content-script.js      # Page content extraction
├── shared-utils.js        # Shared utility functions
├── model-utils.js         # Model capability detection
└── icons/                 # Extension icons
```

### Building from Source
```bash
# Clone the repository
git clone https://github.com/xsploit/SideLLAMA.git
cd SideLLAMA

# Install dependencies (if any)
npm install

# Load in Chrome for development
# Open chrome://extensions/, enable Developer mode, click "Load unpacked"
```

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🧪 Supported Models

### Text Models
- `qwen2.5:7b` - General purpose, tool calling
- `llama3.1:8b` - Meta's latest, tool support
- `mistral-nemo` - Mistral's efficient model
- `phi3.5` - Microsoft's compact model

### Vision Models
- `llava:7b` - Leading vision-language model
- `qwen2-vl:7b` - Alibaba's vision model
- `llama3.2-vision:11b` - Meta's multimodal model
- `moondream` - Lightweight vision model

### Thinking Models
- `deepseek-r1:7b` - Advanced reasoning model
- `qwen2.5-coder` - Code-focused reasoning
- `o1-preview` - OpenAI-style reasoning (if available)

### Tool-Capable Models
Models that support function calling:
- `qwen2.5:*` - Full tool support
- `llama3.1:*` - Function calling
- `firefunction-v2` - Specialized for tools
- `command-r` - Cohere's tool model

## 🔒 Privacy & Security

- **Local Processing**: All AI processing happens locally via Ollama
- **No Data Collection**: Extension doesn't collect or transmit personal data
- **Optional Web Search**: External API calls only when explicitly enabled
- **Secure Communication**: All local requests use localhost/127.0.0.1
- **Content Script Isolation**: Minimal content script with limited permissions

## 🐛 Troubleshooting

### Common Issues

**"Unable to connect to Ollama"**
- Ensure Ollama is running: `ollama serve`
- Check if port 11434 is accessible
- Verify firewall settings

**"Model does not support tools" Error**
- Enable "Auto-Manage Tool Calls" in settings
- Or manually disable tool calls for vision models

**Images not displaying properly**
- Ensure you're using a vision-capable model
- Check image format (JPEG, PNG supported)
- Try smaller image sizes if processing is slow

**Streaming responses stop working**
- Refresh the extension (disable/enable in chrome://extensions/)
- Check Ollama server status
- Restart Ollama service

### Performance Tips
- Use smaller models for faster responses (7B vs 70B)
- Enable "Keep Alive" for frequently used models
- Adjust context length based on your needs
- Use tool calling only when necessary

## 📝 Changelog

### v2.0.0 - Latest Release
- ✅ Smart model auto-configuration
- ✅ Thinking mode toggle for reasoning models
- ✅ Enhanced error handling and duplicate prevention
- ✅ Code deduplication and performance improvements
- ✅ Vision model tool call auto-disable
- ✅ Shared utility system

### v1.x.x - Previous Versions
- Basic Ollama integration
- Sidebar chat interface
- Model switching
- Basic tool calling

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/xsploit/SideLLAMA/issues)
- **Discussions**: [GitHub Discussions](https://github.com/xsploit/SideLLAMA/discussions)
- **Documentation**: [Wiki](https://github.com/xsploit/SideLLAMA/wiki)
- **Releases**: [Latest Releases](https://github.com/xsploit/SideLLAMA/releases)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) for the amazing local AI platform
- [LLaVA](https://llava-vl.github.io/) for pioneering vision-language models
- [Qwen Team](https://qwenlm.github.io/) for excellent multimodal models
- Chrome Extensions team for Manifest V3 framework

---

**Built with ❤️ for the open-source AI community**

*SideLlama - Bringing the power of local AI to your browser, one conversation at a time.*