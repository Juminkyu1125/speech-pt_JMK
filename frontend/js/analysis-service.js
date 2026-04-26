import { API_BASE_URL, fetchJson, uploadSelectedFiles } from "./analysis-upload.js";
import { renderEmptyResult, setElementText, renderTextList, renderSections } from "./analysis-render.js";

export async function fetchNoteDetail(noteId) {
  if (!noteId) {
    throw new Error("note_id가 없습니다.");
  }

  return await fetchJson(`${API_BASE_URL}/notes/${noteId}`);
}

export async function fetchAnalysisResult({ analysisId, elements, updateNotice, updateAnalysisChatStatus, setButtonDisabled }) {
  if (!analysisId) {
    return;
  }

  try {
    const result = await fetchJson(`${API_BASE_URL}/analyses/${analysisId}/result`);

    if (!result.is_ready) {
      renderEmptyResult(elements);
      updateNotice("분석 결과가 아직 준비되지 않았습니다.");
      return;
    }

    setElementText(elements.contentCoverageElement, String(result.scores?.content_coverage ?? "-"));
    setElementText(elements.deliveryStabilityElement, String(result.scores?.delivery_stability ?? "-"));
    setElementText(elements.pacingScoreElement, String(result.scores?.pacing_score ?? "-"));
    setElementText(elements.summaryElement, result.summary || "요약 데이터가 없습니다.");
    renderTextList(elements.strengthsListElement, result.strengths, "강점 데이터가 없습니다.");
    renderTextList(elements.improvementsListElement, result.improvements, "개선점 데이터가 없습니다.");
    renderSections(elements.sectionsListElement, result.sections);
    updateAnalysisChatStatus("분석이 완료되었습니다. 결과를 확인하세요.");
    updateNotice("분석 결과를 불러왔습니다.");
  } catch (error) {
    console.error(error);
    updateNotice("분석 결과를 불러오는 중 오류가 발생했습니다.");
    setButtonDisabled(elements.runAnalysisButton, false);
  }
}

export async function pollAnalysisStatus({ analysisId, pollingTimer, elements, updateAnalysisChatStatus, updateNotice, setButtonDisabled, fetchAnalysisResult }) {
  if (!analysisId) {
    return pollingTimer;
  }

  try {
    const statusData = await fetchJson(`${API_BASE_URL}/analyses/${analysisId}/status`);
    updateAnalysisChatStatus(`분석 중... ${statusData.stage} / 진행률 ${statusData.progress}%`);

    if (statusData.status === "done") {
      window.clearInterval(pollingTimer);
      pollingTimer = null;
      await fetchAnalysisResult();
      setButtonDisabled(elements.runAnalysisButton, false);
      return pollingTimer;
    }

    if (statusData.status === "failed") {
      window.clearInterval(pollingTimer);
      pollingTimer = null;
      updateAnalysisChatStatus("분석이 실패했습니다. 다시 시도해주세요.");
      updateNotice("분석이 실패했습니다.");
      setButtonDisabled(elements.runAnalysisButton, false);
    }
  } catch (error) {
    console.error(error);
    window.clearInterval(pollingTimer);
    pollingTimer = null;
    updateNotice("분석 상태 조회 중 오류가 발생했습니다.");
    setButtonDisabled(elements.runAnalysisButton, false);
  }

  return pollingTimer;
}

export async function runAnalysis({
  noteId,
  documentInput,
  audioInput,
  documentUploadId,
  audioUploadId,
  updateNotice,
  updateAnalysisChatStatus,
  setButtonDisabled,
  elements,
}) {
  if (!noteId) {
    window.alert("note_id가 없어 분석을 진행할 수 없습니다.");
    return { success: false };
  }

  const hasDocumentFile = documentInput?.files?.[0];
  const hasAudioFile = audioInput?.files?.[0];

  if (!hasDocumentFile && !hasAudioFile) {
    return { success: false };
  }

  updateAnalysisChatStatus("분석 중입니다...");
  const uploadResult = await uploadSelectedFiles(
    noteId,
    documentInput,
    audioInput,
    updateNotice,
    updateAnalysisChatStatus,
    documentUploadId,
    audioUploadId
  );

  if (!uploadResult.success) {
    return { success: false, documentUploadId: uploadResult.documentUploadId, audioUploadId: uploadResult.audioUploadId };
  }

  setButtonDisabled(elements.runAnalysisButton, true);
  updateAnalysisChatStatus("분석 작업을 생성 중입니다. 파일 업로드와 분석을 준비 중입니다...");
  updateNotice("분석 작업을 생성하는 중입니다.");
  renderEmptyResult(elements);

  try {
    const createdAnalysis = await fetchJson(`${API_BASE_URL}/notes/${noteId}/analyses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_upload_id: uploadResult.documentUploadId,
        audio_upload_id: uploadResult.audioUploadId,
        pipeline_version: "v0.1",
        model_version_ce: "ce-v0.1",
        model_version_ae: "ae-v0.1",
      }),
    });

    return {
      success: true,
      documentUploadId: uploadResult.documentUploadId,
      audioUploadId: uploadResult.audioUploadId,
      analysisId: createdAnalysis.analysis_id,
      statusText: `분석 작업을 생성했습니다. 상태를 확인하는 중입니다. 현재 ${createdAnalysis.stage}, 진행률 ${createdAnalysis.progress}%`,
    };
  } catch (error) {
    console.error(error);
    updateNotice("분석 실행 중 오류가 발생했습니다.");
    updateAnalysisChatStatus("분석 작업 생성에 실패했습니다. 다시 시도해주세요.");
    setButtonDisabled(elements.runAnalysisButton, false);
    window.alert("분석 실행에 실패했습니다.");
    return { success: false, documentUploadId: uploadResult.documentUploadId, audioUploadId: uploadResult.audioUploadId };
  }
}
