// Milkdown editor initialization and toolbar configuration

import "@milkdown/crepe/theme/common/style.css";
import { Crepe } from "@milkdown/crepe";
import { commandsCtx, editorViewCtx, parserCtx } from "@milkdown/kit/core";
import { uploadConfig } from "@milkdown/kit/plugin/upload";
import { Slice } from "@milkdown/kit/prose/model";
import {
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  headingSchema,
  listItemSchema,
  setBlockTypeCommand,
  toggleEmphasisCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { loadFs, saveFs } from "../core/storage.js";
import { ui } from "./components.js";
import { state } from "../core/state.js";

export async function initEditor(onUpdateCallback) {
  const crepe = new Crepe({
    root: ui.editor,
    defaultValue: ""
  });
  crepe.editor.config((ctx) => {
    ctx.update(uploadConfig.key, (prev) => ({
      ...prev,
      uploader: async (files, schema) => {
        const imageNode = schema.nodes.image;
        if (!imageNode) return [];

        const fs = loadFs();
        const savedImages = [];
        const uploaded = [];
        const activeFolder = state.currentFile?.split("/").slice(0, -1).join("/") || state.currentFolder || "";

        for (let i = 0; i < files.length; i += 1) {
          const file = files.item(i);
          if (!file || !file.type.includes("image")) continue;

          const ext = getFileExtension(file);
          const uniqueName = `image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
          const fullPath = activeFolder ? `${activeFolder}/${uniqueName}` : uniqueName;
          const src = uniqueName; // keep relative to note folder
          const dataUrl = await readFileAsDataUrl(file);

          fs.files[fullPath] = {
            content: dataUrl,
            modified: Date.now()
          };
          state.modifiedFiles.add(fullPath);

          const node = imageNode.createAndFill({ src });
          if (node) {
            uploaded.push(node);
          }
          savedImages.push(fullPath);
        }

        if (savedImages.length > 0) {
          saveFs(fs);
        }

        return uploaded;
      }
    }));
  });
  await crepe.create();
  crepe.setReadonly(true);
  crepe.on((listener) => {
    listener.markdownUpdated((_, markdown, previousMarkdown) => {
      if (markdown !== previousMarkdown) {
        onUpdateCallback();
      }
    });
  });

  state.editorInstance = {
    editor: crepe.editor,
    getMarkdown: () => crepe.getMarkdown(),
    setEditable: (isEditable) => {
      crepe.setReadonly(!isEditable);
    },
    setMarkdown: (markdown) => {
      crepe.editor.action((ctx) => {
        const parser = ctx.get(parserCtx);
        const view = ctx.get(editorViewCtx);
        const doc = parser(markdown || "");
        if (!doc) {
          return;
        }
        const { state: viewState } = view;
        view.dispatch(
          viewState.tr.replace(0, viewState.doc.content.size, new Slice(doc.content, 0, 0))
        );
      });
    }
  };

  const runEditorCommand = (executor) => {
    if (!state.editorInstance?.editor) return;
    state.editorInstance.editor.action((ctx) => {
      executor(ctx);
      ctx.get(editorViewCtx).focus();
    });
  };

  // Setup toolbar event listeners
  ui.boldBtn.addEventListener("click", () => {
    runEditorCommand((ctx) => {
      ctx.get(commandsCtx).call(toggleStrongCommand.key);
    });
  });
  ui.italicBtn.addEventListener("click", () => {
    runEditorCommand((ctx) => {
      ctx.get(commandsCtx).call(toggleEmphasisCommand.key);
    });
  });
  ui.underlineBtn.addEventListener("click", () => {
    // Underline is not part of standard markdown/Milkdown.
  });
  ui.strikeBtn.addEventListener("click", () => {
    runEditorCommand((ctx) => {
      ctx.get(commandsCtx).call(toggleStrikethroughCommand.key);
    });
  });
  ui.highlightBtn.addEventListener("click", () => {
    // Highlight is not part of standard markdown/Milkdown.
  });
  ui.headingBtn.addEventListener("click", () => {
    runEditorCommand((ctx) => {
      ctx.get(commandsCtx).call(setBlockTypeCommand.key, {
        nodeType: headingSchema.type(ctx),
        attrs: { level: 1 }
      });
    });
  });
  ui.bulletBtn.addEventListener("click", () => {
    runEditorCommand((ctx) => {
      ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, {
        nodeType: bulletListSchema.type(ctx)
      });
    });
  });
  ui.checkboxBtn.addEventListener("click", () => {
    runEditorCommand((ctx) => {
      ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, {
        nodeType: listItemSchema.type(ctx),
        attrs: { checked: false }
      });
    });
  });
  ui.codeBtn.addEventListener("click", () => {
    runEditorCommand((ctx) => {
      ctx.get(commandsCtx).call(setBlockTypeCommand.key, {
        nodeType: codeBlockSchema.type(ctx)
      });
    });
  });
  ui.quoteBtn.addEventListener("click", () => {
    runEditorCommand((ctx) => {
      ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, {
        nodeType: blockquoteSchema.type(ctx)
      });
    });
  });

  ui.underlineBtn.disabled = true;
  ui.underlineBtn.title = "Underline is not available in standard Markdown";
  ui.highlightBtn.disabled = true;
  ui.highlightBtn.title = "Highlight is not available in standard Markdown";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

function getFileExtension(file) {
  const fromName = (file.name || "").split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,6}$/.test(fromName)) {
    return fromName;
  }

  const byMime = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/x-icon": "ico"
  };

  return byMime[file.type] || "png";
}
