/**
 * Sổ Tay Chi Tiêu Hàng Ngày - Pure HTML/CSS & Kendo UI (jQuery version)
 */

$(document).ready(function () {
  // Set Vietnamese culture for Kendo UI
  if (kendo && kendo.culture) {
    kendo.culture("vi-VN");
  }

  // Application State
  let selectedSpreadsheetId = localStorage.getItem("selectedSpreadsheetId") || "";
  let isGoogleAuth = false;
  let unsavedChanges = false;

  // Initial Sample Data if starting fresh
  const defaultInitialData = [
    { id: generateId(), date: getTodayFormatted(), spender: "Tôi", expense: "Ăn sáng & Cà phê", amount: 45000 },
    { id: generateId(), date: getTodayFormatted(), spender: "Tôi", expense: "Xăng xe máy", amount: 80000 },
    { id: generateId(), date: getTodayFormatted(), spender: "Vợ", expense: "Đi chợ thực phẩm", amount: 250000 },
  ];

  // Load local backup if present, else default
  const savedLocalItems = localStorage.getItem("kendo_expense_items");
  let currentItems = savedLocalItems ? JSON.parse(savedLocalItems) : defaultInitialData;

  // Initialize Notification Toast
  const notification = $("#notification").kendoNotification({
    position: { pinned: true, top: 20, right: 20 },
    autoHideAfter: 3500,
    stacking: "down",
    templates: [
      { type: "info", template: "<div class='flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg shadow-md'><span class='k-icon k-i-info'></span> #: message #</div>" },
      { type: "success", template: "<div class='flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg shadow-md'><span class='k-icon k-i-check-circle'></span> #: message #</div>" },
      { type: "error", template: "<div class='flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg shadow-md'><span class='k-icon k-i-exception'></span> #: message #</div>" }
    ]
  }).data("kendoNotification");

  function showToast(msg, type = "info") {
    if (notification) {
      notification.show({ message: msg }, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${msg}`);
    }
  }

  // --- Kendo Controls Initialization ---

  // 1. DatePicker (Default to TODAY)
  const datePicker = $("#input-date").kendoDatePicker({
    format: "dd/MM/yyyy",
    value: new Date(),
    culture: "vi-VN",
  }).data("kendoDatePicker");

  // 2. Amount NumericTextBox
  const amountBox = $("#input-amount").kendoNumericTextBox({
    format: "n0",
    min: 0,
    step: 10000,
    decimals: 0,
    placeholder: "0 ₫",
    culture: "vi-VN"
  }).data("kendoNumericTextBox");

  // 3. Spender AutoComplete
  $("#input-spender").kendoAutoComplete({
    dataSource: ["Tôi", "Vợ/Chồng", "Mẹ", "Bố", "Thành viên A", "Công ty", "Gia đình"],
    placeholder: "Ví dụ: Tôi, Vợ...",
    filter: "contains"
  });

  // 4. Expense AutoComplete
  $("#input-expense").kendoAutoComplete({
    dataSource: [
      "Ăn sáng", "Ăn trưa", "Ăn tối", "Cà phê", "Xăng xe", "Đi chợ / Siêu thị",
      "Tiền điện", "Tiền nước", "Tiền Internet", "Mua sắm quần áo", "Khám bệnh / Thuốc",
      "Giải trí / Xem phim", "Gửi xe", "Sửa chữa đồ đạc", "Tiền học phí"
    ],
    placeholder: "Ví dụ: Ăn sáng, Xăng xe...",
    filter: "contains"
  });

  // --- Kendo Grid DataSource Setup ---
  const gridDataSource = new kendo.data.DataSource({
    data: currentItems,
    schema: {
      model: {
        id: "id",
        fields: {
          id: { editable: false, nullable: true },
          date: { type: "string", validation: { required: true } },
          spender: { type: "string", validation: { required: true } },
          expense: { type: "string", validation: { required: true } },
          amount: { type: "number", validation: { required: true, min: 0 } }
        }
      }
    },
    aggregate: [
      { field: "amount", aggregate: "sum" },
      { field: "spender", aggregate: "count" }
    ],
    pageSize: 15,
    change: function (e) {
      // Local storage backup & recalculate stats on data edit
      const rawData = gridDataSource.data().toJSON();
      localStorage.setItem("kendo_expense_items", JSON.stringify(rawData));
      updateStatistics(rawData);
      
      if (e.action) {
        setUnsavedStatus(true);
      }
    }
  });

  // 5. Kendo Grid Component
  const grid = $("#grid").kendoGrid({
    dataSource: gridDataSource,
    pageable: {
      refresh: true,
      pageSizes: [10, 15, 25, 50, "Tất cả"],
      messages: {
        display: "Hiển thị {0} - {1} trong tổng {2} dòng chi tiêu",
        empty: "Chưa có dữ liệu chi tiêu nào",
        itemsPerPage: "dòng mỗi trang"
      }
    },
    sortable: true,
    filterable: {
      extra: false,
      operators: {
        string: { contains: "Chứa từ", startswith: "Bắt đầu bằng", eq: "Bằng" }
      }
    },
    editable: {
      mode: "incell",
      confirmation: "Bạn có chắc chắn muốn xoá dòng chi tiêu này không?"
    },
    toolbar: [
      {
        template: `
          <div class="flex flex-wrap items-center justify-between gap-3 w-full p-1">
            <div class="flex flex-wrap items-center gap-2">
              <button id="btn-grid-add-row" class="k-button k-button-solid-primary k-button-md rounded-lg flex items-center gap-1 font-semibold">
                <span class="k-icon k-i-plus"></span> Thêm dòng mới
              </button>
              <button id="btn-grid-clear-all" class="k-button k-button-solid-base k-button-md rounded-lg text-red-600 flex items-center gap-1">
                <span class="k-icon k-i-trash"></span> Xoá tất cả dòng
              </button>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button id="btn-sync-sheets" class="k-button k-button-solid-success k-button-md rounded-lg font-bold flex items-center gap-1.5 shadow-sm">
                <span class="k-icon k-i-upload"></span> Lưu vào Google Sheet
              </button>
              <button id="btn-reload-sheets" class="k-button k-button-solid-info k-button-md rounded-lg flex items-center gap-1">
                <span class="k-icon k-i-download"></span> Tải lại từ Sheet
              </button>
            </div>
          </div>
        `
      }
    ],
    columns: [
      {
        field: "date",
        title: "Ngày tháng",
        width: "140px",
        template: function (data) {
          return `<div class="font-medium text-slate-700 flex items-center gap-1.5"><span class="k-icon k-i-calendar text-slate-400"></span> ${escapeHtml(data.date)}</div>`;
        }
      },
      {
        field: "spender",
        title: "Tên người chi tiêu",
        width: "180px",
        template: function (data) {
          return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">${escapeHtml(data.spender || "Chưa nhập")}</span>`;
        }
      },
      {
        field: "expense",
        title: "Tên chi phí / Nội dung",
        template: function (data) {
          return `<span class="font-medium text-slate-800">${escapeHtml(data.expense || "Chưa nhập")}</span>`;
        }
      },
      {
        field: "amount",
        title: "Số tiền (VNĐ)",
        width: "180px",
        format: "{0:n0} ₫",
        attributes: { style: "text-align: right; font-size: 0.95rem;" },
        headerAttributes: { style: "text-align: right;" },
        footerAttributes: { style: "text-align: right; font-weight: 700; font-size: 1rem; color: #059669;" },
        template: function (data) {
          return `<span class="font-semibold text-emerald-700">${kendo.toString(data.amount || 0, "n0")} ₫</span>`;
        },
        footerTemplate: "Tổng: #= kendo.toString(sum || 0, 'n0') # ₫"
      },
      {
        command: [
          {
            name: "destroy",
            text: "Xoá",
            iconClass: "k-i-delete"
          }
        ],
        title: "Thao tác",
        width: "110px",
        attributes: { style: "text-align: center;" }
      }
    ]
  }).data("kendoGrid");

  // --- Statistics Calculation ---
  function updateStatistics(items) {
    if (!items || !Array.isArray(items)) items = [];
    
    const todayStr = getTodayFormatted();
    let totalAmount = 0;
    let todayAmount = 0;
    let highestItem = { expense: "-", amount: 0 };
    const spenderCounts = {};

    items.forEach(item => {
      const amt = parseFloat(item.amount) || 0;
      totalAmount += amt;

      if (item.date === todayStr) {
        todayAmount += amt;
      }

      if (amt > highestItem.amount) {
        highestItem = { expense: item.expense || "Chi phí", amount: amt };
      }

      if (item.spender) {
        spenderCounts[item.spender] = (spenderCounts[item.spender] || 0) + amt;
      }
    });

    let topSpender = "-";
    let topSpenderAmt = 0;
    Object.keys(spenderCounts).forEach(sp => {
      if (spenderCounts[sp] > topSpenderAmt) {
        topSpender = sp;
        topSpenderAmt = spenderCounts[sp];
      }
    });

    $("#stat-total-amount").text(`${kendo.toString(totalAmount, "n0")} ₫`);
    $("#stat-today-amount").text(`${kendo.toString(todayAmount, "n0")} ₫`);
    $("#stat-total-count").text(`${items.length} giao dịch`);
    $("#stat-top-spender").text(topSpender !== "-" ? `${topSpender} (${kendo.toString(topSpenderAmt, "n0")} ₫)` : "-");
  }

  // Calculate initial statistics
  updateStatistics(gridDataSource.data().toJSON());

  // --- Quick Amount Preset Buttons ---
  $(".btn-preset-amount").on("click", function () {
    const valToAdd = parseInt($(this).attr("data-val") || "0", 10);
    const currentVal = amountBox.value() || 0;
    amountBox.value(currentVal + valToAdd);
  });

  $("#btn-reset-form").on("click", function () {
    $("#input-spender").val("");
    $("#input-expense").val("");
    amountBox.value(null);
    datePicker.value(new Date());
  });

  // --- Main Form Submission (Submit & Auto Save to Google Sheet) ---
  $("#btn-add-expense").on("click", function (e) {
    e.preventDefault();

    const dateVal = datePicker.value();
    const formattedDate = dateVal ? kendo.toString(dateVal, "dd/MM/yyyy") : getTodayFormatted();
    const spenderVal = $.trim($("#input-spender").val());
    const expenseVal = $.trim($("#input-expense").val());
    const amountVal = amountBox.value();

    if (!spenderVal) {
      showToast("Vui lòng nhập tên người chi tiêu!", "error");
      $("#input-spender").focus();
      return;
    }

    if (!expenseVal) {
      showToast("Vui lòng nhập tên/nội dung chi phí!", "error");
      $("#input-expense").focus();
      return;
    }

    if (amountVal === null || amountVal === undefined || amountVal < 0) {
      showToast("Vui lòng nhập số tiền chi hợp lệ!", "error");
      amountBox.focus();
      return;
    }

    // 1. Add item to Kendo Grid locally
    gridDataSource.add({
      id: generateId(),
      date: formattedDate,
      spender: spenderVal,
      expense: expenseVal,
      amount: amountVal
    });

    const $btn = $(this);
    const originalBtnHtml = $btn.html();
    $btn.prop("disabled", true).addClass("opacity-75").html(`<span class="k-icon k-i-loading animate-spin"></span> Đang gửi & lưu vào Sheet...`);

    // 2. Auto Append to Google Sheet 'chitieucuaNganvaToan.xlsx'
    $.ajax({
      url: "/api/sheets/append-default",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        date: formattedDate,
        spender: spenderVal,
        expense: expenseVal,
        amount: amountVal,
        targetSheetName: "chitieucuaNganvaToan.xlsx"
      }),
      success: function (res) {
        $btn.prop("disabled", false).removeClass("opacity-75").html(originalBtnHtml);

        if (res.spreadsheetId) {
          selectedSpreadsheetId = res.spreadsheetId;
          localStorage.setItem("selectedSpreadsheetId", res.spreadsheetId);
          updateOpenSheetLink();
          setUnsavedStatus(false);
        }

        showToast(`Đã gửi & tự động lưu vào Google Sheet "${res.spreadsheetName || 'chitieucuaNganvaToan.xlsx'}" thành công!`, "success");

        // Clear input fields for next entry
        $("#input-expense").val("").focus();
        amountBox.value(null);
      },
      error: function (xhr) {
        $btn.prop("disabled", false).removeClass("opacity-75").html(originalBtnHtml);
        const err = xhr.responseJSON ? xhr.responseJSON.error : "Không thể tự động lưu vào Google Sheet.";
        
        if (xhr.status === 401) {
          showToast(`Đã thêm vào bảng. Vui lòng bấm 'Kết nối Google Sheets' ở góc trên để lưu trực tiếp vào file chitieucuaNganvaToan.xlsx!`, "info");
        } else {
          showToast(`Lỗi: ${err}`, "error");
        }

        // Clear input fields for next entry anyway
        $("#input-expense").val("").focus();
        amountBox.value(null);
      }
    });
  });

  // Grid Toolbar Buttons Handlers
  $(document).on("click", "#btn-grid-add-row", function () {
    const newRow = gridDataSource.insert(0, {
      id: generateId(),
      date: getTodayFormatted(),
      spender: "Tôi",
      expense: "Chi phí mới",
      amount: 0
    });
    showToast("Đã thêm 1 dòng mới vào bảng", "info");
  });

  $(document).on("click", "#btn-grid-clear-all", function () {
    if (confirm("Bạn có chắc chắn muốn xoá toàn bộ các dòng chi tiêu trong bảng?")) {
      gridDataSource.data([]);
      showToast("Đã xoá toàn bộ danh sách chi tiêu", "info");
    }
  });

  $(document).on("click", "#btn-sync-sheets", function () {
    saveDataToGoogleSheet();
  });

  $(document).on("click", "#btn-reload-sheets", function () {
    if (selectedSpreadsheetId) {
      loadSheetData(selectedSpreadsheetId);
    } else {
      showToast("Vui lòng chọn hoặc tạo 1 Google Sheet trước", "error");
    }
  });

  // --- Unsaved Changes Status ---
  function setUnsavedStatus(isUnsaved) {
    unsavedChanges = isUnsaved;
    const $badge = $("#sync-status-badge");
    if (isUnsaved) {
      $badge.removeClass("bg-emerald-100 text-emerald-800 border-emerald-200")
            .addClass("bg-amber-100 text-amber-800 border-amber-200")
            .html("<span class='w-2 h-2 rounded-full bg-amber-500 animate-pulse'></span> Có thay đổi chưa lưu vào Google Sheet");
    } else {
      $badge.removeClass("bg-amber-100 text-amber-800 border-amber-200")
            .addClass("bg-emerald-100 text-emerald-800 border-emerald-200")
            .html("<span class='w-2 h-2 rounded-full bg-emerald-500'></span> Đã đồng bộ với Google Sheet");
    }
  }

  // ================= GOOGLE AUTH & SHEETS INTEGRATION =================

  function checkAuthStatus() {
    $.getJSON("/api/auth/status", function (res) {
      if (res.authenticated && res.user) {
        isGoogleAuth = true;
        renderLoggedInUser(res.user);
        loadUserSpreadsheets();
      } else {
        isGoogleAuth = false;
        renderLoggedOutUser(res.hasCredentials);
      }
    }).fail(function () {
      renderLoggedOutUser(false);
    });
  }

  function renderLoggedInUser(user) {
    $("#auth-container").html(`
      <div class="flex items-center gap-3">
        <img src="${escapeHtml(user.picture || 'https://lh3.googleusercontent.com/a/default-user')}" alt="Avatar" class="w-8 h-8 rounded-full border border-slate-200" />
        <div class="text-left hidden sm:block">
          <div class="text-xs font-semibold text-slate-800">${escapeHtml(user.name || "Người dùng")}</div>
          <div class="text-[11px] text-slate-500">${escapeHtml(user.email || "")}</div>
        </div>
        <button id="btn-logout-google" class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200">
          Đăng xuất
        </button>
      </div>
    `);

    $("#btn-logout-google").on("click", function () {
      $.post("/api/auth/logout", function () {
        showToast("Đã đăng xuất tài khoản Google", "info");
        checkAuthStatus();
      });
    });
  }

  function renderLoggedOutUser(hasCredentials) {
    $("#auth-container").html(`
      <button id="btn-login-google" class="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-2">
        <svg class="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
        </svg>
        Kết nối Google Sheets
      </button>
    `);

    $("#btn-login-google").on("click", function () {
      $.getJSON("/api/auth/url", function (res) {
        if (res.url) {
          const width = 550;
          const height = 650;
          const left = (screen.width - width) / 2;
          const top = (screen.height - height) / 2;
          window.open(res.url, "GoogleAuthPopup", `width=${width},height=${height},top=${top},left=${left}`);
        } else {
          showToast("Chưa cấu hình OAuth Client ID", "error");
        }
      }).fail(function (xhr) {
        const err = xhr.responseJSON ? xhr.responseJSON.error : "Không thể lấy liên kết đăng nhập";
        showToast(err, "error");
      });
    });
  }

  // Listen for popup authentication callback success
  window.addEventListener("message", function (event) {
    if (event.data === "oauth-success") {
      showToast("Đã kết nối tài khoản Google thành công!", "success");
      checkAuthStatus();
    }
  });

  // Load User's Google Sheets files
  function loadUserSpreadsheets() {
    $("#sheet-select-container").html(`
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <span class="k-icon k-i-loading animate-spin"></span> Đang tải danh sách Google Sheets...
      </div>
    `);

    $.getJSON("/api/sheets/list", function (res) {
      const files = res.files || [];
      
      let optionsHtml = `<option value="">-- Chọn một Google Sheet để lưu --</option>`;
      optionsHtml += `<option value="NEW_SHEET">+ [Tạo Google Sheet mới]</option>`;

      files.forEach(f => {
        const isSelected = f.id === selectedSpreadsheetId ? "selected" : "";
        optionsHtml += `<option value="${escapeHtml(f.id)}" ${isSelected}>📊 ${escapeHtml(f.name)}</option>`;
      });

      $("#sheet-select-container").html(`
        <div class="flex flex-wrap items-center gap-2">
          <select id="sheet-dropdown" class="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none min-w-[240px]">
            ${optionsHtml}
          </select>
          <button id="btn-create-sheet-modal" class="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1">
            <span class="k-icon k-i-plus"></span> Tạo Sheet mới
          </button>
          <a id="link-open-sheet" href="#" target="_blank" class="hidden px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1">
            <span class="k-icon k-i-hyperlink-open text-slate-500"></span> Mở trang
          </a>
        </div>
      `);

      updateOpenSheetLink();

      $("#sheet-dropdown").on("change", function () {
        const val = $(this).val();
        if (val === "NEW_SHEET") {
          promptCreateNewSheet();
        } else if (val) {
          selectedSpreadsheetId = val;
          localStorage.setItem("selectedSpreadsheetId", val);
          updateOpenSheetLink();
          loadSheetData(val);
        } else {
          selectedSpreadsheetId = "";
          localStorage.removeItem("selectedSpreadsheetId");
          updateOpenSheetLink();
        }
      });

      $("#btn-create-sheet-modal").on("click", function () {
        promptCreateNewSheet();
      });

    }).fail(function () {
      $("#sheet-select-container").html(`
        <div class="text-xs text-red-600">Lỗi khi tải danh sách Google Sheets.</div>
      `);
    });
  }

  function updateOpenSheetLink() {
    const $link = $("#link-open-sheet");
    if (selectedSpreadsheetId) {
      $link.attr("href", `https://docs.google.com/spreadsheets/d/${selectedSpreadsheetId}`).removeClass("hidden");
    } else {
      $link.addClass("hidden");
    }
  }

  function promptCreateNewSheet() {
    const defaultTitle = `Sổ Chi Tiêu Hàng Ngày - ${kendo.toString(new Date(), "dd/MM/yyyy")}`;
    const title = prompt("Nhập tên cho file Google Sheet mới:", defaultTitle);
    
    if (title && $.trim(title)) {
      showToast("Đang khởi tạo Google Sheet mới...", "info");
      $.ajax({
        url: "/api/sheets/create",
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({ title: $.trim(title) }),
        success: function (res) {
          showToast(`Đã tạo Google Sheet: ${res.title}`, "success");
          selectedSpreadsheetId = res.spreadsheetId;
          localStorage.setItem("selectedSpreadsheetId", res.spreadsheetId);
          loadUserSpreadsheets();
        },
        error: function (xhr) {
          const err = xhr.responseJSON ? xhr.responseJSON.error : "Không thể tạo Google Sheet";
          showToast(err, "error");
        }
      });
    }
  }

  // Load Data from Google Sheet into Kendo Grid
  function loadSheetData(spreadsheetId) {
    showToast("Đang tải dữ liệu từ Google Sheet...", "info");
    $.getJSON(`/api/sheets/data?spreadsheetId=${spreadsheetId}`, function (res) {
      const items = res.items || [];
      gridDataSource.data(items.map(item => ({
        id: generateId(),
        date: item.date || getTodayFormatted(),
        spender: item.spender || "Tôi",
        expense: item.expense || "Chi phí",
        amount: parseFloat(item.amount) || 0
      })));

      setUnsavedStatus(false);
      showToast(`Tải thành công ${items.length} dòng dữ liệu từ Google Sheet!`, "success");
    }).fail(function (xhr) {
      const err = xhr.responseJSON ? xhr.responseJSON.error : "Lỗi khi nạp dữ liệu từ Google Sheet";
      showToast(err, "error");
    });
  }

  // Save current Kendo Grid data to Google Sheet
  function saveDataToGoogleSheet() {
    if (!isGoogleAuth) {
      showToast("Vui lòng click 'Kết nối Google Sheets' ở góc trên trước!", "error");
      return;
    }

    if (!selectedSpreadsheetId) {
      showToast("Vui lòng chọn hoặc tạo 1 file Google Sheet để lưu!", "error");
      return;
    }

    const items = gridDataSource.data().toJSON();
    if (items.length === 0) {
      if (!confirm("Bảng hiện đang trống. Bạn có muốn lưu bảng trống vào Google Sheet không?")) {
        return;
      }
    }

    showToast("Đang đồng bộ dữ liệu vào Google Sheet...", "info");

    $.ajax({
      url: "/api/sheets/save",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        spreadsheetId: selectedSpreadsheetId,
        items: items
      }),
      success: function (res) {
        setUnsavedStatus(false);
        showToast(`Đã lưu thành công ${res.count} dòng chi tiêu vào Google Sheet!`, "success");
      },
      error: function (xhr) {
        const err = xhr.responseJSON ? xhr.responseJSON.error : "Không thể lưu dữ liệu vào Google Sheet";
        showToast(err, "error");
      }
    });
  }

  // Helper Utils
  function getTodayFormatted() {
    return kendo.toString(new Date(), "dd/MM/yyyy");
  }

  function generateId() {
    return "exp-" + Math.random().toString(36).substr(2, 9);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initial Auth Check
  checkAuthStatus();
});
