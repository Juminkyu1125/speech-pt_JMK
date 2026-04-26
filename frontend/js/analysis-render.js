export function setNotice(element, message) {
  if (!element) {
    return;
  }

  element.textContent = message;
}

export function setButtonDisabled(button, disabled) {
  if (!button) {
    return;
  }

  button.disabled = disabled;
  button.style.opacity = disabled ? "0.6" : "1";
  button.style.pointerEvents = disabled ? "none" : "auto";
}

export function setElementText(element, text) {
  if (!element) {
    return;
  }

  element.textContent = text;
}

export function clearList(element, emptyMessage) {
  if (!element) {
    return;
  }

  element.innerHTML = "";

  if (emptyMessage) {
    const item = document.createElement("li");
    item.textContent = emptyMessage;
    element.appendChild(item);
  }
}

export function renderTextList(element, items, fallbackMessage) {
  if (!element) {
    return;
  }

  element.innerHTML = "";

  if (!items || items.length === 0) {
    const item = document.createElement("li");
    item.textContent = fallbackMessage;
    element.appendChild(item);
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry.text;
    element.appendChild(item);
  });
}

export function renderSections(element, sections) {
  if (!element) {
    return;
  }

  element.innerHTML = "";

  if (!sections || sections.length === 0) {
    const item = document.createElement("li");
    item.textContent = "섹션 결과가 아직 없습니다.";
    element.appendChild(item);
    return;
  }

  sections.forEach((section) => {
    const item = document.createElement("li");
    item.textContent = `${section.section_index}. ${section.title} (${section.start_time_sec}s ~ ${section.end_time_sec}s) / 점수: ${section.score} / ${section.feedback}`;
    element.appendChild(item);
  });
}

function createFileChip(kind, file) {
  const chip = document.createElement("div");
  chip.className = "attached-file-chip";
  chip.dataset.kind = kind;

  const label = document.createElement("span");
  label.textContent = kind === "audio" ? `음성: ${file.name}` : `문서: ${file.name}`;
  chip.appendChild(label);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "×";
  chip.appendChild(removeButton);

  return chip;
}

export function renderAttachedFileChip(container, kind, file, removeCallback) {
  if (!container) {
    return;
  }

  const existingChip = container.querySelector(`[data-kind="${kind}"]`);
  if (existingChip) {
    existingChip.remove();
  }

  if (!file) {
    return;
  }

  const chip = createFileChip(kind, file);
  chip.querySelector("button").addEventListener("click", () => removeCallback(kind));
  container.appendChild(chip);
}

