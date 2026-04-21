



How to create pinescript v6 linter extensions for vscode/cursor ide with language references

I’m checking the current Pine Script and VS Code extension surfaces so the design matches the actual APIs, not a guessed subset.

I’ve confirmed the extension path: VS Code language extensions use a language server for diagnostics, completions, hovers, and jump-to-definition, and Cursor can install VS Code extensions. I’m now translating that into a Pine v6-specific architecture.

Thought for 17s
Direct decision
Build this as a language-server-backed VS Code extension, not as a regex-only linter. VS Code’s language server architecture is the intended path for diagnostics, autocomplete, hover, and jump-to-definition, and Cursor can install and manage VS Code extensions. Pine Script v6 also has official reference and migration docs, so your ruleset should be version-aware and keyed to v6 specifically.

Critical invariants
One source of truth for language rules: Pine v6 reference manual + v6 migration guide. Pine v6 introduced changes, and some v5 scripts are not compatible without migration.

Editor client stays thin: all semantic work lives in the language server. VS Code exposes language features through its extension API, and language servers are explicitly designed to be reusable across editors.

Cursor compatibility: ship a standard VS Code extension package, because Cursor supports VS Code extensions.

Architecture
1) Extension client
Responsible only for:

registering the Pine file type

wiring the language server

providing syntax highlighting / bracket pairs / comments

exposing commands like “Open Pine reference”

VS Code’s language configuration system covers comment toggling, brackets, autoclose, folding, indentation rules, and word patterns.

2) Language server
Responsible for:

parsing Pine code into an AST

running lint rules

publishing diagnostics

serving hover docs

serving completion items

serving definition / references for symbols and built-ins

VS Code language servers support diagnostics, autocomplete, and jump-to-definition natively.

3) Reference index
A local JSON or generated database that maps:

built-ins

keywords

functions

types

v6-specific behaviors

migration notes

to official Pine v6 reference pages and migration notes. The reference manual and migration guide are the authoritative Pine v6 sources.

Implementation plan
A. Create the extension scaffold
Use a standard VS Code extension layout:

pine-v6-linter/
  package.json
  src/
    extension.ts
    client.ts
    server.ts
    parser/
    rules/
    references/
  language-configuration.json
  syntaxes/pine.tmLanguage.json
  docs/pine-symbols.json
In package.json, contribute:

a language id: pinescript

file extensions: .pine, .pinescript

activation on onLanguage:pinescript

a language configuration file

a grammar file for syntax highlighting

VS Code’s extension manifest is the mechanism for language IDs, grammars, and related contributions.

B. Wire the language server
Client side:

import * as vscode from 'vscode';
import * as path from 'path';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ['--nolazy', '--inspect=6009'] } },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pinescript' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{pine,pinescript}'),
    },
  };

  const client = new LanguageClient('pineV6Linter', 'Pine Script v6 Linter', serverOptions, clientOptions);
  context.subscriptions.push(client.start());
}
This is the standard client/server split that the VS Code LSP guide is describing.

C. Build a real parser
Do not lint Pine with regex. Use one of these:

a hand-written recursive descent parser

a PEG parser

tree-sitter grammar

a token stream + Pratt parser for expressions

For a Pine linter, the minimum viable AST should cover:

declarations

function calls

assignments

conditionals

series expressions

declarations with //@version=6

That AST lets you catch:

unknown identifiers

arity mismatches

invalid assignment targets

version mismatches

deprecated constructs

misplaced declarations

D. Implement rule modules
Use a rule engine like this:

export interface LintRule {
  id: string;
  check(ast: PineAst, source: string, ctx: RuleContext): Diagnostic[];
}
Recommended rule groups:

Group	Purpose
Syntax rules	malformed expressions, missing delimiters, invalid blocks
Semantic rules	unknown identifiers, wrong argument counts, invalid types
Pine v6 rules	version-specific syntax and behavior checks
Style rules	naming, line length, readability
Safety rules	repaint-risk patterns, ambiguous lookahead usage, unstable references
Pine v6-specific rule sets must be gated by version. The v6 docs and migration guide are the right baseline for that versioning.

E. Add “language references”
This is the part most people miss.

For every symbol you know, provide:

hover

completion item documentation

definition/reference navigation

code action: open docs

Example structure:

