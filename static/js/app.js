// State Management
let releases = [];
let filteredReleases = [];
let selectedRelease = null;
let activeFilters = {
    category: 'all',
    searchQuery: ''
};
let activeHashtags = new Set();

// SVG Circular Progress Ring Parameters
let circle = null;
let circumference = 0;

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

// Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    else if (type === 'warning') iconName = 'alert-triangle';
    else if (type === 'error') iconName = 'x-circle';
    
    toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    initIcons();
    
    // Slide in
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// HTML Search Query Highlighting Utility
function highlightHTML(html, query) {
    if (!query || !query.trim()) return html;
    const escapedQuery = query.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    // Split HTML by tags to avoid breaking markup attributes
    const parts = html.split(/(<[^>]+>)/);
    return parts.map(part => {
        if (part.startsWith('<')) {
            return part; // Keep tag intact
        } else {
            return part.replace(regex, '<mark class="search-highlight">$1</mark>');
        }
    }).join('');
}

// Format date helper
function formatLastChecked() {
    const now = new Date();
    return `Last checked: ${now.toLocaleTimeString()}`;
}

// Render Pulse Skeleton Card Loaders
function renderSkeletons() {
    cardsGrid.innerHTML = `
        <div class="timeline-container">
            <div class="timeline-line"></div>
            <div class="skeleton-group">
                <div class="skeleton-header"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
            </div>
            <div class="skeleton-group" style="margin-top: 1rem;">
                <div class="skeleton-header"></div>
                <div class="skeleton-card"></div>
            </div>
        </div>
    `;
}

// Render Empty Results with Quick Reset Button
function renderEmptyState() {
    cardsGrid.innerHTML = `
        <div class="empty-state">
            <i data-lucide="search-code"></i>
            <h3>No Release Notes Found</h3>
            <p>Try adjusting your search query or category filters.</p>
            <button class="primary-btn" id="reset-filters-btn" aria-label="Reset Search and Filters">
                <i data-lucide="rotate-ccw"></i>
                <span>Reset Search & Filters</span>
            </button>
        </div>
    `;
    initIcons();
    
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            searchInput.value = '';
            activeFilters.searchQuery = '';
            clearSearchBtn.style.display = 'none';
            
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            const allTag = document.querySelector('.filter-tag[data-category="all"]');
            if (allTag) allTag.classList.add('active');
            activeFilters.category = 'all';
            
            applyFiltersAndSearch();
            showToast("Search and filters reset", "info");
        });
    }
}

// Fetch Releases from Flask Server API
async function fetchReleases(forceRefresh = false) {
    refreshBtn.classList.add('refreshing');
    refreshBtn.disabled = true;
    
    if (releases.length === 0) {
        renderSkeletons();
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
            if (forceRefresh) showToast("Release notes fetched live successfully", "success");
        } else if (data.source === 'cache') {
            sourceBadge.innerText = 'Cached';
            sourceBadge.style.backgroundColor = '#3b82f6';
        } else {
            sourceBadge.innerText = 'Offline Fallback';
            sourceBadge.style.backgroundColor = '#f59e0b';
            showToast("Offline mode: showing cached releases", "warning");
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
        showToast("Error retrieving release notes", "error");
    } finally {
        refreshBtn.classList.remove('refreshing');
        refreshBtn.disabled = false;
    }
}

