// ------------------- تنظیمات کلیدی --------------------
// توکن بات تلگرام شما
const TELEGRAM_BOT_TOKEN = "YOUR TOKEN";
// شناسه چت یا کانال تلگرام (برای ارسال پیام)
const CHAT_ID = "@saharnazyp";
// ایمیل تقویم مورد نظر (مثلاً تقویم رییس)
const BOSS_CALENDAR_ID = "saharnazyaghoobpoor@gmail.com";
// ایمیل‌هایی که خلاصه به آن‌ها ارسال می‌شود
const RECIPIENT_EMAIL = " saharnazyaghoobpoor@gmail.com";
// --------------------------------------------------------

/**
 * تابع اصلی: خواندن، خلاصه‌سازی و ارسال گزارش روزانه.
 * این تابع باید به عنوان "Trigger" روزانه تنظیم شود.
 */
function sendDailyCalendarSummary_Automated() {
  const today = new Date();
  
  // ۱) خواندن رویدادهای تقویم
  const calendar = CalendarApp.getCalendarById(BOSS_CALENDAR_ID);
  if (!calendar) {
    // در صورت عدم دسترسی یا عدم وجود تقویم، خطا گزارش می‌شود.
    Logger.log(`خطا: تقویم با شناسه ${BOSS_CALENDAR_ID} پیدا نشد.`);
    MailApp.sendEmail(RECIPIENT_EMAIL, "خطای اتوماسیون تقویم", `تقویم ${BOSS_CALENDAR_ID} پیدا نشد.`);
    return;
  }
  
  const rawEvents = getCalendarEvents(calendar, today);

  // ۲) ساخت متن خام برای خلاصه‌سازی
  let rawSummary = `برنامه جلسات امروز (${formatDateReadable(today)}):\n\n`;
  if (rawEvents.length === 0) {
    rawSummary = `⚪ جلسه‌ای امروز (${formatDateReadable(today)}) ثبت نشده است.`;
    // اگر جلسه‌ای نبود، مستقیماً به تلگرام اطلاع داده شود.
    sendToTelegram(rawSummary);
    return;
  } else {
    rawEvents.forEach(event => {
      rawSummary +=
        `موضوع: ${event.getTitle()}\n` +
        `زمان: ${formatTime(event.getStartTime())} تا ${formatTime(event.getEndTime())}\n` +
        `مکان: ${event.getLocation() || "—"}\n` +
        `توضیحات: ${event.getDescription() || "—"}\n\n`;
    });
  }

  // ۳) خلاصه‌سازی توسط هوش مصنوعی (با استفاده از AIFunctions داخلی)
  const systemInstruction = "شما یک دستیار اجرایی هوشمند هستید. جلسات امروز را به زبان فارسی، به صورت رسمی، خلاصه، مرتب و مدیریتی برای مدیرعامل گزارش کنید. نکات مهم جلسات، زمان و مکان را به وضوح ذکر کنید.";
  let aiSummary = "";
  
  try {
    // از مدل Gemini Pro برای خلاصه‌سازی استفاده می‌شود (نیاز به فعال‌سازی در Google Apps Script)
    const result = AIFunctions.generateContent(
      rawSummary,
      {
        model: "gemini-2.5-flash", // مدلی که برای این کار بهینه است
        systemInstruction: systemInstruction
      }
    );
    aiSummary = result.text.trim();
  } catch (e) {
    Logger.log(`خطا در خلاصه‌سازی AI: ${e.toString()}`);
    // در صورت شکست خلاصه‌سازی، متن خام ارسال شود.
    aiSummary = `⚠️ (خطا در خلاصه‌سازی AI) \n\n${rawSummary}`;
  }


 // ۴) ارسال به تلگرام
let finalSummary = aiSummary || `⚠️ خطا در خلاصه‌سازی. گزارش خام جلسات: \n\n${rawSummary}`;

const telegramMessage = `📅 **خلاصهٔ جلسات امروز**\n\n${finalSummary}`;

// **اضافه کردن بررسی نهایی قبل از فراخوانی تابع ارسال**
if (finalSummary.trim().length === 0) {
    Logger.log("هشدار: متن پیام نهایی تلگرام پس از خلاصه‌سازی خالی است. عملیات ارسال لغو شد.");
    // در این حالت می‌توانید یک پیام پیش‌فرض برای گزارش خطا بفرستید
    sendToTelegram("❌ خطای سیستمی: گزارش جلسات روزانه خالی است. لطفاً لاگ‌ها را بررسی کنید.");
    return;
}

sendToTelegram(telegramMessage);

  // ۵) ارسال ایمیل
  MailApp.sendEmail({
    to: RECIPIENT_EMAIL,
    subject: `📅 خلاصهٔ جلسات امروز (${formatDateReadable(today)})`,
    body: aiSummary
  });
}

// ------------------- توابع کمکی --------------------

// تابع خواندن جلسات یک تقویم (برای استفاده داخلی)
// تابع خواندن جلسات یک تقویم (برای استفاده داخلی)
function getCalendarEvents(calendar, date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const end   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  
  const events = calendar.getEvents(start, end);
  
  // بازگشت رویدادها با فیلترهای ایمن:
  return events.filter(ev => {
    // ۱. حذف رویدادهای تمام روز
    if (ev.isAllDayEvent()) {
      return false;
    }
    
    // ۲. بررسی وضعیت لغو شده (با روشی ایمن‌تر)
    try {
      // اگر متد getStatus وجود داشته باشد و وضعیت CANCELLED باشد، آن را حذف کن.
      if (ev.getStatus() === CalendarApp.EventStatus.CANCELLED) {
        return false;
      }
    } catch (e) {
      // اگر getStatus خطا داد (یعنی متد وجود نداشت یا شیء ناقص بود)، آن رویداد را در نظر بگیر.
      Logger.log(`⚠️ اخطار: رویداد ${ev.getTitle()} متد getStatus را ندارد یا ناقص است. نادیده گرفته شد: ${e.message}`);
      // می‌توانید تصمیم بگیرید که اگر متد نبود، آن را نگه دارید (return true) یا حذف کنید (return false)
      // در اینجا فرض می‌کنیم که نگه داشته شود.
      // اگر می‌خواهید مطمئن باشید که رویداد لغو شده را نمی‌بینید:
      // return false; 
    }
    
    // ۳. نگه داشتن رویدادهایی که فیلترها را پاس کردند
    return true;
  });
}


// ارسال به تلگرام
function sendToTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  // استفاده از Markdown برای فرمت‌بندی بهتر در تلگرام
  const payload = {
    chat_id: CHAT_ID,
    text: text,
    parse_mode: "Markdown" 
  };

  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    });
  } catch (e) {
    Logger.log(`خطا در ارسال به تلگرام: ${e.toString()}`);
  }
}
// فرمت‌دهی زمان (مثلاً 09:00)
function formatTime(date) {
  return Utilities.formatDate(date, CalendarApp.getTimeZone(), "HH:mm");
}

// فرمت‌دهی تاریخ به شکل قابل خواندن
function formatDateReadable(date) {
  // تاریخ را با توجه به منطقه زمانی تقویم (BOSS_CALENDAR_ID) فرمت می‌کند
  return Utilities.formatDate(date, CalendarApp.getTimeZone(), "yyyy/MM/dd"); 
}
// فرمت تاریخ و زمان
function formatTime(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "HH:mm");
}

function formatDateReadable(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

// ساخت تریگر اتومات هر روز ساعت ۸ صبح
function createDailyTrigger() {
  ScriptApp.newTrigger('sendDailyCalendarSummary')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
}