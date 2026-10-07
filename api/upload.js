// 手机端上传音频 -> 调讯飞语音评测(ISE) -> 结果写入 Vercel Blob 供大屏轮询
// 音频格式: 16kHz 16bit 单声道裸PCM(无WAV头), 由前端重采样后上传
const crypto = require('crypto');
const WebSocket = require('ws');
const { put, list } = require('@vercel/blob');

module.exports.config = { api: { bodyParser: false } };

// 评测参考文本:《陈太丘与友期行》全文(刘义庆《世说新语》)
const TEXT = '陈太丘与友期行，期日中。过中不至，太丘舍去，去后乃至。元方时年七岁，门外戏。客问元方："尊君在不？"答曰："待君久不至，已去。"友人便怒曰："非人哉！与人期行，相委而去。"元方曰："君与家君期日中。日中不至，则是无信；对子骂父，则是无礼。"友人惭，下车引之。元方入门不顾。';

// 构造讯飞 ISE WebSocket 鉴权地址 (HMAC-SHA256 签名, 已实测通过)
function buildAuthUrl() {
  const host = 'ise-api.xfyun.cn';
  const path = '/v2/open-ise';
  const date = new Date().toUTCString();
  const signatureOrigin = 'host: ' + host + '\ndate: ' + date + '\nGET ' + path + ' HTTP/1.1';
  const signature = crypto.createHmac('sha256', process.env.XF_API_SECRET).update(signatureOrigin).digest('base64');
  const authorizationOrigin = 'api_key="' + process.env.XF_API_KEY + '", algorithm="hmac-sha256", headers="host date request-line", signature="' + signature + '"';
  const authorization = Buffer.from(authorizationOrigin).toString('base64');
  return 'wss://' + host + path + '?authorization=' + encodeURIComponent(authorization) + '&date=' + encodeURIComponent(date) + '&host=' + host;
}

// 调讯飞 ISE: 分帧发送音频, 收集返回XML
function evaluateISE(pcmBuf) {
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(buildAuthUrl()); } catch (e) { reject(e); return; }
    const timer = setTimeout(() => { try { ws.terminate(); } catch (e) {} reject(new Error('评测超时(55秒)')); }, 55000);
    let xml = '';
    let idx = 0;
    const CHUNK = 8000; // 每帧8000字节
    const send = (o) => ws.send(JSON.stringify(o));

    ws.on('open', () => {
      // 第一帧: 发送评测参数(ssb), 协议已实测
      send({
        common: { app_id: process.env.XF_APPID },
        business: {
          sub: 'ise', ent: 'cn_vip', category: 'read_chapter', cmd: 'ssb',
          text: '\uFEFF' + TEXT, tte: 'utf-8', ttp_skip: true,
          auf: 'audio/L16;rate=16000', aue: 'raw', group: 'youth', rstcd: 'utf8'
        },
        data: { status: 0 }
      });
      // 分帧发送音频(auw): 音频字段名为 data, data_type 必须为整数 1
      const pump = () => {
        if (idx >= pcmBuf.length) return;
        const end = Math.min(idx + CHUNK, pcmBuf.length);
        const slice = pcmBuf.subarray(idx, end);
        const isLast = end >= pcmBuf.length;
        send({
          business: { cmd: 'auw', aus: idx === 0 ? 1 : (isLast ? 4 : 2) },
          data: { status: isLast ? 2 : 1, data: slice.toString('base64'), data_type: 1, encoding: 'raw' }
        });
        idx = end;
        if (idx < pcmBuf.length) setTimeout(pump, 25); // 限速避免限流
      };
      pump();
    });

    ws.on('message', (m) => {
      let j;
      try { j = JSON.parse(m); } catch (e) { return; }
      if (j.code && j.code !== 0) {
        clearTimeout(timer);
        try { ws.close(); } catch (e) {}
        reject(new Error('讯飞接口错误 code=' + j.code + ' ' + (j.message || '')));
        return;
      }
      if (j.data && j.data.data) xml += Buffer.from(j.data.data, 'base64').toString('utf8');
      if (j.data && j.data.status === 2) {
        clearTimeout(timer);
        try { ws.close(); } catch (e) {}
        resolve(parseResultXml(xml));
      }
    });

    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// 解析讯飞返回的评测XML, 提取三维度分数与问题清单
