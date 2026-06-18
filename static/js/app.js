// State Management
let releases = [];
let filteredReleases = [];
let selectedRelease = null;
let activeFilters = {
    category: 'all',
    searchQuery: ''
};
let activeHashtags = new Set();

// DOM Elements
const cardsGrid = document.getElementById('cards-grid');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const categoryFilters = document.getElementById('category-filters');
const refreshBtn = document.getElementById('refresh-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const themeToggle = document.getElementById('theme-toggle');
const feedInfo = document.getElementById('feed-info');
const sourceBadge = document.getElementById('source-badge');
const itemCount = document.getElementById('item-count');
const lastUpdated = document.getElementById('last-updated');

// Composer Elements
const composerSidebar = document.getElementById('composer-sidebar');
const emptyComposerState = document.querySelector('.empty-composer-state');
const composerForm = document.getElementById('composer-form');
const composerCardCategory = document.getElementById('composer-card-category');
const composerCardDate = document.getElementById('composer-card-date');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCount = document.getElementById('char-count');
const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
const closeComposerBtn = document.getElementById('close-composer-btn');
const mobileComposerTrigger = document.getElementById('mobile-composer-trigger');
const mobileSelectedBadge = document.getElementById('mobile-selected-badge');

// Initialize Lucide Icons
function initIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Format date helper (relative or absolute)
function formatLastChecked() {
    const now = new Date();
    return `Last checked: ${now.toLocaleTimeString()}`;
}

// Fetch Releases from Flask Server API
async function fetchReleases(forceRefresh = false) {
    // Show loading spinner
    refreshBtn.classList.add('refreshing');
    refreshBtn.disabled = true;
    
    if (releases.length === 0) {
        cardsGrid.innerHTML = `
            <div class="loading-state">
                <div class="loader"></div>
                <p>Fetching BigQuery release notes...</p>
            </div>
        `;
    }

    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        releases = data.releases || [];
        
        // Update source badges and stats
        feedInfo.style.display = 'flex';
        if (data.source === 'live') {
            sourceBadge.innerText = 'Live';
            sourceBadge.style.backgroundColor = '#10b981';
        } else if (data.source === 'cache') {
            sourceBadge.innerText = 'Cached';
            sourceBadge.style.backgroundColor = '#3b82f6';
        } else {
            sourceBadge.innerText = 'Offline Fallback';
            sourceBadge.style.backgroundColor = '#f59e0b';
        }
        
        itemCount.innerText = `${releases.length} items loaded`;
        lastUpdated.innerText = formatLastChecked();
        
        applyFiltersAndSearch();
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        cardsGrid.innerHTML = `
            <div class="error-state">
                <i data-lucide="alert-triangle"></i>
                <h3>Failed to Load Release Notes</h3>
                <p>${error.message || 'Please check your connection and try again.'}</p>
                <button class="primary-btn" onclick="fetchReleases(true)">
                    <i data-lucide="refresh-cw"></i> Retry
                </button>
            </div>
        `;
        initIcons();
    } finally {
        refreshBtn.classList.remove('refreshing');
        refreshBtn.disabled = false;
    }
}

