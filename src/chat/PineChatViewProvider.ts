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
    webviewView.webview.html = this.getHtml(webviewView.webview)
    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => this.handleMessage(msg))

    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(() => {
      void this.postStatus()
    })
    webviewView.onDidDispose(() => {
      activeEditorListener.dispose()
    })

    void this.postStatus()
  }

  private getActivePineEditor(): vscode.TextEditor | undefined {
    if (vscode.window.activeTextEditor) {
      return vscode.window.activeTextEditor
    }
    const pineEditor = vscode.window.visibleTextEditors.find(
      e => e.document.languageId === 'pine' || e.document.fileName.endsWith('.pine') || e.document.fileName.endsWith('.pinescript'),
    )
    return pineEditor ?? vscode.window.visibleTextEditors[0]
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
    const editor = this.getActivePineEditor()
    const fileContent = (includeContext && editor) ? editor.document.getText() : undefined
    const selection = (includeContext && editor) ? editor.document.getText(editor.selection) : undefined
    const fileName = editor?.document.fileName

    const transcript: TranscriptStep[] = []
    this.postMessage({ type: 'startStreaming', userPrompt: prompt })
    const outputChannel = PineAgentController.getInstance().getOutputChannel()
    outputChannel.appendLine(`\n[${new Date().toLocaleTimeString()}] === PineForge Chat Request ===\nUser: ${prompt}`)

    try {
      const config = vscode.workspace.getConfiguration('pineForge')
      const host = config.get<string>('ollama.host', 'http://localhost:11434')
      const model = config.get<string>('ollama.model', 'minimax-m3:cloud')
      const temperature = config.get<number>('ollama.temperature', 0)
      const maxIterations = config.get<number>('agent.maxIterations', 12)

      const agent = PineAgentController.getInstance().getAgent()
      const client = agent.getClient()
      client.updateConfig({ host, model, temperature, maxIterations })

      const isHealthy = await agent.healthCheck().catch(() => false)
      if (!isHealthy) {
        throw new Error(
          `Cannot connect to Ollama at ${host}.\n` +
          `Please make sure Ollama is running ('ollama serve') and model '${model}' is downloaded.\n` +
          'You can update Ollama host/model settings using the ⚙️ Settings button above.',
        )
      }

      const tools = agent.getOllamaTools()
      const systemPrompt = 'You are PineForge AI, expert TradingView Pine Script v6 engineering assistant.\n' +
        'Rules:\n' +
        '1. Always use Pine Script v6 syntax (@version=6) with indicator() or strategy() declaration.\n' +
        '2. NEVER use semicolons (;) at line endings. Pine Script uses indentation and newlines.\n' +
        '3. Use standard Pine v6 inputs: input.int(), input.float(), input.bool(), input.string(), input.color().\n' +
        '4. User-defined types use: type TypeName\n    float field1\n    int field2 (never use struct or C-syntax).\n' +
        '5. Use standard plotting functions: plot(), plotshape(), plotchar(), line.new(), box.new(), label.new().\n' +
        '6. For collections use: array.new<float>(), matrix.new<float>(), map.new<string, float>().\n' +
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
        if (state !== 'RESET_STREAM') {
          outputChannel.appendLine(`[${time}] [${state}] ${msg}`)
        }
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

      outputChannel.appendLine(`=== Agent Response ===\n${response}\n---`)
      this.postMessage({ type: 'streamEnd', content: response, transcript })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      outputChannel.appendLine(`[ERROR] ${errorMsg}`)
      this.postMessage({ type: 'streamError', error: errorMsg, transcript })
    }
  }

  private async processAction(action: string): Promise<void> {
    const editor = this.getActivePineEditor()
    const code = editor?.document.getText() ?? ''

    if (action === 'validate') {
      if (!code.trim()) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        this.postMessage({
          type: 'botResponse',
          content: '### Pine Script Validation\n\n⚠️ **No active Pine Script document found.**\nPlease open a `.pine` file in the editor to run validation.',
          transcript: [{ time, state: 'VALIDATE', message: 'No active Pine Script found to validate.' }],
        })
        return
      }
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

    if (!code.trim() && action !== 'explain') {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      this.postMessage({
        type: 'botResponse',
        content: `⚠️ **No active Pine Script document found.**\nPlease open a \`.pine\` file in the editor to use the **${action}** action.`,
        transcript: [{ time, state: 'ACTION', message: `Action ${action} aborted: no active script.` }],
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
    const editor = this.getActivePineEditor()
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
      const activeFile = this.getActivePineEditor()?.document.fileName.split(/[/\\]/).pop()

      let connected = false
      let models: string[] = []

      try {
        const agent = PineAgentController.getInstance().getAgent()
        if (agent) {
          connected = await agent.healthCheck()
          if (connected) {
            models = (await agent.getClient().getModels()).filter(m => !m.includes('embed'))
            if (models.length > 0 && !models.includes(configuredModel)) {
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

  private getNonce(): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce()
    const config = vscode.workspace.getConfiguration('pineForge')
    const initialModel = config.get<string>('ollama.model', 'minimax-m3:cloud')
    const initialHost = config.get<string>('ollama.host', 'http://localhost:11434')
    const initialTemp = config.get<number>('ollama.temperature', 0)
    const initialIter = config.get<number>('agent.maxIterations', 12)
    const initialRepair = config.get<boolean>('agent.autoRepair', true)

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};"><style>
:root{--bg:var(--vscode-sideBar-background,#1e1e1e);--fg:var(--vscode-foreground,#ccc);--card:var(--vscode-editor-background,#252526);--border:var(--vscode-widget-border,#333);--accent:var(--vscode-button-background,#0e639c);--accent-hover:var(--vscode-button-hoverBackground,#1177bb);font-family:var(--vscode-font-family,sans-serif);}
*{box-sizing:border-box;margin:0;padding:0;}body{background:var(--bg);color:var(--fg);font-size:12px;display:flex;flex-direction:column;height:100vh;overflow:hidden;}
button{font-family:inherit;cursor:pointer;}
.header{padding:6px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:6px;}
.model-tag{display:flex;align-items:center;gap:5px;cursor:pointer;padding:2px 6px;border-radius:4px;background:var(--card);border:1px solid var(--border);font-size:11px;user-select:none;}
.dot{width:7px;height:7px;border-radius:50%;background:#e51400;}.dot.online{background:#89d185;}.header-actions{display:flex;gap:4px;}
.settings-drawer{display:none;padding:10px;border-bottom:1px solid var(--border);background:var(--card);flex-direction:column;gap:6px;font-size:11px;}
.settings-drawer.open{display:flex!important;}.cfg-row{display:flex;flex-direction:column;gap:2px;}.cfg-row label{opacity:0.85;font-size:10px;}
.cfg-input{background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:3px;padding:4px 6px;font-size:11px;}
.cfg-actions{display:flex;gap:6px;margin-top:4px;}
.tab-bar{display:flex;border-bottom:1px solid var(--border);background:var(--card);}
.tab-btn{flex:1;padding:6px 4px;background:transparent;border:none;color:var(--fg);cursor:pointer;font-size:11px;opacity:0.7;border-bottom:2px solid transparent;user-select:none;}
.tab-btn.active{opacity:1;font-weight:bold;border-bottom:2px solid var(--accent);}
.quick-bar{display:flex;gap:5px;padding:6px 10px;border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none;}
.chip{background:var(--card);border:1px solid var(--border);color:var(--fg);padding:3px 8px;border-radius:12px;cursor:pointer;white-space:nowrap;font-size:11px;user-select:none;transition:background 0.15s ease,color 0.15s ease,border-color 0.15s ease;}
.chip:hover{background:var(--accent);color:#fff;border-color:var(--accent);}.chip:active{transform:translateY(1px);}.view-panel{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;}
.msg{padding:7px 9px;border-radius:6px;line-height:1.4;word-break:break-word;}.msg.user{background:var(--accent);color:#fff;align-self:flex-end;max-width:85%;}.msg.bot{background:var(--card);border:1px solid var(--border);align-self:flex-start;max-width:95%;}
.transcript-box{margin-bottom:6px;border:1px solid var(--border);border-radius:4px;background:#181818;font-size:11px;}
.transcript-box summary{padding:4px 8px;cursor:pointer;background:#202020;border-radius:4px;color:#85c2ff;font-size:10px;user-select:none;}
.transcript-steps{padding:6px 8px;display:flex;flex-direction:column;gap:4px;font-family:monospace;font-size:10px;color:#bbb;}.transcript-step{display:flex;gap:6px;}.t-time{opacity:0.6;}.t-state{color:#4ec9b0;font-weight:600;}
.active-stream-header{font-size:10px;color:#dcdcaa;margin-bottom:4px;font-style:italic;display:flex;align-items:center;gap:4px;}
.pulse-dot{width:6px;height:6px;border-radius:50%;background:#dcdcaa;animation:pulse 1s infinite alternate;}@keyframes pulse{0%{opacity:0.3;}100%{opacity:1;}}
.log-stream{font-family:monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;color:#ccc;}
.md-h1{font-size:13px;font-weight:700;margin:8px 0 4px 0;padding-bottom:2px;border-bottom:1px solid var(--border);color:#fff;}
.md-h2{font-size:12px;font-weight:600;margin:6px 0 3px 0;color:#85c2ff;}
.md-h3{font-size:11px;font-weight:600;margin:5px 0 2px 0;color:#4ec9b0;}
.md-hr{border:none;border-top:1px solid var(--border);margin:8px 0;}
.md-quote{border-left:3px solid var(--accent);padding:3px 8px;margin:4px 0;background:rgba(14,99,156,0.1);border-radius:2px;}
.md-ul,.md-ol{margin:3px 0 3px 14px;padding:0;}
.md-li,.md-oli{margin:2px 0;line-height:1.4;}
.inline-code{background:#181818;padding:1px 4px;border-radius:3px;font-family:var(--vscode-editor-font-family,monospace);border:1px solid #333;font-size:10px;color:#ce9178;}
.table-wrapper{overflow-x:auto;margin:6px 0;border:1px solid var(--border);border-radius:4px;}
.md-table{width:100%;border-collapse:collapse;font-size:11px;}
.md-table th{background:#2d2d2d;padding:4px 8px;text-align:left;border:1px solid var(--border);font-weight:600;color:#ddd;}
.md-table td{padding:4px 8px;border:1px solid var(--border);}
.code-container{margin:6px 0;border:1px solid var(--border);border-radius:4px;background:#181818;overflow:hidden;}
.code-lang-tag{display:inline-block;font-size:9px;font-family:monospace;padding:1px 6px;background:#264f78;color:#fff;border-radius:0 0 3px 0;text-transform:uppercase;font-weight:bold;}
.code-container pre{margin:0;padding:6px 8px;background:transparent;border:none;overflow-x:auto;}
.code-container code{font-family:var(--vscode-editor-font-family,monospace);font-size:11px;line-height:1.4;}
.code-container .code-actions{display:flex;gap:4px;justify-content:flex-end;padding:3px 6px;background:#202020;border-top:1px solid #2a2a2a;}
.md-p-gap{height:6px;}
.btn-sm{font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid var(--border);background:#333;color:#fff;cursor:pointer;}.btn-sm:hover{background:var(--accent);}
.btn-primary{background:var(--accent);color:#fff;border:none;border-radius:3px;padding:4px 8px;cursor:pointer;font-weight:600;font-size:11px;}.btn-primary:hover{background:var(--accent-hover);}
.input-area{padding:8px 10px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:5px;}
.context-row{display:flex;align-items:center;justify-content:space-between;font-size:11px;opacity:0.85;}.input-row{display:flex;gap:6px;}
textarea{flex:1;height:48px;resize:none;background:var(--card);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:5px;font-family:inherit;font-size:12px;}
textarea:focus{outline:1px solid var(--accent);}.send-btn{background:var(--accent);color:#fff;border:none;border-radius:4px;padding:0 12px;cursor:pointer;font-weight:bold;}.send-btn:hover{background:var(--accent-hover);}
</style></head><body>
<div class="header">
<div class="model-tag" id="modelTag"><span class="dot online" id="statusDot"></span><span id="modelName">${initialModel}</span></div>
<div class="header-actions"><button class="btn-sm" id="btnSettingsToggle">⚙️ Settings</button><button class="btn-sm" id="btnClearChat">Clear</button></div>
</div>
<div class="settings-drawer" id="settingsDrawer">
<div class="cfg-row"><label>Model</label><select id="cfgModelSelect" class="cfg-input"><option value="${initialModel}" selected>${initialModel}</option></select></div>
<div class="cfg-row"><label>Custom Model Tag</label><input type="text" id="cfgModelCustom" class="cfg-input" value="${initialModel}" placeholder="e.g. minimax-m3:cloud"></div>
<div class="cfg-row"><label>Ollama Host</label><input type="text" id="cfgHost" class="cfg-input" value="${initialHost}" placeholder="http://localhost:11434"></div>
<div class="cfg-row"><label>Temperature</label><input type="number" id="cfgTemp" class="cfg-input" step="0.1" min="0" max="1" value="${initialTemp}"></div>
<div class="cfg-row"><label>Max Iterations</label><input type="number" id="cfgMaxIter" class="cfg-input" min="1" max="30" value="${initialIter}"></div>
<div class="cfg-row"><label><input type="checkbox" id="cfgAutoRepair" ${initialRepair ? 'checked' : ''}> Auto-repair validation failures</label></div>
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
<script nonce="${nonce}">
(function(){
try {
var vscode;
try {
  vscode = acquireVsCodeApi();
} catch(e) {
  console.log('acquireVsCodeApi fallback:', e);
}

var chatFlow = document.getElementById('chatFlow');
var logFlow = document.getElementById('logFlow');
var fullLogStream = document.getElementById('fullLogStream');
var promptInput = document.getElementById('promptInput');
var ctxCheck = document.getElementById('ctxCheck');
var currentTranscript = [], streamBuffer = '', activeBotMsg = null, activeStreamBody = null, activeStreamHeader = null;

function switchTab(t){
var tabChatBtn = document.getElementById('tabChatBtn');
var tabLogBtn = document.getElementById('tabLogBtn');
var quickBar = document.getElementById('quickBar');
if (tabChatBtn) tabChatBtn.className = 'tab-btn ' + (t==='chat'?'active':'');
if (tabLogBtn) tabLogBtn.className = 'tab-btn ' + (t==='logs'?'active':'');
if (chatFlow) chatFlow.style.display = t==='chat' ? 'flex' : 'none';
if (logFlow) logFlow.style.display = t==='logs' ? 'flex' : 'none';
if (quickBar) quickBar.style.display = t==='chat' ? 'flex' : 'none';
}

function submitPrompt(){
var t = promptInput ? promptInput.value.trim() : '';
if (!t) return;
appendMessage(t, 'user');
if (promptInput) promptInput.value = '';
appendLog('USER: ' + t);
if (vscode) {
  vscode.postMessage({ type: 'sendPrompt', prompt: t, includeContext: Boolean(ctxCheck && ctxCheck.checked) });
}
}

function toggleSettings(){
var drawer = document.getElementById('settingsDrawer');
if (drawer) drawer.classList.toggle('open');
}

function saveSettings(){
var m = document.getElementById('cfgModelCustom').value.trim() || document.getElementById('cfgModelSelect').value;
var h = document.getElementById('cfgHost').value.trim(), temp = parseFloat(document.getElementById('cfgTemp').value) || 0;
var iter = parseInt(document.getElementById('cfgMaxIter').value, 10) || 12, rep = document.getElementById('cfgAutoRepair').checked;
if (vscode) {
  vscode.postMessage({ type: 'updateConfig', config: { model: m, host: h, temperature: temp, maxIterations: iter, autoRepair: rep } });
}
toggleSettings();
}

function openVSCodeSettings(){
if (vscode) vscode.postMessage({ type: 'openVSCodeSettings' });
}

function quickAction(act){
var labels = {
explain: '💡 Explain active script',
fix: '🔧 Fix errors & bugs in active script',
optimize: '⚡ Optimize performance of active script',
migrate: '🚀 Migrate active script to Pine v6',
validate: '✓ Validate Pine v6 conformance'
};
appendMessage(labels[act] || ('Action: ' + act), 'user');
appendLog('QUICK ACTION: ' + act);
if (vscode) {
  vscode.postMessage({ type: 'quickAction', action: act });
}
}

function copyToClipboard(text){
if (!text) return;
if (navigator.clipboard && navigator.clipboard.writeText) {
  navigator.clipboard.writeText(text).catch(function(){ fallbackCopy(text); });
} else {
  fallbackCopy(text);
}
}
function fallbackCopy(text){
var ta = document.createElement('textarea');
ta.value = text;
ta.style.position = 'fixed';
ta.style.opacity = '0';
document.body.appendChild(ta);
ta.select();
try { document.execCommand('copy'); } catch(e){}
document.body.removeChild(ta);
}

function copyLog(){
if (fullLogStream) copyToClipboard(fullLogStream.innerText || fullLogStream.textContent || '');
}

function clearChat(){
if (chatFlow) chatFlow.innerHTML = '<div class="msg bot">Chat cleared. Ready for your Pine Script v6 requests.</div>';
if (fullLogStream) fullLogStream.innerText = 'Log cleared.\\n';
}

function appendLog(text){
if (fullLogStream) fullLogStream.innerText += text + '\\n';
if (logFlow) logFlow.scrollTop = logFlow.scrollHeight;
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
if (chatFlow) {
  chatFlow.appendChild(d);
  chatFlow.scrollTop = chatFlow.scrollHeight;
}
return d;
}

function renderMarkdown(src){
if (!src) return '';
var codeBlocks = [];
function escapeHtml(s) {
return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var text = src.replace(/\`\`\`([a-zA-Z0-9_-]*)\n?([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
var cleanCode = code.trim();
var isPine = !lang || lang === 'pine' || lang === 'pinescript' || cleanCode.indexOf('//@version') !== -1 || cleanCode.indexOf('indicator(') !== -1 || cleanCode.indexOf('strategy(') !== -1;
var actions = isPine 
? '<div class="code-actions"><button class="btn-sm btn-apply">Apply</button><button class="btn-sm btn-insert">Insert</button><button class="btn-sm btn-copy">Copy</button></div>'
: '<div class="code-actions"><button class="btn-sm btn-copy">Copy</button></div>';
var tag = lang ? '<span class="code-lang-tag">' + lang + '</span>' : '';
var html = '<div class="code-container">' + tag + '<pre><code>' + escapeHtml(cleanCode) + '</code></pre>' + actions + '</div>';
codeBlocks.push(html);
return '___CODE_BLOCK_' + (codeBlocks.length - 1) + '___';
});

text = escapeHtml(text);

text = text.replace(/((?:^|\\n)\\|[^\\n]+\\|\\n\\|[-: |]+\\|\\n(?:\\|[^\\n]+\\|\\n?)+)/g, function(match) {
var lines = match.trim().split('\\n').map(function(l){ return l.trim().replace(/^\\|/, '').replace(/\\|$/, ''); });
if (lines.length < 2) return match;
var headers = lines[0].split('|').map(function(h){ return '<th>' + h.trim() + '</th>'; }).join('');
var rows = lines.slice(2).map(function(row){
var cells = row.split('|').map(function(c){ return '<td>' + c.trim() + '</td>'; }).join('');
return '<tr>' + cells + '</tr>';
}).join('');
return '\\n<div class="table-wrapper"><table class="md-table"><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div>\\n';
});

text = text.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
text = text.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
text = text.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');
text = text.replace(/^(?:---|\\*\\*\\*|___)\\s*$/gim, '<hr class="md-hr">');
text = text.replace(/^>\\s*(.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');
text = text.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
text = text.replace(/\\*([^\\*\\n]+)\\*/g, '<em>$1</em>');
text = text.replace(/\`([^\`\\n]+)\`/g, '<code class="inline-code">$1</code>');

text = text.replace(/(?:^|\\n)[*-]\\s+(.*)/g, '\\n<li class="md-li">$1</li>');
text = text.replace(/((?:\\n<li class="md-li">.*<\\/li>)+)/g, '<ul class="md-ul">$1\\n</ul>');
text = text.replace(/(?:^|\\n)\\d+\\.\\s+(.*)/g, '\\n<li class="md-oli">$1</li>');
text = text.replace(/((?:\\n<li class="md-oli">.*<\\/li>)+)/g, '<ol class="md-ol">$1\\n</ol>');

text = text.replace(/\\n\\n+/g, '<div class="md-p-gap"></div>');
text = text.replace(/\\n/g, '<br>');

text = text.replace(/___CODE_BLOCK_(\\d+)___/g, function(_, i) {
return codeBlocks[parseInt(i, 10)];
});

return text;
}

document.addEventListener('click', function(e){
var target = (e.target && e.target.nodeType === 3) ? e.target.parentElement : e.target;
if (!target || typeof target.closest !== 'function') return;

var chip = target.closest('.chip');
if (chip) {
var act = chip.getAttribute('data-action');
if (act) quickAction(act);
return;
}

if (target.closest('#sendBtn')) {
submitPrompt();
return;
}
if (target.closest('#modelTag') || target.closest('#btnSettingsToggle')) {
toggleSettings();
return;
}
if (target.closest('#btnClearChat')) {
clearChat();
return;
}
if (target.closest('#btnSaveSettings')) {
saveSettings();
return;
}
if (target.closest('#btnVSCodeSettings')) {
openVSCodeSettings();
return;
}
if (target.closest('#tabChatBtn')) {
switchTab('chat');
return;
}
if (target.closest('#tabLogBtn')) {
switchTab('logs');
return;
}
if (target.closest('#btnCopyLog')) {
copyLog();
return;
}

var applyBtn = target.closest('.btn-apply');
if (applyBtn) {
var pre = applyBtn.closest('.code-container').querySelector('code');
if (pre && vscode) vscode.postMessage({ type: 'applyCode', code: pre.textContent || pre.innerText, mode: 'replace' });
return;
}
var insertBtn = target.closest('.btn-insert');
if (insertBtn) {
var pre = insertBtn.closest('.code-container').querySelector('code');
if (pre && vscode) vscode.postMessage({ type: 'applyCode', code: pre.textContent || pre.innerText, mode: 'insert' });
return;
}
var copyBtn = target.closest('.btn-copy');
if (copyBtn) {
var pre = copyBtn.closest('.code-container').querySelector('code');
if (pre) {
copyToClipboard(pre.textContent || pre.innerText);
copyBtn.innerText = 'Copied!';
setTimeout(function(){ copyBtn.innerText = 'Copy'; }, 1500);
}
return;
}
});

function wireEvents(){
var btnSettings = document.getElementById('btnSettingsToggle');
if (btnSettings) btnSettings.addEventListener('click', toggleSettings);
var modelTag = document.getElementById('modelTag');
if (modelTag) modelTag.addEventListener('click', toggleSettings);
var btnClear = document.getElementById('btnClearChat');
if (btnClear) btnClear.addEventListener('click', clearChat);
var sendBtn = document.getElementById('sendBtn');
if (sendBtn) sendBtn.addEventListener('click', submitPrompt);
var btnSave = document.getElementById('btnSaveSettings');
if (btnSave) btnSave.addEventListener('click', saveSettings);
var btnVSCode = document.getElementById('btnVSCodeSettings');
if (btnVSCode) btnVSCode.addEventListener('click', openVSCodeSettings);
var tabChat = document.getElementById('tabChatBtn');
if (tabChat) tabChat.addEventListener('click', function(){ switchTab('chat'); });
var tabLog = document.getElementById('tabLogBtn');
if (tabLog) tabLog.addEventListener('click', function(){ switchTab('logs'); });
var btnCopy = document.getElementById('btnCopyLog');
if (btnCopy) btnCopy.addEventListener('click', copyLog);
var chips = document.querySelectorAll('.chip');
chips.forEach(function(c){
c.addEventListener('click', function(){
var act = c.getAttribute('data-action');
if (act) quickAction(act);
});
});
}
wireEvents();

document.addEventListener('keydown', function(e){
if (e.target && e.target.id === 'promptInput') {
if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
submitPrompt();
}
}
});

var cfgSelect = document.getElementById('cfgModelSelect');
if (cfgSelect) {
cfgSelect.addEventListener('change', function(e){ if (e.target.value) document.getElementById('cfgModelCustom').value = e.target.value; });
}

window.addEventListener('message', function(e){
var m = e.data;
if (!m) return;
if (m.type === 'statusUpdate') {
var modelNameEl = document.getElementById('modelName');
var statusDotEl = document.getElementById('statusDot');
var activeFileEl = document.getElementById('activeFileLabel');
var cfgHostEl = document.getElementById('cfgHost');
var cfgModelEl = document.getElementById('cfgModelCustom');
var cfgTempEl = document.getElementById('cfgTemp');
var cfgMaxIterEl = document.getElementById('cfgMaxIter');
var cfgAutoRepairEl = document.getElementById('cfgAutoRepair');
var sel = document.getElementById('cfgModelSelect');

if (modelNameEl) modelNameEl.innerText = m.connected ? (m.model || 'Connected') : 'Disconnected';
if (statusDotEl) statusDotEl.className = 'dot ' + (m.connected ? 'online' : '');
if (activeFileEl) activeFileEl.innerText = m.activeFile || 'No active file';
if (cfgHostEl) cfgHostEl.value = m.host || 'http://localhost:11434';
if (cfgModelEl) cfgModelEl.value = m.model || '';
if (cfgTempEl) cfgTempEl.value = m.temperature !== undefined ? m.temperature : 0;
if (cfgMaxIterEl) cfgMaxIterEl.value = m.maxIterations || 12;
if (cfgAutoRepairEl) cfgAutoRepairEl.checked = Boolean(m.autoRepair);

if (sel) {
  sel.innerHTML = '';
  var list = m.models && m.models.length > 0 ? m.models : [m.model].filter(Boolean);
  list.forEach(function(item){
    var opt = document.createElement('option');
    opt.value = item; opt.innerText = item;
    if (item === m.model) opt.selected = true;
    sel.appendChild(opt);
  });
}
} else if (m.type === 'startStreaming') {
streamBuffer = ''; currentTranscript = [];
activeBotMsg = document.createElement('div'); activeBotMsg.className = 'msg bot';
activeStreamHeader = document.createElement('div'); activeStreamHeader.className = 'active-stream-header';
activeStreamHeader.innerHTML = '<span class="pulse-dot"></span><span>Thinking...</span>';
activeStreamBody = document.createElement('div'); activeStreamBody.className = 'stream-body';
activeBotMsg.appendChild(activeStreamHeader); activeBotMsg.appendChild(activeStreamBody);
if (chatFlow) {
  chatFlow.appendChild(activeBotMsg);
  chatFlow.scrollTop = chatFlow.scrollHeight;
}
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
if (activeStreamBody) {
  activeStreamBody.innerHTML = renderMarkdown(streamBuffer);
  if (chatFlow) chatFlow.scrollTop = chatFlow.scrollHeight;
}
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

if (vscode) {
  vscode.postMessage({ type: 'webviewReady' });
  setInterval(function(){ vscode.postMessage({ type: 'refreshStatus' }); }, 5000);
}
} catch(err) {
console.error('PineForge UI error:', err);
}
})();
</script></body></html>`
  }
}
