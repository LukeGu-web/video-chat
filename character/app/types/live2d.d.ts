declare global {
  interface Window {
    Live2D: any;
    Live2DCubismCore: {
      startUp(): void;
      isStarted(): boolean;
      dispose(): void;
    };
  }
}

export {};