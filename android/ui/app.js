let editor = null;
let currentModel = null;
let currentFile = "untitled.js";
let toastTimer = null;

const sampleCode = [
  "function helloWizardCode() {",
  "  const message = \"Hello from WizardCode\";",
  "  console.log(message);",
  "}",
  "",
  "helloWizardCode();"
].join("\n");

function byId(id) {
  return document.getElementById(id);
}

function bridge() {
  return window.AndroidBridge || null;
}

function showToast(message) {
  const el = byId("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function extensionOf(name) {
  const match = /\.([^.]+)$/.exec(name || "");
  return match ? match[1].toLowerCase() : "";
}

function languageFor(name) {
  const ext = extensionOf(name);
  const map = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    dart: "dart",
    py: "python",
    php: "php",
    c: "c",
    h: "cpp",
    cc: "cpp",
    cpp: "cpp",
    cxx: "cpp",
    rs: "rust",
    go: "go",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "shell",
    bash: "shell"
  };
  return map[ext] || "plaintext";
}

function prettyLanguage(name) {
  const value = languageFor(name);
  const names = {
    plaintext: "Plain Text",
    javascript: "JavaScript",
    typescript: "TypeScript",
    json: "JSON",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    java: "Java",
    kotlin: "Kotlin",
    dart: "Dart",
    python: "Python",
    php: "PHP",
    cpp: "C/C++",
    rust: "Rust",
    go: "Go",
    xml: "XML",
    yaml: "YAML",
    markdown: "Markdown",
    sql: "SQL",
    shell: "Shell"
  };
  return names[value] || value;
}

function setFileIdentity(name) {
  currentFile = name || "untitled.js";
  byId("tabName").textContent = currentFile;
  byId("drawerFileName").textContent = currentFile;
  byId("languageLabel").textContent = prettyLanguage(currentFile);
  byId("projectLabel").textContent = currentFile;
  const ext = extensionOf(currentFile).toUpperCase() || "TXT";
  byId("drawerFileIcon").textContent = ext.slice(0, 3);
}

function syncCursor() {
  if (!editor) return;
  const p = editor.getPosition();
  if (!p) return;
  byId("cursorPosition").textContent = "Ln " + p.lineNumber + ", Col " + p.column;
}

function showEditor() {
  byId("welcome").classList.add("hidden");
  byId("editorShell").classList.remove("hidden");
  if (editor) {
    setTimeout(() => editor.layout(), 30);
    editor.focus();
  }
}

function showWelcome() {
  byId("editorShell").classList.add("hidden");
  byId("welcome").classList.remove("hidden");
}

function openDrawer() {
  byId("drawer").classList.add("open");
  byId("scrim").classList.add("open");
}

function closeDrawer() {
  byId("drawer").classList.remove("open");
  byId("scrim").classList.remove("open");
}

function openNewDialog() {
  closeDrawer();
  byId("newFileModal").classList.remove("hidden");
  const input = byId("newFileName");
  input.value = currentFile === "untitled.js" ? "main.js" : currentFile;
  setTimeout(() => {
    input.focus();
    input.select();
  }, 30);
}

function closeNewDialog() {
  byId("newFileModal").classList.add("hidden");
}

function createNewFile(name) {
  const safeName = (name || "").trim() || "main.js";
  setFileIdentity(safeName);
  if (editor) {
    if (currentModel) currentModel.dispose();
    currentModel = monaco.editor.createModel("", languageFor(safeName));
    editor.setModel(currentModel);
  }
  showEditor();
  byId("statusMessage").textContent = "New file";
  showToast("Created " + safeName);
}

function openNativeFile() {
  const b = bridge();
  if (b && b.openFile) {
    b.openFile();
    return;
  }
  showToast("Open file is available in the Android APK");
}

function saveNativeFile() {
  if (!editor) {
    showToast("Create or open a file first");
    return;
  }
  const content = editor.getValue();
  const b = bridge();
  if (b && b.saveFile) {
    b.saveFile(currentFile, content);
    return;
  }
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFile;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
  showToast("Saved " + currentFile);
}

