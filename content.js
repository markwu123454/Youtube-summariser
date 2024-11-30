// Initialize video ID
let timeCodedTranscriptText = {};
let transcriptText = ''; // Store the transcript text globally
let titleText = ''; // Store the title text globally
let channelText = ''; // Store the channel text globally

// Track the current video ID and initialization status
let currentVideoId;
let currentChatPosition = 0;
let state = {
    button_state: false,
    chat_state: "Not Initialized"
};
let warnUser = {
    token_exceed: false
}
let currentChat;
// chat_states:
// Not Initialized, No Summary Generated, Generating Summary, Error in Summary,
// Waiting, Generating Response, Error in Response


class ports {
    constructor() {
        this.port = null;
        this.video_id = null;
        this.pingInterval = null;
    }


    new_Video(videoId) {
        this.video_id = videoId;

        // Initialize port based connection
        this.port = chrome.runtime.connect({name: videoId});
        this.sendMessage("initializeSession", null);

        // Start sending keep-alive
        this.pingInterval = setInterval(() => {
            this.sendMessage("ping", null);
            console.log("Sent keep-alive ping");
        }, 20000);

        // Handle messages from the background script
        this.port.onMessage.addListener((message) => {
            console.log("Received message:", message);

            // Checks message integrity
            if (message.videoId !== videoId) {
                console.warn("Wrong video id received:", message.videoId, ", expecting: ", videoId);
                return;
            }


            // Handles errors
            if (message.error) {
                switch (message.error) {

                    case "sessionInitialized":
                        console.error("Error while initializing session:", message.error);
                        break;

                    case "pong":
                        console.error("Error while processing keep-alive ping");
                        console.error("How did this even happen?");
                        break;

                    case "streamingSummary":
                        if (message.error === "DOMException")
                            if (state.chat_state === "Generating Summary" || state.chat_state === "Generating Response") {
                                console.error("Error generating summary:", message.error);
                                currentChatPosition++;
                                updateChatMessage("Error: " + message.error, "left", currentChatPosition);
                            } else {
                                console.error("Unexpected ai output:", message.error);
                            }
                        if (state.chat_state === "Generating Summary") {
                            state.chat_state = "No Summary Generated"
                        } else if (state.chat_state === "Generating Response") {
                            state.chat_state = "Waiting"
                        }
                        break;

                    case "streamingComplete":

                    default:
                        console.error("Unhandled error action:", message.error);
                        currentChatPosition++;
                        updateChatMessage("Error: " + message.error, "left", currentChatPosition);
                        currentChatPosition++;
                        updateChatMessage("I honestly don't know what happened, but refreshing the page should solve the problem", "middle", currentChatPosition);
                }
                document.getElementById("send-btn").classList.remove("inactive");
                return;
            }


            // Handles messages
            switch (message.action) {

                case "sessionInitialized":
                    console.log(`Session initialized for videoId: ${message.videoId}`);
                    state.chat_state = "No Summary Generated";
                    document.getElementById("info-label").textContent = "Remaining tokens: " + message.text;
                    break;

                case "pong":
                    console.log("Received keep-alive pong");
                    break;

                case "streamingSummary":
                    if (state.chat_state === "Generating Summary" || state.chat_state === "Generating Response") {
                        updateChatMessage(message.text+" **•**", "left", currentChatPosition);  // Update the message dynamically
                    }
                    document.getElementById("info-label").textContent = "Remaining tokens: " + message.remaining;
                    currentChat = message.text;
                    break;

                case "streamingComplete":
                    if (state.chat_state === "Generating Summary" || state.chat_state === "Generating Response") {
                        state.chat_state === "Waiting";
                    }
                    updateChatMessage(currentChat, "left", currentChatPosition);
                    state.chat_state = "Waiting";
                    document.getElementById("send-btn").classList.remove("inactive");
                    document.getElementById("info-label").textContent = "Remaining tokens: " + message.text;
                    break;

                default:
                    console.warn("Unhandled message action:", message.action);
            }
        });

        // Handle the case when the connection to the background worker is disconnected
        this.port.onDisconnect.addListener(() => {
            console.log("Background service worker disconnected.");
            // Clear the ping interval
            if (this.pingInterval) clearInterval(5000);
        });
    }


    stop_port() {
        if (this.port) {
            // End session for the previous video
            this.port.postMessage({
                action: "endSession",
                videoId: this.video_id,
            });

            // Disconnect the previous port
            this.port.disconnect();

            // Clear the ping interval
            if (this.pingInterval) {
                this.pingInterval.clearInterval(); // Stop the interval
            }


            // Clear variables
            this.port = null;
            this.video_id = null;

            console.log("Disconnected");
        } else {
            console.log("No port to disconnect from.")
        }

    }

