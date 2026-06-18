# BigQuery Release Notes Explorer

A modern, high-performance web dashboard built to browse, search, filter, and share Google Cloud BigQuery release notes. The application connects directly to the official Google Cloud Platform Atom feed, segments grouped updates on a day-level basis, and provides interactive tools for copying contents, exporting CSV files, or posting directly on X (Twitter).

```
bq_release_viewer/
├── app.py                  # Python Flask server & XML parsing logic
├── requirements.txt        # Python dependency manifest
├── .gitignore              # Ignores local environments, caches, and OS files
├── README.md               # Project documentation guide
├── templates/
│   └── index.html          # Semantic HTML5 user interface layout
└── static/
    ├── css/
    │   └── style.css       # Custom stylesheets (Dark & Light themes)
    └── js/
        └── app.js          # Client-side render, filtering, search, and sharing logic
```

---

## ⚡ Core Features

*   **Timeline Date Grouping**: Groups consecutive day-level updates under clean date headers. Displays cards along a vertical timeline connector line (`.timeline-line`) with circular nodes (`.timeline-dot`) for an easy-to-scan feed.
*   **Search Query Keyword Highlighting**: Dynamically wraps text matching active search queries in `<mark class="search-highlight">` tags, ignoring nested HTML tags to protect links and attributes from breaking.
*   **Circular Progress Ring & Tweet Guard**: Displays a circular SVG progress indicator in the Tweet Composer that fills as you type (handling Twitter's 23-character link wrapping). It changes colors (green ➔ amber ➔ red) and disables the submit button if the draft exceeds 280 characters.
*   **Skeleton Loading Shimmers**: Replaces static spinners with animated, pulsing skeleton shimmers (`.skeleton-card`) representing card shapes to minimize perceived load times.
*   **Slide-In Toast Notifications**: Displays bottom-center notification popups (`.toast`) with corresponding icons for actions (e.g. copying to clipboard, switching themes, exporting CSV, and server network issues).
*   **Quick Empty State Reset**: If a search yields zero matches, an "Empty State" card provides a "Reset Search & Filters" CTA button to clear the inputs and reload cards in one click.
*   **Accessibility Focus & Key Listeners**: Adds focus-visible outline states to all buttons, tabs, and cards. Supports Tab navigation, card activation via `Enter`/`Space`, and closing mobile drawers using `Escape`.
*   **Copy to Clipboard (Secure Fallback)**: Copies formatted card contents to the clipboard. Automatically falls back to a synchronous `execCommand` copy script if executed under non-secure IP testing networks, preventing user-gesture browser blocks.
*   **Export to CSV**: Exports the currently filtered/searched list of release items into a downloadable CSV file, dynamically naming it according to the active category (e.g. `bigquery_release_notes_feature.csv`).
*   **In-Memory Server Caching**: Backend caching for 5 minutes (300 seconds) to avoid hitting GCP rate-limits, with manual override force-refresh capabilities.

---

## 🏗️ Architecture & Data Flow

```mermaid
graph TD
    Client([User Browser]) <-->|Render UI / Actions| FE[Frontend: HTML, CSS, JS]
    FE <-->|GET /api/releases?refresh=true| BE[Flask Server: app.py]
    BE -->|Checks Cache / Refetch| Cache[(In-Memory Cache)]
    BE -->|Urllib XML Request| GCP[GCP BigQuery RSS Feed]
    FE -->|Copy Action| Clip[User System Clipboard]
    FE -->|CSV Action| File[Local CSV Download]
    FE -->|Web Intent| Twitter[X / Twitter intent URL]
```

---

## 🛠️ Installation & Setup

### Prerequisites
*   Python 3.10 or higher installed.

### 1. Clone the Repository
```bash
git clone https://github.com/IvanLXY04/IvanLXY04-event-talks-app.git
cd IvanLXY04-event-talks-app
```

### 2. Set Up a Virtual Environment
**Windows (PowerShell)**:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS/Linux**:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
```bash
python app.py
```
Open your browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔒 Clipboard Gesture Security Notes
Modern web browsers require clipboard modifications to occur strictly inside a synchronous event call stack stemming from a direct user action (like a `click` event). 

To ensure the clipboard functionality works even on non-localhost/non-secure endpoints:
1.  We perform a synchronous check: `navigator.clipboard && window.isSecureContext`.
2.  If the check returns true, we invoke the modern asynchronous `navigator.clipboard.writeText()` API.
3.  If false (such as in local IP testing networks), we bypass asynchronous promise ticks entirely and execute a synchronous `document.execCommand('copy')` fallback within the initial click thread, preventing the browser from blocking the operation.
