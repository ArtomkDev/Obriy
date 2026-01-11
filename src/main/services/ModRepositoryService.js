import { net } from 'electron'

// ❗ Встав сюди посилання на твій бакет obriy-store
// Наприклад: 'https://pub-твої-цифри.r2.dev/catalog.json'
const REPOSITORY_URL = 'https://pub-af821b9413f74a56ad45f675b24a2fac.r2.dev/catalog.json'

class ModRepositoryService {
  constructor() {
    this.cachedCatalog = null
    this.lastFetchTime = 0
    this.CACHE_TTL = 1000 * 60 * 5 // Кешуємо список на 5 хвилин
  }

  async getCatalog() {
    const now = Date.now()
    // Якщо є кеш і він свіжий — віддаємо його, економимо трафік
    if (this.cachedCatalog && (now - this.lastFetchTime < this.CACHE_TTL)) {
      return this.cachedCatalog
    }

    console.log('[ModRepository] Downloading catalog from Cloudflare...')
    
    return new Promise((resolve, reject) => {
      const request = net.request(REPOSITORY_URL)
      
      request.on('response', (response) => {
        let body = ''
        
        response.on('data', (chunk) => {
          body += chunk.toString()
        })
        
        response.on('end', () => {
          if (response.statusCode !== 200) {
             console.error(`[ModRepository] Error: HTTP ${response.statusCode}`)
             resolve([]) // Повертаємо пустий список, щоб програма не впала
             return
          }
          
          try {
            const data = JSON.parse(body)
            // Підстраховка: якщо JSON має поле "mods", беремо його, інакше весь об'єкт
            this.cachedCatalog = data.mods || data 
            this.lastFetchTime = Date.now()
            resolve(this.cachedCatalog)
          } catch (error) {
            console.error('[ModRepository] JSON Parse Error:', error)
            resolve([]) 
          }
        })
      })

      request.on('error', (error) => {
        console.error('[ModRepository] Network Error:', error)
        resolve([])
      })

      request.end()
    })
  }
}

export const modRepository = new ModRepositoryService()