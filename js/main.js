/**
 * Main entry point for Bible Timeline visualization
 *
 * New architecture: Continuous scroll with individual book lifespans
 * - Books appear at their start date
 * - Books disappear at their end date
 * - Year counts continuously as user scrolls
 */

import { loadBooks, buildYearMapping, MESSAGES } from './data-loader.js';
import { TimelineRenderer } from './timeline-renderer.js';
import { BookManager } from './book-manager.js';
import { MessageManager } from './message-manager.js';
import { MilestoneCardManager } from './milestone-card-manager.js';

// Global state
let booksData = null;
let renderer = null;
let bookManager = null;
let messageManager = null;
let milestoneCardManager = null;
let yearMapping = null;

// Scroll elements
let scrollSpacer = null;
let bookColumns = null;
let introSection = null;
let closingSection = null;
let siteHeader = null;

// Scroll configuration
const SCROLL_HEIGHT = 30000; // Total scroll height in pixels (more = slower overall)

/**
 * Initialize the visualization
 */
async function init() {
    console.log('Initializing Bible Timeline...');

    try {
        // Load book data
        booksData = await loadBooks();
        console.log(`Loaded ${booksData.books.length} books`);

        // Get DOM elements
        scrollSpacer = document.getElementById('scroll-spacer');
        bookColumns = document.getElementById('book-columns');
        introSection = document.querySelector('.timeline-intro');
        closingSection = document.querySelector('.timeline-closing');
        siteHeader = document.getElementById('site-header');

        // Set scroll spacer height
        if (scrollSpacer) {
            scrollSpacer.style.height = `${SCROLL_HEIGHT}px`;
        }

        // Build year mapping with gap compression
        yearMapping = buildYearMapping(booksData.books);
        console.log(`Year range: ${yearMapping.minYear} to ${yearMapping.maxYear}`);

        // Initialize timeline renderer
        renderer = new TimelineRenderer();
        renderer.setYearRange(yearMapping.minYear, yearMapping.maxYear);
        renderer.initTicks(booksData.books);
        renderer.init();

        // Initialize book manager
        bookManager = new BookManager(booksData.books, bookColumns);

        // Initialize message manager
        messageManager = new MessageManager(MESSAGES);

        // Initialize milestone card manager (uses same container as books)
        milestoneCardManager = new MilestoneCardManager(bookColumns);

        // Set up scroll handler
        initScrollHandler();

        // Initial update
        handleScroll();

        // Expose for debugging
        window.books = booksData.books;
        window.yearMapping = yearMapping;
        window.bookManager = bookManager;
        window.messageManager = messageManager;
        window.milestoneCardManager = milestoneCardManager;
        window.renderer = renderer;

        console.log('Bible Timeline initialized');

    } catch (error) {
        console.error('Failed to initialize:', error);
        showError(error.message);
    }
}

/**
 * Initialize scroll event handler
 */
function initScrollHandler() {
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    // Handle resize
    window.addEventListener('resize', debounce(() => {
        handleScroll();
    }, 100));
}

/**
 * Handle scroll event
 * Calculate scroll progress and update year/books
 */
function handleScroll() {
    if (!yearMapping || !bookManager || !renderer || !messageManager || !milestoneCardManager) return;

    const scrollY = window.scrollY;
    const introHeight = introSection ? introSection.offsetHeight : 0;
    const closingOffset = closingSection ? closingSection.offsetTop : document.body.scrollHeight;

    // Calculate scroll progress through the timeline section
    // Intro section: before timeline starts
    // Scroll spacer: main timeline area
    // Closing section: after timeline ends

    // Show/hide fixed header based on intro visibility
    if (siteHeader) {
        if (scrollY > introHeight * 0.7) {
            siteHeader.classList.add('visible');
        } else {
            siteHeader.classList.remove('visible');
        }
    }

    if (scrollY < introHeight * 0.5) {
        // In intro - show initial state
        renderer.update(yearMapping.minYear);
        renderer.unhighlight();
        bookManager.clear();
        messageManager.clear();
        milestoneCardManager.clear();
        hideBookColumns();
        return;
    }

    if (scrollY > closingOffset - window.innerHeight * 0.5) {
        // In closing - show final state
        renderer.update(yearMapping.maxYear);
        renderer.highlight();
        bookManager.clear();
        messageManager.clear();
        milestoneCardManager.clear();
        hideBookColumns();
        return;
    }

    // Calculate progress through scroll spacer (0 to 1)
    const scrollStart = introHeight;
    const scrollEnd = closingOffset - window.innerHeight;
    const scrollRange = scrollEnd - scrollStart;

    const progress = Math.max(0, Math.min(1, (scrollY - scrollStart) / scrollRange));

    // Convert scroll progress to year
    const year = yearMapping.scrollToYear(progress);

    // Update displays
    renderer.update(year);
    renderer.highlight();

    // Update book visibility
    bookManager.updateForYear(year);

    // Update milestone card visibility
    milestoneCardManager.updateForYear(year);

    // Update message visibility
    messageManager.updateForYear(year);

    // Show book columns
    showBookColumns();
}

/**
 * Show book columns container
 */
function showBookColumns() {
    if (bookColumns && !bookColumns.classList.contains('visible')) {
        bookColumns.classList.add('visible');
    }
}

/**
 * Hide book columns container
 */
function hideBookColumns() {
    if (bookColumns) {
        bookColumns.classList.remove('visible');
    }
}

/**
 * Show error message
 */
function showError(message) {
    const container = document.querySelector('.timeline-content');
    if (container) {
        container.innerHTML = `
            <div class="error-message">
                <h2>Failed to load timeline</h2>
                <p>${message}</p>
            </div>
        `;
    }
}

/**
 * Debounce utility
 */
function debounce(fn, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
