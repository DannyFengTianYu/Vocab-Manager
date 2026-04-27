# Vocab Manager

[English](#english) | [中文](#中文)

---

## English

Existing English learning apps often rely on pre-set vocabularies, limiting the ability to save custom daily words, while traditional manual notes lack efficient review mechanisms. 

To solve this, **Vocab Manager** was created. It is a custom web application that supports manual word entry, personalized dictionary management, and algorithm-driven reviews (e.g., the Ebbinghaus forgetting curve/Spaced Repetition System).

### ✨ Features

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

### 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript.
- **Backend**: Python (built-in `http.server` for lightweight REST API).
- **Database**: SQLite (`vocab.db`).

### 🚀 Getting Started

#### Prerequisites
- Python 3.x installed on your machine.

#### Installation & Execution

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

### 📂 Project Structure

- `index.html`: The main user interface.
- `styles.css`: Styling for the application, including theme variables and layout logic.
- `app.js`: Frontend logic, handling UI interactions, API calls, and local state.
- `server.py`: A lightweight Python backend that serves static files and handles JSON API requests (`/api/vocab`, `/api/custom-tags`).
- `vocab.db`: SQLite database generated on the first run to store words, tags, and review progress.

---

## 中文

现有的英语学习应用通常依赖于预设的词库，限制了用户保存日常自定义生词的能力；而传统的手动笔记则缺乏高效的复习机制。

为了解决这一痛点，**Vocab Manager（词汇管理器）** 应运而生。这是一款支持手动录入单词、个性化词典管理以及基于算法（如艾宾浩斯遗忘曲线/间隔重复系统）驱动复习的定制化 Web 应用。

### ✨ 功能特点

- **📝 自定义单词录入**：手动添加生词，支持录入释义、词性及自定义例句。
- **🏷️ 标签系统**：使用自定义标签来组织你的词汇，便于过滤和有针对性的复习。
- **📚 我的词典**：全面展示所有已保存的单词。功能包括：
  - 搜索功能。
  - 按字母顺序或添加时间进行排序。
  - 侧边栏通过自定义标签进行过滤。
  - 批量操作（多选、复制、移动）以跨标签管理单词。
- **🧠 智能复习系统**：
  - **间隔重复 (SRS)**：基于记忆保留度的算法驱动模式，优化学习效果（使用闪卡界面，提供“忘记”、“模糊”、“认识”三个评分选项）。
  - **随机复习**：随机复习单词，不影响记忆数据。
  - 灵活的复习设置：通过标签进行过滤，并设置每次复习的单词数量。
- **🌗 主题支持**：在系统默认、浅色模式和深色模式之间无缝切换。

### 🛠️ 技术栈

- **前端**：HTML5, 原生 CSS, 原生 JavaScript。
- **后端**：Python（内置 `http.server` 提供轻量级 REST API）。
- **数据库**：SQLite (`vocab.db`)。

### 🚀 快速开始

#### 环境要求
- 计算机上已安装 Python 3.x。

#### 安装与运行

1. 打开终端或命令提示符。
2. 导航到项目目录：
   ```bash
   cd path/to/Vocab-Manager
   ```
3. 运行 Python 后端服务器：
   ```bash
   python server.py
   ```
4. 服务器将自动初始化数据库 (`vocab.db`)，如果找到现有的 `data.json` 数据则会自动迁移。
5. 打开浏览器并访问：
   ```
   http://localhost:8000
   ```

### 📂 项目结构

- `index.html`: 主用户界面。
- `styles.css`: 应用程序的样式，包括主题变量和布局逻辑。
- `app.js`: 前端逻辑，处理 UI 交互、API 调用和本地状态。
- `server.py`: 一个轻量级的 Python 后端，用于提供静态文件并处理 JSON API 请求 (`/api/vocab`, `/api/custom-tags`)。
- `vocab.db`: 首次运行时生成的 SQLite 数据库，用于存储单词、标签和复习进度。