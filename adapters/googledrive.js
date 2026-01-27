import { OAUTH_CONFIG, getTokens, saveTokens, generateState } from "../core/auth.js";

export class GoogleDriveAdapter {
	constructor() {
		this.name = "Google Drive";
		this.baseUrl = "https://www.googleapis.com/drive/v3";
		this.uploadUrl = "https://www.googleapis.com/upload/drive/v3";
		this.rootFolderName = "Noteel";
		this.cache = null;
	}

	async authenticate() {
		const config = OAUTH_CONFIG.googledrive;
		const state = generateState();
		sessionStorage.setItem('oauth_state', state);
		sessionStorage.setItem('oauth_provider', 'googledrive');

		const params = new URLSearchParams({
			client_id: config.clientId,
			redirect_uri: config.redirectUri,
			response_type: 'token',
			scope: config.scopes,
			state: state,
			include_granted_scopes: 'true'
		});

		return new Promise((resolve, reject) => {
			const authWindow = window.open(
				`${config.authEndpoint}?${params.toString()}`,
				'Google Drive Auth',
				'width=600,height=700'
			);

			const messageHandler = (event) => {
				if (event.origin !== window.location.origin) return;
				
				if (event.data.type === 'oauth-success') {
					window.removeEventListener('message', messageHandler);
					
					const savedState = sessionStorage.getItem('oauth_state');
					if (event.data.state !== savedState) {
						reject(new Error('State mismatch'));
						return;
					}

					saveTokens('googledrive', {
						accessToken: event.data.accessToken,
						expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
					});

					sessionStorage.removeItem('oauth_state');
					sessionStorage.removeItem('oauth_provider');
					resolve();
				} else if (event.data.type === 'oauth-error') {
					window.removeEventListener('message', messageHandler);
					reject(new Error(event.data.errorDescription || event.data.error));
				}
			};

			window.addEventListener('message', messageHandler);

			const checkClosed = setInterval(() => {
				if (authWindow && authWindow.closed) {
					clearInterval(checkClosed);
					window.removeEventListener('message', messageHandler);
					reject(new Error('Authentication window closed'));
				}
			}, 500);
		});
	}

	async getAccessToken() {
		const tokens = getTokens('googledrive');
		
		if (!tokens || !tokens.accessToken) {
			await this.authenticate();
			return this.getAccessToken();
		}

		if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
			await this.authenticate();
			return this.getAccessToken();
		}

