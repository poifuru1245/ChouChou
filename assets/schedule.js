import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import "./admin.js";
import { db } from "./js/firebase/firebaseClient.js";

const TOKYO_TIME_ZONE = "Asia/Tokyo";
const DATE_RANGE_DAYS = 14;
const OFF_VALUE = "__OFF__";
const EMPTY_VALUE = "";
const BATCH_LIMIT = 450;

let casts = [];
let schedules = [];
let dates = [];
let scheduleState = new Map();
let dirtyCells = new Set();
let selectedCellKey = "";
let copiedCellValue = null;
let dragCopyState = null;

async function loadSchedule() {
  const wrap = document.getElementById("scheduleList");

  if (!wrap) return;

  wrap.innerHTML = "<div class=\"schedule-loading\">読み込み中...</div>";

  const [castSnapshot, scheduleSnapshot] = await Promise.all([
    getDocs(collection(db, "casts")),
    getDocs(collection(db, "schedules"))
  ]);

  casts = [];
  schedules = [];
  dates = getDateOptions();

  castSnapshot.forEach((item) => {
    casts.push({
      id: item.id,
      ...item.data()
    });
  });

  scheduleSnapshot.forEach((item) => {
    const data = item.data();
    schedules.push({
      id: item.id,
      ...data,
      dateKey: getScheduleDateKey(data),
      castId: getScheduleCastId(data),
      castName: getScheduleCastName(data)
    });
  });

  sortCastsByDisplayOrder(casts);
  buildScheduleState();
  renderScheduleAdmin();
}

function buildScheduleState() {
  scheduleState = new Map();

  casts.forEach((cast) => {
    dates.forEach((date) => {
      const schedule = findScheduleForCast(date.value, cast);
      const timeParts = parseScheduleTime(schedule);
      const key = createCellKey(cast.id, date.value);

      scheduleState.set(key, {
        id: schedule?.id || `${date.value}_${cast.id}`,
        castId: cast.id,
        castName: cast.name || "",
        date: date.value,
        start: timeParts.start,
        end: timeParts.end,
        status: getCellStatus(timeParts.start, timeParts.end),
        originalStart: timeParts.start,
        originalEnd: timeParts.end
      });
    });
  });
}

