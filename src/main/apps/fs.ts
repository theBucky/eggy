// Electron's fs reads an asar archive as a folder, which would hash, patch, or remove an app wrongly.
export { constants, createReadStream, promises as fs, rmSync, type Stats } from 'original-fs'