		return tokens.accessToken;
	}

	async listFiles() {
		const { files } = await this.buildCache();
		return Object.keys(files);
	}

	async listFolders() {
		const { folders } = await this.buildCache();
		return Object.keys(folders);
	}

	async getFileContent() {
		const path = arguments[0];
		const { files } = await this.buildCache();
		const file = files[path];
		if (!file) {
			return "";
		}
		const response = await this.fetchApi(`/files/${file.id}?alt=media`, {
			method: "GET"
		});
		if (!response.ok) {
			throw new Error("Google Drive download failed.");
		}
		return response.text();
	}

	async saveFileContent() {
		const [path, content] = arguments;
		const { files } = await this.buildCache();
		const existing = files[path];
		if (existing) {
			const response = await this.fetchApi(`/files/${existing.id}?uploadType=media`, {
				method: "PATCH",
				headers: { "Content-Type": "text/markdown" },
				body: content
			});
			if (!response.ok) {
				throw new Error("Google Drive update failed.");
			}
			this.cache = null;
			return;
		}

		const parentId = await this.ensureFolderPath(path);
		const fileName = path.split("/").pop();
		const boundary = `noteel-${Date.now()}`;
		const metadata = {
			name: fileName,
			parents: [parentId]
		};
		const body = [
			`--${boundary}`,
			"Content-Type: application/json; charset=UTF-8",
			"",
			JSON.stringify(metadata),
			`--${boundary}`,
			"Content-Type: text/markdown",
			"",
			content,
			`--${boundary}--`
		].join("\r\n");

		const response = await this.fetchUpload("/files?uploadType=multipart", {
			method: "POST",
			headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
			body
		});
		if (!response.ok) {
			throw new Error("Google Drive upload failed.");
		}
		this.cache = null;
	}

	async deleteFile() {
		const path = arguments[0];
		const { files } = await this.buildCache();
		const file = files[path];
		if (!file) {
			return;
		}
		const response = await this.fetchApi(`/files/${file.id}`, {
			method: "DELETE"
		});
		if (!response.ok) {
			throw new Error("Google Drive delete failed.");
		}
		this.cache = null;
	}

	async buildCache() {
		if (this.cache) {
			return this.cache;
		}
		const rootId = await this.ensureRootFolder();
		const files = {};
		const folders = {};
		await this.listRecursive(rootId, "", files, folders);
		this.cache = { rootId, files, folders };
		return this.cache;
	}

	async listRecursive(parentId, parentPath, files, folders) {
		const query = `'${parentId}' in parents and trashed=false`;
		let pageToken = "";
		do {
			const response = await this.fetchApi(`/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType)` + (pageToken ? `&pageToken=${pageToken}` : ""), {
				method: "GET"
			});
			if (!response.ok) {
				throw new Error("Google Drive list failed.");
			}
			const payload = await response.json();
			for (const file of payload.files || []) {
				const path = parentPath ? `${parentPath}/${file.name}` : file.name;
				if (file.mimeType === "application/vnd.google-apps.folder") {
					folders[path] = file;
					await this.listRecursive(file.id, path, files, folders);
				} else {
					files[path] = file;
				}
			}
			pageToken = payload.nextPageToken || "";
		} while (pageToken);
	}

	async ensureRootFolder() {
		const query = `name='${this.rootFolderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
		const response = await this.fetchApi(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
			method: "GET"
		});
		if (!response.ok) {
			throw new Error("Google Drive query failed.");
		}
		const payload = await response.json();
		if (payload.files?.length) {
			return payload.files[0].id;
		}
		const create = await this.fetchApi("/files", {
			method: "POST",
			body: JSON.stringify({
				name: this.rootFolderName,
				mimeType: "application/vnd.google-apps.folder"
			})
		});
		if (!create.ok) {
			throw new Error("Failed to create Google Drive Noteel folder.");
		}
		const created = await create.json();
		return created.id;
	}

	async ensureFolderPath(path) {
		const parts = path.split("/").slice(0, -1).filter(Boolean);
		if (parts.length === 0) {
			return await this.ensureRootFolder();
		}
		let parentId = await this.ensureRootFolder();
		for (const part of parts) {
			const query = `name='${part}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
			const response = await this.fetchApi(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
				method: "GET"
			});
			if (!response.ok) {
				throw new Error("Google Drive folder lookup failed.");
			}
			const payload = await response.json();
			if (payload.files?.length) {
				parentId = payload.files[0].id;
				continue;
			}
			const created = await this.fetchApi("/files", {
				method: "POST",
				body: JSON.stringify({
					name: part,
					parents: [parentId],
					mimeType: "application/vnd.google-apps.folder"
				})
			});
			if (!created.ok) {
				throw new Error("Google Drive folder create failed.");
			}
			const data = await created.json();
			parentId = data.id;
		}
		return parentId;
	}

	async fetchApi(path, options) {
		const token = await this.getAccessToken();
		return fetch(`${this.baseUrl}${path}`, {
			...options,
			headers: {
				"Authorization": `Bearer ${token}`,
				"Content-Type": "application/json",
				...(options?.headers || {})
			}
		});
	}

	async fetchUpload(path, options) {
		const token = await this.getAccessToken();
		return fetch(`${this.uploadUrl}${path}`, {
			...options,
			headers: {
				"Authorization": `Bearer ${token}`,
				...(options?.headers || {})
			}
		});
	}
}
