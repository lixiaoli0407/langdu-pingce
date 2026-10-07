// 大屏端轮询: 读取房间最新评测结果
const { list } = require('@vercel/blob');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const room = (req.query.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!room) { res.status(400).json({ results: [], error: '缺少房间号' }); return; }
  try {
    const blobs = await list({ prefix: 'rooms/' + room + '.json' });
    if (!blobs.blobs.length) { res.status(200).json({ results: [] }); return; }
    const r = await fetch(blobs.blobs[0].url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) { res.status(200).json({ results: [] }); return; }
    const j = await r.json();
    res.status(200).json(j && j.results ? j : { results: [] });
  } catch (e) {
    res.status(200).json({ results: [], error: String(e.message || e) });
  }
};