{
  "indicator": {
    "kind": "function",
    "docUrl": "PINE_V6_REFERENCE_URL_HERE",
    "summary": "Declares an indicator script."
  },
  "strategy": {
    "kind": "function",
    "docUrl": "PINE_V6_REFERENCE_URL_HERE",
    "summary": "Declares a strategy script."
  }
}
Hover provider:

connection.onHover((params) => {
  const symbol = resolveSymbolAt(params.textDocument.uri, params.position);
  if (!symbol) return null;

  return {
    contents: {
      kind: 'markdown',
      value: `**${symbol.name}**\n\n${symbol.summary}\n\n[Open reference](${symbol.docUrl})`,
    },
  };
});
That gives you “language references” inside the editor instead of forcing users to leave the file.

F. Publish syntax highlighting
Add a TextMate grammar for:

keywords

built-ins

numbers

strings

comments

annotations like //@version=6

Then layer semantic tokens later if needed. VS Code supports semantic token providers for richer semantic highlighting.

Minimal file contributions
package.json
{
  "name": "pine-v6-linter",
  "displayName": "Pine Script v6 Linter",
  "publisher": "your-publisher",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Programming Languages"],
  "activationEvents": ["onLanguage:pinescript"],
  "main": "./dist/extension.js",
  "contributes": {
    "languages": [
      {
        "id": "pinescript",
        "aliases": ["Pine Script", "PineScript"],
        "extensions": [".pine", ".pinescript"],
        "configuration": "./language-configuration.json"
      }
    ],
    "grammars": [
      {
        "language": "pinescript",
        "scopeName": "source.pinescript",
        "path": "./syntaxes/pine.tmLanguage.json"
      }
    ]
  }
}
language-configuration.json
{
  "comments": {
    "lineComment": "//",
    "blockComment": ["/*", "*/"]
  },
  "brackets": [["{", "}"], ["(", ")"], ["[", "]"]],
  "autoClosingPairs": [
    { "open": "\"", "close": "\"" },
    { "open": "(", "close": ")" },
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" }
  ],
  "surroundingPairs": [
    { "open": "\"", "close": "\"" },
    { "open": "(", "close": ")" },
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" }
  ]
}
Verification checkpoints
Open a .pine file in VS Code and Cursor.

Confirm file recognition and syntax highlighting.

Introduce a bad symbol and verify a diagnostic appears.

Hover a built-in and confirm the official reference link appears.

Rename a symbol and verify references update.

Test a v5 script under v6 rules and confirm migration warnings appear. Pine v6 migration is explicitly documented by TradingView.

Best implementation choice
Use TypeScript + vscode-languageclient + a generated Pine symbol/reference database.

That gives you:

one codebase

VS Code support

Cursor support

real diagnostics

doc-linked hovers

future-proof rule updates when Pine v6 evolves through release notes and docs.

I can turn this into a complete starter extension structure with package.json, client/server code, and a first-pass Pine v6 rule engine.


Give me the complete guide

Direct decision
Build a Language Server Protocol (LSP)–based VS Code extension in TypeScript, backed by a custom Pine v6 parser + rule engine + reference index. Do not attempt a regex-only linter. This gives you diagnostics, autocomplete, hover docs, go-to-definition, and Cursor compatibility in one architecture.

System architecture (final form)
VSCode / Cursor (client)
        │
        ▼
Language Client (thin bridge)
        │
        ▼
Language Server (core engine)
 ├── Lexer / Parser → AST
 ├── Symbol Table / Scope Resolver
 ├── Rule Engine (lint + semantics)
 ├── Reference Index (docs + signatures)
 └── LSP Handlers (hover, completion, diagnostics, etc.)
Step 1 — Bootstrap extension
mkdir pine-v6-linter && cd pine-v6-linter
npm init -y

npm install --save-dev typescript @types/node vscode
npm install vscode-languageclient vscode-languageserver
npx tsc --init
Step 2 — package.json (complete)
{
  "name": "pine-v6-linter",
  "displayName": "Pine Script v6 Linter",
  "version": "0.1.0",
  "publisher": "your-name",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages"],
  "activationEvents": ["onLanguage:pinescript"],
  "main": "./dist/extension.js",
  "contributes": {
    "languages": [
      {
        "id": "pinescript",
        "aliases": ["Pine Script v6"],
        "extensions": [".pine", ".pinescript"],
        "configuration": "./language-configuration.json"
      }
    ],
    "grammars": [
      {
        "language": "pinescript",
        "scopeName": "source.pinescript",
        "path": "./syntaxes/pine.tmLanguage.json"
      }
    ]
  },
  "scripts": {
    "build": "tsc -p .",
    "watch": "tsc -w"
  }
}
Step 3 — Language client (VS Code side)
src/extension.ts

