/**
 * Message Manager - Handles floating message boxes that appear during specific time periods
 *
 * Messages are displayed based on year ranges and provide historical context
 * (e.g., explaining Apostolic Tradition during the early Church Age)
 */

export class MessageManager {
    /**
     * @param {Array} messages - Array of message objects with yearStart, yearEnd, title, content
     */
    constructor(messages) {
        this.messages = messages;
        this.container = document.getElementById('message-container');

        // Track visible messages: messageId → { element, message, visible }
        this.visibleMessages = new Map();

        // Pre-process messages for quick lookup
        this.messagesByRange = this.preprocessMessages();

        this.currentYear = null;
    }

    /**
     * Pre-process messages into a sorted list for efficient visibility checks
     */
    preprocessMessages() {
        return this.messages
            .map(message => ({
                ...message,
                // Add any computed properties here if needed
            }))
            .sort((a, b) => a.yearStart - b.yearStart);
    }

    /**
     * Update message visibility for a given year
     * @param {number} year - Current year in timeline
     */
    updateForYear(year) {
        this.currentYear = year;

        for (const message of this.messagesByRange) {
            const shouldBeVisible = year >= message.yearStart && year <= message.yearEnd;
            const isCurrentlyVisible = this.visibleMessages.has(message.id);

            if (shouldBeVisible && !isCurrentlyVisible) {
                // Show message
                this.showMessage(message);
            } else if (!shouldBeVisible && isCurrentlyVisible) {
                // Hide message
                this.hideMessage(message.id);
            }

            // Update opacity based on position within range (for fade effect)
            if (shouldBeVisible && isCurrentlyVisible) {
                this.updateMessageOpacity(message, year);
            }
        }
    }

    /**
     * Show a message
     * @param {Object} message - Message object
     */
    showMessage(message) {
        if (!this.container) return;

        const element = this.createMessageElement(message);
        this.container.appendChild(element);

        // Trigger reflow for transition
        element.offsetHeight;

        // Add visible class after a frame for animation
        requestAnimationFrame(() => {
            element.classList.add('visible');
        });

        this.visibleMessages.set(message.id, {
            element,
            message,
            visible: true
        });
    }

    /**
     * Hide a message
     * @param {string} messageId - Message ID to hide
     */
    hideMessage(messageId) {
        const data = this.visibleMessages.get(messageId);
        if (!data) return;

        const { element } = data;

        // Remove visible class to trigger fade out
        element.classList.remove('visible');

        // Remove from DOM after transition
        element.addEventListener('transitionend', () => {
            element.remove();
        }, { once: true });

        // Fallback removal in case transitionend doesn't fire
        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
            }
        }, 500);

        this.visibleMessages.delete(messageId);
    }

    /**
     * Update message opacity based on position in year range
     * Fades in at start, full opacity in middle, fades out at end
     * @param {Object} message - Message object
     * @param {number} year - Current year
     */
    updateMessageOpacity(message, year) {
        const data = this.visibleMessages.get(message.id);
        if (!data) return;

        const range = message.yearEnd - message.yearStart;
        const position = year - message.yearStart;
        const progress = position / range;

        // Fade in over first 10%, fade out over last 10%
        let opacity = 1;
        if (progress < 0.1) {
            opacity = progress / 0.1;
        } else if (progress > 0.9) {
            opacity = (1 - progress) / 0.1;
        }

        data.element.style.setProperty('--message-opacity', opacity);
    }

    /**
     * Create a message element
     * @param {Object} message - Message object
     * @returns {HTMLElement} Message element
     */
    createMessageElement(message) {
        const box = document.createElement('div');
        box.className = 'message-box';
        box.dataset.messageId = message.id;

        box.innerHTML = `
            <h3 class="message-box__title">${message.title}</h3>
            <p class="message-box__content">${message.content}</p>
        `;

        return box;
    }

    /**
     * Get current visible message count
     * @returns {number} Number of visible messages
     */
    getVisibleCount() {
        return this.visibleMessages.size;
    }

    /**
     * Clear all visible messages
     */
    clear() {
        for (const [messageId] of this.visibleMessages) {
            this.hideMessage(messageId);
        }
        this.currentYear = null;
    }
}
