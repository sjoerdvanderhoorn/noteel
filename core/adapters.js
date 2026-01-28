// Adapter initialization and management

import { DropboxAdapter } from "../adapters/dropbox.js";
import { GoogleDriveAdapter } from "../adapters/googledrive.js";
import { OneDriveAdapter } from "../adapters/onedrive.js";
import { WebDAVAdapter } from "../adapters/webdav.js";
import { GitHubAdapter } from "../adapters/github.js";
import { GitLabAdapter } from "../adapters/gitlab.js";
import { SelfHostedGitAdapter } from "../adapters/selfhostedgit.js";
import { S3Adapter } from "../adapters/s3.js";
import { loadFs, saveFs } from "../core/storage.js";
import { listFoldersFromPaths } from "../utils/file-utils.js";

class LocalStorageAdapter {
  constructor() {
    this.name = "Local";
  }

  async listFiles() {
    const { files } = loadFs();
    return Object.keys(files);
  }

  async listFolders() {
    return listFoldersFromPaths(await this.listFiles());
  }

  async getFileContent(path) {
    const { files } = loadFs();
    return files[path]?.content ?? "";
  }

  async saveFileContent(path, content) {
    const fs = loadFs();
    fs.files[path] = { content, modified: Date.now() };
    saveFs(fs);
  }

  async deleteFile(path) {
    const fs = loadFs();
    delete fs.files[path];
    saveFs(fs);
  }
}

class StaticFolderAdapter {
  constructor(basePath) {
    this.name = "Sample";
    this.basePath = basePath.replace(/\/$/, "");
  }

  async listFiles() {
    const response = await fetch(`${this.basePath}/.noteel/file-index.json`);
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return payload.files.map((file) => file.path);
  }

  async listFolders() {
    return listFoldersFromPaths(await this.listFiles());
  }

  async getFileContent(path) {
    const response = await fetch(`${this.basePath}/${path}`);
    if (!response.ok) {
      return "";
    }
    return response.text();
  }

  async saveFileContent() {
    throw new Error("Sample adapter is read-only.");
  }

  async deleteFile() {
    throw new Error("Sample adapter is read-only.");
  }
}

export function createAdapters() {
  return {
    local: new LocalStorageAdapter(),
    sample: new StaticFolderAdapter("./user-folder-example"),
    dropbox: new DropboxAdapter(),
    onedrive: new OneDriveAdapter(),
    googledrive: new GoogleDriveAdapter(),
    webdav: new WebDAVAdapter(),
    github: new GitHubAdapter(),
    gitlab: new GitLabAdapter(),
    selfhostedgit: new SelfHostedGitAdapter(),
    s3: new S3Adapter()
  };
}

export function initAdapterSelect(adapters, selectElement) {
  selectElement.innerHTML = "";
  Object.entries(adapters).forEach(([key, adapter]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = adapter.name;
    selectElement.appendChild(option);
  });
}
