/**
 * Book Manager - Manages book visibility and smooth scrolling positions
 *
 * Books scroll through the viewport:
 * 1. Entry phase: Slides in from bottom as year approaches start date
 * 2. Visible phase: Parked in center between start and end dates
 * 3. Exit phase: Slides out to top as year passes end date
 */

import { getDisplayDate, formatDateRange, getEraForYear } from './data-loader.js';

// Dynamic lead years based on busyness
const LEAD_YEARS_MIN = 1;  // Busy periods (many overlapping books)
const LEAD_YEARS_MAX = 20; // Quiet periods (few books)
// Dynamic scroll range (how far books travel during animation)
const SCROLL_RANGE_MIN = 30;  // Busy periods - subtle fade-slide
const SCROLL_RANGE_MAX = 120; // Quiet periods - dramatic slide
const GRID_COLUMNS = 4;
const GRID_ROWS = 3;
const TOTAL_CELLS = GRID_COLUMNS * GRID_ROWS;

export class BookManager {
    /**
     * @param {Array} books - Array of book objects with date properties
     * @param {HTMLElement} container - Container element for book grid
     */
    constructor(books, container) {
        this.books = books;
        this.container = container;

        // Track visible books: bookId → { element, book, era, cell }
        this.visibleBooks = new Map();

        // Track which grid cells are occupied: cell index → bookId
        this.occupiedCells = new Map();

        // Background element for hover effect
        this.backgroundElement = document.getElementById('book-background');
        this.blurElement = this.backgroundElement?.querySelector('.book-background__blur');
        this.sharpElement = this.backgroundElement?.querySelector('.book-background__sharp');
        this.activeHoverBook = null;
        this.lastShowTime = 0; // Track when background was shown to prevent immediate toggle

        // Pre-process books for quick lookup
        this.booksByDate = this.preprocessBooks();

        this.currentYear = null;
    }

    /**
     * Pre-process books into a sorted list for efficient visibility checks
     * Calculates dynamic lead times based on how busy each time period is
     */
    preprocessBooks() {
        // First pass: collect all book date ranges
        const bookRanges = this.books
            .map(book => {
                const date = getDisplayDate(book);
                return {
                    book,
                    start: date.start,
                    end: date.end,
                    isWritingDate: date.isWritingDate
                };
            })
            .filter(b => b.start !== null);

        // Second pass: calculate overlap count for each book
        const processedBooks = bookRanges.map(entry => {
            const { book, start, end, isWritingDate } = entry;
            const centerYear = Math.round((start + end) / 2);
            const era = getEraForYear(centerYear);

            // Count how many other books overlap with this book's time range
            let overlapCount = 0;
            for (const other of bookRanges) {
                if (other.book.id === book.id) continue;
                // Check if ranges overlap
                if (other.start <= end && other.end >= start) {
                    overlapCount++;
                }
            }

            // Calculate dynamic values: more overlap = shorter lead time & smaller scroll range
            // 0 overlaps → MAX values (slow, dramatic)
            // 8+ overlaps → MIN values (fast, subtle)
            const overlapFactor = Math.min(1, overlapCount / 8);
            const leadYears = Math.round(
                LEAD_YEARS_MAX - (overlapFactor * (LEAD_YEARS_MAX - LEAD_YEARS_MIN))
            );
            const scrollRange = Math.round(
                SCROLL_RANGE_MAX - (overlapFactor * (SCROLL_RANGE_MAX - SCROLL_RANGE_MIN))
            );

            return {
                book,
                start,
                end,
                isWritingDate,
                era,
                leadYears,
                scrollRange,
                // Extended range for animation
                entryStart: start - leadYears,
                exitEnd: end + leadYears
            };
        });

        return processedBooks.sort((a, b) => a.start - b.start);
    }

