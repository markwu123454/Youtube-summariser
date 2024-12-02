# YouTube Video Summarizer Chrome Extension

This Chrome extension leverages Chrome Canary's built-in AI to summarize YouTube videos and answer questions about the content. It is designed to provide concise and professional summaries of videos, with the ability to interact with the AI to ask questions based on the video content.

## Features

- **Video Summarization**: The extension generates a summary of the youtube video based on its transcript.
- **Question and Answer**: Users can ask questions about the video, and the AI will provide answers based on the content.
- **AI Integration**: The extension uses Chrome Canary's built-in AI for summarization and Q&A functionality, so everything is processed locally(to the best of my knowledge), and is thus completely free.
- **Prompt Customization**: Users can modify the prompts used by the AI by clicking on the extension's icon and accessing the settings page.

## Installation

1. Clone or download the repository to your local machine.
2. Download and open **Chrome Canary** (this extension is not supported in normal Chrome).
3. Navigate to `chrome://extensions/`.
4. Enable **Developer Mode** in the top right.
5. Click **Load unpacked** and select the extension directory.

## Usage

1. After installing the extension, navigate to a YouTube video.
2. The extension will automatically generate a summary of the video.
3. You can interact with the AI by asking questions about the video. The AI will use the transcript and video content to provide answers.
4. You can modify the AI's prompts by clicking on the extension's icon and opening the settings page.

## Warning

- **Limited Video Context**: The AI can only access the video title, channel, and transcript, which means it has limited knowledge of the content. Visuals, graphs, or demonstrations shown in the video will not be considered in the AI's responses.
- **Operating System Compatibility**: This extension runs locally on your laptop, which means some operating systems may not be able to run it effectively or at all, depending on their capabilities.
- **Token Limit**: The AI has a token limit of around 6000 only. For longer videos or conversations, this may affect the quality or completeness of the summary and answers.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Project description

I created this Chrome extension because in the past I’ve struggled to find good YouTube summarizers that meet my needs. Most existing solutions either limit usage, restrict quality, or fail to function reliably. Free options often straight up doesn't work, which is quite annoying. So for a while now I've wanted to develop a fully functional, AI-driven YouTube video summarizer that is both reliable and free.
Initially, my goal was to just have it be able to generating video summaries. However, after using the summarizer, I thought it could be even more useful with an added question-answering feature. This new feature allows users to ask the AI questions about the video content, providing a more interactive and versatile experience.
For this extension, I chose to use Chrome Canary's built-in Prompt API because of its flexibility. While I considered using Chrome's Summarization API, I  decided against it to ensure the AI could also handle user questions seamlessly. However, I am exploring the possibility of using the Summarization API in the future to address the AI's current token limitations. For longer videos, this could help create a condensed summary of the transcript before passing the content through the Prompt API, which will help save tokens and so allowing the it to also work on larger videos.
