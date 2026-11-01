// A small stand-in for Supabase Auth and PostgREST, enough to exercise the real client code,
// the revision rule from the migration, and row ownership. It does not replace docs/SETUP.md's
// live checks: real RLS and Storage can only be proven against a real project.
import { createServer } from 'node:http';

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'me@example.com',
};
const PASSWORD = 'correct horse battery';
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.sig`;
let row = null;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...cors });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
function respondRows(req, res, rows, status = 200) {
  if ((req.headers.accept ?? '').includes('vnd.pgrst.object')) {
    if (rows.length !== 1)
      return send(res, 406, {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
        details: '',
        hint: '',
      });
    return send(res, status, rows[0]);
  }
  return send(res, status, rows);
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
  if (req.method === 'OPTIONS') return send(res, 200);
  if (url.pathname === '/__reset') {
    row = null;
    return send(res, 200, {});
  }
  if (url.pathname === '/__row') return send(res, 200, row);

  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'password' && body.password !== PASSWORD)
      return send(res, 400, {
        code: 'invalid_credentials',
        error_code: 'invalid_credentials',
        msg: 'Invalid login credentials',
      });
    return send(res, 200, {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 4102444800,
      refresh_token: 'refresh',
      user: USER,
    });
  }
  if (url.pathname === '/auth/v1/user') {
    if (!(req.headers.authorization ?? '').includes(token))
      return send(res, 401, { code: 401, msg: 'no session' });
    return send(res, 200, USER);
  }
  if (url.pathname === '/auth/v1/logout') return send(res, 204);

  if (url.pathname === '/rest/v1/workspaces') {
    if (!(req.headers.authorization ?? '').includes(token))
      return send(res, 401, { code: '42501', message: 'permission denied' });
    const project = value => {
      const columns = (url.searchParams.get('select') ?? '*').split(',');
      return columns[0] === '*' ? value : Object.fromEntries(columns.map(column => [column, value[column]]));
    };
    if (req.method === 'GET') return respondRows(req, res, row ? [project(row)] : []);
    if (req.method === 'POST') {
      if (row) return send(res, 409, { code: '23505', message: 'duplicate key' });
      row = { user_id: body.user_id, document: body.document, revision: body.revision };
      return respondRows(req, res, [project(row)], 201);
    }
    if (req.method === 'PATCH') {
      const expected = Number(url.searchParams.get('revision')?.replace('eq.', ''));
      if (!row || row.revision !== expected) return respondRows(req, res, []);
      if (body.revision !== row.revision + 1)
        return send(res, 400, { code: 'P0001', message: 'Workspace revision must increase by exactly one' });
      row = { ...row, document: body.document, revision: body.revision };
      return respondRows(req, res, [project(row)]);
    }
  }
  return send(res, 404, { message: `No mock for ${req.method} ${url.pathname}` });
}).listen(54399);