import * as vscode from 'vscode';
import * as path from 'path';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] }
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pinescript' }]
  };

  client = new LanguageClient(
    'pineV6',
    'Pine Script v6 Language Server',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate() {
  return client?.stop();
}
Step 4 — Language server (core)
src/server.ts

import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  InitializeParams,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { parse } from './parser/parser';
import { runRules } from './rules/engine';

const connection = createConnection();
const documents = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: { resolveProvider: true }
    }
  };
});

documents.onDidChangeContent(change => {
  validate(change.document);
});

async function validate(doc: TextDocument) {
  const text = doc.getText();

  const ast = parse(text);
  const issues = runRules(ast, text);

  const diagnostics: Diagnostic[] = issues.map(issue => ({
    severity: DiagnosticSeverity.Error,
    range: issue.range,
    message: issue.message,
    source: 'pine-v6-linter'
  }));

  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

documents.listen(connection);
connection.listen();
Step 5 — Lexer + Parser (minimal but correct)
Tokenizer
src/parser/lexer.ts

export type Token =
  | { type: 'IDENT'; value: string }
  | { type: 'NUMBER'; value: string }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'EQUAL' }
  | { type: 'NEWLINE' };

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\s+|[a-zA-Z_]\w*|\d+|\(|\)|=/g;

  let match;
  while ((match = regex.exec(input))) {
    const val = match[0];

    if (/^\s+$/.test(val)) continue;

    if (/^\d+$/.test(val)) tokens.push({ type: 'NUMBER', value: val });
    else if (/^[a-zA-Z_]/.test(val)) tokens.push({ type: 'IDENT', value: val });
    else if (val === '(') tokens.push({ type: 'LPAREN' });
    else if (val === ')') tokens.push({ type: 'RPAREN' });
    else if (val === '=') tokens.push({ type: 'EQUAL' });
  }

  return tokens;
}
Parser
src/parser/parser.ts

import { tokenize, Token } from './lexer';

export type ASTNode =
  | { type: 'Assignment'; name: string; value: string }
  | { type: 'Call'; name: string };

export function parse(input: string): ASTNode[] {
  const tokens = tokenize(input);
  const ast: ASTNode[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === 'IDENT' && tokens[i + 1]?.type === 'EQUAL') {
      ast.push({
        type: 'Assignment',
        name: t.value,
        value: (tokens[i + 2] as any)?.value
      });
    }

    if (t.type === 'IDENT' && tokens[i + 1]?.type === 'LPAREN') {
      ast.push({ type: 'Call', name: t.value });
    }
  }

  return ast;
}
Step 6 — Rule engine
src/rules/engine.ts

import { ASTNode } from '../parser/parser';

const BUILT_INS = ['indicator', 'strategy', 'plot'];

export function runRules(ast: ASTNode[], _source: string) {
  const issues: any[] = [];

  for (const node of ast) {
    if (node.type === 'Call') {
      if (!BUILT_INS.includes(node.name)) {
        issues.push({
          message: `Unknown function: ${node.name}`,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 }
          }
        });
      }
    }
  }

  return issues;
}
Step 7 — Language references (hover + docs)
Reference DB
src/references/pine.json

{
  "indicator": {
    "summary": "Declares an indicator script",
    "url": "https://www.tradingview.com/pine-script-reference/v6/#fun_indicator"
  },
  "strategy": {
    "summary": "Declares a strategy",
    "url": "https://www.tradingview.com/pine-script-reference/v6/#fun_strategy"
  }
}
Hover provider
Add to server.ts

import refs from './references/pine.json';

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const word = getWordAt(doc, params.position);
  const ref = (refs as any)[word];

  if (!ref) return null;

  return {
    contents: {
      kind: 'markdown',
      value: `**${word}**\n\n${ref.summary}\n\n[Docs](${ref.url})`
    }
  };
});

