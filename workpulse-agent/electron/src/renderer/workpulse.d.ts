import type { WorkPulseBridge } from '@shared/bridge';

declare global {
  interface Window {
    workpulse: WorkPulseBridge;
  }
}

export {};
