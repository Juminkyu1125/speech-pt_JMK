const API_BASE_URL = "http://127.0.0.1:8000";

const params = new URLSearchParams(window.location.search);
const noteId = params.get("note_id");

const noteTitleElement = document.getElementById("noteTitle");
const noteDescriptionElement = document.getElementById("noteDescription");
const noticeText = document.querySelector(".notice-bar p");
const documentInput = document.getElementById("documentFile");
const audioInput = document.getElementById("audioFile");
const attachedFilesContainer = document.getElementById("attachedFiles");
const slidePreviewElement = document.querySelector(".slide-preview");
const pdfJsWorkerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

function initPdfJsWorker() {
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsWorkerSrc;
    return true;
  }
  return false;
}

function isPdfJsAvailable() {
  return Boolean(window.pdfjsLib && typeof window.pdfjsLib.getDocument === "function");
}

const filePicker = document.getElementById("filePicker");
const attachFileButton = document.getElementById("attachFileButton");
const runAnalysisButton = document.getElementById("runAnalysisButton");
const contentCoverageElement = document.getElementById("contentCoverageScore");
const deliveryStabilityElement = document.getElementById("deliveryStabilityScore");
const pacingScoreElement = document.getElementById("pacingScore");
const summaryElement = document.getElementById("analysisSummary");
const strengthsListElement = document.getElementById("strengthsList");
const improvementsListElement = document.getElementById("improvementsList");
const sectionsListElement = document.getElementById("sectionsList");
const chatBodyElement = document.querySelector(".chat-body");
let analysisStatusMessage = null;

let documentUploadId = null;
let audioUploadId = null;
let analysisId = null;
let pollingTimer = null;

function setNotice(message) {
  if (noticeText) {
    noticeText.textContent = message;
  }
}

function setButtonDisabled(button, disabled) {
  if (!button) {
    return;
  }

  button.disabled = disabled;
  button.style.opacity = disabled ? "0.6" : "1";
  button.style.pointerEvents = disabled ? "none" : "auto";
}

function setElementText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function formatStatusText(status, stage = null, progress = null) {
  const stageText = stage ? ` / 단계: ${stage}` : "";
  const progressText = typeof progress === "number" ? ` / 진행률: ${progress}%` : "";
  return `상태: ${status}${stageText}${progressText}`;
}

