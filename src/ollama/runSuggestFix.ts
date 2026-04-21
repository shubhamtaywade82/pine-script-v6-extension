import type { ExtensionContext, OutputChannel, TextDocument, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { appendOllamaChatToOutput } from './chatToOutput';
import { suggestFixUserMessage } from './suggestFixPrompt';

function pineEditorOrWarn(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('PineForge AI: open a file first.');
    return undefined;
  }
  if (editor.document.languageId !== 'pinescript') {
    void vscode.window.showWarningMessage('PineForge AI: active editor must be Pine Script.');
    return undefined;
  }
  return editor;
}

function fixTargetRange(editor: vscode.TextEditor): vscode.Range {
  if (!editor.selection.isEmpty) return editor.selection;
  return editor.document.lineAt(editor.selection.active.line).range;
}

function diagnosticLinesForRange(doc: TextDocument, range: vscode.Range): string[] {
  return vscode.languages
    .getDiagnostics(doc.uri)
    .filter((d) => d.range.intersection(range) !== undefined)
    .map((d) => `L${d.range.start.line + 1}: ${d.message}`);
}

export async function runSuggestFixSelection(
  context: ExtensionContext,
  output: OutputChannel,
  getConfiguration: () => WorkspaceConfiguration,
): Promise<void> {
  const editor = pineEditorOrWarn();
  if (!editor) return;

  const range = fixTargetRange(editor);
  const selection = editor.document.getText(range);
  if (!selection.trim()) {
    void vscode.window.showInformationMessage('PineForge AI: nothing to fix in this range.');
    return;
  }

  const fileLabel = vscode.workspace.asRelativePath(editor.document.uri, false);
  const diags = diagnosticLinesForRange(editor.document, range);
  const user = suggestFixUserMessage(selection, fileLabel, diags);
  await appendOllamaChatToOutput(context, output, getConfiguration, user, '--- PineForge AI (suggest fix) ---');
}

export type PineForgeOllamaPlainRange = {
  start: { line: number; character: number };
  end: { line: number; character: number };
};

export async function runFixRange(
  context: ExtensionContext,
  output: OutputChannel,
  getConfiguration: () => WorkspaceConfiguration,
  uriStr?: string,
  plain?: PineForgeOllamaPlainRange,
): Promise<void> {
  if (!uriStr || !plain) {
    await runSuggestFixSelection(context, output, getConfiguration);
    return;
  }

  let doc: TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uriStr));
  } catch {
    void vscode.window.showErrorMessage('PineForge AI: could not open document for fix.');
    return;
  }

  if (doc.languageId !== 'pinescript') {
    void vscode.window.showWarningMessage('PineForge AI: document is not Pine Script.');
    return;
  }

  const range = new vscode.Range(
    plain.start.line,
    plain.start.character,
    plain.end.line,
    plain.end.character,
  );
  const selection = doc.getText(range);
  if (!selection.trim()) {
    void vscode.window.showInformationMessage('PineForge AI: empty range.');
    return;
  }

  const fileLabel = vscode.workspace.asRelativePath(doc.uri, false);
  const diags = diagnosticLinesForRange(doc, range);
  const user = suggestFixUserMessage(selection, fileLabel, diags);
  await appendOllamaChatToOutput(context, output, getConfiguration, user, '--- PineForge AI (suggest fix) ---');
}