function parseResultXml(xml) {
  const num = (name) => {
    const m = xml.match(new RegExp(name + '="(-?[\\d.]+)"'));
    return m ? parseFloat(m[1]) : null;
  };
  // 计数语音错误类型(dp_message: 16=漏读 32=增读 64=回读 128=替换)
  const countDp = (v) => (xml.match(new RegExp('dp_message="' + v + '"', 'g')) || []).length;

  // 中文篇章题型实测字段: accuracy_score(准确度)/phone_score(声韵)/fluency_score(流利)/integrity_score(完整)/tone_score(声调)/total_score(总分)
  const accuracyRaw = num('accuracy_score') != null ? num('accuracy_score')
    : (num('phone_score') != null ? num('phone_score') : num('total_score'));
  const accuracy = round100(accuracyRaw);
  const fluency = num('fluency_score');         // 流利度
  const integrity = num('integrity_score');     // 完整度
  const tone = num('tone_score');               // 声调
  const totalScore = num('total_score');        // 总分
  const issues = [];
  const missed = countDp('16'), extra = countDp('32'), back = countDp('64'), replaced = countDp('128');
  if (integrity != null && integrity < 100) issues.push('完整度 ' + integrity.toFixed(0) + '%，有漏读现象');
  if (missed) issues.push('漏读 ' + missed + ' 处');
  if (extra) issues.push('增读 ' + extra + ' 处');
  if (back) issues.push('回读 ' + back + ' 处');
  if (replaced) issues.push('读错字 ' + replaced + ' 处');
  if (tone != null && tone < 80) issues.push('声调得分 ' + tone.toFixed(0) + '，注意字调到位');
  if (!issues.length) issues.push('朗读完整流利，继续保持！');

  return {
    accuracy: accuracy,                      // 准确度 0-100
    fluency: round100(fluency),              // 流利度 0-100
    integrity: round100(integrity),          // 完整度 0-100
    tone: round100(tone),
    total: round100(totalScore),
    issues: issues,
    time: Date.now(),
    debug: xml.length > 400 ? xml.slice(0, 400) : xml  // 保留片段便于排错
  };
}

function round100(v) { return v == null ? null : Math.round(v * 10) / 10; }

// 读取房间已有结果
async function readState(room) {
  const res = await list({ prefix: 'rooms/' + room + '.json' });
  if (!res.blobs.length) return { results: [] };
  const r = await fetch(res.blobs[0].url, { cache: 'no-store' });
  if (!r.ok) return { results: [] };
  try { const j = await r.json(); return (j && j.results) ? j : { results: [] }; } catch (e) { return { results: [] }; }
}

module.exports = async (req, res) => {
  const room = (req.query.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!room) { res.status(400).json({ ok: false, error: '缺少房间号' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: '仅支持POST' }); return; }
  if (!process.env.XF_APPID || !process.env.XF_API_KEY || !process.env.XF_API_SECRET) {
    res.status(500).json({ ok: false, error: '讯飞密钥未配置，请在Vercel环境变量中填写 XF_APPID / XF_API_KEY / XF_API_SECRET' });
    return;
  }

  // 收集原始请求体(裸PCM)
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const pcm = Buffer.concat(chunks);
  if (pcm.length < 16000) { res.status(400).json({ ok: false, error: '音频太短或为空，请重新录音' }); return; }
  if (pcm.length > 4 * 1024 * 1024) { res.status(400).json({ ok: false, error: '音频超过60秒上限' }); return; }

  try {
    const scores = await evaluateISE(pcm);
    const state = await readState(room);
    state.results.push(scores);
    if (state.results.length > 2) state.results = state.results.slice(-2); // 只保留最近两次
    await put('rooms/' + room + '.json', JSON.stringify(state), { access: 'public', addRandomSuffix: false });
    res.status(200).json({ ok: true, result: scores });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