    /**
     * Update book visibility and positions for a given year
     * @param {number} year - Current year in timeline
     */
    updateForYear(year) {
        this.currentYear = year;

        // Determine which books should be in the extended visible range
        const shouldBeVisible = new Set();

        for (const entry of this.booksByDate) {
            if (year >= entry.entryStart && year <= entry.exitEnd) {
                shouldBeVisible.add(entry.book.id);
            }
        }

        // Remove books that are completely out of range
        const toRemove = [];
        for (const [bookId, data] of this.visibleBooks) {
            if (!shouldBeVisible.has(bookId)) {
                toRemove.push(bookId);
            }
        }

        for (const bookId of toRemove) {
            this.removeBook(bookId);
        }

        // Add books that should be visible and update all positions
        for (const entry of this.booksByDate) {
            if (!shouldBeVisible.has(entry.book.id)) continue;

            // Try to add to DOM if not already there
            // Keep trying each frame in case a column frees up
            if (!this.visibleBooks.has(entry.book.id)) {
                this.addBook(entry.book, entry.isWritingDate, entry.era);
            }

            // Only update position if the book was successfully added
            if (this.visibleBooks.has(entry.book.id)) {
                const position = this.calculatePosition(year, entry);
                this.updateBookPosition(entry.book.id, position);
            }
        }
    }

    /**
     * Calculate the vertical position of a book based on current year
     * @param {number} year - Current year
     * @param {Object} entry - Book entry with start/end/leadYears/scrollRange
     * @returns {Object} { translateY, opacity, phase }
     */
    calculatePosition(year, entry) {
        const { start, end, leadYears, scrollRange } = entry;

        // Entry phase: sliding in from bottom
        if (year < start) {
            const progress = (year - (start - leadYears)) / leadYears;
            return {
                translateY: (1 - progress) * scrollRange,
                opacity: Math.min(1, progress * 1.5),
                phase: 'entering'
            };
        }

        // Visible phase: parked in center
        if (year >= start && year <= end) {
            return {
                translateY: 0,
                opacity: 1,
                phase: 'visible'
            };
        }

        // Exit phase: sliding out to top
        if (year > end) {
            const progress = (year - end) / leadYears;
            return {
                translateY: -progress * scrollRange,
                opacity: Math.max(0, 1 - progress * 1.5),
                phase: 'exiting'
            };
        }

        return { translateY: 0, opacity: 1, phase: 'visible' };
    }

    /**
     * Update a book's visual position
     * @param {string} bookId - Book ID
     * @param {Object} position - { translateY, opacity, phase }
     */
    updateBookPosition(bookId, position) {
        const data = this.visibleBooks.get(bookId);
        if (!data || !data.element) return;

        const { translateY, opacity, phase } = position;

        // Apply transform and opacity directly
        data.element.style.transform = `translateY(${translateY}%)`;
        data.element.style.opacity = opacity;
        data.element.dataset.phase = phase;
    }

    /**
     * Find the first available grid cell
     * @returns {number|null} Cell index (0-11) or null if grid is full
     */
    findAvailableCell() {
        for (let i = 0; i < TOTAL_CELLS; i++) {
            if (!this.occupiedCells.has(i)) {
                return i;
            }
        }
        return null;
    }

    /**
     * Convert cell index to grid position
     * @param {number} cellIndex - Cell index (0-11)
     * @returns {Object} { row, column } (1-based for CSS grid)
     */
    cellToGridPosition(cellIndex) {
        const row = Math.floor(cellIndex / GRID_COLUMNS) + 1;
        const column = (cellIndex % GRID_COLUMNS) + 1;
        return { row, column };
    }

    /**
     * Add a book to the display
     * @param {Object} book - Book object
     * @param {boolean} isWritingDate - Whether using writing date
     * @param {Object} era - Era object for the book
     */
    addBook(book, isWritingDate, era) {
        // Find an available cell
        const cell = this.findAvailableCell();
        if (cell === null) {
            // Grid is full, skip this book
            return;
        }

        // Create book card element
        const element = this.createBookCard(book, isWritingDate, era);

        // Assign fixed grid position
        const { row, column } = this.cellToGridPosition(cell);
        element.style.gridRow = row;
        element.style.gridColumn = column;

        // Mark cell as occupied
        this.occupiedCells.set(cell, book.id);

        // Store reference with cell assignment
        this.visibleBooks.set(book.id, { element, book, era, cell });

        // Add to container
        this.container.appendChild(element);
    }

    /**
     * Remove a book from the display
     * @param {string} bookId - Book ID to remove
     */
    removeBook(bookId) {
        const data = this.visibleBooks.get(bookId);
        if (!data) return;

        const { element, cell } = data;

        // If this book was showing the background, hide it
        if (this.activeHoverBook === bookId) {
            this.hideBackground();
        }

        // Free up the grid cell
        if (cell !== undefined) {
            this.occupiedCells.delete(cell);
        }

        // Remove from DOM
        element.remove();
        this.visibleBooks.delete(bookId);
    }

