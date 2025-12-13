// ==================== تنظیمات ====================
const TELEGRAM_BOT_TOKEN = "YOUR TOKEN";
const CHAT_ID = "@SPO_Assistant";
const GEMINI_API_KEY = "AIzaSyAN__8MJGRlJOfI_w8j1IQMVuiGcOZCw5s";

// آدرس درست Gemini (v1beta + مدل درست)
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

// ==================== لیست واحدها ====================
const sheetsInfo = [
  { id: "ID SHEET", name: "واحد حقوقی", tabs: ["گزارش روزانه"] },
  { id: "ID SHEET", name: "واحد منابع انسانی", tabs: ["تردد آذرماه", "جذب و استخدام آذرماه"] },
  { id: "ID SHEET", name: "واحد تاسیسات", tabs: ["گزارش روزانه آذرماه 1404"] },
  { id: "ID SHEET", name: "دفتر مرکزی", tabs: ["گزارش جلسات آذر ۱۴۰۴", "گزارش تماس ها آذر ۱۴۰۴"] },
  { id: "ID SHEET", name: "خانم ک", tabs: ["آذرماه"] },
  { id: "ID SHEET", name: "واحد هوش مصنوعی", tabs: ["گزارش"] },
  { id: "ID SHEET", name: "گزارش تردک", tabs: [] },
  { id: "ID SHEET", name: "واحد مارکتینگ", tabs: ["کمپین هالوین", "گزارش اینستاگرام آبان 1404", "کمپین ایرانمال"] },
  { id: "ID SHEET", name: "واحد انبار", tabs: ["افزایش و کاهش آذر ماه", "گزارش روزانه آذر ماه"] },
  { id: "ID SHEET", name: "واحد CRM", tabs: ["جدول دلجویی ماه آذر", "گزارشات ماه آذر پالادیوم باملند ایرانمال"] },
  { id: "ID SHEET", name: "واحد IT", tabs: [] }
];

// ==================== گزارش روزانه ====================
function sendDailyReport() {
  const today = Utilities.formatDate(new Date(), "Asia/Tehran", "yyyy/MM/dd");
  const todayData = {};

  sheetsInfo.forEach(unit => {
    const rows = getTodayRows(unit.id);
    if (rows.length > 0) todayData[unit.name] = rows;
  });

  let message;

  if (Object.keys(todayData).length === 0) {
    message = `*گزارش روزانه — ${today}*\n\nهیچ واحدی گزارش نداده است.\n\n— ربات SPO`;
  } else {
    const prompt = `شما دستیار مدیرعامل هستید. گزارش‌های امروز واحدها را دریافت کرده‌اید.
لطفاً یک خلاصه حرفه‌ای، کوتاه و خوانا (حداکثر 30 خط) به فارسی بنویسید.
فقط نکات مهم هر واحد را بگویید و در آخر تعداد واحدهای گزارش‌دهنده را ذکر کنید.

داده‌های امروز:
${JSON.stringify(todayData, null, 2)}`;

    const summary = callGemini(prompt) || "خلاصه تولید نشد.";
    message = `*گزارش روزانه — ${today}*\n\n${summary}\n\n— ربات گزارش‌دهی SPO`;
  }

  sendToTelegram(message);
}

// ==================== گرفتن ردیف‌های امروز ====================
function getTodayRows(spreadsheetId) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const today = Utilities.formatDate(new Date(), "Asia/Tehran", "yyyy/MM/dd");
    const rows = [];

    ss.getSheets().forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.every(c => !c)) continue;

        const hasToday = row.some(cell => {
          if (!cell) return false;
          const s = cell.toString().trim();

          // تاریخ شمسی
          if (s.includes(today) || s.includes(today.replace("1404", "۱۴۰۴"))) return true;

          // تاریخ میلادی (12/03/2025 یا 2025-12-03)
          if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$|^\d{4}.*\d{1,2}.*\d{1,2}$/.test(s)) {
            try {
              const d = new Date(s);
              if (Utilities.formatDate(d, "Asia/Tehran", "yyyy/MM/dd") === today) return true;
            } catch(e) {}
          }

          // Date object
          if (cell instanceof Date) {
            if (Utilities.formatDate(cell, "Asia/Tehran", "yyyy/MM/dd") === today) return true;
          }

          // کلمه امروز
          if (s.includes("امروز")) return true;

          return false;
        });

        if (hasToday) {
          rows.push(row.filter(c => c).join(" → "));
        }
      }
    });

    return rows;
  } catch (e) {
    return [];
  }
}

// ==================== فراخوانی Gemini (درست و بدون خطا) ====================
function callGemini(prompt) {
  try {
    const response = UrlFetchApp.fetch(GEMINI_URL + "?key=" + GEMINI_API_KEY, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 600 }
      })
    });

    const result = JSON.parse(response.getContentText());
    return result.candidates[0].content.parts[0].text.trim();
  } catch (e) {
    Logger.log("Gemini error: " + e.toString());
    return "خطا در هوش مصنوعی (احتمالاً محدودیت روزانه).";
  }
}

// ==================== ارسال تلگرام ====================
function sendToTelegram(text) {
  UrlFetchApp.fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
      parse_mode: "Markdown"
    })
  });
}