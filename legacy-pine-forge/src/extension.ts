import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { OLLAMA_API_SECRET_KEY } from './ollama/constants';
import { registerPineOllamaUi } from './ollama/registerPineOllamaUi';
import {
  defaultPineForgeSettings,
  PINE_FORGE_SETTINGS_NOTIFICATION,
  type PineForgeSettings,
} from './settings';

let client: LanguageClient | undefined;

function pineForgeConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('pineForge');
}

function readPineForgeSettings(): PineForgeSettings {
  const c = pineForgeConfiguration();
  return {
    enable: c.get<boolean>('enable', defaultPineForgeSettings.enable),
    maxNumberOfProblems: c.get<number>(
      'maxNumberOfProblems',
      defaultPineForgeSettings.maxNumberOfProblems,
    ),
    strictVersionCheck: c.get<boolean>(
      'strictVersionCheck',
      defaultPineForgeSettings.strictVersionCheck,
    ),
    strictImplicitBoolIf: c.get<boolean>(
      'strictImplicitBoolIf',
      defaultPineForgeSettings.strictImplicitBoolIf,
    ),
    styleTradingViewHints: c.get<boolean>(
      'styleTradingViewHints',
      defaultPineForgeSettings.styleTradingViewHints,
    ),
    limitationHints: c.get<boolean>(
      'limitationHints',
      defaultPineForgeSettings.limitationHints,
    ),
    tradingViewManualHints: c.get<boolean>(
      'tradingViewManualHints',
      defaultPineForgeSettings.tradingViewManualHints,
    ),
    semanticTypeHints: c.get<boolean>(
      'semanticTypeHints',
      defaultPineForgeSettings.semanticTypeHints,
    ),
    repaintHints: c.get<boolean>('repaintHints', defaultPineForgeSettings.repaintHints),
  };
}

function pushSettingsToServer(): void {
  if (!client) return;
  void client.sendNotification(PINE_FORGE_SETTINGS_NOTIFICATION, readPineForgeSettings());
}

export function activate(context: vscode.ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      // Fixed port matches `.vscode/launch.json` → "Attach to PineForge Language Server". If EADDRINUSE,
      // end the previous Extension Host session or pick another port in both places.
      options: { execArgv: ['--nolazy', '--inspect=127.0.0.1:6009'] },
    },
  };

  // One LanguageClient per extension host. Do not construct a second client if `activate` runs
  // again before `deactivate` cleared `client` (rare, but avoids two LSP child processes).
  // `client.start()` is safe to call repeatedly: concurrent starts share the same promise.
  if (!client) {
    const lspOutput = vscode.window.createOutputChannel('PineForge LSP');
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: 'pinescript' }],
      outputChannel: lspOutput,
      revealOutputChannelOn: RevealOutputChannelOn.Error,
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{pine,pinescript}'),
      },
      initializationOptions: readPineForgeSettings(),
    };
    client = new LanguageClient('pineForge', 'PineForge', serverOptions, clientOptions);
    context.subscriptions.push(client, lspOutput);
  }

  const aiOutput = vscode.window.createOutputChannel('PineForge AI');

  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.openReference', () => {
      void vscode.env.openExternal(
        vscode.Uri.parse('https://www.tradingview.com/pine-script-reference/v6/'),
      );
    }),
  );

  registerPineOllamaUi(context, aiOutput, pineForgeConfiguration);

  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.ollama.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        title: 'PineForge — Ollama API key',
        prompt: 'Paste your API key (stored in VS Code Secret Storage, not settings.json).',
        password: true,
        ignoreFocusOut: true,
      });
      if (key === undefined) return;
      await context.secrets.store(OLLAMA_API_SECRET_KEY, key);
      void vscode.window.showInformationMessage('PineForge: Ollama API key saved.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.ollama.clearApiKey', async () => {
      await context.secrets.delete(OLLAMA_API_SECRET_KEY);
      void vscode.window.showInformationMessage('PineForge: Ollama API key removed.');
    }),
  );

  context.subscriptions.push(aiOutput);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('pineForge')) {
        pushSettingsToServer();
      }
    }),
  );

  void client.start().then(() => pushSettingsToServer());
}

export function deactivate(): Thenable<void> | undefined {
  const c = client;
  client = undefined;
  return c?.stop();
}
