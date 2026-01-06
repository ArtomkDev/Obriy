// ✅ ДОДАЙ ЦЕЙ ІМПОРТ НА ПОЧАТКУ
import img1 from '../assets/electron.svg'

export const modsData = [
  {
    id: 1,
    title: 'Test Mod (x64a.rpf)',
    description: 'Тестовий мод: додає текстовий файл у архів x64a.rpf',
    image: img1, // Тепер ця змінна існує
    version: "0.1-beta",
    author: "Dev",
    instructions: [
      {
        // ⚠️ ВАЖЛИВО: Цей файл має існувати у папці гри. 
        // x64a.rpf зазвичай є у всіх.
        rpfPath: 'x64f.rpf', 
        
        // Як файл буде називатися всередині архіву
        internalPath: 'my_test_mod22.txt', 
        
        // ⚠️ ВАЖЛИВО: Цей файл має фізично існувати на твоєму диску для тесту.
        // Створи файл D:\TestMod\test.txt і напишіть туди щось.
        sourceFile: 'D:\\TestMod\\test.txt' 
      }
    ]
  },
  {
    id: 2,
    title: "Українські Білборди",
    description: "Замінює стандартну рекламу на реальні українські бренди та соціальну рекламу.",
    image: "https://media.gta5-mods.com/images/real-billboards-los-santos/47c010-1.jpg",
    version: "1.0",
    author: "UkrModder"
  },
  {
    id: 3,
    title: "Зимова Фізика Авто",
    description: "Змінює зчеплення з дорогою, роблячи керування складнішим на снігу.",
    image: "https://media.gta5-mods.com/images/snow-handling-mod/2b8c9c-Pic1.jpg",
    version: "2.5",
    author: "DriftKing"
  }
]