export const modsData = [
  {
    id: 1,
    title: "Новорічні Гірлянди (Legion Square)",
    description: "Додає атмосферні гірлянди на площу Легіону. Ідеально для зимового вайбу.",
    image: "https://media.gta5-mods.com/images/legion-square-christmas-party-menyoo/89e528-2.jpg",
    version: "1.2",
    author: "ArtemKoval",
    // Технічна конфігурація для інсталятора
    installConfig: {
      // Шлях відносно папки гри
      targetRpf: "x64a.rpf", 
      // Шлях всередині архіву (поки працює тільки в корені RPF, як ми робили в C#)
      internalPath: "levels/gta5/props/lev_des/v_minigame.rpf", // Приклад
      // У реальному додатку тут буде URL для завантаження, а поки - тестовий локальний файл
      testSourceFile: "C:\\Windows\\System32\\notepad.exe" // ТІЛЬКИ ДЛЯ ТЕСТУ!
    }
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