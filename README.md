# Noteel

**A modern, offline-first Progressive Web App for beautiful Markdown note-taking with cloud sync.**

🌐 **[Try it now at noteel.com](https://noteel.com)**

Noteel is a lightweight, privacy-focused note-taking application that stores your notes as plain Markdown files. Work offline seamlessly and sync across devices using your preferred cloud storage provider. With a clean interface, powerful organization features, and extensibility through plugins and themes, Noteel puts you in control of your notes.

## ✨ Key Features

- **📝 Markdown-First**: Write in Markdown with a rich WYSIWYG editor powered by Milkdown
- **🔌 Offline-First**: Full functionality without internet connection, with automatic sync when online
- **☁️ Multi-Cloud Sync**: Choose from Dropbox, OneDrive, Google Drive, or keep notes local
- **📱 Progressive Web App**: Install on any device, works like a native app
- **🎨 Customizable**: Themes and extensions to personalize your experience
- **🗂️ Smart Organization**: Folders, search, and multiple view modes (list/masonry)
- **✅ Task Lists**: Built-in checkbox support for to-do lists
- **🔒 Privacy-Focused**: Your notes, your storage, your data
- **📦 Plain Files**: Notes stored as `.md` files - no vendor lock-in
- **🎯 Lightweight**: No build step, minimal dependencies

## 🚀 Getting Started

### Try It Online

Visit **[noteel.com](https://noteel.com)** and start taking notes immediately! The app runs entirely in your browser.

### Choose Your Storage

On first launch, select your preferred storage option:
- **🏠 Local Storage**: Notes saved in browser (no cloud sync)
- **📦 Dropbox**: Sync with your Dropbox account
- **📘 OneDrive**: Sync with Microsoft OneDrive  
- **📗 Google Drive**: Sync with Google Drive
- **⏸️ Decide Later**: Start with local storage, choose later

## 📖 How It Works

### Note Organization

- **Folders**: Organize notes into hierarchical folders
- **Markdown Files**: Each note is a plain `.md` file
- **View Modes**: Switch between list view and masonry grid view per folder
- **Soft Delete**: Prefix files with `~` to soft-delete (easily restore later)
- **Search**: Powerful search across all notes and content

### Rich Editing

The editor supports:
- **Headers**: H1-H6 headings
- **Formatting**: Bold, italic, underline, strikethrough, highlight
- **Lists**: Bullet lists, numbered lists, and task lists with checkboxes
- **Code**: Inline code and code blocks
- **Quotes**: Block quotes for emphasis
- **Live Preview**: See formatted output as you type

### Folder Configuration

Each folder can contain a `.noteel` file with folder-specific settings:
```json
{
  "view": "masonry",  // or "list"
  "order": ["note1.md", "note2.md"]  // custom note ordering
}
```

## 🔄 Sync Strategy

Noteel uses an intelligent offline-first sync approach:

1. **Offline First**: All changes saved locally immediately
2. **Auto Sync**: When online, syncs to cloud automatically (10s after last edit)
3. **Periodic Check**: Checks for remote changes every 60 seconds
4. **Conflict Resolution**: Smart merging when conflicts detected
5. **Manual Sync**: Force sync anytime via sync buttons

## ⚙️ Extensions & Themes

### Extensions

Extend Noteel's functionality by adding extensions to `.noteel/extensions/`:
- Each extension has a `manifest.json` file
- Auto-update checking for newer versions
- Enable/disable extensions from settings
- Access to Noteel API for deep integration

### Themes

Customize the look with CSS themes in `.noteel/themes/`:
- Add custom themes via file upload or URL
- Select active theme from settings
- Default theme included

## 💻 Project Structure

Noteel has a modular, maintainable architecture:

```
noteel/
├── core/              # Core business logic
│   ├── adapters.js    # Storage adapter management
│   ├── auth.js        # OAuth authentication
│   ├── markdown.js    # Markdown serialization
│   ├── state.js       # Application state
│   └── storage.js     # LocalStorage operations
├── ui/                # User interface components
│   ├── components.js  # UI element references
│   ├── dialogs.js     # Modals and banners
│   ├── editor.js      # Milkdown editor setup
│   ├── renderer.js    # View rendering
│   └── token-dialog.js # OAuth token UI
├── features/          # Feature modules
│   ├── drag-drop.js   # Note reordering
│   ├── extensions.js  # Extension system
│   ├── folders.js     # Folder operations
│   ├── notes.js       # Note operations
│   ├── sync.js        # Cloud sync logic
│   └── themes.js      # Theme management
├── utils/             # Helper functions
│   ├── file-utils.js  # File utilities
│   ├── path-utils.js  # Path manipulation
│   └── responsive.js  # Responsive layout
├── adapters/          # Cloud storage adapters
│   ├── dropbox.js
│   ├── googledrive.js
│   └── onedrive.js
├── app.js             # Main entry point
├── app.css            # Styles
├── index.html         # Main HTML
└── sw.js              # Service worker
```

## 🔐 Cloud Storage

## 🔐 Cloud Storage

### OAuth Authentication

Each cloud provider uses OAuth 2.0 for authentication. The authentication flow happens entirely client-side:
1. User clicks on a cloud provider
2. A popup opens to the provider's OAuth page
3. User grants permission
4. Access token is securely stored in localStorage
5. App automatically syncs notes from the cloud

**Note**: To use cloud storage, you need to set up OAuth applications for each provider. See [OAUTH_SETUP.md](OAUTH_SETUP.md) for detailed instructions.

### Storage Adapters

All storage providers implement a common interface:
- `listFiles()` - Get all note files
- `listFolders()` - Get folder structure
- `getFileContent(path)` - Read a note
- `saveFileContent(path, content)` - Write a note
- `deleteFile(path)` - Remove a note

This modular design makes it easy to add new providers (Git, iCloud, WebDAV coming soon!).

## 🛠️ Development Setup

### Prerequisites

- Node.js (for package management)
- A local web server (service workers require HTTP/HTTPS)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/noteel.git
cd noteel

# Install dependencies
npm install
```

### Running Locally

You need a local web server (service workers require HTTP/HTTPS, not `file://` protocol):

```bash
# Option 1: Using Python
python -m http.server 8000

# Option 2: Using Node.js http-server
npx http-server -p 8000

# Option 3: Using VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Then navigate to `http://localhost:8000` in your browser.

## 📦 Building for Production

Noteel is a zero-build PWA - no compilation needed!

### Deployment Steps

1. **Upload files** to your web server
2. **Enable HTTPS** (required for service workers)
3. **Update OAuth** redirect URIs in provider dashboards
4. **Configure** client IDs in `core/auth.js` for production domain
5. **Test** the service worker and offline functionality

## 🤝 Contributing

Contributions are welcome! Areas where you can help:

- 🐛 Bug reports and fixes
- 💡 Feature suggestions
- 📝 Documentation improvements
- 🎨 New themes
- 🔌 Extension development
- 🌐 New storage adapter implementations (Git, iCloud, WebDAV, etc.)