function formatFileSize(size) {
  if (!Number.isFinite(size) || size <= 0) {
    return "크기 정보 없음";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const digits = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[index]}`;
}

export function renderDocumentPreview(container, file, previewUrl) {
  if (!container) {
    return;
  }

  if (!file) {
    container.className = "document-preview-empty";
    container.innerHTML = `
      <p class="document-preview-title">문서를 업로드하면 이곳에 미리보기가 표시됩니다.</p>
      <p class="document-preview-subtext">PDF는 바로 볼 수 있고, PPT/PPTX는 파일 정보를 확인할 수 있습니다.</p>
    `;
    return;
  }

  const lowerName = file.name.toLowerCase();
  const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";

  if (isPdf && previewUrl) {
    container.className = "";
    container.innerHTML = "";

    const frame = document.createElement("iframe");
    frame.className = "document-preview-frame";
    frame.src = previewUrl;
    frame.title = `${file.name} 미리보기`;
    container.appendChild(frame);
    return;
  }

  container.className = "document-preview-card";
  container.innerHTML = "";

  const badge = document.createElement("span");
  badge.className = "document-preview-badge";
  badge.textContent = lowerName.endsWith(".pptx") ? "PPTX FILE" : "PPT FILE";

  const meta = document.createElement("div");
  meta.className = "document-preview-meta";

  const fileName = document.createElement("p");
  fileName.className = "document-preview-filename";
  fileName.textContent = file.name;

  const info = document.createElement("p");
  info.className = "document-preview-info";
  info.textContent = `브라우저에서 PPT/PPTX 슬라이드를 직접 렌더링할 수 없어 파일 정보만 먼저 표시합니다. 크기: ${formatFileSize(file.size)}`;

  const subtext = document.createElement("p");
  subtext.className = "document-preview-subtext";
  subtext.textContent = "분석은 그대로 진행되며, 이후 서버 썸네일이나 슬라이드 이미지 API가 연결되면 실제 페이지 미리보기로 확장할 수 있습니다.";

  meta.append(fileName, info, subtext);
  container.append(badge, meta);
}

export function addMessageToChat(chatBodyElement, text, isUser = false, attachments = []) {
  if (!chatBodyElement || (!text.trim() && attachments.length === 0)) {
    return;
  }

  const message = document.createElement("div");
  message.className = `chat-message${isUser ? " user" : ""}`;

  if (text.trim()) {
    const contentLine = document.createElement("div");
    contentLine.textContent = text;
    message.appendChild(contentLine);
  }

  if (attachments.length > 0) {
    const attachmentBlock = document.createElement("div");
    attachmentBlock.className = "attachment-preview";

    const title = document.createElement("div");
    title.textContent = "첨부 파일";
    attachmentBlock.appendChild(title);

    attachments.forEach((attachment) => {
      const item = document.createElement("div");
      item.className = "attachment-item";
      item.textContent = `${attachment.label}: ${attachment.name}`;
      attachmentBlock.appendChild(item);
    });

    message.appendChild(attachmentBlock);
  }

  chatBodyElement.appendChild(message);
  chatBodyElement.scrollTop = chatBodyElement.scrollHeight;
}

export function updateAnalysisStatusMessage(chatBodyElement, text, analysisStatusMessage) {
  if (!chatBodyElement) {
    return analysisStatusMessage;
  }

  if (!analysisStatusMessage) {
    analysisStatusMessage = document.createElement("div");
    analysisStatusMessage.className = "chat-message bot status-message";
    analysisStatusMessage.textContent = text;
    chatBodyElement.appendChild(analysisStatusMessage);
  } else {
    analysisStatusMessage.textContent = text;
  }

  chatBodyElement.scrollTop = chatBodyElement.scrollHeight;
  return analysisStatusMessage;
}

export function clearAnalysisStatusMessage(analysisStatusMessage) {
  if (analysisStatusMessage) {
    analysisStatusMessage.remove();
  }
  return null;
}

export function getSelectedAttachments(documentInput, audioInput) {
  const attachments = [];
  const documentFile = documentInput?.files?.[0];
  const audioFile = audioInput?.files?.[0];

  if (documentFile) {
    attachments.push({ label: "문서", name: documentFile.name });
  }
  if (audioFile) {
    attachments.push({ label: "음성", name: audioFile.name });
  }

  return attachments;
}

export function clearSelectedFiles(documentInput, audioInput, filePicker, renderAttachedFileChip, attachedFilesContainer) {
  if (documentInput) {
    documentInput.value = "";
    renderAttachedFileChip(attachedFilesContainer, "document", null, () => {});
  }

  if (audioInput) {
    audioInput.value = "";
    renderAttachedFileChip(attachedFilesContainer, "audio", null, () => {});
  }

  if (filePicker) {
    filePicker.value = "";
  }
}

export function renderEmptyResult(elements) {
  setElementText(elements.contentCoverageElement, "- ");
  setElementText(elements.deliveryStabilityElement, "- ");
  setElementText(elements.pacingScoreElement, "- ");
  setElementText(elements.summaryElement, "분석 결과가 아직 없습니다.");
  clearList(elements.strengthsListElement, "강점 데이터가 아직 없습니다.");
  clearList(elements.improvementsListElement, "개선점 데이터가 아직 없습니다.");
  clearList(elements.sectionsListElement, "섹션 결과가 아직 없습니다.");
}
