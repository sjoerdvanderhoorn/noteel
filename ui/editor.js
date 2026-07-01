// Milkdown editor initialization and toolbar configuration

import "@milkdown/crepe/theme/common/style.css";
import { Crepe } from "@milkdown/crepe";
import { commandsCtx, editorViewCtx, parserCtx } from "@milkdown/kit/core";
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
import { ui } from "./components.js";
import { state } from "../core/state.js";

export async function initEditor(onUpdateCallback) {
  const crepe = new Crepe({
    root: ui.editor,
    defaultValue: ""
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
