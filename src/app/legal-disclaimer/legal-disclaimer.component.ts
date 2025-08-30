import { Component } from '@angular/core';

@Component({
  selector: 'app-legal-disclaimer',
  templateUrl: './legal-disclaimer.component.html',
  styleUrls: ['./legal-disclaimer.component.sass']
})
export class LegalDisclaimerComponent {
  isModalVisible = false;
  isFooterVisible = true;

  /**
   * Toggle legal disclaimer modal
   */
  toggleModal(): void {
    this.isModalVisible = !this.isModalVisible;
  }

  /**
   * Close modal
   */
  closeModal(): void {
    this.isModalVisible = false;
  }

  /**
   * Handle modal backdrop click
   */
  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  /**
   * Handle escape key
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal();
    }
  }
} 