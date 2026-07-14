import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const TARGET_HOST = "www.googleapis.com";

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // 1. 构建目标 Google API 的完整 URL
  const targetUrl = new URL(url.pathname + url.search, `https://${TARGET_HOST}`);

  // 2. 过滤并复制客户端发送的 Headers
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    // 忽略特定于代理服务器或导致 CDN 冲突的 Header
    if (["host", "connection", "keep-alive"].includes(key.toLowerCase())) {
      continue;
    }
    headers.set(key, value);
  }

  // 确保 Authorization (Bearer Token) 正常传递
  // 如果客户端发了，上面的循环已经自动带上。这里可以做个安全检查或日志（可选）

  // 3. 构建转发给 Google 的配置
  const fetchOptions: RequestInit = {
    method: request.method,
    headers: headers,
    // 对于 GET/HEAD 请求，body 必须为 null
    body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
  };

  try {
    // 4. 发起流式请求到 Google APIs
    const googleResponse = await fetch(targetUrl.toString(), fetchOptions);

    // 5. 复制 Google 返回的 Headers，确保 Content-Length 和 Content-Disposition 正确
    const responseHeaders = new Headers();
    for (const [key, value] of googleResponse.headers.entries()) {
      // 避免重复定义传输编码，让 Deno 的 HTTP 运行环境自行处理 Chunked 传输
      if (key.toLowerCase() === "transfer-encoding") {
        continue;
      }
      responseHeaders.set(key, value);
    }

    // 允许跨域（方便浏览器端或特定客户端直接调用，可按需修改）
    responseHeaders.set("access-control-allow-origin", "*");
    responseHeaders.set("access-control-allow-headers", "*");

    // 6. 将 Google 的响应 Body (ReadableStream) 原封不动返回给用户
    return new Response(googleResponse.body, {
      status: googleResponse.status,
      statusText: googleResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(`Proxy Error: ${error.message}`, { status: 502 });
  }
}

// 启动 Deno HTTP 服务
serve(handleRequest);
