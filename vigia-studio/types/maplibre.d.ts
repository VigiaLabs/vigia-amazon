declare module 'maplibre-gl' {
  const maplibregl: any;
  export default maplibregl;
  export class Map {
    constructor(options: any);
    on(event: string, callback: (...args: any[]) => void): this;
    addControl(control: any, position?: string): this;
    addSource(id: string, source: any): this;
    addLayer(layer: any): this;
    getSource(id: string): any;
    flyTo(options: any): this;
    remove(): void;
  }
  export class NavigationControl {
    constructor(options?: any);
  }
}