// Render release cards in grid
function renderCards(items) {
    if (items.length === 0) {
        cardsGrid.innerHTML = `
            <div class="empty-state">
                <i data-lucide="search-code"></i>
                <h3>No Release Notes Found</h3>
                <p>Try adjusting your search query or category filters.</p>
            </div>
        `;
        initIcons();
        return;
    }

    cardsGrid.innerHTML = items.map((item, index) => {
        const isSelected = selectedRelease && selectedRelease.id === item.id;
        const categoryClass = `cat-${item.category.toLowerCase()}`;
        
        // Add staggered animation delay
        const delay = Math.min(index * 0.05, 0.8);
        
        return `
            <div class="release-card card-anim-item ${isSelected ? 'selected' : ''}" 
                 data-id="${item.id}"
                 style="animation-delay: ${delay}s">
                <div class="card-header">
                    <div class="card-meta">
                        <span class="category-badge ${categoryClass}">${item.category}</span>
                        <span class="date-badge">
                            <i data-lucide="calendar"></i>
                            ${item.date}
                        </span>
                    </div>
                    <div class="select-indicator">
                        <i data-lucide="check"></i>
                    </div>
                </div>
                <div class="card-body">
                    ${item.html_content}
                </div>
                <div class="card-footer">
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="card-link-btn" onclick="event.stopPropagation();">
                        <i data-lucide="external-link"></i>
                        Official Docs Reference
                    </a>
                    <div class="card-actions">
                        <button class="card-copy-btn" onclick="event.stopPropagation(); copyCardText('${item.id}', this);" title="Copy update to clipboard">
                            <i data-lucide="copy"></i>
                            <span>Copy</span>
                        </button>
                        <button class="card-tweet-btn" onclick="event.stopPropagation(); selectAndTweetCard('${item.id}');">
                            <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                            </svg>
                            <span>Tweet Update</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners to cards
    document.querySelectorAll('.release-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            selectReleaseItem(id);
        });
    });

    initIcons();
}

// Filter and Search Logic
function applyFiltersAndSearch() {
    filteredReleases = releases.filter(item => {
        // Category Filter matching
        const matchesCategory = activeFilters.category === 'all' || 
            item.category.toLowerCase() === activeFilters.category.toLowerCase();
            
        // Search Query Filter matching
        const cleanQuery = activeFilters.searchQuery.trim().toLowerCase();
        const matchesSearch = !cleanQuery || 
            item.date.toLowerCase().includes(cleanQuery) ||
            item.category.toLowerCase().includes(cleanQuery) ||
            item.text_content.toLowerCase().includes(cleanQuery);
            
        return matchesCategory && matchesSearch;
    });

    renderCards(filteredReleases);
}

// Select Release Item for Tweet draft
function selectReleaseItem(id) {
    const item = releases.find(r => r.id === id);
    if (!item) return;

    selectedRelease = item;
    
    // Update active visual card state
    document.querySelectorAll('.release-card').forEach(card => {
        if (card.getAttribute('data-id') === id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    // Populate Composer
    emptyComposerState.style.display = 'none';
    composerForm.style.display = 'flex';
    
    composerCardCategory.innerText = item.category;
    composerCardCategory.className = `selected-category-badge cat-${item.category.toLowerCase()}`;
    composerCardDate.innerText = item.date;
    
    // Draft tweet text
    draftTweet();
    
    // Update mobile views
    mobileSelectedBadge.style.display = 'flex';
    
    // Auto open composer sidebar on mobile
    if (window.innerWidth <= 1024) {
        composerSidebar.classList.add('open');
    }
}

function selectAndTweetCard(id) {
    selectReleaseItem(id);
    // Focus textarea
    tweetTextarea.focus();
}

// Draft Tweet with smart truncation to fit 280 characters
function draftTweet() {
    if (!selectedRelease) return;
    
    const category = selectedRelease.category;
    const date = selectedRelease.date;
    const rawText = selectedRelease.text_content;
    const link = selectedRelease.link;
    
    // Format active hashtags
    const hashtags = Array.from(activeHashtags).join(' ');
    
    // Max characters count calculation: X allows 280 characters.
    // The links are standard wrapped in ~23 characters by X/Twitter.
    const prefix = `BigQuery ${category} (${date}): `;
    const suffix = `\n\n${link}${hashtags ? '\n' : ''}${hashtags}`;
    
    const twitterLinkWrapLength = 23; 
    const calculatedSuffixLength = 2 + twitterLinkWrapLength + (hashtags ? 1 + hashtags.length : 0);
    const maxDescLength = 280 - prefix.length - calculatedSuffixLength - 5; // buffer
    
    let description = rawText;
    if (description.length > maxDescLength) {
        description = description.slice(0, maxDescLength - 3) + "...";
    }
    
    tweetTextarea.value = `${prefix}${description}${suffix}`;
    updateCharCount();
}

// Update Character Counter
function updateCharCount() {
    const text = tweetTextarea.value;
    
    // Calculate character count similarly to Twitter (wrapping URLs to 23 chars)
    // Find URLs in tweet
    const urlPattern = /https?:\/\/[^\s]+/g;
    let length = text.length;
    
    const urls = text.match(urlPattern);
    if (urls) {
        urls.forEach(url => {
            length = length - url.length + 23; // subtract link length, add 23 for Twitter wrapper
        });
    }
    
    charCount.innerText = length;
    
    if (length > 280) {
        charCount.classList.add('danger');
    } else {
        charCount.classList.remove('danger');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
        activeFilters.searchQuery = e.target.value;
        if (e.target.value.length > 0) {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        applyFiltersAndSearch();
    });
    
    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        activeFilters.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
    });
    
    // Category Filter Tags selection
    categoryFilters.addEventListener('click', (e) => {
        const tag = e.target.closest('.filter-tag');
        if (!tag) return;
        
        // Update active class
        document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        
        activeFilters.category = tag.getAttribute('data-category');
        applyFiltersAndSearch();
    });
    
    // Refresh Button click
    refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });
    
    // Textarea typing changes
    tweetTextarea.addEventListener('input', () => {
        updateCharCount();
    });
    
    // Quick Tag Buttons selection toggles
    document.querySelectorAll('.quick-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            
            if (activeHashtags.has(tag)) {
                activeHashtags.delete(tag);
                btn.classList.remove('active');
            } else {
                activeHashtags.add(tag);
                btn.classList.add('active');
            }
            
            // Re-draft the tweet with updated tags list
            draftTweet();
        });
    });
    
    // Submit Tweet Button (open Web Intent)
    tweetSubmitBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        
        // Final length check
        const urlPattern = /https?:\/\/[^\s]+/g;
        let length = text.length;
        const urls = text.match(urlPattern);
        if (urls) {
            urls.forEach(url => {
                length = length - url.length + 23;
            });
        }
        
        if (length > 280) {
            alert(`Your tweet exceeds the 280 character limit (calculated as ${length} characters)! Please shorten it before posting.`);
            return;
        }
        
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    });
    
    // Theme Toggling
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
    
    // Close Composer Drawer (Mobile)
    closeComposerBtn.addEventListener('click', () => {
        composerSidebar.classList.remove('open');
    });
    
    // Mobile floating action button opens composer
    mobileComposerTrigger.addEventListener('click', () => {
        composerSidebar.classList.add('open');
    });

    // Export to CSV Trigger
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            exportToCSV();
        });
    }
}

// Load Theme Preferences
function loadPreferences() {
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const activeTheme = savedTheme || systemTheme;
    document.documentElement.setAttribute('data-theme', activeTheme);
}

// Document Ready bootstrap
document.addEventListener('DOMContentLoaded', () => {
    loadPreferences();
    setupEventListeners();
    fetchReleases();
});

// Copy Card Text to Clipboard Utility (with synchronous execCommand fallback)
function copyCardText(id, btn) {
    const item = releases.find(r => r.id === id);
    if (!item) return;
    
    const copyText = `BigQuery ${item.category} (${item.date}):\n${item.text_content}\n\nRead more: ${item.link}`;
    
    // Check if modern Clipboard API is available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(copyText)
            .then(() => {
                showCopyFeedback(btn);
            })
            .catch(err => {
                console.warn('Async clipboard API failed, trying synchronous fallback:', err);
                trySyncCopy(copyText, btn);
            });
    } else {
        // Run fallback immediately and synchronously within the click event call stack
        trySyncCopy(copyText, btn);
    }
}

// Synchronous Fallback using execCommand ('copy')
function trySyncCopy(text, btn) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Position out-of-view and set styling
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    
    // Select the content
    textArea.focus();
    textArea.select();
    
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('Synchronous copy command failed:', err);
    }
    
    document.body.removeChild(textArea);
    
    if (success) {
        showCopyFeedback(btn);
    } else {
        alert('Unable to copy text automatically. Please select and copy text manually.');
    }
}

// Show visual feedback toggle
function showCopyFeedback(btn) {
    const span = btn.querySelector('span');
    const icon = btn.querySelector('i');
    const originalText = span.innerText;
    const originalHtml = icon.outerHTML;
    
    btn.classList.add('copied');
    btn.innerHTML = `<i data-lucide="check"></i> <span>Copied!</span>`;
    initIcons();
    
    setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `${originalHtml} <span>${originalText}</span>`;
        initIcons();
    }, 2000);
}

// CSV Field Escape Utility
function escapeCSV(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    str = str.replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
        str = `"${str}"`;
    }
    return str;
}

// Export Filtered Releases to CSV
function exportToCSV() {
    if (filteredReleases.length === 0) {
        alert("No release notes found to export!");
        return;
    }
    
    const headers = ["Date", "Category", "Content", "Reference Link"];
    const rows = filteredReleases.map(item => [
        item.date,
        item.category,
        item.text_content,
        item.link
    ]);
    
    const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const categoryName = activeFilters.category === 'all' ? 'all' : activeFilters.category.toLowerCase();
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_${categoryName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
