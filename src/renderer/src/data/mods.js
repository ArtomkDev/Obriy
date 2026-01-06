// ✅ ДОДАЙ ЦЕЙ ІМПОРТ НА ПОЧАТКУ
import img1 from '../assets/electron.svg'

export const modsData = [
  {
    id: 1,
    title: 'Test Mod (update.rpf)',
    description: 'Тестовий мод: додає файл у папку common всередині update.rpf',
    image: img1,
    version: '0.1-beta',
    author: 'Dev',
    instructions: [
      {
        rpfPath: 'update\\update.rpf',

        internalPath: 'common\\my_test_mod22.txt',

        sourceFile: 'D:\\TestMod\\test.txt'
      }
    ]
  },
  {
    id: 2,
    title: 'Українські Білборди',
    description: 'Замінює стандартну рекламу на реальні українські бренди та соціальну рекламу.',
    image: img1,
    version: '1.0',
    author: 'UkrModder'
  },
  {
    id: 3,
    title: 'Billboards Pack (Directory Mode)',
    image: img1,
    instructions: [
      {
        targetPath: 'TestMod\\update\\x64\\dlcpacks\\mpairraces\\dlc.rpf',
        sourceFile: 'D:\\Mods\\Billboards'
      },
      {
        targetPath: 'TestMod\\update\\x64\\dlcpacks\\mpairraces\\dlc.rpf\\common',
        sourceFile: 'D:\\ShareX\\Screenshots\\2025-02'
      }
    ]
  }
]
