/**
 * Export Dropdown Component
 * Handles the dropdown menu for export options (PDF, Word, Excel)
 */

class ExportDropdown {
    constructor(element) {
        this.dropdown = element;
        this.trigger = element.querySelector('.export-dropdown__trigger');
        this.menu = element.querySelector('.export-dropdown__menu');

        this.init();
    }

    init() {
        // Toggle dropdown on trigger click
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.close();
            }
        });

        // Close dropdown when pressing Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    toggle() {
        if (this.dropdown.classList.contains('active')) {
            this.close();
        } else {
            this.open();
        }
    }

    close() {
        this.dropdown.classList.remove('active');
        // Remove z-index fix from parent card
        const parentCard = this.dropdown.closest('.report-card');
        if (parentCard) {
            parentCard.classList.remove('z-index-active');
        }
    }

    open() {
        // Close all other instances first
        document.querySelectorAll('.export-dropdown.active').forEach(el => {
            el.classList.remove('active');
            const card = el.closest('.report-card');
            if (card) card.classList.remove('z-index-active');
        });

        this.dropdown.classList.add('active');

        // Add z-index fix to parent card so it shows above others
        const parentCard = this.dropdown.closest('.report-card');
        if (parentCard) {
            parentCard.classList.add('z-index-active');
        }
    }
}

// Initialize all export dropdowns on page load
document.addEventListener('DOMContentLoaded', () => {
    const dropdowns = document.querySelectorAll('.export-dropdown');
    dropdowns.forEach(dropdown => new ExportDropdown(dropdown));
});
