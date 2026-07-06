import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-config.js";

// UI Logic: Toggle Roles
const btnStudent = document.getElementById('btn-student');
const btnTeacher = document.getElementById('btn-teacher');
const lblId = document.getElementById('lbl-id');
const lblPassword = document.getElementById('lbl-password');
const inputId = document.getElementById('input-id');
const inputPassword = document.getElementById('input-password');
const toastContainer = document.getElementById('toast-container');

let currentRole = 'student';

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
    inputId.placeholder = '12345-XXX';
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

// Login Logic
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const idOrEmail = inputId.value.trim();
    const passwordOrPin = inputPassword.value.trim();
    const submitBtn = document.querySelector('.btn-primary');

    submitBtn.innerText = "Loading...";

    if (currentRole === 'teacher') {
        // Teacher Login uses standard Firebase Auth directly.
        signInWithEmailAndPassword(auth, idOrEmail, passwordOrPin)
            .then(() => {
                window.location.href = "teacher.html";
            })
            .catch(() => {
                showToast("Login failed: Invalid Input", "error");
                submitBtn.innerText = "Login ➔";
            });

    } else if (currentRole === 'student') {
        // Student Login: build the same hidden alias-email + padded-PIN
        // combo that teacher.js used when creating the student's real
        // Firebase Auth account, then sign in normally. No database
        // scanning and no localStorage session needed — Firebase Auth
        // itself is the source of truth for who's logged in.
        const studentEmail = `${idOrEmail.toLowerCase()}@student.ukquran.com`;
        const authPassword = toAuthPassword(passwordOrPin);

        signInWithEmailAndPassword(auth, studentEmail, authPassword)
            .then(() => {
                window.location.href = "student.html";
            })
            .catch(() => {
                showToast("Invalid Student ID or PIN.", "error");
                submitBtn.innerText = "Login ➔";
            });
    }
});