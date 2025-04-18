const morgan = require("morgan");
const { logger } = require("../services");

const morganMiddleware = morgan(
  function (tokens, req, res) {
    const ip = tokens["remote-addr"](req, res);
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const status = tokens.status(req, res);
    const contentLength = tokens.res(req, res, "content-length");
    const responseTime = tokens["response-time"](req, res);
    const id = req.id;
    const query = req.query;
    const userId = req.user ? req.user.id : "Unauthenticated";
    const headers = req.headers;
    const requestBody = req.body; // Be sure to sanitize sensitive data
    const requestHeaders = req.headers;
    const responseHeaders = res.getHeaders();
    const timestamp = new Date().toISOString();
    const referer = tokens.referrer(req, res);
    const httpVersion = tokens["http-version"](req, res);
    const rateLimitTotal = res.get("X-RateLimit-Limit");
    const rateLimitRemaining = res.get("X-RateLimit-Remaining");
    const errorStack = res.error;
    const reqResponse = res.response;

    return JSON.stringify({
      method,
      url,
      timestamp,
      requestID: id,
      responseID: res.get("X-Request-ID"),
      ip,
      status: Number(status),
      contentLength,
      responseTime,
      query,
      userId,
      headers,
      requestBody,
      requestHeaders,
      responseHeaders,
      referer,
      httpVersion,
      rateLimitTotal,
      rateLimitRemaining,
      errorStack,
      reqResponse,
    });
  },
  {
    stream: {
      write: (message) => {
        const { method, url, status, responseTime } = JSON.parse(message);
        logger.http(`${method} ${status} ${url} ${responseTime}`, {
          metadata: JSON.parse(message),
        });
      },
    },
  },
);

module.exports = morganMiddleware;