function getWordAt(doc: TextDocument, pos: any) {
  const text = doc.getText();
  const lines = text.split('\n');
  const line = lines[pos.line];
  return line.split(/\W+/)[0];
}
Step 8 — Completion
connection.onCompletion(() => {
  return [
    {
      label: 'indicator',
      kind: 3,
      detail: 'Declare indicator'
    },
    {
      label: 'strategy',
      kind: 3
    }
  ];
});
Step 9 — Syntax highlighting
Create:

syntaxes/pine.tmLanguage.json
Minimal:

{
  "scopeName": "source.pinescript",
  "patterns": [
    {
      "match": "\\b(indicator|strategy|plot)\\b",
      "name": "keyword.control.pine"
    }
  ]
}
Step 10 — Build & run
npm run build
code .
Press:

F5 → Launch Extension Host
Open a .pine file.

Step 11 — Upgrade to production-grade
Mandatory upgrades (non-negotiable)
1. Real AST
Expressions

Series vs literal

Function arguments

Blocks

2. Scope system
global vs local

redeclaration errors

shadowing

3. Type system (critical for Pine)
series float

float

bool

color

implicit casting rules

4. Pine v6 rule set
//@version=6 validation

deprecated APIs

migration warnings

5. Strategy-specific linting
repaint detection

lookahead bias

request.security() misuse

improper strategy.entry logic

Step 12 — Cursor integration
No changes required.

Just:

Install extension → Cursor picks it up
Step 13 — Testing strategy (must implement)
Unit tests (parser + rules)
npm install jest ts-jest @types/jest
Example:

test('unknown function', () => {
  const ast = parse('foo()');
  const issues = runRules(ast, '');

  expect(issues.length).toBe(1);
});
Step 14 — Advanced features (worth building)
1. Pine-specific static analysis
repaint risk scoring

indicator vs strategy misuse

invalid security() timeframe combos

2. AI-assisted linting
integrate your local LLM

explain errors

suggest fixes

3. Backtest-aware hints
detect poor RR setups

warn on tight SL vs ATR

4. Inline documentation caching
scrape + normalize TradingView docs

version-lock to v6

Critical risks
Risk	Impact
No real parser	useless linter
No type system	false positives everywhere
No Pine semantics	not usable for trading
No versioning	breaks on v6 vs v5
What’s incomplete
This is a complete foundation, not a full Pine compiler.

Missing (by design):

full Pine grammar

full type inference

control flow graph

advanced Pine constructs (arrays, var, series propagation)

If you want next step
I can build:

full Pine v6 grammar (tree-sitter or PEG)

production-grade type system

repaint detection engine (this is high value for your trading systems)

That’s where this becomes actually useful for strategy validation, not just syntax linting.


Learn about vscode language server and linter and formater extension creation skill and provide a detailed step by step implementation plan

I’m pulling the official VS Code extension and language-server docs first, then I’ll turn them into a practical build path with milestones and deliverables.

I have the official APIs mapped. The next pass is turning them into a staged build plan: language foundation first, then diagnostics, then formatting, then tests and packaging.

Thought for 16s
Direct decision
Learn this in three layers:

VS Code language extension basics — syntax, brackets, comments, indentation, and file recognition. VS Code exposes these through declarative language features in package.json and language-configuration.json.

Programmatic language features — diagnostics, completion, hover, go-to-definition, references, and code actions. VS Code commonly implements these through a language client + language server split using LSP.

Formatter implementation — register DocumentFormattingEditProvider and optionally DocumentRangeFormattingEditProvider, so users get the standard Format Document and Format Selection flows.

Step-by-step implementation plan
1) Learn the extension model first
Start by reading the Extension API, Extension Capabilities, Extension Guides, and Extension Anatomy docs. VS Code extensions are built from a package.json manifest and can contribute languages, grammars, commands, and many other capabilities.

Goal: understand what belongs in:

package.json

language-configuration.json

TextMate grammar

extension host code

language server code

Deliverable: a mental map of the extension surface before writing any parser logic.

2) Define the language scope
Write down exactly what your extension will support on day one:

file extensions

language id

syntax versioning

formatting style rules

lint rules

supported editor features

This is important because VS Code extensions can target a language via document selectors and language contributions, and programmatic features are activated per language/document.

