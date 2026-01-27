// Markdown serialization utilities using TipTap's markdown manager
// This module provides a wrapper around the editor's markdown functionality
// The actual markdown parsing/serialization is handled by @tiptap/markdown

export function serializeMarkdown(doc, editorInstance) {
  if (!doc?.content || !editorInstance?.markdown) {
    return "";
  }
  // Use TipTap's markdown manager to serialize
  return editorInstance.markdown.serialize(doc);
}