function clearList(element, emptyMessage) {
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

function renderTextList(element, items, fallbackMessage) {
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

function renderSections(sections) {
  if (!sectionsListElement) {
    return;
  }

  sectionsListElement.innerHTML = "";

  if (!sections || sections.length === 0) {
    const item = document.createElement("li");
    item.textContent = "섹션 결과가 아직 없습니다.";
    sectionsListElement.appendChild(item);
    return;
  }

  sections.forEach((section) => {
    const item = document.createElement("li");
    item.textContent = `${section.section_index}. ${section.title} (${section.start_time_sec}s ~ ${section.end_time_sec}s) / 점수: ${section.score} / ${section.feedback}`;
    sectionsListElement.appendChild(item);
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
  removeButton.addEventListener("click", () => removeAttachedFile(kind));
  chip.appendChild(removeButton);

  return chip;
}

function renderAttachedFileChip(kind, file) {
  if (!attachedFilesContainer) {
    return;
  }

  const existingChip = attachedFilesContainer.querySelector(`[data-kind="${kind}"]`);
  if (existingChip) {
    existingChip.remove();
  }

  if (!file) {
    return;
  }

  const chip = createFileChip(kind, file);
  attachedFilesContainer.appendChild(chip);
}

function renderDocumentPreview(file) {
  if (!slidePreviewElement) {
    return;
  }

  if (!file) {
    const existingPreview = slidePreviewElement.querySelector(".document-preview");
    if (existingPreview) {
      existingPreview.remove();
    }
    return;
  }

  let previewContainer = slidePreviewElement.querySelector(".document-preview");
  if (!previewContainer) {
    previewContainer = document.createElement("div");
    previewContainer.className = "document-preview";
    slidePreviewElement.appendChild(previewContainer);
  }
  previewContainer.innerHTML = "";

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const canvas = document.createElement("canvas");
    canvas.className = "document-preview-canvas";
    previewContainer.appendChild(canvas);

    if (!isPdfJsAvailable()) {
      previewContainer.textContent = "PDF 미리보기를 생성할 수 없습니다. pdf.js 라이브러리를 불러오지 못했습니다.";
      return;
    }

    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const pdfData = new Uint8Array(reader.result);
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        const renderContext = {
          canvasContext: context,
          viewport,
        };
        await page.render(renderContext).promise;
      } catch (error) {
        console.error(error);
        previewContainer.textContent = "PDF 미리보기를 생성할 수 없습니다.";
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const message = document.createElement("div");
    message.className = "document-preview-fallback";
    message.textContent = `${file.name} 파일이 선택되었습니다. PDF 파일에서 첫 페이지 미리보기를 지원합니다.`;
    previewContainer.appendChild(message);
  }
}

function addMessageToChat(text, isUser = false, attachments = []) {
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

function setAnalysisChatStatus(text) {
  if (!chatBodyElement) {
    return;
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
}

function clearAnalysisChatStatus() {
  if (analysisStatusMessage) {
    analysisStatusMessage.remove();
    analysisStatusMessage = null;
  }
}

function getSelectedAttachments() {
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

function clearSelectedFiles() {
  if (documentInput) {
    documentInput.value = "";
    documentUploadId = null;
    renderAttachedFileChip("document", null);
  }

  if (audioInput) {
    audioInput.value = "";
    audioUploadId = null;
    renderAttachedFileChip("audio", null);
  }

  if (filePicker) {
    filePicker.value = "";
  }
}

function removeAttachedFile(kind) {
  const dt = new DataTransfer();

  if (kind === "document" && documentInput) {
    documentInput.files = dt.files;
    documentUploadId = null;
    renderAttachedFileChip("document", null);
  }

  if (kind === "audio" && audioInput) {
    audioInput.files = dt.files;
    audioUploadId = null;
    renderAttachedFileChip("audio", null);
  }
}

function renderEmptyResult() {
  setElementText(contentCoverageElement, "- ");
  setElementText(deliveryStabilityElement, "- ");
  setElementText(pacingScoreElement, "- ");
  setElementText(summaryElement, "분석 결과가 아직 없습니다.");
  clearList(strengthsListElement, "강점 데이터가 아직 없습니다.");
  clearList(improvementsListElement, "개선점 데이터가 아직 없습니다.");
  clearList(sectionsListElement, "섹션 결과가 아직 없습니다.");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "요청 처리 중 오류가 발생했습니다.");
  }

  return response.json();
}

async function fetchNoteDetail() {
  if (!noteId) {
    throw new Error("note_id가 없습니다.");
  }

  const note = await fetchJson(`${API_BASE_URL}/notes/${noteId}`);
  setElementText(noteTitleElement, note.title || "제목 없는 노트");
  setElementText(noteDescriptionElement, note.description || "설명이 없는 노트입니다.");
}

function buildPresignPayload(file, kind) {
  return {
    note_id: noteId,
    kind,
    file_name: file.name,
    content_type: file.type || "application/octet-stream",
    size_bytes: file.size,
  };
}

async function completeUpload(uploadId) {
  await fetchJson(`${API_BASE_URL}/uploads/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      upload_id: uploadId,
      checksum: null,
    }),
  });
}

async function createUploadRecord(file, kind) {
  const presignResult = await fetchJson(`${API_BASE_URL}/uploads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPresignPayload(file, kind)),
  });

  await completeUpload(presignResult.upload_id);
  return presignResult.upload_id;
}

async function uploadSelectedFiles() {
  const hasDocumentFile = documentInput?.files?.[0];
  const hasAudioFile = audioInput?.files?.[0];

  if (!hasDocumentFile || !hasAudioFile) {
    setNotice("문서와 음성 파일을 모두 선택해야 분석을 시작할 수 있습니다.");
    return false;
  }

  if (!documentUploadId && hasDocumentFile) {
    setAnalysisChatStatus("문서 업로드를 시작합니다...");
    await handleDocumentUpload();
  }

  if (!audioUploadId && hasAudioFile) {
    setAnalysisChatStatus("음성 업로드를 시작합니다...");
    await handleAudioUpload();
  }

  if (documentUploadId && audioUploadId) {
    setAnalysisChatStatus("모든 파일 업로드가 완료되었습니다. 이제 분석을 시작합니다.");
  }

  return Boolean(documentUploadId && audioUploadId);
}

async function handleDocumentUpload() {
  const file = documentInput?.files?.[0];
  if (!file) {
    window.alert("문서 파일을 먼저 선택해주세요.");
    return;
  }

  setNotice("문서 업로드 정보를 생성하는 중입니다.");

  try {
    documentUploadId = await createUploadRecord(file, "document");
    setNotice("문서 업로드 정보 생성을 완료했습니다.");
  } catch (error) {
    console.error(error);
    documentUploadId = null;
    setNotice("문서 업로드 처리 중 오류가 발생했습니다.");
    window.alert("문서 업로드 처리에 실패했습니다.");
  }
}

async function handleAudioUpload() {
  const file = audioInput?.files?.[0];
  if (!file) {
    window.alert("음성 파일을 먼저 선택해주세요.");
    return;
  }

  setNotice("음성 업로드 정보를 생성하는 중입니다.");

  try {
    audioUploadId = await createUploadRecord(file, "audio");
    setNotice("음성 업로드 정보 생성을 완료했습니다.");
  } catch (error) {
    console.error(error);
    audioUploadId = null;
    setNotice("음성 업로드 처리 중 오류가 발생했습니다.");
    window.alert("음성 업로드 처리에 실패했습니다.");
  }
}

async function fetchAnalysisResult() {
  if (!analysisId) {
    return;
  }

  try {
    const result = await fetchJson(`${API_BASE_URL}/analyses/${analysisId}/result`);

    if (!result.is_ready) {
      renderEmptyResult();
      setNotice("분석 결과가 아직 준비되지 않았습니다.");
      return;
    }

    setElementText(contentCoverageElement, String(result.scores?.content_coverage ?? "-"));
    setElementText(deliveryStabilityElement, String(result.scores?.delivery_stability ?? "-"));
    setElementText(pacingScoreElement, String(result.scores?.pacing_score ?? "-"));
    setElementText(summaryElement, result.summary || "요약 데이터가 없습니다.");
    renderTextList(strengthsListElement, result.strengths, "강점 데이터가 없습니다.");
    renderTextList(improvementsListElement, result.improvements, "개선점 데이터가 없습니다.");
    renderSections(result.sections);
    setAnalysisChatStatus("분석이 완료되었습니다. 결과를 확인하세요.");
    setNotice("분석 결과를 불러왔습니다.");
  } catch (error) {
    console.error(error);
    setNotice("분석 결과를 불러오는 중 오류가 발생했습니다.");
    setButtonDisabled(runAnalysisButton, false);
  }
}

async function pollAnalysisStatus() {
  if (!analysisId) {
    return;
  }

  try {
    const statusData = await fetchJson(`${API_BASE_URL}/analyses/${analysisId}/status`);
    setAnalysisChatStatus(`분석 중... ${statusData.stage} / 진행률 ${statusData.progress}%`);

    if (statusData.status === "done") {
      window.clearInterval(pollingTimer);
      pollingTimer = null;
      await fetchAnalysisResult();
      setButtonDisabled(runAnalysisButton, false);
      return;
    }

    if (statusData.status === "failed") {
      window.clearInterval(pollingTimer);
      pollingTimer = null;
      setAnalysisChatStatus("분석이 실패했습니다. 다시 시도해주세요.");
      setNotice("분석이 실패했습니다.");
      setButtonDisabled(runAnalysisButton, false);
    }
  } catch (error) {
    console.error(error);
    window.clearInterval(pollingTimer);
    pollingTimer = null;
    setNotice("분석 상태 조회 중 오류가 발생했습니다.");
    setButtonDisabled(runAnalysisButton, false);
  }
}

async function runAnalysis() {
  if (!noteId) {
    window.alert("note_id가 없어 분석을 진행할 수 없습니다.");
    return false;
  }

  const hasDocumentFile = documentInput?.files?.[0];
  const hasAudioFile = audioInput?.files?.[0];

  if (!hasDocumentFile && !hasAudioFile) {
    return false;
  }

  setAnalysisChatStatus("분석 중입니다...");
  const filesReady = await uploadSelectedFiles();
  if (!filesReady) {
    return false;
  }

  setButtonDisabled(runAnalysisButton, true);
  setAnalysisChatStatus("분석 작업을 생성 중입니다. 파일 업로드와 분석을 준비 중입니다...");
  setNotice("분석 작업을 생성하는 중입니다.");
  renderEmptyResult();

  try {
    const createdAnalysis = await fetchJson(`${API_BASE_URL}/notes/${noteId}/analyses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_upload_id: documentUploadId,
        audio_upload_id: audioUploadId,
        pipeline_version: "v0.1",
        model_version_ce: "ce-v0.1",
        model_version_ae: "ae-v0.1",
      }),
    });

    analysisId = createdAnalysis.analysis_id;
    setAnalysisChatStatus(`분석 작업을 생성했습니다. 상태를 확인하는 중입니다. 현재 ${createdAnalysis.stage}, 진행률 ${createdAnalysis.progress}%`);
    setNotice("분석 작업을 생성했습니다. 상태를 확인하는 중입니다.");

    if (pollingTimer) {
      window.clearInterval(pollingTimer);
    }
    pollingTimer = window.setInterval(pollAnalysisStatus, 2000);
    await pollAnalysisStatus();
    return true;
  } catch (error) {
    console.error(error);
    setNotice("분석 실행 중 오류가 발생했습니다.");
    setAnalysisChatStatus("분석 작업 생성에 실패했습니다. 다시 시도해주세요.");
    setButtonDisabled(runAnalysisButton, false);
    window.alert("분석 실행에 실패했습니다.");
    return false;
  }
}

function isAudioFile(file) {
  const audioExtensions = [".wav"];
  const audioMimeTypes = ["audio/wav", "audio/x-wav", "audio/wave"];

  const lowerName = file.name.toLowerCase();
  const isAudioByExt = audioExtensions.some((ext) => lowerName.endsWith(ext));
  const isAudioByMime = audioMimeTypes.some((type) => file.type === type);

  return isAudioByExt || isAudioByMime;
}

function isDocumentFile(file) {
  const docExtensions = [".pdf", ".ppt", ".pptx"];
  const docMimeTypes = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  const lowerName = file.name.toLowerCase();
  const isDocByExt = docExtensions.some((ext) => lowerName.endsWith(ext));
  const isDocByMime = docMimeTypes.some((type) => file.type === type);

  return isDocByExt || isDocByMime;
}

function handleDroppedFiles(files) {
  for (let file of files) {
    if (isDocumentFile(file)) {
      const dt = new DataTransfer();
      dt.items.add(file);
      documentInput.files = dt.files;
      documentInput.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (isAudioFile(file)) {
      const dt = new DataTransfer();
      dt.items.add(file);
      audioInput.files = dt.files;
      audioInput.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      window.alert(`지원하지 않는 파일 형식입니다: ${file.name}\n\n지원 형식: PDF, PPT, PPTX, WAV`);
    }
  }
}

function preventDefaultDragDrop(event) {
  event.preventDefault();
  event.stopPropagation();
}

function setupDragAndDrop() {
  const dropzone = document.getElementById("chatDropzone");

  if (!dropzone) {
    return;
  }

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    window.addEventListener(eventName, preventDefaultDragDrop);
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragenter", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("drag-over");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("drag-over");

    const files = e.dataTransfer.files;
    handleDroppedFiles(files);
  });
}

function bindInputListeners() {
  if (documentInput) {
    documentInput.addEventListener("change", () => {
      documentUploadId = null;
      const file = documentInput.files?.[0];
      renderAttachedFileChip("document", file);
      renderDocumentPreview(file);
    });
  }

  if (audioInput) {
    audioInput.addEventListener("change", () => {
      audioUploadId = null;
      const file = audioInput.files?.[0];
      renderAttachedFileChip("audio", file);
    });
  }

  if (attachFileButton) {
    attachFileButton.addEventListener("click", () => filePicker?.click());
  }

  if (filePicker) {
    filePicker.addEventListener("change", () => {
      const files = filePicker.files;
      if (files?.length) {
        handleDroppedFiles(files);
      }
    });
  }

  if (runAnalysisButton) {
    runAnalysisButton.addEventListener("click", async () => {
      const attachments = getSelectedAttachments();
      const started = await runAnalysis();
      if (attachments.length > 0 && started) {
        clearSelectedFiles();
      }
    });
  }

  // Enter key handler for text input
  const textInput = document.querySelector('.chat-input-box input[type="text"]');
  if (textInput) {
    textInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const message = textInput.value.trim();
        const attachments = getSelectedAttachments();

        if (!message && attachments.length === 0) {
          return;
        }

        addMessageToChat(message, true, attachments);
        textInput.value = "";
        const started = await runAnalysis();

        if (attachments.length > 0 && started) {
          clearSelectedFiles();
        }
      }
    });
  }

  // Back button handler
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", () => {
      window.location.href = "./note.html";
    });
  }
}

async function initAnalysisPage() {
  renderEmptyResult();
  bindInputListeners();
  setupDragAndDrop();

  if (!initPdfJsWorker()) {
    setNotice("PDF 미리보기를 위해 pdf.js를 불러옵니다. 네트워크 연결을 확인해주세요.");
  }

  if (!noteId) {
    setButtonDisabled(runAnalysisButton, true);
    return;
  }

  setNotice("노트 정보를 불러오는 중입니다.");
  clearAnalysisChatStatus();

  try {
    await fetchNoteDetail();
    setNotice("노트 정보를 불러왔습니다. 문서와 음성 파일을 준비해주세요.");
  } catch (error) {
    console.error(error);
    setNotice("노트 정보를 불러오지 못했습니다.");
    setAnalysisChatStatus("노트 정보 조회에 실패했습니다.");
    setButtonDisabled(runAnalysisButton, true);
  }
}

document.addEventListener("DOMContentLoaded", initAnalysisPage);