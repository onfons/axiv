import { create } from 'zustand';

interface AppState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;

  // Favorites
  favoriteIds: string[];
  setFavoriteIds: (ids: string[]) => void;

  // Toast State
  toast: {
    message: string;
    type: 'success' | 'error' | 'info';
    visible: boolean;
  };
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;

  // Confirm Modal State
  confirm: {
    title: string;
    message: string;
    visible: boolean;
    onConfirm: (() => void) | null;
  };
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  hideConfirm: () => void;

  // Input Modal State
  inputModal: {
    title: string;
    message: string;
    visible: boolean;
    defaultValue: string;
    placeholder: string;
    onConfirm: ((value: string) => void) | null;
  };
  showInputModal: (title: string, message: string, onConfirm: (value: string) => void, defaultValue?: string, placeholder?: string) => void;
  hideInputModal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedCategory: 'all',
  setSelectedCategory: (category) => set({ selectedCategory: category }),

  // Favorites
  favoriteIds: [],
  setFavoriteIds: (ids) => set({ favoriteIds: ids }),

  toast: { message: '', type: 'info', visible: false },
  showToast: (message, type = 'info') => {
    set({ toast: { message, type, visible: true } });
    setTimeout(() => set((state) => ({ toast: { ...state.toast, visible: false } })), 3000);
  },
  hideToast: () => set((state) => ({ toast: { ...state.toast, visible: false } })),

  confirm: { title: '', message: '', visible: false, onConfirm: null },
  showConfirm: (title, message, onConfirm) => set({
    confirm: { title, message, visible: true, onConfirm }
  }),
  hideConfirm: () => set((state) => ({ confirm: { ...state.confirm, visible: false } })),

  inputModal: { title: '', message: '', visible: false, defaultValue: '', placeholder: '', onConfirm: null },
  showInputModal: (title, message, onConfirm, defaultValue = '', placeholder = '') => set({
    inputModal: { title, message, visible: true, defaultValue, placeholder, onConfirm }
  }),
  hideInputModal: () => set((state) => ({ inputModal: { ...state.inputModal, visible: false } })),
}));

export type { AppState };
