using Azure;
using Azure.AI.OpenAI;
using DotNetEnv;

// Load .env only if file exists (won't crash on Azure)
if (File.Exists(".env"))
{
    Env.Load();
}

var builder = WebApplication.CreateBuilder(args);

// Add logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Register OpenAI client as a singleton service
builder.Services.AddSingleton<OpenAIClient>(sp =>
{
    var logger = sp.GetRequiredService<ILogger<Program>>();
    
    string? apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY");
    string? endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");

    // Null safety: validate before creating client
    if (string.IsNullOrWhiteSpace(apiKey))
    {
        logger.LogError("AZURE_OPENAI_KEY environment variable is missing or empty");
        throw new InvalidOperationException("Missing AZURE_OPENAI_KEY environment variable");
    }
    
    if (string.IsNullOrWhiteSpace(endpoint))
    {
        logger.LogError("AZURE_OPENAI_ENDPOINT environment variable is missing or empty");
        throw new InvalidOperationException("Missing AZURE_OPENAI_ENDPOINT environment variable");
    }

    logger.LogInformation("OpenAI client created successfully. Endpoint: {Endpoint}", endpoint);

    return new OpenAIClient(
        new Uri(endpoint),
        new AzureKeyCredential(apiKey)
    );
});

var app = builder.Build();

var logger = app.Services.GetRequiredService<ILogger<Program>>();

// Enable CORS before defining routes
app.UseCors();

// Detailed health check endpoint
app.MapGet("/health", () =>
{
    var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY");
    var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
    var deploymentName = Environment.GetEnvironmentVariable("AZURE_DEPLOYMENT_NAME");

    return Results.Ok(new 
    { 
        status = "healthy",
        timestamp = DateTime.UtcNow,
        environment = new
        {
            hasApiKey = !string.IsNullOrWhiteSpace(apiKey),
            hasEndpoint = !string.IsNullOrWhiteSpace(endpoint),
            hasDeploymentName = !string.IsNullOrWhiteSpace(deploymentName),
            aspnetCoreEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"
        }
    });
});

// Main translate endpoint
app.MapPost("/translate", async (Request req, OpenAIClient client, ILogger<Program> logger) =>
{
    // Validate input
    if (string.IsNullOrWhiteSpace(req.Input))
    {
        logger.LogWarning("Empty input received");
        return Results.BadRequest(new { error = "Input text is required" });
    }

    try
    {
        string? deploymentName = Environment.GetEnvironmentVariable("AZURE_DEPLOYMENT_NAME");

        if (string.IsNullOrWhiteSpace(deploymentName))
        {
            logger.LogError("AZURE_DEPLOYMENT_NAME not configured");
            return Results.BadRequest(new { error = "AZURE_DEPLOYMENT_NAME not configured" });
        }

        logger.LogInformation("Processing translation request. Input length: {InputLength}", req.Input.Length);

        var messages = new List<ChatRequestMessage>
        {
            new ChatRequestSystemMessage(
                "You are a business analyst. Convert technical text into simple business explanation with WHAT, WHY, and IMPACT."
            ),
            new ChatRequestUserMessage(req.Input)
        };

        var response = await client.GetChatCompletionsAsync(
            new ChatCompletionsOptions(deploymentName, messages)
            {
                MaxTokens = 300
            }
        );

        var result = response.Value.Choices[0].Message.Content;

        logger.LogInformation("Translation completed successfully");

        return Results.Json(new { result });
    }
    catch (Azure.RequestFailedException ex)
    {
        logger.LogError(ex, "Azure OpenAI API error. Status: {Status}, Message: {Message}", ex.Status, ex.Message);
        return Results.StatusCode(500);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Unexpected error during translation");
        return Results.StatusCode(500);
    }
});

app.Run();

record Request(string Input);