// Render release cards grouped in vertical Timeline Date headers
function renderCards(items) {
    if (items.length === 0) {
        renderEmptyState();
        return;
    }

    // Group items consecutively by Date to maintain order
    const groupedReleases = [];
    let currentGroup = null;
    
    items.forEach(item => {
        if (!currentGroup || currentGroup.date !== item.date) {
            currentGroup = { date: item.date, items: [] };
            groupedReleases.push(currentGroup);
        }
        currentGroup.items.push(item);
    });

    let overallIndex = 0;

    const timelineHTML = `
        <div class="timeline-container">
            <div class="timeline-line"></div>
            ${groupedReleases.map(group => `
                <div class="timeline-group">
                    <div class="timeline-date-header">
                        <div class="timeline-dot"></div>
                        <h3>${group.date}</h3>
                    </div>
                    <div class="timeline-cards">
                        ${group.items.map(item => {
                            const isSelected = selectedRelease && selectedRelease.id === item.id;
                            const categoryClass = `cat-${item.category.toLowerCase()}`;
                            const delay = Math.min(overallIndex * 0.05, 0.8);
                            overallIndex++;
                            
                            // Highlight text elements matching current search query
                            const highlightedBody = highlightHTML(item.html_content, activeFilters.searchQuery);
                            
                            return `
                                <div class="release-card card-anim-item ${isSelected ? 'selected' : ''}" 
                                     data-id="${item.id}"
                                     tabindex="0"
                                     role="button"
                                     aria-selected="${isSelected ? 'true' : 'false'}"
                                     style="animation-delay: ${delay}s">
                                    <div class="card-header">
                                        <div class="card-meta">
                                            <span class="category-badge ${categoryClass}">${item.category}</span>
                                        </div>
                                        <div class="select-indicator">
                                            <i data-lucide="check"></i>
                                        </div>
                                    </div>
                                    <div class="card-body">
                                        ${highlightedBody}
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
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    cardsGrid.innerHTML = timelineHTML;
    
    // Attach click and keyboard listeners to cards
    document.querySelectorAll('.release-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            selectReleaseItem(id);
        });
        
        // Keyboard accessibility select
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const id = card.getAttribute('data-id');
                selectReleaseItem(id);
            }
        });
    });

    initIcons();
}

// Filter and Search Logic
function applyFiltersAndSearch() {
    filteredReleases = releases.filter(item => {
        const matchesCategory = activeFilters.category === 'all' || 
            item.category.toLowerCase() === activeFilters.category.toLowerCase();
            
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
            card.setAttribute('aria-selected', 'true');
        } else {
            card.classList.remove('selected');
            card.setAttribute('aria-selected', 'false');
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
    tweetTextarea.focus();
}

// Draft Tweet with smart truncation to fit 280 characters
function draftTweet() {
    if (!selectedRelease) return;
    
    const category = selectedRelease.category;
    const date = selectedRelease.date;
    const rawText = selectedRelease.text_content;
    const link = selectedRelease.link;
    
    const hashtags = Array.from(activeHashtags).join(' ');
    
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

// Update Circular Progress Ring SVG Dash Offset
function setProgress(percent) {
    if (!circle || circumference === 0) return;
    const offset = circumference - (percent / 100) * circumference;
    circle.style.strokeDashoffset = Math.max(0, offset);
}

// Update Character Counter & Circular SVG Progress
function updateCharCount() {
    const text = tweetTextarea.value;
    
    // Calculate character count (wrapping URLs to 23 chars)
    const urlPattern = /https?:\/\/[^\s]+/g;
    let length = text.length;
    
    const urls = text.match(urlPattern);
    if (urls) {
        urls.forEach(url => {
            length = length - url.length + 23;
        });
    }
    
    charCount.innerText = length;
    
    // Update SVG progress ring
    const percentage = Math.min((length / 280) * 100, 100);
    setProgress(percentage);
    
    if (circle) {
        if (length > 280) {
            circle.style.stroke = '#ef4444'; // Red
            charCount.classList.add('danger');
            tweetSubmitBtn.disabled = true; // Submit guard
        } else if (length >= 260) {
            circle.style.stroke = '#f59e0b'; // Amber
            charCount.classList.remove('danger');
            tweetSubmitBtn.disabled = false;
        } else {
            circle.style.stroke = 'var(--primary-color)'; // Default
            charCount.classList.remove('danger');
            tweetSubmitBtn.disabled = false;
        }
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
            
            draftTweet();
        });
    });
    
    // Submit Tweet Button (open Web Intent)
    tweetSubmitBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        showToast("Opening X/Twitter composer...", "success");
    });
    
    // Theme Toggling
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        showToast(`Theme switched to ${newTheme} mode`, "info");
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

    // Keyboard support: Escape key closes composer
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            composerSidebar.classList.remove('open');
        }
    });
}

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
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    
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
        showToast("Failed to copy automatically. Copy text manually.", "error");
    }
}

// Show visual feedback toggle and slide toast
function showCopyFeedback(btn) {
    const span = btn.querySelector('span');
    const icon = btn.querySelector('i');
    const originalText = span.innerText;
    const originalHtml = icon.outerHTML;
    
    btn.classList.add('copied');
    btn.innerHTML = `<i data-lucide="check"></i> <span>Copied!</span>`;
    initIcons();
    showToast("Copied release update to clipboard", "success");
    
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
        showToast("No release notes found to export!", "warning");
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
    showToast(`Exported ${filteredReleases.length} updates to CSV`, "success");
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
    
    // Set up circular progress values
    circle = document.getElementById('progress-circle');
    if (circle) {
        const radius = circle.r.baseVal.value;
        circumference = radius * 2 * Math.PI;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference;
    }

    fetchReleases();
});
