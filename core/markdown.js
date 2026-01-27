// Markdown serialization and deserialization utilities

export function serializeMarkdown(doc) {
  if (!doc?.content) {
    return "";
  }
  return doc.content
    .map((node) => serializeBlock(node))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function serializeBlock(node) {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content || []);
    case "heading":
      return `${"#".repeat(node.attrs?.level || 1)} ${serializeInline(node.content || [])}`.trim();
    case "bulletList":
      return (node.content || []).map((item) => serializeListItem(item, "- ")).join("\n");
    case "orderedList":
      return (node.content || []).map((item, index) => serializeListItem(item, `${index + 1}. `)).join("\n");
    case "taskList":
      return (node.content || []).map((item) => serializeTaskItem(item)).join("\n");
    case "blockquote":
      return serializeBlockquote(node);
    case "codeBlock":
      return `\`\`\`\n${getText(node)}\n\`\`\``;
    default:
      return "";
  }
}

function serializeInline(nodes) {
  return nodes.map((node) => serializeInlineNode(node)).join("");
}

function serializeInlineNode(node) {
  if (node.type === "text") {
    return applyMarks(node.text || "", node.marks || []);
  }
  if (node.type === "hardBreak") {
    return "\n";
  }
  return "";
}

function applyMarks(text, marks) {
  let content = escapeMarkdown(text);
  const hasCode = marks.some((mark) => mark.type === "code");
  if (hasCode) {
    return `\`${content}\``;
  }
  const hasBold = marks.some((mark) => mark.type === "bold");
  const hasItalic = marks.some((mark) => mark.type === "italic");
  const hasStrike = marks.some((mark) => mark.type === "strike");
  const hasUnderline = marks.some((mark) => mark.type === "underline");
  const hasHighlight = marks.some((mark) => mark.type === "highlight");
  
  if (hasHighlight) {
    content = `==${content}==`;
  }
  if (hasUnderline) {
    content = `<u>${content}</u>`;
  }
  if (hasStrike) {
    content = `~~${content}~~`;
  }
  if (hasBold && hasItalic) {
    return `***${content}***`;
  }
  if (hasBold) {
    return `**${content}**`;
  }
  if (hasItalic) {
    return `*${content}*`;
  }
  return content;
}

function escapeMarkdown(text) {
  return text.replace(/([*_`>])/g, "\\$1");
}

function serializeListItem(node, prefix) {
  const content = (node.content || []).map((child) => serializeBlock(child)).filter(Boolean).join("\n");
  const lines = content.split("\n");
  return lines
    .map((line, index) => (index === 0 ? `${prefix}${line}` : `  ${line}`))
    .join("\n");
}

function serializeTaskItem(node) {
  const checked = node.attrs?.checked ? "x" : " ";
  const content = (node.content || []).map((child) => serializeBlock(child)).filter(Boolean).join("\n");
  const lines = content.split("\n");
  return lines
    .map((line, index) => (index === 0 ? `- [${checked}] ${line}` : `  ${line}`))
    .join("\n");
}

function serializeBlockquote(node) {
  const content = (node.content || []).map((child) => serializeBlock(child)).filter(Boolean).join("\n\n");
  return content
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function getText(node) {
  if (!node) {
    return "";
  }
  if (node.type === "text") {
    return node.text || "";
  }
  return (node.content || []).map((child) => getText(child)).join("");
}
