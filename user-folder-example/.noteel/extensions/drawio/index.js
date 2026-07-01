const defaultExport = function (Noteel) {
  return function () {
    const EMBED_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&configure=1';
    const XML_MARKER_REGEX = /<!--\s*noteel:drawio:xml:([A-Za-z0-9+/=]+)\s*-->/;
    const PREVIEW_REGEX = /!\[Draw\.io Diagram\]\(data:image\/svg\+xml;base64,[^)]+\)\n?/;

    Noteel.addToolbarButton({
      icon: '🧩',
      title: 'Edit Draw.io diagram',
      onClick: openEditor
    });

    function openEditor() {
      if (!Noteel.state.currentFile) {
        Noteel.showBanner('Open a note before using Draw.io.');
        return;
      }

      const { dialog, iframe, saveBtn, cancelBtn } = ensureDialog();
      const note = getCurrentNote();
      let pendingXml = note.xml || '';
      let isExporting = false;

      const sendToIframe = (payload) => {
        if (!iframe.contentWindow) return;
        iframe.contentWindow.postMessage(JSON.stringify(payload), '*');
      };

      const onMessage = (event) => {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data || typeof data !== 'object') return;

        if (data.event === 'init') {
          sendToIframe({
            action: 'load',
            autosave: 1,
            xml: note.xml || undefined
          });
        }

        if (data.event === 'autosave' && typeof data.xml === 'string') {
          pendingXml = data.xml;
        }

        if (data.event === 'save' && typeof data.xml === 'string') {
          pendingXml = data.xml;
          if (!isExporting) {
            isExporting = true;
            sendToIframe({ action: 'export', format: 'svg', spin: 'Exporting diagram...' });
          }
        }

        if (data.event === 'export' && typeof data.data === 'string') {
          persistDiagram(pendingXml, data.data);
          cleanup();
          dialog.close();
          Noteel.showBanner('Draw.io diagram saved.');
        }
      };

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        isExporting = false;
      };

      saveBtn.onclick = () => {
        sendToIframe({ action: 'save' });
      };

      cancelBtn.onclick = () => {
        cleanup();
        dialog.close();
      };

      dialog.addEventListener('close', cleanup, { once: true });
      window.addEventListener('message', onMessage);
      iframe.src = EMBED_URL;
      dialog.showModal();
    }

    function ensureDialog() {
      let dialog = document.getElementById('drawioDialog');
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'drawioDialog';
        dialog.className = 'token-dialog';
        dialog.style.width = 'min(1200px, 96vw)';
        dialog.style.height = 'min(820px, 92vh)';
        dialog.style.padding = '0';
        dialog.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);">
              <h3 style="margin:0;">Draw.io</h3>
              <div style="display:flex;gap:8px;">
                <button id="drawioSaveBtn" class="primary" type="button">Save Diagram</button>
                <button id="drawioCancelBtn" class="ghost" type="button">Close</button>
              </div>
            </div>
            <iframe id="drawioIframe" title="Draw.io Editor" style="flex:1;border:none;background:#fff;"></iframe>
          </div>
        `;
        document.body.appendChild(dialog);
      }

      return {
        dialog,
        iframe: dialog.querySelector('#drawioIframe'),
        saveBtn: dialog.querySelector('#drawioSaveBtn'),
        cancelBtn: dialog.querySelector('#drawioCancelBtn')
      };
    }

    function getCurrentNote() {
      const fs = Noteel.loadFs();
      const path = Noteel.state.currentFile;
      const file = fs.files[path];
      const content = file?.content || '';
      const xmlMatch = content.match(XML_MARKER_REGEX);
      return {
        content,
        xml: xmlMatch ? decodeBase64(xmlMatch[1]) : ''
      };
    }

    function persistDiagram(xml, svgDataUrl) {
      const path = Noteel.state.currentFile;
      if (!path) return;

      const fs = Noteel.loadFs();
      const existing = fs.files[path]?.content || '';
      const cleaned = existing
        .replace(XML_MARKER_REGEX, '')
        .replace(PREVIEW_REGEX, '')
        .trimEnd();

      const xmlMarker = `<!-- noteel:drawio:xml:${encodeBase64(xml)} -->`;
      const preview = `![Draw.io Diagram](${svgDataUrl})`;
      const nextContent = `${cleaned}\n\n${preview}\n${xmlMarker}\n`;

      fs.files[path] = {
        content: nextContent,
        modified: Date.now()
      };

      Noteel.saveFs(fs);
      Noteel.state.modifiedFiles.add(path);
      Noteel.renderAll();
    }

    function encodeBase64(value) {
      const bytes = new TextEncoder().encode(value || '');
      let binary = '';
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary);
    }

    function decodeBase64(value) {
      const binary = atob(value || '');
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
  };
}
