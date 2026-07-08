import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, query, orderByKey, startAt, endAt } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, database } from "./firebase-config.js";

let currentTeacherUid = null;
let studentsObj = {}; // Quick lookup for student names
let logsData = {};    // All logs for the teacher
let latestReportRows = [];
let latestReportSummary = { totalStudents: 0, avgGrade: '-', avgPresence: '0%' };

// HTML Elements
const btnBack = document.getElementById('btn-back');
const filterMonth = document.getElementById('filter-month');
const filterYear = document.getElementById('filter-year');
const tableBody = document.getElementById('report-table-body');
const tableTitle = document.getElementById('table-title');
const btnDownload = document.getElementById('btn-download-pdf');
const btnDownloadLabel = document.getElementById('btn-download-label') || btnDownload; // Fallback if label span is missing
const toastContainer = document.getElementById('toast-container');

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

// Go back to Dashboard
btnBack.addEventListener('click', () => { window.location.href = 'teacher.html'; });

if (btnDownload) {
    btnDownload.addEventListener('click', downloadPdfReport);
}

// Check Auth & Load Data
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentTeacherUid = user.uid;
        loadAllData();
    } else {
        window.location.href = 'index.html';
    }
});


function loadAllData() {
    const month = filterMonth.value;
    const year = filterYear.value;
    const prefix = `${year}-${month}`;

    const studentsRef = ref(database, `teachers/${currentTeacherUid}/students`);
    const logsRef = query(
        ref(database, `teachers/${currentTeacherUid}/logs`),
        orderByKey(),
        startAt(`${prefix}-01`),
        endAt(`${prefix}-31`)
    );

    Promise.all([get(studentsRef), get(logsRef)]).then(([studentSnap, logSnap]) => {
        studentsObj = studentSnap.exists() ? studentSnap.val() : {};
        logsData = logSnap.exists() ? logSnap.val() : {};
        generateReport();
    });
}

// Function to analyze text remarks and calculate an overall average grade
function calculateAvgGrade(remarksArray) {
    if (remarksArray.length === 0) return "-";

    let totalScore = 0;
    let validRemarks = 0;

    remarksArray.forEach(remark => {
        let r = remark.toLowerCase();
        if (r.includes("excellent") || r.includes("smart") || r.includes("perfect") || r.includes("great") || r.includes("masha")) {
            totalScore += 5; validRemarks++;
        } else if (r.includes("good") || r.includes("well") || r.includes("nice")) {
            totalScore += 4; validRemarks++;
        } else if (r.includes("average") || r.includes("ok") || r.includes("fine")) {
            totalScore += 3; validRemarks++;
        } else if (r.includes("poor") || r.includes("bad") || r.includes("improve")) {
            totalScore += 2; validRemarks++;
        }
    });

    if (validRemarks === 0) return "No Data";

    let avg = totalScore / validRemarks;
    if (avg >= 4.5) return "Excellent";
    if (avg >= 3.5) return "Good";
    if (avg >= 2.5) return "Average";
    return "Needs Work";
}

// HELPER FUNCTION: Find the most frequent string in an array (Mode)
function getMostFrequent(arr) {
    if (!arr || arr.length === 0) return "-";
    const counts = {};
    let maxCount = 0;
    let mostFrequent = "-";
    for (let val of arr) {
        counts[val] = (counts[val] || 0) + 1;
        if (counts[val] > maxCount) {
            maxCount = counts[val];
            mostFrequent = val;
        }
    }
    return mostFrequent;
}

