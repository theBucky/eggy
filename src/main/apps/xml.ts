import { DOMParser, onErrorStopParsing, type Document } from '@xmldom/xmldom'

export function parseXml(text: string): Document {
  return new DOMParser({ onError: onErrorStopParsing }).parseFromString(text, 'text/xml')
}