    // centralizes sending port messages
    sendMessage(action, data) {
        if (this.port) {
            console.log("Sending message: ", action, ", and: ", data);
            this.port.postMessage({
                action: action,
                videoId: this.video_id,
                data: data
            });
        } else {
            console.warn("No port found to send message:", action, ", and: ", data);
        }
    }
}


const port = new ports();


// Function to check for video changes and initialize or remove the transcript tab
function checkVideoChange() {
    const videoId = new URLSearchParams(window.location.search).get("v");

    if (videoId !== currentVideoId) { // Check if video changes
        if (port) {
            port.stop_port();
        }
        removeTranscriptTab();
        currentVideoId = videoId;


        if (currentVideoId) { // Check if the new video id exists
            // Reset variables and UI for the new video
            transcriptText = '';
            titleText = '';
            channelText = '';
            currentChatPosition = 0;
            state.chat_state = "Not Initialized";
            warnUser.token_exceed = false;

            if (document.getElementById('transcript-content')) {
                document.getElementById('transcript-content').innerHTML = '';
            }

            // Start observing the document body for changes
            const observer = new MutationObserver(() => {
                const secondary = document.querySelector("#secondary");

                if (secondary && !document.getElementById("transcript-tab")) {
                    observer.disconnect(); // Stop observing once the element is found
                    port.new_Video(currentVideoId); // Handles new video setup
                    createTranscriptTab(secondary);
                    state.chat_state = "No Summary Generated";
                    document.getElementById("send-btn").classList.remove("inactive");
                    GetVideoData(); // Assuming this fetches the video transcript
                    console.log("Transcript tab successfully injected.");
                }
            });

            // Observe the entire document for dynamic changes
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }
}


// Start interval to check for video changes
setInterval(checkVideoChange, 3000);


// Function to handle adding, formatting, and processing messages
function updateChatMessage(message, side, position) {
    // Get the transcript content element
    const transcriptContent = document.getElementById('transcript-content');

    // Check if the element exists
    if (!transcriptContent) {
        console.error("Element with ID 'transcript-content' not found.");
        return; // Exit the function if the element doesn't exist
    }

    // Check if the position already has a message
    const existingMessage = transcriptContent.children[position];

    // Create a new message element if no existing message is found at the position
    let messageElement;
    if (!existingMessage) {
        messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        transcriptContent.appendChild(messageElement);
    } else {
        messageElement = existingMessage;
    }

    // Create a function to parse and format AI-generated text
    function formatAiGeneratedText(text) {
        // Replace ## with <h3> for titles
        text = text.replace(/##\s*(.+)/g, '<h3 class="ai-title">$1</h3>');

        // Replace ** or __ with <strong> for bold
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>');

        // Replace single * or _ with <em> for italic
        text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>');

        // Replace links (example: [text](url))
        text = text.replace(/\[([^\[]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        return text;
    }


    // Set the message content
    const messageText = document.createElement('p');
    messageText.classList.add('message');

    // Format the AI generated text if side is 'left'
    if (side === 'left') {
        messageText.innerHTML = formatAiGeneratedText(message); // Set formatted HTML
    } else {
        messageText.textContent = message; // Plain text for non-AI messages
    }

    // Clear existing content and add the new formatted message
    messageElement.innerHTML = '';
    messageElement.appendChild(messageText);

    // Apply styling based on which side the message is from
    if (side === 'left') {
        messageElement.style.backgroundColor = '#cce5ff'; // Left side (AI-generated)
        messageElement.style.alignSelf = 'flex-start'; // Align to the left
        messageElement.style.padding = '10px'; // Add some padding to AI-generated messages
        messageElement.style.borderRadius = '8px'; // Rounded corners for the AI message
    } else if (side === 'right') {
        messageElement.style.backgroundColor = '#e6f7ff'; // Right side (receiver)
        messageElement.style.alignSelf = 'flex-end'; // Align to the right
    } else if (side === 'middle') {
        messageElement.style.backgroundColor = 'transparent'; // No bubble
        messageElement.style.textAlign = 'center'; // Center text horizontally
        messageElement.style.padding = '5px 0'; // Reduced top and bottom padding
        messageElement.style.boxShadow = 'none'; // Remove shadow around invisible bubble
        messageText.style.fontSize = '12px'; // Small font size
        messageText.style.color = 'black'; // Black text color
        messageText.style.fontStyle = 'italic'; // Optional: italics for system messages
        messageText.style.display = 'inline-block'; // Ensure text takes up only necessary space
        messageText.style.margin = '0'; // Remove extra margin around the text
        messageElement.style.alignSelf = 'center'; // Center the message vertically and horizontally
    }

    // Ensure that the container scrolls to the most recent message
    const margin = 75;

    // Check if the user is near the bottom of the container
    if (transcriptContent.scrollHeight - transcriptContent.scrollTop - transcriptContent.clientHeight <= margin) {
        // Scroll to the bottom
        transcriptContent.scrollTop = transcriptContent.scrollHeight;
    }
}


// Function to create and display the transcript tab
function createTranscriptTab() {
    console.log("Attempting to create transcript tab...");

    const transcriptTab = document.createElement("div");
    transcriptTab.id = "transcript-tab";
    transcriptTab.innerHTML = `
        <h3 id="transcript-title">AI Summary</h3>
        <div id="info">
             <p id="info-label">Remaining tokens: loading...</p>
        </div>
        <div id="transcript-content">
            <div class="chat-message">
            </div>
        </div>
        <div id="input-container">
            <input type="text" id="message-input" placeholder="Ask a question..." />
            <button id="send-btn">Generate response</button>
        </div>
    `;

    document.getElementById("secondary").prepend(transcriptTab);
    document.getElementById("send-btn").classList.add("inactive");
    state.chat_state = "Not Initialized";
    console.log("Transcript tab created.");


    // Attach event listener to the generate summary button
    document.getElementById("send-btn").addEventListener("click", () => {
        if (document.getElementById("send-btn").classList.contains("expanded")) {
            send_btn_click(document.getElementById("message-input").value.trim());
            state.chat_state = "Generating Response";
        } else {
            send_btn_click();
            state.chat_state = "Generating Summary";
        }
    });

    // Add an event listener for the "keyup" event
    document.getElementById("message-input").addEventListener("keyup", function(event) {
        // Check if the "Enter" key was pressed
        if (event.key === "Enter") {
            // Get the value of the input field
            const inputValue = document.getElementById("message-input").value.trim();
            // Handle the input value
            if (inputValue) {
                document.getElementById("send-btn").classList.add("inactive");
                send_btn_click(inputValue);
                state.chat_state = "Generating Response";
            } else {
                console.log("Input is empty");
            }
        }
    });
}


// Function for handling send button clicks
function send_btn_click(input) {
    if (state.chat_state === "No Summary Generated") {

        // Slide button to the right and reveal input
        document.getElementById("send-btn").classList.add("expanded");
        document.getElementById("send-btn").classList.add("inactive");
        document.getElementById("message-input").style.display = "block"; // Show the input
        document.getElementById("send-btn").textContent = "Send";
        document.getElementById("message-input").focus(); // Automatically focus the input field
        generateSummary()
    } else if (state.chat_state === "Waiting" && input) {
        document.getElementById("send-btn").classList.add("inactive");
        document.getElementById("message-input").value = "";
        generateQuestion(input);
        // more to be written
    }

}


// Function to remove the transcript tab if no video is playing
function removeTranscriptTab() {
    const transcriptTab = document.getElementById("transcript-tab");
    if (transcriptTab) {
        transcriptTab.remove();
        console.log("Transcript tab removed as no video is playing.");
    }
}


// Unified function to retrieve video data and update the UI (converted to async style)
async function GetVideoData(retryCount = 10) {
    updateChatMessage("Loading transcript...", "middle", currentChatPosition);
    console.log("getting new video data");
    const YT_INITIAL_PLAYER_RESPONSE_RE = /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/;
    const summaryButton = document.getElementById("send-btn");

    // Initial loading state for UI
    updateChatMessage("Loading transcript...", "middle", currentChatPosition);
    summaryButton.disabled = true;

    let player = window.ytInitialPlayerResponse;

    // Check if the player response is loaded and matches the current video ID
    if (!player || currentVideoId !== player.videoDetails?.videoId) {
        try {
            const response = await fetch(`https://www.youtube.com/watch?v=${currentVideoId}`);
            const body = await response.text();
            const playerResponse = body.match(YT_INITIAL_PLAYER_RESPONSE_RE);

            if (!playerResponse) {
                updateChatMessage("No video data found.", "middle", 0);
                return;
            }

            player = JSON.parse(playerResponse[1]);
            await retrieveTranscript(player, retryCount);
        } catch {
            updateChatMessage("Error fetching video data.", "middle", 0);
        }
    } else {
        await retrieveTranscript(player, retryCount);
    }

    // Function to retrieve transcript and update UI
    async function retrieveTranscript(player, retryCount) {
        // Initialize an object to store the retrieved results
        const result = {};
        const timeCodedTranscript = {}; // Object to store time-coded transcript

        result.title = player.videoDetails?.title || "No title available for this video.";
        document.getElementById("video-title").innerText = result.title;

        result.channelName = player.videoDetails?.author || "No channel name available for this video.";
        document.getElementById("channel-name").innerText = result.channelName;

        // Retry loop for loading playerCaptionsTracklistRenderer
        let attempt = 0;
        while (attempt < retryCount) {
            if (player.captions?.playerCaptionsTracklistRenderer) {
                await processCaptions(player, result, timeCodedTranscript);
                return;
            }
            attempt++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }

        // If no captions are available after retrying
        console.log("No captions available after retries.");
    }

    // Function to process the captions
    async function processCaptions(player, result, timeCodedTranscript) {
        if (player.captions?.playerCaptionsTracklistRenderer) {
            const tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks;
            if (tracks && tracks.length > 0) {
                tracks.sort(compareTracks);
                try {
                    const response = await fetch(tracks[0].baseUrl + "&fmt=json3");
                    const transcript = await response.json();

                    result.transcript = transcript.events
                        .filter(event => event.segs)
                        .map(event => {
                            const timeSeconds = event.tStartMs / 1000; // Convert ms to seconds
                            const readableTime = new Date(timeSeconds * 1000).toISOString().substr(11, 8); // Format as HH:mm:ss
                            const text = event.segs.map(seg => seg.utf8).join(" ");
                            timeCodedTranscript[readableTime] = text; // Add to time-coded transcript
                            return text;
                        })
                        .join(" ")
                        .replace(/[\u200B-\u200D\uFEFF]/g, '')
                        .replace(/\s+/g, ' ') || "No transcript found for current video.";

                    // Only call updateUI if no error occurred
                    updateUI(result, timeCodedTranscript);
                } catch (error) {
                    // Log the error to the console instead of updating the UI
                    console.log("Error fetching transcript:", error);
                }
            } else {
                console.log("No caption tracks found for this video.");
            }
        } else {
            console.log("No captions available for this video.");
        }
    }

    // Function to update the UI after processing
    function updateUI(result, timeCodedTranscript) {
        updateChatMessage("Transcript found.", "middle", currentChatPosition);
        summaryButton.style.backgroundColor = "#0073e6";
        summaryButton.disabled = false;
        transcriptText = result.transcript;
        channelText = result.channelName;
        titleText = result.title;
        timeCodedTranscriptText = timeCodedTranscript;

        // Log the time-coded transcript for debugging
        console.log("Time-Coded Transcript:", timeCodedTranscript);
        console.log("split transcript: ", splitTranscript(timeCodedTranscriptText));
    }
}


// Function to split longer transcripts into shorter more manageable chunks
function splitTranscript(transcript, maxWords = 2500, maxWPS = 5) {
    // Helper function to estimate the number of tokens (splitting by whitespace and punctuation)
    function countTokens(text) {
        // Tokenize text based on whitespace and punctuation using a simple regular expression
        return text.split(/\s+|[^\w\s]/).filter(token => token.length > 0).length;
    }

    // Create list of token counts and words per second (WPS)
    const timecodes = Object.keys(transcript);
    let tokenCounts = [];
    let wpsList = [];

    for (let i = 0; i < timecodes.length - 1; i++) {
        const currentTime = timecodes[i];
        const nextTime = timecodes[i + 1];

        const text = transcript[currentTime];
        const tokenCount = countTokens(text);

        // Calculate words per second (WPS)
        const timeDiff = parseFloat(nextTime) - parseFloat(currentTime);  // time in seconds
        const wps = tokenCount / timeDiff;

        tokenCounts.push(tokenCount);
        wpsList.push(wps);
    }

    // Accumulate tokens and handle chunking
    let currentTokens = 0;
    let startIndex = 0;
    let resultChunks = [];

    for (let i = 0; i < tokenCounts.length; i++) {
        currentTokens += tokenCounts[i];

        // If token count exceeds the max, backtrack and find the lowest WPS to minimize chunks
        if (currentTokens >= maxWords) {
            let backtrackIndex = i;
            let minWPS = Math.min(...wpsList.slice(startIndex, i + 1));

            // Backtrack until we find the lowest WPS point
            while (backtrackIndex > startIndex && wpsList[backtrackIndex] > minWPS) {
                backtrackIndex--;
            }

            // If the WPS is above a threshold, find a new backtrack point
            if (wpsList[backtrackIndex] > maxWPS) {
                let lastValidIndex = backtrackIndex;

                // Check if backtracking yields acceptable WPS
                for (let j = backtrackIndex; j > startIndex; j--) {
                    if (wpsList[j] <= maxWPS) {
                        lastValidIndex = j;
                        break;
                    }
                }
                backtrackIndex = lastValidIndex;
            }

            // Condense the text from the start of the segment to the backtrack point
            let condensedText = '';
            for (let j = startIndex; j <= backtrackIndex; j++) {
                condensedText += transcript[timecodes[j]] + ' ';
            }

            resultChunks.push(condensedText.trim());
            currentTokens = 0; // Reset token count for the next chunk
            startIndex = backtrackIndex + 1; // Update start index for the next chunk
        }
    }

    // Handle the remaining tokens in the last chunk
    if (startIndex < timecodes.length) {
        let finalChunk = '';
        for (let i = startIndex; i < timecodes.length; i++) {
            finalChunk += transcript[timecodes[i]] + ' ';
        }
        resultChunks.push(finalChunk.trim());
    }

    return resultChunks;
}


// Function to compare and prioritize tracks (English and non-ASR preferred)
function compareTracks(track1, track2) {
    const langCode1 = track1.languageCode;
    const langCode2 = track2.languageCode;

    if (langCode1 === 'en' && langCode2 !== 'en') {
        return -1;
    } else if (langCode1 !== 'en' && langCode2 === 'en') {
        return 1;
    } else if (track1.kind !== 'asr' && track2.kind === 'asr') {
        return -1;
    } else if (track1.kind === 'asr' && track2.kind !== 'asr') {
        return 1;
    }

    return 0;
}


// Function for interacting with backend for AI features and streaming response - responding to question
function generateQuestion(processedPrompt) {
    currentChatPosition++;
    updateChatMessage(processedPrompt, "right", currentChatPosition);  // Initial message

    currentChatPosition++;
    updateChatMessage("Answering question...", "left", currentChatPosition);  // Placeholder for streaming

    console.log("Getting response");
    state.chat_state = "Generating Response";
    port.sendMessage("aiCall", {processedPrompt});

}


// Function for interacting with backend for AI features and streaming response
function generateSummary() {
    currentChatPosition++;
    updateChatMessage("Summarise video.", "right", currentChatPosition);  // Initial message

    // Retrieve essential data from Chrome's synchronized storage (prompts and selected index)
    chrome.storage.sync.get(["promptGroups", "selectedPromptIndex"], (data) => {
        const fallbackTemplate = "Summarise ONLY the video titled: {title}, by {channel}. Transcript: {transcript}";

        const promptGroups = Array.isArray(data.promptGroups) ? data.promptGroups : [];  // Ensure promptGroups is an array
        const selectedIndex = data.selectedPromptIndex;


        // Retrieve selected prompt details
        const selectedPrompt = promptGroups[selectedIndex];

        // Ensure the selectedPrompt exists and has the required structure
        if (!selectedPrompt || typeof selectedPrompt !== "object") {
            currentChatPosition++;
            updateChatMessage("Selected prompt is missing or corrupted", "middle", currentChatPosition);
            return;
        }

        // Ensure the prompt has a valid userPromptSummary field or use the fallbackTemplate
        const promptTemplate =
            typeof selectedPrompt.userPromptSummary === "string" && selectedPrompt.userPromptSummary.trim() !== ""
                ? selectedPrompt.userPromptSummary
                : fallbackTemplate;

        // Replace placeholders with corresponding variables
        let processedPrompt = promptTemplate.replace(/{title}/g, titleText)
            .replace(/{channel}/g, channelText)
            .replace(/{transcript}/g, transcriptText);

        // If {transcript} was not found, append transcriptText at the end
        if (!selectedPrompt.userPromptSummary.includes("{transcript}")) {
            processedPrompt += "\n\n" + transcriptText;
        }

        currentChatPosition++;
        updateChatMessage("Summarising video...", "left", currentChatPosition);  // Placeholder for streaming

        console.log("Getting summary");
        state.chat_state = "Generating Summary";
        port.sendMessage("aiCall", {processedPrompt});

    });
}
