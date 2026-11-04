import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  globalSearch: string;
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem('workpulse.sidebarCollapsed') === '1';
  } catch {
    return false;
  }
}

export const initialUiState: UiState = {
  sidebarCollapsed: typeof window === 'undefined' ? false : readCollapsed(),
  mobileNavOpen: false,
  globalSearch: '',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      try {
        window.localStorage.setItem('workpulse.sidebarCollapsed', state.sidebarCollapsed ? '1' : '0');
      } catch {
        // ignore
      }
    },
    mobileNavSet(state, action: PayloadAction<boolean>) {
      state.mobileNavOpen = action.payload;
    },
    globalSearchSet(state, action: PayloadAction<string>) {
      state.globalSearch = action.payload;
    },
  },
});

export const { sidebarToggled, mobileNavSet, globalSearchSet } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
