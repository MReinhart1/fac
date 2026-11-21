// Search and sharing basics on every public page. (The site is a demo, so it also asks search engines not to list
// it; see public.spec.js. These checks keep the pages ready for the day that changes.)
import { expect, test } from './fixtures.js'

const PAGES = ['/', '/dates', '/pricing', '/locations', '/hunter-education', '/faq', '/contact', '/register', '/certified', '/consent', '/links', '/privacy']

test('every public page has its own title, description, one main heading and a canonical address', async ({ page }) => {
  const titles = new Map()
  const descriptions = new Map()
  for (const path of PAGES) {
    await page.goto(path)
    const title = await page.title()
    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(title.length, `${path} title "${title}"`).toBeGreaterThan(10)
    expect(title.length, `${path} title "${title}"`).toBeLessThanOrEqual(70)
    expect(description?.length ?? 0, `${path} description`).toBeGreaterThanOrEqual(50)
    expect(description.length, `${path} description`).toBeLessThanOrEqual(170)
    await expect(page.locator('h1'), path).toHaveCount(1)
    await expect(page.locator('html'), path).toHaveAttribute('lang', 'en-CA')
    await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute('href', `https://mreinhart-fac-demo.com${path === '/' ? '/' : path}`)
    await expect(page.locator('meta[property="og:title"]'), path).toHaveAttribute('content', title)
    titles.set(title, [...(titles.get(title) ?? []), path])
    descriptions.set(description, [...(descriptions.get(description) ?? []), path])
  }
  expect([...titles.values()].filter((paths) => paths.length > 1), 'pages sharing a title').toEqual([])
  expect([...descriptions.values()].filter((paths) => paths.length > 1), 'pages sharing a description').toEqual([])
})
