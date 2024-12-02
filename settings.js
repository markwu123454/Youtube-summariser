// Wait for the DOM to load fully
document.addEventListener("DOMContentLoaded", () => {
    loadSettings();

    // Event listeners for buttons and menu items
    // document.getElementById("save-settings").addEventListener("click", saveSettings);
    document.getElementById("new-prompt").addEventListener("click", createNewPrompt);
    document.getElementById("save-prompt").addEventListener("click", savePrompt);
    document.getElementById("delete-prompt").addEventListener("click", deletePrompt);

    // Event listener for page change
    document.getElementById("menu-prompt").addEventListener("click", () => showSection("prompt-settings"));
    document.getElementById("menu-contacts").addEventListener("click", () => showSection("contact-settings"));
    document.getElementById('menu-github').addEventListener('click', function() {
        window.location.href = 'https://github.com/markwu123454/Youtube-summariser';
    });

    // Event listener for prompt dropdown
    document.getElementById("prompts-select").addEventListener("change", handlePromptSelection);
});

// Load settings on startup
function loadSettings() {
    chrome.storage.sync.get(["promptGroups", "selectedPromptIndex"], (data) => {
        if (data.promptGroups) {
            populatePromptOptions(data.promptGroups, data.selectedPromptIndex);
        } else {
            const examplePrompt = {
                name: "Default prompt",
                systemPromptSummary: "You are a youtube video asistant that specialize in summarising a video. The user may ask you questions after the summary.",
                userPromptSummary: "Summarise the video titled: {title}, by {channel}. Transcript: {transcript}"
            };
            // Save example prompt if none exists
            chrome.storage.sync.set({promptGroups: [examplePrompt], selectedPromptIndex: 0}, () => {
                populatePromptOptions([examplePrompt], 0);
                // Pre-fill the inputs with the example prompt values
                document.getElementById("prompt-title").value = examplePrompt.name;
                document.getElementById("system-prompt-summary").value = examplePrompt.systemPromptSummary;
                document.getElementById("user-prompt-summary").value = examplePrompt.userPromptSummary;
            });
        }
    });
}

function populatePromptOptions(promptGroups, selectedIndex) {
    const promptSelect = document.getElementById("prompts-select");
    promptSelect.innerHTML = '';  // Clear existing options

    // Add each prompt group to the dropdown
    promptGroups.forEach((group, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = group.name || `Prompt ${index + 1}`;
        promptSelect.appendChild(option);
    });

    // Automatically select the previously selected prompt
    if (promptGroups.length > 0) {
        promptSelect.value = selectedIndex;
        handlePromptSelection();  // Pre-fill the fields based on the selected prompt
    }
}

function handlePromptSelection() {
    const selectedIndex = document.getElementById("prompts-select").value;

    chrome.storage.sync.get("promptGroups", (data) => {
        const group = data.promptGroups[selectedIndex];
        if (group) {
            document.getElementById("prompt-title").value = group.name;
            document.getElementById("system-prompt-summary").value = group.systemPromptSummary;
            document.getElementById("user-prompt-summary").value = group.userPromptSummary;
        }

        // Save the currently selected prompt index to storage
        chrome.storage.sync.set({selectedPromptIndex: selectedIndex});
    });
}

function createNewPrompt() {
    // Clear all fields
    document.getElementById("prompt-title").value = "";
    document.getElementById("system-prompt-summary").value = "";
    document.getElementById("user-prompt-summary").value = "";
}

function savePrompt() {
    const title = document.getElementById("prompt-title").value;
    const systemPromptSummary = document.getElementById("system-prompt-summary").value;
    const userPromptSummary = document.getElementById("user-prompt-summary").value;

    if (!title || !systemPromptSummary || !userPromptSummary) {
        alert("Please fill in all fields.");  // Basic validation
        return;
    }

    chrome.storage.sync.get("promptGroups", (data) => {
        let promptGroups = data.promptGroups || [];
        const existingIndex = promptGroups.findIndex((group) => group.name === title);

        if (existingIndex >= 0) {
            promptGroups[existingIndex] = {name: title, systemPromptSummary, userPromptSummary};  // Override if exists
        } else {
            promptGroups.push({name: title, systemPromptSummary, userPromptSummary});  // Add as new if not found
        }

        chrome.storage.sync.set({promptGroups}, () => {
            populatePromptOptions(promptGroups, existingIndex);  // Refresh dropdown and select the new prompt
            handlePromptSelection();  // Pre-fill the fields with the new prompt's data

            const statusElement = document.getElementById("save-prompt-status");
            statusElement.style.display = "block";
            statusElement.classList.add("fade-in");  // Apply fade-in effect
            setTimeout(() => {
                statusElement.classList.remove("fade-in");
                statusElement.classList.add("fade-out");  // Apply fade-out effect
            }, 2000);  // Show for 2 seconds before starting fade-out
            setTimeout(() => {
                statusElement.style.display = "none";
                statusElement.classList.remove("fade-out");
            }, 3000);  // Hide completely after 3 seconds
        });
    });
}

function deletePrompt() {
    const title = document.getElementById("prompt-title").value;

    chrome.storage.sync.get("promptGroups", (data) => {
        let promptGroups = data.promptGroups || [];
        promptGroups = promptGroups.filter((group) => group.name !== title);  // Remove by name

        chrome.storage.sync.set({promptGroups}, () => {
            populatePromptOptions(promptGroups, 0);  // Refresh the dropdown and select the first prompt
            createNewPrompt();  // Clear fields after deletion
            document.getElementById("delete-prompt-status").style.display = "block";
            setTimeout(() => {
                document.getElementById("delete-prompt-status").style.display = "none";
            }, 1000);
        });
    });
}

function saveSettings() {
    // Since api key is not required, this function doesn't really do anything
}

function showSection(section) {
    document.querySelectorAll("#settings-content > div").forEach((el) => el.style.display = "none");
    document.getElementById(section).style.display = "block";
}

// Dropdown logic for custom select menus
const selectMenus = document.querySelectorAll('.select-menu');

selectMenus.forEach(menu => {
    const selectBtn = menu.querySelector('.select-btn');
    const options = menu.querySelector('.options');

    selectBtn.addEventListener('click', () => {
        menu.classList.toggle('active'); // Toggle the dropdown
    });

    const optionsList = options.querySelectorAll('.option');
    optionsList.forEach(option => {
        option.addEventListener('click', () => {
            selectBtn.querySelector('.sBtn-text').textContent = option.textContent;
            menu.classList.remove('active'); // Close dropdown after selection
        });
    });
});
