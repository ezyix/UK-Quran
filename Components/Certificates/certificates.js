import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, database } from "../../JavaScript/firebase-config.js";

let myStudentId = null;
let myTeacherUid = null;

const btnBack = document.getElementById('btn-back');
const certificatesList = document.getElementById('certificates-list');

const btnMenu = document.getElementById('btn-menu');
const menuBackdrop = document.getElementById('certificates-menu-backdrop');
const sideMenu = document.getElementById('certificates-side-menu');
const btnMenuClose = document.getElementById('btn-menu-close');
const btnMenuHome = document.getElementById('btn-menu-home');
const btnMenuThajweed = document.getElementById('btn-menu-thajweed');
const btnMenuQiraat = document.getElementById('btn-menu-qiraat');
const btnMenuCertificates = document.getElementById('btn-menu-certificates');
const btnMenuLogout = document.getElementById('btn-menu-logout');

btnBack.addEventListener('click', () => { window.location.href = '../Student/student.html'; });

const openMenu = () => {
    sideMenu.classList.add('open');
    menuBackdrop.classList.add('open');
    sideMenu.setAttribute('aria-hidden', 'false');
};
const closeMenu = () => {
    sideMenu.classList.remove('open');
    menuBackdrop.classList.remove('open');
    sideMenu.setAttribute('aria-hidden', 'true');
};

btnMenu?.addEventListener('click', (event) => { event.stopPropagation(); openMenu(); });
btnMenuClose?.addEventListener('click', closeMenu);
menuBackdrop?.addEventListener('click', closeMenu);

btnMenuHome?.addEventListener('click', () => { closeMenu(); window.location.href = '../Student/student.html'; });
btnMenuThajweed?.addEventListener('click', () => { closeMenu(); window.location.href = '../Thajweed/thajweed.html'; });
btnMenuQiraat?.addEventListener('click', () => { closeMenu(); window.location.href = '../Qira\'at/qiraat.html'; });
btnMenuCertificates?.addEventListener('click', closeMenu); // already here
btnMenuLogout?.addEventListener('click', () => { closeMenu(); signOut(auth).then(() => window.location.href = '../../index.html'); });

// Same identity-resolution pattern as student.js: find which teacher this
// student belongs to, since the student's own record lives under that
// teacher's node.
onAuthStateChanged(auth, async (user) => {
    if (user && user.email && user.email.includes('@student')) {
        myStudentId = user.email.split('@')[0];
        await findMyTeacher();

        if (myTeacherUid) {
            loadCertificates();
        } else {
            certificatesList.innerHTML = '<p style="color:#888; font-size:13px;">Could not find your certificates.</p>';
        }
    } else {
        window.location.href = '../../index.html';
    }
});

async function findMyTeacher() {
    const snap = await get(ref(database, 'teachers'));
    if (snap.exists()) {
        snap.forEach((teacherSnap) => {
            const students = teacherSnap.child('students').val();
            if (students && students[myStudentId]) {
                myTeacherUid = teacherSnap.key;
            }
        });
    }
}

function loadCertificates() {
    get(ref(database, `teachers/${myTeacherUid}/certificates/${myStudentId}`)).then((snap) => {
        certificatesList.innerHTML = '';
        if (!snap.exists()) {
            certificatesList.innerHTML = '<p style="color:#888; font-size:13px;">No certificates uploaded yet.</p>';
            return;
        }
        snap.forEach((child) => {
            const item = child.val();
            const card = document.createElement('div');
            card.style.cssText = 'background:#fff; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 10px rgba(0,0,0,0.03);';
            card.innerHTML = `
                <h4 style="margin:0 0 10px; color:#5C4B37;">${item.title}</h4>
                <img src="${item.dataUrl}" style="max-width:100%; border-radius:8px;">
                <p style="margin:8px 0 0; font-size:11px; color:#888;">${new Date(item.uploadedAt).toLocaleDateString()}</p>
            `;
            certificatesList.appendChild(card);
        });
    });
}