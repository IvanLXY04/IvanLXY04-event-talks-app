# BigQuery Release Notes Explorer

A modern, high-performance web dashboard designed to browse, filter, search, and share Google Cloud BigQuery release notes. It parses the official Google Cloud Atom feed, segments grouped release items on a day-to-day basis, and enables instant drafting and sharing of updates on X (Twitter).

## 🚀 Key Features

*   **Granular Item Splitting**: Google's feed clusters all updates for a single day into one item. This application splits entries dynamically by `<h3>` tags, rendering each feature, announcement, or issue as a standalone card.
*   **Tweet Composer Sidebar**: Clicking on any update card drafts a customized tweet automatically. The composer computes character limits using Twitter's standard 23-character URL wrapping policy, features quick-toggle hashtag buttons, and opens the official X Web Intent in a new tab.
*   **Dual-Theme Mode**: Responsive styling supporting a sleek default Dark Mode and clean Light Mode, matching browser preferences with manual toggle overrides persisted via `localStorage`.
*   **Search & Filters**: Instantly query entries by keyword (across date, category, and body text) or filter by categories like *Features*, *Announcements*, *Issues*, *Breaking*, *Changes*, and *Deprecations*.
*   **In-Memory Server Caching**: Fetches are cached for 5 minutes to prevent rate-limiting. If a network fetch fails, it falls back to the cache to remain resilient.

## 🛠️ Technology Stack

*   **Backend**: Python, Flask, `xml.etree.ElementTree` (XML parsing), `urllib` (HTTP requests)
*   **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Variables, Flexbox, Grid), Vanilla JavaScript (ES6+, asynchronous Fetch API)
*   **Icons**: Lucide Icons CDN

## 📂 Project Structure

```
bq_release_viewer/
├── app.py                  # Flask application server and Atom parser
├── requirements.txt        # Python dependency documentation
├── .gitignore              # Git ignore rules for virtual env and temporary cache
├── templates/
│   └── index.html          # Semantic HTML5 user interface layout
└── static/
    ├── css/
    │   └── style.css       # Custom stylesheets (variables, theme configs)
    └── js/
        └── app.js          # Client-side render, filter, and twitter share logic
```

## ⚙️ Setup and Installation

### Prerequisites
*   Python 3.10 or higher installed on your system.

### 1. Clone the repository
```bash
git clone https://github.com/IvanLXY04/IvanLXY04-event-talks-app.git
cd IvanLXY04-event-talks-app
```

### 2. Set up a Virtual Environment
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

### 4. Run the Development Server
```bash
python app.py
```

Open your browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information (optional).
