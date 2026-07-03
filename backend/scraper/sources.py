"""Static tier-1 sources and helpers for tier-2/3 discovery queries."""

TIER_1_SOURCES: list[dict] = [
    {
        "tier": 1,
        "source_name": "US State Department — J-1 Exchange Visas",
        "url": "https://travel.state.gov/content/travel/en/us-visas/study/exchange.html",
        "trust_level": "официальный источник",
        "category": "visa_j1",
    },
    {
        "tier": 1,
        "source_name": "US State Department — Student Visas Overview",
        "url": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
        "trust_level": "официальный источник",
        "category": "visa_j1",
    },
    {
        "tier": 1,
        "source_name": "US Travel Docs Kazakhstan",
        "url": "https://www.ustraveldocs.com/kz/",
        "trust_level": "официальный источник",
        "category": "visa_interview",
    },
    {
        "tier": 1,
        "source_name": "US Travel Docs Kazakhstan — Nonimmigrant Visa",
        "url": "https://www.ustraveldocs.com/kz/kz-niv-typej.asp",
        "trust_level": "официальный источник",
        "category": "visa_j1",
    },
    {
        "tier": 1,
        "source_name": "SEVIS Fee — SEVIS I-901",
        "url": "https://www.fmjfee.com/i901fee/index.html",
        "trust_level": "официальный источник",
        "category": "documents",
    },
    {
        "tier": 1,
        "source_name": "IRS — Foreign Student Tax Info",
        "url": "https://www.irs.gov/individuals/international-taxpayers/foreign-student-liability-for-social-security-and-medicare-taxes",
        "trust_level": "официальный источник",
        "category": "taxes",
    },
    {
        "tier": 1,
        "source_name": "IRS — J-1 Visa Holders Tax",
        "url": "https://www.irs.gov/individuals/international-taxpayers/taxation-of-nonresident-aliens",
        "trust_level": "официальный источник",
        "category": "taxes",
    },
    {
        "tier": 1,
        "source_name": "STEP — Smart Traveler Enrollment",
        "url": "https://step.state.gov/step/",
        "trust_level": "официальный источник",
        "category": "life_usa",
    },
]

# Search queries for dynamic tier-2/3 discovery
AGENCY_SEARCH_QUERIES: list[str] = [
    "Work and Travel Казахстан агентство официальный сайт визовая программа",
    "Work and Travel USA Алматы оформление документы агентство",
    "Work Travel Казахстан J1 виза агентство оформление",
]

COMMUNITY_SEARCH_QUERIES: list[str] = [
    "work and travel визовое интервью отзыв опыт казахстан",
    "J1 виза интервью вопросы реальный опыт студент",
    "work and travel казахстан отказ виза почему форум",
    "work and travel USA интервью консульство алматы отзыв",
]

# Known KZ agency domains as fallback when web search is unavailable
KNOWN_AGENCY_DOMAINS: list[str] = [
    "https://workantravel.kz",
    "https://watstudent.com",
    "https://workandtravelkz.com",
]
