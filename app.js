const THEMES = [
  { id: "mint", label: "LINE" },
  { id: "amber", label: "アンバー" },
  { id: "sakura", label: "さくら" },
  { id: "midnight", label: "ミッドナイト" },
];

const state = {
  chatTitle: "",
  theme: "mint",
  subjectiveId: "",
  characters: [],
  messages: [],
  selectedMessageId: null,
  pendingFiles: [],
  selectedFileId: null,
  editMode: false,
};

const elements = {
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  filePicker: document.getElementById("filePicker"),
  generateBtn: document.getElementById("generateBtn"),
  errorBox: document.getElementById("errorBox"),
  workspace: document.getElementById("workspace"),
  chatTitleInput: document.getElementById("chatTitleInput"),
  themeSelect: document.getElementById("themeSelect"),
  subjectiveSelect: document.getElementById("subjectiveSelect"),
  characterList: document.getElementById("characterList"),
  messageList: document.getElementById("messageList"),
  messageEditor: document.getElementById("messageEditor"),
  addTextBtn: document.getElementById("addTextBtn"),
  addImageBtn: document.getElementById("addImageBtn"),
  addImageInput: document.getElementById("addImageInput"),
  exportFormat: document.getElementById("exportFormat"),
  exportBtn: document.getElementById("exportBtn"),
  chatTitlePreview: document.getElementById("chatTitlePreview"),
  chatView: document.getElementById("chatView"),
  toggleEditBtn: document.getElementById("toggleEditBtn"),
  editModal: document.getElementById("editModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
  modalSaveBtn: document.getElementById("modalSaveBtn"),
  modalSpeaker: document.getElementById("modalSpeaker"),
  modalType: document.getElementById("modalType"),
  modalText: document.getElementById("modalText"),
  modalTextField: document.getElementById("modalTextField"),
  modalImageField: document.getElementById("modalImageField"),
  modalImagePreview: document.getElementById("modalImagePreview"),
  modalImageInput: document.getElementById("modalImageInput"),
};

let dragMessageId = null;
const modalState = { messageId: null, imageDataUrl: "" };

init();

function init() {
  populateThemeSelect();
  document.documentElement.dataset.theme = state.theme;
  startClock();

  elements.fileInput.addEventListener("change", (event) => {
    handleFiles(Array.from(event.target.files || []));
  });

  elements.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragover");
  });

  elements.dropZone.addEventListener("dragleave", () => {
    elements.dropZone.classList.remove("dragover");
  });

  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragover");
    const files = Array.from(event.dataTransfer.files || []);
    handleFiles(files);
  });

  elements.dropZone.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });

  elements.generateBtn.addEventListener("click", () => {
    loadSelectedFile().catch((error) => showError(error.message));
  });

  elements.chatTitleInput.addEventListener("input", (event) => {
    state.chatTitle = event.target.value;
    renderChatTitle();
  });

  elements.themeSelect.addEventListener("change", (event) => {
    state.theme = event.target.value;
    document.documentElement.dataset.theme = state.theme;
  });

  elements.subjectiveSelect.addEventListener("change", (event) => {
    state.subjectiveId = event.target.value;
    renderPreview();
  });

  if (elements.toggleEditBtn) {
    elements.toggleEditBtn.addEventListener("click", () => {
      state.editMode = !state.editMode;
      renderEditToggle();
      renderPreview();
    });
  }

  if (elements.editModal) {
    if (elements.modalBackdrop) {
      elements.modalBackdrop.addEventListener("click", closeEditModal);
    }
    if (elements.modalCloseBtn) {
      elements.modalCloseBtn.addEventListener("click", closeEditModal);
    }
    if (elements.modalCancelBtn) {
      elements.modalCancelBtn.addEventListener("click", closeEditModal);
    }
    if (elements.modalType) {
      elements.modalType.addEventListener("change", updateModalFields);
    }
    if (elements.modalImageInput) {
      elements.modalImageInput.addEventListener("change", handleModalImage);
    }
    if (elements.modalSaveBtn) {
      elements.modalSaveBtn.addEventListener("click", saveModalEdit);
    }
  }

  if (elements.addTextBtn) {
    elements.addTextBtn.addEventListener("click", () => {
      insertMessage({ type: "text", text: "" });
    });
  }

  if (elements.addImageBtn && elements.addImageInput) {
    elements.addImageBtn.addEventListener("click", () => {
      elements.addImageInput.value = "";
      elements.addImageInput.click();
    });

    elements.addImageInput.addEventListener("change", () => {
      const file = elements.addImageInput.files[0];
      if (!file) {
        return;
      }
      if (!isImageFile(file)) {
        showError("画像はJPG/PNGのみ対応しています。");
        return;
      }
      readFileAsDataUrl(file)
        .then((dataUrl) => {
          insertMessage({ type: "image", imageDataUrl: dataUrl, text: "" });
        })
        .catch((error) => showError(error.message));
    });
  }

  elements.exportBtn.addEventListener("click", () => {
    if (!state.messages.length) {
      showError("出力するメッセージがありません。");
      return;
    }
    const format =
      document.getElementById("exportFormat")?.value || "html";
    if (format === "png") {
      exportPreviewAsPng();
      return;
    }
    const html = buildExportHtml();
    downloadFile(html, `${safeFileName(state.chatTitle || "line-chat")}.html`);
  });

  setupMessageListInteractions();
  setupPreviewInteractions();
}

function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const timeText = `${hours}:${minutes}`;
  const statusTime = document.getElementById("statusTime");
  if (statusTime) {
    statusTime.textContent = timeText;
  }
}

function populateThemeSelect() {
  elements.themeSelect.innerHTML = "";
  THEMES.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.label;
    elements.themeSelect.appendChild(option);
  });
  elements.themeSelect.value = state.theme;
}

function handleFiles(files) {
  clearError();
  if (!files.length) {
    return;
  }
  const invalid = files.filter((file) => !isHtmlFile(file));
  if (invalid.length) {
    showError("HTMLファイルのみ読み込めます。");
    resetPendingFiles();
    return;
  }
  state.pendingFiles = files.map((file, index) => ({
    id: `f${index + 1}`,
    file,
  }));
  state.selectedFileId = state.pendingFiles[0]?.id || null;
  renderFilePicker();
}

function resetPendingFiles() {
  state.pendingFiles = [];
  state.selectedFileId = null;
  renderFilePicker();
}

function renderFilePicker() {
  elements.filePicker.innerHTML = "";
  if (!state.pendingFiles.length) {
    return;
  }
  state.pendingFiles.forEach((entry) => {
    const option = document.createElement("label");
    option.className = "file-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "filePick";
    input.value = entry.id;
    input.checked = entry.id === state.selectedFileId;
    input.addEventListener("change", () => {
      state.selectedFileId = entry.id;
    });
    const name = document.createElement("span");
    name.textContent = entry.file.name;
    option.appendChild(input);
    option.appendChild(name);
    elements.filePicker.appendChild(option);
  });
}