function startEditor() {
  require.config({ paths: { vs: "./monaco/vs" } });
  require(["vs/editor/editor.main"], function () {
    monaco.editor.defineTheme("wizard-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "697386" },
        { token: "string", foreground: "a8d8a8" },
        { token: "keyword", foreground: "8fb2ff" },
        { token: "number", foreground: "d9a9ff" }
      ],
      colors: {
        "editor.background": "#0f1117",
        "editor.foreground": "#d9e0ec",
        "editorLineNumber.foreground": "#3f4755",
        "editorLineNumber.activeForeground": "#9ba8bc",
        "editorCursor.foreground": "#7da4ff",
        "editor.selectionBackground": "#28456d",
        "editor.inactiveSelectionBackground": "#202c3d",
        "editorIndentGuide.background1": "#1a1f28",
        "editorIndentGuide.activeBackground1": "#2a3444",
        "editorLineHighlightBackground": "#121722",
        "editorWidget.background": "#161a22",
        "editorWidget.border": "#2a303c",
        "editorSuggestWidget.background": "#161a22",
        "editorSuggestWidget.border": "#2a303c"
      }
    });

    editor = monaco.editor.create(byId("editor"), {
      value: sampleCode,
      language: "javascript",
      theme: "wizard-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineHeight: 20,
      padding: { top: 14, bottom: 16 },
      smoothScrolling: true,
      scrollBeyondLastLine: false,
      wordWrap: "off",
      cursorBlinking: "smooth",
      renderWhitespace: "selection",
      suggest: { showIcons: true },
      scrollbar: { verticalScrollbarSize: 7, horizontalScrollbarSize: 7 }
    });

    currentModel = editor.getModel();
    setFileIdentity(currentFile);
    editor.onDidChangeCursorPosition(syncCursor);
    editor.onDidChangeModelContent(() => {
      byId("statusMessage").textContent = "Modified";
    });
    syncCursor();

    window.addEventListener("resize", () => editor && editor.layout());
  });
}

window.WizardCode = {
  receiveFile: function (name, content) {
    if (!editor) return;
    setFileIdentity(name || "untitled.js");
    if (currentModel) currentModel.dispose();
    currentModel = monaco.editor.createModel(content || "", languageFor(currentFile));
    editor.setModel(currentModel);
    showEditor();
    byId("statusMessage").textContent = "Opened";
    showToast("Opened " + currentFile);
  },
  saveResult: function (message) {
    byId("statusMessage").textContent = "Saved";
    showToast(message || "Saved");
  }
};

window.addEventListener("DOMContentLoaded", function () {
  startEditor();

  byId("menuBtn").onclick = openDrawer;
  byId("drawerClose").onclick = closeDrawer;
  byId("scrim").onclick = closeDrawer;
  byId("searchBtn").onclick = function () {
    if (!editor) return;
    showEditor();
    const action = editor.getAction("actions.find");
    if (action) action.run();
  };
  byId("saveBtnTop").onclick = saveNativeFile;
  byId("openFileBtn").onclick = openNativeFile;
  byId("newFileBtn").onclick = openNewDialog;
  byId("tabAdd").onclick = openNewDialog;
  byId("navNew").onclick = openNewDialog;
  byId("navSave").onclick = saveNativeFile;
  byId("navSearch").onclick = function () {
    if (!editor) return;
    showEditor();
    const action = editor.getAction("actions.find");
    if (action) action.run();
  };
  byId("navExplorer").onclick = openDrawer;
  byId("navMore").onclick = function () {
    showToast("WizardCode is ready for Android file workflows");
  };
  byId("drawerNew").onclick = openNewDialog;
  byId("drawerOpen").onclick = openNativeFile;
  byId("tabClose").onclick = showWelcome;
  byId("cancelNew").onclick = closeNewDialog;
  byId("confirmNew").onclick = function () {
    createNewFile(byId("newFileName").value);
    closeNewDialog();
  };
  byId("newFileName").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      createNewFile(event.target.value);
      closeNewDialog();
    }
  });
});
