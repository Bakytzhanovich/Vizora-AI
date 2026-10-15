import { Manrope } from "next/font/google";
import { LandingNav } from "@/components/landing/LandingNav";
import { ShowcaseHero } from "@/components/landing/ShowcaseHero";
import { AfterVisaSection, AgencySection, FeaturesSection, FinalCta } from "@/components/landing/ShowcaseSections";
import { PricingPlans, type LandingPrices } from "@/components/landing/PricingPlans";
import { LandingFooter } from "@/components/landing/LandingFooter";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// TODO: update to real domain once purchased (ТЗ-030)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vizora-ai-theta.vercel.app";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getPrices(): Promise<LandingPrices | null> {
  try {
    const res = await fetch(`${API_URL}/api/payments/plans`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data: { plans: { id: string; prices_kzt: { monthly: number } }[] } = await res.json();
    const monthly = (id: string) => data.plans.find((p) => p.id === id)?.prices_kzt.monthly;
    const standard = monthly("standard");
    const premium = monthly("premium");
    return standard !== undefined && premium !== undefined ? { standard, premium } : null;
  } catch {
    return null;
  }
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Vizora AI",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "AI-платформа для подготовки к интервью на визу J-1 (Work & Travel USA). Симулятор интервью, персональный AI помощник, чек-лист документов.",
      inLanguage: "ru",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "KZT",
        description: "Бесплатный тариф: 3 тренировки интервью с AI-тренером",
      },
      audience: {
        "@type": "Audience",
        audienceType: "Студенты из Казахстана и СНГ, участники программы Work & Travel USA",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Что такое программа Work & Travel USA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Work & Travel USA — обменная программа по визе J-1, позволяющая студентам из Казахстана и СНГ легально работать в США в летний период. Программа включает трудоустройство, проживание и культурный обмен.",
          },
        },
        {
          "@type": "Question",
          name: "Как проходит интервью в консульстве США?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Интервью в консульстве США длится 3–10 минут. Офицер задаёт вопросы о цели поездки, работодателе, финансах и планах по возвращению. Vizora AI помогает подготовиться к этим вопросам через симулятор интервью с AI.",
          },
        },
        {
          "@type": "Question",
          name: "Зачем нужен AI тренер для подготовки к визе?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AI тренер Vizora позволяет практиковаться в ответах на вопросы консульства в любое время, получать персональный анализ рисков и пошаговый план подготовки — без дорогостоящих агентств.",
          },
        },
        {
          "@type": "Question",
          name: "Что такое Vizora AI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Vizora AI — это AI-помощник для подготовки к визовому интервью Work and Travel USA (виза J-1): симулятор интервью с AI-офицером, ответы на вопросы 24/7, персональный анализ риска отказа и чек-лист документов.",
          },
        },
        {
          "@type": "Question",
          name: "Сколько стоит Vizora AI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Базовый доступ к Vizora AI бесплатный (тариф FREE). Платные тарифы — СТАНДАРТ (3 900 ₸/мес) и ПРЕМИУМ (6 900 ₸/мес) — открывают неограниченные симуляции интервью, детальный разбор рисков и режим реального консула.",
          },
        },
        {
          "@type": "Question",
          name: "Подходит ли Vizora AI для студентов из Казахстана?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Да, Vizora AI разработан специально для студентов Work & Travel USA из Казахстана и СНГ — с учётом типичных причин отказа по J-1 визе именно для заявителей из этого региона.",
          },
        },
      ],
    },
  ],
};

export default async function Home() {
  const prices = await getPrices();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={`${manrope.className} min-h-screen overflow-x-hidden bg-[#F5F5FF] text-[#1E1B4B]`}>
        <LandingNav />
        <main>
          <ShowcaseHero />
          <FeaturesSection />
          <AfterVisaSection />
          <PricingPlans prices={prices} />
          <AgencySection />
          <FinalCta />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
