const express = require('express');
const path = require('path');
const app = express();
app.use(express.json({limit:'3mb'}));
app.use(express.static(path.join(__dirname,'public')));

app.get('/api/health',(req,res)=>res.json({ok:true,gemini:Boolean(process.env.GEMINI_API_KEY)}));

app.post('/api/gemini', async (req,res)=>{
  try{
    const key = process.env.GEMINI_API_KEY;
    if(!key) return res.status(503).json({error:'伺服器尚未設定 GEMINI_API_KEY'});
    const {message, plants=[], scannedPlantId=null, recentLogs=[], history=[]} = req.body || {};
    if(!message || typeof message !== 'string') return res.status(400).json({error:'缺少訊息'});
    if(plants.length > 1000) return res.status(400).json({error:'植物資料過多'});
    const selected = scannedPlantId ? plants.find(p=>p.id===scannedPlantId) : null;
    const system = `你是「Gemini 植物管家」，使用繁體中文回答。\n`+
      `你可以回答一般植物照護問題，也可以查詢使用者提供的植物管理資料。\n`+
      `規則：\n1. 涉及「目前有幾株、位置、價格、狀態、最近澆水、母株」等帳戶資料時，只能依下方提供的資料回答，不可編造。\n`+
      `2. 若已掃描 QR，使用者說「它、這株」時，優先指已掃描植物。\n`+
      `3. 不要聲稱你已修改網站資料。若使用者要修改資料，請告訴他可使用網站的「快速紀錄」並確認寫入。\n`+
      `4. 回答簡潔、實用。日期今天為 ${new Date().toISOString().slice(0,10)}。\n`+
      `已掃描植物：${JSON.stringify(selected)}\n植物資料：${JSON.stringify(plants)}\n最近照顧紀錄：${JSON.stringify(recentLogs)}`;
    const contents = [
      {role:'user',parts:[{text:system}]},
      {role:'model',parts:[{text:'了解。我會依植物資料回答，若資料沒有提供就明確說不知道。'}]},
      ...history.slice(-8).map(h=>({role:h.role==='assistant'?'model':'user',parts:[{text:String(h.text||'')}]})),
      {role:'user',parts:[{text:message}]}
    ];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`;
    const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents,generationConfig:{temperature:0.3,maxOutputTokens:1200}})});
    const data = await response.json();
    if(!response.ok) return res.status(response.status).json({error:data?.error?.message || 'Gemini API request failed'});
    const text = (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
    res.json({text:text||'Gemini 沒有回傳文字。'});
  }catch(err){console.error(err);res.status(500).json({error:'伺服器錯誤：'+err.message});}
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Plant Management running on ${PORT}`));
