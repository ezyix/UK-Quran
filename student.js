import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, database } from "./firebase-config.js";

let myStudentId = null;
let myTeacherUid = null;
let myName = "Student";

const todayStr = new Date().toISOString().split('T')[0];
const currentMonthPrefix = todayStr.substring(0, 7); // e.g. "2026-07"

// UI Elements
const headerName = document.getElementById('student-header-name');
const headerId = document.getElementById('student-header-id');
const greetingText = document.getElementById('greeting-text');
const monthText = document.getElementById('current-month-text');
const historyTable = document.getElementById('modal-history-table-body');
const toastContainer = document.getElementById('toast-container');
const btnViewMonthly = document.getElementById('btn-view-monthly-progress');
const btnOpenThajweed = document.getElementById('btn-open-thajweed');
const monthlyModal = document.getElementById('modal-monthly-progress');
const btnCloseMonthly = document.getElementById('btn-close-monthly-progress');
const btnMenu = document.getElementById('btn-menu');
const menuDropdown = document.getElementById('student-dropdown-menu');
const btnMenuLogout = document.getElementById('btn-menu-logout');

// Input Elements
let isPresent = false;

const inpNew = document.getElementById('inp-new');
const inpRev = document.getElementById('inp-rev');
const inpRevHeardBy = document.getElementById('inp-rev-heard-by');

const btnSubmit = document.getElementById('btn-submit-progress');

function populateNumberSelect(selectEl, selectedValue = 0) {
    if (!selectEl) return;
    const safeValue = Math.max(0, Math.min(1000, Number(selectedValue) || 0));
    selectEl.innerHTML = Array.from({ length: 1001 }, (_, value) => {
        return `<option value="${value}">${value}</option>`;
    }).join('');
    selectEl.value = String(safeValue);
}

populateNumberSelect(inpNew, 0);
populateNumberSelect(inpRev, 0);

// --- Helper: Toast Notification ---
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

// --- 1. AUTH CHECK & SETUP ---
// Identity now comes from the real Firebase Auth session (set up when the
// student logs in via app.js), not from localStorage. This is what lets
// the database security rules verify who's making each request.
onAuthStateChanged(auth, async (user) => {
    if (user && user.email && user.email.includes('@student')) {
        myStudentId = user.email.split('@')[0];
        headerId.innerText = `ID: ${myStudentId}`;

        await findMyTeacher();

        if (myTeacherUid) {
            loadTodayData();
            loadMonthlyHistory();
        } else {
            // Student record no longer exists in the database (e.g. teacher
            // deleted them), even though their old login still technically
            // works. Sign them out immediately and send them back with a
            // clear error instead of leaving them on a broken dashboard.
            await signOut(auth);
            window.location.href = 'index.html?error=account_removed';
        }
    } else {
        window.location.href = 'index.html';
    }
});

async function findMyTeacher() {
    const teachersRef = ref(database, 'teachers');
    const snap = await get(teachersRef);

    if (snap.exists()) {
        snap.forEach((teacherSnap) => {
            const students = teacherSnap.child('students').val();
            if (students && students[myStudentId]) {
                myTeacherUid = teacherSnap.key;
                myName = students[myStudentId].name;
            }
        });
    }

    headerName.innerText = myName;
    greetingText.innerText = `Assalamu Alaikum, ${myName.split(' ')[0]}!`;
    monthText.innerText = `Submit your progress for ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.`;
}

// --- 2. LOAD DAILY & HISTORY DATA ---
function loadTodayData() {
    const todayRef = ref(database, `teachers/${myTeacherUid}/logs/${todayStr}/${myStudentId}`);
    get(todayRef).then((snap) => {
        if (snap.exists()) {
            const data = snap.val();
            isPresent = data.isPresent === true;
            updatePresentUI();
            populateNumberSelect(inpNew, data.newPages || 0);
            populateNumberSelect(inpRev, data.rev || 0);
            if (inpRevHeardBy) {
                inpRevHeardBy.value = data.revHeardBy || '';
            }
            btnSubmit.innerHTML = "✅ Update Progress";
        }
    });
}

