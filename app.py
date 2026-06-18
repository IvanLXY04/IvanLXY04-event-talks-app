import os
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for feed data to minimize hitting Google Cloud documentation servers
_cache = {
    "data": None,
    "timestamp": 0
}

def clean_html_tags(html):
    """Strip HTML tags to obtain plain text for draft tweet previews."""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', html)
    # Replace multiple whitespaces/newlines with a single space
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def fetch_and_parse_feed():
    """Fetches the Google Cloud BigQuery release notes Atom feed and parses it into split items."""
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BigQueryReleaseNotesViewer/1.0'}
    )
    with urllib.request.urlopen(req) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    releases = []
    item_counter = 0
    
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns).text  # This corresponds to the release date (e.g., "June 17, 2026")
        updated = entry.find('atom:updated', ns).text
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        link = link_elem.get('href') if link_elem is not None else "https://docs.cloud.google.com/bigquery/docs/release-notes"
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Split content_html by <h3> tags because one date entry can contain multiple release items
        parts = re.split(r'<h3[^>]*>(.*?)</h3>', content_html, flags=re.IGNORECASE)
        
        if len(parts) <= 1:
            # If there's no h3, represent the entire content block as a single "General" item
            body = content_html.strip()
            if body:
                text_content = clean_html_tags(body)
                releases.append({
                    "id": f"item_{item_counter}",
                    "date": title,
                    "updated": updated,
                    "category": "General",
                    "html_content": body,
                    "text_content": text_content,
                    "link": link
                })
                item_counter += 1
        else:
            # First element is the text before the first <h3> (usually empty whitespace)
            for i in range(1, len(parts), 2):
                category = parts[i].strip()
                body = parts[i+1].strip() if i+1 < len(parts) else ""
                
                text_content = clean_html_tags(body)
                
                # Standardize category capitalization (e.g. FEATURE -> Feature)
                category_display = category.capitalize()
                
                releases.append({
                    "id": f"item_{item_counter}",
                    "date": title,
                    "updated": updated,
                    "category": category_display,
                    "html_content": body,
                    "text_content": text_content,
                    "link": link
                })
                item_counter += 1
                
    return releases

@app.route('/')
def index():
    """Render main interface."""
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    """API endpoint to get parsed release notes."""
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    now = time.time()
    # Cache duration: 5 minutes (300 seconds)
    if not force_refresh and _cache["data"] is not None and (now - _cache["timestamp"]) < 300:
        return jsonify({
            "source": "cache",
            "releases": _cache["data"]
        })
        
    try:
        releases = fetch_and_parse_feed()
        _cache["data"] = releases
        _cache["timestamp"] = now
        return jsonify({
            "source": "live",
            "releases": releases
        })
    except Exception as e:
        # If live fetch fails, fallback to cache if available
        if _cache["data"] is not None:
            return jsonify({
                "source": "cache_fallback",
                "error": str(e),
                "releases": _cache["data"]
            })
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Flask default port is 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
