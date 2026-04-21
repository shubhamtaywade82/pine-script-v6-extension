import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import {
  defaultPineV6Settings,
  PINE_V6_SETTINGS_NOTIFICATION,
  type PineV6Settings,
} from './settings';

let client: LanguageClient | undefined;

function readPineV6Settings(): PineV6Settings {
  const c = vscode.workspace.getConfiguration('pineV6');
  return {
    enable: c.get<boolean>('enable', defaultPineV6Settings.enable),
    maxNumberOfProblems: c.get<number>(
      'maxNumberOfProblems',
      defaultPineV6Settings.maxNumberOfProblems,
    ),
    strictVersionCheck: c.get<boolean>(
      'strictVersionCheck',
      defaultPineV6Settings.strictVersionCheck,
    ),
  };
}

function pushSettingsToServer(): void {
  if (!client) return;
  void client.sendNotification(PINE_V6_SETTINGS_NOTIFICATION, readPineV6Settings());
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
    initializationOptions: readPineV6Settings(),
  };

  client = new LanguageClient(
    'pineV6',
    'Pine Script v6 Linter',
    serverOptions,
    clientOptions,
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('pineV6.openReference', () => {
      void vscode.env.openExternal(
        vscode.Uri.parse('https://www.tradingview.com/pine-script-reference/v6/'),
      );
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('pineV6')) {
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
