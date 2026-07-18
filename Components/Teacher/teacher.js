import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signOut as secondarySignOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, set, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, database, secondaryAuth } from "../../JavaScript/firebase-config.js";

let currentTeacherUid = null;
let students = [];
let pendingDeleteId = null;
let searchTerm = '';
const todayStr = new Date().toISOString().split('T')[0];

// --- DOM refs ---
const studentListContainer = document.getElementById('student-list');
const studentSearchInput = document.getElementById('student-search');
const totalStudentsEl = document.getElementById('total-students');
const presentStudentsEl = document.getElementById('present-students');
const toastContainer = document.getElementById('toast-container');

const btnMarkAll = document.getElementById('btn-mark-all');
const btnMenu = document.getElementById('btn-menu');
const teacherMenuBackdrop = document.getElementById('teacher-menu-backdrop');
const teacherSideMenu = document.getElementById('teacher-side-menu');
const btnMenuClose = document.getElementById('btn-menu-close');
const btnMenuHome = document.getElementById('btn-menu-home');
const btnMenuCertGenerator = document.getElementById('btn-menu-cert-generator');
const btnMenuUpload = document.getElementById('btn-menu-upload');
const btnMenuReport = document.getElementById('btn-menu-report');
const btnMenuLogout = document.getElementById('btn-menu-logout');
const btnSaveReport = document.getElementById('btn-save-report');
const btnSaveLabel = document.getElementById('btn-save-label');
const btnViewReports = document.getElementById('btn-view-reports');

const studentProgressModal = document.getElementById('student-progress-modal');
const progressModalTitle = document.getElementById('progress-modal-title');
const progressModalTableBody = document.getElementById('progress-modal-table-body');
const progressFilterMonth = document.getElementById('progress-filter-month');
const progressFilterYear = document.getElementById('progress-filter-year');
const btnCloseProgressModal = document.getElementById('btn-close-progress');
const btnToggleProgressEdit = document.getElementById('btn-toggle-progress-edit');
const progressDateEditModal = document.getElementById('progress-date-edit-modal');
const progressEditModalTitle = document.getElementById('progress-edit-modal-title');
const progressEditDateLabel = document.getElementById('progress-edit-date-label');
const progressEditNew = document.getElementById('progress-edit-new');
const progressEditRev = document.getElementById('progress-edit-rev');
const progressEditPresentBtn = document.getElementById('progress-edit-present');
const progressEditAbsentBtn = document.getElementById('progress-edit-absent');
const progressEditRemarks = document.getElementById('progress-edit-remarks');
const progressEditHeardBy = document.getElementById('progress-edit-heard-by');
const btnSaveProgressEdit = document.getElementById('btn-save-progress-edit');
const btnCancelProgressEdit = document.getElementById('btn-cancel-progress-edit');
const btnCloseProgressEditModal = document.getElementById('btn-close-progress-edit');
let currentProgressStudentId = null;
let currentProgressLogSnapshot = {};
let currentProgressEditDateKey = null;
let isProgressEditMode = false;
let isProgressEditPresent = false;

const btnAddStudent = document.getElementById('btn-add-student');
const addStudentModal = document.getElementById('add-student-modal');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const addStudentForm = document.getElementById('add-student-form');
const newStudentNameInput = document.getElementById('new-student-name');
const newStudentNameHint = document.getElementById('new-student-name-hint');
const newStudentIdInput = document.getElementById('new-student-id');
const newStudentPinInput = document.getElementById('new-student-pin');
const newStudentPinHint = document.getElementById('new-student-pin-hint');

const deleteStudentModal = document.getElementById('delete-student-modal');
const deleteStudentNameEl = document.getElementById('delete-student-name');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

// 1. Setup Date
document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// 2. Auth Check & Fetch from Firebase
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentTeacherUid = user.uid;
        showLoadingIndicators();
        loadDataFromDB();
    } else {
        window.location.href = 'index.html';
    }
});

