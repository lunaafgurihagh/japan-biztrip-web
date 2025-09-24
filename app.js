// ------- 存储层（localStorage） -------
const DB_KEY = "biztrip.db.v1";
function loadDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || { trips: [], meetings: [], expenses: [] }; }
  catch { return { trips: [], meetings: [], expenses: [] }; }
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
const db = loadDB();

// ------- 工具 -------
const $ = (s) => document.querySelector(s);
const fmtDate = (d) => new Date(d).toISOString().slice(0,10);
const todayStr = () => fmtDate(new Date());
const uid = () => Math.random().toString(36).slice(2,10);
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return fmtDate(x); }
function escapeHtml(s){ return s.replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

// ------- 视图刷新 -------
function renderTrips() {
  const ul = $("#trip-list"); 
  ul.innerHTML = "";
  db.trips
    .sort((a,b)=>a.start.localeCompare(b.start))
    .forEach(t => {
      const li = document.createElement("li");
      li.className = "trip-item";
      li.innerHTML = `
        <span class="trip-meta">[${escapeHtml(t.city)}] ${t.start} ~ ${t.end}
          &nbsp;&nbsp;酒店:${t.checkIn||"-"}→${t.checkOut||"-"}</span>
        <button class="btn-del" data-id="${t.id}">删除</button>
      `;
      ul.appendChild(li);
    });
}

function renderAgenda() {
  const ul = $("#agenda-list"); 
  ul.innerHTML = "";
  const t0 = todayStr();
  const items = [];

  db.trips.forEach(t => {
    if (t.start === t0) {
      items.push({time:"09:00", text:`出差开始 - ${t.city}`});
      // 角色台词（出差开始）
      logSys("角色：出发啦！这次也一起加油～");
    }
    if (t.end === t0) {
      items.push({time:"18:00", text:`出差结束 - ${t.city}`});
      // 出差结束台词
      logSys("角色：辛苦啦！要不要导出本次清单？");
    }
    if (t.checkIn === t0) {
      items.push({time:"18:00", text:`酒店入住 - ${t.city}`});
      logSys("角色：欢迎回到据点，早点休息别忘了喝水。");
    }
    if (t.checkOut === t0) {
      items.push({time:"09:00", text:`酒店退房 - ${t.city}`});
      logSys("角色：退房时间到啦，别落下充电器～");
    }
  });

  db.meetings.forEach(m=>{
    if (m.date === t0) {
      items.push({time:m.time, text:`会议 - ${m.title}`});
      logSys("角色：会议还有20分钟，深呼吸，你已经准备好了。");
    }
  });

  items.sort((a,b)=>a.time.localeCompare(b.time));
  items.forEach(i=> {
    const li = document.createElement("li");
    li.textContent = `${i.time}  ${i.text}`;
    ul.appendChild(li);
  });
}

function logUser(text){ const div=$("#bot-log"); div.insertAdjacentHTML("beforeend", `<div class="user">你：${escapeHtml(text)}</div>`); }
function logSys(text){ const div=$("#bot-log"); div.insertAdjacentHTML("beforeend", `<div class="sys">系统：${escapeHtml(text)}</div>`); }

// ------- 指令解析（固定关键词+正则） -------
const reTripFull = /^出差\s+(\S+)\s+(\d{4}-\d{2}-\d{2})\s*[到\-~]\s*(\d{4}-\d{2}-\d{2})$/;
const reTripCityOnly = /^出差(?:\s+(\S+))?$/; // 出差 或 出差 城市
const reHotel = /^入住\s+(\d{4}-\d{2}-\d{2})\s*[到\-~]\s*(\d{4}-\d{2}-\d{2})$/;
const reCheckout = /^退房\s+(\d{4}-\d{2}-\d{2})$/;
const reMeeting = /^会议\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s+([0-2]\d:[0-5]\d)$/;
const reExpenseAny = /^报销(?:\s+([^\s\d]+.*?)?(?:\s+(\d+(?:\.\d+)?))?(?:\s+(JPY|USD|RMB))?)?$/i;


// ------- 出差对话框逻辑 -------
const dateDialog = $("#date-dialog");
const dlgCity = $("#dlg-city");
const dlgStart = $("#dlg-start");
const dlgEnd = $("#dlg-end");
$("#dlg-cancel")?.addEventListener("click", ()=> dateDialog.close());
$("#dlg-ok")?.addEventListener("click", onTripDialogOK);

function openTripDialog(prefillCity = "") {
  const today = todayStr();
  dlgCity.value = prefillCity || "";
  dlgStart.value = today;
  dlgEnd.value = addDays(today, 2);
  if (typeof dateDialog.showModal === "function") {
    dateDialog.showModal();
  } else {
    // 老浏览器 fallback
    dateDialog.setAttribute("open", "open");
  }
}
function onTripDialogOK() {
  const city = dlgCity.value.trim();
  const start = dlgStart.value;
  const end = dlgEnd.value;
  if (!city) { alert("请输入城市"); return; }
  if (!start || !end) { alert("请选择开始和结束日期"); return; }
  if (start > end) { alert("结束日期不能早于开始日期"); return; }

  db.trips.push({ id: uid(), city, start, end, checkIn:null, checkOut:null });
  saveDB(db); renderTrips(); renderAgenda();
  logSys(`已创建出差：${city} ${start}~${end}`);
  dateDialog.close();
}
// ------- 报销对话框逻辑 -------
const expenseDialog = document.querySelector("#expense-dialog");
const expItem = document.querySelector("#exp-item");
const expAmount = document.querySelector("#exp-amount");
const expCurrency = document.querySelector("#exp-currency");

document.querySelector("#exp-cancel")?.addEventListener("click", ()=> expenseDialog.close());
document.querySelector("#exp-ok")?.addEventListener("click", onExpenseOK);

function openExpenseDialog(prefillItem = "", prefillAmount = "", prefillCurr = "JPY") {
  expItem.value = (prefillItem || "").trim();
  expAmount.value = (prefillAmount || "").trim();
  expCurrency.value = (prefillCurr || "JPY").toUpperCase();
  if (typeof expenseDialog.showModal === "function") {
    expenseDialog.showModal();
  } else {
    expenseDialog.setAttribute("open", "open");
  }
}

function onExpenseOK() {
  const item = expItem.value.trim();
  const amountStr = expAmount.value.trim();
  const currency = expCurrency.value.toUpperCase();
  const amount = Number(amountStr);
  if (!item) { alert("请输入报销项目"); return; }
  if (!amountStr || isNaN(amount)) { alert("请输入正确金额"); return; }

  db.expenses.push({ id: uid(), item, amount, currency, time: new Date().toISOString() });
  saveDB(db);
  logSys(`已记录报销：${item} ${currency} ${amount}`);
  expenseDialog.close();
}

// ------- 删除某条出差 -------
function deleteTripById(id) {
  const before = db.trips.length;
  db.trips = db.trips.filter(t => t.id !== id);
  if (db.trips.length !== before) {
    saveDB(db);
    renderTrips();
    renderAgenda(); // 让今日日程和角色台词立即刷新
    logSys("已删除该出差记录（会议与报销保持不变）。");
  } else {
    logSys("未找到要删除的出差记录。");
  }
}

// ------- 命令处理 -------
function handleCommand(input) {
  const text = input.trim();
  if (!text) return;

  // 0) 出差（完整：城市+日期）
  let m = text.match(reTripFull);
  if (m) {
    const [_, city, start, end] = m;
    db.trips.push({ id: uid(), city, start, end, checkIn:null, checkOut:null });
    saveDB(db); renderTrips(); renderAgenda();
    logSys(`已创建出差：${city} ${start}~${end}`);
    return;
  }

  // 0') 出差（只有“出差”或“出差 城市” → 弹对话框）
  m = text.match(reTripCityOnly);
  if (m) {
    const cityMaybe = (m[1] || "").trim();
    openTripDialog(cityMaybe);
    logSys(cityMaybe ? `请在弹窗中选择 ${cityMaybe} 的开始/结束日期` : "请在弹窗中填写城市并选择开始/结束日期");
    return;
  }

  // 1) 入住
  m = text.match(reHotel);
  if (m) {
    const [_, cin, cout] = m;
    const trip = [...db.trips].sort((a,b)=>b.start.localeCompare(a.start))[0];
    if (trip) {
      trip.checkIn = cin; trip.checkOut = cout; trip._upd = Date.now();
      saveDB(db); renderTrips(); renderAgenda();
      logSys(`已登记酒店：${cin} → ${cout}`);
    } else {
      logSys(`没有找到出差，请先使用「出差」创建。`);
    }
    return;
  }

  // 2) 退房
  m = text.match(reCheckout);
  if (m) {
    const [_, cout] = m;
    const trip = [...db.trips].sort((a,b)=>b.start.localeCompare(a.start))[0];
    if (trip) {
      trip.checkOut = cout; trip._upd = Date.now();
      saveDB(db); renderTrips(); renderAgenda();
      logSys(`已更新退房为 ${cout}`);
    } else {
      logSys(`没有找到出差，请先创建。`);
    }
    return;
  }

  // 3) 会议
  m = text.match(reMeeting);
  if (m) {
    const [_, title, date, time] = m;
    db.meetings.push({ id: uid(), title, date, time });
    saveDB(db); renderAgenda();
    logSys(`已创建会议：${title} @ ${date} ${time}`);
    return;
  }

  // 报销（只弹窗；可从指令里预填项目/金额/币种）
    m = text.match(reExpenseAny);
    if (m) {
    const preItem = (m[1] || "").trim();
    const preAmount = (m[2] || "").trim();
    const preCurr = (m[3] || "JPY").toUpperCase();
    openExpenseDialog(preItem, preAmount, preCurr);

    const hintParts = [];
    if (preItem) hintParts.push(preItem);
    if (preAmount) hintParts.push(preAmount);
    if (m[3]) hintParts.push(preCurr);
    logSys(hintParts.length ? `请确认并提交：${hintParts.join(" / ")}` : "请在弹窗中填写项目、金额与币种");
    return;
    }


  // 5) 足迹
  if (text === "足迹") {
    const cities = [...new Set(db.trips.map(t=>t.city))];
    logSys(cities.length ? `已去城市：${cities.join("、")}` : "暂无足迹");
    return;
  }

  // 6) 清单（CSV）
  if (text === "清单") {
    const csv = exportCSV();
    downloadFile("biztrip.csv", csv, "text/csv;charset=utf-8");
    logSys("已导出 CSV。");
    return;
  }

  // 7) 日历（ICS）
  if (text === "日历") {
    const ics = exportICS();
    downloadFile("biztrip.ics", ics, "text/calendar;charset=utf-8");
    logSys("已导出 ICS。");
    return;
  }

  logSys("未识别指令。示例：出差 / 出差 城市 / 出差 城市 2025-09-25 到 2025-09-27 / 会议 标题 2025-09-26 10:00");
}

// ------- 导出 -------
function exportCSV() {
  const rows = [["Type","City","Start","End","CheckIn","CheckOut","MeetingTitle","MeetingDate","MeetingTime","ExpenseItem","Amount"]];
  db.trips.forEach(t=>rows.push(["Trip",t.city,t.start,t.end,t.checkIn||"",t.checkOut||"","","","", ""]));
  db.meetings.forEach(m=>rows.push(["Meeting","","","","","",m.title,m.date,m.time,"",""]));
  db.expenses.forEach(e=>rows.push(["Expense","","","","","","","","",e.item,String(e.amount)]));
  return rows.map(r=>r.map(x=>`"${(x??"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
}
function exportICS() {
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//BizTrip Web//CN"];
  db.trips.forEach(t=>{
    lines.push("BEGIN:VEVENT",`UID:${t.id}@biztrip`,
      `DTSTART:${t.start.replace(/-/g,"")}T090000`,
      `DTEND:${t.end.replace(/-/g,"")}T180000`,
      `SUMMARY:出差 - ${t.city}`,"END:VEVENT");
    if (t.checkIn) lines.push("BEGIN:VEVENT",`UID:${t.id}-hotel-in@biztrip`,
      `DTSTART:${t.checkIn.replace(/-/g,"")}T180000`,`SUMMARY:酒店入住`,"END:VEVENT");
    if (t.checkOut) lines.push("BEGIN:VEVENT",`UID:${t.id}-hotel-out@biztrip`,
      `DTSTART:${t.checkOut.replace(/-/g,"")}T090000`,`SUMMARY:酒店退房`,"END:VEVENT");
  });
  db.meetings.forEach(m=>{
    lines.push("BEGIN:VEVENT",`UID:${m.id}@biztrip`,
      `DTSTART:${m.date.replace(/-/g,"")}T${m.time.replace(":","")}00`,
      `SUMMARY:会议 - ${m.title}`,"END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\n");
}
function downloadFile(name, content, type) {
  const blob = new Blob([content], {type});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function askAI(text) {
  try {
    const resp = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: text }] })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.warn("AI 调用失败，使用本地规则：", e);
    return null;
  }
}
// ------- 绑定 UI -------
document.addEventListener("DOMContentLoaded", () => {
  renderTrips();
  renderAgenda();

  // 发送指令（先试 AI，失败/none 再回退本地规则）
  $("#bot-send").addEventListener("click", async () => {
    const input = $("#bot-text");
    const text = input.value;
    if (!text.trim()) return;
    logUser(text);

    try {
      const ai = await askAI(text);
      if (ai) {
        if (ai.chat_reply) logSys(ai.chat_reply);

        switch (ai.intent) {
          case "expense_add": {
            const s = ai.slots || {};
            openExpenseDialog(
              s.item || "",
              s.amount != null ? String(s.amount) : "",
              (s.currency || "JPY")
            );
            input.value = "";
            return;
          }
          case "trip_create": {
            const s = ai.slots || {};
            const preCity = s.city || "";
            openTripDialog(preCity);
            if (s.start) $("#dlg-start").value = s.start;
            if (s.end) $("#dlg-end").value = s.end;
            input.value = "";
            return;
          }
          case "hotel_checkin": {
            logSys("我来登记入住日期，请输入：入住 YYYY-MM-DD 到 YYYY-MM-DD");
            input.value = "";
            return;
          }
          case "hotel_checkout": {
            logSys("我来登记退房日期，请输入：退房 YYYY-MM-DD");
            input.value = "";
            return;
          }
          case "meeting_add": {
            const s = ai.slots || {};
            if (s.title && s.date && s.time) {
              db.meetings.push({ id: uid(), title: s.title, date: s.date, time: s.time });
              saveDB(db); renderAgenda();
              logSys(`已创建会议：${s.title} @ ${s.date} ${s.time}`);
            } else {
              logSys("需要更多信息（标题/日期/时间），你也可以这样说：明天10点客户A会议");
            }
            input.value = "";
            return;
          }
          case "smalltalk": {
            // 闲聊不触发功能
            input.value = "";
            return;
          }
          case "none":
          default:
            // 交由本地规则继续尝试
            break;
        }
      }
    } catch (e) {
      console.error("发送流程异常：", e);
      logSys("AI 暂时不可用，我先用本地规则来处理。");
    }

    // AI 不可用或 intent=none → 用本地规则兜底
    handleCommand(text);
    input.value = "";
  });

  // 回车发送
  $("#bot-text").addEventListener("keydown", (e)=>{
    if (e.key === "Enter") { $("#bot-send").click(); }
  });

  // （可选）行程列表删除按钮事件委托（如果有删除按钮）
  const tripList = document.querySelector("#trip-list");
  if (tripList) {
    tripList.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-del");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      if (!id) return;
      if (!confirm("确定删除这条出差记录吗？（会议与报销将保留）")) return;
      deleteTripById(id);
    });
  }
});

  
