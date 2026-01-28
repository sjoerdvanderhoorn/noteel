import { getTokens, saveTokens } from "../core/auth.js";

export class GitLabAdapter {
	constructor() {
		this.name = "GitLab";
		this.baseUrl = "https://gitlab.com/api/v4";
		this.rootFolderName = "noteel";
	}

	async authenticate() {
		return new Promise((resolve, reject) => {
			// Show dialog for GitLab personal access token
			const dialog = document.createElement('dialog');
			dialog.className = 'gitlab-auth-dialog';
			dialog.innerHTML = `
				<form method="dialog" class="auth-form">
					<h2>Connect to GitLab</h2>
					<p>You'll need a GitLab Personal Access Token with 'api' scope.</p>
					<p><a href="https://gitlab.com/-/profile/personal_access_tokens" target="_blank">Create a token here</a></p>
					<div class="form-group">
						<label for="gitlab-token">Personal Access Token:</label>
						<input type="password" id="gitlab-token" required placeholder="glpat-..." />
					</div>
					<div class="form-group">
						<label for="gitlab-project">Project ID or Path:</label>
						<input type="text" id="gitlab-project" required placeholder="12345678 or username/noteel-notes" />
						<small>Project ID (number) or full path (username/project-name)</small>
					</div>
					<div class="form-group">
						<label for="gitlab-branch">Branch:</label>
						<input type="text" id="gitlab-branch" value="main" placeholder="main" />
					</div>
					<div class="form-actions">
						<button type="button" id="gitlab-cancel">Cancel</button>
						<button type="button" id="gitlab-connect">Connect</button>
					</div>
				</form>
			`;
			
			document.body.appendChild(dialog);
			dialog.showModal();
			
			const tokenInput = dialog.querySelector('#gitlab-token');
			const projectInput = dialog.querySelector('#gitlab-project');
			const branchInput = dialog.querySelector('#gitlab-branch');
			const connectBtn = dialog.querySelector('#gitlab-connect');
			const cancelBtn = dialog.querySelector('#gitlab-cancel');
			
			// Pre-fill with existing credentials if available
			const existing = getTokens('gitlab');
			if (existing) {
				projectInput.value = existing.projectId || '';
				branchInput.value = existing.branch || 'main';
			}
			
			connectBtn.addEventListener('click', async () => {
				const token = tokenInput.value.trim();
				const project = projectInput.value.trim();
				const branch = branchInput.value.trim() || 'main';
				
				if (!token || !project) {
					alert('Token and project are required');
					return;
				}
				
				// Validate token and project
				try {
					const encodedProject = encodeURIComponent(project);
					const testResponse = await fetch(`${this.baseUrl}/projects/${encodedProject}`, {
						headers: {
							'PRIVATE-TOKEN': token
						}
					});
					
					if (!testResponse.ok) {
						throw new Error('Invalid token or project. Please check your credentials.');
					}
					
					const projectData = await testResponse.json();
					
					// Save credentials
					saveTokens('gitlab', {
						token: token,
						projectId: projectData.id.toString(),
						branch: branch
					});
					
					dialog.close();
					document.body.removeChild(dialog);
					resolve();
				} catch (error) {
					alert(error.message || 'Failed to connect to GitLab');
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
		const tokens = getTokens('gitlab');
		
		if (!tokens || !tokens.token || !tokens.projectId) {
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
		const encodedPath = encodeURIComponent(fullPath);
		
		const response = await fetch(
			`${this.baseUrl}/projects/${creds.projectId}/repository/files/${encodedPath}/raw?ref=${creds.branch}`,
			{
				headers: {
					'PRIVATE-TOKEN': creds.token
				}
			}
		);
		
		if (!response.ok) {
			if (response.status === 404) return '';
			throw new Error('GitLab download failed');
		}
		
		return response.text();
	}

	async saveFileContent() {
		const [path, content] = arguments;
		const creds = await this.getCredentials();
		const fullPath = `${this.rootFolderName}/${path}`;
		const encodedPath = encodeURIComponent(fullPath);
		
		// Check if file exists
		let fileExists = false;
		try {
			const existing = await fetch(
				`${this.baseUrl}/projects/${creds.projectId}/repository/files/${encodedPath}?ref=${creds.branch}`,
				{
					headers: {
						'PRIVATE-TOKEN': creds.token
					}
				}
			);
			fileExists = existing.ok;
		} catch (e) {
			// File doesn't exist
		}
		
		// Create or update file
		const action = fileExists ? 'update' : 'create';
		const response = await fetch(
			`${this.baseUrl}/projects/${creds.projectId}/repository/files/${encodedPath}`,
			{
				method: fileExists ? 'PUT' : 'POST',
				headers: {
					'PRIVATE-TOKEN': creds.token,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					branch: creds.branch,
					content: content,
					commit_message: `${action === 'create' ? 'Create' : 'Update'} ${path}`,
					encoding: 'text'
				})
			}
		);
		
		if (!response.ok) {
			throw new Error('GitLab upload failed');
		}
	}

	async deleteFile() {
		const path = arguments[0];
		const creds = await this.getCredentials();
		const fullPath = `${this.rootFolderName}/${path}`;
		const encodedPath = encodeURIComponent(fullPath);
		
		const response = await fetch(
			`${this.baseUrl}/projects/${creds.projectId}/repository/files/${encodedPath}`,
			{
				method: 'DELETE',
				headers: {
					'PRIVATE-TOKEN': creds.token,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					branch: creds.branch,
					commit_message: `Delete ${path}`
				})
			}
		);
		
		if (!response.ok && response.status !== 404) {
			throw new Error('GitLab delete failed');
		}
	}

	async listTree() {
		const creds = await this.getCredentials();
		
		const response = await fetch(
			`${this.baseUrl}/projects/${creds.projectId}/repository/tree?ref=${creds.branch}&recursive=true&per_page=100`,
			{
				headers: {
					'PRIVATE-TOKEN': creds.token
				}
			}
		);
		
		if (!response.ok) {
			if (response.status === 404) {
				// Branch doesn't exist yet, create it with an initial commit
				await this.initializeRepository();
				return [];
			}
			throw new Error('GitLab tree list failed');
		}
		
		const data = await response.json();
		return data || [];
	}

	async initializeRepository() {
		const creds = await this.getCredentials();
		
		// Create initial README
		const content = '# Noteel Notes\n\nThis repository contains your Noteel notes.';
		const encodedPath = encodeURIComponent('README.md');
		
		await fetch(
			`${this.baseUrl}/projects/${creds.projectId}/repository/files/${encodedPath}`,
			{
				method: 'POST',
				headers: {
					'PRIVATE-TOKEN': creds.token,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					branch: creds.branch,
					content: content,
					commit_message: 'Initialize Noteel repository',
					encoding: 'text'
				})
			}
		);
	}
}