// 3. Load Data — both fetches run in parallel instead of nested/sequential
function loadDataFromDB() {
    const studentsRef = ref(database, `teachers/${currentTeacherUid}/students`);
    const todayLogRef = ref(database, `teachers/${currentTeacherUid}/logs/${todayStr}`);

    studentListContainer.innerHTML = '<p style="padding:20px; color:#888;">Loading students...</p>';

    Promise.all([get(studentsRef), get(todayLogRef)]).then(([snapshot, logSnap]) => {
        let loadedStudents = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                loadedStudents.push({
                    id: child.key, name: child.val().name, pin: child.val().pin,
                    isPresent: false, newPages: 0, rev: 0, remarks: "", revHeardBy: ""
                });
            });
        }
        if (logSnap.exists()) {
            const logData = logSnap.val();
            loadedStudents = loadedStudents.map(st => {
                const todaysLog = logData[st.id] || {};
                return {
                    ...st,
                    ...todaysLog,
                    revHeardBy: todaysLog.revHeardBy || ''
                };
            });
        }
        students = loadedStudents;
        renderStudents();
        hideLoadingIndicators();
    });
}

function showLoadingIndicators() {
    // Replace totals with loaders
    if (totalStudentsEl) totalStudentsEl.innerHTML = '<span class="loader-inline"></span>';
    if (presentStudentsEl) presentStudentsEl.innerHTML = '<span class="loader-inline"></span>';
    // Show a block loader in student list
    if (studentListContainer) studentListContainer.innerHTML = '<div class="loader-block"><div class="loader-inline"></div><div>Loading students...</div></div>';
}

function hideLoadingIndicators() {
    // If students already rendered, counts will be set in renderStudents
    // But ensure placeholders are removed if no students
    if (!students.length) {
        if (totalStudentsEl) totalStudentsEl.innerHTML = '0';
        if (presentStudentsEl) presentStudentsEl.innerHTML = '0';
    }
}

// --- Toast helper (single source of truth, used everywhere in this file) ---
function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2600);
}

// Turns a short PIN into a Firebase-valid password (min 6 chars).
// Invisible to the user — they still only ever type/set the real PIN.
// IMPORTANT: this exact function must also exist in app.js, unchanged.
function toAuthPassword(pin) {
    return String(pin).padEnd(6, '0');
}