function loadMonthlyHistory() {
    const logsRef = ref(database, `teachers/${myTeacherUid}/logs`);
    get(logsRef).then((snap) => {
        historyTable.innerHTML = '';
        let hasData = false;

        if (snap.exists()) {
            const allLogs = snap.val();
            const sortedDates = Object.keys(allLogs)
                .filter(date => date.startsWith(currentMonthPrefix))
                .sort((a, b) => b.localeCompare(a));

            sortedDates.forEach(dateKey => {
                const dailyData = allLogs[dateKey];
                if (dailyData[myStudentId]) {
                    hasData = true;
                    const entry = dailyData[myStudentId];

                    const p = entry.isPresent ? "1" : "0";
                    const a = !entry.isPresent ? "1" : "0";
                    const pStyle = entry.isPresent ? "color: #137333; font-weight:bold;" : "";
                    const aStyle = !entry.isPresent ? "color: #b71c1c; font-weight:bold; background:#ffebee;" : "";
                    const rmk = (entry.remarks && entry.remarks.trim() !== "") ? entry.remarks : "";

                    // Parse date parts manually — new Date("YYYY-MM-DD") parses
                    // as UTC midnight and can shift a day depending on the
                    // viewer's timezone. This avoids that.
                    const [yy, mm, dd] = dateKey.split('-').map(Number);
                    const dateObj = new Date(yy, mm - 1, dd);
                    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="sticky-col" style="font-size:11px;">${formattedDate}</td>
                        <td>${entry.newPages > 0 ? entry.newPages : ""}</td>
                        <td>${entry.rev > 0 ? entry.rev : ""}</td>
                        <td style="${pStyle}">${p}</td>
                        <td style="${aStyle}">${a}</td>
                        <td style="font-size:11px; ${rmk ? 'color:#1b5e20;' : ''}">${rmk}</td>
                    `;
                    historyTable.appendChild(tr);
                }
            });
        }

        if (!hasData) {
            historyTable.innerHTML = `<tr><td colspan="6" style="padding:20px; color:#888;">No history yet for this month.</td></tr>`;
        }
    });
}

// --- 3. UI INTERACTIONS ---

// Two-button segmented toggle (matches teacher dashboard's P/A pattern) —
// no ambiguous single-button flip.
function updatePresentUI() {
    const btnMarkPresent = document.getElementById('btn-mark-present');
    const btnMarkAbsent = document.getElementById('btn-mark-absent');
    btnMarkPresent.classList.toggle('active-p', isPresent);
    btnMarkAbsent.classList.toggle('active-a', !isPresent);
}
document.getElementById('btn-mark-present').addEventListener('click', () => {
    isPresent = true;
    updatePresentUI();
});
document.getElementById('btn-mark-absent').addEventListener('click', () => {
    isPresent = false;
    updatePresentUI();
});

if (btnViewMonthly) {
    btnViewMonthly.addEventListener('click', () => {
        if (!myTeacherUid) return;
        if (monthlyModal) monthlyModal.classList.remove('hidden');
        loadMonthlyHistory();
    });
}

if (btnOpenThajweed) {
    btnOpenThajweed.addEventListener('click', () => {
        window.location.href = 'thajweed.html';
    });
}

if (btnCloseMonthly) {
    btnCloseMonthly.addEventListener('click', () => {
        if (monthlyModal) monthlyModal.classList.add('hidden');
    });
}

if (monthlyModal) {
    monthlyModal.addEventListener('click', (event) => {
        if (event.target === monthlyModal) {
            monthlyModal.classList.add('hidden');
        }
    });
}

// --- 4. SUBMIT TO FIREBASE ---
btnSubmit.addEventListener('click', () => {
    if (!myTeacherUid) return;

    btnSubmit.innerHTML = "Saving...";

    const payload = {
        name: myName,
        isPresent: isPresent,
        newPages: parseInt(inpNew.value),
        rev: parseInt(inpRev.value),
        revHeardBy: inpRevHeardBy ? inpRevHeardBy.value.trim() : ''
        // Students do not submit remarks — teacher-only field.
    };

    // Use `update` (not `set`) so other students' entries for today aren't wiped.
    const logRef = ref(database, `teachers/${myTeacherUid}/logs/${todayStr}`);

    update(logRef, {
        [myStudentId]: payload
    }).then(() => {
        showToast("Progress Saved! Alhamdulillah.");
        btnSubmit.innerHTML = "✅ Update Progress";
        loadMonthlyHistory();
    }).catch((error) => {
        console.error(error);
        showToast("Error saving data.", "error");
        btnSubmit.innerHTML = "✅ Submit Progress";
    });
});

// --- 5. LOGOUT ---
if (btnMenu) {
    btnMenu.addEventListener('click', (event) => {
        event.stopPropagation();
        if (menuDropdown) menuDropdown.classList.toggle('hidden');
    });
}

if (btnMenuLogout) {
    btnMenuLogout.addEventListener('click', () => {
        if (menuDropdown) menuDropdown.classList.add('hidden');
        signOut(auth).then(() => window.location.href = 'index.html');
    });
}

if (document.body) {
    document.body.addEventListener('click', (event) => {
        if (!btnMenu || !menuDropdown) return;
        if (event.target === btnMenu || btnMenu.contains(event.target)) return;
        if (event.target === menuDropdown || menuDropdown.contains(event.target)) return;
        menuDropdown.classList.add('hidden');
    });
}
