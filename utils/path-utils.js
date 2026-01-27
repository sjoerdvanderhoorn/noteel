// Path manipulation utilities

export function normalizeFileName(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.endsWith(".md")) {
    return `${trimmed}.md`;
  }
  return trimmed;
}

export function normalizeFolderName(name) {
  const trimmed = name.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function joinPath(folder, fileName) {
  return folder ? `${folder}/${fileName}` : fileName;
}

export function formatPath(path) {
  return path ? `/${path}` : "/";
}
