// TipTap editor initialization and toolbar configuration

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import ListItem from "@tiptap/extension-list-item";
import Heading from "@tiptap/extension-heading";
import Paragraph from "@tiptap/extension-paragraph";
import CodeBlock from "@tiptap/extension-code-block";
import Blockquote from "@tiptap/extension-blockquote";
import { Markdown } from "@tiptap/markdown";
import { ui } from "./components.js";
import { state } from "../core/state.js";

export async function initEditor(onUpdateCallback) {
  state.editorInstance = new Editor({
    element: ui.editor,
    extensions: [
      Markdown,
      StarterKit.configure({
        listItem: false, // We'll configure this separately
        heading: false, // We'll configure this separately
        paragraph: false, // We'll configure this separately
        codeBlock: false, // We'll configure this separately
        blockquote: false, // We'll configure this separately
      }),
      Paragraph.extend({
        draggable: true,
      }),
      Heading.extend({
        draggable: true,
      }),
      CodeBlock.extend({
        draggable: true,
      }),
      Blockquote.extend({
        draggable: true,
      }),
      ListItem.extend({
        draggable: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }).extend({
        draggable: true,
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Underline,
    ],
    content: "",
    editable: false,
    onUpdate: onUpdateCallback
  });

  // Setup toolbar event listeners
  ui.boldBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleBold().run();
  });
  ui.italicBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleItalic().run();
  });
  ui.underlineBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleUnderline().run();
  });
  ui.strikeBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleStrike().run();
  });
  ui.highlightBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleHighlight().run();
  });
  ui.headingBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleHeading({ level: 1 }).run();
  });
  ui.bulletBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleBulletList().run();
  });
  ui.checkboxBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleTaskList().run();
  });
  ui.codeBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleCodeBlock().run();
  });
  ui.quoteBtn.addEventListener("click", () => {
    state.editorInstance.chain().focus().toggleBlockquote().run();
  });
}
