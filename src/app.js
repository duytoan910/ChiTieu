/**
 * Sổ Chi Tiêu Ngăn ❤️ & Tòn 🐷
 * Tech Stack: Pure HTML5, jQuery 3.7, Tailwind CSS
 * Compatible with AI Studio, RestDB.io, and GitHub Pages Deployment
 */

$(document).ready(function () {
  // --- RESTDB & STORAGE CONFIGURATION ---
  const RESTDB_URL = 'https://dtoan-e791.restdb.io/rest/chitieu';
  const RESTDB_API_KEY = '6a74c1d37eee3e669ebc395c';
  const LOCAL_STORAGE_KEY = 'so_chi_tieu_ngan_ton_data';

  // App State
  let rawDocs = [];
  let expensesList = [];
  let selectedSpender = 'Ngăn ❤️❤️❤️';
  let selectedMonthFilter = 'CURRENT';
  let activeSpenderFilter = 'ALL'; // 'ALL', 'NGAN', 'TON'
  let searchQuery = '';
  let sortField = 'date';
  let sortAsc = false;
  let currentPage = 1;
  let pageSize = 15;
  let editingRowId = null;
  let activeFocusRowId = null;
  let expandedDates = new Set();
  let initialExpansionDone = false;
  let pendingConfirmCallback = null;

  // Custom Confirmation Modal Helper
  function showConfirmModal(message, onConfirm) {
    if (message) {
      $('#confirm-modal-message').text(message);
    } else {
      $('#confirm-modal-message').text('Bạn có chắc chắn muốn xoá khoản chi tiêu này không?');
    }
    pendingConfirmCallback = onConfirm;
    $('#confirm-modal').removeClass('hidden').addClass('flex');
  }

  function hideConfirmModal() {
    $('#confirm-modal').addClass('hidden').removeClass('flex');
    pendingConfirmCallback = null;
  }

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

  function getPriceInK(rawAmt) {
    let num = parseFloat(rawAmt) || 0;
    if (num <= 0) return 0;
    if (num >= 10000 && num % 1000 === 0) {
      return num / 1000;
    }
    return num;
  }

  function parseAmountInK(val) {
    let num = parseFloat(val) || 0;
    if (num <= 0) return 0;
    if (num >= 10000 && num % 1000 === 0) {
      return num;
    }
    return num * 1000;
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

  function convertDDMMYYYYToYYYYMMDD(dateStr) {
    if (!dateStr) return '00000000';
    const parts = String(dateStr).trim().split('/');
    if (parts.length === 3) {
      return `${parts[2]}${parts[1].padStart(2, '0')}${parts[0].padStart(2, '0')}`;
    }
    return String(dateStr);
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

  const isStaticHost =
    window.location.protocol === 'file:' ||
    window.location.hostname.includes('github.io') ||
    window.location.hostname.includes('netlify') ||
    window.location.hostname.includes('vercel') ||
    window.location.hostname.includes('pages.dev');

  // --- DATA FETCHING (SERVER API -> RESTDB -> LOCALSTORAGE FALLBACK) ---
  function loadExpenses() {
    $('#btn-reload-data i').addClass('fa-spin');

    if (isStaticHost) {
      fallbackToDirectRestDbOrLocal();
      return;
    }

    // 1. First try Express proxy API /api/expenses
    $.ajax({
      url: '/api/expenses',
      method: 'GET',
      timeout: 5000,
      success: function (res) {
        $('#btn-reload-data i').removeClass('fa-spin');
        if (res && res.success && Array.isArray(res.items)) {
          const localDocs = getLocalExpenses().filter((d) => d && d._id && !String(d._id).includes('_'));
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
          const localDocs = getLocalExpenses().filter((d) => d && d._id && !String(d._id).includes('_'));
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
    rawDocs = getLocalExpenses().filter((d) => d && d._id && !String(d._id).includes('_'));
    saveLocalExpenses(rawDocs);
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
        <td class="row-stt py-1.5 sm:py-2 px-1 sm:px-3 text-center text-[11px] sm:text-xs font-bold text-slate-400 select-none">${rowCount}</td>
        <td class="py-1 sm:py-2 px-1 sm:px-2">
          <input type="text" class="input-row-expense w-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" list="common-expenses-list" placeholder="Ví dụ: Ăn sáng, Ăn trưa..." value="${escapeHtml(expenseVal)}" />
        </td>
        <td class="py-1 sm:py-2 px-1 sm:px-2">
          <div class="relative flex items-center">
            <input type="number" step="any" min="0" class="input-row-amount w-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-bold text-emerald-700 text-right bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-11 sm:pr-16" placeholder="Ví dụ: 100" value="${displayAmt}" />
            <span class="preview-formatted-amt absolute right-1.5 sm:right-2 text-[10px] sm:text-xs font-semibold text-slate-400 pointer-events-none">
              ${displayAmt ? formatCurrency(parseAmountInK(displayAmt)) : 'k ₫'}
            </span>
          </div>
        </td>
        <td class="py-1 sm:py-2 px-1 sm:px-2 text-center">
          <button type="button" class="btn-delete-row p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Xoá dòng này">
            <i class="fa-solid fa-trash-can text-rose-500 text-xs sm:text-sm"></i>
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

  function updateSpenderUI(spender) {
    selectedSpender = spender || 'Ngăn ❤️❤️❤️';
    const isNgan = String(selectedSpender).includes('Ngăn');

    const $ngan = $('#btn-spender-ngan');
    const $ton = $('#btn-spender-ton');

    const baseClass = 'btn-spender-option flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2.5 px-2 sm:px-3 border-2 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all';

    if (isNgan) {
      $ngan
        .attr('class', `${baseClass} bg-pink-50 border-pink-500 text-pink-700 shadow-xs ring-2 ring-pink-300/60`)
        .html('<span class="text-sm sm:text-base">❤️</span><span>Ngăn ❤️❤️❤️</span>');
      $ton
        .attr('class', `${baseClass} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`)
        .html('<span class="text-sm sm:text-base">🐷</span><span>Tòn 🐷🐷🐷</span>');
    } else {
      $ton
        .attr('class', `${baseClass} bg-amber-50 border-amber-500 text-amber-900 shadow-xs ring-2 ring-amber-300/60`)
        .html('<span class="text-sm sm:text-base">🐷</span><span>Tòn 🐷🐷🐷</span>');
      $ngan
        .attr('class', `${baseClass} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`)
        .html('<span class="text-sm sm:text-base">❤️</span><span>Ngăn ❤️❤️❤️</span>');
    }
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    // Confirm Modal actions
    $('#confirm-modal-cancel').on('click', function () {
      hideConfirmModal();
    });

    $('#confirm-modal-ok').on('click', function () {
      if (typeof pendingConfirmCallback === 'function') {
        const cb = pendingConfirmCallback;
        hideConfirmModal();
        cb();
      } else {
        hideConfirmModal();
      }
    });

    $('#confirm-modal').on('click', function (e) {
      if (e.target === this) {
        hideConfirmModal();
      }
    });

    // Reload button
    $('#btn-reload-data').on('click', function () {
      loadExpenses();
    });

    // Spender toggle
    $(document).on('click', '.btn-spender-option', function (e) {
      e.preventDefault();
      const val = $(this).attr('data-spender') || $(this).data('spender');
      updateSpenderUI(val);
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

    // Track row focus
    $(document).on('focus', '.input-row-expense, .input-row-amount', function () {
      activeFocusRowId = $(this).closest('tr').attr('id');
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

    // Quick Expense Suggestions
    $('.btn-quick-expense').on('click', function () {
      const expenseName = $(this).data('expense');
      
      // Find the first empty row
      let $emptyRow = null;
      $('#expense-rows-body tr').each(function () {
        const exp = $.trim($(this).find('.input-row-expense').val());
        const amtStr = $.trim($(this).find('.input-row-amount').val());
        const amt = parseFloat(amtStr) || 0;
        if (exp === '' && amt === 0) {
          $emptyRow = $(this);
          return false; // Break out of loop
        }
      });

      if ($emptyRow && $emptyRow.length) {
        // Reuse the empty row
        const $expInput = $emptyRow.find('.input-row-expense');
        $expInput.val(expenseName).trigger('input');
        activeFocusRowId = $emptyRow.attr('id');
        $emptyRow.find('.input-row-amount').focus();
      } else {
        // Add a new row pre-filled with the selected expense
        addFormRow(expenseName);
        const $newRow = $('#expense-rows-body tr:last-child');
        $newRow.find('.input-row-expense').trigger('input');
        activeFocusRowId = $newRow.attr('id');
        $newRow.find('.input-row-amount').focus();
      }
    });

    // Reset Form
    $('#btn-reset-form').on('click', function () {
      $('#expense-rows-body').empty();
      addFormRow();
      $('#input-date').val(getTodayYYYYMMDD());
      updateSpenderUI('Ngăn ❤️❤️❤️');
      showToast('Đã làm mới form nhập', 'info');
    });

    // Submit Expenses
    $('#btn-submit-expenses').on('click', function () {
      submitExpensesForm();
    });

    // Spender filter by clicking on spender headers / cells / KPI cards
    $(document).on('click', '.btn-filter-spender', function (e) {
      e.stopPropagation();
      const spender = String($(this).data('spender') || $(this).attr('data-spender') || '');
      if (!spender) return;

      if (activeSpenderFilter === spender) {
        activeSpenderFilter = 'ALL';
      } else {
        activeSpenderFilter = spender;
      }
      currentPage = 1;
      renderAll();
    });

    $(document).on('click', '.btn-clear-spender-filter', function (e) {
      e.stopPropagation();
      activeSpenderFilter = 'ALL';
      currentPage = 1;
      renderAll();
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
      const maxPages = Math.ceil(getGroupedByDateItems().length / pageSize) || 1;
      if (currentPage < maxPages) {
        currentPage++;
        renderTable();
      }
    });

    // Toggle Date Group Child Table with smooth transition
    $(document).on('click', '.date-group-header', function (e) {
      if ($(e.target).closest('input, select, button.btn-inline-edit, button.btn-inline-delete, button.btn-inline-save, button.btn-inline-cancel').length) {
        return;
      }
      const date = String($(this).attr('data-date') || $(this).data('date') || '');
      if (!date) return;

      const $headerRow = $(this);
      const $childRow = $headerRow.next('.child-detail-row');
      const $wrapper = $childRow.find('.child-wrapper');
      const $btnToggle = $headerRow.find('.btn-toggle-date');
      const $btnIcon = $headerRow.find('.btn-toggle-icon-container');

      if (expandedDates.has(date)) {
        expandedDates.delete(date);
        $headerRow.removeClass('bg-emerald-50/40');
        $btnToggle.removeClass('bg-emerald-100 text-emerald-800').addClass('bg-slate-100 text-slate-600 hover:bg-slate-200').attr('title', 'Xem chi tiết');
        $btnToggle.html('<i class="fa-solid fa-chevron-down text-[11px] sm:text-xs"></i>');

        $wrapper.stop(true, true).slideUp(250, function () {
          $childRow.addClass('hidden');
        });
      } else {
        expandedDates.add(date);
        $headerRow.addClass('bg-emerald-50/40');
        $btnToggle.addClass('bg-emerald-100 text-emerald-800').removeClass('bg-slate-100 text-slate-600 hover:bg-slate-200').attr('title', 'Thu gọn');
        $btnToggle.html('<i class="fa-solid fa-chevron-up text-emerald-700 text-[11px] sm:text-xs"></i>');

        $childRow.removeClass('hidden');
        $wrapper.stop(true, true).hide().slideDown(250);
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

        const priceNum = getPriceInK(rawAmt);
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

    if (isStaticHost) {
      saveToDirectRestDbOrLocal(payloadSchema, totalAmountInVnd);
      return;
    }

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

      if (activeSpenderFilter === 'NGAN') {
        if (!String(item.spender || '').includes('Ngăn')) return false;
      } else if (activeSpenderFilter === 'TON') {
        if (!String(item.spender || '').includes('Tòn')) return false;
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

  function getGroupedByDateItems() {
    const filtered = getFilteredItems();

    const groupMap = {};
    filtered.forEach((item) => {
      const d = item.date || 'Không xác định';
      if (!groupMap[d]) {
        groupMap[d] = {
          date: d,
          items: [],
          totalAmount: 0,
          nganTotal: 0,
          tonTotal: 0,
        };
      }
      groupMap[d].items.push(item);
      const amt = Number(item.amount) || 0;
      groupMap[d].totalAmount += amt;

      const spender = String(item.spender || '');
      if (spender.includes('Tòn')) {
        groupMap[d].tonTotal += amt;
      } else {
        groupMap[d].nganTotal += amt;
      }
    });

    const groups = Object.values(groupMap);

    return groups.sort((a, b) => {
      const dateA = convertDDMMYYYYToYYYYMMDD(a.date);
      const dateB = convertDDMMYYYYToYYYYMMDD(b.date);

      if (sortField === 'amount') {
        return sortAsc ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount;
      }

      return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
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

  function renderSpenderFilterBadge() {
    // Highlight active KPI cards and column headers without adding layout-shifting badges
    $('[data-spender="NGAN"]').toggleClass('ring-2 ring-pink-500 bg-pink-100/90 shadow-sm', activeSpenderFilter === 'NGAN');
    $('[data-spender="TON"]').toggleClass('ring-2 ring-amber-500 bg-amber-100/90 shadow-sm', activeSpenderFilter === 'TON');
  }

  function renderTable() {
    renderSpenderFilterBadge();

    const groupedList = getGroupedByDateItems();
    const totalDaysCount = groupedList.length;

    $('#table-count-badge').text(`${totalDaysCount} ngày`);

    // Expand first date by default ONLY on initial load
    if (!initialExpansionDone && groupedList.length > 0) {
      expandedDates.add(groupedList[0].date);
      initialExpansionDone = true;
    }

    // Force expand searching, filtering by spender, or editing
    if (searchQuery !== '' || activeSpenderFilter !== 'ALL') {
      groupedList.forEach((g) => expandedDates.add(g.date));
    }
    if (editingRowId) {
      const editItem = expensesList.find((i) => i._id === editingRowId);
      if (editItem && editItem.date) {
        expandedDates.add(editItem.date);
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalDaysCount / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const paginated = groupedList.slice(startIdx, startIdx + pageSize);

    const $tbody = $('#expenses-tbody');
    $tbody.empty();

    if (paginated.length === 0) {
      $tbody.html(`
        <tr>
          <td colspan="6" class="py-8 text-center text-slate-400 text-xs font-medium">
            Chưa có dữ liệu chi tiêu nào phù hợp
          </td>
        </tr>
      `);
      $('#expenses-tfoot').addClass('hidden');
    } else {
      paginated.forEach((group) => {
        const isExpanded = expandedDates.has(group.date);

        // Date Header Row
        const dateRowHtml = `
          <tr class="date-group-header hover:bg-slate-50 transition-colors cursor-pointer select-none border-b border-slate-200 ${
            isExpanded ? 'bg-emerald-50/40' : ''
          }" data-date="${escapeHtml(group.date)}">
            <td class="py-1.5 sm:py-3 px-1 sm:px-3 font-extrabold text-slate-800 text-[10px] sm:text-sm">
              <span class="text-[10px] sm:text-sm font-bold truncate">${escapeHtml(group.date)}</span>
            </td>
            <td class="py-1.5 sm:py-3 px-0.5 sm:px-2 text-center">
              <span class="inline-flex items-center px-1 py-0.5 rounded-full text-[9px] sm:text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                ${group.items.length}<span class="hidden sm:inline">&nbsp;món</span>
              </span>
            </td>
            <td data-spender="NGAN" class="btn-filter-spender py-1.5 sm:py-3 px-0.5 sm:px-3 text-right font-bold text-pink-700 bg-pink-50/30 text-[10px] sm:text-sm cursor-pointer hover:bg-pink-100/80 transition-colors" title="Bấm để bật/tắt lọc chi tiêu của Ngăn">
              ${group.nganTotal > 0 ? formatCurrency(group.nganTotal) : '<span class="text-slate-300 font-normal">-</span>'}
            </td>
            <td data-spender="TON" class="btn-filter-spender py-1.5 sm:py-3 px-0.5 sm:px-3 text-right font-bold text-amber-900 bg-amber-50/30 text-[10px] sm:text-sm cursor-pointer hover:bg-amber-100/80 transition-colors" title="Bấm để bật/tắt lọc chi tiêu của Tòn">
              ${group.tonTotal > 0 ? formatCurrency(group.tonTotal) : '<span class="text-slate-300 font-normal">-</span>'}
            </td>
            <td class="py-1.5 sm:py-3 px-0.5 sm:px-3 text-right font-black text-emerald-700 text-[10px] sm:text-sm">
              ${formatCurrency(group.totalAmount)}
            </td>
            <td class="py-1.5 sm:py-3 px-0.5 sm:px-3 text-center">
              <button type="button" class="btn-toggle-date p-1 sm:p-1.5 text-xs font-bold ${
                isExpanded ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              } rounded-lg transition-colors cursor-pointer" title="${isExpanded ? 'Thu gọn' : 'Xem chi tiết'}">
                <i class="fa-solid ${isExpanded ? 'fa-chevron-up text-emerald-700' : 'fa-chevron-down'} text-[11px] sm:text-xs"></i>
              </button>
            </td>
          </tr>
        `;
        $tbody.append(dateRowHtml);

        // Child Sub-table Row
        let subTableRowsHtml = '';

        group.items.forEach((item) => {
          const isEditing = editingRowId === item._id;

          if (isEditing) {
            const displayAmtVal = item.price ? parseFloat(item.price) : (item.amount >= 1000 ? item.amount / 1000 : item.amount || 0);
            subTableRowsHtml += `
              <tr class="bg-emerald-50 border-b border-emerald-200">
                <td class="py-1 px-0.5 sm:px-2.5">
                  <select id="edit-spender-${item._id}" class="w-full px-0.5 py-0.5 text-[9px] sm:text-[11px] border border-slate-300 rounded bg-white font-bold">
                    <option value="Ngăn ❤️❤️❤️" ${item.spender.includes('Ngăn') ? 'selected' : ''}>Ngăn ❤️</option>
                    <option value="Tòn 🐷🐷🐷" ${item.spender.includes('Tòn') ? 'selected' : ''}>Tòn 🐷</option>
                  </select>
                </td>
                <td class="py-1 px-0.5 sm:px-2.5">
                  <input type="text" id="edit-expense-${item._id}" list="common-expenses-list" value="${escapeHtml(item.expense)}" class="w-full px-1 py-0.5 text-[9px] sm:text-[11px] border border-slate-300 rounded bg-white font-medium" />
                </td>
                <td class="py-1 px-0.5 sm:px-2.5">
                  <input type="number" step="any" id="edit-amount-${item._id}" value="${displayAmtVal}" class="w-full px-1 py-0.5 text-[9px] sm:text-[11px] border border-slate-300 rounded bg-white text-right font-bold text-emerald-700" />
                </td>
                <td class="py-1 px-0.5 sm:px-2.5 text-center whitespace-nowrap">
                  <div class="flex items-center justify-center gap-0.5 sm:gap-1">
                    <button type="button" data-id="${item._id}" class="btn-inline-save p-0.5 sm:p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors cursor-pointer text-[10px] sm:text-xs" title="Lưu">
                      <i class="fa-solid fa-floppy-disk"></i>
                    </button>
                    <button type="button" class="btn-inline-cancel p-0.5 sm:p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors cursor-pointer text-[10px] sm:text-xs" title="Hủy">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          } else {
            const isNgan = String(item.spender || '').includes('Ngăn');
            const displaySpenderTag = isNgan ? 'Ngăn ❤️' : 'Tòn 🐷';
            subTableRowsHtml += `
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-1 px-0.5 sm:px-2.5 whitespace-nowrap">
                  <span class="inline-flex items-center px-1 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold border whitespace-nowrap leading-tight ${
                    isNgan ? 'bg-pink-100 text-pink-800 border-pink-200' : 'bg-amber-100 text-amber-900 border-amber-200'
                  }">
                    ${escapeHtml(displaySpenderTag)}
                  </span>
                </td>
                <td class="py-1 px-0.5 sm:px-2.5 font-semibold text-slate-800 text-[10px] sm:text-[11px] leading-snug break-words">
                  ${escapeHtml(item.expense)}
                </td>
                <td class="py-1 px-0.5 sm:px-2.5 text-right font-bold text-emerald-700 text-[10px] sm:text-xs whitespace-nowrap">
                  ${formatCurrency(item.amount || 0)}
                </td>
                <td class="py-1 px-0.5 sm:px-2.5 text-center whitespace-nowrap">
                  <div class="flex items-center justify-center gap-0.5 sm:gap-1">
                    <button type="button" data-id="${item._id}" class="btn-inline-edit p-0.5 sm:p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer text-[10px] sm:text-xs" title="Sửa">
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" data-id="${item._id}" class="btn-inline-delete p-0.5 sm:p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer text-[10px] sm:text-xs" title="Xoá">
                      <i class="fa-solid fa-trash-can text-rose-500"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }
        });

        const childRowHtml = `
          <tr class="child-detail-row bg-slate-50/50 border-b-2 border-slate-200 ${isExpanded ? '' : 'hidden'}">
            <td colspan="6" class="p-0 border-0">
              <div class="child-wrapper py-1 px-0.5 sm:px-3 overflow-hidden" style="${isExpanded ? '' : 'display: none;'}">
                <div class="my-1 ml-3 sm:ml-8 bg-white rounded-xl border border-slate-200/90 shadow-2xs border-l-2 sm:border-l-4 border-l-emerald-600 overflow-hidden">
                  <div class="px-1.5 sm:px-3 py-1 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] font-extrabold text-slate-700">
                    <span class="flex items-center gap-1 sm:gap-1.5 text-emerald-800">
                      <i class="fa-solid fa-list-check text-emerald-600"></i>
                      Chi tiết ngày ${escapeHtml(group.date)}
                    </span>
                    <span class="text-slate-500 font-bold">Tổng: ${formatCurrency(group.totalAmount)}</span>
                  </div>
                  <div class="overflow-x-auto sm:overflow-visible">
                    <table class="w-full text-left text-[10px] sm:text-xs border-collapse table-fixed sm:table-auto">
                      <thead>
                        <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold select-none text-[9px] sm:text-[11px]">
                          <th class="py-1 px-0.5 sm:px-2.5 w-[20%] sm:w-28 whitespace-nowrap">Người</th>
                          <th class="py-1 px-0.5 sm:px-2.5">Nội dung</th>
                          <th class="py-1 px-0.5 sm:px-2.5 text-right w-[25%] sm:w-28 whitespace-nowrap">Số tiền</th>
                          <th class="py-1 px-0.5 sm:px-2.5 text-center w-[15%] sm:w-16 whitespace-nowrap">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 bg-white">
                        ${subTableRowsHtml}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
        $tbody.append(childRowHtml);
      });

      // Render Tfoot Total
      const filteredAll = getFilteredItems();
      const totalListAmount = filteredAll.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
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
    const targetItem = expensesList.find((i) => i._id === id);
    if (!targetItem) {
      showToast('Không tìm thấy khoản chi tiêu cần sửa!', 'error');
      return;
    }

    const spenderVal = $(`#edit-spender-${id}`).val() || targetItem.spender;
    const expenseVal = $.trim($(`#edit-expense-${id}`).val());
    const rawAmt = parseFloat($(`#edit-amount-${id}`).val()) || 0;
    const priceNum = getPriceInK(rawAmt);
    const amtVal = priceNum * 1000;

    if (!expenseVal) {
      showToast('Tên chi phí không được để trống!', 'error');
      return;
    }

    if (rawAmt <= 0) {
      showToast('Số tiền chi phí phải > 0!', 'error');
      return;
    }

    const targetDocId = targetItem.doc_id || id;
    const itemIndex = typeof targetItem.item_index === 'number' ? targetItem.item_index : 0;
    const newUserLabel = spenderVal.includes('Ngăn') ? 'ngân' : 'tòn';
    const formattedDate = formatDateDDMMYYYY(targetItem.date || getTodayYYYYMMDD());

    let parentDoc = rawDocs.find((d) => d._id === targetDocId);
    let updatedDoc;

    if (parentDoc) {
      if (Array.isArray(parentDoc.used) && parentDoc.used.length > 0) {
        const updatedUsed = [...parentDoc.used];
        updatedUsed[itemIndex] = {
          name: expenseVal,
          price: String(priceNum),
        };
        const newSumdate = updatedUsed.reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0);
        updatedDoc = {
          ...parentDoc,
          date: formattedDate,
          user: newUserLabel,
          used: updatedUsed,
          sumdate: newSumdate,
        };
      } else {
        updatedDoc = {
          ...parentDoc,
          date: formattedDate,
          user: newUserLabel,
          expense: expenseVal,
          amount: amtVal,
          price: String(priceNum),
          used: [{ name: expenseVal, price: String(priceNum) }],
          sumdate: priceNum,
        };
      }
    } else {
      updatedDoc = {
        _id: targetDocId,
        date: formattedDate,
        user: newUserLabel,
        used: [{ name: expenseVal, price: String(priceNum) }],
        sumdate: priceNum,
      };
    }

    const applyUpdateLocally = () => {
      const exists = rawDocs.some((d) => d._id === targetDocId);
      if (exists) {
        rawDocs = rawDocs.map((d) => (d._id === targetDocId ? updatedDoc : d));
      } else {
        rawDocs.unshift(updatedDoc);
      }
      saveLocalExpenses(rawDocs);
      expensesList = normalizeExpensesData(rawDocs);
      editingRowId = null;
      renderAll();
    };

    const updateRestDbDirectly = () => {
      $.ajax({
        url: `${RESTDB_URL}/${targetDocId}`,
        method: 'PUT',
        headers: {
          'x-apikey': RESTDB_API_KEY,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(updatedDoc),
        timeout: 5000,
        success: function () {
          applyUpdateLocally();
          showToast('Đã cập nhật chi tiêu trên RestDB!', 'success');
        },
        error: function () {
          applyUpdateLocally();
          showToast('Đã cập nhật chi tiêu trong bộ nhớ!', 'success');
        },
      });
    };

    if (isStaticHost) {
      updateRestDbDirectly();
      return;
    }

    // Attempt Express PUT
    $.ajax({
      url: `/api/expenses/${targetDocId}`,
      method: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(updatedDoc),
      timeout: 5000,
      success: function () {
        applyUpdateLocally();
        showToast('Đã cập nhật chi tiêu thành công!', 'success');
      },
      error: function () {
        updateRestDbDirectly();
      },
    });
  }

  function deleteExpenseItem(id) {
    const targetItem = expensesList.find((i) => i._id === id);
    if (!targetItem) {
      showToast('Không tìm thấy khoản chi tiêu cần xoá!', 'error');
      return;
    }

    const expText = targetItem.expense ? `"${targetItem.expense}"` : 'khoản chi tiêu này';
    const confirmMessage = `Bạn có chắc chắn muốn xoá ${expText} không?`;

    showConfirmModal(confirmMessage, function () {
      executeDeleteExpenseItem(id, targetItem);
    });
  }

  function executeDeleteExpenseItem(id, targetItem) {
    const targetDocId = targetItem.doc_id || id;
    const itemIndex = typeof targetItem.item_index === 'number' ? targetItem.item_index : 0;
    const parentDoc = rawDocs.find((d) => d._id === targetDocId);

    if (parentDoc && Array.isArray(parentDoc.used) && parentDoc.used.length > 1) {
      // Remove only this item from `used` array
      const updatedUsed = parentDoc.used.filter((_, idx) => idx !== itemIndex);
      const newSumdate = updatedUsed.reduce((sum, u) => sum + (parseFloat(u.price) || 0), 0);

      const updatedDoc = {
        ...parentDoc,
        used: updatedUsed,
        sumdate: newSumdate,
      };

      const applyUpdateLocally = () => {
        rawDocs = rawDocs.map((d) => (d._id === targetDocId ? updatedDoc : d));
        saveLocalExpenses(rawDocs);
        expensesList = normalizeExpensesData(rawDocs);
        renderAll();
      };

      const deleteOnRestDbDirectly = () => {
        $.ajax({
          url: `${RESTDB_URL}/${targetDocId}`,
          method: 'PUT',
          headers: {
            'x-apikey': RESTDB_API_KEY,
            'Content-Type': 'application/json',
          },
          data: JSON.stringify(updatedDoc),
          timeout: 5000,
          success: function () {
            applyUpdateLocally();
            showToast('Đã xoá khoản chi tiêu!', 'success');
          },
          error: function () {
            applyUpdateLocally();
            showToast('Đã xoá khoản chi tiêu khỏi bộ nhớ!', 'success');
          },
        });
      };

      if (isStaticHost) {
        deleteOnRestDbDirectly();
        return;
      }

      $.ajax({
        url: `/api/expenses/${targetDocId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(updatedDoc),
        timeout: 5000,
        success: function () {
          applyUpdateLocally();
          showToast('Đã xoá khoản chi tiêu!', 'success');
        },
        error: function () {
          deleteOnRestDbDirectly();
        },
      });
    } else {
      // Single item document, delete the whole document
      const applyDeleteLocally = () => {
        rawDocs = rawDocs.filter((d) => d._id !== targetDocId);
        saveLocalExpenses(rawDocs);
        expensesList = normalizeExpensesData(rawDocs);
        renderAll();
      };

      const deleteDocOnRestDbDirectly = () => {
        $.ajax({
          url: `${RESTDB_URL}/${targetDocId}`,
          method: 'DELETE',
          headers: {
            'x-apikey': RESTDB_API_KEY,
          },
          timeout: 5000,
          success: function () {
            applyDeleteLocally();
            showToast('Đã xoá trên RestDB!', 'success');
          },
          error: function () {
            applyDeleteLocally();
            showToast('Đã xoá khỏi bộ nhớ máy!', 'success');
          },
        });
      };

      if (isStaticHost) {
        deleteDocOnRestDbDirectly();
        return;
      }

      $.ajax({
        url: `/api/expenses/${targetDocId}`,
        method: 'DELETE',
        timeout: 5000,
        success: function () {
          applyDeleteLocally();
          showToast('Đã xoá khoản chi tiêu!', 'success');
        },
        error: function () {
          deleteDocOnRestDbDirectly();
        },
      });
    }
  }
});
