import serverless from 'serverless-http';

let cachedHandler = null;
const defaultProductionProxyOrigin = 'https://thg.89-167-89-109.sslip.io';
const productionProxyOrigin = String(process.env.TLD_PRODUCTION_API_ORIGIN ?? defaultProductionProxyOrigin)
  .trim()
  .replace(/\/+$/, '');

const shouldProxyRemoteBackend = () =>
  Boolean(productionProxyOrigin) &&
  Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

const resolveApiPath = (event) => {
  const directPath = String(event?.path ?? '').trim();
  const rawUrlPath = (() => {
    try {
      const rawUrl = String(event?.rawUrl ?? '').trim();
      if (!rawUrl) {
        return '';
      }
      return String(new URL(rawUrl).pathname ?? '').trim();
    } catch {
      return '';
    }
  })();
  const sourcePath = rawUrlPath || directPath;

  if (!sourcePath) {
    return '/api';
  }

  if (sourcePath === '/api' || sourcePath.startsWith('/api/')) {
    return sourcePath;
  }

  const marker = '/api/';
  const markerIndex = sourcePath.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return sourcePath.slice(markerIndex);
  }

  if (sourcePath.endsWith('/api')) {
    return '/api';
  }

  return '/api';
};

const resolveQuerySuffix = (event) => {
  const rawQuery = String(event?.rawQuery ?? '').trim();
  if (rawQuery) {
    return `?${rawQuery}`;
  }

  const params = new URLSearchParams();
  const multiParams = event?.multiValueQueryStringParameters;
  if (multiParams && typeof multiParams === 'object') {
    for (const [key, values] of Object.entries(multiParams)) {
      if (!Array.isArray(values)) {
        continue;
      }
      for (const value of values) {
        if (value == null) {
          continue;
        }
        params.append(String(key), String(value));
      }
    }
  } else {
    const singleParams = event?.queryStringParameters;
    if (singleParams && typeof singleParams === 'object') {
      for (const [key, value] of Object.entries(singleParams)) {
        if (value == null) {
          continue;
        }
        params.append(String(key), String(value));
      }
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
};

const toForwardHeaders = (headers) => {
  const normalized = {};
  if (headers && typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      if (value == null) {
        continue;
      }
      const lowerKey = String(key).toLowerCase();
      if (
        lowerKey === 'host' ||
        lowerKey === 'connection' ||
        lowerKey === 'content-length' ||
        lowerKey === 'x-forwarded-for' ||
        lowerKey === 'x-forwarded-proto' ||
        lowerKey === 'x-forwarded-port'
      ) {
        continue;
      }
      normalized[key] = String(value);
    }
  }
  return normalized;
};

const proxyToProductionBackend = async (event) => {
  const apiPath = resolveApiPath(event);
  const querySuffix = resolveQuerySuffix(event);
  const method = String(event?.httpMethod ?? 'GET').trim().toUpperCase() || 'GET';
  const targetUrl = `${productionProxyOrigin}${apiPath}${querySuffix}`;
  const headers = toForwardHeaders(event?.headers);
  const init = {
    method,
    headers,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(method) && event?.body != null) {
    init.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
  }

  const response = await fetch(targetUrl, init);
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    const lowerKey = String(key).toLowerCase();
    if (lowerKey === 'transfer-encoding' || lowerKey === 'content-length' || lowerKey === 'connection') {
      return;
    }
    responseHeaders[key] = value;
  });

  const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
  const isTextPayload =
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('javascript') ||
    contentType.includes('xml') ||
    contentType.includes('x-www-form-urlencoded') ||
    contentType.includes('svg');
  const bodyBuffer = Buffer.from(await response.arrayBuffer());

  return {
    statusCode: response.status,
    headers: responseHeaders,
    body: isTextPayload ? bodyBuffer.toString('utf8') : bodyBuffer.toString('base64'),
    isBase64Encoded: !isTextPayload,
  };
};

const resolveExpressApp = async () => {
  const { app, default: defaultExport } = await import('../../server/index.js');
  const resolvedApp = app ?? defaultExport?.app ?? defaultExport ?? null;

  if (!resolvedApp) {
    throw new Error('Express app export nebyl nalezen v server/index.js');
  }

  return resolvedApp;
};

export const handler = async (event, context) => {
  if (shouldProxyRemoteBackend()) {
    return proxyToProductionBackend(event);
  }

  if (!cachedHandler) {
    if (!process.env.NETLIFY) {
      process.env.NETLIFY = 'true';
    }
    const resolvedApp = await resolveExpressApp();
    cachedHandler = serverless(resolvedApp, {
      basePath: '/.netlify/functions/api',
    });
  }

  return cachedHandler(event, context);
};
