import { getTokens, saveTokens } from "../core/auth.js";

export class WebDAVAdapter {
	constructor() {
		this.name = "WebDAV";
		this.rootFolderName = "Noteel";
	}

	async authenticate() {
		return new Promise((resolve, reject) => {
			// Show custom dialog for WebDAV credentials
			const dialog = document.createElement('dialog');
			dialog.className = 'webdav-auth-dialog';
			dialog.innerHTML = `
				<form method="dialog" class="auth-form">
					<h2>Connect to WebDAV</h2>
					<div class="form-group">
						<label for="webdav-url">Server URL:</label>
						<input type="url" id="webdav-url" required placeholder="https://example.com/webdav" />
					</div>
					<div class="form-group">
						<label for="webdav-username">Username:</label>
						<input type="text" id="webdav-username" required />
					</div>
					<div class="form-group">
						<label for="webdav-password">Password:</label>
						<input type="password" id="webdav-password" required />
					</div>
					<div class="form-actions">
						<button type="button" id="webdav-cancel">Cancel</button>
						<button type="button" id="webdav-connect">Connect</button>
					</div>
				</form>
			`;
			
			document.body.appendChild(dialog);
			dialog.showModal();
			
			const urlInput = dialog.querySelector('#webdav-url');
			const usernameInput = dialog.querySelector('#webdav-username');
			const passwordInput = dialog.querySelector('#webdav-password');
			const connectBtn = dialog.querySelector('#webdav-connect');
			const cancelBtn = dialog.querySelector('#webdav-cancel');
			
			// Pre-fill with existing credentials if available
			const existing = getTokens('webdav');
			if (existing) {
				urlInput.value = existing.url || '';
				usernameInput.value = existing.username || '';
			}
			
			connectBtn.addEventListener('click', async () => {
				const url = urlInput.value.trim().replace(/\/$/, '');
				const username = usernameInput.value.trim();
				const password = passwordInput.value;
				
				if (!url || !username || !password) {
					alert('All fields are required');
					return;
				}
				
				// Test connection
				try {
					const testResponse = await fetch(url, {
						method: 'PROPFIND',
						headers: {
							'Authorization': 'Basic ' + btoa(username + ':' + password),
							'Depth': '0'
						}
					});
					
					if (!testResponse.ok) {
						throw new Error('Connection failed. Please check your credentials.');
					}
					
					// Save credentials
					saveTokens('webdav', {
						url: url,
						username: username,
						password: password // In production, consider more secure storage
					});
					
					dialog.close();
					document.body.removeChild(dialog);
					resolve();
				} catch (error) {
					alert(error.message || 'Failed to connect to WebDAV server');
				}
			});
			
			cancelBtn.addEventListener('click', () => {
				dialog.close();
				document.body.removeChild(dialog);
				reject(new Error('Authentication cancelled'));
			});
		});
	}

	async getCredentials() {
		const tokens = getTokens('webdav');
		
		if (!tokens || !tokens.url || !tokens.username || !tokens.password) {
			await this.authenticate();
			return this.getCredentials();
		}
		
		return tokens;
	}

	async listFiles() {
		await this.ensureRootFolder();
		const entries = await this.listRecursive(this.getRootPath());
		return entries
			.filter(e => e.type === 'file')
			.map(e => this.stripRoot(e.path));
	}

	async listFolders() {
		await this.ensureRootFolder();
		const entries = await this.listRecursive(this.getRootPath());
		return entries
			.filter(e => e.type === 'folder')
			.map(e => this.stripRoot(e.path));
	}

	async getFileContent() {
		const path = arguments[0];
		const creds = await this.getCredentials();
		const fullPath = this.toRootPath(path);
		
		const response = await fetch(`${creds.url}${fullPath}`, {
			method: 'GET',
			headers: {
				'Authorization': 'Basic ' + btoa(creds.username + ':' + creds.password)
			}
		});
		
		if (!response.ok) {
			if (response.status === 404) return '';
			throw new Error('WebDAV download failed');
		}
		
		return response.text();
	}

