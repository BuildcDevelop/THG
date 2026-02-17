import serverless from 'serverless-http';

let cachedHandler = null;

export const handler = async (event, context) => {
  if (!cachedHandler) {
    if (!process.env.NETLIFY) {
      process.env.NETLIFY = 'true';
    }
    const serverModule = await import('../../server/index.js');
    const resolvedApp =
      serverModule?.app ??
      serverModule?.default?.app ??
      serverModule?.default;

    if (!resolvedApp) {
      throw new Error('Express app export nebyl nalezen v server/index.js');
    }

    cachedHandler = serverless(resolvedApp, {
      basePath: '/.netlify/functions/api',
    });
  }

  return cachedHandler(event, context);
};