async function loadSelectedFile() {
  clearError();
  const selected = state.pendingFiles.find(
    (entry) => entry.id === state.selectedFileId
  );
  if (!selected) {
    showError("生成するファイルを選択してください。");
    return;
  }
  const text = await readFileAsText(selected.file);
  const parsed = parseHtmlLog(text);
  if (!parsed.messages.length) {
    showError("選択したファイルにメッセージが見つかりませんでした。");
    return;
  }
  state.chatTitle = parsed.chatTitle;
  state.characters = parsed.characters;
  state.messages = parsed.messages;
  state.subjectiveId = state.characters[0]?.id || "";
  state.selectedMessageId = state.messages[0]?.id || null;
  elements.workspace.classList.remove("hidden");
  renderAll();
}

async function readFileAsText(file) {
  try {
    const buffer = await file.arrayBuffer();
    const decoded = decodeTextFromBuffer(buffer);
    return decoded.text;
  } catch (error) {
    throw new Error("ファイルの読み込みに失敗しました。");
  }
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function parseHtmlLog(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const paragraphs = Array.from(doc.querySelectorAll("p"));
  let chatTitle = "";
  const characters = [];
  const charMap = new Map();
  const messages = [];

  paragraphs.forEach((p) => {
    const spans = Array.from(p.querySelectorAll("span"));
    if (!spans.length) {
      return;
    }
    if (!chatTitle) {
      const rawTitle = spans[0]?.textContent || "";
      const match = rawTitle.match(/\[(.*?)\]/);
      if (match && match[1]) {
        chatTitle = match[1].trim();
      }
    }
    const speakerRaw = (spans[1]?.textContent || "").trim();
    const messageSpan = spans[2] || spans[spans.length - 1];
    const messageRaw = messageSpan ? messageSpan.textContent : "";
    const messageText = messageRaw.replace(/\r\n/g, "\n").trim();
    const speakerName = speakerRaw || "不明";
    if (!messageText && !speakerRaw) {
      return;
    }
    let charId = charMap.get(speakerName);
    if (!charId) {
      charId = `c${characters.length + 1}`;
      charMap.set(speakerName, charId);
      characters.push({ id: charId, name: speakerName, avatarDataUrl: "" });
    }
    messages.push({
      id: `m${messages.length + 1}`,
      speakerId: charId,
      type: "text",
      text: messageText,
      imageDataUrl: "",
      imageWidth: null,
    });
  });

  if (!chatTitle) {
    chatTitle = "LINEチャット";
  }
  return { chatTitle, characters, messages };
}

function decodeTextFromBuffer(buffer) {
  const guessed = detectEncodingFromBuffer(buffer);
  const primary = decodeWithEncoding(buffer, guessed);
  if (guessed === "utf-8") {
    const primaryScore = replacementRatio(primary);
    if (primaryScore >= 0.005) {
      const sjisText = decodeWithEncoding(buffer, "shift-jis");
      if (replacementRatio(sjisText) < primaryScore) {
        return { text: sjisText, encoding: "shift-jis" };
      }
    }
  }
  return { text: primary, encoding: guessed };
}

function detectEncodingFromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return "utf-16le";
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return "utf-16be";
  }
  const head = new TextDecoder("ascii").decode(bytes.slice(0, 4096));
  const metaCharset = head.match(/<meta[^>]+charset=["']?\s*([^"'\s;>]+)/i);
  if (metaCharset && metaCharset[1]) {
    return normalizeEncoding(metaCharset[1]);
  }
  const httpEquiv = head.match(
    /<meta[^>]+http-equiv=["']content-type["'][^>]*content=["'][^"']*charset=([^"';\s>]+)/i
  );
  if (httpEquiv && httpEquiv[1]) {
    return normalizeEncoding(httpEquiv[1]);
  }
  return "utf-8";
}

function normalizeEncoding(value) {
  const name = (value || "").trim().toLowerCase();
  if (name === "utf8" || name === "utf-8") {
    return "utf-8";
  }
  if (
    name === "shift-jis" ||
    name === "shift_jis" ||
    name === "shiftjis" ||
    name === "sjis" ||
    name === "x-sjis" ||
    name === "windows-31j" ||
    name === "cp932"
  ) {
    return "shift-jis";
  }
  if (name === "euc-jp" || name === "eucjp") {
    return "euc-jp";
  }
  if (name === "utf-16" || name === "utf-16le") {
    return "utf-16le";
  }
  if (name === "utf-16be") {
    return "utf-16be";
  }
  return "utf-8";
}

function decodeWithEncoding(buffer, encoding) {
  try {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  } catch (error) {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function replacementRatio(text) {
  if (!text) {
    return 1;
  }
  const matches = text.match(/\uFFFD/g);
  const count = matches ? matches.length : 0;
  return count / text.length;
}

function renderAll() {
  renderChatTitle();
  renderThemeSelect();
  renderSubjectiveSelect();
  renderEditToggle();
  renderCharacters();
  renderMessageList();
  renderMessageEditor();
  renderPreview();
}

function renderEditToggle() {
  if (!elements.toggleEditBtn) {
    return;
  }
  elements.toggleEditBtn.textContent = state.editMode
    ? "編集モード: ON"
    : "編集モード: OFF";
  elements.toggleEditBtn.classList.toggle("is-on", state.editMode);
  if (elements.chatView) {
    elements.chatView.classList.toggle("edit-mode", state.editMode);
  }
}

function openEditModal(message) {
  if (!elements.editModal || !message) {
    return;
  }
  modalState.messageId = message.id;
  modalState.imageDataUrl = message.imageDataUrl || "";
  if (elements.modalSpeaker) {
    elements.modalSpeaker.innerHTML = "";
    state.characters.forEach((character) => {
      const option = document.createElement("option");
      option.value = character.id;
      option.textContent = character.name || "Unknown";
      elements.modalSpeaker.appendChild(option);
    });
    elements.modalSpeaker.value = message.speakerId;
  }
  if (elements.modalType) {
    elements.modalType.value = message.type;
  }
  if (elements.modalText) {
    elements.modalText.value = message.text || "";
  }
  if (elements.modalImageInput) {
    elements.modalImageInput.value = "";
  }
  updateModalFields();
  updateModalImagePreview();
  elements.editModal.classList.remove("hidden");
  elements.editModal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  if (!elements.editModal) {
    return;
  }
  modalState.messageId = null;
  modalState.imageDataUrl = "";
  if (elements.modalImageInput) {
    elements.modalImageInput.value = "";
  }
  elements.editModal.classList.add("hidden");
  elements.editModal.setAttribute("aria-hidden", "true");
}

function updateModalFields() {
  if (!elements.modalType || !elements.modalTextField || !elements.modalImageField) {
    return;
  }
  const isText = elements.modalType.value === "text";
  elements.modalTextField.classList.toggle("hidden", !isText);
  elements.modalImageField.classList.toggle("hidden", isText);
}

function handleModalImage() {
  const file = elements.modalImageInput?.files?.[0];
  if (!file) {
    return;
  }
  if (!isImageFile(file)) {
    showError("画像はJPG/PNGのみ対応しています。");
    return;
  }
  readFileAsDataUrl(file)
    .then((dataUrl) => {
      modalState.imageDataUrl = dataUrl;
      updateModalImagePreview();
    })
    .catch((error) => showError(error.message));
}

function updateModalImagePreview() {
  if (!elements.modalImagePreview) {
    return;
  }
  elements.modalImagePreview.innerHTML = "";
  if (modalState.imageDataUrl) {
    const img = document.createElement("img");
    img.src = modalState.imageDataUrl;
    img.alt = "プレビュー";
    elements.modalImagePreview.appendChild(img);
  } else {
    elements.modalImagePreview.textContent = "画像未選択";
  }
}

function saveModalEdit() {
  const message = state.messages.find(
    (msg) => msg.id === modalState.messageId
  );
  if (!message) {
    closeEditModal();
    return;
  }
  if (elements.modalSpeaker) {
    message.speakerId = elements.modalSpeaker.value;
  }
  if (elements.modalType) {
    message.type = elements.modalType.value;
  }
  if (message.type === "text") {
    if (elements.modalText) {
      message.text = normalizeEditableText(elements.modalText.value);
    }
    message.imageDataUrl = "";
  } else {
    const hasImage = modalState.imageDataUrl || message.imageDataUrl;
    if (!hasImage) {
      showError("画像を選択してください。");
      return;
    }
    if (modalState.imageDataUrl) {
      message.imageDataUrl = modalState.imageDataUrl;
    }
  }
  closeEditModal();
  renderMessageList();
  renderMessageEditor();
  renderPreview();
}

function renderChatTitle() {
  elements.chatTitleInput.value = state.chatTitle;
  elements.chatTitlePreview.textContent = state.chatTitle || "LINEチャット";
}

function renderThemeSelect() {
  elements.themeSelect.value = state.theme;
  document.documentElement.dataset.theme = state.theme;
}

function renderSubjectiveSelect() {
  elements.subjectiveSelect.innerHTML = "";
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "なし";
  elements.subjectiveSelect.appendChild(noneOption);
  state.characters.forEach((character) => {
    const option = document.createElement("option");
    option.value = character.id;
    option.textContent = character.name || "Unknown";
    if (character.id === state.subjectiveId) {
      option.selected = true;
    }
    elements.subjectiveSelect.appendChild(option);
  });
  elements.subjectiveSelect.value = state.subjectiveId;
}

function renderCharacters() {
  elements.characterList.innerHTML = "";
  state.characters.forEach((character) => {
    const card = document.createElement("div");
    card.className = "character-card";

    const avatar = document.createElement("label");
    avatar.className = "avatar avatar-edit";
    const uploadInput = document.createElement("input");
    uploadInput.type = "file";
    uploadInput.accept = "image/png, image/jpeg";
    uploadInput.className = "hidden";
    uploadInput.addEventListener("change", () => {
      const file = uploadInput.files[0];
      if (!file) {
        return;
      }
      if (!isImageFile(file)) {
        showError("画像はJPG/PNGのみ対応しています。");
        return;
      }
      readFileAsDataUrl(file)
        .then((dataUrl) => {
          character.avatarDataUrl = dataUrl;
          renderCharacters();
          renderPreview();
        })
        .catch((error) => showError(error.message));
    });
    if (character.avatarDataUrl) {
      const img = document.createElement("img");
      img.src = character.avatarDataUrl;
      img.alt = character.name;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getInitial(character.name);
      avatar.classList.add("avatar-empty");
    }
    avatar.appendChild(uploadInput);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = character.name;
    nameInput.addEventListener("change", () => {
      character.name = nameInput.value.trim() || character.name;
      renderSubjectiveSelect();
      renderMessageList();
      renderMessageEditor();
      renderPreview();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "character-delete";
    deleteBtn.textContent = "削除";
    deleteBtn.addEventListener("click", () => {
      deleteCharacter(character.id);
    });

    card.appendChild(avatar);
    card.appendChild(nameInput);
    card.appendChild(deleteBtn);
    elements.characterList.appendChild(card);
  });
}

function deleteCharacter(characterId) {
  const index = state.characters.findIndex(
    (character) => character.id === characterId
  );
  if (index < 0) {
    return;
  }
  if (state.characters.length <= 1) {
    showError("キャラクターは1人以上必要です。");
    return;
  }
  const removed = state.characters[index];
  const fallback = state.characters.find(
    (character) => character.id !== characterId
  );
  const removedName = removed?.name || "不明";
  const removedMessageIds = new Set(
    state.messages
      .filter((message) => message.speakerId === characterId)
      .map((message) => message.id)
  );
  const removedMessageCount = removedMessageIds.size;
  const confirmed = window.confirm(
    `「${removedName}」を削除しますか？\nこのキャラクターのメッセージ（${removedMessageCount}件）も削除されます。`
  );
  if (!confirmed) {
    return;
  }
  state.characters.splice(index, 1);
  state.messages = state.messages.filter(
    (message) => message.speakerId !== characterId
  );
  if (removedMessageIds.has(state.selectedMessageId)) {
    state.selectedMessageId = state.messages[0]?.id || null;
  }
  if (state.subjectiveId === characterId) {
    state.subjectiveId = fallback?.id || "";
  }
  if (elements.editModal && !elements.editModal.classList.contains("hidden")) {
    closeEditModal();
  }
  renderSubjectiveSelect();
  renderCharacters();
  renderMessageList();
  renderMessageEditor();
  renderPreview();
}

function renderMessageList() {
  if (!elements.messageList) {
    return;
  }
  elements.messageList.innerHTML = "";
  state.messages.forEach((message, index) => {
    const item = document.createElement("div");
    item.className = "message-item";
    item.draggable = true;
    item.dataset.id = message.id;
    if (message.id === state.selectedMessageId) {
      item.classList.add("selected");
    }

    const handle = document.createElement("div");
    handle.className = "handle";
    handle.textContent = "::";

    const meta = document.createElement("div");
    const speaker = document.createElement("div");
    speaker.textContent = getCharacterName(message.speakerId);
    const snippet = document.createElement("div");
    snippet.className = "snippet";
    snippet.textContent =
      message.type === "image"
        ? "[画像]"
        : (message.text || "").replace(/\n/g, " ").slice(0, 80);
    meta.appendChild(speaker);
    meta.appendChild(snippet);

    const remove = document.createElement("button");
    remove.textContent = "削除";
    remove.dataset.action = "delete";

    item.appendChild(handle);
    item.appendChild(meta);
    item.appendChild(remove);
    item.style.setProperty("--i", index.toString());
    elements.messageList.appendChild(item);
  });
}

function renderMessageEditor() {
  if (!elements.messageEditor) {
    return;
  }
  elements.messageEditor.innerHTML = "";
  const message = state.messages.find(
    (msg) => msg.id === state.selectedMessageId
  );
  if (!message) {
    elements.messageEditor.textContent = "編集するメッセージを選択してください。";
    elements.messageEditor.classList.add("empty");
    return;
  }
  elements.messageEditor.classList.remove("empty");

  const speakerField = document.createElement("div");
  speakerField.className = "field";
  const speakerLabel = document.createElement("span");
  speakerLabel.textContent = "発言者";
  const speakerValue = document.createElement("div");
  speakerValue.className = "field-value";
  speakerValue.textContent = getCharacterName(message.speakerId);
  speakerField.appendChild(speakerLabel);
  speakerField.appendChild(speakerValue);

  const typeField = document.createElement("div");
  typeField.className = "field";
  const typeLabel = document.createElement("span");
  typeLabel.textContent = "種別";
  const typeValue = document.createElement("div");
  typeValue.className = "field-value";
  typeValue.textContent = message.type === "image" ? "画像" : "テキスト";
  typeField.appendChild(typeLabel);
  typeField.appendChild(typeValue);

  const bodyField = document.createElement("div");
  bodyField.className = "field";
  const bodyLabel = document.createElement("span");
  bodyLabel.textContent = "本文";
  const bodyValue = document.createElement("div");
  bodyValue.className = "field-value";
  if (message.type === "image") {
    bodyValue.textContent = message.imageDataUrl ? "画像あり" : "画像未選択";
  } else {
    bodyValue.textContent = message.text || "（空）";
  }
  bodyField.appendChild(bodyLabel);
  bodyField.appendChild(bodyValue);

  elements.messageEditor.appendChild(speakerField);
  elements.messageEditor.appendChild(typeField);
  elements.messageEditor.appendChild(bodyField);

  const actions = document.createElement("div");
  actions.className = "row";
  const editBtn = document.createElement("button");
  editBtn.textContent = "編集";
  editBtn.addEventListener("click", () => {
    openEditModal(message);
  });
  const insertBtn = document.createElement("button");
  insertBtn.textContent = "後ろに挿入";
  insertBtn.addEventListener("click", () => {
    const newMessage = insertMessage({ type: "text", text: "" }, message.id);
    if (newMessage) {
      openEditModal(newMessage);
    }
  });
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "削除";
  deleteBtn.addEventListener("click", () => {
    deleteMessage(message.id);
  });
  actions.appendChild(editBtn);
  actions.appendChild(insertBtn);
  actions.appendChild(deleteBtn);
  elements.messageEditor.appendChild(actions);
}

function applyImageSize(wrapper, message) {
  if (!wrapper) {
    return;
  }
  if (message?.imageWidth) {
    wrapper.style.width = `${Math.round(message.imageWidth)}px`;
  } else {
    wrapper.style.removeProperty("width");
  }
}

function setupImageResize(handle, wrapper, message) {
  if (!handle || !wrapper || !message) {
    return;
  }
  const minWidth = 120;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let maxWidth = 0;

  const onPointerMove = (event) => {
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    const nextWidth = Math.min(
      maxWidth,
      Math.max(minWidth, startWidth + delta)
    );
    const rounded = Math.round(nextWidth);
    wrapper.style.width = `${rounded}px`;
    message.imageWidth = rounded;
  };

  const stopResize = (event) => {
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopResize);
  };

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startX = event.clientX;
    startY = event.clientY;
    startWidth = wrapper.getBoundingClientRect().width;
    const container = wrapper.closest(".msg-content");
    const containerWidth = container
      ? container.getBoundingClientRect().width
      : startWidth;
    maxWidth = Math.max(minWidth, Math.min(containerWidth, 320));
    handle.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopResize);
  });
}

function renderPreview() {
  elements.chatView.innerHTML = "";
  state.messages.forEach((message, index) => {
    const row = document.createElement("div");
    row.className = "msg-row";
    row.style.setProperty("--i", index.toString());
    row.dataset.id = message.id;
    row.draggable = false;
    row.classList.toggle("draggable", state.editMode);
    const isSubjective = message.speakerId === state.subjectiveId;
    if (isSubjective) {
      row.classList.add("subjective");
    }

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    const character = getCharacter(message.speakerId);
    if (character && character.avatarDataUrl) {
      const img = document.createElement("img");
      img.src = character.avatarDataUrl;
      img.alt = character.name;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getInitial(character?.name || "U");
      avatar.classList.add("avatar-empty");
    }

    const content = document.createElement("div");
    content.className = "msg-content";
    if (!isSubjective) {
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = character?.name || "Unknown";
      content.appendChild(name);
    }

    let messageNode = null;
    if (message.type === "image") {
      const imageWrap = document.createElement("div");
      imageWrap.className = "msg-image-wrap";
      if (message.imageDataUrl) {
        const img = document.createElement("img");
        img.className = "msg-image";
        img.src = message.imageDataUrl;
        img.alt = "メッセージ画像";
        imageWrap.appendChild(img);
        const syncInitialWidth = () => {
          if (message.imageWidth) {
            applyImageSize(imageWrap, message);
            return;
          }
          requestAnimationFrame(() => {
            if (message.imageWidth) {
              applyImageSize(imageWrap, message);
              return;
            }
            const container = imageWrap.closest(".msg-content");
            const containerWidth = container
              ? container.getBoundingClientRect().width
              : 0;
            const maxWidth = Math.min(320, containerWidth || 320);
            const naturalWidth = img.naturalWidth || maxWidth;
            message.imageWidth = Math.round(
              Math.min(naturalWidth, maxWidth)
            );
            applyImageSize(imageWrap, message);
          });
        };
        if (message.imageWidth) {
          applyImageSize(imageWrap, message);
        } else if (img.complete) {
          syncInitialWidth();
        } else {
          img.addEventListener("load", syncInitialWidth, { once: true });
        }
        if (state.editMode) {
          const handle = document.createElement("div");
          handle.className = "image-resize-handle";
          setupImageResize(handle, imageWrap, message);
          imageWrap.appendChild(handle);
        }
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "msg-image msg-image-placeholder";
        placeholder.textContent = "画像未選択";
        imageWrap.appendChild(placeholder);
      }
      messageNode = imageWrap;
    } else {
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.appendChild(createTextNodeWithBreaks(message.text));
      messageNode = bubble;
    }
    content.appendChild(messageNode);
    if (state.editMode) {
      const controls = document.createElement("div");
      controls.className = "edit-controls";
      const editBtn = document.createElement("button");
      editBtn.className = "edit-btn";
      editBtn.type = "button";
      editBtn.textContent = "編集";
      editBtn.addEventListener("click", () => {
        openEditModal(message);
      });
      controls.appendChild(editBtn);
      const insertBtn = document.createElement("button");
      insertBtn.className = "insert-btn";
      insertBtn.type = "button";
      insertBtn.textContent = "挿入";
      insertBtn.addEventListener("click", () => {
        const newMessage = insertMessage({ type: "text", text: "" }, message.id);
        if (newMessage) {
          openEditModal(newMessage);
        }
      });
      controls.appendChild(insertBtn);
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.type = "button";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => {
        deleteMessage(message.id);
      });
      controls.appendChild(deleteBtn);
      content.appendChild(controls);
    }

    if (isSubjective) {
      row.appendChild(content);
    } else {
      row.appendChild(avatar);
      row.appendChild(content);
    }
    elements.chatView.appendChild(row);
  });
}

function setupMessageListInteractions() {
  if (!elements.messageList) {
    return;
  }
  elements.messageList.addEventListener("click", (event) => {
    const item = event.target.closest(".message-item");
    if (!item) {
      return;
    }
    const messageId = item.dataset.id;
    if (event.target.dataset.action === "delete") {
      deleteMessage(messageId);
      return;
    }
    state.selectedMessageId = messageId;
    renderMessageList();
    renderMessageEditor();
  });

  elements.messageList.addEventListener("dragstart", (event) => {
    const item = event.target.closest(".message-item");
    if (!item) {
      return;
    }
    dragMessageId = item.dataset.id;
    item.classList.add("dragging");
    event.dataTransfer.setData("text/plain", dragMessageId);
  });

  elements.messageList.addEventListener("dragend", (event) => {
    const item = event.target.closest(".message-item");
    if (item) {
      item.classList.remove("dragging");
    }
    dragMessageId = null;
  });

  elements.messageList.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  elements.messageList.addEventListener("drop", (event) => {
    event.preventDefault();
    const target = event.target.closest(".message-item");
    if (!target || !dragMessageId) {
      return;
    }
    const targetId = target.dataset.id;
    if (targetId === dragMessageId) {
      return;
    }
    moveMessage(dragMessageId, targetId);
  });
}

function setupPreviewInteractions() {
  if (!elements.chatView) {
    return;
  }

  const syncMessageOrderFromPreview = () => {
    const rows = Array.from(elements.chatView.querySelectorAll(".msg-row"));
    if (!rows.length) {
      return;
    }
    const order = rows.map((row) => row.dataset.id).filter(Boolean);
    const messageMap = new Map(state.messages.map((msg) => [msg.id, msg]));
    const nextMessages = [];
    const seen = new Set();
    order.forEach((id) => {
      const message = messageMap.get(id);
      if (!message) {
        return;
      }
      nextMessages.push(message);
      seen.add(id);
    });
    state.messages.forEach((message) => {
      if (!seen.has(message.id)) {
        nextMessages.push(message);
      }
    });
    state.messages = nextMessages;
  };

  let dragState = null;

  const endDrag = (event) => {
    if (!dragState) {
      return;
    }
    const { row, placeholder, pointerId } = dragState;
    if (row.hasPointerCapture(pointerId)) {
      row.releasePointerCapture(pointerId);
    }
    row.classList.remove("dragging");
    row.style.removeProperty("top");
    row.style.removeProperty("left");
    row.style.removeProperty("width");
    row.style.removeProperty("position");
    row.style.removeProperty("z-index");
    row.style.removeProperty("pointer-events");
    row.style.removeProperty("transform");
    placeholder.replaceWith(row);
    elements.chatView.classList.remove("reordering");
    dragState = null;
    syncMessageOrderFromPreview();
    renderMessageList();
    renderPreview();
  };

  const onPointerMove = (event) => {
    if (!dragState) {
      return;
    }
    const { row, placeholder, offsetY } = dragState;
    const container = elements.chatView;
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const nextTop = event.clientY - containerRect.top + scrollTop - offsetY;
    row.style.top = `${Math.round(nextTop)}px`;

    const siblings = Array.from(
      container.querySelectorAll(".msg-row:not(.dragging)")
    );
    const target = siblings.find((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    if (target && target !== placeholder) {
      container.insertBefore(placeholder, target);
    } else if (!target) {
      container.appendChild(placeholder);
    }
  };

  elements.chatView.addEventListener("pointerdown", (event) => {
    if (!state.editMode) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest(".image-resize-handle")) {
      return;
    }
    if (event.target.closest(".edit-controls")) {
      return;
    }
    if (event.target.closest("button, input, textarea, select, label")) {
      return;
    }
    const row = event.target.closest(".msg-row");
    if (!row) {
      return;
    }
    event.preventDefault();
    const container = elements.chatView;
    const rowRect = row.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetY = event.clientY - rowRect.top;
    const placeholder = document.createElement("div");
    placeholder.className = "msg-row placeholder";
    placeholder.style.height = `${Math.round(rowRect.height)}px`;
    placeholder.dataset.id = row.dataset.id;
    row.parentNode.insertBefore(placeholder, row.nextSibling);

    const top = rowRect.top - containerRect.top + container.scrollTop;
    const left = rowRect.left - containerRect.left + container.scrollLeft;
    row.classList.add("dragging");
    row.style.position = "absolute";
    row.style.top = `${Math.round(top)}px`;
    row.style.left = `${Math.round(left)}px`;
    row.style.width = `${Math.round(rowRect.width)}px`;
    row.style.zIndex = "4";
    row.style.pointerEvents = "none";
    row.style.transform = "translateZ(0)";
    container.appendChild(row);
    container.classList.add("reordering");
    row.setPointerCapture(event.pointerId);
    dragState = {
      row,
      placeholder,
      offsetY,
      pointerId: event.pointerId,
    };
  });

  elements.chatView.addEventListener("pointermove", onPointerMove);
  elements.chatView.addEventListener("pointerup", endDrag);
  elements.chatView.addEventListener("pointercancel", endDrag);
}

function insertMessage({ type, text, imageDataUrl }, afterId = null) {
  if (!state.characters.length) {
    showError("キャラクターを1人以上追加してください。");
    return;
  }
  const speakerId = state.subjectiveId || state.characters[0].id;
  const newMessage = {
    id: `m${Date.now()}`,
    speakerId,
    type,
    text: text || "",
    imageDataUrl: imageDataUrl || "",
    imageWidth: null,
  };
  if (afterId) {
    const index = state.messages.findIndex((msg) => msg.id === afterId);
    if (index >= 0) {
      state.messages.splice(index + 1, 0, newMessage);
    } else {
      state.messages.push(newMessage);
    }
  } else if (state.selectedMessageId) {
    const index = state.messages.findIndex(
      (msg) => msg.id === state.selectedMessageId
    );
    if (index >= 0) {
      state.messages.splice(index + 1, 0, newMessage);
    } else {
      state.messages.push(newMessage);
    }
  } else {
    state.messages.push(newMessage);
  }
  state.selectedMessageId = newMessage.id;
  renderMessageList();
  renderMessageEditor();
  renderPreview();
  return newMessage;
}

function deleteMessage(messageId) {
  const index = state.messages.findIndex((msg) => msg.id === messageId);
  if (index < 0) {
    return;
  }
  const target = state.messages[index];
  const summary = getDeleteSummary(target);
  const confirmed = window.confirm(`${summary}を削除しますか？`);
  if (!confirmed) {
    return;
  }
  state.messages.splice(index, 1);
  if (state.selectedMessageId === messageId) {
    state.selectedMessageId = state.messages[index]?.id || state.messages[0]?.id || null;
  }
  renderMessageList();
  renderMessageEditor();
  renderPreview();
}

function getDeleteSummary(message) {
  if (!message || message.type === "image") {
    return "画像メッセージ";
  }
  const text = (message.text || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "空のメッセージ";
  }
  const snippet = text.length > 16 ? `${text.slice(0, 16)}…` : text;
  return `「${snippet}」`;
}

function moveMessage(fromId, toId) {
  const fromIndex = state.messages.findIndex((msg) => msg.id === fromId);
  const toIndex = state.messages.findIndex((msg) => msg.id === toId);
  if (fromIndex < 0 || toIndex < 0) {
    return;
  }
  const [moved] = state.messages.splice(fromIndex, 1);
  state.messages.splice(toIndex, 0, moved);
  renderMessageList();
  renderPreview();
}

function getCharacter(characterId) {
  return state.characters.find((character) => character.id === characterId);
}

function getCharacterName(characterId) {
  const character = getCharacter(characterId);
  return character?.name || "不明";
}

function getInitial(name) {
  const trimmed = (name || "").trim();
  return trimmed ? trimmed.charAt(0) : "?";
}

function isHtmlFile(file) {
  const lower = file.name.toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
}

function isImageFile(file) {
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg")
  );
}

function createTextNodeWithBreaks(text) {
  const wrapper = document.createElement("div");
  const parts = (text || "").split("\n");
  parts.forEach((part, index) => {
    if (index > 0) {
      wrapper.appendChild(document.createElement("br"));
    }
    wrapper.appendChild(document.createTextNode(part));
  });
  return wrapper;
}

function normalizeEditableText(text) {
  return (text || "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
}

function showError(message) {
  elements.errorBox.textContent = message;
  elements.errorBox.classList.remove("hidden");
}

function clearError() {
  elements.errorBox.classList.add("hidden");
  elements.errorBox.textContent = "";
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function safeFileName(value) {
  return (value || "line-chat")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function escapeHtml(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function collectDocumentStyles() {
  let cssText = "";
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      Array.from(sheet.cssRules || []).forEach((rule) => {
        cssText += `${rule.cssText}\n`;
      });
    } catch (error) {
      // Ignore cross-origin or unsupported styles.
    }
  });
  return cssText;
}

function exportPreviewAsPng() {
  const target = document.querySelector(".phone");
  if (!target) {
    showError("出力対象が見つかりません。");
    return;
  }
  updateClock();
  const rect = target.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const filename = `${safeFileName(state.chatTitle || "line-chat")}.png`;

  const saveCanvas = (canvas) => {
    if (!canvas) {
      showError("画像の生成に失敗しました。");
      return;
    }
    if (!canvas.toBlob) {
      try {
        const dataUrl = canvas.toDataURL("image/png");
        downloadDataUrl(dataUrl, filename);
      } catch (error) {
        showError("画像の生成に失敗しました。");
      }
      return;
    }
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          try {
            const dataUrl = canvas.toDataURL("image/png");
            downloadDataUrl(dataUrl, filename);
          } catch (error) {
            showError("画像の生成に失敗しました。");
          }
          return;
        }
        downloadBlob(blob, filename);
      }, "image/png");
    } catch (error) {
      try {
        const dataUrl = canvas.toDataURL("image/png");
        downloadDataUrl(dataUrl, filename);
      } catch (innerError) {
        showError("画像の生成に失敗しました。");
      }
    }
  };

  const clearCaptureMode = () => {
    target.classList.remove("capture-mode");
  };
  target.classList.add("capture-mode");

  const startCapture = () => {
    if (window.html2canvas) {
      window
        .html2canvas(target, {
          backgroundColor: null,
          scale,
          useCORS: true,
          ignoreElements: (element) =>
            element.classList?.contains("edit-controls") ||
            element.classList?.contains("image-resize-handle"),
        })
        .then((canvas) => {
          clearCaptureMode();
          saveCanvas(canvas);
        })
        .catch(() => {
          clearCaptureMode();
          showError("画像の生成に失敗しました。");
        });
      return;
    }

    const clone = target.cloneNode(true);
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.margin = "0";
    clone.style.transform = "none";
    clone
      .querySelectorAll(".edit-controls, .image-resize-handle")
      .forEach((el) => {
        el.remove();
      });
    const cssText = collectDocumentStyles();
    const wrapperStyle = `width:${width}px;height:${height}px;display:block;`;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="${wrapperStyle}">
            <style><![CDATA[${cssText}]]></style>
            ${clone.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `;
    const svgBlob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    const timeoutId = window.setTimeout(() => {
      clearCaptureMode();
      URL.revokeObjectURL(svgUrl);
      showError(
        "画像の生成に失敗しました。ブラウザを変更するかHTMLで出力してください。"
      );
    }, 3000);
    img.onload = () => {
      window.clearTimeout(timeoutId);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        showError("画像の生成に失敗しました。");
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      saveCanvas(canvas);
      clearCaptureMode();
      URL.revokeObjectURL(svgUrl);
    };
    img.onerror = () => {
      window.clearTimeout(timeoutId);
      clearCaptureMode();
      URL.revokeObjectURL(svgUrl);
      showError("画像の生成に失敗しました。");
    };
    img.src = svgUrl;
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(startCapture);
  });
}

function buildExportHtml() {
  const themeTokens = getThemeTokens(state.theme);
  const rows = state.messages
    .map((message) => {
      const character = getCharacter(message.speakerId);
      const isSubjective = message.speakerId === state.subjectiveId;
      const avatar = character?.avatarDataUrl
        ? `<img src="${character.avatarDataUrl}" alt="${escapeHtml(
            character?.name || "avatar"
          )}">`
        : `<span>${escapeHtml(getInitial(character?.name || "U"))}</span>`;
      const avatarClass = character?.avatarDataUrl
        ? "avatar"
        : "avatar avatar-empty";
      const nameHtml = isSubjective
        ? ""
        : `<div class="name">${escapeHtml(character?.name || "Unknown")}</div>`;
      const imageAltText = "画像メッセージ";
      const imagePlaceholderText = "画像未選択";
      const imageWrapStyle = message.imageWidth
        ? ` style="width: ${Math.round(message.imageWidth)}px;"`
        : "";
      const imageHtml = message.imageDataUrl
        ? `<img class="msg-image" src="${message.imageDataUrl}" alt="${escapeHtml(
            imageAltText
          )}">`
        : `<div class="msg-image msg-image-placeholder">${escapeHtml(
            imagePlaceholderText
          )}</div>`;
      const contentHtml =
        message.type === "image"
          ? `<div class="msg-image-wrap"${imageWrapStyle}>${imageHtml}</div>`
          : `<div class="bubble"><div class="text">${escapeHtml(
              message.text
            ).replace(/\n/g, "<br>")}</div></div>`;
      return `
        <div class="msg-row ${isSubjective ? "subjective" : ""}">
          ${isSubjective ? "" : `<div class="${avatarClass}">${avatar}</div>`}
          <div class="msg-content">
            ${nameHtml}
            ${contentHtml}
          </div>
        </div>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(state.chatTitle || "LINEチャット")}</title>
    <style>
      :root {
        --font-body: "Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
        --font-display: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
        --chat-bg: ${themeTokens.chatBg};
        --chat-bg-secondary: ${themeTokens.chatBgSecondary};
        --chat-header: ${themeTokens.headerBg};
        --chat-header-text: ${themeTokens.headerText};
        --bubble-left: ${themeTokens.bubbleLeft};
        --bubble-subjective: ${themeTokens.bubbleSubjective};
        --bubble-text: ${themeTokens.bubbleText};
        --stroke: ${themeTokens.stroke};
        --muted: ${themeTokens.muted};
        --accent: ${themeTokens.accent};
      }
      body {
        margin: 0;
        font-family: var(--font-body);
        background: #f1f3f6;
        color: #1f2b24;
      }
      .app {
        max-width: 420px;
        margin: 0 auto;
        padding: 24px 12px 40px;
      }
      .phone {
        border-radius: 24px;
        border: 1px solid var(--stroke);
        background: var(--chat-bg);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        min-height: 640px;
        overflow: hidden;
      }
      .status-bar {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        padding: 10px 14px 6px;
        font-size: 0.78rem;
        color: var(--chat-header-text);
        background: var(--chat-header);
      }
      .status-left {
        font-weight: 600;
      }
      .status-center {
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .status-right {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
      .icon-signal {
        width: 18px;
        height: 10px;
        display: inline-block;
        background: linear-gradient(
          to right,
          currentColor 0 3px,
          transparent 3px 5px,
          currentColor 5px 8px,
          transparent 8px 10px,
          currentColor 10px 13px,
          transparent 13px 15px,
          currentColor 15px 18px
        );
      }
      .icon-battery {
        position: relative;
        width: 22px;
        height: 10px;
        border: 1.5px solid currentColor;
        border-radius: 2px;
        box-sizing: border-box;
      }
      .icon-battery::before {
        content: "";
        position: absolute;
        inset: 2px 4px 2px 2px;
        background: currentColor;
        border-radius: 1px;
      }
      .icon-battery::after {
        content: "";
        position: absolute;
        top: 2px;
        right: -3px;
        width: 3px;
        height: 6px;
        background: currentColor;
        border-radius: 1px;
      }
      .chat-top {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 8px;
        padding: 6px 10px 10px;
        background: var(--chat-header);
        color: var(--chat-header-text);
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      }
      .chat-top-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .chat-title {
        font-weight: 700;
        font-size: 1rem;
        font-family: var(--font-display);
        letter-spacing: 0.01em;
        color: var(--chat-header-text);
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .icon-button {
        width: 30px;
        height: 30px;
        border: none;
        padding: 0;
        background: transparent;
        position: relative;
        color: currentColor;
      }
      .chat-top .icon-button {
        color: var(--chat-header-text);
      }
      .chat-input .icon-button {
        color: #3a3a3a;
      }
      .icon-button.back::before {
        content: "";
        position: absolute;
        left: 10px;
        top: 9px;
        width: 8px;
        height: 8px;
        border-left: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: rotate(45deg);
      }
      .icon-button.search::before {
        content: "";
        position: absolute;
        left: 8px;
        top: 8px;
        width: 10px;
        height: 10px;
        border: 2px solid currentColor;
        border-radius: 50%;
      }
      .icon-button.search::after {
        content: "";
        position: absolute;
        left: 18px;
        top: 18px;
        width: 6px;
        height: 2px;
        background: currentColor;
        transform: rotate(45deg);
      }
      .icon-button.call::before {
        content: "";
        position: absolute;
        left: 9px;
        top: 8px;
        width: 12px;
        height: 12px;
        border: 2px solid currentColor;
        border-radius: 6px;
        border-right-color: transparent;
        border-bottom-color: transparent;
        transform: rotate(-45deg);
      }
      .icon-button.menu::before,
      .icon-button.menu::after {
        content: "";
        position: absolute;
        left: 7px;
        width: 16px;
        height: 2px;
        background: currentColor;
        border-radius: 2px;
      }
      .icon-button.menu::before {
        top: 9px;
      }
      .icon-button.menu::after {
        top: 19px;
        box-shadow: 0 -5px 0 currentColor;
      }
      .chat-body {
        padding: 18px 16px;
        display: grid;
        gap: 12px;
        overflow: auto;
        background: linear-gradient(
          180deg,
          var(--chat-bg) 0%,
          var(--chat-bg) 70%,
          var(--chat-bg-secondary) 100%
        );
      }
      .chat-input {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: #ffffff;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
      }
      .chat-input-field {
        flex: 1;
        background: #f1f1f1;
        border-radius: 18px;
        padding: 8px 12px;
        font-size: 0.9rem;
        color: #9a9a9a;
      }
      .icon-button.plus::before,
      .icon-button.plus::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 14px;
        height: 2px;
        background: currentColor;
        transform: translate(-50%, -50%);
      }
      .icon-button.plus::after {
        width: 2px;
        height: 14px;
      }
      .icon-button.camera::before {
        content: "";
        position: absolute;
        left: 7px;
        top: 9px;
        width: 16px;
        height: 12px;
        border: 2px solid currentColor;
        border-radius: 3px;
      }
      .icon-button.camera::after {
        content: "";
        position: absolute;
        left: 13px;
        top: 13px;
        width: 6px;
        height: 6px;
        border: 2px solid currentColor;
        border-radius: 50%;
      }
      .icon-button.image::before {
        content: "";
        position: absolute;
        left: 7px;
        top: 9px;
        width: 16px;
        height: 12px;
        border: 2px solid currentColor;
        border-radius: 3px;
      }
      .icon-button.image::after {
        content: "";
        position: absolute;
        left: 10px;
        top: 16px;
        width: 10px;
        height: 4px;
        border-left: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: skewX(-20deg);
      }
      .icon-button.mic::before {
        content: "";
        position: absolute;
        left: 12px;
        top: 8px;
        width: 6px;
        height: 12px;
        border: 2px solid currentColor;
        border-radius: 3px;
      }
      .icon-button.mic::after {
        content: "";
        position: absolute;
        left: 10px;
        top: 20px;
        width: 10px;
        height: 2px;
        background: currentColor;
        border-radius: 2px;
      }
      .msg-row {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px;
        align-items: flex-start;
      }
      .msg-row.subjective {
        grid-template-columns: 1fr;
        justify-items: end;
      }
      .msg-row.subjective .avatar {
        display: none;
      }
      .msg-content {
        display: grid;
        gap: 4px;
        justify-items: start;
      }
      .msg-row.subjective .msg-content {
        justify-items: end;
      }
      .avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.08);
        display: grid;
        place-items: center;
        font-weight: 700;
        color: var(--accent);
      }
      .avatar-empty {
        background: rgba(6, 199, 85, 0.14);
        border-color: rgba(6, 199, 85, 0.2);
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .bubble {
        background: var(--bubble-left);
        color: var(--bubble-text);
        padding: 10px 14px;
        border-radius: 18px;
        border-top-left-radius: 6px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
        max-width: 520px;
        position: relative;
        font-size: 0.95rem;
        line-height: 1.45;
        display: inline-block;
      }
      .bubble::after {
        content: "";
        position: absolute;
        top: 6px;
        left: -6px;
        width: 12px;
        height: 12px;
        background: var(--bubble-left);
        border-radius: 2px;
        transform: rotate(45deg);
        box-shadow: none;
      }
      .subjective .bubble {
        background: var(--bubble-subjective);
        border-top-left-radius: 18px;
        border-top-right-radius: 6px;
        margin-left: auto;
        justify-self: end;
      }
      .subjective .bubble::after {
        left: auto;
        right: -6px;
        top: 6px;
        background: var(--bubble-subjective);
        box-shadow: none;
      }
      .name {
        font-size: 0.78rem;
        color: var(--muted);
        margin-bottom: 4px;
        font-weight: 600;
      }
      .bubble img {
        max-width: 100%;
        border-radius: 12px;
        display: block;
      }
      .msg-image-wrap {
        position: relative;
        display: inline-block;
        max-width: min(320px, 100%);
      }
      .msg-image {
        max-width: 100%;
        height: auto;
        display: block;
      }
      .msg-image-placeholder {
        width: 220px;
        height: 140px;
        border: 1px dashed rgba(0, 0, 0, 0.2);
        color: var(--muted);
        background: #ffffff;
        display: grid;
        place-items: center;
        font-size: 0.85rem;
      }
      .text {
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <div class="app">
      <div class="phone">
        <div class="status-bar">
          <div class="status-left">MiGoBank</div>
          <div id="statusTime" class="status-center">--:--</div>
          <div class="status-right">
            <span class="icon-signal" aria-hidden="true"></span>
            <span class="icon-battery" aria-hidden="true"></span>
          </div>
        </div>
        <div class="chat-top">
          <div class="icon-button back" aria-hidden="true"></div>
          <div class="chat-title">${escapeHtml(state.chatTitle || "LINEチャット")}</div>
          <div class="chat-top-actions">
            <div class="icon-button search" aria-hidden="true"></div>
            <div class="icon-button call" aria-hidden="true"></div>
            <div class="icon-button menu" aria-hidden="true"></div>
          </div>
        </div>
        <div class="chat-body">
          ${rows}
        </div>
        <div class="chat-input">
          <div class="icon-button plus" aria-hidden="true"></div>
          <div class="icon-button camera" aria-hidden="true"></div>
          <div class="icon-button image" aria-hidden="true"></div>
          <div class="chat-input-field">Aa</div>
          <div class="icon-button mic" aria-hidden="true"></div>
        </div>
      </div>
    </div>
    <script>
      (function () {
        function updateClock() {
          var now = new Date();
          var hours = String(now.getHours()).padStart(2, "0");
          var minutes = String(now.getMinutes()).padStart(2, "0");
          var statusTime = document.getElementById("statusTime");
          if (statusTime) {
            statusTime.textContent = hours + ":" + minutes;
          }
        }
        updateClock();
        setInterval(updateClock, 1000);
      })();
    </script>
  </body>
</html>`;
}