const userIconSVG = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="white"/>
</svg>`;

const trashIconSVG = `
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6"></path><path d="M14 11v6"></path>
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
</svg>`;

// 4. Render — one DocumentFragment write instead of rebuilding innerHTML
// per change, plus event delegation instead of inline onclick handlers.
function getFilteredStudents() {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) => student.name.toLowerCase().includes(term));
}

function buildNumberSelectOptions(selectedValue = 0) {
    return Array.from({ length: 1001 }, (_, value) => {
        return `<option value="${value}" ${Number(selectedValue) === value ? 'selected' : ''}>${value}</option>`;
    }).join('');
}

function formatProgressDateLabel(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function updateProgressEditAttendanceUI() {
    if (progressEditPresentBtn) {
        progressEditPresentBtn.classList.toggle('active-p', isProgressEditPresent);
    }
    if (progressEditAbsentBtn) {
        progressEditAbsentBtn.classList.toggle('active-a', !isProgressEditPresent);
    }
}

function lockBodyScroll() {
    document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
    if (!document.querySelector('.modal-overlay:not(.hidden)')) {
        document.body.classList.remove('modal-open');
    }
}

function pushModalState() {
    if (!history.state || !history.state.modalOpen) {
        history.pushState({ modalOpen: true }, '');
    }
}

function closeProgressEditModal() {
    if (progressDateEditModal) progressDateEditModal.classList.add('hidden');
    currentProgressEditDateKey = null;
    if (progressEditNew) progressEditNew.innerHTML = '';
    if (progressEditRev) progressEditRev.innerHTML = '';
    if (progressEditRemarks) progressEditRemarks.value = '';
    if (progressEditHeardBy) progressEditHeardBy.value = '';
    if (progressEditModalTitle) progressEditModalTitle.innerText = 'Edit Daily Progress';
    unlockBodyScroll();
}

function openProgressEditModal(dateKey) {
    if (!currentProgressStudentId || !progressDateEditModal || !progressEditNew || !progressEditRev) return;

    const entry = currentProgressLogSnapshot[dateKey]?.[currentProgressStudentId] || {};
    currentProgressEditDateKey = dateKey;
    isProgressEditPresent = entry.isPresent === true;

    const student = students.find((item) => item.id === currentProgressStudentId);
    const studentName = student ? student.name : 'Student';

    progressEditDateLabel.innerText = formatProgressDateLabel(dateKey);
    progressEditModalTitle.innerText = `${studentName}`;
    progressEditNew.innerHTML = buildNumberSelectOptions(entry.newPages || 0);
    progressEditRev.innerHTML = buildNumberSelectOptions(entry.rev || 0);
    progressEditRemarks.value = entry.remarks || '';
    progressEditHeardBy.value = entry.revHeardBy || '';
    updateProgressEditAttendanceUI();
    progressDateEditModal.classList.remove('hidden');
}

function saveProgressEditModal() {
    if (!currentProgressStudentId || !currentProgressEditDateKey || !currentTeacherUid) return;

    const payload = {
        name: students.find((s) => s.id === currentProgressStudentId)?.name || '',
        isPresent: isProgressEditPresent,
        newPages: Math.max(0, Math.min(1000, Number(progressEditNew.value) || 0)),
        rev: Math.max(0, Math.min(1000, Number(progressEditRev.value) || 0)),
        remarks: progressEditRemarks.value.trim(),
        revHeardBy: progressEditHeardBy.value.trim()
    };

    if (btnSaveProgressEdit) {
        btnSaveProgressEdit.disabled = true;
        btnSaveProgressEdit.innerHTML = '<span class="loader-inline1" aria-hidden="true"></span>';
    }

    const logRef = ref(database, `teachers/${currentTeacherUid}/logs/${currentProgressEditDateKey}`);
    update(logRef, {
        [currentProgressStudentId]: payload
    }).then(() => {
        currentProgressLogSnapshot[currentProgressEditDateKey] = currentProgressLogSnapshot[currentProgressEditDateKey] || {};
        currentProgressLogSnapshot[currentProgressEditDateKey][currentProgressStudentId] = payload;
        const matchedStudent = students.find((item) => item.id === currentProgressStudentId);
        if (matchedStudent && currentProgressEditDateKey === todayStr) {
            matchedStudent.isPresent = payload.isPresent;
            matchedStudent.newPages = payload.newPages;
            matchedStudent.rev = payload.rev;
            matchedStudent.revHeardBy = payload.revHeardBy;
            matchedStudent.remarks = payload.remarks;
            renderStudents();
        }

        setTimeout(() => {
            if (btnSaveProgressEdit) {
                btnSaveProgressEdit.disabled = false;
                btnSaveProgressEdit.innerHTML = 'Save Changes';
            }
            closeProgressEditModal();
            loadStudentProgressReport(currentProgressStudentId);
            showToast('Monthly progress updated successfully.', 'success');
        }, 3000);
    }).catch((error) => {
        console.error(error);
        if (btnSaveProgressEdit) {
            btnSaveProgressEdit.disabled = false;
            btnSaveProgressEdit.innerHTML = 'Save Changes';
        }
        showToast('Unable to update monthly progress.', 'error');
    });
}

function renderStudents() {
    const fragment = document.createDocumentFragment();
    const visibleStudents = getFilteredStudents();
    let presentCount = 0;

    if (!visibleStudents.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `<p>No student found matching “${searchTerm.trim()}”.</p>`;
        studentListContainer.innerHTML = '';
        studentListContainer.appendChild(emptyState);
        totalStudentsEl.innerText = students.length;
        presentStudentsEl.innerText = students.filter((student) => student.isPresent).length;
        return;
    }

    visibleStudents.forEach((student) => {
        if (student.isPresent) presentCount++;

        const card = document.createElement('div');
        card.className = `student-card ${student.isPresent ? '' : 'absent'}${student.expanded ? ' expanded' : ''}`;

        card.innerHTML = `
            <div class="sc-top" data-action="toggle-card" data-student-id="${student.id}">
                <div class="sc-info">
                    <div class="av">${userIconSVG}</div>
                    <div>
                        <h4>${student.name}</h4>
                        <p class="student-meta">ID: ${student.id} | PIN: ${student.pin}</p>
                    </div>
                </div>
                <div class="sc-actions">
                <div class="toggle-p-a">
                    <button class="${student.isPresent ? 'active-p' : ''}" data-action="present" data-student-id="${student.id}">P</button>
                    <button class="${!student.isPresent ? 'active-a' : ''}" data-action="absent" data-student-id="${student.id}">A</button>
                </div>
                    <button class="icon-btn-delete" data-action="delete" data-student-id="${student.id}" title="Remove student">
                    ${trashIconSVG}
                    </button>
            </div>
            </div>
            <div class="sc-bottom">
                <div class="progress-row">
                    <div class="progress-item">
                        <span>New Pages</span>
                        <select class="page-select" data-action="new-pages" data-student-id="${student.id}" aria-label="New pages for ${student.name}">
                            ${buildNumberSelectOptions(student.newPages || 0)}
                        </select>
                    </div>
                    <div class="progress-item">
                        <span>Revision Pages</span>
                        <select class="page-select" data-action="rev-pages" data-student-id="${student.id}" aria-label="Revision pages for ${student.name}">
                            ${buildNumberSelectOptions(student.rev || 0)}
                        </select>
                    </div>
                </div>
                <div class="heard-by-row">
                    <label for="heard-by-${student.id}">Revision heard by</label>
                    <input type="text" id="heard-by-${student.id}" value="${student.revHeardBy || ''}" data-action="heardby" data-student-id="${student.id}" placeholder="Enter name">
                </div>
                <input type="text" class="remark-input" placeholder="Remarks..." value="${student.remarks}" data-action="remark" data-student-id="${student.id}">
                <button class="btn-outline btn-monthly-progress full-width" data-action="monthly-progress" data-student-id="${student.id}">View Monthly Progress</button>

            </div>
        `;
        fragment.appendChild(card);
    });

    studentListContainer.innerHTML = '';
    studentListContainer.appendChild(fragment);

    totalStudentsEl.innerText = students.length;
    presentStudentsEl.innerText = students.filter((student) => student.isPresent).length;
}

if (studentSearchInput) {
    studentSearchInput.addEventListener('input', (event) => {
        searchTerm = event.target.value;
        renderStudents();
    });
}

studentListContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const studentId = btn.dataset.studentId;
    const action = btn.dataset.action;
    const student = students.find((item) => item.id === studentId);

    if (!student) return;

    if (action === 'present') {
        student.isPresent = true;
        renderStudents();
    } else if (action === 'absent') {
        student.isPresent = false;
        renderStudents();
    } else if (action === 'toggle-card') {
        student.expanded = !student.expanded;
        renderStudents();
    } else if (action === 'delete') {
        openDeleteModal(studentId);
    } else if (action === 'monthly-progress') {
        openStudentProgressModal(studentId);
    }
});

studentListContainer.addEventListener('change', (e) => {
    const selectEl = e.target.closest('[data-action="new-pages"]');
    if (selectEl) {
        const student = students.find((item) => item.id === selectEl.dataset.studentId);
        if (student) {
            student.newPages = Math.max(0, Math.min(1000, Number(selectEl.value) || 0));
        }
        return;
    }

    const revSelectEl = e.target.closest('[data-action="rev-pages"]');
    if (revSelectEl) {
        const student = students.find((item) => item.id === revSelectEl.dataset.studentId);
        if (student) {
            student.rev = Math.max(0, Math.min(1000, Number(revSelectEl.value) || 0));
        }
    }
});

studentListContainer.addEventListener('input', (e) => {
    const input = e.target.closest('[data-action="heardby"]');
    if (input) {
        const student = students.find((item) => item.id === input.dataset.studentId);
        if (student) {
            student.revHeardBy = input.value;
        }
        return;
    }

    const remarkInput = e.target.closest('[data-action="remark"]');
    if (remarkInput) {
        const student = students.find((item) => item.id === remarkInput.dataset.studentId);
        if (student) {
            student.remarks = remarkInput.value;
        }
    }
});

function openStudentProgressModal(studentId) {
    const student = students.find((item) => item.id === studentId);
    if (!student || !studentProgressModal) return;
    currentProgressStudentId = studentId;
    progressModalTitle.innerText = `Monthly Progress - ${student.name}`;
    const today = new Date();
    if (progressFilterMonth) {
        progressFilterMonth.value = String(today.getMonth() + 1).padStart(2, '0');
    }
    if (progressFilterYear) {
        progressFilterYear.value = String(today.getFullYear());
    }
    studentProgressModal.classList.remove('hidden');
    lockBodyScroll();
    pushModalState();
    loadStudentProgressReport(studentId);
}

function closeStudentProgressModal() {
    if (!studentProgressModal) return;
    studentProgressModal.classList.add('hidden');
    currentProgressStudentId = null;
    isProgressEditMode = false;
    if (btnToggleProgressEdit) {
        btnToggleProgressEdit.innerText = 'Edit';
        btnToggleProgressEdit.classList.remove('active-p');
    }
    closeProgressEditModal();
    unlockBodyScroll();
}

function loadStudentProgressReport(studentId) {
    if (!studentProgressModal || !progressModalTableBody || !progressFilterMonth || !progressFilterYear) return;
    const month = progressFilterMonth.value;
    const year = progressFilterYear.value;
    const prefix = `${year}-${month}`;
    progressModalTableBody.innerHTML = '<tr><td colspan="8" style="padding:16px; color:#888;">Loading monthly data...</td></tr>';

    get(ref(database, `teachers/${currentTeacherUid}/logs`)).then((snap) => {
        const rows = [];
        if (snap.exists()) {
            currentProgressLogSnapshot = snap.val();
            Object.keys(currentProgressLogSnapshot)
                .filter(dateKey => dateKey.startsWith(prefix))
                .sort((a, b) => b.localeCompare(a))
                .forEach((dateKey) => {
                    const entry = currentProgressLogSnapshot[dateKey]?.[studentId];
                    if (entry) {
                        rows.push({
                            date: dateKey,
                            newPages: entry.newPages || 0,
                            rev: entry.rev || 0,
                            present: entry.isPresent ? 1 : 0,
                            absent: entry.isPresent ? 0 : 1,
                            remarks: entry.remarks || '',
                            heardBy: entry.revHeardBy || ''
                        });
                    }
                });
        } else {
            currentProgressLogSnapshot = {};
        }

        if (rows.length === 0) {
            progressModalTableBody.innerHTML = '<tr><td colspan="8" style="padding:16px; color:#888;">No data found for this month.</td></tr>';
            return;
        }

        progressModalTableBody.innerHTML = '';
        rows.forEach((row) => {
            const [yearStr, monthStr, dayStr] = row.date.split('-');
            const dateObj = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
            const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            const editButtonMarkup = isProgressEditMode
                ? `<button type="button" class="icon-btn" data-action="edit-progress-row" data-date="${row.date}" title="Edit ${formattedDate}" style="padding:4px 7px; font-size:11px; line-height:1; background:#eef2ff; color:#1d4ed8;">✎</button>`
                : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="sticky-col" style="font-size:11px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${editButtonMarkup}
                        <span>${formattedDate}</span>
                    </div>
                </td>
                <td>${row.newPages || ''}</td>
                <td>${row.rev || ''}</td>
                <td style="color:#137333; font-weight:bold;">${row.present}</td>
                <td style="color:#b71c1c; font-weight:bold; background:#ffebee;">${row.absent}</td>
                <td style="font-size:11px;">${row.remarks}</td>
                <td style="font-size:11px;">${row.heardBy}</td>
            `;
            progressModalTableBody.appendChild(tr);
        });
    }).catch((err) => {
        console.error(err);
        progressModalTableBody.innerHTML = '<tr><td colspan="8" style="padding:16px; color:#888;">Unable to load monthly data.</td></tr>';
    });
}

