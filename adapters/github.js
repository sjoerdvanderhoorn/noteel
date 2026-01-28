import { getTokens, saveTokens } from "../core/auth.js";

export class GitHubAdapter {
	constructor() {
		this.name = "GitHub";
		this.baseUrl = "https://api.github.com";
		this.rootFolderName = "noteel";
	}

	async authenticate() {
		return new Promise((resolve, reject) => {
			// Show dialog for GitHub personal access token
			const dialog = document.createElement('dialog');
			dialog.className = 'github-auth-dialog';
			dialog.innerHTML = `
				<form method="dialog" class="auth-form">
					<h2>Connect to GitHub</h2>
					<p>You'll need a GitHub Personal Access Token with 'repo' scope.</p>
					<p><a href="https://github.com/settings/tokens/new?scopes=repo&description=Noteel" target="_blank">Create a token here</a></p>
					<div class="form-group">
						<label for="github-token">Personal Access Token:</label>
						<input type="password" id="github-token" required placeholder="ghp_..." />
					</div>
					<div class="form-group">
						<label for="github-repo">Repository (username/repo):</label>
						<input type="text" id="github-repo" required placeholder="username/noteel-notes" />
					</div>
					<div class="form-group">
						<label for="github-branch">Branch:</label>
						<input type="text" id="github-branch" value="main" placeholder="main" />
					</div>
					<div class="form-actions">
						<button type="button" id="github-cancel">Cancel</button>
						<button type="button" id="github-connect">Connect</button>
					</div>
				</form>
			`;
			
			document.body.appendChild(dialog);
			dialog.showModal();
			
			const tokenInput = dialog.querySelector('#github-token');
			const repoInput = dialog.querySelector('#github-repo');
			const branchInput = dialog.querySelector('#github-branch');
			const connectBtn = dialog.querySelector('#github-connect');
			const cancelBtn = dialog.querySelector('#github-cancel');
			
			// Pre-fill with existing credentials if available
			const existing = getTokens('github');
			if (existing) {
				repoInput.value = existing.repo || '';
				branchInput.value = existing.branch || 'main';
			}
			
			connectBtn.addEventListener('click', async () => {
				const token = tokenInput.value.trim();
				const repo = repoInput.value.trim();
				const branch = branchInput.value.trim() || 'main';
				
				if (!token || !repo) {
					alert('Token and repository are required');
					return;
				}
				
				// Validate token and repo
				try {
					const testResponse = await fetch(`${this.baseUrl}/repos/${repo}`, {
						headers: {
							'Authorization': `token ${token}`,
							'Accept': 'application/vnd.github.v3+json'
						}
					});
					
					if (!testResponse.ok) {
						throw new Error('Invalid token or repository. Please check your credentials.');
					}
					
					// Save credentials
					saveTokens('github', {
						token: token,
						repo: repo,
						branch: branch
					});
					
					dialog.close();
					document.body.removeChild(dialog);
					resolve();
				} catch (error) {
					alert(error.message || 'Failed to connect to GitHub');
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
		const tokens = getTokens('github');
		
		if (!tokens || !tokens.token || !tokens.repo) {
			await this.authenticate();
			return this.getCredentials();
		}
		
		return tokens;
	}

	async listFiles() {
		const entries = await this.listTree();
		return entries
			.filter(e => e.type === 'blob' && e.path.startsWith(this.rootFolderName + '/'))
			.map(e => e.path.replace(this.rootFolderName + '/', ''));
	}

	async listFolders() {
		const entries = await this.listTree();
		const folders = new Set();
		
		entries
			.filter(e => e.path.startsWith(this.rootFolderName + '/'))
			.forEach(e => {
				const relativePath = e.path.replace(this.rootFolderName + '/', '');
				const parts = relativePath.split('/');
				
				// Add all parent folders
				for (let i = 1; i < parts.length; i++) {
					folders.add(parts.slice(0, i).join('/'));
				}
			});
		
		return Array.from(folders);
	}

	async getFileContent() {
		const path = arguments[0];
		const creds = await this.getCredentials();
		const fullPath = `${this.rootFolderName}/${path}`;
		
		const response = await fetch(
			`${this.baseUrl}/repos/${creds.repo}/contents/${fullPath}?ref=${creds.branch}`,
			{
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/vnd.github.v3+json'
				}
			}
		);
		
		if (!response.ok) {
			if (response.status === 404) return '';
			throw new Error('GitHub download failed');
		}
		
		const data = await response.json();
		// Decode base64 content
		return atob(data.content);
	}

	async saveFileContent() {
		const [path, content] = arguments;
		const creds = await this.getCredentials();
		const fullPath = `${this.rootFolderName}/${path}`;
		
		// Get current file SHA if it exists
		let sha = null;
		try {
			const existing = await fetch(
				`${this.baseUrl}/repos/${creds.repo}/contents/${fullPath}?ref=${creds.branch}`,
				{
					headers: {
						'Authorization': `token ${creds.token}`,
						'Accept': 'application/vnd.github.v3+json'
					}
				}
			);
			
			if (existing.ok) {
				const data = await existing.json();
				sha = data.sha;
			}
		} catch (e) {
			// File doesn't exist, that's fine
		}
		
		// Create or update file
		const response = await fetch(
			`${this.baseUrl}/repos/${creds.repo}/contents/${fullPath}`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/vnd.github.v3+json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: `Update ${path}`,
					content: btoa(unescape(encodeURIComponent(content))),
					branch: creds.branch,
					...(sha ? { sha } : {})
				})
			}
		);
		
		if (!response.ok) {
			throw new Error('GitHub upload failed');
		}
	}

	async deleteFile() {
		const path = arguments[0];
		const creds = await this.getCredentials();
		const fullPath = `${this.rootFolderName}/${path}`;
		
		// Get file SHA
		const existing = await fetch(
			`${this.baseUrl}/repos/${creds.repo}/contents/${fullPath}?ref=${creds.branch}`,
			{
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/vnd.github.v3+json'
				}
			}
		);
		
		if (!existing.ok) return; // File doesn't exist
		
		const data = await existing.json();
		
		const response = await fetch(
			`${this.baseUrl}/repos/${creds.repo}/contents/${fullPath}`,
			{
				method: 'DELETE',
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/vnd.github.v3+json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: `Delete ${path}`,
					sha: data.sha,
					branch: creds.branch
				})
			}
		);
		
		if (!response.ok) {
			throw new Error('GitHub delete failed');
		}
	}

	async listTree() {
		const creds = await this.getCredentials();
		
		// Get latest commit SHA
		const branchResponse = await fetch(
			`${this.baseUrl}/repos/${creds.repo}/git/ref/heads/${creds.branch}`,
			{
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/vnd.github.v3+json'
				}
			}
		);
		
		if (!branchResponse.ok) {
			// Branch doesn't exist yet, create it with an initial commit
			await this.initializeRepository();
			return [];
		}
		
		const branchData = await branchResponse.json();
		const commitSha = branchData.object.sha;
		
		// Get tree
		const response = await fetch(
			`${this.baseUrl}/repos/${creds.repo}/git/trees/${commitSha}?recursive=1`,
			{
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/vnd.github.v3+json'
				}
			}
		);
		
		if (!response.ok) {
			throw new Error('GitHub tree list failed');
		}
		
		const data = await response.json();
		return data.tree || [];
	}

	async initializeRepository() {
		const creds = await this.getCredentials();
		
		// Create initial README
		const content = '# Noteel Notes\n\nThis repository contains your Noteel notes.';
		
		await fetch(
			`${this.baseUrl}/repos/${creds.repo}/contents/README.md`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/vnd.github.v3+json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: 'Initialize Noteel repository',
					content: btoa(content),
					branch: creds.branch
				})
			}
		);
	}
}
