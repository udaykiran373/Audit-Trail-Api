using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Audit.Api.Middleware;

public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;
    public const string CorrelationIdHeaderKey = "X-Correlation-ID";

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue(CorrelationIdHeaderKey, out var correlationId) || 
            string.IsNullOrWhiteSpace(correlationId))
        {
            correlationId = Guid.NewGuid().ToString();
        }

        context.Items[CorrelationIdHeaderKey] = correlationId.ToString();
        
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[CorrelationIdHeaderKey] = correlationId.ToString();
            return Task.CompletedTask;
        });

        await _next(context);
    }
}