if (btnCloseProgressModal) {
    btnCloseProgressModal.addEventListener('click', () => {
        if (history.state && history.state.modalOpen) {
            history.back();
        } else {
            closeStudentProgressModal();
        }
    });
}

if (studentProgressModal) {
    studentProgressModal.addEventListener('click', (e) => {
        if (e.target === studentProgressModal) {
            if (history.state && history.state.modalOpen) {
                history.back();
            } else {
                closeStudentProgressModal();
            }
        }
    });
}

if (btnToggleProgressEdit) {
    btnToggleProgressEdit.addEventListener('click', () => {
        isProgressEditMode = !isProgressEditMode;
        if (btnToggleProgressEdit) {
            btnToggleProgressEdit.innerText = isProgressEditMode ? 'Done' : 'Edit';
            btnToggleProgressEdit.classList.toggle('active-p', isProgressEditMode);
        }
        if (!isProgressEditMode) {
            closeProgressEditModal();
        }
        if (currentProgressStudentId) {
            loadStudentProgressReport(currentProgressStudentId);
        }
    });
}

if (progressEditPresentBtn) {
    progressEditPresentBtn.addEventListener('click', () => {
        isProgressEditPresent = true;
        updateProgressEditAttendanceUI();
    });
}

if (progressEditAbsentBtn) {
    progressEditAbsentBtn.addEventListener('click', () => {
        isProgressEditPresent = false;
        updateProgressEditAttendanceUI();
    });
}

