import {GoogleGenerativeAI} from "@google/generative-ai";

console.log("background service worker started");

let videoSessions = {}; // Stores session data, keyed by videoId


async function fetchConfiguration(callback) {
    const fallbackSummary = "Summary Instructions:\n" +
        "Provide a concise, detail-rich summary that focuses on the main points of the YouTube transcript. Avoid redundancy or unnecessary phrasing. Present the information directly and clearly, without referencing the transcript or video.\n" +
        "\n" +
        "Question-Answering Instructions (if prompted):\n" +
        "Answer user questions only if asked. Provide clear, accurate responses based solely on the video's content. Do not restate or summarize unless specifically requested.\n" +
        "\n" +
        "Role:\n" +
        "Act as the video’s representative. Adopt the video's perspective and beliefs, aiming to educate the user on the information it presents."; // Replace with your actual fallback string

    chrome.storage.sync.get(["promptGroups", "selectedPromptIndex"], async (data) => {
        const promptGroups = Array.isArray(data.promptGroups) ? data.promptGroups : [];
        const selectedIndex = typeof data.selectedPromptIndex === "number" ? data.selectedPromptIndex : 0;
        const selectedPrompt = promptGroups[selectedIndex];

        if (!selectedPrompt) {
            callback(new Error("Invalid prompt selection."), null);
            return;
        }

        // Use the fallback if systemPromptSummary is not a valid string
        const systemPromptSummary =
            typeof selectedPrompt.systemPromptSummary === "string" && selectedPrompt.systemPromptSummary.trim() !== ""
                ? selectedPrompt.systemPromptSummary : fallbackSummary;



        callback(
            null,
            {systemPromptSummary},
            await ai.languageModel.create({systemPrompt: systemPromptSummary})
        );
    });
}


// Stream AI response and update chat history with built-in AI method
async function handleAiCall(videoId, prompt, port) {
    console.log(videoId);
    console.log(port);
    console.log(prompt);
    console.log(videoSessions[videoId]);

    const session = videoSessions[videoId];
    if (!session) {
        port.postMessage({action: "streamingSummary", videoId: videoId, error: "Session not found for videoId: " + videoId});
        return;
    }
    console.log("Ready to stream");

    try {
        const {chatHistory} = session;

        // Add the prompt to the chat history
        chatHistory.push({prompt});

        // Stream the AI response using the prompt
        const stream = session.instance.promptStreaming(prompt);
        let output = '';

        for await (const chunkText of stream) {
            output = chunkText;
            // Stream the response to the port
            port.postMessage({action: "streamingSummary", videoId: videoId, text: chunkText, remaining: session.instance.tokensLeft});
        }
        console.log(output);

        // Save the full response to chat history (since chunkText is the complete response)
        chatHistory.push({prompt, response: output});

        console.log(`Interaction saved for videoId ${videoId}:`, {prompt, response: output});

        port.postMessage({action: "streamingComplete", videoId: videoId, text: session.instance.tokensLeft});

    } catch (error) {
        console.error("Error during AI call:", error);
        if (error instanceof DOMException) {
            port.postMessage({action: "streamingSummary", videoId: videoId, error: "DOMException"});
        }
        port.postMessage({action: "streamingSummary", videoId: videoId, error: error});
    }
}


// Listen for incoming connections
chrome.runtime.onConnect.addListener((port) => {
    console.log("Connected to port:", port.name);

    port.onMessage.addListener((message) => {
        console.log("received message:", message);
        console.log(message.action);

        switch (message.action) {
            case "ping":
                port.postMessage({action: "pong", videoId: message.videoId});
                break;

            case "initializeSession":
                // Fetch configuration and initialize the session
                fetchConfiguration((error, config, instance) => {
                    console.log(config);
                    if (error) {
                        console.error("Error fetching configuration:", error.message);
                        port.postMessage({action: "sessionInitialized", videoId: message.videoId, error: error.message});
                        return;
                    }

                    // Create a new session for the video
                    videoSessions[message.videoId] = {
                        videoId: message.videoId,
                        chatHistory: [], // Initialize empty chat history
                        systemPromptSummary: config.systemPromptSummary,
                        instance: instance,
                    };
                    console.log(videoSessions[message.videoId]);

                    console.log(`Session initialized for videoId: ${message.videoId}`);
                    port.postMessage({action: "sessionInitialized", videoId: message.videoId, text: instance.tokensLeft});
                });
                break;

            case "aiCall":
                const {processedPrompt} = message.data;
                console.log("Received api call: ", message);

                if (!message.videoId || !processedPrompt) {
                    port.postMessage({action: "streamingSummary", videoId: message.videoId, error: "Missing videoId or prompt in AI call."});
                    console.log("API call invalidated");
                    return;
                }
                console.log("API call validated");

                // Handle AI call for the specified videoId
                handleAiCall(message.videoId, processedPrompt, port);
                break;

            case "endSession":
                if (videoSessions[message.videoId]) {
                    if (videoSessions[message.videoId].instance) {
                        videoSessions[message.videoId].instance.destroy();
                    }

                    delete videoSessions[message.videoId];
                    console.log(`Session ended for videoId: ${message.videoId}`);
                } else {
                    console.warn(`No session found to end for videoId: ${message.videoId}`);
                }
                break;

            default:
                console.warn(`Unknown action: ${action}`);
        }

    });

    port.onDisconnect.addListener(() => {
        console.log("Disconnected from port:", port.name);
        if (videoSessions[port.name]?.instance) {
            videoSessions[port.name].instance.destroy();
            console.log("Instance destroyed.");
        }
        delete videoSessions[port.name];
    });
});


// Open the settings page when the extension action is clicked
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({url: chrome.runtime.getURL("settings.html")});
});


// Log when the background service worker is installed
chrome.runtime.onInstalled.addListener(() => {
    console.log("Background service worker started.");
});
