// Trang nguồn imclaude-tienganh: lấy tệp từ kho mã công khai trên GitHub và trả về dưới tên miền trung tính.
const RAW = 'https://raw.githubusercontent.com/vilaxsontra/imclaude-tienganh/main/';
const CT = { html: 'text/html; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8' };
export default {
  async fetch(req) {
    const u = new URL(req.url); let p = u.pathname;
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('', { status: 405 });
    if (p === '/' || p === '/index.html') p = 'trang/index.html';
    else if (/^\/([a-f0-9]{8}\/)?[A-Za-z0-9_.-]+\.(json|txt)$/.test(p)) p = 'nguon' + p;
    else return new Response('Không có', { status: 404 });
    const r = await fetch(RAW + p, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) return new Response('Không có', { status: 404 });
    return new Response(r.body, { headers: { 'content-type': CT[p.split('.').pop()] || CT.txt, 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=600' } });
  },
};