if (btnSaveProgressEdit) {
    btnSaveProgressEdit.addEventListener('click', saveProgressEditModal);
}

if (btnCancelProgressEdit) {
    btnCancelProgressEdit.addEventListener('click', closeProgressEditModal);
}

if (btnCloseProgressEditModal) {
    btnCloseProgressEditModal.addEventListener('click', closeProgressEditModal);
}

if (progressDateEditModal) {
    progressDateEditModal.addEventListener('click', (e) => {
        if (e.target === progressDateEditModal) {
            closeProgressEditModal();
        }
    });
}

if (progressModalTableBody) {
    progressModalTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-progress-row"]');
        if (!editBtn) return;
        openProgressEditModal(editBtn.dataset.date);
    });
}

if (progressFilterMonth) {
    progressFilterMonth.addEventListener('change', () => {
        if (currentProgressStudentId) loadStudentProgressReport(currentProgressStudentId);
    });
}

if (progressFilterYear) {
    progressFilterYear.addEventListener('change', () => {
        if (currentProgressStudentId) loadStudentProgressReport(currentProgressStudentId);
    });
}

// 5. Basic Button Listeners
if (btnMarkAll) btnMarkAll.addEventListener('click', () => { students.forEach(s => s.isPresent = true); renderStudents(); });
if (btnMenu && teacherMenuBackdrop && teacherSideMenu) {
    const closeTeacherMenu = () => {
        teacherSideMenu.classList.remove('open');
        teacherMenuBackdrop.classList.remove('open');
        teacherSideMenu.setAttribute('aria-hidden', 'true');
    };
    const openTeacherMenu = () => {
        teacherSideMenu.classList.add('open');
        teacherMenuBackdrop.classList.add('open');
        teacherSideMenu.setAttribute('aria-hidden', 'false');
    };
    btnMenu.addEventListener('click', (event) => {
        event.stopPropagation();
        openTeacherMenu();
    });
    btnMenuClose?.addEventListener('click', closeTeacherMenu);
    teacherMenuBackdrop?.addEventListener('click', closeTeacherMenu);
}
if (btnMenuHome) btnMenuHome.addEventListener('click', () => { teacherSideMenu.classList.remove('open'); teacherMenuBackdrop.classList.remove('open'); window.location.href = 'teacher.html'; });
if (btnMenuCertGenerator) btnMenuCertGenerator.addEventListener('click', () => { teacherSideMenu.classList.remove('open'); teacherMenuBackdrop.classList.remove('open'); window.location.href = '../Certificate-Generator/certificategenerator.html'; });
if (btnMenuUpload) btnMenuUpload.addEventListener('click', () => { window.location.href = '../Upload/upload.html'; });
if (btnMenuReport) btnMenuReport.addEventListener('click', () => { teacherSideMenu.classList.remove('open'); teacherMenuBackdrop.classList.remove('open'); window.location.href = '../Report/reports.html'; });
if (btnMenuLogout) btnMenuLogout.addEventListener('click', () => { teacherSideMenu.classList.remove('open'); teacherMenuBackdrop.classList.remove('open'); signOut(auth).then(() => window.location.href = '../../index.html'); });
if (btnViewReports) btnViewReports.addEventListener('click', () => window.location.href = '../Report/reports.html');

