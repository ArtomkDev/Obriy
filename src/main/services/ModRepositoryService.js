import { net } from 'electron'

// Base URL (додай слеш в кінці)
const BASE_URL = 'https://pub-af821b9413f74a56ad45f675b24a2fac.r2.dev/v1/'

class ModRepositoryService {
  constructor() {
    this.cachedIndex = null
    this.lastFetchTime = 0
    this.CACHE_TTL = 1000 * 60 * 5 // 5 хвилин
  }

  // Приватний метод для запитів
  async _fetch(endpoint) {
    const timestamp = Date.now()
    const url = `${BASE_URL}${endpoint}?t=${timestamp}`

    console.log(`[ModRepository] Requesting: ${url}`); // <--- ЛОГ 1

    return new Promise((resolve, reject) => {
      const request = net.request(url)
      
      request.on('response', (response) => {
        console.log(`[ModRepository] Status: ${response.statusCode} for ${endpoint}`); // <--- ЛОГ 2
        
        let body = ''
        response.on('data', (chunk) => body += chunk.toString())
        response.on('end', () => {
          if (response.statusCode !== 200) {
             console.error(`[ModRepository] Failed to fetch. Status: ${response.statusCode}`);
             return resolve(null)
          }
          try {
            const json = JSON.parse(body);
            console.log(`[ModRepository] Success! Data length: ${JSON.stringify(json).length}`); // <--- ЛОГ 3
            resolve(json)
          } catch (e) {
            console.error(`[ModRepository] JSON Parse Error for ${url}:`, e);
            resolve(null)
          }
        })
      })

      request.on('error', (e) => {
        console.error(`[ModRepository] Network Error for ${url}:`, e)
        resolve(null)
      })
      
      request.end()
    })
  }

  // Отримати список (для ModsPage)
  // Отримати список (для ModsPage)
  // Отримати список (для ModsPage)
  async getCatalog() {
    const now = Date.now()
    
    // (Якщо ви вмикали кеш, тут він може заважати, тому краще поки тримати вимкненим або очистити)
    // if (this.cachedIndex && ...) { ... }

    const data = await this._fetch('index.min.json')
    if (data) {
      this.cachedIndex = data.map(item => ({
        id: item.id,
        title: item.t,
        author: item.a,
        category: item.c,
        tags: item.tags,
        thumbnail: item.th,
        uploadDate: item.d,
        version: item.v,
        archive: item.ar,
        
        // !!! ДОДАЄМО ЦЕЙ РЯДОК !!!
        instructionId: item.ii // Розгортаємо скорочення
      }))
      this.lastFetchTime = now
      return this.cachedIndex
    }
    return []
  }


  async getInstructions() {
    // Інструкції дуже легкі, але критично важливі.
    // Можна не кешувати довго або кешувати тільки в пам'яті сесії.
    if (this.cachedInstructions) return this.cachedInstructions
    
    const data = await this._fetch('instructions.json')
    if (data) {
        this.cachedInstructions = data
        return data
    }
    return {}
  }

  // Отримати деталі (для ModDetailsPage)
  async getModDetails(modId) {
    // Деталі не кешуємо в пам'яті надовго, або покладаємось на HTTP кеш
    const data = await this._fetch(`mods/${modId}.json`)
    return data
  }
}

export const modRepository = new ModRepositoryService()