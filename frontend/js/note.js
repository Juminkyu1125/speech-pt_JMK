const API_BASE_URL = "http://127.0.0.1:8000"; //API 붙이기

const noteGrid = document.getElementById("noteGrid");
const createNoteCard = document.getElementById("createNoteCard");
const noticeText = document.querySelector(".notice-bar p");

function setNotice(message) {
  if (noticeText) {
    noticeText.textContent = message;
  }
}

function openLoginModal() {
  const loginModalBackdrop = document.getElementById("loginModalBackdrop");
  if (loginModalBackdrop) {
    loginModalBackdrop.classList.add("active");
  }
}

function closeLoginModal() {
  const loginModalBackdrop = document.getElementById("loginModalBackdrop");
  if (loginModalBackdrop) {
    loginModalBackdrop.classList.remove("active");
  }
}

function setupLoginModal() {
  const loginModal = document.getElementById("loginModalBackdrop");
  const closeButton = document.getElementById("closeLoginModalButton");
  const loginLink = document.querySelector(".top-menu a");

  if (loginLink) {
    loginLink.addEventListener("click", (e) => {
      e.preventDefault();
      openLoginModal();
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", closeLoginModal);
  }

  if (loginModal) {
    loginModal.addEventListener("click", (e) => {
      if (e.target === loginModal) {
        closeLoginModal();
      }
    });
  }
}


function moveToAnalysisPage(noteId) {
  window.location.href = `analysis.html?note_id=${noteId}`;
}

function createNoteCardElement(note) {
  const card = document.createElement("div");
  card.className = "note-card";
  card.dataset.noteId = note.note_id;
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");

  const thumbnail = document.createElement("div");
  thumbnail.className = "note-thumbnail sample-bg";

  const label = document.createElement("div");
  label.className = "note-label";
  label.textContent = note.title;

  card.appendChild(thumbnail);
  card.appendChild(label);

  card.addEventListener("click", () => {
    moveToAnalysisPage(note.note_id);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      moveToAnalysisPage(note.note_id);
    }
  });

  return card;
}

function renderNotes(notes) {
  const existingCards = noteGrid.querySelectorAll(".note-card:not(.add-card)");
  existingCards.forEach((card) => card.remove());

  notes.forEach((note) => {
    const card = createNoteCardElement(note);
    noteGrid.appendChild(card);
  });
}

async function fetchNotes() {
  setNotice("노트 목록을 불러오는 중입니다.");

  const response = await fetch(`${API_BASE_URL}/notes`);
  if (!response.ok) {
    throw new Error("노트 목록을 불러오지 못했습니다.");
  }

  const data = await response.json();
  renderNotes(data.items ?? []);

  if ((data.total ?? 0) === 0) {
    setNotice("아직 생성된 노트가 없습니다. 새 노트를 추가해보세요.");
    return;
  }

  setNotice(`총 ${data.total}개의 노트를 불러왔습니다.`);
}

async function createNote() {
  const title = window.prompt("새 노트 제목을 입력하세요.");
  if (!title) {
    return;
  }

  const description = window.prompt("노트 설명을 입력하세요. 비워도 됩니다.") || null;

  setNotice("새 노트를 생성하는 중입니다.");
  createNoteCard.style.pointerEvents = "none";
  createNoteCard.style.opacity = "0.6";

  try {
    const response = await fetch(`${API_BASE_URL}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
      }),
    });

    if (!response.ok) {
      throw new Error("노트 생성에 실패했습니다.");
    }

    const createdNote = await response.json();
    setNotice("새 노트를 생성했습니다. 분석 페이지로 이동합니다.");
    moveToAnalysisPage(createdNote.note_id);
  } catch (error) {
    console.error(error);
    setNotice("노트 생성 중 오류가 발생했습니다.");
    window.alert("노트 생성에 실패했습니다. 서버가 켜져 있는지 확인해주세요.");
  } finally {
    createNoteCard.style.pointerEvents = "auto";
    createNoteCard.style.opacity = "1";
  }
}

async function initNotePage() {
  if (!noteGrid || !createNoteCard) {
    return;
  }

  createNoteCard.addEventListener("click", createNote);
  setupLoginModal();

  try {
    await fetchNotes();
  } catch (error) {
    console.error(error);
    setNotice("노트 목록을 불러오지 못했습니다. 백엔드 서버 상태를 확인해주세요.");
  }
}

document.addEventListener("DOMContentLoaded", initNotePage);
