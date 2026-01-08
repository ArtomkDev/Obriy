import img1 from '../assets/electron16x9.png'
import img2 from '../assets/gtaimg.jpg'
import gtaVideo from '../assets/gtavideo.mp4'
import gtaVideoImg from '../assets/gtavideoimg.jpg'

export const mods = [
  // --- 1. ORIGINAL MOD ---
  {
    id: 1,
    title: 'Test Mod (update.rpf)',
    description: 'Тестовий мод: додає файл у папку common всередині update.rpf.',
    thumbnail: gtaVideoImg, // ВИПРАВЛЕНО: image -> thumbnail
    version: '0.1-beta',
    author: 'Dev',
    media: [
      { type: 'video_file', source: gtaVideo },
      { type: 'image', source: img1 }
    ],
    instructions: [
      {
        targetPath: 'TestMod\\common.rpf',
        sourceFile: 'D:\\Mods\\Billboards',
        vanillaFile: 'D:\\Mods\\BillboardsVanilla',
      }
    ]
  },
  // --- 2. ORIGINAL MOD ---
  {
    id: 2,
    title: 'CARABIN1',
    description: 'Караба',
    thumbnail: img1,
    version: '2.0',
    author: 'GalleryMaster',
    media: [
      { type: 'video_file', source: gtaVideo },
      { type: 'image', source: img1 },
      { type: 'image', source: img1 }
    ],
    instructions: [
      {
        targetPath: 'update\\x64\\dlcpacks\\patchday8ng\\dlc.rpf\\x64\\models\\cdimages\\weapons.rpf',
        sourceFile: 'D:\\Mods\\Gun',
        vanillaFile: 'D:\\Mods\\GunV',
      }
    ]
  },
  // --- 3. ORIGINAL MOD ---
  {
    id: 3,
    title: 'Billboards Pack',
    thumbnail: img2,
    version: '1.2',
    author: 'Designer',
    media: [
      { type: 'video_file', source: gtaVideo, thumbnail: gtaVideoImg },
      { type: 'image', source: img2 },
      { type: 'image', source: img2 },
      { type: 'image', source: gtaVideoImg },
      { type: 'image', source: img2 },
      { type: 'image', source: img1 },
      { type: 'video_file', source: gtaVideo, thumbnail: gtaVideoImg },
      { type: 'video_file', source: gtaVideo, thumbnail: gtaVideoImg },
      { type: 'video_file', source: gtaVideo, thumbnail: gtaVideoImg },
      { type: 'image', source: img2 },
      { type: 'image', source: img2 },
      { type: 'image', source: img1 },
      { type: 'image', source: img2 },
      { type: 'image', source: img1 },
      { type: 'video_file', source: gtaVideo },
      { type: 'video_file', source: gtaVideo }
    ],
    instructions: [
      {
        targetPath: 'TestMod\\update\\x64\\dlcpacks\\mpairraces\\dlc.rpf',
        sourceFile: 'D:\\Mods\\Billboards'
      },
      {
        targetPath: 'TestMod\\update\\x64\\dlcpacks\\mpairraces\\dlc.rpf\\common',
        sourceFile: 'D:\\ShareX\\Screenshots\\2025-03'
      },
      {
        targetPath: 'TestMod\\update\\x64\\dlcpacks\\mpairraces\\dlc.rpf',
        sourceFile: 'D:\\ShareX\\Screenshots\\2026-01'
      }
    ]
  },

  // --- НОВІ МОДИ (Картинки через URL теж працюватимуть) ---

  {
    id: 4,
    title: 'CARABA1_2',
    description: 'караба1_2',
    thumbnail: 'https://cdn2.unrealengine.com/gtav--46-3840x2160-b2bb82f50c5b.jpg',
    version: 'Gold',
    author: 'Razed',
    media: [
      {
        type: 'video_file',
        source: gtaVideo,
        thumbnail: 'https://cdn2.unrealengine.com/gtav--46-3840x2160-b2bb82f50c5b.jpg'
      },
      {
        type: 'image',
        source: 'https://cdn2.unrealengine.com/gtav--46-3840x2160-b2bb82f50c5b.jpg'
      },
      {
        type: 'image',
        source: 'https://img.gta5-mods.com/q75/images/snoopy-s-reshade-preset-for-nve/c30fbb-image_2023-04-20_091915417.png'
      }
    ],
    instructions: [
      {
        targetPath: 'update\\x64\\dlcpacks\\patchday8ng\\dlc.rpf\\x64\\models\\cdimages\\weapons.rpf',
        sourceFile: 'D:\\Mods\\Gun1',
        vanillaFile: 'D:\\Mods\\GunV',
      }
    ]
  },
  {
    id: 5,
    title: 'Lamborghini Aventador SVJ',
    description: 'Високоякісна модель Lamborghini Aventador SVJ. Підтримка тюнінгу, реалістичний хендлінг та 4K текстури салону.',
    thumbnail: 'https://www.gta-modding.com/area/uploads/1549.jpg',
    version: '1.5',
    author: 'Gta5KoRn',
    media: [
      { type: 'image', source: 'https://www.gta-modding.com/area/uploads/1549.jpg' },
      { type: 'image', source: img2 },
      {
        type: 'image',
        source: 'https://files.libertycity.ru/posts/2023-05/thumbs/1682952879_grand-theft-auto-v-screenshot.jpg'
      }
    ],
    instructions: []
  },
  {
    id: 6,
    title: 'Realistic Weapon Sounds',
    description: 'Повна заміна звуків зброї на більш гучні та реалістичні. Записано з реальних прототипів.',
    thumbnail: 'https://i.rutab.net/upload/2025/05/insider/35745a67df32fb172ae36d837df9d4ee.webp',
    version: '4.2',
    author: 'SoundMaster',
    media: [
      { type: 'video_file', source: gtaVideo },
      {
        type: 'image',
        source: 'https://i.rutab.net/upload/2025/05/insider/35745a67df32fb172ae36d837df9d4ee.webp'
      }
    ],
    instructions: []
  },
  {
    id: 7,
    title: 'GTA VI UI Concept',
    description: 'Змінює інтерфейс (HUD), карту та меню паузи на стиль із витоків GTA VI. Сучасний мінімалізм.',
    thumbnail: 'https://img.gta5-mods.com/q75/images/snoopy-s-reshade-preset-for-nve/c30fbb-image_2023-04-20_091915417.png',
    version: '0.9',
    author: 'UI_God',
    media: [
      {
        type: 'image',
        source: 'https://img.gta5-mods.com/q75/images/snoopy-s-reshade-preset-for-nve/c30fbb-image_2023-04-20_091915417.png'
      },
      { type: 'image', source: img1 }
    ],
    instructions: []
  },
  {
    id: 8,
    title: 'Zombie Apocalypse Z',
    description: 'Перетворює Лос-Сантос на зону відчуження. Зомбі бродять вулицями, електрика вимкнена, виживання ускладнене.',
    thumbnail: 'https://files.libertycity.ru/posts/2023-05/thumbs/1682952879_grand-theft-auto-v-screenshot.jpg',
    version: '2.1',
    author: 'Survivalist',
    media: [
      {
        type: 'video_file',
        source: gtaVideo,
        thumbnail: 'https://files.libertycity.ru/posts/2023-05/thumbs/1682952879_grand-theft-auto-v-screenshot.jpg'
      },
      {
        type: 'image',
        source: 'https://files.libertycity.ru/posts/2023-05/thumbs/1682952879_grand-theft-auto-v-screenshot.jpg'
      },
      { type: 'image', source: 'https://cdn2.unrealengine.com/gtav--46-3840x2160-b2bb82f50c5b.jpg' }
    ],
    instructions: []
  },
  {
    id: 9,
    title: '4K Satellite Map',
    description: 'Деталізована супутникова карта для меню паузи та радару. Висока чіткість зображення.',
    thumbnail: img1,
    version: '1.0',
    author: 'Mapper',
    media: [
      { type: 'image', source: img1 },
      { type: 'image', source: img2 }
    ],
    instructions: []
  },
  {
    id: 10,
    title: 'Better Handling V',
    description: 'Покращена фізика керування автомобілями. Машини відчуваються важчими, заноси стають контрольованими.',
    thumbnail: 'https://www.gta-modding.com/area/uploads/1549.jpg',
    version: 'Final',
    author: 'DriveMechanic',
    media: [
      { type: 'video_file', source: gtaVideo },
      { type: 'image', source: 'https://www.gta-modding.com/area/uploads/1549.jpg' },
      {
        type: 'image',
        source: 'https://i.rutab.net/upload/2025/05/insider/35745a67df32fb172ae36d837df9d4ee.webp'
      }
    ],
    instructions: []
  }
]