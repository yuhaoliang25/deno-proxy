const TARGET_HOST = "www.googleapis.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 1. 构造目标 Google API 的完整 URL
    const targetUrl = new URL(url.pathname + url.search, `https://${TARGET_HOST}`);

    // 2. 复制并过滤请求头
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      // 过滤掉容易引起 CDN 冲突或代理错误的 HTTP 协议头
      if (["host", "connection", "keep-alive"].includes(key.toLowerCase())) {
        continue;
      }
      headers.set(key, value);
    }

    // 3. 构造转发请求配置
    const fetchOptions = {
      method: request.method,
      headers: headers,
      // 只有非 GET/HEAD 请求才需要传递 request body 流
      body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
    };

    try {
      // 4. 流式请求 Google APIs
      const googleResponse = await fetch(targetUrl.toString(), fetchOptions);

      // 5. 复制响应头，确保 Content-Length 和下载文件名透传
      const responseHeaders = new Headers();
      for (const [key, value] of googleResponse.headers.entries()) {
        if (key.toLowerCase() === "transfer-encoding") {
          continue; // 让 Deno 运行时自行管理分块传输
        }
        responseHeaders.set(key, value);
      }

      // 允许跨域（方便任意客户端或前端直接调用，可按需修改）
      responseHeaders.set("access-control-allow-origin", "*");
      responseHeaders.set("access-control-allow-headers", "*");

      // 6. 将 Google 的响应 Body (ReadableStream) 原封不动流式返回给客户端
      return new Response(googleResponse.body, {
        status: googleResponse.status,
        statusText: googleResponse.statusText,
        headers: responseHeaders,
      });

    } catch (error) {
      console.error("Deno Deploy Proxy Error:", error);
      return new Response(`Proxy Error: ${error.message}`, { status: 502 });
    }
  }
};
