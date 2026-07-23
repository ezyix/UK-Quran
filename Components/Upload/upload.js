import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";import { ref, get, push, set, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, database } from "../../JavaScript/firebase-config.js";

let currentTeacherUid = null;
let students = [];

const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1MB raw file, before compression

const btnBack = document.getElementById('btn-back');
const studentSelect = document.getElementById('student-select');
const uploadTitle = document.getElementById('upload-title');
const certFileInput = document.getElementById('cert-file');
const btnUploadSave = document.getElementById('btn-upload-save');
const btnUploadLabel = document.getElementById('btn-upload-label');
const uploadList = document.getElementById('upload-list');
const toastContainer = document.getElementById('toast-container');

const btnMenu = document.getElementById('btn-menu');
const menuBackdrop = document.getElementById('upload-menu-backdrop');
const sideMenu = document.getElementById('upload-side-menu');
const btnMenuClose = document.getElementById('btn-menu-close');
const btnMenuHome = document.getElementById('btn-menu-home');
const btnMenuCertGenerator = document.getElementById('btn-menu-cert-generator');
const btnMenuUpload = document.getElementById('btn-menu-upload');
const btnMenuReport = document.getElementById('btn-menu-report');
const btnMenuLogout = document.getElementById('btn-menu-logout');

btnBack.addEventListener('click', () => { window.location.href = '../Teacher/teacher.html'; });

const openMenu = () => {
    menuBackdrop.classList.add('open');
    sideMenu.classList.add('open');
    sideMenu.setAttribute('aria-hidden', 'false');
};
const closeMenu = () => {
    sideMenu.classList.remove('open');
    menuBackdrop.classList.remove('open');
    sideMenu.setAttribute('aria-hidden', 'true');
};

btnMenu.addEventListener('click', (event) => {
    event.stopPropagation();
    openMenu();
});
btnMenuClose?.addEventListener('click', closeMenu);
menuBackdrop?.addEventListener('click', closeMenu);

if (btnMenuHome) btnMenuHome.addEventListener('click', () => { closeMenu(); window.location.href = '../Teacher/teacher.html'; });
if (btnMenuCertGenerator) btnMenuCertGenerator.addEventListener('click', () => { closeMenu(); window.location.href = '../Certificate-Generator/certificategenerator.html'; });
if (btnMenuUpload) btnMenuUpload.addEventListener('click', closeMenu); // already on this page
if (btnMenuReport) btnMenuReport.addEventListener('click', () => { closeMenu(); window.location.href = '../Report/reports.html'; });
if (btnMenuLogout) btnMenuLogout.addEventListener('click', () => {
    closeMenu();
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js").then(({ signOut }) => {
        signOut(auth).then(() => window.location.href = '../../index.html');
    });
});

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

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentTeacherUid = user.uid;
        loadStudents();
    } else {
        window.location.href = '../../index.html';
    }
});

function loadStudents() {
    get(ref(database, `teachers/${currentTeacherUid}/students`)).then((snap) => {
        students = [];
        studentSelect.innerHTML = '<option value="">Select a student...</option>';
        if (snap.exists()) {
            snap.forEach((child) => {
                students.push({ id: child.key, name: child.val().name });
                const opt = document.createElement('option');
                opt.value = child.key;
                opt.innerText = child.val().name;
                studentSelect.appendChild(opt);
            });
        }
    });
}

studentSelect.addEventListener('change', () => {
    if (studentSelect.value) {
        loadUploadsForStudent(studentSelect.value);
    } else {
        uploadList.innerHTML = '<p style="color:#888; font-size:13px;">Select a student to view uploads.</p>';
    }
});

// Resize + compress the certificate image client-side before converting to
// base64, so it stays small in the database.
function compressImageToBase64(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

btnUploadSave.addEventListener('click', async () => {
    const studentId = studentSelect.value;
    if (!studentId) {
        showToast("Please select a student first.", "error");
        return;
    }

    const certFile = certFileInput.files[0];
    if (!certFile) {
        showToast("Choose a certificate image to upload.", "error");
        return;
    }
    if (certFile.size > MAX_IMAGE_BYTES) {
        showToast("Image is too large (max 1MB).", "error");
        return;
    }

    btnUploadSave.disabled = true;
    btnUploadLabel.innerText = "Uploading...";

    try {
        const title = uploadTitle.value.trim() || "Untitled";
        const uploadedAt = new Date().toISOString();
        const dataUrl = await compressImageToBase64(certFile);

        const baseRef = ref(database, `teachers/${currentTeacherUid}/certificates/${studentId}`);
        await set(push(baseRef), { type: 'certificate', title, fileName: certFile.name, dataUrl, uploadedAt });

        showToast("Uploaded successfully!", "success");
        uploadTitle.value = '';
        certFileInput.value = '';
        loadUploadsForStudent(studentId);
    } catch (err) {
        console.error(err);
        showToast("Upload failed. Please try again.", "error");
    } finally {
        btnUploadSave.disabled = false;
        btnUploadLabel.innerText = "Upload";
    }
});

function loadUploadsForStudent(studentId) {
    uploadList.innerHTML = '<p style="color:#888; font-size:13px;">Loading...</p>';
    get(ref(database, `teachers/${currentTeacherUid}/certificates/${studentId}`)).then((snap) => {
        uploadList.innerHTML = '';
        if (!snap.exists()) {
            uploadList.innerHTML = '<p style="color:#888; font-size:13px;">No certificates yet for this student.</p>';
            return;
        }
        snap.forEach((child) => {
            const item = child.val();
            const row = document.createElement('div');
            row.style.cssText = 'padding:10px; border:1px solid #eee; border-radius:8px; margin-bottom:8px;';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span>📄 ${item.title} <small style="color:#888;">(${new Date(item.uploadedAt).toLocaleDateString()})</small></span>
                    <button class="icon-btn-delete" data-key="${child.key}" title="Remove">✕</button>
                </div>
                <img src="${item.dataUrl}" style="max-width:100%; border-radius:8px;">
            `;
            uploadList.appendChild(row);
        });

        uploadList.querySelectorAll('[data-key]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await remove(ref(database, `teachers/${currentTeacherUid}/certificates/${studentId}/${btn.dataset.key}`));
                loadUploadsForStudent(studentId);
                showToast("Removed.", "success");
            });
        });
    });
}