import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { Solution } from "@/components/Solution";
import { HowItWorks } from "@/components/HowItWorks";
import { Agencies } from "@/components/Agencies";
import { EarlyAccess } from "@/components/EarlyAccess";
import { Footer } from "@/components/Footer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vizora-ai-theta.vercel.app";

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
        description: "Ранний доступ — бесплатно",
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
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-[#0A0A0F] overflow-x-hidden">
        <Navbar />
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Agencies />
        <EarlyAccess />
        <Footer />
      </main>
    </>
  );
}
