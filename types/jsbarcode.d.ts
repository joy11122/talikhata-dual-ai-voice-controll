declare module 'jsbarcode' {
  interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    margin?: number;
    background?: string;
    lineColor?: string;
    fontSize?: number;
    textMargin?: number;
  }

  interface JsBarcodeFn {
    (element: SVGElement | HTMLElement | string, value: string, options?: JsBarcodeOptions): void;
  }

  const JsBarcode: JsBarcodeFn;
  export default JsBarcode;
}
