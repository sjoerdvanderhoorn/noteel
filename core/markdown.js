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

// Parse YAML frontmatter from markdown content
export function parseFrontmatter(content) {
  const frontmatter = {
    title: "",
    tags: [],
    categories: [],
    star: false,
    date: "",
    color: ""
  };
  
  if (!content) {
    return { frontmatter, content };
  }
  
  // Normalize line endings to \n for consistent parsing
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  if (!normalizedContent.startsWith("---\n")) {
    return { frontmatter, content: normalizedContent };
  }
  
  const endMatch = normalizedContent.indexOf("\n---\n", 4);
  if (endMatch === -1) {
    return { frontmatter, content: normalizedContent };
  }
  
  const yamlContent = normalizedContent.substring(4, endMatch);
  const bodyContent = normalizedContent.substring(endMatch + 5);
  
  // Parse YAML manually (simple key-value parsing)
  const lines = yamlContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    if (trimmed.startsWith("title:")) {
      frontmatter.title = trimmed.substring(6).trim().replace(/^["']|["']$/g, "");
    } else if (trimmed.startsWith("star:")) {
      const value = trimmed.substring(5).trim().toLowerCase();
      frontmatter.star = value === "true" || value === "yes";
    } else if (trimmed.startsWith("date:")) {
      frontmatter.date = trimmed.substring(5).trim().replace(/^["']|["']$/g, "");
    } else if (trimmed.startsWith("color:")) {
      frontmatter.color = trimmed.substring(6).trim().replace(/^["']|["']$/g, "");
    } else if (trimmed.startsWith("tags:")) {
      const tagsStr = trimmed.substring(5).trim();
      if (tagsStr.startsWith("[") && tagsStr.endsWith("]")) {
        // Array notation: [tag1, tag2]
        frontmatter.tags = tagsStr.slice(1, -1)
          .split(",")
          .map(t => t.trim().replace(/^["']|["']$/g, ""))
          .filter(t => t);
      }
    } else if (trimmed.startsWith("- ") && lines[lines.indexOf(line) - 1]?.trim() === "tags:") {
      // List notation for tags
      frontmatter.tags.push(trimmed.substring(2).trim().replace(/^["']|["']$/g, ""));
    } else if (trimmed.startsWith("categories:")) {
      const catsStr = trimmed.substring(11).trim();
      if (catsStr.startsWith("[") && catsStr.endsWith("]")) {
        // Array notation: [cat1, cat2]
        frontmatter.categories = catsStr.slice(1, -1)
          .split(",")
          .map(c => c.trim().replace(/^["']|["']$/g, ""))
          .filter(c => c);
      }
    } else if (trimmed.startsWith("- ") && lines[lines.indexOf(line) - 1]?.trim() === "categories:") {
      // List notation for categories
      frontmatter.categories.push(trimmed.substring(2).trim().replace(/^["']|["']$/g, ""));
    }
  }
  
  // Handle list notation properly
  let inTags = false;
  let inCategories = false;
  frontmatter.tags = [];
  frontmatter.categories = [];
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    if (trimmed === "tags:") {
      inTags = true;
      inCategories = false;
      // Check if it's inline array notation
      const nextPart = lines[i].substring(lines[i].indexOf("tags:") + 5).trim();
      if (nextPart.startsWith("[") && nextPart.endsWith("]")) {
        frontmatter.tags = nextPart.slice(1, -1)
          .split(",")
          .map(t => t.trim().replace(/^["']|["']$/g, ""))
          .filter(t => t);
        inTags = false;
      }
    } else if (trimmed === "categories:") {
      inCategories = true;
      inTags = false;
      // Check if it's inline array notation
      const nextPart = lines[i].substring(lines[i].indexOf("categories:") + 11).trim();
      if (nextPart.startsWith("[") && nextPart.endsWith("]")) {
        frontmatter.categories = nextPart.slice(1, -1)
          .split(",")
          .map(c => c.trim().replace(/^["']|["']$/g, ""))
          .filter(c => c);
        inCategories = false;
      }
    } else if (trimmed.startsWith("- ")) {
      const value = trimmed.substring(2).trim().replace(/^["']|["']$/g, "");
      if (inTags) {
        frontmatter.tags.push(value);
      } else if (inCategories) {
        frontmatter.categories.push(value);
      }
    } else if (trimmed && !trimmed.startsWith("#") && trimmed.includes(":")) {
      inTags = false;
      inCategories = false;
    }
  }
  
  return { frontmatter, content: bodyContent };
}

// Serialize frontmatter to YAML format
export function serializeFrontmatter(frontmatter) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return "";
  }
  
  const parts = ["---"];
  
  if (frontmatter.title) {
    parts.push(`title: "${frontmatter.title}"`);
  }
  
  if (frontmatter.tags && frontmatter.tags.length > 0) {
    parts.push("tags:");
    frontmatter.tags.forEach(tag => {
      parts.push(`  - ${tag}`);
    });
  }
  
  if (frontmatter.categories && frontmatter.categories.length > 0) {
    parts.push("categories:");
    frontmatter.categories.forEach(cat => {
      parts.push(`  - ${cat}`);
    });
  }
  
  if (frontmatter.star !== undefined && frontmatter.star !== false) {
    parts.push(`star: ${frontmatter.star}`);
  }
  
  if (frontmatter.date) {
    parts.push(`date: ${frontmatter.date}`);
  }
  
  if (frontmatter.color) {
    parts.push(`color: ${frontmatter.color}`);
  }
  
  parts.push("---");
  return parts.join("\n");
}
