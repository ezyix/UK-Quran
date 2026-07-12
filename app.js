import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, database } from "./firebase-config.js";

// UI Logic: Toggle Roles
const btnStudent = document.getElementById('btn-student');
const btnTeacher = document.getElementById('btn-teacher');
const lblId = document.getElementById('lbl-id');
const lblPassword = document.getElementById('lbl-password');
const inputId = document.getElementById('input-id');
const inputPassword = document.getElementById('input-password');
const toastContainer = document.getElementById('toast-container');

let currentRole = 'student';

// If student.js redirected here because a deleted student's old login
// still worked but their data was gone, show a clear message instead of
// silently landing back on the login screen.
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('error') === 'account_removed') {
    showToast("This account no longer exists. Please contact your teacher.", "error");
    window.history.replaceState({}, document.title, window.location.pathname);
}

function showToast(message, type = 'error') {
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
// Invisible to the student — they still only ever type their real PIN.
// IMPORTANT: this exact function must also exist in teacher.js, unchanged,
// or a student created with one version won't be able to log in with the other.
function toAuthPassword(pin) {
    return String(pin).padEnd(6, '0');
}

btnStudent.addEventListener('click', () => {
    currentRole = 'student';
    btnStudent.classList.add('active');
    btnTeacher.classList.remove('active');
    lblId.innerText = 'Student ID';
    inputId.type = 'text';
    inputId.placeholder = 'name';
    lblPassword.innerText = 'PIN';
    inputPassword.value = '';
    inputId.value = '';
});

btnTeacher.addEventListener('click', () => {
    currentRole = 'teacher';
    btnTeacher.classList.add('active');
    btnStudent.classList.remove('active');
    lblId.innerText = 'Email Address';
    inputId.type = 'email';
    inputId.placeholder = 'teacher@ukquran.com';
    lblPassword.innerText = 'Password';
    inputPassword.value = '';
    inputId.value = '';
});

// Password visibility toggle
const togglePassword = document.getElementById('togglePassword');
togglePassword.addEventListener('click', function () {
    const isHidden = inputPassword.getAttribute('type') === 'password';
    inputPassword.setAttribute('type', isHidden ? 'text' : 'password');
    togglePassword.classList.toggle('is-visible', isHidden);
    togglePassword.setAttribute('aria-pressed', String(isHidden));
    togglePassword.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
});

const a2hsPrompt = document.getElementById('a2hs-prompt');
const btnAddHome = document.getElementById('btn-add-home');
const btnDismissA2HS = document.getElementById('btn-dismiss-a2hs');
const iosA2HSTip = document.getElementById('ios-a2hs-tip');
let deferredPrompt = null;

function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function shouldShowPrompt() {
    return !localStorage.getItem('ukquran_a2hs_added') && !localStorage.getItem('ukquran_a2hs_dismissed');
}

function showA2HSPrompt() {
    if (!a2hsPrompt) return;
    a2hsPrompt.classList.remove('hidden');
}

function hideA2HSPrompt() {
    if (!a2hsPrompt) return;
    a2hsPrompt.classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (shouldShowPrompt()) {
        showA2HSPrompt();
        iosA2HSTip.classList.add('hidden');
    }
});

window.addEventListener('appinstalled', () => {
    localStorage.setItem('ukquran_a2hs_added', 'true');
    hideA2HSPrompt();
});

btnAddHome.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
        localStorage.setItem('ukquran_a2hs_added', 'true');
        hideA2HSPrompt();
    } else {
        localStorage.setItem('ukquran_a2hs_dismissed', 'true');
        hideA2HSPrompt();
    }

    deferredPrompt = null;
});

btnDismissA2HS.addEventListener('click', () => {
    localStorage.setItem('ukquran_a2hs_dismissed', 'true');
    hideA2HSPrompt();
});

window.addEventListener('load', () => {
    if (!shouldShowPrompt()) {
        hideA2HSPrompt();
    } else if (isIos() && !isInStandaloneMode()) {
        showA2HSPrompt();
        iosA2HSTip.classList.remove('hidden');
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
});

// Login Logic
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const idOrEmail = inputId.value.trim();
    const passwordOrPin = inputPassword.value.trim();
    const submitBtn = document.getElementById('btn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader-inline1" aria-hidden="true"></span>';

    if (currentRole === 'teacher') {
        // Teacher Login uses standard Firebase Auth directly.
        signInWithEmailAndPassword(auth, idOrEmail, passwordOrPin)
            .then(() => {
                window.location.href = "teacher.html";
            })
            .catch(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = "Login ➔";
                showToast("Login failed: Invalid Input", "error");
            });

    } else if (currentRole === 'student') {
    const studentEmail = `${idOrEmail.toLowerCase()}@student.ukquran.com`;
    const authPassword = toAuthPassword(passwordOrPin);

    try {
        await signInWithEmailAndPassword(auth, studentEmail, authPassword);

        // Login succeeded, but that only proves the old Auth account still
        // exists — it doesn't mean the student record is still in the
        // database (a teacher may have deleted them since). Check that
        // BEFORE navigating anywhere, so a removed student never even
        // briefly sees the dashboard.
        const studentId = idOrEmail.toLowerCase();
        const teachersSnap = await get(ref(database, 'teachers'));
        let stillExists = false;

        if (teachersSnap.exists()) {
            teachersSnap.forEach((teacherSnap) => {
                const students = teacherSnap.child('students').val();
                if (students && students[studentId]) stillExists = true;
            });
        }

        if (stillExists) {
            window.location.href = "student.html";
        } else {
            await signOut(auth);
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Login ➔";
            showToast("This account no longer exists. Please contact your teacher.", "error");
        }
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Login ➔";
        showToast("Invalid Student ID or PIN.", "error");
    }
}
})