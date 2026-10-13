using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace Audit.Api.Services;

/// <summary>
/// Represents the extracted search filters from a natural language query.
/// </summary>
public class NlpParsedFilters
{
    public string? Module { get; set; }
    public string? EventType { get; set; }
    public string? Status { get; set; }
    public string? Action { get; set; }
    public string? UserId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}

/// <summary>
/// Parses natural language queries using the Groq API and extracts audit log filters.
/// </summary>
public class NlpQueryParser
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    /// <summary>
    /// Initializes a new instance of the NlpQueryParser class.
    /// </summary>
    /// <param name="httpClient">The HTTP client used for requests.</param>
    /// <param name="config">The configuration properties.</param>
    public NlpQueryParser(
        HttpClient httpClient,
        IConfiguration config)
    {
        _httpClient = httpClient;

        _apiKey = config["Groq:ApiKey"]
            ?? throw new InvalidOperationException(
                "Groq API key is not configured.");
    }

    /// <summary>
    /// Sends a natural language query to the Groq API and parses the response into search filters.
    /// </summary>
    /// <param name="userInput">The natural language query provided by the user.</param>
    /// <returns>A task that represents the asynchronous operation, returning the extracted filter data.</returns>
    public async Task<NlpParsedFilters> ParseNaturalLanguageAsync(
        string userInput)
    {
        string todayDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
        // Define the prompt instructing the LLM to output valid JSON matching NlpParsedFilters structure
        var rawPrompt = """
        You are an audit log search parser. 
        Convert the user's natural language query into search filters.
        
        CRITICAL: The current system date is TODAY_DATE. Use this to calculate relative dates like "today", "yesterday", or "last week".

        Return ONLY valid JSON. Do not use markdown. Do not add explanations.
        The JSON must contain exactly these fields: Module, EventType, Status, UserId.

        CRITICAL SCHEMA RULES:
        You must map user intents ONLY to the following exact EventTypes and Modules. 
        If the user asks for a broad category, set EventType and leave Module as null.
        - If a date range is requested, calculate the exact dates and output them in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ).
        - If no date is mentioned, set FromDate and ToDate to null.
        - EventType: "Assessment" -> Modules: "Started", "ProctoringWarnig", "Submited", "Opened"
        - EventType: "Interview" -> Modules: "Opened", "Completed"
        - EventType: "Resume" -> Modules: "VIEW_RESUME", "RESUME_UPDATED"
        - EventType: "Hub" -> Modules: "CREATE_POST", "VIEW_POST", "DELETE_POST", "LIKE_POST"
        - EventType: "Authentication" -> Modules: "LOGIN_SUCCESS", "LOGOUT"

        Examples:

        User: "get logs of today"
        Response:
        {
          "Module": null,
          "EventType": null,
          "Status": null,
          "UserId": null,
          "FromDate": "TODAY_DATET00:00:00Z",
          "ToDate": "TODAY_DATET23:59:59Z"
        }

        User: "show me all proctoring warnings for udaykiran"
        Response:
        {
          "Module": "ProctoringWarnig",
          "EventType": "Assessment",
          "Status": null,
          "UserId": "udaykiran"
        }

        User: "who updated their resume"
        Response:
        {
          "Module": "RESUME_UPDATED",
          "EventType": "Resume",
          "Status": null,
          "UserId": null
        }

        User: "get all hub logs"
        Response:
        {
          "Module": null,
          "EventType": "Hub",
          "Status": null,
          "UserId": null
        }
        
        User: "did anyone delete a post"
        Response:
        {
          "Module": "DELETE_POST",
          "EventType": "Hub",
          "Status": null,
          "UserId": null
        }
        """;
        // 3. Inject the current date into the prompt!
        var systemPrompt = rawPrompt.Replace("TODAY_DATE-", todayDate);

        var requestBody = new
        {
            model = "openai/gpt-oss-20b", // Define model alias expected by the Groq-compatible endpoint

            messages = new[]
            {
                    new
                    {
                        role = "system",
                        content = systemPrompt
                    },
                    new
                    {
                        role = "user",
                        content = userInput
                    }
                },

            temperature = 0 // Minimal temperature for reproducible extraction
        };

        try
        {
            // Setup authorization header with API Key
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue(
                    "Bearer",
                    _apiKey);

            // Execute POST request to external LLM API
            var response = await _httpClient.PostAsJsonAsync(
                "https://api.groq.com/openai/v1/chat/completions",
                requestBody);

            // Handle API errors
            if (!response.IsSuccessStatusCode)
            {
                var error =
                    await response.Content.ReadAsStringAsync();

                Console.WriteLine(
                    $"Groq API Error: {response.StatusCode}");

                Console.WriteLine(error);

                throw new Exception(
                    $"Groq API failed: {response.StatusCode} - {error}");
            }

            // Parse response JSON document
            var responseData =
                await response.Content.ReadFromJsonAsync<JsonElement>();

            var aiMessage = responseData
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            Console.WriteLine(
                $"GROQ RAW RESPONSE: {aiMessage}");

            if (string.IsNullOrWhiteSpace(aiMessage))
            {
                return new NlpParsedFilters();
            }

            // Clean up possible markdown code blocks if the LLM hallucinated them
            aiMessage = aiMessage
                .Replace("```json", "")
                .Replace("```", "")
                .Trim();

            // Deserialize the JSON string into the strictly typed filters class
            var filters =
                JsonSerializer.Deserialize<NlpParsedFilters>(
                    aiMessage,
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

            return filters ?? new NlpParsedFilters();
        }
        catch (Exception ex)
        {
            Console.WriteLine(
                $"NLP Parser Error: {ex.Message}");

            throw;
        }
    }
}