// --- 6. ADD STUDENT (creates real Auth account + duplicate check) ---
function updateStudentNameHint() {
    if (!newStudentNameInput || !newStudentNameHint) return;
    const value = newStudentNameInput.value.trim();
    const isValid = value.length >= 3;
    newStudentNameInput.classList.toggle('input-error', value.length > 0 && !isValid);
    newStudentNameHint.textContent = isValid ? 'Name looks good.' : 'Name must be at least 3 characters.';
    newStudentNameHint.style.color = isValid ? '#137333' : '#8E785C';
}
if (newStudentNameInput) newStudentNameInput.addEventListener('input', updateStudentNameHint);

function resetAddForm() {
    addStudentForm.reset();
    if (newStudentNameInput) newStudentNameInput.classList.remove('input-error');
    if (newStudentPinInput) newStudentPinInput.classList.remove('input-error');
    if (newStudentNameHint) {
        newStudentNameHint.textContent = 'Name must be at least 3 characters.';
        newStudentNameHint.style.color = '#8E785C';
    }
    if (newStudentPinHint) {
        newStudentPinHint.textContent = 'PIN must be at least 4 digits.';
        newStudentPinHint.style.color = '#8E785C';
    }
}

function openAddStudentModal() {
    if (!addStudentModal) return;
    addStudentModal.classList.remove('hidden');
    lockBodyScroll();
    pushModalState();
}

