import { getTokens, saveTokens } from "../core/auth.js";

// Preset S3-compatible services
const S3_PRESETS = {
	'aws': {
		name: 'Amazon S3',
		endpoint: 'https://s3.{region}.amazonaws.com',
		requiresRegion: true,
		defaultRegion: 'us-east-1'
	},
	'wasabi': {
		name: 'Wasabi',
		endpoint: 'https://s3.{region}.wasabisys.com',
		requiresRegion: true,
		defaultRegion: 'us-east-1'
	},
	'digitalocean': {
		name: 'DigitalOcean Spaces',
		endpoint: 'https://{region}.digitaloceanspaces.com',
		requiresRegion: true,
		defaultRegion: 'nyc3'
	},
	'backblaze': {
		name: 'Backblaze B2',
		endpoint: 'https://s3.{region}.backblazeb2.com',
		requiresRegion: true,
		defaultRegion: 'us-west-001'
	},
	'minio': {
		name: 'MinIO (Self-Hosted)',
		endpoint: '',
		requiresRegion: false,
		defaultRegion: 'us-east-1'
	},
	'custom': {
		name: 'Custom S3-Compatible',
		endpoint: '',
		requiresRegion: false,
		defaultRegion: 'us-east-1'
	}
};

export class S3Adapter {
	constructor() {
		this.name = "S3";
		this.rootFolderName = "noteel";
	}

