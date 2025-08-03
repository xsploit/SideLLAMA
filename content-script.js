// SideLlama Content Script
// Enhanced script for better page content extraction and analysis

(function() {
    'use strict';
    
    // Listen for messages from the extension
    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        try {
            switch (request.type) {
                case 'EXTRACT_PAGE_CONTENT':
                    const pageData = await extractPageContent();
                    sendResponse({ success: true, data: pageData });
                    break;
                    
                case 'SUMMARIZE_PAGE':
                    await handlePageSummary();
                    sendResponse({ success: true });
                    break;
                    
                case 'EXPLAIN_SELECTION':
                    await handleExplainSelection(request.selection);
                    sendResponse({ success: true });
                    break;
                    
                case 'DISPLAY_SCREENSHOT':
                    displayScreenshot(request.dataUrl);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown request type' });
            }
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true; // Keep the message channel open for async response
    });

    async function extractPageContent() {
        // Get page title
        const title = document.title || 'Untitled Page';
        
        // Get current URL
        const url = window.location.href;
        
        // Get meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        const description = metaDesc ? metaDesc.getAttribute('content') : '';
        
        // Extract main content using various strategies (now async)
        let content = await extractMainContent();
        
        // Get page language
        const lang = document.documentElement.lang || 'en';
        
        // Extract headings for structure
        const headings = extractHeadings();
        
        // Extract links (top 10 most relevant)
        const links = extractRelevantLinks();
        
        // Get page type/category hints
        const pageType = detectPageType();
        
        return {
            title: title.trim(),
            url,
            description: description.trim(),
            content: content.substring(0, 8000), // Limit to 8KB
            language: lang,
            headings: headings.slice(0, 10), // Top 10 headings
            links: links.slice(0, 10), // Top 10 links
            pageType,
            wordCount: content.split(/\s+/).length,
            extractedAt: new Date().toISOString()
        };
    }

    async function extractMainContent() {
        let content = '';
        
        // Strategy 1: Try semantic HTML5 elements first
        const semanticSelectors = [
            'main',
            'article', 
            '[role="main"]',
            '.main-content',
            '.content',
            '.post-content',
            '.entry-content',
            '.article-content',
            '.page-content',
            '#main',
            '#content'
        ];
        
        for (const selector of semanticSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                content = extractTextFromElement(element);
                if (content.length > 200) { // Only use if substantial content
                    break;
                }
            }
        }
        
        // Strategy 2: If no main content found, try body but filter out navigation/ads
        if (!content || content.length < 200) {
            const body = document.body;
            if (body) {
                content = extractTextFromElement(body, true);
            }
        }
        
        // Strategy 3: Fallback to all text with better filtering (now async)
        if (!content || content.length < 100) {
            content = await extractAllText();
        }
        
        return cleanContent(content);
    }

    function extractTextFromElement(element, filterOut = false) {
        if (!element) return '';
        
        // Clone the element to avoid modifying the original
        const clone = element.cloneNode(true);
        
        if (filterOut) {
            // Remove common non-content elements
            const selectorsToRemove = [
                'nav', 'header', 'footer', 'aside',
                '.nav', '.navigation', '.header', '.footer', '.sidebar',
                '.menu', '.ads', '.advertisement', '.social', '.share',
                '.comments', '.comment', '.related', '.recommended',
                '.popup', '.modal', '.overlay', '.banner',
                'script', 'style', 'noscript', 'iframe',
                '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
                '.cookie-notice', '.gdpr-notice'
            ];
            
            selectorsToRemove.forEach(selector => {
                const elements = clone.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            });
        }
        
        return clone.innerText || clone.textContent || '';
    }

    function extractAllText() {
        // Get all text nodes, but prioritize paragraphs and content areas
        const contentElements = document.querySelectorAll('p, div, span, li, td, th, h1, h2, h3, h4, h5, h6');
        
        // Process elements in batches to avoid blocking
        return new Promise(resolve => {
            let allText = '';
            let index = 0;
            const batchSize = 50; // Process 50 elements at a time
            
            function processBatch() {
                const endIndex = Math.min(index + batchSize, contentElements.length);
                
                for (let i = index; i < endIndex; i++) {
                    const el = contentElements[i];
                    // Skip if element is hidden or likely non-content
                    if (isHiddenOrNonContent(el)) continue;
                    
                    const text = el.innerText || el.textContent || '';
                    if (text.trim().length > 10) { // Only include substantial text
                        allText += text + '\n';
                    }
                }
                
                index = endIndex;
                
                if (index < contentElements.length) {
                    // Schedule next batch to avoid blocking
                    setTimeout(processBatch, 0);
                } else {
                    resolve(allText);
                }
            }
            
            processBatch();
        });
    }

    function isHiddenOrNonContent(element) {
        // Check if element is hidden
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return true;
        }
        
        // Check if element is likely non-content based on class/id
        const className = element.className.toLowerCase();
        const id = element.id.toLowerCase();
        const nonContentPatterns = [
            'nav', 'menu', 'sidebar', 'footer', 'header', 'ad', 'banner',
            'popup', 'modal', 'overlay', 'cookie', 'gdpr', 'social', 'share'
        ];
        
        return nonContentPatterns.some(pattern => 
            className.includes(pattern) || id.includes(pattern)
        );
    }

    function extractHeadings() {
        const headings = [];
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        headingElements.forEach(heading => {
            const text = heading.innerText || heading.textContent || '';
            if (text.trim() && text.length < 200) { // Reasonable heading length
                headings.push({
                    level: parseInt(heading.tagName.charAt(1)),
                    text: text.trim()
                });
            }
        });
        
        return headings;
    }

    function extractRelevantLinks() {
        const links = [];
        const linkElements = document.querySelectorAll('a[href]');
        
        linkElements.forEach(link => {
            const href = link.getAttribute('href');
            const text = (link.innerText || link.textContent || '').trim();
            
            // Skip if no text, too long, or likely not content-related
            if (!text || text.length > 100 || isNavigationLink(text, href)) {
                return;
            }
            
            // Convert relative URLs to absolute
            let absoluteUrl = href;
            try {
                absoluteUrl = new URL(href, window.location.origin).href;
            } catch (e) {
                // Skip invalid URLs
                return;
            }
            
            links.push({ text, url: absoluteUrl });
        });
        
        // Sort by text length (prefer descriptive links) and deduplicate
        return links
            .filter((link, index, self) => 
                self.findIndex(l => l.url === link.url) === index
            )
            .sort((a, b) => b.text.length - a.text.length);
    }

    function isNavigationLink(text, href) {
        const navPatterns = [
            'home', 'menu', 'login', 'register', 'search', 'contact',
            'about', 'privacy', 'terms', 'cookie', 'next', 'previous',
            'back', 'top', 'up', 'close', 'toggle'
        ];
        
        const lowerText = text.toLowerCase();
        const lowerHref = href.toLowerCase();
        
        return navPatterns.some(pattern => 
            lowerText.includes(pattern) || lowerHref.includes(pattern)
        ) || text.length < 3;
    }

    function detectPageType() {
        // Analyze URL, title, and content to determine page type
        const url = window.location.href.toLowerCase();
        const title = document.title.toLowerCase();
        const bodyClass = document.body.className.toLowerCase();
        
        // Common page type patterns
        const patterns = {
            article: ['article', 'post', 'blog', 'news', 'story'],
            documentation: ['docs', 'documentation', 'guide', 'manual', 'api', 'reference'],
            ecommerce: ['shop', 'store', 'product', 'cart', 'buy', 'price'],
            social: ['profile', 'timeline', 'feed', 'social', 'community'],
            search: ['search', 'results', 'query'],
            homepage: ['home', 'index', 'welcome'],
            form: ['form', 'contact', 'signup', 'login', 'register']
        };
        
        for (const [type, keywords] of Object.entries(patterns)) {
            if (keywords.some(keyword => 
                url.includes(keyword) || title.includes(keyword) || bodyClass.includes(keyword)
            )) {
                return type;
            }
        }
        
        // Default fallback
        return 'webpage';
    }

    function cleanContent(content) {
        if (!content) return '';
        
        return content
            // Remove excessive whitespace
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // Remove excessive spaces
            .replace(/[ \t]+/g, ' ')
            // Remove empty lines and trim
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n')
            .trim();
    }

    // Enhanced keyboard shortcuts
    function addKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + Shift + O to open SideLlama
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'O') {
                event.preventDefault();
                chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
            }
            
            // Ctrl/Cmd + Shift + S to summarize page
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                chrome.runtime.sendMessage({ type: 'SUMMARIZE_PAGE' });
            }
            
            // Ctrl/Cmd + Shift + E to explain selection
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'E') {
                event.preventDefault();
                const selection = window.getSelection().toString().trim();
                if (selection) {
                    chrome.runtime.sendMessage({ 
                        type: 'EXPLAIN_SELECTION', 
                        selection 
                    });
                }
            }
        });
    }

    // Context menu support for selected text
    function addContextMenuSupport() {
        document.addEventListener('contextmenu', (event) => {
            // Store the clicked element and selection for potential use
            window.sideLlamaLastClickedElement = event.target;
            window.sideLlamaLastSelection = window.getSelection().toString().trim();
        });
    }

    // Auto-extract page context when page loads (for caching)
    function cachePageContext() {
        // Wait for page to be fully loaded
        if (document.readyState === 'complete') {
            setTimeout(async () => {
                try {
                    const context = await extractPageContent();
                    // Store in session storage for quick access
                    sessionStorage.setItem('sideLlamaPageContext', JSON.stringify(context));
                } catch (error) {
                    console.warn('Failed to cache page context:', error);
                }
            }, 1000);
        } else {
            window.addEventListener('load', () => cachePageContext());
        }
    }

    // Handler functions for context menu actions
    async function handlePageSummary() {
        // Extract page content and send to service worker for AI processing
        const pageData = await extractPageContent();
        
        // Send directly to service worker to add summary message to sidepanel
        chrome.runtime.sendMessage({
            type: 'SEND_MESSAGE',
            data: {
                message: `Please provide a concise summary of this webpage:\n\n**Title:** ${pageData.title}\n**URL:** ${pageData.url}\n**Type:** ${pageData.pageType}\n\n**Content:**\n${pageData.content}`,
                model: 'qwen2.5:7b', // Default model
                conversationId: 'context_' + Date.now(),
                stream: false
            }
        });
    }
    
    async function handleExplainSelection(selection) {
        if (!selection) return;
        
        // Get page context for better explanation
        const pageData = await extractPageContent();
        
        // Send explanation request to service worker
        chrome.runtime.sendMessage({
            type: 'SEND_MESSAGE',
            data: {
                message: `Please explain this selected text from the webpage "${pageData.title}":\n\n**Selected Text:**\n"${selection}"\n\n**Page Context:**\n${pageData.content.substring(0, 2000)}`,
                model: 'qwen2.5:7b', // Default model
                conversationId: 'context_' + Date.now(),
                stream: false
            }
        });
    }
    
    function displayScreenshot(dataUrl) {
        // Create a floating screenshot preview
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 8px;
            padding: 10px;
            max-width: 300px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = `
            width: 100%;
            height: auto;
            border-radius: 4px;
            cursor: pointer;
        `;
        
        const closeBtn = document.createElement('div');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 10px;
            color: white;
            cursor: pointer;
            font-size: 20px;
            font-weight: bold;
        `;
        
        closeBtn.addEventListener('click', () => overlay.remove());
        img.addEventListener('click', () => {
            // Open in new tab for full view
            const newTab = window.open();
            newTab.document.write(`<img src="${dataUrl}" style="max-width: 100%; height: auto;">`);
        });
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (overlay.parentNode) overlay.remove();
        }, 10000);
        
        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
    }

    // Initialize all features
    addKeyboardShortcuts();
    addContextMenuSupport();
    cachePageContext();

    // Signal that the content script is ready
    console.log('🦙 SideLlama enhanced content script loaded');
})();