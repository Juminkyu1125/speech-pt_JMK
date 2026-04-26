import { API_BASE_URL, fetchJson } from "./auth.js";

export { API_BASE_URL, fetchJson };

const audioExtensions = [".wav"];
const audioMimeTypes = ["audio/wav", "audio/x-wav", "audio/wave"];
const docExtensions = [".pdf", ".ppt", ".pptx"];
const docMimeTypes = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export function buildPresignPayload(noteId, file, kind) {
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

async function createUploadRecord(noteId, file, kind) {
  const presignResult = await fetchJson(`${API_BASE_URL}/uploads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPresignPayload(noteId, file, kind)),
  });

  await completeUpload(presignResult.upload_id);
  return presignResult.upload_id;
}

async function handleDocumentUpload(noteId, file, setNotice) {
  if (!file) {
    window.alert("문서 파일을 먼저 선택해주세요.");
    return null;
  }

  setNotice("문서 업로드 정보를 생성하는 중입니다.");

  try {
    return await createUploadRecord(noteId, file, "document");
  } catch (error) {
    console.error(error);
    setNotice("문서 업로드 처리 중 오류가 발생했습니다.");
    window.alert("문서 업로드 처리에 실패했습니다.");
    return null;
  }
}

async function handleAudioUpload(noteId, file, setNotice) {
  if (!file) {
    window.alert("음성 파일을 먼저 선택해주세요.");
    return null;
  }

  setNotice("음성 업로드 정보를 생성하는 중입니다.");

  try {
    return await createUploadRecord(noteId, file, "audio");
  } catch (error) {
    console.error(error);
    setNotice("음성 업로드 처리 중 오류가 발생했습니다.");
    window.alert("음성 업로드 처리에 실패했습니다.");
    return null;
  }
}

export async function uploadSelectedFiles(
  noteId,
  documentInput,
  audioInput,
  setNotice,
  setAnalysisChatStatus,
  currentDocumentUploadId,
  currentAudioUploadId
) {
  const documentFile = documentInput?.files?.[0];
  const audioFile = audioInput?.files?.[0];

  if (!documentFile || !audioFile) {
    setNotice("문서와 음성 파일을 모두 선택해야 분석을 시작할 수 있습니다.");
    return {
      success: false,
      documentUploadId: currentDocumentUploadId,
      audioUploadId: currentAudioUploadId,
    };
  }

  let documentUploadId = currentDocumentUploadId;
  let audioUploadId = currentAudioUploadId;

  if (documentFile) {
    setAnalysisChatStatus("문서 업로드를 시작합니다...");
    documentUploadId = await handleDocumentUpload(noteId, documentFile, setNotice);
  }

  if (audioFile) {
    setAnalysisChatStatus("음성 업로드를 시작합니다...");
    audioUploadId = await handleAudioUpload(noteId, audioFile, setNotice);
  }

  if (documentUploadId && audioUploadId) {
    setAnalysisChatStatus("모든 파일 업로드가 완료되었습니다. 이제 분석을 시작합니다.");
  }

  return {
    success: Boolean(documentUploadId && audioUploadId),
    documentUploadId,
    audioUploadId,
  };
}

export function isAudioFile(file) {
  const lowerName = file.name.toLowerCase();
  const isAudioByExt = audioExtensions.some((ext) => lowerName.endsWith(ext));
  const isAudioByMime = audioMimeTypes.some((type) => file.type === type);

  return isAudioByExt || isAudioByMime;
}

export function isDocumentFile(file) {
  const lowerName = file.name.toLowerCase();
  const isDocByExt = docExtensions.some((ext) => lowerName.endsWith(ext));
  const isDocByMime = docMimeTypes.some((type) => file.type === type);

  return isDocByExt || isDocByMime;
}

export function handleDroppedFiles(files, documentInput, audioInput) {
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

export function preventDefaultDragDrop(event) {
  event.preventDefault();
  event.stopPropagation();
}