	async authenticate() {
		return new Promise((resolve, reject) => {
			const dialog = document.createElement('dialog');
			dialog.className = 's3-auth-dialog';
			dialog.innerHTML = `
				<form method="dialog" class="auth-form">
					<h2>Connect to S3 Storage</h2>
					<p>Choose a provider or configure a custom S3-compatible endpoint.</p>
					
					<div class="form-group">
						<label for="s3-provider">Provider:</label>
						<select id="s3-provider">
							<option value="aws">Amazon S3</option>
							<option value="wasabi">Wasabi</option>
							<option value="digitalocean">DigitalOcean Spaces</option>
							<option value="backblaze">Backblaze B2</option>
							<option value="minio">MinIO (Self-Hosted)</option>
							<option value="custom">Custom S3-Compatible</option>
						</select>
					</div>
					
					<div class="form-group" id="s3-endpoint-group" style="display: none;">
						<label for="s3-endpoint">Endpoint URL:</label>
						<input type="url" id="s3-endpoint" placeholder="https://s3.example.com" />
						<small>Full endpoint URL for your S3 service</small>
					</div>
					
					<div class="form-group" id="s3-region-group">
						<label for="s3-region">Region:</label>
						<input type="text" id="s3-region" value="us-east-1" placeholder="us-east-1" />
						<small id="s3-region-help">AWS region or service region</small>
					</div>
					
					<div class="form-group">
						<label for="s3-bucket">Bucket Name:</label>
						<input type="text" id="s3-bucket" required placeholder="my-noteel-bucket" />
					</div>
					
					<div class="form-group">
						<label for="s3-access-key">Access Key ID:</label>
						<input type="text" id="s3-access-key" required placeholder="AKIAIOSFODNN7EXAMPLE" />
					</div>
					
					<div class="form-group">
						<label for="s3-secret-key">Secret Access Key:</label>
						<input type="password" id="s3-secret-key" required placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" />
					</div>
					
					<div class="form-group">
						<label for="s3-prefix">Folder Prefix (optional):</label>
						<input type="text" id="s3-prefix" placeholder="notes/" />
						<small>Optional folder path within bucket</small>
					</div>
					
					<div class="form-actions">
						<button type="button" id="s3-cancel">Cancel</button>
						<button type="button" id="s3-connect">Connect</button>
					</div>
				</form>
			`;
			
			document.body.appendChild(dialog);
			dialog.showModal();
			
			const providerSelect = dialog.querySelector('#s3-provider');
			const endpointGroup = dialog.querySelector('#s3-endpoint-group');
			const endpointInput = dialog.querySelector('#s3-endpoint');
			const regionGroup = dialog.querySelector('#s3-region-group');
			const regionInput = dialog.querySelector('#s3-region');
			const regionHelp = dialog.querySelector('#s3-region-help');
			const bucketInput = dialog.querySelector('#s3-bucket');
			const accessKeyInput = dialog.querySelector('#s3-access-key');
			const secretKeyInput = dialog.querySelector('#s3-secret-key');
			const prefixInput = dialog.querySelector('#s3-prefix');
			const connectBtn = dialog.querySelector('#s3-connect');
			const cancelBtn = dialog.querySelector('#s3-cancel');
			
			// Pre-fill with existing credentials if available
			const existing = getTokens('s3');
			if (existing) {
				providerSelect.value = existing.provider || 'aws';
				endpointInput.value = existing.endpoint || '';
				regionInput.value = existing.region || 'us-east-1';
				bucketInput.value = existing.bucket || '';
				accessKeyInput.value = existing.accessKey || '';
				prefixInput.value = existing.prefix || '';
			}
			
			// Update UI based on provider selection
			const updateProviderUI = () => {
				const provider = providerSelect.value;
				const preset = S3_PRESETS[provider];
				
				if (provider === 'minio' || provider === 'custom') {
					endpointGroup.style.display = 'block';
					endpointInput.required = true;
					regionHelp.textContent = 'Region identifier (often "us-east-1" for compatibility)';
				} else {
					endpointGroup.style.display = 'none';
					endpointInput.required = false;
					
					if (provider === 'aws') {
						regionHelp.textContent = 'AWS region (e.g., us-east-1, eu-west-1, ap-southeast-2)';
					} else if (provider === 'wasabi') {
						regionHelp.textContent = 'Wasabi region (e.g., us-east-1, eu-central-1, ap-northeast-1)';
					} else if (provider === 'digitalocean') {
						regionHelp.textContent = 'Region slug (e.g., nyc3, sfo3, ams3, sgp1)';
					} else if (provider === 'backblaze') {
						regionHelp.textContent = 'Region (e.g., us-west-001, eu-central-003)';
					}
				}
				
				regionInput.value = preset.defaultRegion;
			};
			
			providerSelect.addEventListener('change', updateProviderUI);
			updateProviderUI();
			
			connectBtn.addEventListener('click', async () => {
				const provider = providerSelect.value;
				const bucket = bucketInput.value.trim();
				const accessKey = accessKeyInput.value.trim();
				const secretKey = secretKeyInput.value.trim();
				const region = regionInput.value.trim();
				const prefix = prefixInput.value.trim();
				
				if (!bucket || !accessKey || !secretKey || !region) {
					alert('Bucket, access key, secret key, and region are required');
					return;
				}
				
				let endpoint = '';
				if (provider === 'minio' || provider === 'custom') {
					endpoint = endpointInput.value.trim().replace(/\/$/, '');
					if (!endpoint) {
						alert('Endpoint URL is required for this provider');
						return;
					}
				} else {
					const preset = S3_PRESETS[provider];
					endpoint = preset.endpoint.replace('{region}', region);
				}
				
				// Test connection
				try {
					const testAdapter = new S3Adapter();
					testAdapter.config = {
						provider,
						endpoint,
						region,
						bucket,
						accessKey,
						secretKey,
						prefix
					};
					
					// Try to list bucket (will fail if credentials are wrong)
					await testAdapter.listObjects('');
					
					// Save credentials
					saveTokens('s3', {
						provider,
						endpoint,
						region,
						bucket,
						accessKey,
						secretKey,
						prefix
					});
					
					dialog.close();
					document.body.removeChild(dialog);
					resolve();
				} catch (error) {
					alert(`Connection failed: ${error.message}\n\nPlease check your credentials and bucket permissions.`);
				}
			});
			
			cancelBtn.addEventListener('click', () => {
				dialog.close();
				document.body.removeChild(dialog);
				reject(new Error('Authentication cancelled'));
			});
		});
	}