function generateReport() {
    document.getElementById('report-total-students').innerText = Object.keys(studentsObj).length;

    const month = filterMonth.value;
    const year = filterYear.value;

    const monthName = filterMonth.options[filterMonth.selectedIndex].text;
    tableTitle.innerText = `Month of ${monthName} ${year}`;
    tableBody.innerHTML = '';

    const prefix = `${year}-${month}`;

    let totals = {};
    for (let studentId in studentsObj) {
        totals[studentId] = {
            name: studentsObj[studentId].name,
            newPages: 0, rev: 0, present: 0, absent: 0,
            loggedDays: 0, // days THIS student actually has a log entry for
            remarksList: []
        };
    }

    let allRemarksList = [];

    for (let dateKey in logsData) {
        if (dateKey.startsWith(prefix)) {
            let dailyLog = logsData[dateKey];

            for (let studentId in dailyLog) {
                if (totals[studentId]) {
                    totals[studentId].loggedDays += 1;
                    const entry = dailyLog[studentId];
                    if (entry.isPresent) {
                        totals[studentId].present += 1;
                        totals[studentId].newPages += Number(entry.newPages || 0);
                        totals[studentId].rev += Number(entry.rev || 0);
                    } else {
                        totals[studentId].absent += 1;
                    }
                    if (entry.remarks && entry.remarks.trim() !== "") {
                        totals[studentId].remarksList.push(entry.remarks.trim());
                        allRemarksList.push(entry.remarks.trim());
                    }
                }
            }
        }
    }

    let totalPresencePercentage = 0;
    let studentsWithData = 0;
    latestReportRows = [];

    for (let id in totals) {
        let st = totals[id];

        // Only count this student toward the average if they actually have
        // at least one logged day this month — otherwise dividing by 0 (or
        // by days before they existed) skews the class average unfairly.
        if (st.loggedDays > 0) {
            totalPresencePercentage += (st.present / st.loggedDays) * 100;
            studentsWithData++;
        }

        const finalRemark = getMostFrequent(st.remarksList);

        const presentStyle = st.present > 0 ? "color: #137333; font-weight:bold;" : "";
        const absentStyle = st.absent > 0 ? "color: #b71c1c; font-weight:bold; background:#ffebee;" : "";
        const remarkStyle = finalRemark !== "-" ? "background:#e8f5e9; color:#1b5e20;" : "";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${st.name}</td>
            <td>${st.newPages > 0 ? st.newPages : ""}</td>
            <td>${st.rev > 0 ? st.rev : ""}</td>
            <td style="${presentStyle}">${st.present}</td>
            <td style="${absentStyle}">${st.absent}</td>
            <td style="${remarkStyle}; font-size:11px;">${finalRemark}</td>
        `;
        tableBody.appendChild(tr);

        latestReportRows.push({
            name: st.name,
            newPages: st.newPages > 0 ? st.newPages : '',
            rev: st.rev > 0 ? st.rev : '',
            present: st.present,
            absent: st.absent,
            remark: finalRemark
        });
    }

    if (studentsWithData > 0) {
        let finalAvg = (totalPresencePercentage / studentsWithData).toFixed(0);
        document.getElementById('report-avg-presence').innerText = `${finalAvg}%`;
    } else {
        document.getElementById('report-avg-presence').innerText = `0%`;
    }

    document.getElementById('report-avg-grade').innerText = calculateAvgGrade(allRemarksList);

    latestReportSummary = {
        totalStudents: document.getElementById('report-total-students').innerText,
        avgGrade: document.getElementById('report-avg-grade').innerText,
        avgPresence: document.getElementById('report-avg-presence').innerText
    };
}

// Re-generate report when dropdowns change
filterMonth.addEventListener('change', loadAllData);
  filterYear.addEventListener('change', loadAllData);


// ---------------------------------------------------------------------------
// PDF EXPORT
// Uses jsPDF + AutoTable (real vector PDF table, not a screenshot of the DOM).
// ---------------------------------------------------------------------------
function downloadPdfReport() {
    const jsPDFLib = window.jspdf && window.jspdf.jsPDF;
    const monthName = filterMonth.options[filterMonth.selectedIndex].text;
    const year = filterYear.value;
    const fileName = `Quran Learning Report - ${monthName} ${year}.pdf`;

    if (!jsPDFLib) {
        showToast("PDF library failed to load. Opening print dialog instead.", "error");
        window.print();
        return;
    }

    btnDownload.disabled = true;
    const originalLabel = btnDownloadLabel.innerText;
    btnDownloadLabel.innerText = 'Generating PDF...';

    try {
        const doc = new jsPDFLib({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // Heading
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(216, 130, 18);
        doc.text(`Monthly Report - ${monthName} ${year}`, 14, 16);

        // Summary cards
        const cardY = 24, cardH = 18;

        doc.setFillColor(255, 243, 224); // orange
        doc.roundedRect(14, cardY, 90, cardH, 3, 3, 'F');
        doc.setFontSize(9); doc.setTextColor(136, 136, 136); doc.setFont('helvetica', 'normal');
        doc.text('Total Students', 18, cardY + 7);
        doc.setFontSize(14); doc.setTextColor(216, 130, 18); doc.setFont('helvetica', 'bold');
        doc.text(String(latestReportSummary.totalStudents), 18, cardY + 14);

        doc.setFillColor(232, 240, 254); // blue
        doc.roundedRect(110, cardY, 85, cardH, 3, 3, 'F');
        doc.setFontSize(9); doc.setTextColor(25, 103, 210); doc.setFont('helvetica', 'normal');
        doc.text('Avg Grade', 114, cardY + 7);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(String(latestReportSummary.avgGrade), 114, cardY + 14);

        doc.setFillColor(230, 244, 234); // green
        doc.roundedRect(201, cardY, 85, cardH, 3, 3, 'F');
        doc.setFontSize(9); doc.setTextColor(19, 115, 51); doc.setFont('helvetica', 'normal');
        doc.text('Avg Presence', 205, cardY + 7);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(String(latestReportSummary.avgPresence), 205, cardY + 14);

        // Table
        const head = [['Name', 'New (NW)', 'Revision (M)', 'Present (A)', 'Absent (AB)', 'Remarks']];
        const rows = latestReportRows.length > 0 ? latestReportRows : getRowsForPdf();
        const body = rows.map(r => [r.name, r.newPages, r.rev, r.present, r.absent, r.remark || '-']);

        doc.autoTable({
            head,
            body,
            startY: cardY + cardH + 8,
            theme: 'grid',
            headStyles: { fillColor: [74, 144, 226], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 3) data.cell.styles.textColor = [22, 163, 74];
                if (data.section === 'body' && data.column.index === 4) data.cell.styles.textColor = [220, 38, 38];
            }
        });

        doc.save(fileName);
    } catch (err) {
        console.error(err);
        showToast("Could not generate PDF. Please try again.", "error");
    } finally {
        btnDownload.disabled = false;
        btnDownloadLabel.innerText = originalLabel;
    }
}

// Fallback
function getRowsForPdf() {
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    return rows.map((tr) => {
        const cells = tr.querySelectorAll('td');
        return {
            name: cells[0]?.innerText.trim() || '-',
            newPages: cells[1]?.innerText.trim() || '',
            rev: cells[2]?.innerText.trim() || '',
            present: cells[3]?.innerText.trim() || '0',
            absent: cells[4]?.innerText.trim() || '0',
            remark: cells[5]?.innerText.trim() || '-'
        };
    });
}