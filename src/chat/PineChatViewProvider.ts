/**
 * PineChatViewProvider - Dedicated Sidebar Webview Chat Interface for PineForge
 * Works natively in Cursor and VS Code sidebar with live streaming, settings, and execution transcripts.
 */

import * as vscode from 'vscode'
import { PineKnowledgeEngine } from '../knowledge/PineKnowledgeEngine'
import { PineAgentController } from '../agent/PineAgentController'
import { PineValidateTool } from '../tools/PineValidateTool'

interface TranscriptStep { time: string; state: string; message: string }
interface WebviewConfig { host?: string; model?: string; temperature?: number; autoRepair?: boolean; maxIterations?: number }
interface WebviewMessage {
  type: string; prompt?: string; code?: string; action?: string; mode?: 'replace' | 'insert'
  includeContext?: boolean; config?: WebviewConfig
}

export class PineChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'pineforge.chatView'
  private view?: vscode.WebviewView

  constructor(private readonly extensionUri: vscode.Uri, private readonly knowledgeEngine: PineKnowledgeEngine) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] }
    webviewView.webview.html = this.getHtml()
    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => this.handleMessage(msg))
    this.postStatus()
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'webviewReady':
      case 'refreshStatus':
        await this.postStatus()
        break
      case 'sendPrompt':
        if (message.prompt) { await this.processPrompt(message.prompt, Boolean(message.includeContext)) }
        break
      case 'quickAction':
        if (message.action) { await this.processAction(message.action) }
        break
      case 'applyCode':
        if (message.code) { await this.applyCodeToEditor(message.code, message.mode ?? 'replace') }
        break
      case 'updateConfig':
        if (message.config) { await this.updateConfiguration(message.config) }
        break
      case 'openVSCodeSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'pineForge')
        break
      default:
        break
    }
  }

  private async updateConfiguration(config: WebviewConfig): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('pineForge')
    if (config.host) { await cfg.update('ollama.host', config.host, vscode.ConfigurationTarget.Global) }
    if (config.model) { await cfg.update('ollama.model', config.model, vscode.ConfigurationTarget.Global) }
    if (typeof config.temperature === 'number') { await cfg.update('ollama.temperature', config.temperature, vscode.ConfigurationTarget.Global) }
    if (typeof config.autoRepair === 'boolean') { await cfg.update('agent.autoRepair', config.autoRepair, vscode.ConfigurationTarget.Global) }
    if (typeof config.maxIterations === 'number') { await cfg.update('agent.maxIterations', config.maxIterations, vscode.ConfigurationTarget.Global) }
    PineAgentController.getInstance().reloadAgent()
    vscode.window.showInformationMessage('PineForge: Configuration saved.')
    await this.postStatus()
  }

  private async processPrompt(prompt: string, includeContext: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor
    const fileContent = (includeContext && editor) ? editor.document.getText() : undefined
    const selection = (includeContext && editor) ? editor.document.getText(editor.selection) : undefined
    const fileName = editor?.document.fileName

    const transcript: TranscriptStep[] = []
    this.postMessage({ type: 'startStreaming', userPrompt: prompt })

    try {
      const agent = PineAgentController.getInstance().getAgent()
      const client = agent.getClient()
      const tools = agent.getOllamaTools()
      const systemPrompt = 'You are PineForge AI, expert TradingView Pine Script v6 engineering assistant.\\n' +
        'Rules:\\n' +
        '1. Always use Pine Script v6 syntax (@version=6) with indicator() or strategy() declaration.\\n' +
        '2. NEVER use semicolons (;) at line endings. Pine Script uses indentation and newlines.\\n' +
        '3. Use standard Pine v6 inputs: input.int(), input.float(), input.bool(), input.string(), input.color().\\n' +
        '4. User-defined types use: type TypeName\\n    float field1\\n    int field2 (never use struct or C-syntax).\\n' +
        '5. Use standard plotting functions: plot(), plotshape(), plotchar(), line.new(), box.new(), label.new().\\n' +
        '6. For collections use: array.new<float>(), matrix.new<float>(), map.new<string, float>().\\n' +
        '7. Never invent fake APIs. Output valid, complete, copy-pasteable Pine Script v6 code in ```pine code blocks.'
      
      let userMsg = prompt
      if (fileContent) {
        userMsg = `Current active script (${fileName ?? 'script.pine'}):\n\`\`\`pine\n${fileContent}\n\`\`\`\n${selection ? `Selected text:\n\`\`\`pine\n${selection}\n\`\`\`\n` : ''}\nUser Request: ${prompt}`
      }

      const onProgress = (state: string, msg: string) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const step: TranscriptStep = { time, state, message: msg }
        transcript.push(step)
        this.postMessage({ type: 'progress', step, transcript })
      }

      const onStream = (chunk: string) => {
        this.postMessage({ type: 'streamChunk', chunk })
      }

      const response = await client.executeAgentLoop(
        systemPrompt,
        userMsg,
        tools,
        async (name, args) => {
          const res = await agent.executeTool(name, args as Record<string, unknown>)
          return res.content
        },
        onProgress,
        onStream,
      )

      this.postMessage({ type: 'streamEnd', content: response, transcript })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.postMessage({ type: 'streamError', error: errorMsg, transcript })
    }
  }

  private async processAction(action: string): Promise<void> {
    const editor = vscode.window.activeTextEditor
    const code = editor?.document.getText() ?? ''

    if (action === 'validate') {
      const tool = new PineValidateTool(this.knowledgeEngine)
      const res = await tool.execute({ code, mode: 'full' })
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      this.postMessage({
        type: 'botResponse',
        content: `### Pine Script Validation Report\n\n${res.content}`,
        transcript: [{ time, state: 'VALIDATE', message: 'Executed full Pine v6 conformance validation.' }],
      })
      return
    }

    const prompts: Record<string, string> = {
      explain: 'Explain the logic, indicators, and structure of this Pine Script v6 file in detail.',
      fix: 'Diagnose syntax errors, repainting issues, and runtime na bugs in this script and provide the corrected Pine Script v6 code.',
      optimize: 'Optimize this Pine Script v6 code for calculation performance, memory efficiency, and caching while maintaining exact TradingView Pine Script v6 syntax. Provide the full valid v6 script.',
      migrate: 'Migrate this Pine Script code to Pine Script v6 standard syntax, utilizing new v6 features. Provide the full valid v6 script.',
    }

    const promptText = prompts[action] ?? `Execute ${action} on the current script.`
    await this.processPrompt(promptText, true)
  }

  private async applyCodeToEditor(code: string, mode: 'replace' | 'insert'): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      const doc = await vscode.workspace.openTextDocument({ language: 'pine', content: code })
      await vscode.window.showTextDocument(doc)
      return
    }

    await editor.edit(editBuilder => {
      if (mode === 'insert') {
        editBuilder.insert(editor.selection.active, code)
      } else if (!editor.selection.isEmpty) {
        editBuilder.replace(editor.selection, code)
      } else {
        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length),
        )
        editBuilder.replace(fullRange, code)
      }
    })

    vscode.window.showInformationMessage('PineForge: Applied code to editor.')
  }

  private async postStatus(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('pineForge')
      let configuredModel = config.get<string>('ollama.model', 'minimax-m3:cloud')
      const host = config.get<string>('ollama.host', 'http://localhost:11434')
      const temperature = config.get<number>('ollama.temperature', 0)
      const autoRepair = config.get<boolean>('agent.autoRepair', true)
      const maxIterations = config.get<number>('agent.maxIterations', 12)
      const activeFile = vscode.window.activeTextEditor?.document.fileName.split(/[/\\]/).pop()

      let connected = false
      let models: string[] = []

      try {
        const agent = PineAgentController.getInstance().getAgent()
        if (agent) {
          connected = await agent.healthCheck()
          if (connected) {
            models = (await agent.getClient().getModels()).filter(m => !m.includes('embed'))
            if (models.length > 0 && (!configuredModel || configuredModel === 'qwen2.5-coder:7b')) {
              configuredModel = models.includes('minimax-m3:cloud') ? 'minimax-m3:cloud' : models[0]
            }
          }
        }
      } catch {
        connected = false
        models = []
      }

      this.postMessage({
        type: 'statusUpdate',
        connected,
        host,
        model: configuredModel,
        temperature,
        autoRepair,
        maxIterations,
        models,
        activeFile,
      })
    } catch {
      // Safe fallback
    }
  }

  private postMessage(msg: Record<string, unknown>): void {
    this.view?.webview.postMessage(msg)
  }

  private getHtml(): string {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
:root{--bg:var(--vscode-sideBar-background,#1e1e1e);--fg:var(--vscode-foreground,#ccc);--card:var(--vscode-editor-background,#252526);--border:var(--vscode-widget-border,#333);--accent:var(--vscode-button-background,#0e639c);--accent-hover:var(--vscode-button-hoverBackground,#1177bb);font-family:var(--vscode-font-family,sans-serif);}
*{box-sizing:border-box;margin:0;padding:0;}body{background:var(--bg);color:var(--fg);font-size:12px;display:flex;flex-direction:column;height:100vh;overflow:hidden;}
.header{padding:6px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:6px;}
.model-tag{display:flex;align-items:center;gap:5px;cursor:pointer;padding:2px 6px;border-radius:4px;background:var(--card);border:1px solid var(--border);font-size:11px;}
.dot{width:7px;height:7px;border-radius:50%;background:#e51400;}.dot.online{background:#89d185;}.header-actions{display:flex;gap:4px;}
.settings-drawer{display:none;padding:10px;border-bottom:1px solid var(--border);background:var(--card);flex-direction:column;gap:6px;font-size:11px;}
.settings-drawer.open{display:flex;}.cfg-row{display:flex;flex-direction:column;gap:2px;}.cfg-row label{opacity:0.85;font-size:10px;}
.cfg-input{background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:3px;padding:4px 6px;font-size:11px;}
.cfg-actions{display:flex;gap:6px;margin-top:4px;}
.tab-bar{display:flex;border-bottom:1px solid var(--border);background:var(--card);}
.tab-btn{flex:1;padding:5px;background:transparent;border:none;color:var(--fg);cursor:pointer;font-size:11px;opacity:0.7;border-bottom:2px solid transparent;}
.tab-btn.active{opacity:1;font-weight:bold;border-bottom:2px solid var(--accent);}
.quick-bar{display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none;}
.chip{background:var(--card);border:1px solid var(--border);color:var(--fg);padding:2px 7px;border-radius:12px;cursor:pointer;white-space:nowrap;font-size:11px;}
.chip:hover{background:var(--accent);color:#fff;}.view-panel{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;}
.msg{padding:7px 9px;border-radius:6px;line-height:1.4;word-break:break-word;}.msg.user{background:var(--accent);color:#fff;align-self:flex-end;max-width:85%;}.msg.bot{background:var(--card);border:1px solid var(--border);align-self:flex-start;max-width:95%;}
.transcript-box{margin-bottom:6px;border:1px solid var(--border);border-radius:4px;background:#181818;font-size:11px;}
.transcript-box summary{padding:4px 8px;cursor:pointer;background:#202020;border-radius:4px;color:#85c2ff;font-size:10px;user-select:none;}
.transcript-steps{padding:6px 8px;display:flex;flex-direction:column;gap:4px;font-family:monospace;font-size:10px;color:#bbb;}.transcript-step{display:flex;gap:6px;}.t-time{opacity:0.6;}.t-state{color:#4ec9b0;font-weight:600;}
.active-stream-header{font-size:10px;color:#dcdcaa;margin-bottom:4px;font-style:italic;display:flex;align-items:center;gap:4px;}
.pulse-dot{width:6px;height:6px;border-radius:50%;background:#dcdcaa;animation:pulse 1s infinite alternate;}@keyframes pulse{0%{opacity:0.3;}100%{opacity:1;}}
.log-stream{font-family:monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;color:#ccc;}
pre{background:#181818;padding:6px;border-radius:4px;overflow-x:auto;margin:4px 0;border:1px solid #2d2d2d;}code{font-family:var(--vscode-editor-font-family,monospace);font-size:11px;}
.code-actions{display:flex;gap:4px;justify-content:flex-end;margin-top:4px;}.btn-sm{font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid var(--border);background:#333;color:#fff;cursor:pointer;}.btn-sm:hover{background:var(--accent);}
.btn-primary{background:var(--accent);color:#fff;border:none;border-radius:3px;padding:4px 8px;cursor:pointer;font-weight:600;font-size:11px;}.btn-primary:hover{background:var(--accent-hover);}
.input-area{padding:8px 10px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:5px;}
.context-row{display:flex;align-items:center;justify-content:space-between;font-size:11px;opacity:0.85;}.input-row{display:flex;gap:6px;}
textarea{flex:1;height:48px;resize:none;background:var(--card);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:5px;font-family:inherit;font-size:12px;}
textarea:focus{outline:1px solid var(--accent);}.send-btn{background:var(--accent);color:#fff;border:none;border-radius:4px;padding:0 12px;cursor:pointer;font-weight:bold;}.send-btn:hover{background:var(--accent-hover);}
</style></head><body>
<div class="header">
<div class="model-tag" id="modelTag"><span class="dot" id="statusDot"></span><span id="modelName">Connecting...</span></div>
<div class="header-actions"><button class="btn-sm" id="btnSettingsToggle">⚙️ Settings</button><button class="btn-sm" id="btnClearChat">Clear</button></div>
</div>
<div class="settings-drawer" id="settingsDrawer">
<div class="cfg-row"><label>Model</label><select id="cfgModelSelect" class="cfg-input"></select></div>
<div class="cfg-row"><label>Custom Model Tag</label><input type="text" id="cfgModelCustom" class="cfg-input" placeholder="e.g. minimax-m3:cloud"></div>
<div class="cfg-row"><label>Ollama Host</label><input type="text" id="cfgHost" class="cfg-input" placeholder="http://localhost:11434"></div>
<div class="cfg-row"><label>Temperature</label><input type="number" id="cfgTemp" class="cfg-input" step="0.1" min="0" max="1" value="0"></div>
<div class="cfg-row"><label>Max Iterations</label><input type="number" id="cfgMaxIter" class="cfg-input" min="1" max="30" value="12"></div>
<div class="cfg-row"><label><input type="checkbox" id="cfgAutoRepair"> Auto-repair validation failures</label></div>
<div class="cfg-actions"><button class="btn-primary" id="btnSaveSettings">Save & Apply</button><button class="btn-sm" id="btnVSCodeSettings">VS Code Settings</button></div>
</div>
<div class="tab-bar">
<button class="tab-btn active" id="tabChatBtn">💬 Chat</button>
<button class="tab-btn" id="tabLogBtn">📜 Transcript Log</button>
</div>
<div class="quick-bar" id="quickBar">
<button class="chip" data-action="explain">💡 Explain</button>
<button class="chip" data-action="fix">🔧 Fix</button>
<button class="chip" data-action="optimize">⚡ Optimize</button>
<button class="chip" data-action="migrate">🚀 v5→v6</button>
<button class="chip" data-action="validate">✓ Validate</button>
</div>
<div class="view-panel" id="chatFlow">
<div class="msg bot">Hello! I am <strong>PineForge AI</strong>. Ask questions about Pine Script v6 or use the action chips above.</div>
</div>
<div class="view-panel" id="logFlow" style="display:none;">
<div style="display:flex;justify-content:flex-end;margin-bottom:6px;"><button class="btn-sm" id="btnCopyLog">Copy Log</button></div>
<div class="log-stream" id="fullLogStream">PineForge Agent Initialized. Ready for requests.\n</div>
</div>
<div class="input-area">
<div class="context-row"><label><input type="checkbox" id="ctxCheck" checked> Include active script</label><span id="activeFileLabel">No active file</span></div>
<div class="input-row"><textarea id="promptInput" placeholder="Ask PineForge AI... (Enter to send, Shift+Enter for newline)"></textarea><button class="send-btn" id="sendBtn">Send</button></div>
</div>
<script>
(function(){
try {
var vscode = acquireVsCodeApi();
var chatFlow = document.getElementById('chatFlow');
var logFlow = document.getElementById('logFlow');
var fullLogStream = document.getElementById('fullLogStream');
var promptInput = document.getElementById('promptInput');
var ctxCheck = document.getElementById('ctxCheck');
var currentTranscript = [], streamBuffer = '', activeBotMsg = null, activeStreamBody = null, activeStreamHeader = null;

function switchTab(t){
document.getElementById('tabChatBtn').className = 'tab-btn ' + (t==='chat'?'active':'');
document.getElementById('tabLogBtn').className = 'tab-btn ' + (t==='logs'?'active':'');
chatFlow.style.display = t==='chat' ? 'flex' : 'none';
logFlow.style.display = t==='logs' ? 'flex' : 'none';
document.getElementById('quickBar').style.display = t==='chat' ? 'flex' : 'none';
}
function submitPrompt(){
var t = promptInput.value.trim();
if (!t) return;
appendMessage(t, 'user');
promptInput.value = '';
appendLog('USER: ' + t);
vscode.postMessage({ type: 'sendPrompt', prompt: t, includeContext: Boolean(ctxCheck.checked) });
}
function toggleSettings(){
document.getElementById('settingsDrawer').classList.toggle('open');
}
function saveSettings(){
var m = document.getElementById('cfgModelCustom').value.trim() || document.getElementById('cfgModelSelect').value;
var h = document.getElementById('cfgHost').value.trim(), temp = parseFloat(document.getElementById('cfgTemp').value) || 0;
var iter = parseInt(document.getElementById('cfgMaxIter').value, 10) || 12, rep = document.getElementById('cfgAutoRepair').checked;
vscode.postMessage({ type: 'updateConfig', config: { model: m, host: h, temperature: temp, maxIterations: iter, autoRepair: rep } });
toggleSettings();
}
function clearChat(){
chatFlow.innerHTML = '<div class="msg bot">Chat cleared. Ready for your Pine Script v6 requests.</div>';
fullLogStream.innerText = 'Log cleared.\\n';
}
function appendLog(text){
fullLogStream.innerText += text + '\\n';
logFlow.scrollTop = logFlow.scrollHeight;
}
function appendMessage(c, t, trans){
var d = document.createElement('div');
d.className = 'msg ' + t;
var html = '';
if (trans && trans.length > 0) {
html += '<details class="transcript-box"><summary>⚡ <strong>Execution Transcript (' + trans.length + ' steps)</strong></summary><div class="transcript-steps">';
trans.forEach(function(s){ html += '<div class="transcript-step"><span class="t-time">[' + s.time + ']</span><span class="t-state">[' + s.state + ']</span> <span>' + s.message + '</span></div>'; });
html += '</div></details>';
}
html += renderMarkdown(c);
d.innerHTML = html;
chatFlow.appendChild(d);
chatFlow.scrollTop = chatFlow.scrollHeight;
return d;
}
function renderMarkdown(t){
if (!t) return '';
var esc = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
esc = esc.replace(/\`\`\`(?:pine|pinescript)?([\\s\\S]*?)\`\`\`/g, function(_, c){
return '<pre><code>' + c.trim() + '</code><div class="code-actions"><button class="btn-sm btn-apply">Apply</button><button class="btn-sm btn-insert">Insert</button><button class="btn-sm btn-copy">Copy</button></div></pre>';
});
esc = esc.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
esc = esc.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
return esc.replace(/\\n/g, '<br>');
}

document.getElementById('modelTag').addEventListener('click', toggleSettings);
document.getElementById('btnSettingsToggle').addEventListener('click', toggleSettings);
document.getElementById('btnClearChat').addEventListener('click', clearChat);
document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
document.getElementById('btnVSCodeSettings').addEventListener('click', function(){ vscode.postMessage({ type: 'openVSCodeSettings' }); });
document.getElementById('tabChatBtn').addEventListener('click', function(){ switchTab('chat'); });
document.getElementById('tabLogBtn').addEventListener('click', function(){ switchTab('logs'); });
document.getElementById('btnCopyLog').addEventListener('click', function(){ navigator.clipboard.writeText(fullLogStream.innerText); });
document.getElementById('sendBtn').addEventListener('click', submitPrompt);
document.getElementById('cfgModelSelect').addEventListener('change', function(e){ if (e.target.value) document.getElementById('cfgModelCustom').value = e.target.value; });
promptInput.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPrompt(); } });

var chips = document.querySelectorAll('.chip');
for (var i = 0; i < chips.length; i++) {
(function(btn){
btn.addEventListener('click', function(){ vscode.postMessage({ type: 'quickAction', action: btn.getAttribute('data-action') }); });
})(chips[i]);
}

chatFlow.addEventListener('click', function(e){
var applyBtn = e.target.closest('.btn-apply'), insertBtn = e.target.closest('.btn-insert'), copyBtn = e.target.closest('.btn-copy');
if (applyBtn) {
var code = applyBtn.closest('pre').querySelector('code').innerText;
vscode.postMessage({ type: 'applyCode', code: code, mode: 'replace' });
} else if (insertBtn) {
var code = insertBtn.closest('pre').querySelector('code').innerText;
vscode.postMessage({ type: 'applyCode', code: code, mode: 'insert' });
} else if (copyBtn) {
navigator.clipboard.writeText(copyBtn.closest('pre').querySelector('code').innerText);
copyBtn.innerText = 'Copied!';
setTimeout(function(){ copyBtn.innerText = 'Copy'; }, 1500);
}
});

window.addEventListener('message', function(e){
var m = e.data;
if (!m) return;
if (m.type === 'statusUpdate') {
document.getElementById('modelName').innerText = m.connected ? (m.model || 'Connected') : 'Disconnected';
document.getElementById('statusDot').className = 'dot ' + (m.connected ? 'online' : '');
document.getElementById('activeFileLabel').innerText = m.activeFile || 'No active file';
document.getElementById('cfgHost').value = m.host || 'http://localhost:11434';
document.getElementById('cfgModelCustom').value = m.model || '';
document.getElementById('cfgTemp').value = m.temperature !== undefined ? m.temperature : 0;
document.getElementById('cfgMaxIter').value = m.maxIterations || 12;
document.getElementById('cfgAutoRepair').checked = Boolean(m.autoRepair);
var sel = document.getElementById('cfgModelSelect');
sel.innerHTML = '';
var list = m.models && m.models.length > 0 ? m.models : [m.model].filter(Boolean);
list.forEach(function(item){
var opt = document.createElement('option');
opt.value = item; opt.innerText = item;
if (item === m.model) opt.selected = true;
sel.appendChild(opt);
});
} else if (m.type === 'startStreaming') {
streamBuffer = ''; currentTranscript = [];
activeBotMsg = document.createElement('div'); activeBotMsg.className = 'msg bot';
activeStreamHeader = document.createElement('div'); activeStreamHeader.className = 'active-stream-header';
activeStreamHeader.innerHTML = '<span class="pulse-dot"></span><span>Thinking...</span>';
activeStreamBody = document.createElement('div'); activeStreamBody.className = 'stream-body';
activeBotMsg.appendChild(activeStreamHeader); activeBotMsg.appendChild(activeStreamBody);
chatFlow.appendChild(activeBotMsg); chatFlow.scrollTop = chatFlow.scrollHeight;
} else if (m.type === 'progress') {
currentTranscript = m.transcript || [];
if (m.step && m.step.state === 'RESET_STREAM') {
streamBuffer = '';
if (activeStreamBody) { activeStreamBody.innerHTML = ''; }
} else {
appendLog('[' + m.step.time + '] [' + m.step.state + '] ' + m.step.message);
if (activeStreamHeader) { activeStreamHeader.innerHTML = '<span class="pulse-dot"></span><span>[' + m.step.state + '] ' + m.step.message + '</span>'; }
}
} else if (m.type === 'streamChunk') {
streamBuffer += m.chunk;
if (activeStreamBody) { activeStreamBody.innerHTML = renderMarkdown(streamBuffer); chatFlow.scrollTop = chatFlow.scrollHeight; }
} else if (m.type === 'streamEnd' || m.type === 'botResponse') {
var trans = m.transcript || currentTranscript, content = m.content || streamBuffer;
if (activeBotMsg) { activeBotMsg.remove(); activeBotMsg = null; activeStreamBody = null; activeStreamHeader = null; }
appendMessage(content, 'bot', trans);
appendLog('AGENT:\\n' + content + '\\n---');
currentTranscript = []; streamBuffer = '';
} else if (m.type === 'streamError') {
var trans = m.transcript || currentTranscript;
if (activeBotMsg) { activeBotMsg.remove(); activeBotMsg = null; activeStreamBody = null; activeStreamHeader = null; }
appendMessage('Error: ' + m.error, 'bot', trans);
appendLog('ERROR: ' + m.error);
currentTranscript = []; streamBuffer = '';
}
});

vscode.postMessage({ type: 'webviewReady' });
setInterval(function(){ vscode.postMessage({ type: 'refreshStatus' }); }, 5000);
} catch(err) {
console.error('PineForge UI error:', err);
}
})();
</script></body></html>`
  }
}
