const { DynamoDBClient, ScanCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const dynamo = new DynamoDBClient();
const ssm = new SSMClient();

const INSCRICOES_TABLE = process.env.INSCRICOES_TABLE;
const CONTATOS_TABLE = process.env.CONTATOS_TABLE;
const SITE_DOMAIN = process.env.SITE_DOMAIN;
const SSM_PREFIX = process.env.SSM_PREFIX || '/gelcip';
const ADMIN_USER = 'gelcip';

// Cache de parâmetros SSM (evita chamadas repetidas)
let cachedPasswordHash = null;
let cachedJwtSecret = null;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': SITE_DOMAIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

const response = (statusCode, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

async function getSSMParam(name) {
  const result = await ssm.send(new GetParameterCommand({
    Name: name,
    WithDecryption: true,
  }));
  return result.Parameter.Value;
}

async function getPasswordHash() {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await getSSMParam(`${SSM_PREFIX}/admin-password-hash`);
  }
  return cachedPasswordHash;
}

async function getJwtSecret() {
  if (!cachedJwtSecret) {
    cachedJwtSecret = await getSSMParam(`${SSM_PREFIX}/jwt-secret`);
  }
  return cachedJwtSecret;
}

function verifyToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  try {
    return jwt.verify(token, cachedJwtSecret || '');
  } catch {
    return null;
  }
}

// POST /admin/login
async function handleLogin(body) {
  const { usuario, senha } = body;

  if (!usuario || !senha) {
    return response(400, { error: 'Informe usuário e senha' });
  }

  if (usuario !== ADMIN_USER) {
    return response(401, { error: 'Credenciais inválidas' });
  }

  const hash = await getPasswordHash();
  const valid = await bcrypt.compare(senha, hash);

  if (!valid) {
    return response(401, { error: 'Credenciais inválidas' });
  }

  const secret = await getJwtSecret();
  const token = jwt.sign(
    { sub: usuario, role: 'admin' },
    secret,
    { expiresIn: '8h' }
  );

  return response(200, { token, expiresIn: '8h' });
}

// GET /admin/inscricoes
async function handleListInscricoes() {
  const result = await dynamo.send(new ScanCommand({ TableName: INSCRICOES_TABLE }));
  const items = (result.Items || []).map(item => ({
    id: item.id?.S,
    curso: item.curso?.S,
    nome: item.nome?.S,
    email: item.email?.S,
    telefone: item.telefone?.S,
    periodo: item.periodo?.S,
    observacoes: item.observacoes?.S,
    criadoEm: item.criadoEm?.S,
  }));

  items.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  return response(200, { items, total: items.length });
}

// GET /admin/contatos
async function handleListContatos() {
  const result = await dynamo.send(new ScanCommand({ TableName: CONTATOS_TABLE }));
  const items = (result.Items || []).map(item => ({
    id: item.id?.S,
    nome: item.nome?.S,
    email: item.email?.S,
    mensagem: item.mensagem?.S,
    criadoEm: item.criadoEm?.S,
  }));

  items.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  return response(200, { items, total: items.length });
}

// DELETE /admin/inscricoes/{id}
async function handleDeleteInscricao(id) {
  await dynamo.send(new DeleteItemCommand({
    TableName: INSCRICOES_TABLE,
    Key: { id: { S: id } },
  }));
  return response(200, { message: 'Inscrição removida' });
}

// DELETE /admin/contatos/{id}
async function handleDeleteContato(id) {
  await dynamo.send(new DeleteItemCommand({
    TableName: CONTATOS_TABLE,
    Key: { id: { S: id } },
  }));
  return response(200, { message: 'Contato removido' });
}

exports.handler = async (event) => {
  const { httpMethod, path, pathParameters } = event;

  // CORS preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Login não precisa de token
  if (httpMethod === 'POST' && path.endsWith('/admin/login')) {
    try {
      const body = JSON.parse(event.body || '{}');
      return await handleLogin(body);
    } catch (err) {
      console.error('Login error:', err);
      return response(500, { error: 'Erro interno' });
    }
  }

  // Todas as outras rotas precisam de autenticação
  // Garantir que o secret está carregado para verificação
  await getJwtSecret();
  const user = verifyToken(event);
  if (!user) {
    return response(401, { error: 'Token inválido ou expirado. Faça login novamente.' });
  }

  try {
    // GET /admin/inscricoes
    if (httpMethod === 'GET' && path.endsWith('/admin/inscricoes')) {
      return await handleListInscricoes();
    }

    // GET /admin/contatos
    if (httpMethod === 'GET' && path.endsWith('/admin/contatos')) {
      return await handleListContatos();
    }

    // DELETE /admin/inscricoes/{id}
    if (httpMethod === 'DELETE' && path.includes('/admin/inscricoes/')) {
      const id = pathParameters?.id || path.split('/').pop();
      return await handleDeleteInscricao(id);
    }

    // DELETE /admin/contatos/{id}
    if (httpMethod === 'DELETE' && path.includes('/admin/contatos/')) {
      const id = pathParameters?.id || path.split('/').pop();
      return await handleDeleteContato(id);
    }

    return response(404, { error: 'Rota não encontrada' });
  } catch (err) {
    console.error('Error:', err);
    return response(500, { error: 'Erro interno' });
  }
};