function closeAddStudentModal() {
    if (!addStudentModal) return;
    addStudentModal.classList.add('hidden');
    resetAddForm();
    unlockBodyScroll();
}

if (btnAddStudent) btnAddStudent.addEventListener('click', openAddStudentModal);
if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeAddStudentModal);
if (addStudentModal) {
    addStudentModal.addEventListener('click', (e) => {
        if (e.target === addStudentModal) closeAddStudentModal();
    });
}

if (addStudentForm) {
    addStudentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameVal = newStudentNameInput.value.trim();
        const idVal = newStudentIdInput.value.trim().toLowerCase();
        const pinVal = newStudentPinInput.value.trim();

        if (nameVal.length < 3) {
            newStudentNameInput.classList.add('input-error');
            updateStudentNameHint();
            return;
        }

        if (pinVal.length < 4 || !/^\d+$/.test(pinVal)) {
            newStudentPinInput.classList.add('input-error');
            if (newStudentPinHint) {
                newStudentPinHint.textContent = 'PIN must be at least 4 digits.';
                newStudentPinHint.style.color = '#b71c1c';
            }
            return;
        }
        if (newStudentPinHint) {
            newStudentPinHint.textContent = 'PIN must be at least 4 digits.';
            newStudentPinHint.style.color = '#8E785C';
        }

        const nameLower = nameVal.toLowerCase();
        const duplicate = students.find(s =>
            s.name.trim().toLowerCase() === nameLower ||
            String(s.id) === idVal ||
            String(s.pin) === pinVal
        );

        if (duplicate) {
            showToast("Student already exists.", "error");
            return;
        }

        const submitBtn = addStudentForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = "Saving...";

        const studentEmail = `${idVal.toLowerCase()}@student.ukquran.com`;
        const authPassword = toAuthPassword(pinVal);

        // Create the student's real login on the SECONDARY Firebase app
        // instance. Calling createUserWithEmailAndPassword on the primary
        // `auth` (the teacher's own session) would immediately switch the
        // active session to the new student account and kick the teacher
        // out. Using `secondaryAuth` avoids that entirely — it's a separate,
        // throwaway session, so the teacher's real session never moves.
        createUserWithEmailAndPassword(secondaryAuth, studentEmail, authPassword)
            .then(() => secondarySignOut(secondaryAuth))
            .then(() => {
                const newStudentRef = ref(database, `teachers/${currentTeacherUid}/students/${idVal}`);
                return set(newStudentRef, { name: nameVal, pin: pinVal });
            })
            .then(() => {
                students.push({ id: idVal, name: nameVal, pin: pinVal, isPresent: false, newPages: 0, rev: 0, remarks: "" });
                resetAddForm();
                addStudentModal.classList.add('hidden');
                renderStudents();
                showToast("Saved successfully! Student added.", "success");
            })
            .catch((err) => {
                console.error(err);
                if (err.code === 'auth/email-already-in-use') {
                    showToast("Student already exists.", "error");
                } else {
                    showToast("Could not save student. Please try again.", "error");
                }
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            });
    });
}

