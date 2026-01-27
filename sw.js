const CACHE_NAME = "noteel-cache-v18";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./core/auth.js",
  "./core/storage.js",
  "./core/state.js",
  "./core/markdown.js",
  "./core/adapters.js",
  "./ui/components.js",
  "./ui/renderer.js",
  "./ui/editor.js",
  "./ui/dialogs.js",
  "./ui/token-dialog.js",
  "./features/notes.js",
  "./features/folders.js",
  "./features/sync.js",
  "./features/extensions.js",
  "./features/themes.js",
  "./features/drag-drop.js",
  "./utils/path-utils.js",
  "./utils/file-utils.js",
  "./utils/responsive.js",
  "./auth-callback.html",
  "./manifest.webmanifest",
  "./node_modules/@tiptap/core/dist/index.js",
  "./node_modules/@tiptap/core/dist/jsx-runtime/jsx-runtime.js",
  "./node_modules/@tiptap/starter-kit/dist/index.js",
  "./node_modules/@tiptap/pm/dist/commands/index.js",
  "./node_modules/@tiptap/pm/dist/changeset/index.js",
  "./node_modules/@tiptap/pm/dist/collab/index.js",
  "./node_modules/@tiptap/pm/dist/dropcursor/index.js",
  "./node_modules/@tiptap/pm/dist/gapcursor/index.js",
  "./node_modules/@tiptap/pm/dist/history/index.js",
  "./node_modules/@tiptap/pm/dist/inputrules/index.js",
  "./node_modules/@tiptap/pm/dist/keymap/index.js",
  "./node_modules/@tiptap/pm/dist/markdown/index.js",
  "./node_modules/@tiptap/pm/dist/menu/index.js",
  "./node_modules/@tiptap/pm/dist/model/index.js",
  "./node_modules/@tiptap/pm/dist/schema-basic/index.js",
  "./node_modules/@tiptap/pm/dist/schema-list/index.js",
  "./node_modules/@tiptap/pm/dist/state/index.js",
  "./node_modules/@tiptap/pm/dist/tables/index.js",
  "./node_modules/@tiptap/pm/dist/trailing-node/index.js",
  "./node_modules/@tiptap/pm/dist/transform/index.js",
  "./node_modules/@tiptap/pm/dist/view/index.js",
  "./node_modules/@tiptap/extension-blockquote/dist/index.js",
  "./node_modules/@tiptap/extension-bold/dist/index.js",
  "./node_modules/@tiptap/extension-bullet-list/dist/index.js",
  "./node_modules/@tiptap/extension-code/dist/index.js",
  "./node_modules/@tiptap/extension-code-block/dist/index.js",
  "./node_modules/@tiptap/extension-document/dist/index.js",
  "./node_modules/@tiptap/extension-dropcursor/dist/index.js",
  "./node_modules/@tiptap/extension-gapcursor/dist/index.js",
  "./node_modules/@tiptap/extension-hard-break/dist/index.js",
  "./node_modules/@tiptap/extension-heading/dist/index.js",
  "./node_modules/@tiptap/extension-highlight/dist/index.js",
  "./node_modules/@tiptap/extension-horizontal-rule/dist/index.js",
  "./node_modules/@tiptap/extension-italic/dist/index.js",
  "./node_modules/@tiptap/extension-link/dist/index.js",
  "./node_modules/@tiptap/extension-list/dist/index.js",
  "./node_modules/@tiptap/extension-list-item/dist/index.js",
  "./node_modules/@tiptap/extension-list-keymap/dist/index.js",
  "./node_modules/@tiptap/extension-ordered-list/dist/index.js",
  "./node_modules/@tiptap/extension-paragraph/dist/index.js",
  "./node_modules/@tiptap/extension-strike/dist/index.js",
  "./node_modules/@tiptap/extension-task-item/dist/index.js",
  "./node_modules/@tiptap/extension-task-list/dist/index.js",
  "./node_modules/@tiptap/extension-text/dist/index.js",
  "./node_modules/@tiptap/extension-underline/dist/index.js",
  "./node_modules/@tiptap/extensions/dist/index.js",
  "./node_modules/prosemirror-commands/dist/index.js",
  "./node_modules/prosemirror-changeset/dist/index.js",
  "./node_modules/prosemirror-collab/dist/index.js",
  "./node_modules/prosemirror-dropcursor/dist/index.js",
  "./node_modules/prosemirror-gapcursor/dist/index.js",
  "./node_modules/prosemirror-history/dist/index.js",
  "./node_modules/prosemirror-inputrules/dist/index.js",
  "./node_modules/prosemirror-keymap/dist/index.js",
  "./node_modules/prosemirror-markdown/dist/index.js",
  "./node_modules/prosemirror-menu/dist/index.js",
  "./node_modules/prosemirror-model/dist/index.js",
  "./node_modules/prosemirror-schema-basic/dist/index.js",
  "./node_modules/prosemirror-schema-list/dist/index.js",
  "./node_modules/prosemirror-state/dist/index.js",
  "./node_modules/prosemirror-tables/dist/index.js",
  "./node_modules/prosemirror-trailing-node/dist/index.js",
  "./node_modules/prosemirror-transform/dist/index.js",
  "./node_modules/prosemirror-view/dist/index.js",
  "./node_modules/orderedmap/dist/index.js",
  "./node_modules/rope-sequence/dist/index.js",
  "./node_modules/w3c-keyname/index.js",
  "./node_modules/crelt/index.js",
  "./node_modules/linkifyjs/dist/linkify.mjs",
  "./node_modules/marked/lib/marked.esm.js",
  "./adapters/dropbox.js",
  "./adapters/onedrive.js",
  "./adapters/googledrive.js",
  "./user-folder-example/.noteel/file-index.json",
  "./user-folder-example/index.md",
  "./user-folder-example/my-projects/index.md",
  "./user-folder-example/.noteel/settings.json",
  "./user-folder-example/.noteel/extensions/chatgpt/manifest.json",
  "./user-folder-example/.noteel/extensions/drawio/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).catch(() => caches.match("./index.html"))
    )
  );
});
