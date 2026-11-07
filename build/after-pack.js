import { rm } from 'node:fs/promises'
import { join } from 'node:path'

// Chromium loads SwiftShader, its CPU WebGL fallback, only behind `--enable-unsafe-swiftshader`.
export default async function afterPack({ appOutDir, packager }) {
  const libraries = join(packager.getMacOsElectronFrameworkResourcesDir(appOutDir), '../Libraries')

  await rm(join(libraries, 'libvk_swiftshader.dylib'))
  await rm(join(libraries, 'vk_swiftshader_icd.json'))
}