	async getConfig() {
		if (this.config) return this.config;
		
		const tokens = getTokens('s3');
		
		if (!tokens || !tokens.bucket || !tokens.accessKey || !tokens.secretKey) {
			await this.authenticate();
			return this.getConfig();
		}
		
		this.config = tokens;
		return tokens;
	}

	async listFiles() {
		const entries = await this.listAllObjects();
		return entries
			.filter(e => !e.endsWith('/'))
			.map(e => e.replace(`${this.rootFolderName}/`, ''));
	}

	async listFolders() {
		const entries = await this.listAllObjects();
		const folders = new Set();
		
		entries
			.filter(e => e.startsWith(this.rootFolderName + '/'))
			.forEach(e => {
				const relativePath = e.replace(`${this.rootFolderName}/`, '');
				const parts = relativePath.split('/');
				
				for (let i = 1; i < parts.length; i++) {
					const folderPath = parts.slice(0, i).join('/');
					if (folderPath) folders.add(folderPath);
				}
			});
		
		return Array.from(folders);
	}

	async getFileContent() {
		const path = arguments[0];
		const config = await this.getConfig();
		const key = this.getFullPath(path);
		
		try {
			const url = this.buildUrl(key);
			const headers = await this.signRequest('GET', key, {});
			
			const response = await fetch(url, {
				method: 'GET',
				headers
			});
			
			if (!response.ok) {
				if (response.status === 404) return '';
				throw new Error(`S3 download failed: ${response.status}`);
			}
			
			return response.text();
		} catch (error) {
			if (error.message.includes('404')) return '';
			throw error;
		}
	}

	async saveFileContent() {
		const [path, content] = arguments;
		const config = await this.getConfig();
		const key = this.getFullPath(path);
		
		const url = this.buildUrl(key);
		const headers = await this.signRequest('PUT', key, {
			'Content-Type': 'text/markdown'
		}, content);
		
		const response = await fetch(url, {
			method: 'PUT',
			headers,
			body: content
		});
		
		if (!response.ok) {
			throw new Error(`S3 upload failed: ${response.status}`);
		}
	}

	async deleteFile() {
		const path = arguments[0];
		const config = await this.getConfig();
		const key = this.getFullPath(path);
		
		const url = this.buildUrl(key);
		const headers = await this.signRequest('DELETE', key, {});
		
		const response = await fetch(url, {
			method: 'DELETE',
			headers
		});
		
		if (!response.ok && response.status !== 404) {
			throw new Error(`S3 delete failed: ${response.status}`);
		}
	}

	async listAllObjects() {
		const config = await this.getConfig();
		const prefix = config.prefix ? `${config.prefix}${this.rootFolderName}/` : `${this.rootFolderName}/`;
		
		return this.listObjects(prefix);
	}

	async listObjects(prefix) {
		const config = await this.getConfig();
		const keys = [];
		let continuationToken = null;
		
		do {
			const params = new URLSearchParams({
				'list-type': '2',
				'prefix': prefix
			});
			
			if (continuationToken) {
				params.append('continuation-token', continuationToken);
			}
			
			const url = this.buildUrl('', params);
			const headers = await this.signRequest('GET', '', {}, null, params);
			
			const response = await fetch(url, {
				method: 'GET',
				headers
			});
			
			if (!response.ok) {
				throw new Error(`S3 list failed: ${response.status} ${response.statusText}`);
			}
			
			const text = await response.text();
			const parser = new DOMParser();
			const xml = parser.parseFromString(text, 'text/xml');
			
			// Get all keys
			const contents = xml.getElementsByTagName('Contents');
			for (const content of contents) {
				const keyElement = content.getElementsByTagName('Key')[0];
				if (keyElement) {
					let key = keyElement.textContent;
					// Remove prefix if present
					if (config.prefix && key.startsWith(config.prefix)) {
						key = key.substring(config.prefix.length);
					}
					keys.push(key);
				}
			}
			
			// Check for continuation
			const isTruncated = xml.getElementsByTagName('IsTruncated')[0];
			if (isTruncated && isTruncated.textContent === 'true') {
				const nextToken = xml.getElementsByTagName('NextContinuationToken')[0];
				continuationToken = nextToken ? nextToken.textContent : null;
			} else {
				continuationToken = null;
			}
		} while (continuationToken);
		
		return keys;
	}

