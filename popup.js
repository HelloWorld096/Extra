// ─────────────────────────────────────────────────────────────────────────────
// popup.js
// ─────────────────────────────────────────────────────────────────────────────

// Immediately‐invoked function expression (IIFE) to avoid polluting globals
(function () {
  const STORAGE_KEY = "localhost_ports";
  const LONG_PRESS_DELAY = 500; // ms to trigger arrange mode on a long-press
  const MOVE_THRESHOLD   = 10;  // px movement cancels long-press

  // ─────────── Dynamically load the CSS file (`fuckyou.css`) ───────────
  function injectCSS() {
    if (document.getElementById("popupCssInjected")) return;
    const link = document.createElement("link");
    link.id   = "popupCssInjected";
    link.rel  = "stylesheet";
    link.href = "https://raw.githubusercontent.com/HelloWorld096/Extra/refs/heads/main/popup.css"; // ensure this file is served at this path
    document.head.appendChild(link);
  }

  // ─────────── Convenience: read/write port list in localStorage ───────────
  function getStoredPorts() {
    const raw = localStorage.getItem(STORAGE_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function setStoredPorts(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  // ─────────── Build the Modal HTML Once (and append to <body>) ───────────
  function buildModalDOM() {
    if (document.getElementById("localhostOverlay")) return;

    // 1) Overlay
    const overlay = document.createElement("div");
    overlay.id = "localhostOverlay";
    overlay.style.display = "none";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) hideModal();
    });

    // 2) Modal container
    const modal = document.createElement("div");
    modal.id = "localhostModal";

    // 3) Header (title + add/check button)
    const header = document.createElement("div");
    header.id = "localhostModalHeader";

    const title = document.createElement("h2");
    title.textContent = "Localhost Manager";
    header.appendChild(title);

    const addBtn = document.createElement("button");
    addBtn.id = "localhostAddBtn";
    addBtn.innerHTML = `<span class="material-icons">add</span>`;
    header.appendChild(addBtn);

    modal.appendChild(header);

    // 4) Entry list container
    const entryList = document.createElement("div");
    entryList.id = "localhostEntryList";
    modal.appendChild(entryList);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 5) Prompt overlay (for “Add Port”)
    const promptOverlay = document.createElement("div");
    promptOverlay.id = "localhostPromptOverlay";
    promptOverlay.style.display = "none";
    promptOverlay.addEventListener("click", (e) => {
      if (e.target === promptOverlay) hidePrompt();
    });

    const promptBox = document.createElement("div");
    promptBox.id = "localhostPromptBox";

    const label = document.createElement("label");
    label.setAttribute("for", "localhostPortInput");
    label.textContent = "Enter Port Number";
    promptBox.appendChild(label);

    const input = document.createElement("input");
    input.type = "number";
    input.id   = "localhostPortInput";
    input.placeholder = "e.g. 8000";
    input.min = "1";
    input.max = "65535";
    promptBox.appendChild(input);

    const saveBtn = document.createElement("button");
    saveBtn.id = "localhostSavePortBtn";
    saveBtn.textContent = "Add Port";
    promptBox.appendChild(saveBtn);

    promptOverlay.appendChild(promptBox);
    document.body.appendChild(promptOverlay);

    // Store references for later
    _refs.overlay        = overlay;
    _refs.modal          = modal;
    _refs.header         = header;
    _refs.addBtn         = addBtn;
    _refs.entryList      = entryList;
    _refs.promptOverlay  = promptOverlay;
    _refs.promptBox      = promptBox;
    _refs.portInput      = input;
    _refs.savePortBtn    = saveBtn;
  }

  // ─────────── State & References ───────────
  let isArrangeMode = false;
  let longPressTimer = null;
  let startX = 0, startY = 0;

  const _refs = {
    overlay:       null,
    modal:         null,
    header:        null,
    addBtn:        null,
    entryList:     null,
    promptOverlay: null,
    promptBox:     null,
    portInput:     null,
    savePortBtn:   null
  };

  // ───────────────────────────────────────────────────────────────────────────
  //  Render / Show / Hide Logic
  // ───────────────────────────────────────────────────────────────────────────

  // Show empty‐state or list of saved ports
  function showEmptyState() {
    _refs.entryList.innerHTML = `
      <div class="empty-state">
        <div class="material-icons" style="font-size:48px; opacity:0.6;">
          link_off
        </div>
        <p>No localhost shortcuts yet.<br>Tap + to add one.</p>
      </div>
    `;
  }

  function loadEntries() {
    const ports = getStoredPorts();
    if (ports.length === 0) {
      showEmptyState();
      return;
    }

    const listContainer = document.createElement("div");
    listContainer.className = "md3-list";

    ports.forEach((port) => {
      listContainer.appendChild(createEntryItem(port));
    });

    _refs.entryList.innerHTML = "";
    _refs.entryList.appendChild(listContainer);
  }

  // Show the modal
  function showModal() {
    injectCSS();
    buildModalDOM();
    loadEntries();

    _refs.overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  // Hide the modal and reset arrange mode if active
  function hideModal() {
    _refs.overlay.style.display = "none";
    document.body.style.overflow = "auto";
    if (isArrangeMode) disableArrangeMode();
  }

  // Show the “Add Port” prompt
  function showPrompt() {
    _refs.portInput.value = "";
    _refs.promptOverlay.style.display = "flex";
    setTimeout(() => _refs.portInput.focus(), 100);
  }

  // Hide the prompt
  function hidePrompt() {
    _refs.promptOverlay.style.display = "none";
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Arrange Mode: enter / exit / create check button
  // ───────────────────────────────────────────────────────────────────────────

  function enableArrangeMode() {
    if (isArrangeMode) return;
    isArrangeMode = true;
    loadEntries();

    // Hide the “+” button
    _refs.addBtn.style.display = "none";

    // Insert a check‐icon button into header (to save/exit)
    if (!document.getElementById("localhostSaveArrangeBtn")) {
      const saveBtn = document.createElement("button");
      saveBtn.id = "localhostSaveArrangeBtn";
      saveBtn.innerHTML = `<span class="material-icons">check</span>`;
      saveBtn.style.background = "none";
      saveBtn.style.border     = "none";
      saveBtn.style.cursor     = "pointer";
      saveBtn.style.marginLeft = "auto";
      saveBtn.style.padding    = "6px";

      saveBtn.addEventListener("click", disableArrangeMode);
      _refs.header.appendChild(saveBtn);
    }
  }

  function disableArrangeMode() {
    if (!isArrangeMode) return;
    isArrangeMode = false;
    loadEntries();

    // Show the “+” button again
    _refs.addBtn.style.display = "";

    // Remove the check‐icon button
    const saveBtn = document.getElementById("localhostSaveArrangeBtn");
    if (saveBtn) saveBtn.remove();
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Long-Press Handler (pointer events) for mobile/desktop
  // ───────────────────────────────────────────────────────────────────────────

  function attachLongPressHandler(item) {
    let pressed = false;

    function onPointerDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pressed = true;
      startX = e.clientX;
      startY = e.clientY;
      item.classList.add("pressing");

      longPressTimer = setTimeout(() => {
        if (!pressed) return;
        item.classList.remove("pressing");
        enableArrangeMode();
      }, LONG_PRESS_DELAY);
    }

    function cancelPress() {
      pressed = false;
      clearTimeout(longPressTimer);
      item.classList.remove("pressing");
    }

    function onPointerMove(e) {
      if (!pressed) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
        cancelPress();
      }
    }

    item.addEventListener("pointerdown", onPointerDown);
    item.addEventListener("pointerup", cancelPress);
    item.addEventListener("pointercancel", cancelPress);
    item.addEventListener("pointermove", onPointerMove);
    item.addEventListener("pointerleave", cancelPress);
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  CRUD: Add / Delete / Reorder Entries
  // ───────────────────────────────────────────────────────────────────────────

  function addPort(port) {
    if (!port) return;
    const ports = getStoredPorts();
    if (ports.includes(port)) return; // no duplicates
    ports.push(port);
    setStoredPorts(ports);
    loadEntries();
  }

  function deletePort(port) {
    const ports = getStoredPorts().filter((p) => p !== port);
    setStoredPorts(ports);
    loadEntries();
  }

  // After a DOM reorder, sync storage
  function syncStorageWithDOM() {
    const listContainer = _refs.entryList.querySelector(".md3-list");
    if (!listContainer) return;
    const newOrder = Array.from(listContainer.children).map((div) =>
      div.getAttribute("data-port")
    );
    setStoredPorts(newOrder);
  }

  // Animate two items (up/down), then swap in DOM & storage
  function animateAndSwap(itemDiv, siblingDiv) {
    itemDiv.classList.add("animate-up");
    siblingDiv.classList.add("animate-down");

    function onAniEnd() {
      itemDiv.removeEventListener("animationend", onAniEnd);
      siblingDiv.removeEventListener("animationend", onAniEnd);
      itemDiv.classList.remove("animate-up");
      siblingDiv.classList.remove("animate-down");

      const parent = itemDiv.parentNode;
      if (!parent) return;
      parent.insertBefore(itemDiv, siblingDiv);
      syncStorageWithDOM();
      loadEntries();
    }

    itemDiv.addEventListener("animationend", onAniEnd);
    siblingDiv.addEventListener("animationend", onAniEnd);
  }

  // Build one entry‐item DOM node (normal vs. arrange mode)
  function createEntryItem(port) {
    const fullUrl = "127.0.0.1:" + port;
    const item = document.createElement("div");
    item.className = "md3-list-item";
    item.setAttribute("data-port", port);

    item.innerHTML = `
      <div class="list-item-leading">
        <span class="material-icons">${
          isArrangeMode ? "drag_indicator" : "link"
        }</span>
      </div>
      <div class="list-item-content">
        <div class="list-item-headline">${fullUrl}</div>
      </div>
      ${
        isArrangeMode
          ? `
        <button class="arrange-btn upBtn" data-port="${port}">
          <span class="material-icons">arrow_upward</span>
        </button>
        <button class="arrange-btn downBtn" data-port="${port}">
          <span class="material-icons">arrow_downward</span>
        </button>
        <button class="deleteBtn" data-port="${port}">
          <span class="material-icons">delete</span>
        </button>`
          : ``
      }
    `;

    if (!isArrangeMode) {
      // Normal mode: tap opens URL; long-press → arrange mode
      item.addEventListener("click", () => {
        let url = fullUrl;
        if (!/^https?:\/\//.test(fullUrl)) {
          url = "http://" + fullUrl;
        }
        window.open(url, "_blank");
      });
      attachLongPressHandler(item);
    } else {
      // Arrange mode: wire ▲ / ▼ / 🗑
      const upBtn   = item.querySelector(".upBtn");
      const downBtn = item.querySelector(".downBtn");
      const delBtn  = item.querySelector(".deleteBtn");

      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const prev = item.previousElementSibling;
        if (prev && prev.classList.contains("md3-list-item")) {
          animateAndSwap(item, prev);
        }
      });
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = item.nextElementSibling;
        if (next && next.classList.contains("md3-list-item")) {
          animateAndSwap(next, item);
        }
      });
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deletePort(port);
      });
    }

    return item;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Event Listeners for Add/Save/Escape/Prompt
  // ───────────────────────────────────────────────────────────────────────────

  function hookUpEventListeners() {
    // 1) “+” button opens prompt (in normal mode)
    _refs.addBtn.addEventListener("click", showPrompt);

    // 2) “Add Port” in prompt
    _refs.savePortBtn.addEventListener("click", () => {
      const val = _refs.portInput.value.trim();
      if (!val) return;
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1 || num > 65535) {
        alert("Please enter a valid port number (1–65535).");
        return;
      }
      addPort(num.toString());
      hidePrompt();
    });

    // 3) Enter/Escape keys in prompt input
    _refs.portInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") _refs.savePortBtn.click();
      if (e.key === "Escape") hidePrompt();
    });

    // 4) Global Escape: close prompt / exit arrange / close modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (_refs.promptOverlay.style.display === "flex") {
          hidePrompt();
        } else if (isArrangeMode) {
          disableArrangeMode();
        } else if (_refs.overlay.style.display === "flex") {
          hideModal();
        }
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Public API: expose a function to show the modal
  // ───────────────────────────────────────────────────────────────────────────

  window.showLocalhostManager = function () {
    if (!_refs.overlay) {
      injectCSS();
      buildModalDOM();
      hookUpEventListeners();
    }
    showModal();
  };

  // ───────────────────────────────────────────────────────────────────────────
  //  Immediately attach a click on the default “localhost” button (if present)
  //  so existing HTML `<button id="openManagerBtn">localhost</button>` still works.
  // ───────────────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    // If user has a button with id="openManagerBtn", hook it up:
    const defaultBtn = document.getElementById("openManagerBtn");
    if (defaultBtn) {
      defaultBtn.addEventListener("click", () => {
        window.showLocalhostManager();
      });
    }
  });
})();