    /**
     * Create a book card element
     * @param {Object} book - Book object
     * @param {boolean} isWritingDate - Whether using writing date
     * @param {Object} era - Era object for the book
     * @returns {HTMLElement} Book card element
     */
    createBookCard(book, isWritingDate, era) {
        const date = getDisplayDate(book);
        const dateDisplay = isWritingDate
            ? `Written c. ${formatDateRange(date.start, date.end)}`
            : formatDateRange(date.start, date.end);

        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.bookId = book.id;
        card.dataset.era = era ? era.id : 'wisdom';

        card.innerHTML = `
            <h3 class="book-card__title">${book.name}</h3>
            <p class="book-card__date">${dateDisplay}</p>
            <p class="book-card__meta">${book.verseCount.toLocaleString()} verses</p>
        `;

        // Add hover handlers for background effect
        card.addEventListener('mouseenter', () => this.showBackground(era, book.id));
        card.addEventListener('mouseleave', () => this.hideBackground());

        // Add click handler for mobile
        card.addEventListener('click', (e) => this.toggleBackground(era, book.id, e));

        return card;
    }

    /**
     * Show the era background
     * @param {Object} era - Era object
     * @param {string} bookId - Book ID triggering the background
     */
    showBackground(era, bookId) {
        if (!this.backgroundElement) return;
        this.activeHoverBook = bookId;
        this.lastShowTime = Date.now();

        // Check for book-specific background image
        const bookData = this.visibleBooks.get(bookId);
        if (bookData?.book?.backgroundImage) {
            // Use book-specific image on both blur and sharp layers
            const imageUrl = `url('${bookData.book.backgroundImage}')`;
            if (this.blurElement) this.blurElement.style.backgroundImage = imageUrl;
            if (this.sharpElement) this.sharpElement.style.backgroundImage = imageUrl;
            this.backgroundElement.classList.add('has-image');
            this.backgroundElement.removeAttribute('data-era');
        } else if (era) {
            // Fall back to era gradient
            if (this.blurElement) this.blurElement.style.backgroundImage = '';
            if (this.sharpElement) this.sharpElement.style.backgroundImage = '';
            this.backgroundElement.classList.remove('has-image');
            this.backgroundElement.dataset.era = era.id;
        }

        this.backgroundElement.classList.add('visible');
    }

    /**
     * Hide the era background
     */
    hideBackground() {
        if (!this.backgroundElement) return;
        this.backgroundElement.classList.remove('visible');
        this.backgroundElement.classList.remove('has-image');
        this.activeHoverBook = null;
    }

    /**
     * Toggle background on click (for mobile)
     * @param {Object} era - Era object
     * @param {string} bookId - Book ID
     * @param {Event} e - Click event
     */
    toggleBackground(era, bookId, e) {
        if (!this.backgroundElement) return;

        // If already showing this book's background, check if we should hide it
        if (this.activeHoverBook === bookId) {
            // On mobile, mouseenter fires right before click on the same tap
            // If background was just shown (within 100ms), this is the same tap - don't toggle off
            const timeSinceShow = Date.now() - this.lastShowTime;
            if (timeSinceShow > 100) {
                this.hideBackground();
            }
            return;
        }

        // Show this book's background (reuse showBackground logic)
        this.showBackground(era, bookId);
    }

    /**
     * Get current visible book count
     * @returns {number} Number of visible books
     */
    getVisibleCount() {
        return this.visibleBooks.size;
    }

    /**
     * Get array of currently visible books
     * @returns {Array} Array of book objects
     */
    getVisibleBooks() {
        return Array.from(this.visibleBooks.values()).map(v => v.book);
    }

    /**
     * Clear all visible books
     */
    clear() {
        for (const [bookId] of this.visibleBooks) {
            this.removeBook(bookId);
        }
        this.occupiedCells.clear();
        this.currentYear = null;
    }

    /**
     * Debug: log current state
     */
    debugState() {
        console.group('BookManager State');
        console.log('Current Year:', this.currentYear);
        console.log('Visible Books:', this.visibleBooks.size);
        for (const [id, data] of this.visibleBooks) {
            const entry = this.booksByDate.find(e => e.book.id === id);
            if (entry) {
                const pos = this.calculatePosition(this.currentYear, entry);
                console.log(`  ${data.book.name}: phase=${pos.phase}, y=${pos.translateY.toFixed(0)}%`);
            }
        }
        console.groupEnd();
    }
}
