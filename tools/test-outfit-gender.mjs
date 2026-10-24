// 校验「性别边界」：非「女」用户在任何温度带 × 场合 × 套数下都不会得到裙装类单品。
// 运行：node tools/test-outfit-gender.mjs（Node 22+ 原生支持直接 import .ts）
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const RULES = pathToFileURL(path.join(here, '..', 'miniprogram', 'utils', 'outfitRules.ts')).href

const TEMPS = [35, 22, 14, 5, -5] // 覆盖 hot / warm / cool / cold / freezing
const SCENES = ['daily', 'date', 'sport', 'party', 'formal']
const MALE_GENDERS = ['男', '不透露', '']

// 与 outfitRules.ts 的 FEMININE_PATTERN 对应，用于断言
const FEMININE = /裙|打底袜|打底裤|玛丽珍|泡泡袖|碎花|吊带|高跟鞋|一字肩|露肩|蕾丝|雪纺/

function weatherOf(temp) {
  return {
    city: '北京',
    temp,
    feelsLike: temp,
    text: '晴',
    windLevel: 2,
    icon: '☀️',
    season: '秋',
    tempMax: temp + 3,
    tempMin: temp - 4,
  }
}

function fields(outfit) {
  return {
    上装: outfit.top,
    外套: outfit.coat,
    内搭: outfit.inner,
    下装: outfit.bottom,
    鞋子: outfit.shoes,
  }
}

const rules = await import(RULES)
const failures = []
let checked = 0

for (const temp of TEMPS) {
  for (const scene of SCENES) {
    for (const gender of MALE_GENDERS) {
      const list = rules.recommendOutfits(weatherOf(temp), { gender, scene, ageBand: '18-24' })
      list.forEach((outfit, i) => {
        checked += 1
        const f = fields(outfit)
        Object.keys(f).forEach((key) => {
          if (f[key] && FEMININE.test(f[key])) {
            failures.push(
              `${temp}℃ / ${scene} / 性别「${gender || '空'}」/ 第${i + 1}套 → ${key}：${f[key]}`
            )
          }
        })
      })
    }
  }
}

// 女装分支不能被误伤：至少存在含裙装的方案
let femaleSkirt = 0
for (const temp of TEMPS) {
  for (const scene of SCENES) {
    rules.recommendOutfits(weatherOf(temp), { gender: '女', scene }).forEach((o) => {
      if (FEMININE.test(o.bottom)) femaleSkirt += 1
    })
  }
}

console.log(`已校验 ${checked} 套男性/未透露方案`)
console.log(`女装方案里含裙装的下装数：${femaleSkirt}`)

if (failures.length) {
  console.error('[fail] 发现不合性别的单品：')
  failures.slice(0, 20).forEach((f) => console.error('  ' + f))
  process.exit(1)
}
if (femaleSkirt === 0) {
  console.error('[fail] 女装分支没有裙装，可能是覆盖被误删')
  process.exit(1)
}
console.log('[ok] 性别边界通过')
