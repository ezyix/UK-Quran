/* ==================================================================
   USWAT AL KALAM — Certificate Generator
   Pure vanilla JS. Draws the student's details onto the certificate
   background using an HTML5 canvas, then exports as high-quality WebP.
   ================================================================== */

(() => {
  'use strict';

  /* ----------------------------------------------------------------
     Configuration
     The coordinates below are measured against the ORIGINAL certificate
     artwork at its native size (1491 x 1055 px). Everything is scaled
     up by RENDER_SCALE at draw time so the exported file stays sharp.
     ---------------------------------------------------------------- */
  const BASE_W = 1491;
  const BASE_H = 1055;
  const RENDER_SCALE = 2; // internal render resolution multiplier (crisp export)

  const LAYOUT = {
    name: {
      centerX: 745,
      baselineY: 668,
      maxWidth: 860,
      maxFontSize: 66,
      minFontSize: 26,
      colorEnglish: '#0E2A5A',
      colorArabic: '#0E2A5A',
      fontEnglish: 'Cinzel',
      fontArabic: 'Noto Naskh Arabic'
    },
    juz: {
      centerX: 937,
      baselineY: 780,
      maxWidth: 268,
      maxFontSize: 27,
      minFontSize: 15,
      color: '#0E2A5A',
      fontEnglish: 'Poppins',
      fontArabic: 'Noto Naskh Arabic',
      weight: '600'
    },
    date: {
      centerX: 1170,
      baselineY: 965,
      maxWidth: 230,
      fontSize: 22,
      color: '#0E2A5A',
      font: 'Poppins',
      weight: '500'
    }
  };

  const BG_SRC = 'certificate-bg.png';
  const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F]/;

  /* ----------------------------------------------------------------
     Element references
     ---------------------------------------------------------------- */
  const form = document.getElementById('certForm');
  const nameInput = document.getElementById('studentName');
  const juzInput = document.getElementById('juzName');
  const dateInput = document.getElementById('certDate');

  const errName = document.getElementById('err-studentName');
  const errJuz = document.getElementById('err-juzName');
  const errDate = document.getElementById('err-certDate');

  const canvas = document.getElementById('certCanvas');
  const ctx = canvas.getContext('2d');
  const placeholder = document.getElementById('canvasPlaceholder');

  const downloadBtn = document.getElementById('downloadBtn');
  const printBtn = document.getElementById('printBtn');
  const resetBtn = document.getElementById('resetBtn');

  const btnMenu = document.getElementById('btn-menu');
  const btnMenuClose = document.getElementById('btn-menu-close');
  const menuBackdrop = document.getElementById('cert-menu-backdrop');
  const menuHome = document.getElementById('btn-menu-home');
  const menuCert = document.getElementById('btn-menu-cert-generator');
  const menuUpload = document.getElementById('btn-menu-upload');
  const menuReport = document.getElementById('btn-menu-report');
  const menuLogout = document.getElementById('btn-menu-logout');

  let bgImage = null;
  let bgLoadPromise = null;
  let hasGenerated = false;
  let currentStudentName = '';

  /* ----------------------------------------------------------------
     Toast helper (lightweight status / validation messages)
     ---------------------------------------------------------------- */
  let toastTimer = null;
  function showToast(message) {
    let toastEl = document.querySelector('.toast');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    // force reflow so the transition re-triggers on repeated messages
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  /* ----------------------------------------------------------------
     Background image loader (loaded once, reused for every render)
     ---------------------------------------------------------------- */
  function loadBackground() {
    if (bgLoadPromise) return bgLoadPromise;
    bgLoadPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { bgImage = img; resolve(img); };
      img.onerror = () => reject(new Error('Could not load certificate artwork.'));
      img.src = BG_SRC;
    });
    return bgLoadPromise;
  }

  /* ----------------------------------------------------------------
     Text helpers
     ---------------------------------------------------------------- */
  function isArabicText(str) {
    return ARABIC_RE.test(str);
  }

  // Finds the largest font size (within [min, max]) whose rendered
  // width fits inside maxWidth, using binary search against measureText.
  function fitFontSize(text, fontFamily, weight, maxWidth, maxSize, minSize) {
    let lo = minSize, hi = maxSize, best = minSize;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      ctx.font = `${weight ? weight + ' ' : ''}${mid}px "${fontFamily}"`;
      const width = ctx.measureText(text).width;
      if (width <= maxWidth) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }

  function drawCenteredText(text, cx, baselineY, opts) {
    const { fontFamily, weight = '', maxWidth, maxFontSize, minFontSize, color, fixedSize } = opts;
    let size = fixedSize;
    if (!size) {
      size = fitFontSize(text, fontFamily, weight, maxWidth, maxFontSize, minFontSize);
    }
    ctx.font = `${weight ? weight + ' ' : ''}${size}px "${fontFamily}"`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, cx, baselineY);
    return size;
  }

  function formatDate(isoDateStr) {
    // isoDateStr looks like "2026-07-17" (from <input type="date">)
    const [y, m, d] = isoDateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  /* ----------------------------------------------------------------
     Core render routine
     ---------------------------------------------------------------- */
  async function renderCertificate({ studentName, juzName, dateStr }) {
    await loadBackground();

    canvas.width = BASE_W * RENDER_SCALE;
    canvas.height = BASE_H * RENDER_SCALE;

    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    ctx.clearRect(0, 0, BASE_W, BASE_H);
    ctx.drawImage(bgImage, 0, 0, BASE_W, BASE_H);

    // -- Student name --------------------------------------------------
    const nameIsArabic = isArabicText(studentName);
    drawCenteredText(studentName, LAYOUT.name.centerX, LAYOUT.name.baselineY, {
      fontFamily: nameIsArabic ? LAYOUT.name.fontArabic : LAYOUT.name.fontEnglish,
      weight: nameIsArabic ? '600' : '500',
      maxWidth: LAYOUT.name.maxWidth,
      maxFontSize: LAYOUT.name.maxFontSize,
      minFontSize: LAYOUT.name.minFontSize,
      color: LAYOUT.name.colorEnglish
    });

    // -- Juz name --------------------------------------------------
    const juzIsArabic = isArabicText(juzName);
    drawCenteredText(juzName, LAYOUT.juz.centerX, LAYOUT.juz.baselineY, {
      fontFamily: juzIsArabic ? LAYOUT.juz.fontArabic : LAYOUT.juz.fontEnglish,
      weight: LAYOUT.juz.weight,
      maxWidth: LAYOUT.juz.maxWidth,
      maxFontSize: LAYOUT.juz.maxFontSize,
      minFontSize: LAYOUT.juz.minFontSize,
      color: LAYOUT.juz.color
    });

    // -- Date --------------------------------------------------
    drawCenteredText(formatDate(dateStr), LAYOUT.date.centerX, LAYOUT.date.baselineY, {
      fontFamily: LAYOUT.date.font,
      weight: LAYOUT.date.weight,
      maxWidth: LAYOUT.date.maxWidth,
      fixedSize: LAYOUT.date.fontSize,
      color: LAYOUT.date.color
    });

    // reset transform so canvas.toDataURL / toBlob export at full pixel size
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ----------------------------------------------------------------
     Validation
     ---------------------------------------------------------------- */
  function clearErrors() {
    [nameInput, juzInput, dateInput].forEach(el => el.classList.remove('invalid'));
    errName.textContent = '';
    errJuz.textContent = '';
    errDate.textContent = '';
  }

  function validate() {
    clearErrors();
    let valid = true;

    if (!nameInput.value.trim()) {
      errName.textContent = "Please enter the student's name.";
      nameInput.classList.add('invalid');
      valid = false;
    }
    if (!juzInput.value.trim()) {
      errJuz.textContent = 'Please enter the Juz name.';
      juzInput.classList.add('invalid');
      valid = false;
    }
    if (!dateInput.value) {
      errDate.textContent = 'Please select a date.';
      dateInput.classList.add('invalid');
      valid = false;
    }
    return valid;
  }

  /* ----------------------------------------------------------------
     Fonts must be fully loaded before canvas text measurement is
     reliable — otherwise the browser silently falls back to a
     generic serif and every width calculation is wrong.
     ---------------------------------------------------------------- */
  function waitForFonts() {
    const specs = [
      '600 66px "Cinzel"',
      '600 40px "Noto Naskh Arabic"',
      '600 27px "Poppins"',
      '500 22px "Poppins"'
    ];
    if (!document.fonts) return Promise.resolve();
    return Promise.all(specs.map(f => document.fonts.load(f))).then(() => document.fonts.ready);
  }

  /* ----------------------------------------------------------------
     Event: Generate
     ---------------------------------------------------------------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please fill in all required fields.');
      return;
    }

    const studentName = nameInput.value.trim();
    const juzName = juzInput.value.trim();
    const dateStr = dateInput.value;

    generateBtnSetLoading(true);
    try {
      await waitForFonts();
      await renderCertificate({ studentName, juzName, dateStr });

      currentStudentName = studentName;
      hasGenerated = true;
      placeholder.classList.add('hidden');
      canvas.classList.remove('hidden');
      downloadBtn.disabled = false;
      printBtn.disabled = false;
      showToast('Certificate Generated.');
    } catch (err) {
      console.error(err);
      showToast('');
    } finally {
      generateBtnSetLoading(false);
    }
  });

  function generateBtnSetLoading(isLoading) {
    const btn = document.getElementById('generateBtn');
    btn.disabled = isLoading;
    btn.querySelector('span').textContent = isLoading ? 'Generating…' : 'Generate Certificate';
  }

  /* ----------------------------------------------------------------
     Event: Reset
     ---------------------------------------------------------------- */
  resetBtn.addEventListener('click', () => {
    form.reset();
    clearErrors();
    hasGenerated = false;
    currentStudentName = '';
    canvas.classList.add('hidden');
    placeholder.classList.remove('hidden');
    downloadBtn.disabled = true;
    printBtn.disabled = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  function sanitizeFilename(name) {
    return name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-\u0600-\u06FF]/g, '')
      || 'student';
  }

  async function exportCanvasBlob({ type = 'image/jpeg', targetBytes = 0.9 * 1024 * 1024, minQuality = 0.55, maxQuality = 0.92, maxRounds = 8 } = {}) {
    const toBlob = (quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));

    let low = minQuality;
    let high = maxQuality;
    let bestBlob = await toBlob(high);

    if (!bestBlob) {
      throw new Error('Failed to export certificate image.');
    }

    if (bestBlob.size <= targetBytes) {
      return bestBlob;
    }

    let bestSize = bestBlob.size;
    let bestQuality = high;

    for (let i = 0; i < maxRounds; i += 1) {
      const quality = (low + high) / 2;
      const blob = await toBlob(quality);
      if (!blob) break;

      if (blob.size <= targetBytes) {
        bestBlob = blob;
        bestSize = blob.size;
        bestQuality = quality;
        low = quality;
      } else {
        high = quality;
      }

      if (high - low < 0.005) {
        break;
      }
    }

    return bestBlob;
  }

  function triggerDownload(href, filename) {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = href;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    a.dispatchEvent(clickEvent);
    document.body.removeChild(a);
  }

  downloadBtn.addEventListener('click', async () => {
    if (!hasGenerated) return;

    const filename = `certificate-${sanitizeFilename(currentStudentName)}.jpg`;
    try {
      const blob = await exportCanvasBlob({ type: 'image/jpeg', targetBytes: 0.9 * 1024 * 1024 });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, filename);
      showToast('downloading....');
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      console.error(err);
      showToast('Could not download certificate. Please try again.');
    }
  });

  /* ----------------------------------------------------------------
     Event: Print
     ---------------------------------------------------------------- */
  printBtn.addEventListener('click', () => {
    if (!hasGenerated) return;
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow pop-ups to print the certificate.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Certificate</title>
          <style>
            @page { margin: 0; size: landscape; }
            html, body { margin: 0; padding: 0; }
            img { width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.focus(); window.print();">
        </body>
      </html>
    `);
    printWindow.document.close();
  });

  /* ----------------------------------------------------------------
     Menu open/close helpers
     ---------------------------------------------------------------- */
  function openMenu() {
    document.getElementById('cert-side-menu').classList.add('open');
    menuBackdrop.classList.add('open');
    document.getElementById('cert-side-menu').setAttribute('aria-hidden', 'false');
  }

  function closeMenu() {
    document.getElementById('cert-side-menu').classList.remove('open');
    menuBackdrop.classList.remove('open');
    document.getElementById('cert-side-menu').setAttribute('aria-hidden', 'true');
  }

  if (btnMenu) btnMenu.addEventListener('click', openMenu);
  if (btnMenuClose) btnMenuClose.addEventListener('click', closeMenu);
  if (menuBackdrop) menuBackdrop.addEventListener('click', closeMenu);
  if (menuHome) menuHome.addEventListener('click', () => { window.location.href = '../Teacher/teacher.html'; });
  if (menuCert) menuCert.addEventListener('click', () => { window.location.href = './certificategenerator.html'; });
  if (menuUpload) menuUpload.addEventListener('click', () => { window.location.href = '../Upload/upload.html'; });
  if (menuReport) menuReport.addEventListener('click', () => { window.location.href = '../Report/reports.html'; });
  if (menuLogout) menuLogout.addEventListener('click', () => { window.location.href = '../../index.html'; });

  /* ----------------------------------------------------------------
     Preload the background artwork as soon as the page is ready so
     the first "Generate" click feels instant.
     ---------------------------------------------------------------- */
  loadBackground().catch((err) => console.warn(err.message));

  /* Default the date field to today for convenience */
  (function setDefaultDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  })();

})();
