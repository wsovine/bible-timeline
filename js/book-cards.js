/**
 * Book Cards - Generates timeline content with grouped/side-by-side layout
 */

import {
    getDisplayDate,
    formatDateRange,
    groupBooksByTime,
    calculateScrollPositions
} from './data-loader.js';

/**
 * Process books and generate grouped steps
 * @param {Array} books - Array of book objects
 * @param {HTMLElement} container - Container element
 * @returns {Array} Processed groups with scroll positions
 */
export function generateBookGroups(books, container) {
    if (!container) {
        console.error('Book container not found');
        return [];
    }

    // Group books by time period
    const groups = groupBooksByTime(books);

    // Calculate scroll positions with gap compression
    const positionedGroups = calculateScrollPositions(groups);

    console.log(`Generated ${positionedGroups.length} groups from ${books.length} books`);

    // Generate DOM elements
    positionedGroups.forEach((group, index) => {
        const element = createGroupElement(group, index);
        container.appendChild(element);
    });

    return positionedGroups;
}

/**
 * Create a group element (may contain multiple books side-by-side)
 */
function createGroupElement(group, index) {
    const section = document.createElement('section');
    section.className = 'timeline-step';
    section.dataset.step = `group-${index}`;
    section.dataset.groupIndex = index;
    section.dataset.scrollPosition = group.scrollPosition;

    if (group.centerDate !== null) {
        section.dataset.centerDate = group.centerDate;
        section.dataset.era = group.era.id;
        section.dataset.eraName = group.era.name;
    }

    // Single book or multiple books?
    if (group.books.length === 1) {
        section.innerHTML = createSingleBookContent(group.books[0]);
    } else {
        section.innerHTML = createMultiBookContent(group);
    }

    return section;
}

/**
 * Create content for a single book
 */
function createSingleBookContent(book) {
    const date = getDisplayDate(book);
    const dateDisplay = date.isWritingDate
        ? `Written circa ${formatDateRange(date.start, date.end)}`
        : formatDateRange(date.start, date.end);

    return `
        <div class="step-content">
            <h2 class="book-title">${book.name}</h2>
            <p class="book-description">${dateDisplay}</p>
            <p class="book-meta">${book.verseCount.toLocaleString()} verses · ${book.testament === 'OT' ? 'Old Testament' : 'New Testament'}${book.isDeuterocanonical ? ' · Deuterocanonical' : ''}</p>
        </div>
    `;
}

/**
 * Create content for multiple concurrent books (side-by-side)
 */
function createMultiBookContent(group) {
    const booksHtml = group.books.map(book => {
        const date = getDisplayDate(book);
        const dateDisplay = date.isWritingDate
            ? `Written c. ${formatDateRange(date.start, date.end)}`
            : formatDateRange(date.start, date.end);

        return `
            <div class="book-item">
                <h3 class="book-item__title">${book.name}</h3>
                <p class="book-item__date">${dateDisplay}</p>
                <p class="book-item__meta">${book.verseCount.toLocaleString()} verses</p>
            </div>
        `;
    }).join('');

    // Group era info
    const eraName = group.era ? group.era.name : '';

    return `
        <div class="step-content step-content--multi">
            <div class="book-group">
                ${booksHtml}
            </div>
            <p class="group-meta">${group.books.length} books from the same era</p>
        </div>
    `;
}

/**
 * Get group data from a step element
 */
export function getStepGroupData(element) {
    return {
        groupIndex: parseInt(element.dataset.groupIndex, 10),
        scrollPosition: parseFloat(element.dataset.scrollPosition),
        centerDate: element.dataset.centerDate ? parseInt(element.dataset.centerDate, 10) : null,
        era: element.dataset.era || null,
        eraName: element.dataset.eraName || null
    };
}
