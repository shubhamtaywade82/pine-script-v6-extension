import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import {
  defaultPineForgeSettings,
  PINE_FORGE_SETTINGS_NOTIFICATION,
  type PineForgeSettings,
} from './settings';

let client: LanguageClient | undefined;

function readPineForgeSettings(): PineForgeSettings {
  const c = vscode.workspace.getConfiguration('pineForge');
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
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pinescript' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{pine,pinescript}'),
    },
    initializationOptions: readPineForgeSettings(),
  };

  client = new LanguageClient(
    'pineForge',
    'PineForge',
    serverOptions,
    clientOptions,
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.openReference', () => {
      void vscode.env.openExternal(
        vscode.Uri.parse('https://www.tradingview.com/pine-script-reference/v6/'),
      );
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('pineForge')) {
        pushSettingsToServer();
      }
    }),
  );

  context.subscriptions.push(client);
  void client.start().then(() => pushSettingsToServer());
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
