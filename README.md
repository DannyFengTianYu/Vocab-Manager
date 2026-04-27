# Vocab Manager

Existing English learning apps often rely on pre-set vocabularies, limiting the ability to save custom daily words, while traditional manual notes lack efficient review mechanisms. 

To solve this, **Vocab Manager** was created. It is a custom web application that supports manual word entry, personalized dictionary management, and algorithm-driven reviews (e.g., the Ebbinghaus forgetting curve/Spaced Repetition System).

## ✨ Features

- **📝 Custom Word Entry**: Add new words manually with definitions, parts of speech, and custom example sentences.
- **🏷️ Tagging System**: Organize your vocabulary with custom tags for easy filtering and targeted reviews.
- **📚 My Dictionary**: A comprehensive view of all your saved words. Features include:
  - Search functionality.
  - Sorting by alphabetical order or added time.
  - Sidebar filtering by custom tags.
  - Bulk actions (multi-select, copy, move) to manage words across different tags.
- **🧠 Smart Review System**: 
  - **Spaced Repetition (SRS)**: An algorithm-driven mode that optimizes your learning based on your memory retention (using a flashcard interface with "Forgot", "Blurry", and "Recognize" grading).
  - **Random Cram**: Review random words without affecting your memory retention data.
  - Flexible review settings: Filter by tags and set the number of words to review per session.
- **🌗 Theme Support**: Switch seamlessly between System Default, Light Mode, and Dark Mode.

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript.
- **Backend**: Python (built-in `http.server` for lightweight REST API).
- **Database**: SQLite (`vocab.db`).

## 🚀 Getting Started

### Prerequisites
- Python 3.x installed on your machine.

### Installation & Execution

1. Open a terminal or command prompt.
2. Navigate to the project directory:
   ```bash
   cd path/to/Vocab-Manager
   ```
3. Run the Python backend server:
   ```bash
   python server.py
   ```
4. The server will automatically initialize the database (`vocab.db`) and migrate any existing `data.json` data if found.
5. Open your web browser and visit:
   ```
   http://localhost:8000
   ```

## 📂 Project Structure

- `index.html`: The main user interface.
- `styles.css`: Styling for the application, including theme variables and layout logic.
- `app.js`: Frontend logic, handling UI interactions, API calls, and local state.
- `server.py`: A lightweight Python backend that serves static files and handles JSON API requests (`/api/vocab`, `/api/custom-tags`).
- `vocab.db`: SQLite database generated on the first run to store words, tags, and review progress.