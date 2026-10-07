// 大屏端"清空重来": 重置房间评测记录
const { put } = require('@vercel/blob');

module.exports = async (req, res) => {
  const room = (req.query.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!room) { res.status(400).json({ ok: false, error: '缺少房间号' }); return; }
  try {
    await put('rooms/' + room + '.json', JSON.stringify({ results: [] }), { access: 'public', addRandomSuffix: false });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
