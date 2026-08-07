/**
 * Sổ Chi Tiêu Ngăn ❤️ & Tòn 🐷
 * Tech Stack: Pure HTML5, jQuery 3.7, Tailwind CSS
 * Compatible with AI Studio, RestDB.io, and GitHub Pages Deployment
 */

$(document).ready(function () {
  // --- RESTDB & STORAGE CONFIGURATION ---
  const RESTDB_URL = 'https://dtoan-e791.restdb.io/rest/expenses';
  const RESTDB_API_KEY = '6a74c1d37eee3e669ebc395c';
  const LOCAL_STORAGE_KEY = 'so_chi_tieu_ngan_ton_data';

  // App State
  let rawDocs = [];
  let expensesList = [];
  let selectedSpender = 'Ngăn ❤️❤️❤️';
  let selectedMonthFilter = 'CURRENT';
  let searchQuery = '';
  let sortField = 'created_at';
  let sortAsc = false;
  let currentPage = 1;
  let pageSize = 15;
  let editingRowId = null;
  let activeFocusRowId = null;

  // --- INITIALIZATION ---
  initApp();

  function initApp() {
    // Set default date to today YYYY-MM-DD
    $('#input-date').val(getTodayYYYYMMDD());

    // Render initial empty row in form
    addFormRow();

    // Attach Event Listeners
    bindEvents();

    // Fetch Initial Expenses
    loadExpenses();
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(text, type = 'info') {
    const id = 'toast-' + Math.random().toString(36).substring(2, 9);
    let bgClasses = 'bg-blue-50 text-blue-900 border-blue-200';
    let icon = 'fa-info-circle text-blue-600';

    if (type === 'success') {
      bgClasses = 'bg-emerald-50 text-emerald-900 border-emerald-200';
      icon = 'fa-circle-check text-emerald-600';
    } else if (type === 'error') {
      bgClasses = 'bg-rose-50 text-rose-900 border-rose-200';
      icon = 'fa-circle-exclamation text-rose-600';
    }

    const toastHtml = `
      <div id="${id}" class="pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border text-sm font-semibold transition-all transform animate-slide-in ${bgClasses}">
        <div class="flex items-center gap-2.5">
          <i class="fa-solid ${icon}"></i>
          <span>${escapeHtml(text)}</span>
        </div>
        <button type="button" class="btn-close-toast p-1 text-slate-400 hover:text-slate-600 rounded-lg ml-3">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    $('#toast-container').append(toastHtml);

    setTimeout(() => {
      $(`#${id}`).fadeOut(300, function () {
        $(this).remove();
      });
    }, 3800);
  }

  $(document).on('click', '.btn-close-toast', function () {
    $(this).closest('[id^="toast-"]').remove();
  });

  // --- HELPER FUNCTIONS ---
  function getTodayYYYYMMDD() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateDDMMYYYY(dateStr) {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  function formatYYYYMMDD(dateStr) {
    if (!dateStr) return getTodayYYYYMMDD();
    if (dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return getTodayYYYYMMDD();
  }

  function parseAmountInK(val) {
    let num = parseFloat(val) || 0;
    if (num > 0 && num < 1000) {
      return num * 1000;
    }
    return num;
  }

  function formatCurrency(num) {
    return new Intl.NumberFormat('vi-VN').format(num || 0) + ' ₫';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function extractMonthYear(dateStr) {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    }
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[1]}/${parts[0]}`;
    }
    return '';
  }

  function getCurrentMonthYearStr() {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  // --- LOCAL STORAGE DATA HELPERS ---
  function getLocalExpenses() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function saveLocalExpenses(data) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }

  function formatSpenderName(uStr) {
    if (!uStr) return 'Ngăn ❤️❤️❤️';
    const str = String(uStr).toLowerCase();
    if (str.includes('tòn') || str.includes('ton')) {
      return 'Tòn 🐷🐷🐷';
    }
    return 'Ngăn ❤️❤️❤️';
  }

  function normalizeExpensesData(rawList) {
    if (!Array.isArray(rawList)) return [];

    const flattened = [];

    rawList.forEach((doc, docIdx) => {
      if (!doc) return;

      const docId = doc._id || `loc-${Date.now()}-${docIdx}`;
      const docDate = formatDateDDMMYYYY(doc.date || getTodayYYYYMMDD());
      const docUser = doc.user || doc.spender || 'ngân';
      const spenderDisplay = formatSpenderName(docUser);

      if (Array.isArray(doc.used) && doc.used.length > 0) {
        doc.used.forEach((item, itemIdx) => {
          if (!item) return;
          const itemName = item.name || item.expense || 'Chi tiêu';
          const priceRaw = item.price || item.amount || 0;
          const amtVal = parseAmountInK(priceRaw);

          flattened.push({
            _id: `${docId}_${itemIdx}`,
            doc_id: docId,
            item_index: itemIdx,
            date: docDate,
            user: docUser,
            spender: spenderDisplay,
            expense: itemName,
            amount: amtVal,
            price: priceRaw,
            created_at: doc.created_at || new Date().toISOString(),
            raw_doc: doc,
          });
        });
      } else {
        const itemName = doc.expense || doc.name || 'Chi tiêu';
        const priceRaw = doc.price || doc.amount || 0;
        const amtVal = parseAmountInK(priceRaw);

        flattened.push({
          _id: docId,
          doc_id: docId,
          item_index: 0,
          date: docDate,
          user: docUser,
          spender: spenderDisplay,
          expense: itemName,
          amount: amtVal,
          price: priceRaw,
          created_at: doc.created_at || new Date().toISOString(),
          raw_doc: doc,
        });
      }
    });

    return flattened;
  }

  // --- DATA FETCHING (SERVER API -> RESTDB -> LOCALSTORAGE FALLBACK) ---
  function loadExpenses() {
    $('#btn-reload-data i').addClass('fa-spin');

    // 1. First try Express proxy API /api/expenses
    $.ajax({
      url: '/api/expenses',
      method: 'GET',
      timeout: 5000,
      success: function (res) {
        $('#btn-reload-data i').removeClass('fa-spin');
        if (res && res.success && Array.isArray(res.items)) {
          const localDocs = getLocalExpenses();
          const serverIds = new Set(res.items.map((i) => i._id));
          const uniqueLocal = localDocs.filter((l) => l._id && !serverIds.has(l._id));
          rawDocs = [...res.items, ...uniqueLocal];

          saveLocalExpenses(rawDocs);
          expensesList = normalizeExpensesData(rawDocs);
          updateRestDbStatus(true, 'Đã kết nối Hệ thống');
          renderAll();
          showToast(`Đã nạp thành công ${expensesList.length} khoản chi tiêu!`, 'success');
        } else {
          fallbackToDirectRestDbOrLocal();
        }
      },
      error: function () {
        // Express endpoint failed or static environment (GitHub Pages)
        fallbackToDirectRestDbOrLocal();
      },
    });
  }

  function fallbackToDirectRestDbOrLocal() {
    // 2. Direct AJAX to RestDB.io with x-apikey
    $.ajax({
      url: RESTDB_URL,
      method: 'GET',
      headers: {
        'x-apikey': RESTDB_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
      success: function (data) {
        $('#btn-reload-data i').removeClass('fa-spin');
        if (Array.isArray(data)) {
          const localDocs = getLocalExpenses();
          const serverIds = new Set(data.map((i) => i._id));
          const uniqueLocal = localDocs.filter((l) => l._id && !serverIds.has(l._id));
          rawDocs = [...data, ...uniqueLocal];

          saveLocalExpenses(rawDocs);
          expensesList = normalizeExpensesData(rawDocs);
          updateRestDbStatus(true, 'Đã kết nối Trực tuyến');
          renderAll();
          showToast(`Đã tải ${expensesList.length} khoản chi tiêu!`, 'success');
        } else {
          fallbackToLocalStorageOnly();
        }
      },
      error: function () {
        fallbackToLocalStorageOnly();
      },
    });
  }

  function fallbackToLocalStorageOnly() {
    $('#btn-reload-data i').removeClass('fa-spin');
    rawDocs = getLocalExpenses();
    expensesList = normalizeExpensesData(rawDocs);
    updateRestDbStatus(false, 'Bộ nhớ Máy');
    renderAll();
    showToast(`Sử dụng dữ liệu lưu sẵn (${expensesList.length} khoản chi)`, 'info');
  }

  function updateRestDbStatus(isConnected, label) {
    const $badge = $('#restdb-status-badge');
    const $text = $('#restdb-status-text');

    if (isConnected) {
      $badge
        .removeClass('bg-amber-50 border-amber-200 text-amber-800')
        .addClass('bg-emerald-50 border-emerald-200 text-emerald-800');
      $badge.find('span.rounded-full').removeClass('bg-amber-500').addClass('bg-emerald-500');
      $text.text(label || 'Đã kết nối Hệ thống');
    } else {
      $badge
        .removeClass('bg-emerald-50 border-emerald-200 text-emerald-800')
        .addClass('bg-amber-50 border-amber-200 text-amber-800');
      $badge.find('span.rounded-full').removeClass('bg-emerald-500').addClass('bg-amber-500');
      $text.text(label || 'Bộ nhớ Trình duyệt');
    }
  }

  // --- MULTI-ROW FORM LOGIC ---
  function addFormRow(expenseVal = '', amountVal = '') {
    const rowId = 'row-' + Math.random().toString(36).substring(2, 9);
    const rowCount = $('#expense-rows-body tr').length + 1;

    let displayAmt = '';
    if (amountVal !== '' && amountVal !== null && amountVal !== undefined) {
      const num = parseFloat(amountVal) || 0;
      displayAmt = num >= 1000 ? num / 1000 : num;
      if (displayAmt === 0) displayAmt = '';
    }

    const rowHtml = `
      <tr id="${rowId}" class="entry-row hover:bg-slate-50 transition-colors">
        <td class="row-stt py-2 px-3 text-center text-xs font-bold text-slate-400 select-none">${rowCount}</td>
        <td class="py-2 px-2">
          <input type="text" class="input-row-expense w-full px-3 py-1.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Ví dụ: Đi chợ, Ăn trưa, Cà phê, Xăng xe..." value="${escapeHtml(expenseVal)}" />
        </td>
        <td class="py-2 px-2">
          <div class="relative flex items-center">
            <input type="number" step="any" min="0" class="input-row-amount w-full px-3 py-1.5 text-sm font-bold text-emerald-700 text-right bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-16" placeholder="Ví dụ: 100 (=100k)" value="${displayAmt}" />
            <span class="preview-formatted-amt absolute right-2 text-xs font-semibold text-slate-400 pointer-events-none">
              ${displayAmt ? formatCurrency(parseAmountInK(displayAmt)) : 'k ₫'}
            </span>
          </div>
        </td>
        <td class="py-2 px-2 text-center">
          <button type="button" class="btn-delete-row p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Xoá dòng này">
            <i class="fa-solid fa-trash-can text-rose-500"></i>
          </button>
        </td>
      </tr>
    `;

    $('#expense-rows-body').append(rowHtml);
    updateRowIndices();
    calculateBatchTotal();
  }

  function updateRowIndices() {
    $('#expense-rows-body tr').each(function (idx) {
      $(this).find('.row-stt').text(idx + 1);
    });
  }

  function calculateBatchTotal() {
    let total = 0;
    $('#expense-rows-body tr').each(function () {
      const amtStr = $(this).find('.input-row-amount').val();
      const amt = parseAmountInK(amtStr);
      total += amt;

      // Update row live preview label
      const $preview = $(this).find('.preview-formatted-amt');
      if (amtStr && parseFloat(amtStr) > 0) {
        $preview.html(`<span class="text-emerald-600 font-bold">${formatCurrency(amt)}</span>`);
      } else {
        $preview.text('k ₫');
      }
    });
    $('#batch-total-display').text(formatCurrency(total));
    return total;
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    // Reload button
    $('#btn-reload-data').on('click', function () {
      loadExpenses();
    });

    // Spender toggle
    $('.btn-spender-option').on('click', function () {
      $('.btn-spender-option')
        .removeClass('bg-pink-50 border-pink-500 text-pink-700 bg-amber-50 border-amber-500 text-amber-900 shadow-xs')
        .addClass('bg-white border-slate-200 text-slate-600 hover:bg-slate-50');

      selectedSpender = $(this).data('spender');

      if (selectedSpender.includes('Ngăn')) {
        $(this).addClass('bg-pink-50 border-pink-500 text-pink-700 shadow-xs');
      } else {
        $(this).addClass('bg-amber-50 border-amber-500 text-amber-900 shadow-xs');
      }
    });

    // Add row button
    $('#btn-add-row').on('click', function () {
      addFormRow();
    });

    // Delete row button
    $(document).on('click', '.btn-delete-row', function () {
      if ($('#expense-rows-body tr').length > 1) {
        $(this).closest('tr').remove();
        updateRowIndices();
        calculateBatchTotal();
      } else {
        // If only 1 row, clear its values
        const $row = $(this).closest('tr');
        $row.find('input').val('');
        calculateBatchTotal();
      }
    });

    // Auto append new row when typing in the last row
    $(document).on('input', '.input-row-expense, .input-row-amount', function () {
      activeFocusRowId = $(this).closest('tr').attr('id');
      calculateBatchTotal();

      const $lastRow = $('#expense-rows-body tr:last-child');
      const expVal = $.trim($lastRow.find('.input-row-expense').val());
      const amtVal = $.trim($lastRow.find('.input-row-amount').val());

      if (expVal !== '' || amtVal !== '') {
        addFormRow();
      }
    });

    // Quick presets
    $('.btn-preset-amount').on('click', function () {
      const addK = parseFloat($(this).data('val')) || 0;
      let $targetRow = activeFocusRowId ? $(`#${activeFocusRowId}`) : $('#expense-rows-body tr:last-child');

      if (!$targetRow.length) {
        $targetRow = $('#expense-rows-body tr:first-child');
      }

      const $amtInput = $targetRow.find('.input-row-amount');
      const currentVal = parseFloat($amtInput.val()) || 0;
      const nextVal = currentVal + addK;
      $amtInput.val(nextVal).trigger('input');
    });

    // Reset Form
    $('#btn-reset-form').on('click', function () {
      $('#expense-rows-body').empty();
      addFormRow();
      $('#input-date').val(getTodayYYYYMMDD());
      $('#btn-spender-ngan').trigger('click');
      showToast('Đã làm mới form nhập', 'info');
    });

    // Submit Expenses
    $('#btn-submit-expenses').on('click', function () {
      submitExpensesForm();
    });

    // Month filter change
    $('#select-month-filter').on('change', function () {
      selectedMonthFilter = $(this).val();
      currentPage = 1;
      renderAll();
    });

    // Search input
    $('#search-input').on('input', function () {
      searchQuery = $.trim($(this).val());
      currentPage = 1;
      if (searchQuery !== '') {
        $('#btn-clear-search').removeClass('hidden');
      } else {
        $('#btn-clear-search').addClass('hidden');
      }
      renderTable();
    });

    $('#btn-clear-search').on('click', function () {
      $('#search-input').val('');
      searchQuery = '';
      $(this).addClass('hidden');
      currentPage = 1;
      renderTable();
    });

    // Sort headers
    $(document).on('click', '.th-sortable', function () {
      const field = $(this).data('sort');
      if (sortField === field) {
        sortAsc = !sortAsc;
      } else {
        sortField = field;
        sortAsc = true;
      }
      renderTable();
    });

    // Page size & Pagination
    $('#select-page-size').on('change', function () {
      pageSize = parseInt($(this).val()) || 15;
      currentPage = 1;
      renderTable();
    });

    $('#btn-prev-page').on('click', function () {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });

    $('#btn-next-page').on('click', function () {
      const maxPages = Math.ceil(getFilteredItems().length / pageSize) || 1;
      if (currentPage < maxPages) {
        currentPage++;
        renderTable();
      }
    });

    // Inline Table Actions (Edit & Delete)
    $(document).on('click', '.btn-inline-edit', function () {
      const id = $(this).data('id');
      editingRowId = id;
      renderTable();
    });

    $(document).on('click', '.btn-inline-cancel', function () {
      editingRowId = null;
      renderTable();
    });

    $(document).on('click', '.btn-inline-save', function () {
      const id = $(this).data('id');
      saveInlineEdit(id);
    });

    $(document).on('click', '.btn-inline-delete', function () {
      const id = $(this).data('id');
      deleteExpenseItem(id);
    });
  }

  // --- SUBMIT FORM ---
  function submitExpensesForm() {
    const rawDate = $('#input-date').val() || getTodayYYYYMMDD();
    const formattedDate = formatDateDDMMYYYY(rawDate);
    const userLabel = selectedSpender.includes('Ngăn') ? 'ngân' : 'tòn';

    const usedItems = [];
    let sumDateVal = 0;
    let hasInvalidRow = false;

    $('#expense-rows-body tr').each(function () {
      const expName = $.trim($(this).find('.input-row-expense').val());
      const amtStr = $(this).find('.input-row-amount').val();
      const rawAmt = parseFloat(amtStr) || 0;

      if (expName || rawAmt > 0) {
        if (!expName) {
          hasInvalidRow = true;
          $(this).find('.input-row-expense').focus();
          return false;
        }
        if (rawAmt <= 0) {
          hasInvalidRow = true;
          $(this).find('.input-row-amount').focus();
          return false;
        }

        const priceNum = rawAmt < 1000 ? rawAmt : rawAmt / 1000;
        sumDateVal += priceNum;

        usedItems.push({
          name: expName,
          price: String(priceNum),
        });
      }
    });

    if (hasInvalidRow) {
      showToast('Vui lòng kiểm tra lại: Tên chi phí không được để trống và số tiền phải > 0!', 'error');
      return;
    }

    if (usedItems.length === 0) {
      showToast('Vui lòng nhập ít nhất 1 khoản chi phí!', 'error');
      return;
    }

    // MATCH EXACT USER REQUESTED SCHEMA
    const payloadSchema = {
      date: formattedDate,
      user: userLabel,
      used: usedItems,
      sumdate: sumDateVal,
    };

    const totalAmountInVnd = sumDateVal * 1000;

    const $btn = $('#btn-submit-expenses');
    $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...');

    $.ajax({
      url: '/api/expenses',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payloadSchema),
      timeout: 6000,
      success: function (res) {
        $btn.prop('disabled', false).html('<i class="fa-solid fa-paper-plane"></i> Lưu Chi Tiêu');
        if (res && res.success) {
          showToast(`Đã lưu thành công ${usedItems.length} khoản chi (${formatCurrency(totalAmountInVnd)})!`, 'success');
          $('#btn-reset-form').trigger('click');
          loadExpenses();
        } else {
          saveToDirectRestDbOrLocal(payloadSchema, totalAmountInVnd);
        }
      },
      error: function () {
        saveToDirectRestDbOrLocal(payloadSchema, totalAmountInVnd);
      },
    });
  }

  function saveToDirectRestDbOrLocal(payloadSchema, totalAmountInVnd) {
    const $btn = $('#btn-submit-expenses');

    $.ajax({
      url: RESTDB_URL,
      method: 'POST',
      headers: {
        'x-apikey': RESTDB_API_KEY,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(payloadSchema),
      timeout: 6000,
      success: function (data) {
        $btn.prop('disabled', false).html('<i class="fa-solid fa-paper-plane"></i> Lưu Chi Tiêu');
        showToast(`Đã lưu thành công chi tiêu!`, 'success');
        $('#btn-reset-form').trigger('click');
        loadExpenses();
      },
      error: function () {
        $btn.prop('disabled', false).html('<i class="fa-solid fa-paper-plane"></i> Lưu Chi Tiêu');

        const createdDoc = {
          ...payloadSchema,
          _id: 'loc-' + Date.now(),
        };

        rawDocs.unshift(createdDoc);
        saveLocalExpenses(rawDocs);
        expensesList = normalizeExpensesData(rawDocs);

        showToast(`Đã lưu (${formatCurrency(totalAmountInVnd)}) vào bộ nhớ máy!`, 'success');
        $('#btn-reset-form').trigger('click');
        renderAll();
      },
    });
  }

  // --- FILTER & SORT COMPUTATION ---
  function getFilteredItems() {
    const currentMY = getCurrentMonthYearStr();
    const activeMY = selectedMonthFilter === 'CURRENT' ? currentMY : selectedMonthFilter;

    return expensesList.filter((item) => {
      const my = extractMonthYear(item.date);
      if (activeMY !== 'ALL' && my !== activeMY) {
        return false;
      }

      if (searchQuery !== '') {
        const query = searchQuery.toLowerCase();
        const expMatch = String(item.expense || '').toLowerCase().includes(query);
        const spenderMatch = String(item.spender || '').toLowerCase().includes(query);
        const dateMatch = String(item.date || '').toLowerCase().includes(query);
        const amtMatch = String(item.amount || '').includes(query);
        return expMatch || spenderMatch || dateMatch || amtMatch;
      }

      return true;
    });
  }

  function getSortedItems() {
    const filtered = getFilteredItems();

    return filtered.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'amount') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  // --- RENDER FUNCTIONS ---
  function renderAll() {
    renderMonthDropdown();
    renderKPIs();
    renderTable();
  }

  function renderMonthDropdown() {
    const currentMY = getCurrentMonthYearStr();
    const set = new Set();
    set.add(currentMY);

    expensesList.forEach((item) => {
      const my = extractMonthYear(item.date);
      if (my) set.add(my);
    });

    const months = Array.from(set).sort().reverse();
    const $select = $('#select-month-filter');
    $select.empty();

    $select.append(`<option value="CURRENT">Tháng này (${currentMY})</option>`);
    $select.append(`<option value="ALL">Tất cả các tháng</option>`);

    months.forEach((m) => {
      if (m !== currentMY) {
        $select.append(`<option value="${m}">Tháng ${m}</option>`);
      }
    });

    $select.val(selectedMonthFilter);
  }

  function renderKPIs() {
    const currentMY = getCurrentMonthYearStr();
    const activeMY = selectedMonthFilter === 'CURRENT' ? currentMY : selectedMonthFilter;

    let monthTotal = 0;
    let nganTotal = 0;
    let tonTotal = 0;
    let monthCount = 0;
    let todayTotal = 0;

    const todayFormatted = formatDateDDMMYYYY(getTodayYYYYMMDD());

    expensesList.forEach((item) => {
      const my = extractMonthYear(item.date);
      const amt = Number(item.amount) || 0;
      const formattedItemDate = formatDateDDMMYYYY(item.date);

      if (activeMY === 'ALL' || my === activeMY) {
        monthTotal += amt;
        monthCount++;

        const spender = String(item.spender || '');
        if (spender.includes('Ngăn')) {
          nganTotal += amt;
        } else if (spender.includes('Tòn')) {
          tonTotal += amt;
        } else {
          nganTotal += amt;
        }
      }

      if (formattedItemDate === todayFormatted) {
        todayTotal += amt;
      }
    });

    const nganPercent = monthTotal > 0 ? Math.round((nganTotal / monthTotal) * 100) : 0;
    const tonPercent = monthTotal > 0 ? Math.round((tonTotal / monthTotal) * 100) : 0;

    $('#kpi-month-label').text(activeMY === 'ALL' ? 'Tất cả' : `Tháng ${activeMY}`);
    $('#kpi-month-total').text(formatCurrency(monthTotal));
    $('#kpi-ngan-total').text(formatCurrency(nganTotal));
    $('#kpi-ngan-percent').text(`${nganPercent}% tổng chi tháng`);
    $('#kpi-ton-total').text(formatCurrency(tonTotal));
    $('#kpi-ton-percent').text(`${tonPercent}% tổng chi tháng`);
    $('#kpi-month-count').text(`${monthCount} khoản`);
    $('#kpi-today-total').text(`Chi hôm nay: ${formatCurrency(todayTotal)}`);
  }

  function renderTable() {
    const sorted = getSortedItems();
    const totalCount = sorted.length;

    $('#table-count-badge').text(`${totalCount} dòng`);

    // Pagination slice
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const paginated = sorted.slice(startIdx, startIdx + pageSize);

    const $tbody = $('#expenses-tbody');
    $tbody.empty();

    if (paginated.length === 0) {
      $tbody.html(`
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-400 text-xs font-medium">
            Chưa có dữ liệu chi tiêu nào phù hợp
          </td>
        </tr>
      `);
      $('#expenses-tfoot').addClass('hidden');
    } else {
      paginated.forEach((item) => {
        const isEditing = editingRowId === item._id;

        if (isEditing) {
          const rowHtml = `
            <tr class="bg-emerald-50/70 border-b border-emerald-200">
              <td class="py-2 px-2">
                <input type="date" id="edit-date-${item._id}" value="${formatYYYYMMDD(item.date)}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-medium" />
              </td>
              <td class="py-2 px-2">
                <select id="edit-spender-${item._id}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-bold">
                  <option value="Ngăn ❤️❤️❤️" ${item.spender.includes('Ngăn') ? 'selected' : ''}>Ngăn ❤️❤️❤️</option>
                  <option value="Tòn 🐷🐷🐷" ${item.spender.includes('Tòn') ? 'selected' : ''}>Tòn 🐷🐷🐷</option>
                </select>
              </td>
              <td class="py-2 px-2">
                <input type="text" id="edit-expense-${item._id}" value="${escapeHtml(item.expense)}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-medium" />
              </td>
              <td class="py-2 px-2">
                <input type="number" step="any" id="edit-amount-${item._id}" value="${item.amount || 0}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-right font-bold text-emerald-700" />
              </td>
              <td class="py-2 px-2 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button type="button" data-id="${item._id}" class="btn-inline-save p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors cursor-pointer" title="Lưu">
                    <i class="fa-solid fa-floppy-disk"></i>
                  </button>
                  <button type="button" class="btn-inline-cancel p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors cursor-pointer" title="Hủy">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
          $tbody.append(rowHtml);
        } else {
          const isNgan = String(item.spender || '').includes('Ngăn');
          const rowHtml = `
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="py-2.5 px-3 font-medium text-slate-600 text-xs">
                <i class="fa-regular fa-calendar text-slate-400 mr-1"></i>
                <span>${escapeHtml(item.date)}</span>
              </td>
              <td class="py-2.5 px-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isNgan ? 'bg-pink-100 text-pink-800 border-pink-200' : 'bg-amber-100 text-amber-900 border-amber-200'
                }">
                  ${escapeHtml(item.spender || 'Ngăn ❤️❤️❤️')}
                </span>
              </td>
              <td class="py-2.5 px-3 font-semibold text-slate-800">
                ${escapeHtml(item.expense)}
              </td>
              <td class="py-2.5 px-3 text-right font-bold text-emerald-700 text-sm">
                ${formatCurrency(item.amount || 0)}
              </td>
              <td class="py-2.5 px-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button type="button" data-id="${item._id}" class="btn-inline-edit p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" title="Sửa">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button type="button" data-id="${item._id}" class="btn-inline-delete p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Xoá">
                    <i class="fa-solid fa-trash-can text-rose-500"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
          $tbody.append(rowHtml);
        }
      });

      // Render Tfoot Total
      const totalListAmount = sorted.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      $('#tfoot-total-amount').text(formatCurrency(totalListAmount));
      $('#expenses-tfoot').removeClass('hidden');
    }

    // Pagination info
    $('#pagination-page-info').text(`Trang ${currentPage} / ${totalPages}`);
    $('#btn-prev-page').prop('disabled', currentPage <= 1);
    $('#btn-next-page').prop('disabled', currentPage >= totalPages);
  }

  // --- INLINE EDIT & DELETE ---
  function saveInlineEdit(id) {
    const dateVal = $(`#edit-date-${id}`).val();
    const spenderVal = $(`#edit-spender-${id}`).val();
    const expenseVal = $.trim($(`#edit-expense-${id}`).val());
    const rawAmt = parseFloat($(`#edit-amount-${id}`).val()) || 0;
    const amtVal = parseAmountInK(rawAmt);

    if (!expenseVal) {
      showToast('Tên chi phí không được để trống!', 'error');
      return;
    }

    const updateData = {
      date: formatDateDDMMYYYY(dateVal),
      spender: spenderVal,
      expense: expenseVal,
      amount: amtVal,
    };

    // Attempt Express PUT
    $.ajax({
      url: `/api/expenses/${id}`,
      method: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(updateData),
      timeout: 5000,
      success: function (res) {
        editingRowId = null;
        showToast('Đã cập nhật chi tiêu!', 'success');
        loadExpenses();
      },
      error: function () {
        // Fallback direct RestDB or local
        $.ajax({
          url: `${RESTDB_URL}/${id}`,
          method: 'PUT',
          headers: {
            'x-apikey': RESTDB_API_KEY,
            'Content-Type': 'application/json',
          },
          data: JSON.stringify(updateData),
          timeout: 5000,
          success: function () {
            editingRowId = null;
            showToast('Đã cập nhật chi tiêu trên RestDB!', 'success');
            loadExpenses();
          },
          error: function () {
            // Local update
            expensesList = expensesList.map((item) => (item._id === id ? { ...item, ...updateData } : item));
            saveLocalExpenses(expensesList);
            editingRowId = null;
            showToast('Đã cập nhật chi tiêu trong bộ nhớ!', 'success');
            renderAll();
          },
        });
      },
    });
  }

  function deleteExpenseItem(id) {
    if (!window.confirm('Bạn có chắc chắn muốn xoá khoản chi tiêu này không?')) return;

    const targetItem = expensesList.find((i) => i._id === id);
    const targetDocId = targetItem ? targetItem.doc_id : id;

    $.ajax({
      url: `/api/expenses/${targetDocId}`,
      method: 'DELETE',
      timeout: 5000,
      success: function () {
        showToast('Đã xoá khoản chi tiêu!', 'success');
        loadExpenses();
      },
      error: function () {
        $.ajax({
          url: `${RESTDB_URL}/${targetDocId}`,
          method: 'DELETE',
          headers: {
            'x-apikey': RESTDB_API_KEY,
          },
          timeout: 5000,
          success: function () {
            showToast('Đã xoá trên RestDB!', 'success');
            loadExpenses();
          },
          error: function () {
            rawDocs = rawDocs.filter((d) => d._id !== targetDocId && d._id !== id);
            saveLocalExpenses(rawDocs);
            expensesList = normalizeExpensesData(rawDocs);
            showToast('Đã xoá khỏi bộ nhớ máy!', 'success');
            renderAll();
          },
        });
      },
    });
  }
});