// --- 7. DELETE STUDENT ---
// Removes the database record + all their logs. Does NOT delete the
// Firebase Auth account itself (client SDK can only delete the currently
// signed-in user). With no data left, the student dashboard has nothing
// to show even if they log in again. Full Auth-account deletion needs a
// small backend (Cloud Function + Admin SDK) — ask if you want that added.
function openDeleteModal(studentId) {
    const student = students.find((item) => item.id === studentId);
    if (!student || !deleteStudentModal) return;

    pendingDeleteId = student.id;
    deleteStudentNameEl.innerText = student.name;
    deleteStudentModal.classList.remove('hidden');
    lockBodyScroll();
    pushModalState();
}

function closeDeleteModal() {
    pendingDeleteId = null;
    if (deleteStudentModal) deleteStudentModal.classList.add('hidden');
    unlockBodyScroll();
}

if (deleteStudentModal) {
    deleteStudentModal.addEventListener('click', (e) => {
        if (e.target === deleteStudentModal) closeDeleteModal();
    });
}

if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);

if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
        if (!pendingDeleteId) return;
        const idToDelete = pendingDeleteId;

        btnConfirmDelete.disabled = true;
        btnConfirmDelete.innerText = "Deleting...";

        try {
            // Only remove the roster entry — old logs (and old reports) are
            // left untouched on purpose so history survives the student
            // leaving.
            await remove(ref(database, `teachers/${currentTeacherUid}/students/${idToDelete}`));

            students = students.filter(s => s.id !== idToDelete);
            renderStudents();
            closeDeleteModal();
            showToast("Student removed from active roster.", "success");
        } catch (err) {
            console.error(err);
            showToast("Could not remove student. Please try again.", "error");
        } finally {
            btnConfirmDelete.disabled = false;
            btnConfirmDelete.innerText = "Delete";
        }
    });
}

// --- 8. SAVE DAILY REPORT ---
if (btnSaveReport) {
    btnSaveReport.addEventListener('click', () => {
        btnSaveReport.disabled = true;
        btnSaveLabel.innerText = "Saving to Database...";

        let logData = {};
        students.forEach(s => {
            logData[s.id] = {
                name: s.name,
                isPresent: s.isPresent,
                newPages: s.newPages,
                rev: s.rev,
                revHeardBy: s.revHeardBy || '',
                remarks: s.remarks
            };
        });

        const logRef = ref(database, `teachers/${currentTeacherUid}/logs/${todayStr}`);
        set(logRef, logData)
            .then(() => {
                showToast("Daily report saved successfully!", "success");
                btnSaveLabel.innerText = "✅ Saved Successfully!";
                setTimeout(() => { btnSaveLabel.innerText = "Save Daily Report"; }, 2000);
            })
            .catch((err) => {
                console.error(err);
                showToast("Could not save report. Please try again.", "error");
                btnSaveLabel.innerText = "Save Daily Report";
            })
            .finally(() => {
                btnSaveReport.disabled = false;
            });
    });
}