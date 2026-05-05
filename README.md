# CV Studio – Visual Resume Builder

A professional, live-preview CV editor with local filesystem persistence. Every change you make in the browser is automatically saved to your local `data.json` file. Perfect for developers who want to keep their resume data in their own repository.

## 🚀 Getting Started

### 1. Prerequisites
You need **Node.js** (v14 or higher) installed on your machine. You can download it from [nodejs.org](https://nodejs.org/).

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/GuedaliaMahonAccount/CV-studio.git
cd CV-studio
npm install
```

### 3. Setup Data
The project uses `data.json` to store your profiles.
- When you first run the server, it will automatically create a `data.json` file by copying the `data.json.example` file.
- Your personal `data.json` is ignored by Git, so you can safely commit your code without sharing your personal information.

### 4. Run the Server
Start the local backend to enable automatic saving:
```bash
npm start
```

### 5. Access the App
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## 🛠 Features

- **Live Preview**: See your CV update in real-time as you type.
- **Auto-Save**: Changes are written directly to `data.json` on your disk. No manual saving required.
- **Multiple Profiles**: Switch between different CV versions (e.g., Fullstack Engineer vs. Product Manager).
- **A4 PDF Export**: Download your resume in a professional A4 format.
- **Layout Control**: Adjust typography, spacing, and density dynamically.

## 📂 Project Structure

- `index.html` - The application interface.
- `app.js` - Frontend logic and API communication.
- `styles.css` - Visual styling and print layout.
- `server.js` - Local Node.js server for filesystem persistence.
- `data.json.example` - Template data file.
- `data.json` - **Your Local Database** (Git-ignored).

## ⚠️ Notes

- **Persistence**: This app saves to your hard drive. Clearing your browser cache will NOT delete your resumes.
- **Privacy**: Make sure to keep your personal `data.json` out of your public commits (it is already in `.gitignore`).
- **Offline Use**: The server must be running (`npm start`) for changes to be saved.
