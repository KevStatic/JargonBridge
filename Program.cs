using Azure;
using Azure.AI.OpenAI;
using DotNetEnv;
using System;
using System.Collections.Generic;

Env.Load();

// --- CONFIGURATION ---
// 1. Your API Key (Correct)
string apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY");

// 2. FIXED ENDPOINT: Must NOT end with /openai/v1
// Use exactly this string:
string endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");

// 3. Deployment Name (Matches your screenshot)
string deploymentName = Environment.GetEnvironmentVariable("AZURE_DEPLOYMENT_NAME");

// Use the most stable ServiceVersion for the OpenAI SDK
var clientOptions = new OpenAIClientOptions(OpenAIClientOptions.ServiceVersion.V2024_02_15_Preview);

// Initialize Client
var client = new OpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey), clientOptions);

Console.WriteLine("--- 🌉 The Jargon Bridge is Online ---");
Console.WriteLine("Paste your .NET code/jargon and press Enter:");

while (true)
{
    string? input = Console.ReadLine();
    if (string.IsNullOrWhiteSpace(input)) continue;

    try
    {
        var messages = new List<ChatRequestMessage>
        {
            new ChatRequestSystemMessage(
                "You are a senior IT Business Analyst. Convert technical code or system descriptions into clear, non-technical summaries for stakeholders.\n\n" +
                "Rules:\n" +
                "- Explain WHAT the feature does\n" +
                "- Explain WHY it matters to business\n" +
                "- Avoid technical jargon\n" +
                "- Keep it concise and structured\n" +
                "- Use bullet points when helpful"
            ),
            new ChatRequestUserMessage(input)
        };

        var response = await client.GetChatCompletionsAsync(
            new ChatCompletionsOptions(deploymentName, messages)
            {
                MaxTokens = 300
            }
        );

        string translation = response.Value.Choices[0].Message.Content;

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"\n--- Manager-Friendly Summary ---\n{translation}\n");
        Console.ResetColor();
        Console.WriteLine("--------------------------------");
        Console.WriteLine("Paste more jargon or press Ctrl+C to exit:");
    }
    catch (Exception ex)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"\n[Error]: {ex.Message}");
        if (ex.Message.Contains("404")) 
            Console.WriteLine("Tip: Double-check that your Deployment Name in Azure matches 'gpt-4o-mini' exactly.");
        Console.ResetColor();
    }
}