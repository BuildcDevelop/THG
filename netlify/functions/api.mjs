import serverless from 'serverless-http';

let cachedHandler = null;

const resolveExpressApp = async () => {
  const { app, default: defaultExport } = await import('../../server/index.js');
  const resolvedApp = app ?? defaultExport?.app ?? defaultExport ?? null;

  if (!resolvedApp) {
    throw new Error('Express app export nebyl nalezen v server/index.js');
  }

  return resolvedApp;
};

export const handler = async (event, context) => {
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
