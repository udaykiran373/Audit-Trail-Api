using Audit.Api.Supervisors;
using Audit.Api.Repositories;
using Audit.Api.Configuration;
using Audit.Api.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// Configure MongoDB Settings options
builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDbSettings"));

// Register Layered components
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddSingleton<IAuditLogRepository, MongoAuditLogRepository>();
builder.Services.AddSingleton<IPostRepository, MongoPostRepository>();
builder.Services.AddSingleton<IResumeRepository, MongoResumeRepository>();
builder.Services.AddSingleton<IAssessmentRepository, MongoAssessmentRepository>();

builder.Services.AddScoped<IAuditLoggingSupervisor, AuditLoggingSupervisor>();
builder.Services.AddScoped<IAuditLogQueriesSupervisor, AuditLogQueriesSupervisor>();
builder.Services.AddScoped<IPostSupervisor, PostSupervisor>();
builder.Services.AddScoped<IResumeSupervisor, ResumeSupervisor>();
builder.Services.AddScoped<IAssessmentSupervisor, AssessmentSupervisor>();
builder.Services.AddScoped<Audit.Api.Services.IAiInterviewService, Audit.Api.Services.AiInterviewService>();
// Add API Controllers services and enforce camelCase JSON for frontend compatibility
builder.Services.AddControllers().AddJsonOptions(opts =>
{
    opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

// Enable CORS for frontend integration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .WithExposedHeaders("X-Correlation-ID");
    });
});

var app = builder.Build();

// Enable CORS
app.UseCors("AllowAll");

// Serve static uploads
app.UseStaticFiles();

// Attach tracing and logging middlewares
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<AuditLoggingMiddleware>();

app.UseHttpsRedirection();

app.MapControllers();

app.Run();