Deliverable: a one-page language spec for your extension.

3) Scaffold the VS Code extension
Create a TypeScript extension because the VS Code docs recommend TypeScript for extension development. Add:

activationEvents

contributes.languages

contributes.grammars

main

build scripts

Each extension needs a package.json manifest, and it is the central place for extension contributions.

Deliverable: extension opens in VS Code and recognizes your language files.

4) Add declarative language support first
Before any advanced code, add:

comment toggling

bracket matching

auto-closing pairs

surrounding pairs

indentation rules

folding rules

These are declared in language-configuration.json. VS Code’s language configuration guide explicitly lists these as declarative language features.

Deliverable: basic editing feels native even before LSP exists.

5) Add syntax highlighting with a grammar
Create a TextMate grammar for:

keywords

operators

strings

numbers

comments

annotations/directives

VS Code supports syntax highlighting via grammars, and this is the standard first layer of language support. Semantic highlighting can be added later on top of grammar highlighting.

Deliverable: files are readable and colored correctly.

6) Learn LSP before writing features
Study the Language Server Extension Guide and Programmatic Language Features docs. VS Code’s model is: the client runs in the extension host, spawns the server in another process, and communicates through Language Server Protocol. The main payoffs are autocomplete, diagnostics, hover, and jump-to-definition.

Deliverable: you can explain the client-server split without looking at notes.

7) Build the parser and AST
Implement a real parser, not regex. Start with:

lexer/tokenizer

AST nodes

parse errors

source ranges

recovery mode

Your linter and formatter should consume the AST, not raw text. That keeps diagnostics and formatting deterministic.

Deliverable: parse a file into a tree with line/column spans.

8) Build the scope and symbol table
Add:

global scope

local scope

symbol declarations

references

shadowing detection

unresolved identifier detection

This is the foundation for diagnostics, hover, and go-to-definition.

Deliverable: symbol resolution works on a non-trivial file.

9) Implement lint rules as a rule engine
Split linting into independent rules:

syntax rules

semantic rules

style rules

version rules

domain rules

Each rule should output:

severity

range

message

code

optional quick fix

VS Code diagnostics are a core language-server capability, so the linter naturally fits inside the LSP server.

Deliverable: diagnostics appear as red/yellow squiggles in the editor.

10) Add formatter support as a separate subsystem
Do not mix formatting logic into linting logic.

Implement:

DocumentFormattingEditProvider

optionally DocumentRangeFormattingEditProvider

optionally OnTypeFormattingEditProvider

The VS Code formatting API is designed so users can trigger formatting through the standard editor commands, including Format Document and Format Selection.

Formatter architecture:

parse source to AST

build a formatting IR or printer state

emit edits, not mutated strings

preserve comments and whitespace where possible

keep formatting deterministic

Deliverable: Format Document produces stable output.

11) Add hover, completion, references, and go-to-definition
Once the symbol table exists, add:

hover docs

completion items

definition lookup

references

rename support if feasible

code actions for quick fixes

These are exactly the kind of features VS Code language servers are meant to provide.

Deliverable: the extension feels like a real language tool, not a parser demo.

12) Add code actions for lint fixes
For each rule, decide whether it can suggest an automatic fix:

missing semicolon style corrections if applicable

rename suggestions

insertion of required directives

reflow of long expressions

formatting fixes

Code actions are the natural mechanism for quick fixes and refactorings in VS Code.

Deliverable: diagnostics become actionable, not just informational.

13) Add semantic highlighting later
After the grammar and symbol table are stable, add semantic tokens:

functions

variables

parameters

constants

deprecated symbols

imported names

Semantic tokens are layered on top of grammar highlighting and refine it using symbol knowledge.

Deliverable: editor highlighting becomes more precise than regex-based syntax coloring.

14) Build tests in layers
Test in three layers:

Parser unit tests

Rule engine unit tests

Integration tests in Extension Development Host

VS Code supports running and debugging extension tests inside the Extension Development Host, and the Testing API supports discovering and publishing results.

Deliverable: automated confidence before publishing.

15) Package and publish
Use vsce to package and publish. VS Code’s publishing guide documents packaging into VSIX and publishing to the Marketplace.

Deliverable: installable extension package and release process.

