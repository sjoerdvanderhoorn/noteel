// File-related utility functions

export function getFileTitle(content, fallback) {
  const trimmed = content.trim();
  if (trimmed.startsWith("<")) {
    try {
      const doc = new DOMParser().parseFromString(trimmed, "text/html");
      const heading = doc.querySelector("h1, h2, h3");
      if (heading?.textContent?.trim()) {
        return heading.textContent.trim();
      }
      if (doc.body?.textContent?.trim()) {
        return doc.body.textContent.trim().split("\n")[0];
      }
    } catch {
      return fallback;
    }
  }

  const firstLine = content.split("\n")[0]?.trim();
  if (firstLine?.startsWith("#")) {
    return firstLine.replace(/^#+\s*/, "").trim() || fallback;
  }
  return fallback;
}

export function isSoftDeleted(path) {
  const name = path.split("/").pop();
  return name?.startsWith("~");
}

export function isFolderSoftDeleted(folderPath) {
  if (!folderPath) return false;
  const parts = folderPath.split("/");
  return parts.some(part => part.startsWith("~"));
}

export function stripFirstHeading(content) {
  // Remove first markdown heading (# Title)
  return content.replace(/^#+\s+.*$/m, "").trim();
}

export function updateContentWithTitle(content, newTitle) {
  // Remove existing first heading if present
  const withoutHeading = content.replace(/^#+\s+.*$/m, "").trim();
  // Add new title as heading
  return `# ${newTitle}\n\n${withoutHeading}`;
}

export function generateFilenameFromTitle(title) {
  // Convert title to filename
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .substring(0, 50) // Limit length
    + ".md";
}

export function listFoldersFromPaths(paths) {
  const folders = new Set();
  paths.forEach((path) => {
    const parts = path.split("/");
    parts.pop();
    let current = "";
    parts.forEach((part) => {
      current = current ? `${current}/${part}` : part;
      folders.add(current);
    });
  });
  return Array.from(folders).sort();
}
