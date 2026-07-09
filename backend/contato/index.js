const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { randomUUID } = require('crypto');

const dynamo = new DynamoDBClient();
const ses = new SESClient();

const TABLE_NAME = process.env.TABLE_NAME;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SITE_DOMAIN = process.env.SITE_DOMAIN;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': SITE_DOMAIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    // Validação
    const { nome, email, mensagem } = body;
    if (!nome || !email || !mensagem) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Campos obrigatórios: nome, email, mensagem' }),
      };
    }

    if (!email.includes('@') || email.length < 5) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'E-mail inválido' }),
      };
    }

    const id = randomUUID();
    const timestamp = new Date().toISOString();

    // Salvar no DynamoDB
    await dynamo.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id: { S: id },
        nome: { S: nome },
        email: { S: email },
        mensagem: { S: mensagem },
        criadoEm: { S: timestamp },
      },
    }));

    // Enviar e-mail de notificação
    try {
      await ses.send(new SendEmailCommand({
        Source: ADMIN_EMAIL,
        Destination: { ToAddresses: [ADMIN_EMAIL] },
        ReplyToAddresses: [email],
        Message: {
          Subject: { Data: `Contato pelo site - ${nome}` },
          Body: {
            Text: {
              Data: [
                `Nova mensagem de contato recebida pelo site:`,
                ``,
                `Nome: ${nome}`,
                `E-mail: ${email}`,
                ``,
                `Mensagem:`,
                mensagem,
                ``,
                `Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
                `ID: ${id}`,
              ].join('\n'),
            },
          },
        },
      }));
    } catch (emailErr) {
      console.warn('Falha ao enviar e-mail (SES):', emailErr.message);
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ message: 'Mensagem enviada com sucesso', id }),
    };
  } catch (err) {
    console.error('Erro:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
    };
  }
};
