import { OAUTH_CONFIG, getTokens, saveTokens, generateState } from "../core/auth.js";

export class OneDriveAdapter {
	constructor() {
		this.name = "OneDrive";
		this.baseUrl = "https://graph.microsoft.com/v1.0";
		this.rootFolderName = "Noteel";
	}

	async authenticate() {
		const config = OAUTH_CONFIG.onedrive;
		const state = generateState();
		sessionStorage.setItem('oauth_state', state);
		sessionStorage.setItem('oauth_provider', 'onedrive');

		const params = new URLSearchParams({
			client_id: config.clientId,
			response_type: 'token',
			redirect_uri: config.redirectUri,
			scope: config.scopes.join(' '),
			state: state,
			response_mode: 'fragment'
		});

		return new Promise((resolve, reject) => {
			const authWindow = window.open(
				`${config.authority}/oauth2/v2.0/authorize?${params.toString()}`,
				'OneDrive Auth',
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

					saveTokens('onedrive', {
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
		const tokens = getTokens('onedrive');
		
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
		const rootId = await this.ensureRootFolder();
		const items = await this.listChildrenRecursive(rootId, "");
		return items.filter((item) => item.type === "file").map((item) => item.path);
	}

	async listFolders() {
		const rootId = await this.ensureRootFolder();
		const items = await this.listChildrenRecursive(rootId, "");
		return items.filter((item) => item.type === "folder").map((item) => item.path);
	}

	async getFileContent() {
		const path = this.toRootPath(arguments[0]);
		const response = await this.fetchApi(`/me/drive/root:${path}:/content`, {
			method: "GET"
		});
		if (!response.ok) {
			throw new Error("OneDrive download failed.");
		}
		return response.text();
	}

	async saveFileContent() {
		const [path, content] = arguments;
		await this.ensureFolderPath(path);
		const response = await this.fetchApi(`/me/drive/root:${this.toRootPath(path)}:/content`, {
			method: "PUT",
			headers: {
				"Content-Type": "text/markdown"
			},
			body: content
		});
		if (!response.ok) {
			throw new Error("OneDrive upload failed.");
		}
	}

	async deleteFile() {
		const path = this.toRootPath(arguments[0]);
		const response = await this.fetchApi(`/me/drive/root:${path}`, {
			method: "DELETE"
		});
		if (!response.ok) {
			throw new Error("OneDrive delete failed.");
		}
	}

	async ensureRootFolder() {
		const response = await this.fetchApi(`/me/drive/root:/${this.rootFolderName}`, {
			method: "GET"
		});
		if (response.ok) {
			const data = await response.json();
			return data.id;
		}

		const create = await this.fetchApi("/me/drive/root/children", {
			method: "POST",
			body: JSON.stringify({
				name: this.rootFolderName,
				folder: {},
				"@microsoft.graph.conflictBehavior": "fail"
			})
		});
		if (!create.ok) {
			throw new Error("Failed to create OneDrive Noteel folder.");
		}
		const created = await create.json();
		return created.id;
	}

	async listChildrenRecursive(parentId, parentPath) {
		const response = await this.fetchApi(`/me/drive/items/${parentId}/children?$select=id,name,folder,file`, {
			method: "GET"
		});
		if (!response.ok) {
			throw new Error("OneDrive list failed.");
		}
		const payload = await response.json();
		const items = [];
		for (const entry of payload.value || []) {
			const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
			if (entry.folder) {
				items.push({ type: "folder", path, id: entry.id });
				const children = await this.listChildrenRecursive(entry.id, path);
				items.push(...children);
			} else if (entry.file) {
				items.push({ type: "file", path, id: entry.id });
			}
		}
		return items;
	}

	async ensureFolderPath(path) {
		const parts = path.split("/").slice(0, -1).filter(Boolean);
		if (parts.length === 0) {
			await this.ensureRootFolder();
			return;
		}
		let parentId = await this.ensureRootFolder();
		let currentPath = "";
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const existing = await this.findChildFolder(parentId, part);
			if (existing) {
				parentId = existing.id;
				continue;
			}
			const created = await this.fetchApi(`/me/drive/items/${parentId}/children`, {
				method: "POST",
				body: JSON.stringify({
					name: part,
					folder: {},
					"@microsoft.graph.conflictBehavior": "fail"
				})
			});
			if (!created.ok) {
				throw new Error(`Failed to create OneDrive folder ${currentPath}.`);
			}
			const data = await created.json();
			parentId = data.id;
		}
	}

	async findChildFolder(parentId, name) {
		const response = await this.fetchApi(`/me/drive/items/${parentId}/children?$select=id,name,folder`, {
			method: "GET"
		});
		if (!response.ok) {
			return null;
		}
		const payload = await response.json();
		return (payload.value || []).find((item) => item.folder && item.name === name) || null;
	}

	toRootPath(path) {
		const normalized = path.replace(/^\/+/, "");
		return `/${this.rootFolderName}/${normalized}`.replace(/\/\/$/, "");
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
}
