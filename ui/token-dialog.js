const DIALOG_ID = "tokenDialog";

function ensureDialog() {
  let dialog = document.getElementById(DIALOG_ID);
  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "token-dialog";
  dialog.innerHTML = `
    <form class="token-form" method="dialog">
      <div class="token-header">
        <h2 class="token-title"></h2>
        <button type="button" class="ghost token-close">Close</button>
      </div>
      <p class="token-intro"></p>
      <ul class="token-steps"></ul>
      <div class="token-links"></div>
      <label class="token-label" for="tokenInput">Access token</label>
      <input id="tokenInput" class="token-input" type="password" autocomplete="off" placeholder="Paste the access token" />
      <div class="token-actions">
        <button type="button" class="ghost token-cancel">Cancel</button>
        <button type="submit" class="primary token-save">Save token</button>
      </div>
    </form>
  `;

  document.body.appendChild(dialog);
  return dialog;
}

function fillList(list, items) {
  list.innerHTML = "";
  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });
}

function fillLinks(container, links) {
  container.innerHTML = "";
  links.forEach((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = link.label || link.url;
    container.appendChild(anchor);
  });
}

export async function requestAccessToken({ serviceName, tokenKey, intro, steps = [], links = [] }) {
  const existing = localStorage.getItem(tokenKey);
  if (existing) {
    return existing;
  }

  const dialog = ensureDialog();
  const title = dialog.querySelector(".token-title");
  const introEl = dialog.querySelector(".token-intro");
  const stepsEl = dialog.querySelector(".token-steps");
  const linksEl = dialog.querySelector(".token-links");
  const input = dialog.querySelector(".token-input");
  const closeBtn = dialog.querySelector(".token-close");
  const cancelBtn = dialog.querySelector(".token-cancel");

  title.textContent = `${serviceName} access token required`;
  introEl.textContent = intro;
  fillList(stepsEl, steps);
  fillLinks(linksEl, links);
  input.value = "";

  return new Promise((resolve, reject) => {
    let settled = false;
    const form = dialog.querySelector(".token-form");

    const cleanup = () => {
      closeBtn.removeEventListener("click", onCancel);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
      form.removeEventListener("submit", onSubmit);
    };

    const onCancel = (event) => {
      if (event?.type === "cancel") {
        event.preventDefault();
      }
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      dialog.close();
      reject(new Error(`${serviceName} access token required.`));
    };

    const onClose = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error(`${serviceName} access token required.`));
    };

    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    closeBtn.addEventListener("click", onCancel);
    cancelBtn.addEventListener("click", onCancel);

    const onSubmit = (event) => {
      event.preventDefault();
      if (settled) {
        return;
      }
      const token = input.value.trim();
      if (!token) {
        input.focus();
        return;
      }
      settled = true;
      cleanup();
      dialog.close();
      localStorage.setItem(tokenKey, token);
      resolve(token);
    };

    form.addEventListener("submit", onSubmit);

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      const fallback = window.prompt(`${serviceName} access token required.\n${intro}\n${links.map((link) => link.url).join("\n")}`);
      if (!fallback) {
        onCancel();
        return;
      }
      const token = fallback.trim();
      localStorage.setItem(tokenKey, token);
      settled = true;
      cleanup();
      resolve(token);
    }
  });
}
