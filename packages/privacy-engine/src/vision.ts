/**
 * OCR / Vision / DOM abstraction interfaces.
 *
 * The demo perceives pages via the DOM (DOMAnalyzer). Screenshot OCR and
 * lightweight vision are declared here as pluggable seams with working mock
 * implementations, so a real on-device model (Tesseract WASM, a small ONNX
 * detector, etc.) can be dropped in without changing the pipeline.
 *
 * We do NOT claim the mock is equivalent to a production vision model.
 */
import type { BoundingBox, PagePerception, PerceivedElement } from '@pvcc/shared';

export interface OcrToken {
  text: string;
  box: BoundingBox;
  confidence: number;
}

export interface OCRProvider {
  name: string;
  /** Recognize text regions from raw image pixels. */
  recognize(image: ImageDataLike): Promise<OcrToken[]>;
}

export interface VisionProvider {
  name: string;
  /** Detect interactive/semantic regions from raw image pixels. */
  detect(image: ImageDataLike): Promise<PerceivedElement[]>;
}

export interface DOMAnalyzer {
  name: string;
  perceive(): PagePerception;
}

/** Minimal structural type so this compiles outside a DOM context too. */
export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/**
 * Mock OCR: returns nothing (the DOM already provides text in the demo). A real
 * implementation would run an OCR model over `image`.
 */
export class MockOCRProvider implements OCRProvider {
  name = 'mock.ocr';
  async recognize(_image: ImageDataLike): Promise<OcrToken[]> {
    return [];
  }
}

/** Mock Vision: no additional regions beyond the DOM in the demo. */
export class MockVisionProvider implements VisionProvider {
  name = 'mock.vision';
  async detect(_image: ImageDataLike): Promise<PerceivedElement[]> {
    return [];
  }
}
