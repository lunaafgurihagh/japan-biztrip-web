// /api/ai.js  —— Vercel Serverless Function
export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "Bad request" });
  
    // 用 Groq（免费额度，模型：Llama3.1-8B-Instruct）
    const apiKey = process.env.GROQAPIKEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GROQAPIKEY" });
  
    const systemPrompt = `
  你是一个NLU解析器，输出JSON，字段：intent, slots, chat_reply。
  intent 只能是：expense_add | trip_create | hotel_checkin | hotel_checkout | meeting_add | smalltalk | none
  slots 为对象，按需包含：
  - expense_add: item(string), amount(number), currency("JPY"|"USD"|"RMB")
  - trip_create: city(string), start("YYYY-MM-DD"), end("YYYY-MM-DD")
  - hotel_checkin: start("YYYY-MM-DD"), end("YYYY-MM-DD")
  - hotel_checkout: date("YYYY-MM-DD")
  - meeting_add: title(string), date("YYYY-MM-DD"), time("HH:mm")
  - 其它意图：可为空对象{}
  
  严格区分是否是“请求执行”。如果句子仅是感叹、抱怨、评述（如“这次需要报销的好多啊”“最近出差太累了”），intent=smalltalk 或 none，不要触发功能。
  
  例子：
  用户：“请给我报销，打车18.5美元”
  → {"intent":"expense_add","slots":{"item":"打车","amount":18.5,"currency":"USD"},"chat_reply":"好的，已为你准备报销表单。"}
  
  用户：“帮我记录东京出差，下周一到周三”
  → {"intent":"trip_create","slots":{"city":"东京","start":"<解析出的日期>","end":"<解析出的日期>"},"chat_reply":"收到，已为你准备行程录入。"}
  
  用户：“这次需要报销的好多啊”
  → {"intent":"smalltalk","slots":{},"chat_reply":"辛苦了！这次花销比较多，可以慢慢整理，我在这儿随时帮你。"}
  
  用户：“明天10点客户A会议”
  → {"intent":"meeting_add","slots":{"title":"客户A会议","date":"<解析>","time":"10:00"},"chat_reply":"好，我来为你登记会议。"}
  
  返回必须是严格JSON，不要多余文本、注释或代码块。
  `;
  
    // 调 Groq ChatCompletions
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instruct",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            ...messages
          ]
        })
      });
  
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ error: data });
      }
      const out = data.choices?.[0]?.message?.content || "{}";
      // 尝试解析
      let parsed;
      try { parsed = JSON.parse(out); } catch { parsed = { intent: "none", slots: {}, chat_reply: out }; }
      return res.status(200).json(parsed);
  
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }
  