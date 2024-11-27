import {GoogleGenerativeAI} from "@google/generative-ai";

console.log("background service worker started");

let videoSessions = {}; // Stores session data, keyed by videoId


function fetchConfiguration(callback) {
    const fallbackSummary = "Objective: Provide a concise, professional summary of the transcript, focusing on the key ideas and main points. Eliminate unnecessary details, redundant phrasing, and any references to the transcript or video. Maintain an immersive tone by presenting the information directly.\n" +
        "\n" +
        "Instructions for Questions: After providing the summary, answer any user questions clearly and accurately. Refer directly to the content and context of the transcript while maintaining an immersive, professional tone. Avoid repetitive references and focus on delivering insightful, precise responses."; // Replace with your actual fallback string

    chrome.storage.sync.get(["promptGroups", "selectedPromptIndex"], (data) => {
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
                ? selectedPrompt.systemPromptSummary
                : fallbackSummary;

        callback(null, {
            promptGroups,
            selectedIndex,
            systemPromptSummary
        });
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

        // Check if the AI instance exists, if not, create it
        if (!session.instance) {
            session.instance = await ai.languageModel.create({
                systemPrompt: session.systemPromptSummary
            });
        }

        // Add the prompt to the chat history
        chatHistory.push({prompt});

        // Stream the AI response using the prompt
        const stream = session.instance.promptStreaming(prompt);
        let output = '';

        for await (const chunkText of stream) {
            output = chunkText;
            // Stream the response to the port
            port.postMessage({action: "streamingSummary", videoId: videoId, text: chunkText});
        }
        console.log(output);

        // Save the full response to chat history (since chunkText is the complete response)
        chatHistory.push({prompt, response: output});

        console.log(`Interaction saved for videoId ${videoId}:`, {prompt, response: output});

        port.postMessage({action: "streamingComplete", videoId: videoId});

    } catch (error) {
        console.error("Error during AI call:", error);
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
                fetchConfiguration((error, config) => {
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
                        instance: null,
                    };
                    console.log(videoSessions[message.videoId]);

                    console.log(`Session initialized for videoId: ${message.videoId}`);
                    port.postMessage({action: "sessionInitialized", videoId: message.videoId});
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
