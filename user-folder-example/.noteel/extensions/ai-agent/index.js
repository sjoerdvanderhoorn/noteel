const defaultExport = function (Noteel) {
  return function () {
    
    // Load CSS styles
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = './user-folder-example/.noteel/extensions/ai-agent/styles.css';
    document.head.appendChild(cssLink);
    
    // State
    let isAIAgentActive = false;
    let llmConfig = null;
    let chatHistory = [];
    let isProcessing = false;
    let expandedToolMessages = new Set(); // Track which tool messages are expanded
    let pendingChanges = new Map(); // Track pending changes awaiting approval
    let changeIdCounter = 0; // Counter for unique change IDs
    
    // Load LLM configuration from localStorage
    function loadLLMConfig() {
      const saved = localStorage.getItem('noteel_llm_config');
      if (saved) {
        try {
          llmConfig = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to load LLM config:', e);
        }
      }
    }
    
    // Save LLM configuration to localStorage
    function saveLLMConfig(config) {
      llmConfig = config;
      localStorage.setItem('noteel_llm_config', JSON.stringify(config));
    }
    
    // Initialize
    loadLLMConfig();
    
    // Add AI Agent button to the toolbar
    setTimeout(() => {
      const searchInput = document.getElementById('searchInput');
      if (searchInput && !document.getElementById('aiAgentBtn')) {
        const aiAgentBtn = document.createElement('button');
        aiAgentBtn.id = 'aiAgentBtn';
        aiAgentBtn.className = 'ghost icon-btn ai-agent-btn';
        aiAgentBtn.title = 'AI Agent';
        aiAgentBtn.textContent = '🤖';
        aiAgentBtn.addEventListener('click', toggleAIAgent);
        
        searchInput.parentNode.insertBefore(aiAgentBtn, searchInput);
      }
    }, 250);
    
    // Add LLM config button to settings modal
    const originalRenderSettings = Noteel.ui.renderSettings;
    if (originalRenderSettings) {
      Noteel.ui.renderSettings = function() {
        originalRenderSettings();
        
        setTimeout(() => {
          const settingsContent = document.querySelector('.settings-content');
          if (settingsContent && !document.getElementById('llmConfigBtn')) {
            const llmSection = document.createElement('div');
            llmSection.className = 'settings-section';
            llmSection.innerHTML = `
              <h3>AI Agent</h3>
              <button id="llmConfigBtn" class="btn">Configure LLM Provider</button>
            `;
            settingsContent.appendChild(llmSection);
            
            document.getElementById('llmConfigBtn').addEventListener('click', () => {
              showLLMConfigModal();
            });
          }
        }, 50);
      };
    }
    
    // Toggle AI Agent mode
    function toggleAIAgent() {
      isAIAgentActive = !isAIAgentActive;
      
      const searchInput = document.getElementById('searchInput');
      const aiAgentBtn = document.getElementById('aiAgentBtn');
      
      if (isAIAgentActive) {
        // Check if LLM is configured
        if (!llmConfig) {
          showLLMConfigModal();
          isAIAgentActive = false;
          return;
        }
        
        // Hide search input and create AI agent prompt input
        searchInput.style.display = 'none';
        
        const aiPromptInput = document.createElement('input');
        aiPromptInput.type = 'text';
        aiPromptInput.id = 'aiAgentPromptInput';
        aiPromptInput.className = 'ai-agent-prompt-input';
        aiPromptInput.placeholder = 'Tell me what you need me to do...';
        searchInput.parentNode.insertBefore(aiPromptInput, searchInput.nextSibling);
        
        aiPromptInput.focus();
        aiAgentBtn.classList.add('active');
        
        // Add enter key handler
        aiPromptInput.addEventListener('keydown', handlePromptSubmit);
      } else {
        // Remove AI agent prompt input and restore search bar
        const aiPromptInput = document.getElementById('aiAgentPromptInput');
        if (aiPromptInput) {
          aiPromptInput.remove();
        }
        searchInput.style.display = '';
        aiAgentBtn.classList.remove('active');
      }
    }
    
    // Handle prompt submission
    function handlePromptSubmit(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const prompt = e.target.value.trim();
        if (prompt) {
          e.target.value = '';
          startChat(prompt);
          // Deactivate AI agent mode after starting chat
          toggleAIAgent();
        }
      }
    }
    
    // Start chat with initial prompt
    function startChat(initialPrompt) {
      chatHistory = [];
      addMessage('user', initialPrompt);
      showChatModal();
      processUserMessage(initialPrompt);
    }
    
    // Add message to chat history
    function addMessage(role, content, isTool = false, toolName = '', toolArgs = null) {
      chatHistory.push({ role, content, timestamp: Date.now(), isTool, toolName, toolArgs });
      updateChatDisplay();
    }
    
    // Show LLM configuration modal
    function showLLMConfigModal() {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'llmConfigModal';
      
      const providers = [
        { value: 'openai', label: 'OpenAI (ChatGPT)', defaultUrl: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4.1-mini' },
        { value: 'anthropic', label: 'Anthropic (Claude)', defaultUrl: 'https://api.anthropic.com/v1/messages', defaultModel: 'claude-sonnet-4-5' },
        { value: 'google', label: 'Google (Gemini)', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/models/', defaultModel: 'gemini-2.0-flash-exp' },
        { value: 'openrouter', label: 'OpenRouter', defaultUrl: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: 'anthropic/claude-3.5-sonnet' },
        { value: 'custom', label: 'Custom / Self-Hosted', defaultUrl: '', defaultModel: '' }
      ];
      
      const currentProvider = llmConfig?.provider || 'openai';
      const selectedProvider = providers.find(p => p.value === currentProvider) || providers[0];
      
      modal.innerHTML = `
        <div class="modal-dialog llm-config-modal">
          <div class="modal-header">
            <h2>Configure AI Agent</h2>
            <button class="modal-close" id="closeLLMConfig">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="llmProvider">Provider</label>
              <select id="llmProvider" class="form-control">
                ${providers.map(p => `<option value="${p.value}" ${p.value === currentProvider ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label for="llmUrl">API Endpoint URL</label>
              <input type="text" id="llmUrl" class="form-control" value="${llmConfig?.url || selectedProvider.defaultUrl}" placeholder="https://api.example.com/v1/chat/completions">
              <small class="form-text">The full URL to the API endpoint</small>
            </div>
            
            <div class="form-group">
              <label for="llmApiKey">API Key</label>
              <input type="password" id="llmApiKey" class="form-control" value="${llmConfig?.apiKey || ''}" placeholder="sk-...">
              <small class="form-text">Your API key for authentication</small>
            </div>
            
            <div class="form-group">
              <label for="llmModel">Model Name</label>
              <input type="text" id="llmModel" class="form-control" value="${llmConfig?.model || selectedProvider.defaultModel}" placeholder="gpt-4o">
              <small class="form-text">The model identifier to use</small>
            </div>
            
            <div class="form-group">
              <label for="llmSystemPrompt">System Prompt</label>
              <textarea id="llmSystemPrompt" class="form-control" rows="6" placeholder="You are a helpful assistant...">${llmConfig?.systemPrompt || 'You are an AI assistant integrated into Noteel, a markdown note-taking application. Help users manage their notes by using the provided tools. Be concise and helpful.'}</textarea>
              <small class="form-text">Instructions that define the AI's behavior</small>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancelLLMConfig">Cancel</button>
            <button class="btn btn-primary" id="saveLLMConfig">Save Configuration</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Provider change handler
      const providerSelect = document.getElementById('llmProvider');
      providerSelect.addEventListener('change', (e) => {
        const provider = providers.find(p => p.value === e.target.value);
        if (provider) {
          document.getElementById('llmUrl').value = provider.defaultUrl;
          document.getElementById('llmModel').value = provider.defaultModel;
        }
      });
      
      // Close handlers
      document.getElementById('closeLLMConfig').addEventListener('click', () => {
        modal.remove();
      });
      
      document.getElementById('cancelLLMConfig').addEventListener('click', () => {
        modal.remove();
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
      
      // Save handler
      document.getElementById('saveLLMConfig').addEventListener('click', () => {
        const config = {
          provider: document.getElementById('llmProvider').value,
          url: document.getElementById('llmUrl').value,
          apiKey: document.getElementById('llmApiKey').value,
          model: document.getElementById('llmModel').value,
          systemPrompt: document.getElementById('llmSystemPrompt').value
        };
        
        if (!config.url || !config.apiKey || !config.model) {
          alert('Please fill in all required fields');
          return;
        }
        
        saveLLMConfig(config);
        modal.remove();
        
        // If AI agent was trying to activate, try again
        if (isAIAgentActive) {
          toggleAIAgent();
          toggleAIAgent();
        }
      });
    }
    
    // Show chat modal
    function showChatModal() {
      let modal = document.getElementById('aiChatModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'aiChatModal';
        modal.innerHTML = `
          <div class="modal-dialog ai-chat-modal">
            <div class="modal-header">
              <h2>🤖 AI Agent</h2>
              <button class="modal-close" id="closeAIChat">×</button>
            </div>
            <div class="modal-body">
              <div class="chat-messages" id="chatMessages"></div>
              <div class="chat-input-container">
                <textarea id="chatInput" class="chat-input" placeholder="Type your message..." rows="2"></textarea>
                <button id="sendChatBtn" class="btn btn-primary">Send</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        
        // Close handler
        document.getElementById('closeAIChat').addEventListener('click', () => {
          modal.remove();
          // Ensure AI agent mode is deactivated
          if (isAIAgentActive) {
            toggleAIAgent();
          }
        });
        
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.remove();
            // Ensure AI agent mode is deactivated
            if (isAIAgentActive) {
              toggleAIAgent();
            }
          }
        });
        
        // Send handler
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');
        
        sendBtn.addEventListener('click', () => {
          const message = chatInput.value.trim();
          if (message && !isProcessing) {
            chatInput.value = '';
            addMessage('user', message);
            processUserMessage(message);
          }
        });
        
        chatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
          }
        });
      }
      
      updateChatDisplay();
      
      // Focus input
      setTimeout(() => {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) chatInput.focus();
      }, 100);
    }
    
    // Update chat display
    function updateChatDisplay() {
      const chatMessages = document.getElementById('chatMessages');
      if (!chatMessages) return;
      
      chatMessages.innerHTML = chatHistory.map((msg, idx) => {
        if (msg.isChange) {
          const isExpanded = expandedToolMessages.has(idx);
          const canUndo = !msg.undone;
          const statusClass = msg.undone ? 'undone' : 'applied';
          const statusText = msg.undone ? '↩️ Undone' : '✅ Applied';
          
          return `
            <div class="chat-message change-message ${statusClass} ${isExpanded ? 'expanded' : ''}" data-change-index="${idx}">
              <div class="change-message-header">
                <span class="change-message-icon">${msg.isNew ? '📝' : '✏️'}</span>
                <span class="change-message-title">${msg.isNew ? 'Create' : 'Update'}: ${msg.path}</span>
                <span class="change-status">${statusText}</span>
                ${canUndo ? `<button class="btn-undo" data-change-id="${msg.changeId}" title="Undo this change">Undo</button>` : ''}
                <span class="change-message-toggle">▼</span>
              </div>
              <div class="change-message-content">
                <div class="diff-container">
                  ${msg.isNew ? 
                    `<div class="diff-section">
                      <div class="diff-inline">${msg.newContent.split('\n').map(line => `<div class="diff-line diff-added">+ ${escapeHtml(line)}</div>`).join('')}</div>
                    </div>` :
                    `<div class="diff-section">
                      <div class="diff-inline">${renderInlineDiff(generateInlineDiff(msg.oldContent, msg.newContent))}</div>
                    </div>`
                  }
                </div>
              </div>
            </div>
          `;
        }
        
        if (msg.isTool) {
          const toolTitle = getToolFriendlyTitle(msg.toolName);
          const hasParams = msg.toolArgs && Object.keys(msg.toolArgs).length > 0;
          const isExpanded = expandedToolMessages.has(idx);
          return `
            <div class="chat-message tool-message ${isExpanded ? 'expanded' : ''}" data-tool-index="${idx}">
              <div class="tool-message-header">
                <span class="tool-message-icon">⚙️</span>
                <span class="tool-message-title">${toolTitle}</span>
                <span class="tool-message-toggle">▼</span>
              </div>
              <div class="tool-message-content">
                ${hasParams ? `
                  <div class="tool-section">
                    <div class="tool-section-label">Parameters:</div>
                    <pre>${escapeHtml(JSON.stringify(msg.toolArgs, null, 2))}</pre>
                  </div>
                ` : ''}
                <div class="tool-section">
                  <div class="tool-section-label">Result:</div>
                  <pre>${escapeHtml(msg.content)}</pre>
                </div>
              </div>
            </div>
          `;
        }
        
        const roleClass = msg.role === 'user' ? 'user-message' : 'assistant-message';
        const roleLabel = msg.role === 'user' ? 'You' : 'AI Agent';
        
        return `
          <div class="chat-message ${roleClass}">
            <div class="chat-message-header">${roleLabel}</div>
            <div class="chat-message-content">${escapeHtml(msg.content)}</div>
          </div>
        `;
      }).join('');
      
      // Add event listeners for change message toggles
      chatMessages.querySelectorAll('.change-message-header').forEach(header => {
        header.addEventListener('click', (e) => {
          // Don't toggle if clicking undo button
          if (e.target.classList.contains('btn-undo')) {
            return;
          }
          
          const changeMessage = e.currentTarget.closest('.change-message');
          const changeIndex = parseInt(changeMessage.dataset.changeIndex);
          
          if (expandedToolMessages.has(changeIndex)) {
            expandedToolMessages.delete(changeIndex);
          } else {
            expandedToolMessages.add(changeIndex);
          }
          
          changeMessage.classList.toggle('expanded');
        });
      });
      
      // Add event listeners for undo buttons
      chatMessages.querySelectorAll('.btn-undo').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const changeId = parseInt(btn.dataset.changeId);
          undoChange(changeId);
        });
      });
      
      // Add event listeners for tool message toggle
      chatMessages.querySelectorAll('.tool-message-header').forEach(header => {
        header.addEventListener('click', (e) => {
          const toolMessage = e.currentTarget.closest('.tool-message');
          const toolIndex = parseInt(toolMessage.dataset.toolIndex);
          
          if (expandedToolMessages.has(toolIndex)) {
            expandedToolMessages.delete(toolIndex);
          } else {
            expandedToolMessages.add(toolIndex);
          }
          
          toolMessage.classList.toggle('expanded');
        });
      });
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Update input state
      const chatInput = document.getElementById('chatInput');
      const sendBtn = document.getElementById('sendChatBtn');
      if (chatInput && sendBtn) {
        chatInput.disabled = isProcessing;
        sendBtn.disabled = isProcessing;
        sendBtn.textContent = isProcessing ? 'Processing...' : 'Send';
      }
    }
    
    // Get friendly title for tool calls
    function getToolFriendlyTitle(toolName) {
      const titles = {
        'list_folders': '📁 Listing folders',
        'list_notes': '📄 Listing notes',
        'read_note': '📖 Reading note',
        'read_multiple_notes': '📚 Reading multiple notes',
        'save_note': '💾 Saving note',
        'search_notes': '🔍 Searching notes'
      };
      return titles[toolName] || `⚙️ Tool: ${toolName}`;
    }
    
    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML.replace(/\n/g, '<br>');
    }
    
    // Process user message
    async function processUserMessage(message) {
      isProcessing = true;
      updateChatDisplay();
      
      try {
        // Build messages array for API
        const messages = [
          { role: 'system', content: llmConfig.systemPrompt }
        ];
        
        // Add chat history
        chatHistory.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content });
          }
        });
        
        // Call LLM API
        const response = await callLLM(messages);
        
        if (response.content) {
          addMessage('assistant', response.content);
        }
        
        // Handle tool calls if present
        if (response.tool_calls && response.tool_calls.length > 0) {
          await handleToolCalls(response.tool_calls);
        }
        
      } catch (error) {
        console.error('Error processing message:', error);
        addMessage('assistant', `Error: ${error.message}`);
      } finally {
        isProcessing = false;
        updateChatDisplay();
      }
    }
    
    // Call LLM API
    async function callLLM(messages) {
      const provider = llmConfig.provider;
      
      if (provider === 'anthropic') {
        return await callAnthropicAPI(messages);
      } else if (provider === 'google') {
        return await callGoogleAPI(messages);
      } else {
        // OpenAI-compatible API (OpenAI, OpenRouter, custom)
        return await callOpenAIAPI(messages);
      }
    }
    
    // Call OpenAI-compatible API
    async function callOpenAIAPI(messages) {
      const tools = getToolDefinitions();
      
      const response = await fetch(llmConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: messages,
          tools: tools,
          tool_choice: 'auto'
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} ${error}`);
      }
      
      const data = await response.json();
      const message = data.choices[0].message;
      
      return {
        content: message.content,
        tool_calls: message.tool_calls
      };
    }
    
    // Call Anthropic API
    async function callAnthropicAPI(messages) {
      const tools = getToolDefinitions();
      
      // Extract system message
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      const response = await fetch(llmConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': llmConfig.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: llmConfig.model,
          system: systemMessage,
          messages: conversationMessages,
          tools: tools,
          max_tokens: 4096
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} ${error}`);
      }
      
      const data = await response.json();
      
      // Convert Anthropic response format
      const content = data.content.find(c => c.type === 'text')?.text || '';
      const tool_calls = data.content
        .filter(c => c.type === 'tool_use')
        .map(c => ({
          id: c.id,
          type: 'function',
          function: {
            name: c.name,
            arguments: JSON.stringify(c.input)
          }
        }));
      
      return { content, tool_calls: tool_calls.length > 0 ? tool_calls : null };
    }
    
    // Call Google API
    async function callGoogleAPI(messages) {
      const tools = getToolDefinitions();
      
      // Convert to Google format
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
      
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      
      const url = `${llmConfig.url}${llmConfig.model}:generateContent?key=${llmConfig.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          tools: [{ functionDeclarations: tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))}]
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} ${error}`);
      }
      
      const data = await response.json();
      const candidate = data.candidates[0];
      const content = candidate.content.parts.find(p => p.text)?.text || '';
      
      const tool_calls = candidate.content.parts
        .filter(p => p.functionCall)
        .map((p, idx) => ({
          id: `call_${idx}`,
          type: 'function',
          function: {
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args)
          }
        }));
      
      return { content, tool_calls: tool_calls.length > 0 ? tool_calls : null };
    }
    
    // Get tool definitions
    function getToolDefinitions() {
      return [
        {
          type: 'function',
          function: {
            name: 'list_folders',
            description: 'Get a list of all folders in the note system',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_notes',
            description: 'Get a list of notes in a specific folder',
            parameters: {
              type: 'object',
              properties: {
                folder: {
                  type: 'string',
                  description: 'The folder path (e.g., "recipes", "todo"). Use empty string for root folder.'
                }
              },
              required: ['folder']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'read_note',
            description: 'Read the full content of a specific note',
            parameters: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The full path to the note (e.g., "recipes/pasta-carbonara.md")'
                }
              },
              required: ['path']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'read_multiple_notes',
            description: 'Read the full content of multiple notes at once. More efficient than calling read_note multiple times.',
            parameters: {
              type: 'object',
              properties: {
                paths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of full paths to the notes (e.g., ["recipes/pasta-carbonara.md", "recipes/chicken-stir-fry.md"])'
                }
              },
              required: ['paths']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'save_note',
            description: 'Create or update a note with content and metadata. This will show a diff to the user for approval.',
            parameters: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The full path for the note (e.g., "recipes/new-recipe.md")'
                },
                content: {
                  type: 'string',
                  description: 'The markdown content of the note'
                },
                title: {
                  type: 'string',
                  description: 'The note title'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags for the note'
                },
                categories: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Categories for the note'
                },
                star: {
                  type: 'boolean',
                  description: 'Whether the note is starred'
                },
                color: {
                  type: 'string',
                  description: 'Color for the note'
                }
              },
              required: ['path', 'content']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'search_notes',
            description: 'Search for notes by content or metadata',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query'
                }
              },
              required: ['query']
            }
          }
        }
      ];
    }
    
    // Handle tool calls
    async function handleToolCalls(tool_calls) {
      for (const toolCall of tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        let result;
        try {
          switch (functionName) {
            case 'list_folders':
              result = await toolListFolders();
              break;
            case 'list_notes':
              result = await toolListNotes(args.folder);
              break;
            case 'read_note':
              result = await toolReadNote(args.path);
              break;
            case 'read_multiple_notes':
              result = await toolReadMultipleNotes(args.paths);
              break;
            case 'save_note':
              result = await toolSaveNote(args);
              break;
            case 'search_notes':
              result = await toolSearchNotes(args.query);
              break;
            default:
              result = { error: 'Unknown function' };
          }
        } catch (error) {
          result = { error: error.message };
        }
        
        // Add tool result to chat
        addMessage('tool', JSON.stringify(result, null, 2), true, functionName, args);
      }
      
      // After all tools have been executed, send results back to LLM
      const messages = [
        { role: 'system', content: llmConfig.systemPrompt }
      ];
      
      chatHistory.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        } else if (msg.role === 'tool') {
          // Add tool results as assistant messages for the LLM
          messages.push({
            role: 'assistant',
            content: `Tool ${msg.toolName} returned: ${msg.content}`
          });
        }
      });
      
      // Get next response from LLM
      const response = await callLLM(messages);
      
      // Add assistant's text response if present
      if (response.content) {
        addMessage('assistant', response.content);
      }
      
      // If the LLM wants to make more tool calls, handle them recursively
      if (response.tool_calls && response.tool_calls.length > 0) {
        await handleToolCalls(response.tool_calls);
      }
    }
    
    // Tool: List folders
    async function toolListFolders() {
      const fs = Noteel.loadFs();
      const folders = new Set();
      
      Object.keys(fs.files).forEach(path => {
        if (path.endsWith('.md')) {
          const parts = path.split('/');
          if (parts.length > 1) {
            parts.pop(); // Remove filename
            folders.add(parts.join('/'));
          }
        }
      });
      
      return { folders: Array.from(folders).sort() };
    }
    
    // Tool: List notes
    async function toolListNotes(folder) {
      const fs = Noteel.loadFs();
      const notes = [];
      
      const folderPrefix = folder ? folder + '/' : '';
      
      Object.keys(fs.files).forEach(path => {
        if (!path.endsWith('.md')) return;
        
        if (folder === '') {
          // Root folder - only files without /
          if (!path.includes('/')) {
            const file = fs.files[path];
            const { frontmatter } = Noteel.parseFrontmatter(file.content);
            notes.push({
              path,
              title: frontmatter.title || path.replace('.md', ''),
              tags: frontmatter.tags || [],
              categories: frontmatter.categories || []
            });
          }
        } else {
          // Specific folder
          if (path.startsWith(folderPrefix) && path.indexOf('/', folderPrefix.length) === -1) {
            const file = fs.files[path];
            const { frontmatter } = Noteel.parseFrontmatter(file.content);
            notes.push({
              path,
              title: frontmatter.title || path.split('/').pop().replace('.md', ''),
              tags: frontmatter.tags || [],
              categories: frontmatter.categories || []
            });
          }
        }
      });
      
      return { notes };
    }
    
    // Tool: Read note
    async function toolReadNote(path) {
      const fs = Noteel.loadFs();
      const file = fs.files[path];
      
      if (!file) {
        return { error: 'Note not found' };
      }
      
      const { frontmatter, content } = Noteel.parseFrontmatter(file.content);
      
      return {
        path,
        title: frontmatter.title,
        tags: frontmatter.tags || [],
        categories: frontmatter.categories || [],
        star: frontmatter.star || false,
        color: frontmatter.color || '',
        content
      };
    }
    
    // Tool: Read multiple notes
    async function toolReadMultipleNotes(paths) {
      const fs = Noteel.loadFs();
      const notes = [];
      const errors = [];
      
      for (const path of paths) {
        const file = fs.files[path];
        
        if (!file) {
          errors.push({ path, error: 'Note not found' });
          continue;
        }
        
        const { frontmatter, content } = Noteel.parseFrontmatter(file.content);
        
        notes.push({
          path,
          title: frontmatter.title,
          tags: frontmatter.tags || [],
          categories: frontmatter.categories || [],
          star: frontmatter.star || false,
          color: frontmatter.color || '',
          content
        });
      }
      
      return { 
        notes,
        count: notes.length,
        errors: errors.length > 0 ? errors : undefined
      };
    }
    
    // Tool: Save note (applies immediately with undo option)
    async function toolSaveNote(args) {
      const fs = Noteel.loadFs();
      const existingFile = fs.files[args.path];
      
      // Build new content
      const frontmatter = {
        title: args.title,
        tags: args.tags || [],
        categories: args.categories || [],
        star: args.star || false,
        color: args.color || ''
      };
      
      const frontmatterStr = serializeFrontmatter(frontmatter);
      const newContent = frontmatterStr ? frontmatterStr + '\n\n' + args.content : args.content;
      
      // Create a unique change ID
      const changeId = changeIdCounter++;
      
      // Apply the change immediately
      fs.files[args.path] = {
        content: newContent,
        lastModified: Date.now()
      };
      Noteel.saveFs(fs);
      Noteel.renderAll();
      
      // Store change info for potential undo
      pendingChanges.set(changeId, {
        path: args.path,
        oldContent: existingFile?.content || '',
        newContent: newContent,
        isNew: !existingFile,
        applied: true
      });
      
      // Add change message to chat
      addChangeMessage(changeId, args.path, existingFile?.content || '', newContent, !existingFile);
      
      return { success: true, message: 'Note saved successfully' };
    }
    
    // Serialize frontmatter
    function serializeFrontmatter(frontmatter) {
      if (!frontmatter || Object.keys(frontmatter).length === 0) {
        return '';
      }
      
      const parts = ['---'];
      
      if (frontmatter.title) {
        parts.push(`title: "${frontmatter.title}"`);
      }
      
      if (frontmatter.tags && frontmatter.tags.length > 0) {
        parts.push('tags:');
        frontmatter.tags.forEach(tag => {
          parts.push(`  - ${tag}`);
        });
      }
      
      if (frontmatter.categories && frontmatter.categories.length > 0) {
        parts.push('categories:');
        frontmatter.categories.forEach(cat => {
          parts.push(`  - ${cat}`);
        });
      }
      
      if (frontmatter.star !== undefined && frontmatter.star !== false) {
        parts.push(`star: ${frontmatter.star}`);
      }
      
      if (frontmatter.color) {
        parts.push(`color: ${frontmatter.color}`);
      }
      
      parts.push('---');
      return parts.join('\n');
    }
    
    // Add change message to chat
    function addChangeMessage(changeId, path, oldContent, newContent, isNew) {
      chatHistory.push({
        role: 'change',
        isChange: true,
        changeId: changeId,
        path: path,
        oldContent: oldContent,
        newContent: newContent,
        isNew: isNew
      });
      updateChatDisplay();
    }
    
    // Handle change undo
    function undoChange(changeId) {
      const change = pendingChanges.get(changeId);
      if (!change || !change.applied) return;
      
      const fs = Noteel.loadFs();
      
      // Restore old content or delete if it was new
      if (change.isNew) {
        // Delete the newly created file
        delete fs.files[change.path];
      } else {
        // Restore old content
        fs.files[change.path] = {
          content: change.oldContent,
          lastModified: Date.now()
        };
      }
      
      Noteel.saveFs(fs);
      Noteel.renderAll();
      
      // Update message in history to show undone status
      const msgIndex = chatHistory.findIndex(msg => msg.isChange && msg.changeId === changeId);
      if (msgIndex >= 0) {
        chatHistory[msgIndex].undone = true;
      }
      
      pendingChanges.delete(changeId);
      updateChatDisplay();
    }
    
    // Generate inline diff between old and new content
    function generateInlineDiff(oldContent, newContent) {
      // Normalize line endings and split
      const oldLines = oldContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      const newLines = newContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      
      // Helper to normalize a line for comparison (trim whitespace)
      const normalizeLine = (line) => line.trim();
      
      const m = oldLines.length;
      const n = newLines.length;
      
      // Build LCS table using dynamic programming
      const lcs = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
      
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (normalizeLine(oldLines[i - 1]) === normalizeLine(newLines[j - 1])) {
            lcs[i][j] = lcs[i - 1][j - 1] + 1;
          } else {
            lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
          }
        }
      }
      
      // Backtrack to build the diff
      const diffLines = [];
      let i = m;
      let j = n;
      
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && normalizeLine(oldLines[i - 1]) === normalizeLine(newLines[j - 1])) {
          // Lines are the same (after normalization) - unchanged
          // Use the new version's content for display
          diffLines.unshift({ type: 'unchanged', content: newLines[j - 1] });
          i--;
          j--;
        } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
          // Line was added
          diffLines.unshift({ type: 'added', content: newLines[j - 1] });
          j--;
        } else if (i > 0) {
          // Line was removed
          diffLines.unshift({ type: 'removed', content: oldLines[i - 1] });
          i--;
        }
      }
      
      return diffLines;
    }
    
    // Render inline diff HTML
    function renderInlineDiff(diffLines) {
      return diffLines.map(line => {
        const escapedContent = escapeHtml(line.content);
        if (line.type === 'added') {
          return `<div class="diff-line diff-added">+ ${escapedContent}</div>`;
        } else if (line.type === 'removed') {
          return `<div class="diff-line diff-removed">- ${escapedContent}</div>`;
        } else {
          return `<div class="diff-line diff-unchanged">${escapedContent}</div>`;
        }
      }).join('');
    }
    
    // Tool: Search notes
    async function toolSearchNotes(query) {
      const fs = Noteel.loadFs();
      const results = [];
      const lowerQuery = query.toLowerCase();
      
      Object.keys(fs.files).forEach(path => {
        if (!path.endsWith('.md')) return;
        
        const file = fs.files[path];
        const { frontmatter, content } = Noteel.parseFrontmatter(file.content);
        
        const title = frontmatter.title || path.split('/').pop().replace('.md', '');
        const searchText = `${title} ${content} ${(frontmatter.tags || []).join(' ')} ${(frontmatter.categories || []).join(' ')}`.toLowerCase();
        
        if (searchText.includes(lowerQuery)) {
          results.push({
            path,
            title,
            tags: frontmatter.tags || [],
            categories: frontmatter.categories || [],
            snippet: content.substring(0, 200) + '...'
          });
        }
      });
      
      return { results, count: results.length };
    }
  };
}
