import { OAUTH_CONFIG, getTokens, saveTokens, generateState, generateCodeVerifier, generateCodeChallenge } from "../core/auth.js";

export class DropboxAdapter {
	constructor() {
		this.name = "Dropbox";
		this.baseUrl = "https://api.dropboxapi.com/2";
		this.contentUrl = "https://content.dropboxapi.com/2";
		this.rootFolder = "/Noteel";
	}

	async authenticate() {
		const config = OAUTH_CONFIG.dropbox;
		const state = generateState();
		const codeVerifier = generateCodeVerifier();
		const codeChallenge = await generateCodeChallenge(codeVerifier);
		
		sessionStorage.setItem('oauth_state', state);
		sessionStorage.setItem('oauth_provider', 'dropbox');
		sessionStorage.setItem('pkce_verifier', codeVerifier);

		const params = new URLSearchParams({
			client_id: config.clientId,
			response_type: 'code',
			redirect_uri: config.redirectUri,
			state: state,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256',
			token_access_type: 'offline'
		});

		return new Promise((resolve, reject) => {
			const authWindow = window.open(
				`${config.authEndpoint}?${params.toString()}`,
				'Dropbox Auth',
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

					// Exchange code for token
					if (event.data.code) {
						this.exchangeCodeForToken(event.data.code).then(() => {
							sessionStorage.removeItem('oauth_state');
							sessionStorage.removeItem('oauth_provider');
							resolve();
						}).catch(reject);
					} else if (event.data.accessToken) {
						// Fallback for implicit flow (if still supported)
						saveTokens('dropbox', {
							accessToken: event.data.accessToken,
							expiresAt: Date.now() + (4 * 60 * 60 * 1000)
						});
						sessionStorage.removeItem('oauth_state');
						sessionStorage.removeItem('oauth_provider');
						resolve();
					} else {
						reject(new Error('No code or token received'));
					}
				} else if (event.data.type === 'oauth-error') {
					window.removeEventListener('message', messageHandler);
					reject(new Error(event.data.errorDescription || event.data.error));
				}
			};

			window.addEventListener('message', messageHandler);

			// Check if window was closed
			const checkClosed = setInterval(() => {
				if (authWindow && authWindow.closed) {
					clearInterval(checkClosed);
					window.removeEventListener('message', messageHandler);
					reject(new Error('Authentication window closed'));
				}
			}, 500);
		});
	}

	async exchangeCodeForToken(code) {
		const config = OAUTH_CONFIG.dropbox;
		const codeVerifier = sessionStorage.getItem('pkce_verifier');
		
		if (!codeVerifier) {
			throw new Error('PKCE verifier not found');
		}
		
		const params = new URLSearchParams({
			code: code,
			grant_type: 'authorization_code',
			client_id: config.clientId,
			redirect_uri: config.redirectUri,
			code_verifier: codeVerifier
		});

		const response = await fetch('https://api.dropbox.com/oauth2/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: params.toString()
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Token exchange failed: ${error}`);
		}

		const data = await response.json();
		
		saveTokens('dropbox', {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + (data.expires_in * 1000)
		});
		
		// Clean up PKCE verifier
		sessionStorage.removeItem('pkce_verifier');
	}

	async getAccessToken() {
		const tokens = getTokens('dropbox');
		
		if (!tokens || !tokens.accessToken) {
			await this.authenticate();
			return this.getAccessToken();
		}

		// Check if token is expired
		if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
			await this.authenticate();
			return this.getAccessToken();
		}

		return tokens.accessToken;
	}

	async listFiles() {
		await this.ensureRootFolder();
		const entries = await this.listFolderRecursive(this.rootFolder);
		return entries
			.filter((entry) => entry[".tag"] === "file")
			.map((entry) => this.stripRoot(entry.path_display));
	}

	async listFolders() {
		await this.ensureRootFolder();
		const entries = await this.listFolderRecursive(this.rootFolder);
		return entries
			.filter((entry) => entry[".tag"] === "folder")
			.map((entry) => this.stripRoot(entry.path_display));
	}

	async getFileContent() {
		const path = this.toRootPath(arguments[0]);
		const response = await this.fetchContent("/files/download", {
			method: "POST",
			headers: {
				"Dropbox-API-Arg": JSON.stringify({ path })
			}
		});
		if (!response.ok) {
			throw new Error("Dropbox download failed.");
		}
		return response.text();
	}

	async saveFileContent() {
		const [path, content] = arguments;
		await this.ensureRootFolder();
		const response = await this.fetchContent("/files/upload", {
			method: "POST",
			headers: {
				"Content-Type": "application/octet-stream",
				"Dropbox-API-Arg": JSON.stringify({
					path: this.toRootPath(path),
					mode: "overwrite"
				})
			},
			body: content
		});
		if (!response.ok) {
			throw new Error("Dropbox upload failed.");
		}
	}

	async deleteFile() {
		const path = this.toRootPath(arguments[0]);
		const response = await this.fetchApi("/files/delete_v2", {
			method: "POST",
			body: JSON.stringify({ path })
		});
		if (!response.ok) {
			throw new Error("Dropbox delete failed.");
		}
	}

	async ensureRootFolder() {
		const response = await this.fetchApi("/files/get_metadata", {
			method: "POST",
			body: JSON.stringify({ path: this.rootFolder })
		});
		if (response.ok) {
			return;
		}
		const created = await this.fetchApi("/files/create_folder_v2", {
			method: "POST",
			body: JSON.stringify({ path: this.rootFolder, autorename: false })
		});
		if (!created.ok) {
			throw new Error("Failed to create Dropbox Noteel folder.");
		}
	}

	async listFolderRecursive(path) {
		const entries = [];
		let response = await this.fetchApi("/files/list_folder", {
			method: "POST",
			body: JSON.stringify({ path, recursive: true })
		});
		if (!response.ok) {
			throw new Error("Dropbox list folder failed.");
		}
		let payload = await response.json();
		entries.push(...payload.entries);
		while (payload.has_more) {
			response = await this.fetchApi("/files/list_folder/continue", {
				method: "POST",
				body: JSON.stringify({ cursor: payload.cursor })
			});
			if (!response.ok) {
				throw new Error("Dropbox list folder continue failed.");
			}
			payload = await response.json();
			entries.push(...payload.entries);
		}
		return entries;
	}

	toRootPath(path) {
		const normalized = path.replace(/^\/+/, "");
		return normalized ? `${this.rootFolder}/${normalized}` : this.rootFolder;
	}

	stripRoot(path) {
		return path.replace(this.rootFolder, "").replace(/^\//, "");
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

	async fetchContent(path, options) {
		const token = await this.getAccessToken();
		return fetch(`${this.contentUrl}${path}`, {
			...options,
			headers: {
				"Authorization": `Bearer ${token}`,
				...(options?.headers || {})
			}
		});
	}
}
