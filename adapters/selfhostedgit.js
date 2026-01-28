import { getTokens, saveTokens } from "../core/auth.js";

export class SelfHostedGitAdapter {
	constructor() {
		this.name = "Self-Hosted Git";
		this.rootFolderName = "noteel";
	}

	async authenticate() {
		return new Promise((resolve, reject) => {
			// Show dialog for self-hosted Git credentials
			const dialog = document.createElement('dialog');
			dialog.className = 'selfhostedgit-auth-dialog';
			dialog.innerHTML = `
				<form method="dialog" class="auth-form">
					<h2>Connect to Self-Hosted Git</h2>
					<p>Connect to Gitea, Gogs, or other Git hosting platforms with compatible APIs.</p>
					<div class="form-group">
						<label for="git-url">API Base URL:</label>
						<input type="url" id="git-url" required placeholder="https://git.example.com/api/v1" />
						<small>For Gitea/Gogs: https://your-domain.com/api/v1</small>
					</div>
					<div class="form-group">
						<label for="git-token">Access Token:</label>
						<input type="password" id="git-token" required />
						<small>Generate in your Git server's settings</small>
					</div>
					<div class="form-group">
						<label for="git-owner">Repository Owner:</label>
						<input type="text" id="git-owner" required placeholder="username or org" />
					</div>
					<div class="form-group">
						<label for="git-repo">Repository Name:</label>
						<input type="text" id="git-repo" required placeholder="noteel-notes" />
					</div>
					<div class="form-group">
						<label for="git-branch">Branch:</label>
						<input type="text" id="git-branch" value="main" placeholder="main" />
					</div>
					<div class="form-actions">
						<button type="button" id="git-cancel">Cancel</button>
						<button type="button" id="git-connect">Connect</button>
					</div>
				</form>
			`;
			
			document.body.appendChild(dialog);
			dialog.showModal();
			
			const urlInput = dialog.querySelector('#git-url');
			const tokenInput = dialog.querySelector('#git-token');
			const ownerInput = dialog.querySelector('#git-owner');
			const repoInput = dialog.querySelector('#git-repo');
			const branchInput = dialog.querySelector('#git-branch');
			const connectBtn = dialog.querySelector('#git-connect');
			const cancelBtn = dialog.querySelector('#git-cancel');
			
			// Pre-fill with existing credentials if available
			const existing = getTokens('selfhostedgit');
			if (existing) {
				urlInput.value = existing.baseUrl || '';
				ownerInput.value = existing.owner || '';
				repoInput.value = existing.repo || '';
				branchInput.value = existing.branch || 'main';
			}
			
			connectBtn.addEventListener('click', async () => {
				const baseUrl = urlInput.value.trim().replace(/\/$/, '');
				const token = tokenInput.value.trim();
				const owner = ownerInput.value.trim();
				const repo = repoInput.value.trim();
				const branch = branchInput.value.trim() || 'main';
				
				if (!baseUrl || !token || !owner || !repo) {
					alert('All fields except branch are required');
					return;
				}
				
				// Validate connection
				try {
					const testResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}`, {
						headers: {
							'Authorization': `token ${token}`,
							'Accept': 'application/json'
						}
					});
					
					if (!testResponse.ok) {
						throw new Error('Invalid credentials or repository. Please check your settings.');
					}
					
					// Save credentials
					saveTokens('selfhostedgit', {
						baseUrl: baseUrl,
						token: token,
						owner: owner,
						repo: repo,
						branch: branch
					});
					
					dialog.close();
					document.body.removeChild(dialog);
					resolve();
				} catch (error) {
					alert(error.message || 'Failed to connect to Git server');
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
		const tokens = getTokens('selfhostedgit');
		
		if (!tokens || !tokens.baseUrl || !tokens.token || !tokens.owner || !tokens.repo) {
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
			`${creds.baseUrl}/repos/${creds.owner}/${creds.repo}/contents/${fullPath}?ref=${creds.branch}`,
			{
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/json'
				}
			}
		);
		
		if (!response.ok) {
			if (response.status === 404) return '';
			throw new Error('Git download failed');
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
				`${creds.baseUrl}/repos/${creds.owner}/${creds.repo}/contents/${fullPath}?ref=${creds.branch}`,
				{
					headers: {
						'Authorization': `token ${creds.token}`,
						'Accept': 'application/json'
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
			`${creds.baseUrl}/repos/${creds.owner}/${creds.repo}/contents/${fullPath}`,
			{
				method: sha ? 'PUT' : 'POST',
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: `${sha ? 'Update' : 'Create'} ${path}`,
					content: btoa(unescape(encodeURIComponent(content))),
					branch: creds.branch,
					...(sha ? { sha } : {})
				})
			}
		);
		
		if (!response.ok) {
			throw new Error('Git upload failed');
		}
	}

	async deleteFile() {
		const path = arguments[0];
		const creds = await this.getCredentials();
		const fullPath = `${this.rootFolderName}/${path}`;
		
		// Get file SHA
		const existing = await fetch(
			`${creds.baseUrl}/repos/${creds.owner}/${creds.repo}/contents/${fullPath}?ref=${creds.branch}`,
			{
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/json'
				}
			}
		);
		
		if (!existing.ok) return; // File doesn't exist
		
		const data = await existing.json();
		
		const response = await fetch(
			`${creds.baseUrl}/repos/${creds.owner}/${creds.repo}/contents/${fullPath}`,
			{
				method: 'DELETE',
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/json',
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
			throw new Error('Git delete failed');
		}
	}

	async listTree() {
		const creds = await this.getCredentials();
		
		// Get branch info
		const branchResponse = await fetch(
			`${creds.baseUrl}/repos/${creds.owner}/${creds.repo}/branches/${creds.branch}`,
			{
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/json'
				}
			}
		);
		
		if (!branchResponse.ok) {
			// Branch doesn't exist yet, create it with an initial commit
			await this.initializeRepository();
			return [];
		}
		
		const branchData = await branchResponse.json();
		const commitSha = branchData.commit.id;
		
		// Get tree
		const response = await fetch(
			`${creds.baseUrl}/repos/${creds.owner}/${creds.repo}/git/trees/${commitSha}?recursive=1`,
			{
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/json'
				}
			}
		);
		
		if (!response.ok) {
			throw new Error('Git tree list failed');
		}
		
		const data = await response.json();
		return data.tree || [];
	}

	async initializeRepository() {
		const creds = await this.getCredentials();
		
		// Create initial README
		const content = '# Noteel Notes\n\nThis repository contains your Noteel notes.';
		
		await fetch(
			`${creds.baseUrl}/repos/${creds.owner}/${creds.repo}/contents/README.md`,
			{
				method: 'POST',
				headers: {
					'Authorization': `token ${creds.token}`,
					'Accept': 'application/json',
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