	async saveFileContent() {
		const [path, content] = arguments;
		await this.ensureFolderPath(path);
		const creds = await this.getCredentials();
		const fullPath = this.toRootPath(path);
		
		const response = await fetch(`${creds.url}${fullPath}`, {
			method: 'PUT',
			headers: {
				'Authorization': 'Basic ' + btoa(creds.username + ':' + creds.password),
				'Content-Type': 'text/markdown'
			},
			body: content
		});
		
		if (!response.ok) {
			throw new Error('WebDAV upload failed');
		}
	}

	async deleteFile() {
		const path = arguments[0];
		const creds = await this.getCredentials();
		const fullPath = this.toRootPath(path);
		
		const response = await fetch(`${creds.url}${fullPath}`, {
			method: 'DELETE',
			headers: {
				'Authorization': 'Basic ' + btoa(creds.username + ':' + creds.password)
			}
		});
		
		if (!response.ok && response.status !== 404) {
			throw new Error('WebDAV delete failed');
		}
	}

	async ensureRootFolder() {
		const creds = await this.getCredentials();
		const rootPath = this.getRootPath();
		
		// Check if folder exists
		const response = await fetch(`${creds.url}${rootPath}`, {
			method: 'PROPFIND',
			headers: {
				'Authorization': 'Basic ' + btoa(creds.username + ':' + creds.password),
				'Depth': '0'
			}
		});
		
		if (response.ok) return;
		
		// Create folder
		const createResponse = await fetch(`${creds.url}${rootPath}`, {
			method: 'MKCOL',
			headers: {
				'Authorization': 'Basic ' + btoa(creds.username + ':' + creds.password)
			}
		});
		
		if (!createResponse.ok) {
			throw new Error('Failed to create WebDAV Noteel folder');
		}
	}

	async ensureFolderPath(filePath) {
		const parts = filePath.split('/').slice(0, -1).filter(Boolean);
		if (parts.length === 0) {
			await this.ensureRootFolder();
			return;
		}
		
		const creds = await this.getCredentials();
		let currentPath = this.getRootPath();
		
		for (const part of parts) {
			currentPath += '/' + part;
			
			// Check if folder exists
			const response = await fetch(`${creds.url}${currentPath}`, {
				method: 'PROPFIND',
				headers: {
					'Authorization': 'Basic ' + btoa(creds.username + ':' + creds.password),
					'Depth': '0'
				}
			});
			
			if (response.ok) continue;
			
			// Create folder
			const createResponse = await fetch(`${creds.url}${currentPath}`, {
				method: 'MKCOL',
				headers: {
					'Authorization': 'Basic ' + btoa(creds.username + ':' + creds.password)
				}
			});
			
			if (!createResponse.ok) {
				throw new Error(`Failed to create WebDAV folder: ${currentPath}`);
			}
		}
	}

	async listRecursive(path) {
		const creds = await this.getCredentials();
		const response = await fetch(`${creds.url}${path}`, {
			method: 'PROPFIND',
			headers: {
				'Authorization': 'Basic ' + btoa(creds.username + ':' + creds.password),
				'Depth': 'infinity',
				'Content-Type': 'application/xml'
			},
			body: `<?xml version="1.0"?>
				<d:propfind xmlns:d="DAV:">
					<d:prop>
						<d:resourcetype/>
					</d:prop>
				</d:propfind>`
		});
		
		if (!response.ok) {
			throw new Error('WebDAV list failed');
		}
		
		const text = await response.text();
		const parser = new DOMParser();
		const xml = parser.parseFromString(text, 'text/xml');
		const entries = [];
		
		const responses = xml.getElementsByTagNameNS('DAV:', 'response');
		for (const resp of responses) {
			const href = resp.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent;
			if (!href) continue;
			
			// Decode URI and get path
			const decodedPath = decodeURIComponent(href);
			if (decodedPath === path || decodedPath === path + '/') continue;
			
			const resourceType = resp.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
			const isCollection = resourceType?.getElementsByTagNameNS('DAV:', 'collection').length > 0;
			
			entries.push({
				path: decodedPath,
				type: isCollection ? 'folder' : 'file'
			});
		}
		
		return entries;
	}

	getRootPath() {
		return `/${this.rootFolderName}`;
	}

	toRootPath(path) {
		const normalized = path.replace(/^\/+/, '');
		return `${this.getRootPath()}/${normalized}`;
	}

	stripRoot(path) {
		const rootPath = this.getRootPath();
		return path.replace(rootPath, '').replace(/^\//, '');
	}
}
