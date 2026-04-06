# Nova Fresh AI Voice Bot

A high-performance, hands-free AI supermarket voice assistant developed with native JavaScript and Groq (Llama 3).

## 🚀 Getting Started

To run this bot on your laptop:

### 1. Clone the Files
Copy the following files into a new folder on your laptop:
- `index.html`
- `style.css`
- `app.js`

### 2. Configure API Key
1. Open `app.js`.
2. Find the line: `const GROQ_API_KEY = "";`.
3. Paste your Groq API Key between the quotes. You can get one for free at [console.groq.com](https://console.groq.com).

### 3. Run a Local Server (CRITICAL)
Note: The Web Speech API **will not work** if you just double-click `index.html`. You MUST run it from a local server.
- **XAMPP**: Place folder in `C:\xampp\htdocs\` and visit `http://localhost/your-folder-name/`.
- **VS Code**: Install "Live Server" extension, right-click `index.html` and select "Open with Live Server".
- **Node.js**: Run `npx live-server` in the folder.

## 🎙️ Features
- **Bilingual Interface**: Support for English and Tamil.
- **Hands-Free**: Continuous listening with automatic voice trigger management.
- **Fortress Echo Guard**: Aggressive filtering to stop the bot hearing itself.
- **Live Order Sheet**: Visual Excel-style cart updates in real-time.
- **Inventory Logic**: Add, remove, and check prices of items automatically.

## 🛠️ Troubleshooting
- **No Sound?**: Ensure your speakers are on and Click the microphone button once to wake up the audio engine.
- **Not Listening?**: Ensure you are using **Google Chrome** and have given microphone permissions to `localhost`.