	getFullPath(path) {
		const config = this.config;
		const normalized = path.replace(/^\/+/, '');
		const fullPath = `${this.rootFolderName}/${normalized}`;
		return config.prefix ? `${config.prefix}${fullPath}` : fullPath;
	}

	buildUrl(key, params = null) {
		const config = this.config;
		const encodedKey = key.split('/').map(encodeURIComponent).join('/');
		let url = `${config.endpoint}/${config.bucket}/${encodedKey}`;
		if (params) {
			url += '?' + params.toString();
		}
		return url;
	}

	async signRequest(method, key, extraHeaders = {}, body = null, params = null) {
		const config = this.config;
		const now = new Date();
		const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
		const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
		
		// Canonical URI
		const canonicalUri = '/' + config.bucket + '/' + key.split('/').map(encodeURIComponent).join('/');
		
		// Canonical query string
		const canonicalQuerystring = params ? params.toString() : '';
		
		// Canonical headers
		const host = new URL(config.endpoint).host;
		const headers = {
			'host': host,
			'x-amz-date': amzDate,
			...extraHeaders
		};
		
		if (body) {
			headers['content-type'] = headers['content-type'] || 'text/markdown';
		}
		
		const canonicalHeaders = Object.keys(headers)
			.sort()
			.map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
			.join('\n') + '\n';
		
		const signedHeaders = Object.keys(headers)
			.sort()
			.map(key => key.toLowerCase())
			.join(';');
		
		// Payload hash
		const payloadHash = body ? await this.sha256(body) : await this.sha256('');
		headers['x-amz-content-sha256'] = payloadHash;
		
		// Canonical request
		const canonicalRequest = [
			method,
			canonicalUri,
			canonicalQuerystring,
			canonicalHeaders,
			signedHeaders,
			payloadHash
		].join('\n');
		
		// String to sign
		const algorithm = 'AWS4-HMAC-SHA256';
		const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
		const canonicalRequestHash = await this.sha256(canonicalRequest);
		const stringToSign = [
			algorithm,
			amzDate,
			credentialScope,
			canonicalRequestHash
		].join('\n');
		
		// Signing key
		const signingKey = await this.getSignatureKey(config.secretKey, dateStamp, config.region, 's3');
		
		// Signature
		const signature = await this.hmacSha256Hex(signingKey, stringToSign);
		
		// Authorization header
		const authorizationHeader = `${algorithm} Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
		
		return {
			'Authorization': authorizationHeader,
			'x-amz-date': amzDate,
			'x-amz-content-sha256': payloadHash,
			...extraHeaders
		};
	}

	async sha256(message) {
		const encoder = new TextEncoder();
		const data = encoder.encode(message);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	}

	async hmacSha256(key, message) {
		const encoder = new TextEncoder();
		const keyData = typeof key === 'string' ? encoder.encode(key) : key;
		const messageData = encoder.encode(message);
		
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			keyData,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		
		return await crypto.subtle.sign('HMAC', cryptoKey, messageData);
	}

	async hmacSha256Hex(key, message) {
		const signature = await this.hmacSha256(key, message);
		const hashArray = Array.from(new Uint8Array(signature));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	}

	async getSignatureKey(key, dateStamp, regionName, serviceName) {
		const kDate = await this.hmacSha256('AWS4' + key, dateStamp);
		const kRegion = await this.hmacSha256(kDate, regionName);
		const kService = await this.hmacSha256(kRegion, serviceName);
		const kSigning = await this.hmacSha256(kService, 'aws4_request');
		return kSigning;
	}
}