function renderScheduleAdmin() {
  const wrap = document.getElementById("scheduleList");

  wrap.innerHTML = `
    <div class="schedule-excel-page">
      <div class="schedule-excel-toolbar">
        <div class="schedule-excel-title">
          <h2>2週間シフト表</h2>
          <p>セルをクリックして編集し、変更をまとめてFirestoreへ保存します。</p>
        </div>

        <div class="schedule-excel-actions">
          <button type="button" id="saveAllSchedules" class="save-btn schedule-save-all">
            変更をまとめて保存
          </button>
          <span id="dirtyCount" class="schedule-dirty-count">変更 0件</span>
          <span id="copyStatus" class="schedule-copy-status" hidden></span>
        </div>
      </div>

      <div class="schedule-excel-tools">
        <div class="schedule-filter-panel">
          <label class="schedule-tool-field">
            <span>キャスト検索</span>
            <input type="search" id="castSearchInput" placeholder="名前で検索">
          </label>

          <label class="schedule-tool-field">
            <span>表示</span>
            <select id="scheduleFilterSelect">
              <option value="all">すべて</option>
              <option value="empty">未入力だけ</option>
              <option value="working">出勤だけ</option>
              <option value="off">休みだけ</option>
            </select>
          </label>
        </div>

        <div class="schedule-copy-panel" aria-label="コピー操作">
          <h3>コピー操作</h3>

          <div class="schedule-copy-card">
            <strong>日付コピー</strong>
            <label class="schedule-tool-field">
              <span>コピー元の日付</span>
              <select id="copyDateFrom">${dates.map((date) => `<option value="${date.value}">${escapeHtml(date.shortLabel)}</option>`).join("")}</select>
            </label>
            <div class="schedule-copy-targets">
              <span>コピー先の日付</span>
              <div id="copyDateTargets" class="schedule-date-checkboxes">
                ${createDateCheckboxes()}
              </div>
            </div>
            <button type="button" id="copyDateButton">この日の全員分をコピー</button>
          </div>

          <div class="schedule-copy-card">
            <strong>キャストコピー</strong>
            <label class="schedule-tool-field">
              <span>コピー元キャスト</span>
              <select id="copyCastFrom">${casts.map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}</option>`).join("")}</select>
            </label>
            <label class="schedule-tool-field">
              <span>コピー先キャスト</span>
              <select id="copyCastTo">${casts.map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}</option>`).join("")}</select>
            </label>
            <button type="button" id="copyCastButton">このキャストの2週間分をコピー</button>
          </div>

          <div class="schedule-copy-card schedule-week-copy-card">
            <strong>曜日コピー</strong>
            <button type="button" id="copyFridayButton">今週の金曜を来週の金曜へコピー</button>
            <button type="button" id="copySaturdayButton">今週の土曜を来週の土曜へコピー</button>
            <button type="button" id="copyWeekButton">1週間分を翌週へコピー</button>
          </div>
        </div>
      </div>

      <div class="schedule-legend">
        <span class="schedule-legend-item is-working">出勤</span>
        <span class="schedule-legend-item is-off">休み</span>
        <span class="schedule-legend-item is-empty">未入力</span>
        <span class="schedule-legend-item is-dirty">編集済み</span>
      </div>

      <div class="schedule-excel-shell">
        <table class="schedule-excel-table" aria-label="2週間シフト表">
          <thead>
            <tr>
              <th class="schedule-cast-column">キャスト</th>
              ${dates.map((date) => `
                <th class="schedule-date-column" data-date="${escapeAttribute(date.value)}">
                  <span>${escapeHtml(date.shortLabel)}</span>
                  <small>出勤${getWorkingCount(date.value)}名</small>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody id="scheduleTableBody">
            ${casts.map((cast) => createCastRow(cast)).join("")}
          </tbody>
        </table>
      </div>

      ${createEditorPanel()}
    </div>
  `;

  bindScheduleEvents();
  updateVisibleRows();
  updateDirtyCount();
}

function createCastRow(cast) {
  return `
    <tr class="schedule-cast-row" data-cast-id="${escapeAttribute(cast.id)}" data-cast-name="${escapeAttribute(cast.name || "")}">
      <th class="schedule-cast-column schedule-cast-name" scope="row">
        <span>${escapeHtml(cast.name || "名称未設定")}</span>
        <small>${escapeHtml(formatCastMeta(cast))}</small>
      </th>
      ${dates.map((date) => createScheduleCell(cast, date.value)).join("")}
    </tr>
  `;
}

function createScheduleCell(cast, date) {
  const key = createCellKey(cast.id, date);
  const state = scheduleState.get(key) || createEmptyCellState(cast, date);
  const status = getCellStatus(state.start, state.end);

  return `
    <td>
      <button
        type="button"
        class="schedule-cell ${getCellClass(status)}"
        data-cell-key="${escapeAttribute(key)}"
        data-cast-id="${escapeAttribute(cast.id)}"
        data-date="${escapeAttribute(date)}"
        aria-label="${escapeAttribute(cast.name || "")} ${escapeAttribute(date)} の出勤時間">
        <span>${escapeHtml(getCellDisplay(state.start, state.end))}</span>
        <i class="schedule-fill-handle" aria-hidden="true"></i>
      </button>
    </td>
  `;
}

function createDateCheckboxes() {
  return dates.map((date, index) => `
    <label>
      <input type="checkbox" value="${escapeAttribute(date.value)}" ${index === 1 ? "checked" : ""}>
      <span>${escapeHtml(date.shortLabel)}</span>
    </label>
  `).join("");
}

function createEditorPanel() {
  return `
    <div id="scheduleEditorOverlay" class="schedule-editor-overlay" hidden>
      <div class="schedule-editor-panel" role="dialog" aria-modal="true" aria-labelledby="scheduleEditorTitle">
        <button type="button" id="closeScheduleEditor" class="schedule-editor-close" aria-label="閉じる">×</button>
        <h3 id="scheduleEditorTitle">シフト編集</h3>
        <p id="scheduleEditorTarget" class="schedule-editor-target"></p>

        <label>
          <span>開始時間</span>
          <select id="editorStartSelect">${createTimeOptions(EMPTY_VALUE)}</select>
        </label>

        <label>
          <span>終了時間</span>
          <select id="editorEndSelect">${createTimeOptions(EMPTY_VALUE)}</select>
        </label>

        <div class="schedule-editor-buttons">
          <button type="button" id="copyCurrentCellButton">このセルをコピー</button>
          <button type="button" id="pasteCopiedCellButton">コピー中の内容をここに貼り付け</button>
          <button type="button" id="setCellOffButton">休み</button>
          <button type="button" id="setCellEmptyButton">未入力</button>
          <button type="button" id="saveCellButton" class="save-btn">セルに反映</button>
        </div>
      </div>
    </div>
  `;
}

function bindScheduleEvents() {
  document.querySelectorAll(".schedule-cell").forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
  });
  document.querySelectorAll(".schedule-fill-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", startDragCopy);
  });

  document.getElementById("saveAllSchedules")?.addEventListener("click", saveDirtySchedules);
  document.getElementById("castSearchInput")?.addEventListener("input", updateVisibleRows);
  document.getElementById("scheduleFilterSelect")?.addEventListener("change", updateVisibleRows);
  document.getElementById("copyDateButton")?.addEventListener("click", copyDateSchedules);
  document.getElementById("copyCastButton")?.addEventListener("click", copyCastSchedules);
  document.getElementById("copyFridayButton")?.addEventListener("click", () => copyWeekdayToNextWeek(5));
  document.getElementById("copySaturdayButton")?.addEventListener("click", () => copyWeekdayToNextWeek(6));
  document.getElementById("copyWeekButton")?.addEventListener("click", copyFirstWeekToSecondWeek);
  document.getElementById("closeScheduleEditor")?.addEventListener("click", closeEditor);
  document.getElementById("scheduleEditorOverlay")?.addEventListener("click", (event) => {
    if (event.target.id === "scheduleEditorOverlay") closeEditor();
  });
  document.getElementById("setCellOffButton")?.addEventListener("click", () => {
    document.getElementById("editorStartSelect").value = OFF_VALUE;
    document.getElementById("editorEndSelect").value = OFF_VALUE;
  });
  document.getElementById("setCellEmptyButton")?.addEventListener("click", () => {
    document.getElementById("editorStartSelect").value = EMPTY_VALUE;
    document.getElementById("editorEndSelect").value = EMPTY_VALUE;
  });
  document.getElementById("copyCurrentCellButton")?.addEventListener("click", copySelectedCell);
  document.getElementById("pasteCopiedCellButton")?.addEventListener("click", pasteCopiedCellToCurrent);
  document.getElementById("saveCellButton")?.addEventListener("click", saveCurrentCell);
  updateCopyStatus();
}

function handleCellClick(event) {
  if (event.target.closest(".schedule-fill-handle")) return;

  const cell = event.currentTarget;
  const key = cell.dataset.cellKey || "";

  selectedCellKey = key;
  markSelectedCell(key);
  openEditor(key);
}

function openEditor(key) {
  const overlay = document.getElementById("scheduleEditorOverlay");
  const state = scheduleState.get(key);
  const cast = casts.find((item) => item.id === state?.castId);
  const date = dates.find((item) => item.value === state?.date);

  if (!overlay || !state) return;

  document.getElementById("scheduleEditorTarget").textContent = `${cast?.name || "名称未設定"} / ${date?.label || state.date}`;
  document.getElementById("editorStartSelect").value = normalizeTimeOption(state.start);
  document.getElementById("editorEndSelect").value = normalizeTimeOption(state.end);
  document.getElementById("pasteCopiedCellButton").disabled = !copiedCellValue;
  overlay.hidden = false;
}

function closeEditor() {
  const overlay = document.getElementById("scheduleEditorOverlay");
  if (overlay) overlay.hidden = true;
}

function saveCurrentCell() {
  if (!selectedCellKey) return;

  const start = document.getElementById("editorStartSelect")?.value || EMPTY_VALUE;
  const end = document.getElementById("editorEndSelect")?.value || EMPTY_VALUE;

  updateCellState(selectedCellKey, start, end);
  closeEditor();
  updateVisibleRows();
  renderHeaderCounts();
}

function updateCellState(key, rawStart, rawEnd) {
  const state = scheduleState.get(key);

  if (!state) return;

  const isOff = rawStart === OFF_VALUE || rawEnd === OFF_VALUE;
  const start = isOff ? OFF_VALUE : rawStart;
  const end = isOff ? OFF_VALUE : rawEnd;

  state.start = start;
  state.end = end;
  state.status = getCellStatus(start, end);

  if (state.start === state.originalStart && state.end === state.originalEnd) {
    dirtyCells.delete(key);
  } else {
    dirtyCells.add(key);
  }

  renderCell(key);
  updateDirtyCount();
}

function renderCell(key) {
  const state = scheduleState.get(key);
  const cell = document.querySelector(`.schedule-cell[data-cell-key="${cssEscape(key)}"]`);

  if (!state || !cell) return;

  cell.className = `schedule-cell ${getCellClass(state.status)}${dirtyCells.has(key) ? " is-dirty" : ""}${selectedCellKey === key ? " is-selected" : ""}`;
  cell.querySelector("span").textContent = getCellDisplay(state.start, state.end);
}

function startDragCopy(event) {
  if (event.pointerType && event.pointerType !== "mouse") return;

  const cell = event.currentTarget.closest(".schedule-cell");
  const key = cell?.dataset.cellKey || "";
  const state = scheduleState.get(key);
  const position = getCellPosition(key);

  if (!cell || !state || !position) return;

  event.preventDefault();
  event.stopPropagation();

  selectedCellKey = key;
  markSelectedCell(key);
  closeEditor();

  dragCopyState = {
    sourceKey: key,
    sourceStart: state.start,
    sourceEnd: state.end,
    startCastIndex: position.castIndex,
    startDateIndex: position.dateIndex,
    targetCastIndex: position.castIndex,
    targetDateIndex: position.dateIndex,
    copiedKeys: new Set([key]),
    moved: false
  };

  document.body.classList.add("is-schedule-drag-copying");
  cell.classList.add("is-drag-source");

  document.addEventListener("pointermove", handleDragCopyMove);
  document.addEventListener("pointerup", finishDragCopy, { once: true });
}

function handleDragCopyMove(event) {
  if (!dragCopyState) return;

  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".schedule-cell");
  const targetKey = target?.dataset.cellKey || "";
  const position = getCellPosition(targetKey);

  if (!position) return;

  dragCopyState.targetCastIndex = position.castIndex;
  dragCopyState.targetDateIndex = position.dateIndex;
  dragCopyState.moved = dragCopyState.moved || targetKey !== dragCopyState.sourceKey;
  updateDragCopyPreview();
}

function finishDragCopy() {
  if (!dragCopyState) return;

  document.removeEventListener("pointermove", handleDragCopyMove);

  const keys = [...dragCopyState.copiedKeys].filter((key) => key !== dragCopyState.sourceKey);
  const sourceStart = dragCopyState.sourceStart;
  const sourceEnd = dragCopyState.sourceEnd;

  if (dragCopyState.moved && keys.length > 0) {
    keys.forEach((key) => {
      updateCellState(key, sourceStart, sourceEnd);
    });
    updateVisibleRows();
    renderHeaderCounts();
  }

  clearDragCopyPreview();
  dragCopyState = null;
}

function updateDragCopyPreview() {
  if (!dragCopyState) return;

  clearDragCopyPreview(false);

  const keys = getCellKeysInRange(
    dragCopyState.startCastIndex,
    dragCopyState.startDateIndex,
    dragCopyState.targetCastIndex,
    dragCopyState.targetDateIndex
  );

  dragCopyState.copiedKeys = new Set(keys);

  keys.forEach((key) => {
    const cell = document.querySelector(`.schedule-cell[data-cell-key="${cssEscape(key)}"]`);
    if (!cell) return;
    cell.classList.add(key === dragCopyState.sourceKey ? "is-drag-source" : "is-drag-target");
  });
}

function clearDragCopyPreview(shouldClearBody = true) {
  document.querySelectorAll(".schedule-cell.is-drag-source, .schedule-cell.is-drag-target").forEach((cell) => {
    cell.classList.remove("is-drag-source", "is-drag-target");
  });

  if (shouldClearBody) {
    document.body.classList.remove("is-schedule-drag-copying");
  }
}

function getCellKeysInRange(startCastIndex, startDateIndex, targetCastIndex, targetDateIndex) {
  const minCast = Math.min(startCastIndex, targetCastIndex);
  const maxCast = Math.max(startCastIndex, targetCastIndex);
  const minDate = Math.min(startDateIndex, targetDateIndex);
  const maxDate = Math.max(startDateIndex, targetDateIndex);
  const keys = [];

  for (let castIndex = minCast; castIndex <= maxCast; castIndex += 1) {
    const cast = casts[castIndex];
    if (!cast) continue;

    for (let dateIndex = minDate; dateIndex <= maxDate; dateIndex += 1) {
      const date = dates[dateIndex];
      if (!date) continue;
      keys.push(createCellKey(cast.id, date.value));
    }
  }

  return keys;
}

function getCellPosition(key) {
  const state = scheduleState.get(key);

  if (!state) return null;

  const castIndex = casts.findIndex((cast) => cast.id === state.castId);
  const dateIndex = dates.findIndex((date) => date.value === state.date);

  if (castIndex < 0 || dateIndex < 0) return null;

  return {
    castIndex,
    dateIndex
  };
}

function markSelectedCell(key) {
  document.querySelectorAll(".schedule-cell.is-selected").forEach((cell) => {
    cell.classList.remove("is-selected");
  });

  document.querySelector(`.schedule-cell[data-cell-key="${cssEscape(key)}"]`)?.classList.add("is-selected");
}

async function saveDirtySchedules() {
  const saveButton = document.getElementById("saveAllSchedules");
  const keys = [...dirtyCells];
  const today = getTokyoDateKey();

  if (!keys.length) {
    alert("保存する変更はありません。");
    return;
  }

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "保存中...";
    }

    for (let index = 0; index < keys.length; index += BATCH_LIMIT) {
      const batchKeys = keys.slice(index, index + BATCH_LIMIT);
      const batch = writeBatch(db);

      batchKeys.forEach((key) => {
        const state = scheduleState.get(key);
        const cast = casts.find((item) => item.id === state?.castId);

        if (!state || !cast) return;

        const isOff = state.start === OFF_VALUE || state.end === OFF_VALUE;
        const start = isOff ? "" : state.start;
        const end = isOff ? "" : state.end;
        const time = isOff ? "" : formatScheduleTime(start, end);
        const status = isOff ? "休み" : time ? "出勤" : "未設定";
        const payload = {
          date: state.date,
          dateKey: state.date,
          castId: state.castId,
          castName: cast.name || state.castName || "",
          start,
          end,
          time,
          status,
          isOff,
          updatedAt: serverTimestamp()
        };

        batch.set(doc(db, "schedules", state.id), payload, { merge: true });

        if (state.date === today) {
          batch.update(doc(db, "casts", state.castId), {
            schedule: time
          });
        }
      });

      await batch.commit();
    }

    keys.forEach((key) => {
      const state = scheduleState.get(key);
      if (!state) return;
      state.originalStart = state.start;
      state.originalEnd = state.end;
      renderCell(key);
    });

    dirtyCells.clear();
    updateDirtyCount();
    alert("変更を保存しました。");
  } catch (error) {
    console.error("出勤保存失敗", error);
    alert("出勤情報の保存に失敗しました。");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "変更をまとめて保存";
    }
  }
}

function copyDateSchedules() {
  const from = document.getElementById("copyDateFrom")?.value || "";
  const targets = [...document.querySelectorAll("#copyDateTargets input:checked")]
    .map((input) => input.value)
    .filter((value) => value && value !== from);

  if (!from || targets.length === 0) {
    alert("コピー先の日付を選択してください。");
    return;
  }

  const fromLabel = getDateLabel(from);
  const targetLabels = targets.map(getDateLabel).join("・");

  if (!confirm(`${fromLabel}の全員分を${targetLabels}へコピーします。よろしいですか？`)) {
    return;
  }

  casts.forEach((cast) => {
    const fromState = scheduleState.get(createCellKey(cast.id, from));

    targets.forEach((to) => {
      const toKey = createCellKey(cast.id, to);
      if (fromState) updateCellState(toKey, fromState.start, fromState.end);
    });
  });

  updateVisibleRows();
  renderHeaderCounts();
}

function copyCastSchedules() {
  const from = document.getElementById("copyCastFrom")?.value || "";
  const to = document.getElementById("copyCastTo")?.value || "";

  if (!from || !to || from === to) return;

  const fromCast = casts.find((cast) => cast.id === from);
  const toCast = casts.find((cast) => cast.id === to);

  if (!confirm(`${fromCast?.name || "コピー元"}の2週間分を${toCast?.name || "コピー先"}へコピーします。よろしいですか？`)) {
    return;
  }

  dates.forEach((date) => {
    const fromState = scheduleState.get(createCellKey(from, date.value));
    const toKey = createCellKey(to, date.value);

    if (fromState) updateCellState(toKey, fromState.start, fromState.end);
  });

  updateVisibleRows();
  renderHeaderCounts();
}

function copySelectedCell() {
  const state = scheduleState.get(selectedCellKey);

  if (!state) {
    alert("コピーするセルを選択してください。");
    return;
  }

  copiedCellValue = {
    start: state.start,
    end: state.end
  };

  updateCopyStatus();
  document.getElementById("pasteCopiedCellButton")?.removeAttribute("disabled");
}

function pasteCopiedCellToCurrent() {
  if (!selectedCellKey || !copiedCellValue) return;

  const state = scheduleState.get(selectedCellKey);
  const cast = casts.find((item) => item.id === state?.castId);
  const date = dates.find((item) => item.value === state?.date);
  const display = getCellDisplay(copiedCellValue.start, copiedCellValue.end);

  if (!state) return;

  if (!confirm(`${display}を${cast?.name || "選択セル"} / ${date?.shortLabel || state.date}へ貼り付けます。よろしいですか？`)) {
    return;
  }

  updateCellState(selectedCellKey, copiedCellValue.start, copiedCellValue.end);
  document.getElementById("editorStartSelect").value = normalizeTimeOption(copiedCellValue.start);
  document.getElementById("editorEndSelect").value = normalizeTimeOption(copiedCellValue.end);
  updateVisibleRows();
  renderHeaderCounts();
}

function copyWeekdayToNextWeek(dayNumber) {
  const fromDate = dates.slice(0, 7).find((date) => getDayNumber(date.value) === dayNumber);
  const toDate = dates.slice(7).find((date) => getDayNumber(date.value) === dayNumber);

  if (!fromDate || !toDate) {
    alert("コピー対象の日付が見つかりません。");
    return;
  }

  if (!confirm(`${fromDate.shortLabel}の全員分を${toDate.shortLabel}へコピーします。よろしいですか？`)) {
    return;
  }

  copyOneDateToTargets(fromDate.value, [toDate.value]);
}

function copyFirstWeekToSecondWeek() {
  const pairs = dates.slice(0, 7)
    .map((fromDate, index) => ({
      from: fromDate,
      to: dates[index + 7]
    }))
    .filter((pair) => pair.to);

  if (pairs.length === 0) return;

  if (!confirm("1週間分のシフトを翌週へコピーします。よろしいですか？")) {
    return;
  }

  pairs.forEach((pair) => {
    copyOneDateToTargets(pair.from.value, [pair.to.value], false);
  });

  updateVisibleRows();
  renderHeaderCounts();
}

function copyOneDateToTargets(from, targets, shouldRefresh = true) {
  casts.forEach((cast) => {
    const fromState = scheduleState.get(createCellKey(cast.id, from));

    targets.forEach((to) => {
      const toKey = createCellKey(cast.id, to);
      if (fromState) updateCellState(toKey, fromState.start, fromState.end);
    });
  });

  if (shouldRefresh) {
    updateVisibleRows();
    renderHeaderCounts();
  }
}

function updateCopyStatus() {
  const status = document.getElementById("copyStatus");
  const page = document.querySelector(".schedule-excel-page");

  if (!status) return;

  if (!copiedCellValue) {
    status.hidden = true;
    status.textContent = "";
    page?.classList.remove("is-copying-cell");
    return;
  }

  status.hidden = false;
  status.textContent = `コピー中：${getCellDisplay(copiedCellValue.start, copiedCellValue.end)}`;
  page?.classList.add("is-copying-cell");
}

function updateVisibleRows() {
  const searchValue = (document.getElementById("castSearchInput")?.value || "").trim().toLowerCase();
  const filterValue = document.getElementById("scheduleFilterSelect")?.value || "all";

  document.querySelectorAll(".schedule-cast-row").forEach((row) => {
    const name = (row.dataset.castName || "").toLowerCase();
    const castId = row.dataset.castId || "";
    const matchesName = !searchValue || name.includes(searchValue);
    const matchesFilter = filterValue === "all" || dates.some((date) => {
      const state = scheduleState.get(createCellKey(castId, date.value));
      return state?.status === filterValue;
    });

    row.hidden = !(matchesName && matchesFilter);
  });
}

function renderHeaderCounts() {
  dates.forEach((date) => {
    const header = document.querySelector(`.schedule-date-column[data-date="${cssEscape(date.value)}"] small`);
    if (header) header.textContent = `出勤${getWorkingCount(date.value)}名`;
  });
}

function updateDirtyCount() {
  const count = dirtyCells.size;
  const label = document.getElementById("dirtyCount");

  if (label) label.textContent = `変更 ${count}件`;
}

function getWorkingCount(date) {
  return casts.filter((cast) => {
    const state = scheduleState.get(createCellKey(cast.id, date));
    return state?.status === "working";
  }).length;
}

function getDateLabel(value) {
  return dates.find((date) => date.value === value)?.shortLabel || value;
}

function getDayNumber(value) {
  const date = new Date(`${value}T00:00:00+09:00`);
  return date.getDay();
}

function getDateOptions() {
  const result = [];
  const baseDate = new Date(`${getTokyoDateKey()}T00:00:00+09:00`);

  for (let index = 0; index < DATE_RANGE_DAYS; index += 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);

    const value = getTokyoDateKey(date);
    const label = new Intl.DateTimeFormat("ja-JP", {
      timeZone: TOKYO_TIME_ZONE,
      month: "numeric",
      day: "numeric",
      weekday: "short"
    }).format(date);

    result.push({
      value,
      label: index === 0 ? `${label}（今日）` : label,
      shortLabel: label
    });
  }

  return result;
}

function createTimeOptions(selectedValue) {
  const values = [EMPTY_VALUE, OFF_VALUE, ...createTimeValues(), "LAST"];

  return values.map((value) => `
    <option value="${value}" ${value === selectedValue ? "selected" : ""}>
      ${getTimeOptionLabel(value)}
    </option>
  `).join("");
}

function getTimeOptionLabel(value) {
  if (!value) return "未入力";
  if (value === OFF_VALUE) return "休み";
  return value;
}

function createTimeValues() {
  const values = [];

  for (let hour = 19; hour <= 24; hour += 1) {
    ["00", "30"].forEach((minute) => {
      values.push(`${String(hour).padStart(2, "0")}:${minute}`);
    });
  }

  values.push("25:00");

  return values;
}

function parseScheduleTime(schedule) {
  if (!schedule) {
    return {
      start: EMPTY_VALUE,
      end: EMPTY_VALUE
    };
  }

  if (isInactiveSchedule(schedule)) {
    return {
      start: OFF_VALUE,
      end: OFF_VALUE
    };
  }

  const start = normalizeTimeOption(schedule?.start || "");
  const end = normalizeTimeOption(schedule?.end || "");

  if (start || end) {
    return {
      start,
      end
    };
  }

  const time = String(schedule?.time || schedule?.schedule || "").trim();
  const match = time.match(/^(.+?)[〜~\-](.+)$/);

  if (match) {
    return {
      start: normalizeTimeOption(match[1].trim()),
      end: normalizeTimeOption(match[2].trim())
    };
  }

  return {
    start: normalizeTimeOption(time),
    end: EMPTY_VALUE
  };
}

function normalizeTimeOption(value) {
  const text = String(value || "").trim();

  if (!text || text === "未入力" || text === "未設定") return EMPTY_VALUE;
  if (text === "休み" || text === OFF_VALUE) return OFF_VALUE;
  if (text.toUpperCase() === "LAST") return "LAST";

  return text;
}

function formatScheduleTime(start, end) {
  if (start && end) return `${start}〜${end}`;
  return start || end || "";
}

function getCellDisplay(start, end) {
  const status = getCellStatus(start, end);

  if (status === "off") return "休み";
  if (status === "empty") return "未入力";
  if (start && end) return `${start}-${end}`;

  return start || end;
}

function getCellStatus(start, end) {
  if (start === OFF_VALUE || end === OFF_VALUE) return "off";
  if (!start && !end) return "empty";
  return "working";
}

function getCellClass(status) {
  if (status === "working") return "is-working";
  if (status === "off") return "is-off";
  return "is-empty";
}

function createEmptyCellState(cast, date) {
  return {
    id: `${date}_${cast.id}`,
    castId: cast.id,
    castName: cast.name || "",
    date,
    start: EMPTY_VALUE,
    end: EMPTY_VALUE,
    status: "empty",
    originalStart: EMPTY_VALUE,
    originalEnd: EMPTY_VALUE
  };
}

function createCellKey(castId, date) {
  return `${castId}__${date}`;
}

function findScheduleForCast(date, cast) {
  const castId = String(cast?.id || "").trim();
  const castName = String(cast?.name || "").trim();

  return schedules.find((schedule) => (
    schedule.dateKey === date &&
    (
      (schedule.castId && schedule.castId === castId) ||
      (schedule.castId && schedule.castId === castName) ||
      (schedule.castName && schedule.castName === castName) ||
      (schedule.castName && schedule.castName === castId)
    )
  ));
}

function isInactiveSchedule(schedule) {
  const status = String(schedule?.status || schedule?.attendanceStatus || "").trim();

  return status === "休み" ||
    status === "欠勤" ||
    status === "cancel" ||
    status === "canceled" ||
    status === "cancelled" ||
    schedule?.isOff === true ||
    schedule?.off === true;
}

function getTokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getScheduleDateKey(schedule) {
  return normalizeScheduleDate(
    schedule?.date ||
    schedule?.dateKey ||
    schedule?.scheduleDate ||
    schedule?.workDate ||
    schedule?.day ||
    schedule?.startDate
  );
}

function normalizeScheduleDate(value) {
  if (!value) return "";

  if (typeof value?.toDate === "function") {
    return getTokyoDateKey(value.toDate());
  }

  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    return getTokyoDateKey(new Date(value.seconds * 1000));
  }

  if (value instanceof Date) {
    return getTokyoDateKey(value);
  }

  const text = String(value).trim();

  if (!text) return "";

  const slashMatch = text.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/);

  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[3].padStart(2, "0")}`;
  }

  const hyphenMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (hyphenMatch) {
    return `${hyphenMatch[1]}-${hyphenMatch[2].padStart(2, "0")}-${hyphenMatch[3].padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);

  return Number.isNaN(parsedDate.getTime())
    ? text
    : getTokyoDateKey(parsedDate);
}

function getScheduleCastId(schedule) {
  return String(
    schedule?.castId ||
    schedule?.castID ||
    schedule?.castDocId ||
    schedule?.cast_id ||
    schedule?.castRef?.id ||
    ""
  ).trim();
}

function getScheduleCastName(schedule) {
  return String(
    schedule?.castName ||
    schedule?.name ||
    schedule?.cast ||
    schedule?.cast_name ||
    schedule?.girlName ||
    ""
  ).trim();
}

function formatCastMeta(cast) {
  return [
    cast.age ? `${cast.age}歳` : "-",
    formatCup(cast),
    cast.height || "-"
  ].join(" / ");
}

function formatCup(cast) {
  const cup = cast?.cup || cast?.cupSize || cast?.bust || cast?.bustCup || "";

  return cup
    ? `${cup}カップ`.replace("カップカップ", "カップ")
    : "-";
}

function sortCastsByDisplayOrder(items) {
  items.sort((a, b) => {
    const aOrder = getNumericDisplayOrder(a);
    const bOrder = getNumericDisplayOrder(b);

    if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
    if (aOrder !== null) return -1;
    if (bOrder !== null) return 1;

    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
  });
}

function getNumericDisplayOrder(cast) {
  const order = cast?.displayOrder;

  if (order === undefined || order === null || order === "") return null;

  const numericOrder = Number(order);

  return Number.isFinite(numericOrder) ? numericOrder : null;
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }

  return String(value).replace(/["\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

let realtimeRefreshTimer = null;
const queueRealtimeRefresh = () => {
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = setTimeout(() => {
    if (!dirtyCells.size) loadSchedule();
  }, 120);
};
onSnapshot(collection(db, "casts"), queueRealtimeRefresh, console.error);
onSnapshot(collection(db, "schedules"), queueRealtimeRefresh, console.error);