function getThemeTokens(themeId) {
  switch (themeId) {
    case "sakura":
      return {
        bg: "#f9edf0",
        chatBg: "#fff7f8",
        chatBgSecondary: "#f1e7ec",
        bubbleLeft: "#ffffff",
        bubbleSubjective: "#ffd7bf",
        bubbleText: "#1c1c1c",
        stroke: "rgba(21, 34, 54, 0.1)",
        muted: "#6f6a63",
        accent: "#d36b7d",
        headerBg: "#f2e8ee",
        headerText: "#4a3c43",
      };
    case "amber":
      return {
        bg: "#f4efe5",
        chatBg: "#fff8ef",
        chatBgSecondary: "#efe5d7",
        bubbleLeft: "#ffffff",
        bubbleSubjective: "#dce6ff",
        bubbleText: "#1c1c1c",
        stroke: "rgba(21, 34, 54, 0.1)",
        muted: "#6f6a63",
        accent: "#c87937",
        headerBg: "#f1e6d7",
        headerText: "#4b3b2a",
      };
    case "midnight":
      return {
        bg: "#0d1117",
        chatBg: "#121822",
        chatBgSecondary: "#182032",
        bubbleLeft: "#1e2533",
        bubbleSubjective: "#2d2a4d",
        bubbleText: "#f4f4f4",
        stroke: "rgba(255, 255, 255, 0.08)",
        muted: "#9aa4b2",
        accent: "#5dc2b0",
        headerBg: "#0e141d",
        headerText: "#f4f4f4",
      };
    case "mint":
    default:
      return {
        bg: "#eaf6ef",
        chatBg: "#9fb1d8",
        chatBgSecondary: "#b9c7e7",
        bubbleLeft: "#ffffff",
        bubbleSubjective: "#9eea6a",
        bubbleText: "#1f2b24",
        stroke: "rgba(0, 0, 0, 0.12)",
        muted: "#5f6f67",
        accent: "#06c755",
        headerBg: "#9aaed6",
        headerText: "#1c2432",
      };
  }
}
