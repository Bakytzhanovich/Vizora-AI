"""HTTP scraping utilities for the knowledge base pipeline."""

import asyncio
import logging
import re
import urllib.robotparser
from datetime import datetime
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from scraper.sources import AGENCY_SEARCH_QUERIES, COMMUNITY_SEARCH_QUERIES, KNOWN_AGENCY_DOMAINS

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; VizoraBot/1.0; +https://vizora.kz/bot)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru,en;q=0.5",
}

# Per-domain robots.txt cache
_robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}


def _base_url(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


async def _check_robots(url: str, client: httpx.AsyncClient) -> bool:
    """Return True if scraping this URL is allowed per robots.txt."""
    base = _base_url(url)
    if base not in _robots_cache:
        robots_url = f"{base}/robots.txt"
        rp = urllib.robotparser.RobotFileParser()
        try:
            r = await client.get(robots_url, timeout=10.0)
            rp.parse(r.text.splitlines())
        except Exception:
            rp.allow_all = True
        _robots_cache[base] = rp
    return _robots_cache[base].can_fetch(_HEADERS["User-Agent"], url)


async def scrape_page(url: str) -> dict | None:
    """Fetch and extract clean text from a URL.

    Returns dict {url, title, raw_text, scraped_at} or None on failure.
    Respects robots.txt. Caps text at 50 000 characters.
    """
    try:
        async with httpx.AsyncClient(
            headers=_HEADERS,
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            if not await _check_robots(url, client):
                logger.info(f"robots.txt disallows: {url}")
                return None

            response = await client.get(url)
            response.raise_for_status()

            # Only process HTML
            ct = response.headers.get("content-type", "")
            if "html" not in ct:
                logger.info(f"Non-HTML content-type {ct}: {url}")
                return None

    except httpx.HTTPStatusError as e:
        logger.warning(f"HTTP {e.response.status_code} for {url}")
        return None
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None

    try:
        soup = BeautifulSoup(response.text, "lxml")

        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            tag.decompose()

        title = soup.find("title")
        title_text = title.get_text(strip=True) if title else ""

        main_content = (
            soup.find("main")
            or soup.find("article")
            or soup.find(id="content")
            or soup.find(id="main-content")
            or soup.find(class_=re.compile(r"content|main|article", re.I))
            or soup.find("body")
        )

        raw_text = main_content.get_text(separator="\n", strip=True) if main_content else ""
        raw_text = re.sub(r"\n{3,}", "\n\n", raw_text)
    except Exception as e:
        logger.warning(f"Failed to parse HTML from {url}: {e}")
        return None

    return {
        "url": url,
        "title": title_text,
        "raw_text": raw_text[:50_000],
        "scraped_at": datetime.utcnow(),
    }


async def _duckduckgo_search(query: str, max_results: int = 5) -> list[str]:
    """Search DuckDuckGo Lite and extract result URLs.

    Falls back to empty list if blocked or rate-limited.
    """
    search_url = "https://lite.duckduckgo.com/lite/"
    try:
        async with httpx.AsyncClient(headers=_HEADERS, timeout=20.0) as client:
            r = await client.post(search_url, data={"q": query})
            r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        urls: list[str] = []
        for a in soup.select("a.result-link"):
            href = a.get("href", "")
            if href.startswith("http") and len(urls) < max_results:
                urls.append(href)
        return urls
    except Exception as e:
        logger.warning(f"DDG search failed for '{query}': {e}")
        return []


def _is_agency_site(url: str) -> bool:
    """Heuristic: likely a KZ agency site, not a social/search/gov page."""
    skip_domains = {
        "reddit.com", "facebook.com", "instagram.com", "vk.com", "youtube.com",
        "google.com", "yandex.ru", "duckduckgo.com", "wikipedia.org",
        "travel.state.gov", "ustraveldocs.com", "irs.gov", "fmjfee.com",
    }
    domain = urlparse(url).netloc.lower().replace("www.", "")
    return not any(domain.endswith(skip) for skip in skip_domains)


def _is_community_site(url: str) -> bool:
    """Heuristic: likely a community/forum/blog page."""
    ok_domains = {
        "reddit.com", "vc.ru", "pikabu.ru", "otzovik.com",
        "irecommend.ru", "habr.com", "dtf.ru",
    }
    domain = urlparse(url).netloc.lower().replace("www.", "")
    return any(domain.endswith(ok) or "blog" in url or "forum" in url or "otzyv" in url
               for ok in ok_domains)


async def discover_agency_sites() -> list[str]:
    """Dynamically discover Kazakhstan W&T agency websites via web search.

    Falls back to KNOWN_AGENCY_DOMAINS if search returns nothing.
    """
    discovered: set[str] = set()

    for query in AGENCY_SEARCH_QUERIES:
        urls = await _duckduckgo_search(query, max_results=5)
        for url in urls:
            if _is_agency_site(url):
                discovered.add(url)
        await asyncio.sleep(3)  # rate-limit search requests

    if not discovered:
        logger.info("DDG returned no agency results — using fallback list")
        discovered = set(KNOWN_AGENCY_DOMAINS)

    logger.info(f"Discovered {len(discovered)} agency site(s)")
    return list(discovered)


async def discover_community_sources() -> list[str]:
    """Find recent blog/forum posts about W&T visa interview experiences."""
    discovered: set[str] = set()

    for query in COMMUNITY_SEARCH_QUERIES:
        urls = await _duckduckgo_search(query, max_results=5)
        for url in urls:
            # Accept any non-official source for community content
            domain = urlparse(url).netloc.lower()
            skip = {"travel.state.gov", "ustraveldocs.com", "irs.gov", "fmjfee.com"}
            if not any(domain.endswith(s) for s in skip):
                discovered.add(url)
        await asyncio.sleep(3)

    logger.info(f"Discovered {len(discovered)} community source(s)")
    return list(discovered)