Recommended learning sequence
Phase 1 — Basic extension authoring
Learn:

extension manifest

activation events

commands

language contributions

grammars

language configuration

This phase gets you from zero to a syntax-aware extension.

Phase 2 — LSP fundamentals
Learn:

client/server split

document synchronization

diagnostics

hover

completion

definitions

This phase gives you the core editor intelligence.

Phase 3 — Static analysis
Learn:

parsing

AST design

scope resolution

type checking

symbol tables

rule engines

This phase gives you real linting.

Phase 4 — Formatting
Learn:

document formatting providers

range formatting

printer design

whitespace normalization

comment preservation

This phase gives you a reliable formatter.

Phase 5 — Quality and release
Learn:

unit tests

integration tests

packaging

Marketplace publishing

This phase makes the extension maintainable and distributable.

Suggested build order for your first real extension
Register the language and grammar.

Add syntax highlighting and bracket/comment behavior.

Implement a minimal parser.

Add diagnostics for 5–10 high-value lint rules.

Add hover docs and completion.

Add document formatting.

Add tests.

Publish.

What to build first in the linter
Prioritize rules in this order:

Syntax errors — invalid tokens, missing delimiters, broken blocks

Unresolved identifiers — undefined variables/functions

Signature mismatches — wrong arg count or wrong arg shape

Version errors — unsupported features for the declared version

Style warnings — naming, spacing, line length

Domain-specific warnings — repaint risk, bad lookahead usage, unsafe patterns

This order gives the highest signal-to-noise ratio.

What to build first in the formatter
Start with deterministic rules:

indentation

spacing around operators

call argument wrapping

block layout

blank lines between top-level declarations

Do not start with “smart” reformatting. Get stable output first, then increase sophistication.

Minimal tooling stack
TypeScript

vscode

vscode-languageclient

vscode-languageserver

a parser library or custom parser

test runner for unit and integration tests

TypeScript is the default recommended path in the official extension docs.

Final execution map
Stage	Outcome
Declarative language support	basic editor behavior works
Grammar	syntax highlighting works
LSP	intelligence features work
Parser + AST	analysis becomes reliable
Linter	errors and warnings appear
Formatter	consistent code style
Code actions	one-click fixes
Tests	regressions are controlled
Packaging	installable release
Bottom line
The correct mental model is:

VS Code extension = editor integration
Language server = intelligence
Parser/AST = correctness
Formatter = deterministic printing
Linter = rule engine over AST + symbols

I can turn this into a concrete 90-day implementation roadmap or a repo structure + starter codebase next.


What can we name this extension

Direct decision
Name it PineForge.

Strong signal: implies building, shaping, and validating Pine scripts

Distinct: not a generic “linter/formatter” label

Extensible: supports future AI, strategy validation, backtesting hooks

Marketplace-friendly: short, memorable, brandable

If you want a more explicit / technical naming
Top-tier alternatives (recommended)
Name	Positioning
PineForge	Best overall (balanced: dev + trading)
PineGuard	Focus on safety, linting, risk detection
PineLens	Analysis + insight (good if adding AI later)
PineCore	Language infrastructure focus
PineFlow	Formatter + structured code focus
PineLint Pro	Straightforward, functional
PineEngine	Heavy system / strategy tooling
If you want trading-system alignment (your domain)
Name	Why it fits
PineAlpha	Signals, edge, trading focus
PineQuant	Systematic + quantitative vibe
PineSignals	Strategy + indicator validation
PineRisk	Risk + repaint + execution safety
PineExecution	Strategy → execution pipeline
If you want enterprise / toolchain positioning
Name	Tone
PineKit	Developer toolkit
PineStack	Full ecosystem
PineLab	Research + experimentation
PineSuite	Multi-feature platform
Names to avoid (weak or problematic)
PineScript Linter → too generic, zero differentiation

TradingView Helper → brand/legal conflict risk

Pine IDE → misleading scope

Pine Formatter → undersells capability

Final recommendation
Use:

PineForge — Pine Script v6 Language Server, Linter & Formatter

This gives you:

strong brand

clear capability

room to expand into AI + strategy validation + trading tooling

If you want, I’ll define:

extension branding (logo, colors, identity)

feature positioning for marketplace listing

roadmap-aligned naming (modules like PineForge Core, PineForge AI, etc.)




