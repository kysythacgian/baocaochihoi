const { Document, Packer, Paragraph, TextRun, AlignmentType, TabStopType, TabStopPosition } = docx;

// ===================== TOAST NOTIFICATION =====================
function showToast(title, message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
    <div class="toast-progress">
      <div class="toast-progress-bar"></div>
    </div>
  `;
  
  container.appendChild(toast);
  
  const timeout = setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
  
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.onclick = () => {
    clearTimeout(timeout);
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  };
  
  return toast;
}

// ===================== CONFIRM MODAL =====================
function showConfirm({ icon, title, message, confirmText, confirmClass, onConfirm, onCancel }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">${icon}</div>
      <div class="modal-title">${title}</div>
      <div class="modal-msg">${message}</div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" id="modalCancel">✖ Hủy</button>
        <button class="modal-btn ${confirmClass}" id="modalConfirm">${confirmText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#modalCancel').onclick = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };
  overlay.querySelector('#modalConfirm').onclick = () => { 
    overlay.remove(); 
    if (onConfirm) onConfirm();
  };
  overlay.addEventListener('click', e => { 
    if (e.target === overlay) {
      overlay.remove();
      if (onCancel) onCancel();
    }
  });
}

// ===================== SET BUTTON LOADING STATE =====================
function setButtonLoading(btn, isLoading, originalText) {
  if (isLoading) {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.innerHTML = '<span>⏳</span> Đang xử lý...';
  } else {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.innerHTML = originalText;
  }
}

// ===================== HANDLE DOWNLOAD BUTTON =====================
function handleDownload() {
  const chiHoiRaw = document.getElementById('chiHoi').value.trim().toUpperCase() || 'ChiHoi';
  const thang = document.getElementById('thang').value;
  const nam = document.getElementById('nam').value || '2026';
  const chiHoiSafe = chiHoiRaw
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '');
  const fileName = `CTH_DLXH_${chiHoiSafe}_T${thang}_${nam}.docx`;

  showConfirm({
    icon: '📄',
    title: 'Xác nhận tải file Word',
    message: `Bạn sẽ tải xuống file:<br><b>${fileName}</b>`,
    confirmText: '⬇ Tải xuống',
    confirmClass: 'modal-btn-confirm-blue',
    onConfirm: () => {
      const btn = document.querySelector('.btn-word');
      const originalText = btn.innerHTML;
      setButtonLoading(btn, true, originalText);
      createDoc(false)
        .then(() => showToast('Thành công', 'Đã lưu tại thư mục Download', 'success'))
        .catch(err => showToast('Lỗi', err.message || 'Không thể tải file', 'error'))
        .finally(() => setButtonLoading(btn, false, originalText));
    }
  });
}

// ===================== HANDLE SEND BUTTON =====================
function handleSend() {
  const btn = document.getElementById('sendBtn');
  if (btn.disabled) return;

  showConfirm({
    icon: '☁️',
    title: 'Xác nhận gửi báo cáo',
    message: 'Bạn có chắc muốn gửi báo cáo lên Google Drive của Hội LHPN phường?',
    confirmText: '✔ Gửi ngay',
    confirmClass: 'modal-btn-confirm-cyan',
    onConfirm: () => {
      const originalText = btn.innerHTML;
      setButtonLoading(btn, true, originalText);
      createDoc(true)
        .then(() => showToast('Gửi thành công', 'Báo cáo đã được gửi lên phường!', 'success'))
        .catch(err => showToast('Gửi thất bại', err.message || 'Không thể gửi báo cáo', 'error'))
        .finally(() => setButtonLoading(btn, false, originalText));
    }
  });
}

// ===================== UPLOAD FILE LÊN GOOGLE DRIVE =====================
function uploadFile(blob, fileName) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = function () {
      const base64 = reader.result.split(',')[1];

      // Gọi qua Cloudflare Pages Function (/api/proxy) thay vì dùng URL trực tiếp
      // (biến môi trường chỉ có ở server, không có trong trình duyệt)
      fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64, filename: fileName })
      })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          resolve();
        } else {
          reject(new Error(res.error || "Upload failed"));
        }
      })
      .catch(e => {
        reject(e);
      });
    };
  });
}

// ===================== TẠO FILE WORD =====================
async function createDoc(isUpload) {
  const phuong = document.getElementById('phuong').value.trim().toUpperCase() || "THANH KHÊ";
  const chiHoi = document.getElementById('chiHoi').value.trim().toUpperCase() || ".................";
  const thang = document.getElementById('thang').value;
  const nam = document.getElementById('nam').value || "2025";
  
  const thangText = `tháng ${thang} năm ${nam}`;
  const thangTiepTheo = parseInt(thang) === 12 ? 1 : parseInt(thang) + 1;
  const namTiepTheo = parseInt(thang) === 12 ? parseInt(nam) + 1 : parseInt(nam);

  // Phần I
  const tinhHinhTuTuong = document.getElementById('tinhHinhTuTuong').value.trim() || "..........................................................................................................................................";
  const duLuanQuanTam   = document.getElementById('duLuanQuanTam').value.trim()   || "..........................................................................................................................................";

  // Phần II
  const phongTraoPhuNu  = document.getElementById('phongTraoPhuNu').value.trim()  || "..........................................................................................................................................";
  const cuocVanDong     = document.getElementById('cuocVanDong').value.trim()     || "..........................................................................................................................................";
  const phongTraoKhac   = document.getElementById('phongTraoKhac').value.trim()   || "..........................................................................................................................................";
  const ungDungCNTT     = document.getElementById('ungDungCNTT').value.trim()     || "..........................................................................................................................................";
  const chuyenDoiSo     = document.getElementById('chuyenDoiSo').value.trim()     || "..........................................................................................................................................";
  const phongChongBLGD  = document.getElementById('phongChongBLGD').value.trim()  || "..........................................................................................................................................";
  const meDoDau         = document.getElementById('meDoDau').value.trim()         || "..........................................................................................................................................";
  const hoatDongAnSinh  = document.getElementById('hoatDongAnSinh').value.trim()  || "..........................................................................................................................................";
  const moHinhKhac      = document.getElementById('moHinhKhac').value.trim()      || "..........................................................................................................................................";
  const nhiemVuTrongTam = document.getElementById('nhiemVuTrongTam').value.trim() || "..........................................................................................................................................";
  const nhiemVuDiaPhuong = document.getElementById('nhiemVuDiaPhuong').value.trim() || "..........................................................................................................................................";

  // Phần IV & V
  const kienNghi        = document.getElementById('kienNghi').value.trim()        || "..........................................................................................................................................";
  const nhiemVuThangToi = document.getElementById('nhiemVuThangToi').value.trim() || "..........................................................................................................................................";

  const chiHoiTruong    = document.getElementById('chiHoiTruong').value.trim().toUpperCase() || ".................";

  const today = new Date();
  const ngayBaoCao = today.getDate();
  const thangHienTai = today.getMonth() + 1;
  const namHienTai = today.getFullYear();
  const dateStr = `${phuong}, ngày ${ngayBaoCao} tháng ${thangHienTai} năm ${namHienTai}`;

  // Helper tạo paragraph nội dung (nếu rỗng thì dùng dấu chấm)
  const contentPara = (text, extra = {}) => new Paragraph({
    children: [new TextRun({ text })],
    spacing: { after: 80 },
    ...extra
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 26 },
          paragraph: { spacing: { line: 360 } }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children: [
        // ===== HEADER =====
        new Paragraph({
          tabStops: [{ type: TabStopType.CENTER, position: 6500 }],
          children: [
            new TextRun({ text: "HỘI LHPN PHƯỜNG " + phuong, bold: true }),
            new TextRun({ text: "\t" }),
            new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true }),
          ],
        }),
        new Paragraph({
          tabStops: [{ type: TabStopType.CENTER, position: 6500 }],
          children: [
            new TextRun({ text: "CHI HỘI " + chiHoi, bold: true }),
            new TextRun({ text: "\t" }),
            new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", bold: true, underline: {} }),
          ],
        }),
        new Paragraph({
          tabStops: [{ type: TabStopType.CENTER, position: 6500 }],
          spacing: { after: 200 },
          children: [
            new TextRun({ text: "\t" }),
            new TextRun({ text: dateStr, italics: true }),
          ],
        }),

        // ===== TIÊU ĐỀ BÁO CÁO =====
        new Paragraph({
          children: [new TextRun({ text: "BÁO CÁO", bold: true, size: 32 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: "Kết quả công tác Hội và phong trào phụ nữ, tình hình dư luận xã hội", bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `${thangText}`, bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [new TextRun({ text: `Nhiệm vụ trọng tâm tháng ${thangTiepTheo}`, bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        }),

        // ===== PHẦN I =====
        new Paragraph({
          children: [new TextRun({ text: "I. TÌNH HÌNH TƯ TƯỞNG, ĐỜI SỐNG HỘI VIÊN, PHỤ NỮ", bold: true })],
          spacing: { before: 200, after: 100 }
        }),

        new Paragraph({
          children: [new TextRun({ text: "1. Tình hình tư tưởng cán bộ, hội viên và Nhân dân", bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(tinhHinhTuTuong, { spacing: { after: 150 } }),

        new Paragraph({
          children: [new TextRun({ text: "2. Những vấn đề được dư luận quan tâm", bold: true })],
          spacing: { after: 60 }
        }),
        new Paragraph({
          children: [new TextRun({ text: "- An sinh xã hội; VSMT; Trật tự đô thị; Không gian mạng…", bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(duLuanQuanTam, { spacing: { after: 200 } }),

        // ===== PHẦN II =====
        new Paragraph({
          children: [new TextRun({ text: "II. KẾT QUẢ CÔNG TÁC HỘI VÀ PHONG TRÀO PHỤ NỮ", bold: true })],
          spacing: { before: 200, after: 100 }
        }),

        new Paragraph({
          children: [new TextRun({ text: "1. Hoạt động nổi bật theo trọng tâm chỉ đạo", bold: true })],
          spacing: { after: 60 }
        }),
        new Paragraph({
          children: [new TextRun({ text: '- Phong trào "Xây dựng người phụ nữ Việt Nam thời đại mới"', bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(phongTraoPhuNu),
        new Paragraph({
          children: [new TextRun({ text: '- Cuộc vận động "Gia đình 5 không, 3 sạch, 3 an"', bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(cuocVanDong),
        new Paragraph({
          children: [new TextRun({ text: "- Các phong trào thi đua khác", bold: true })],
          spacing: { after: 40 }
        }),
        new Paragraph({
          children: [new TextRun({ text: "(Mỗi hội viên một cử chỉ đẹp; mỗi gia đình một địa chỉ hạnh phúc; mỗi chi hội một điểm đến thân thiện – hữu ích…)", italics: true })],
          spacing: { after: 60 }
        }),
        contentPara(phongTraoKhac),

        new Paragraph({
          children: [new TextRun({ text: "2. Thực hiện các khâu đột phá", bold: true })],
          spacing: { before: 100, after: 60 }
        }),
        new Paragraph({
          children: [new TextRun({ text: "- Ứng dụng công nghệ thông tin:", bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(ungDungCNTT),
        new Paragraph({
          children: [new TextRun({ text: "- Chuyển đổi số trong hoạt động Hội:", bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(chuyenDoiSo),
        new Paragraph({
          children: [new TextRun({ text: "- Phòng, chống bạo lực gia đình:", bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(phongChongBLGD),

        new Paragraph({
          children: [new TextRun({ text: "3. Chương trình, mô hình nổi bật", bold: true })],
          spacing: { before: 100, after: 60 }
        }),
        new Paragraph({
          children: [new TextRun({ text: "- Mẹ đỡ đầu:", bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(meDoDau),
        new Paragraph({
          children: [new TextRun({ text: "- Hoạt động an sinh (trao quà, hỗ trợ…):", bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(hoatDongAnSinh),
        new Paragraph({
          children: [new TextRun({ text: "- Mô hình/hoạt động khác:", bold: true })],
          spacing: { after: 60 }
        }),
        contentPara(moHinhKhac),

        new Paragraph({
          children: [new TextRun({ text: "4. Kết quả thực hiện nhiệm vụ trọng tâm", bold: true })],
          spacing: { before: 100, after: 60 }
        }),
        contentPara(nhiemVuTrongTam),

        new Paragraph({
          children: [new TextRun({ text: "5. Nhiệm vụ theo chỉ đạo địa phương", bold: true })],
          spacing: { before: 100, after: 60 }
        }),
        contentPara(nhiemVuDiaPhuong, { spacing: { after: 200 } }),

        // ===== PHẦN IV =====
        new Paragraph({
          children: [new TextRun({ text: "IV. ĐỀ XUẤT, KIẾN NGHỊ", bold: true })],
          spacing: { before: 200, after: 100 }
        }),
        contentPara(kienNghi, { spacing: { after: 200 } }),

        // ===== PHẦN V =====
        new Paragraph({
          children: [new TextRun({ text: `V. NHIỆM VỤ TRỌNG TÂM THÁNG ${thangTiepTheo}/${namTiepTheo}`, bold: true })],
          spacing: { before: 200, after: 100 }
        }),
        contentPara(nhiemVuThangToi, { spacing: { after: 400 } }),

        // ===== KÝ TÊN =====
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "CHI HỘI TRƯỞNG", bold: true })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: chiHoiTruong, bold: true })],
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const chiHoiSafe = chiHoi
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '');
  const fileName = `CTH_DLXH_${chiHoiSafe}_T${thang}_${nam}.docx`;

  if (isUpload) {
    await uploadFile(blob, fileName);
  } else {
    await downloadFile(blob, fileName);
  }
}

// ===================== TẢI FILE (HỖ TRỢ CẢ ANDROID VÀ TRÌNH DUYỆT) =====================
function downloadFile(blob, fileName) {
  return new Promise((resolve, reject) => {
    try {
      // --- Android WebView: dùng bridge Java (AndroidDownload) ---
      const isAndroidBridge = typeof AndroidDownload !== 'undefined';
      if (isAndroidBridge) {
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            const mimeType = blob.type || 'application/octet-stream';
            AndroidDownload.saveFile(e.target.result, fileName, mimeType);
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Không đọc được file'));
        reader.readAsDataURL(blob);
        return;
      }

      // --- Trình duyệt thường: dùng FileSaver hoặc thẻ <a> ---
      if (typeof saveAs !== 'undefined') {
        saveAs(blob, fileName);
        resolve();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        }, 2000);
      }
    } catch (e) {
      // --- Fallback cuối: mở data URL ---
      try {
        const reader = new FileReader();
        reader.onload = function(ev) {
          window.location.href = ev.target.result;
          resolve();
        };
        reader.onerror = () => reject(new Error('Không thể tải file'));
        reader.readAsDataURL(blob);
      } catch (err) {
        reject(err);
      }
    }
  });
}

// ===================== KIỂM TRA VÀ CẢNH BÁO THÁNG/NĂM =====================
function setupDateTimeValidation() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  const thangSelect = document.getElementById('thang');
  const namInput = document.getElementById('nam');
  
  let currentMonthValue = currentMonth;
  let currentYearValue = currentYear;
  
  thangSelect.addEventListener('change', function(e) {
    const newMonth = parseInt(this.value);
    
    if (newMonth !== currentMonthValue || parseInt(namInput.value) !== currentYearValue) {
      const newYear = parseInt(namInput.value);
      
      showConfirm({
        icon: '⚠️',
        title: 'Xác nhận thời gian báo cáo',
        message: `Bạn đang chọn báo cáo cho <b>tháng ${newMonth}/${newYear}</b><br>Khác với thời gian hiện tại.<br>Bạn có chắc chắn muốn thay đổi?`,
        confirmText: 'Vẫn thay đổi',
        confirmClass: 'modal-btn-confirm-blue',
        onConfirm: () => {
          currentMonthValue = newMonth;
          currentYearValue = newYear;
          updateDateBadge(newMonth, newYear);
          showToast('Thông báo', `Đã thay đổi sang tháng ${newMonth}/${newYear}`, 'info', 2000);
        },
        onCancel: () => {
          thangSelect.value = currentMonthValue;
          namInput.value = currentYearValue;
          showToast('Thông báo', 'Đã khôi phục thời gian hiện tại', 'info', 2000);
        }
      });
    }
  });
  
  namInput.addEventListener('change', function(e) {
    const newYear = parseInt(this.value);
    
    if (newYear < 2000 || newYear > 2030) {
      showToast('Cảnh báo', 'Năm không hợp lệ! Vui lòng nhập năm từ 2000-2030', 'warning');
      this.value = currentYearValue;
      return;
    }
    
    if (newYear !== currentYearValue || parseInt(thangSelect.value) !== currentMonthValue) {
      const newMonth = parseInt(thangSelect.value);
      
      showConfirm({
        icon: '⚠️',
        title: 'Xác nhận thời gian báo cáo',
        message: `Bạn đang chọn báo cáo cho <b>tháng ${newMonth}/${newYear}</b><br>Khác với thời gian hiện tại.<br>Bạn có chắc chắn muốn thay đổi?`,
        confirmText: 'Vẫn thay đổi',
        confirmClass: 'modal-btn-confirm-blue',
        onConfirm: () => {
          currentMonthValue = newMonth;
          currentYearValue = newYear;
          updateDateBadge(newMonth, newYear);
          showToast('Thông báo', `Đã thay đổi sang tháng ${newMonth}/${newYear}`, 'info', 2000);
        },
        onCancel: () => {
          thangSelect.value = currentMonthValue;
          namInput.value = currentYearValue;
          showToast('Thông báo', 'Đã khôi phục thời gian hiện tại', 'info', 2000);
        }
      });
    }
  });
}

// ===================== TỰ ĐỘNG VIẾT HOA TÊN NGƯỜI KÝ =====================
function setupAutoUppercase() {
  const chiHoiTruongInput = document.getElementById('chiHoiTruong');
  if (chiHoiTruongInput) {
    chiHoiTruongInput.addEventListener('input', function() {
      const start = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.toUpperCase();
      this.setSelectionRange(start, end);
    });
  }
}

// ===================== THIẾT LẬP THÁNG/NĂM MẶC ĐỊNH =====================
// ===================== THIẾT LẬP THÁNG/NĂM MẶC ĐỊNH =====================
function setDefaultDateTime() {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  let defaultMonth = currentMonth;
  let defaultYear = currentYear;
  
  // Nếu ngày hiện tại <= 20 thì lấy tháng trước
  if (currentDay <= 20) {
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }
    
    defaultMonth = prevMonth;
    defaultYear = prevYear;
  }
  // Nếu ngày >= 21 thì lấy tháng hiện tại (giữ nguyên)
  
  const thangSelect = document.getElementById('thang');
  const namInput = document.getElementById('nam');
  
  if (thangSelect) thangSelect.value = defaultMonth.toString();
  if (namInput) namInput.value = defaultYear;
  
  updateDateBadge(defaultMonth, defaultYear);
}

function updateDateBadge(thang, nam) {
  const el1 = document.getElementById('badgeThang');
  const el2 = document.getElementById('badgeNam');
  if (el1) el1.textContent = thang;
  if (el2) el2.textContent = nam;
}

function toggleDatePanel() {
  const panel = document.getElementById('datePanel');
  const btn = document.getElementById('btnAdjust');
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? '✖ Đóng' : '✏️ Bổ sung / Điều chỉnh';
}

// ===================== LOAD DANH SÁCH CHI HỘI =====================
window.addEventListener("DOMContentLoaded", () => {
  setDefaultDateTime();
  setupDateTimeValidation();
  setupAutoUppercase();

  const list = document.getElementById("chiHoiList");

  function renderList(filter = "") {
    list.innerHTML = "";
    let count = 0;
    if (typeof DS_CHI_HOI_GS !== 'undefined' && Array.isArray(DS_CHI_HOI_GS)) {
      DS_CHI_HOI_GS.forEach(name => {
        if (!filter || name.includes(filter.toUpperCase())) {
          const li = document.createElement("li");
          li.textContent = name;
          li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectChiHoi(name);
          });
          list.appendChild(li);
          count++;
        }
      });
    }
    document.getElementById("chiHoiNoResult").style.display = count === 0 ? "block" : "none";
  }

  renderList();

  document.getElementById("chiHoiSearch").addEventListener("input", function () {
    renderList(this.value);
  });

  document.addEventListener("click", function (e) {
    if (!document.getElementById("chiHoiWrapper").contains(e.target)) {
      closeChiHoiDropdown();
    }
  });
});

function toggleChiHoiDropdown() {
  const dropdown = document.getElementById("chiHoiDropdown");
  const display = document.getElementById("chiHoiDisplay");
  const isOpen = dropdown.style.display !== "none";
  if (isOpen) {
    closeChiHoiDropdown();
  } else {
    dropdown.style.display = "block";
    display.classList.add("open");
    setTimeout(() => document.getElementById("chiHoiSearch").focus(), 50);
  }
}

function closeChiHoiDropdown() {
  document.getElementById("chiHoiDropdown").style.display = "none";
  document.getElementById("chiHoiDisplay").classList.remove("open");
  document.getElementById("chiHoiSearch").value = "";
  const list = document.getElementById("chiHoiList");
  list.innerHTML = "";
  if (typeof DS_CHI_HOI_GS !== 'undefined') {
    DS_CHI_HOI_GS.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); selectChiHoi(name); });
      list.appendChild(li);
    });
  }
  document.getElementById("chiHoiNoResult").style.display = "none";
}

function selectChiHoi(name) {
  document.getElementById("chiHoi").value = name;
  const textEl = document.getElementById("chiHoiText");
  textEl.textContent = name;
  textEl.classList.remove("placeholder");
  document.getElementById("chiHoiDisplay").classList.add("selected");
  closeChiHoiDropdown();
}
