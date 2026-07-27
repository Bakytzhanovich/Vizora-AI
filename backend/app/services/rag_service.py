"""RAG knowledge base search.

Queries the knowledge_base table first; falls back to in-memory seed entries
if the table is empty (e.g. first run before migration seeds the data).
"""

import re
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer

from app.core.database import AsyncSessionLocal
from app.models.knowledge_base import KnowledgeBase

# ─── Seed data (original 20 hand-verified entries) ───────────────────────────
# Kept here for the in-memory fallback and for seeding the DB on first startup.

_SEED_KB: list[dict[str, Any]] = [
    # ── USCOM.KZ agency data (Document 1) ─────────────────────────────────────
    {
        "category": "program",
        "question": "Сколько стоит программа Work and Travel USA через агентство?",
        "answer": "Есть два варианта: Independent (самостоятельный поиск работы) — $2100, и Premium (работу подбирает спонсор Intrax) — $2450. Это не включает дополнительные расходы: SEVIS, визовый сбор, авиабилет.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Какие дополнительные расходы не входят в стоимость программы?",
        "answer": "Дополнительно нужно оплатить: 140 000 тенге организационные расходы агентства, $35 сбор SEVIS, $40 комиссия банка за перевод, $185 консульский сбор на визу, около $900 авиабилет в оба конца. Авиабилет можно купить самостоятельно без штрафа.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Какие этапы оплаты программы Work and Travel?",
        "answer": "Обычно 5 взносов: 1) В течение недели после договора — орг.расходы + часть стоимости + SEVIS + комиссия банка, 2) До конца февраля — часть стоимости программы, 3) В апреле — консульский сбор $185, 4) В течение 3 дней после визы — остаток стоимости, 5) Оплата авиабилета (можно отдельно).",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Какие критерии отбора на программу Work and Travel?",
        "answer": "Студент очного отделения любого ВУЗа, возраст от 18 до 28 лет на дату вылета в США, разговорный английский язык (умение вести диалог), самостоятельность.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Какие сроки программы Work and Travel?",
        "answer": "Обычно с начала мая по начало сентября. Студенты вылетают после окончания занятий и обязаны вернуться в Казахстан до начала учёбы в ВУЗе. Точные сроки устанавливаются посольством США и могут варьироваться год от года.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Где может работать студент по программе Work and Travel?",
        "answer": "В сфере обслуживания: магазины (продавец, кассир), рестораны (повар, помощник официанта), отели (уборка номеров, ресепшн), парки аттракционов (оператор, кассир, спасатель). Иногда американские работодатели сами приезжают в Казахстан на собеседования.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "В чём разница между Independent и Premium опцией программы?",
        "answer": "Independent — участник сам находит работу через друзей, знакомых, интернет или участников прошлых лет. Premium — работодателя подбирает спонсор программы (например Intrax), но это дороже ($2450 против $2100).",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Какие этапы оформления на программу Work and Travel?",
        "answer": "1) Анкета и собеседование с координатором, 2) Подписание договора и оплата, 3) Сдача документов, 4) Оформление визовой поддержки (DS-2019) и поиск работы, 5) Визовое интервью в консульстве, 6) Покупка авиабилета, 7) Pre-departure orientation и вылет.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    # ── US State Department "Know Your Rights" (Document 2) — OFFICIAL ─────────
    {
        "category": "life_usa",
        "question": "Какие у меня трудовые права в США по программе J-1?",
        "answer": "У вас есть право: на справедливую оплату труда не ниже минимальной федеральной ставки, на свободу от дискриминации по возрасту/полу/расе/религии, на свободу от сексуальных домогательств, на безопасное рабочее место, на помощь от профсоюзов и иммиграционных организаций, на то чтобы покинуть неблагоприятное рабочее место. Официальная информация Госдепартамента США.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "life_usa",
        "question": "Имеет ли работодатель право забрать мой паспорт в США?",
        "answer": "Нет. По закону США работодатель не имеет права забирать у вас паспорт, договор о найме или другие документы личной собственности. Это незаконно независимо от типа визы.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "life_usa",
        "question": "Может ли работодатель вычитать деньги из моей зарплаты в США?",
        "answer": "Работодатель может делать только законные вычеты: медстраховка, профсоюзные взносы, аванс, удержания по решению суда. Работодатель НЕ имеет права вычитать стоимость спецодежды, инструментов или расходы на найм персонала из вашей зарплаты, если это опустит её ниже минимальной ставки.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "emergency",
        "question": "Куда звонить если со мной плохо обращаются на работе в США?",
        "answer": "Горячая линия по проблемам торговли людьми: 1-888-373-7888 (звонок в США). Доступна на более чем 200 языках, не нужно называть своё имя. SMS 'HELP' на номер 233733. Если угрожают — звоните 911. Официальная горячая линия Госдепартамента США.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "emergency",
        "question": "Что делать если работодатель меня дискриминирует в США?",
        "answer": "Работодатель не имеет права плохо обращаться с вами по причине возраста (40+), пола, расы, национальности, религии или инвалидности. Подайте жалобу через www.eeoc.gov или обратитесь к независимому юристу — советы от вашего же работодателя могут быть предвзятыми.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "documents",
        "question": "Что такое форма I-94 и зачем она нужна?",
        "answer": "I-94 — электронная запись о вашем въезде в США с указанием крайнего срока выезда. Проверить можно на сайте i94.cbp.dhs.gov. Важно выехать из США до этой даты, иначе это считается нарушением визового статуса.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "documents",
        "question": "Что означают разные поля в американской визе?",
        "answer": "Expiration Date — крайний срок когда можно использовать визу для ВЪЕЗДА в США (не путать с длительностью пребывания). M означает многократный въезд (если рядом цифра — столько раз можно въезжать). Annotation может содержать номер SEVIS и название учебного заведения для студенческих виз.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    # ── Agency interview prep (Document 3) ────────────────────────────────────
    {
        "category": "visa_interview",
        "question": "Что нужно знать о своём университете на визовом интервью?",
        "answer": "Название ВУЗа, специальность и факультет на английском, когда заканчивается обучение, планы после учёбы. Возможны вопросы о дисциплинах с зимней сессии, фамилии преподавателей, декана, расписании занятий.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Как правильно объяснить цель поездки на Work and Travel консулу?",
        "answer": "НЕ говорите что едете зарабатывать деньги. Правильный ответ: участие в программе культурного обмена, знакомство с культурой США, практика английского языка. Это ключевой момент — неправильная цель является частой причиной отказа.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "after_visa",
        "question": "Что нужно сделать в первые 3 дня после приезда к работодателю?",
        "answer": "Зарегистрироваться в системе SEVIS через личный кабинет на сайте спонсора программы. Дальше нужно ежемесячно обновлять информацию о себе и проверять личный кабинет/почту каждые 2 дня.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "emergency",
        "question": "В каких случаях могут депортировать участника Work and Travel?",
        "answer": "Если вы нарушили закон, не зарегистрировались в SEVIS, не приехали вовремя к работодателю, ушли от работодателя без уведомления спонсора о новом месте работы, либо если спонсор аннулировал вашу DS-2019 а вы остались в США нелегально.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "emergency",
        "question": "Могу ли я поменять работу без согласия спонсора?",
        "answer": "Нет, смена работы возможна только с согласия спонсора программы. Самовольная смена работодателя может привести к аннулированию вашего статуса и депортации.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Что отвечать если на интервью спросят кто оплачивает поездку?",
        "answer": "По опыту агентств, распространённая практика — отвечать 'My parents' (родители). Это показывает финансовую стабильность семьи. Важно подтвердить банковской выпиской родителей.",
        "trust_level": "по опыту студентов (не официальная информация)",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Что отвечать про друзей или родственников в США на интервью?",
        "answer": "По опыту агентств, наличие близких связей в США может восприниматься консулом как фактор риска невозвращения. Рекомендуется чётко показать, что ваши главные связи остаются в Казахстане (семья, учёба, планы).",
        "trust_level": "по опыту студентов (не официальная информация)",
        "source_url": None,
    },
    # ── Original 20 hand-verified entries ─────────────────────────────────────
    {
        "category": "program_basics",
        "question": "Что такое программа Work and Travel USA?",
        "answer": "Work and Travel USA — это программа культурного обмена J-1 визы, которая позволяет студентам из разных стран легально работать в США до 4 месяцев летом. Ежегодно более 250,000 студентов со всего мира участвуют в программе.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "visa_j1",
        "question": "Что такое виза J-1?",
        "answer": "J-1 — это неиммиграционная виза для участников программ культурного обмена, включая Work and Travel. Она позволяет работать в США до 4 месяцев и путешествовать 30 дней после окончания программы (Grace Period).",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "documents",
        "question": "Что такое DS-2019?",
        "answer": "DS-2019 — это главный документ для получения J-1 визы. Его выдаёт американский спонсор программы (организация, аккредитованная Госдепартаментом США). Без DS-2019 невозможно записаться на визовое интервью.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "documents",
        "question": "Что такое DS-160?",
        "answer": "DS-160 — это онлайн-анкета для получения американской визы. Заполняется на сайте консульства США. Нужно указать личные данные, цель поездки, информацию об образовании и работе. После заполнения распечатать страницу с подтверждением.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "documents",
        "question": "Что такое SEVIS и сколько стоит сбор?",
        "answer": "SEVIS (Student and Exchange Visitor Information System) — система отслеживания иностранных студентов в США. Сбор SEVIS I-901 составляет $35 для J-1 визы. Оплачивается онлайн до визового интервью.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Какие документы брать на визовое интервью?",
        "answer": "На интервью нужно взять: паспорт (действующий + все старые), распечатанное подтверждение DS-160, DS-2019 от спонсора, квитанция об оплате SEVIS ($35), квитанция визового сбора ($185), Job Offer от работодателя, справка из университета, банковская выписка (своя или родителей), фото на визу.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Сколько стоит визовый сбор?",
        "answer": "Визовый сбор (MRV fee) для J-1 визы составляет $185. Оплачивается онлайн или в банке до записи на интервью. Квитанцию обязательно распечатать и взять на интервью.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Что спрашивают на визовом интервью?",
        "answer": "Офицер обычно спрашивает: цель поездки, где будете работать, кто финансирует поездку, что изучаете в университете, планируете ли вернуться домой, есть ли родственники в США, были ли вы раньше в США или за границей. Интервью длится 2-3 минуты.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Почему отказывают в визе J-1?",
        "answer": "Основная причина отказа — раздел 214(b): офицер не убеждён что вы вернётесь домой. Частые причины: нет истории поездок, нет связей с родной страной (работа, семья, имущество), неуверенные ответы, несоответствие документов, подозрение в иммиграционных намерениях.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Как доказать что вернусь домой?",
        "answer": "Нужно показать 'ties to home country' — связи с родной страной: незаконченная учёба (справка из университета), семья дома (родители, братья/сёстры), отсутствие родственников в США, планы после программы (работа, продолжение учёбы), имущество.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Сколько стоит программа Work and Travel?",
        "answer": "Стоимость программы в Казахстане: $2,000-2,500 за оформление через агентство. Дополнительно: визовый сбор $185, SEVIS $35, авиабилеты $1,000-1,200, карманные деньги на первое время $500-1,000. Итого готовьте около $3,500-4,000.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Когда нужно начинать оформление?",
        "answer": "Оформление начинают за 4-6 месяцев до поездки. Если едете летом (июнь-август), начинайте в декабре-феврале. Сначала регистрация в агентстве → поиск работодателя → получение DS-2019 → запись на интервью. Чем раньше, тем лучше — места в консульстве заканчиваются.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "ssn",
        "question": "Что такое SSN и как его получить?",
        "answer": "SSN (Social Security Number) — американский номер социального страхования. Нужен для легальной работы и получения зарплаты. Получить можно после приезда в США, обратившись в местный офис Social Security Administration с паспортом, визой J-1 и DS-2019. Обычно занимает 2-4 недели.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "taxes",
        "question": "Нужно ли платить налоги в США?",
        "answer": "Да, работодатель удерживает налоги из зарплаты автоматически. После окончания программы можно вернуть часть налогов (Tax Return). Участники J-1 имеют льготный статус и обычно возвращают большую часть уплаченных налогов. Подать декларацию нужно до 15 апреля следующего года.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "life_usa",
        "question": "Где жить в США по программе?",
        "answer": "Большинство работодателей предоставляют жильё (вычитается из зарплаты, обычно $60-150 в неделю). Если жильё не предоставлено, нужно искать самостоятельно через Facebook группы участников W&T, Craigslist, или договариваться с другими студентами.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "life_usa",
        "question": "Можно ли работать на второй работе?",
        "answer": "Да, но с ограничениями. Вторая работа должна быть разрешена спонсором J-1. Нельзя работать более 20 часов в неделю суммарно на второй работе. Работодатель второй работы должен знать о статусе J-1. Это называется 'concurrent employment'.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "program_basics",
        "question": "Кто может участвовать в Work and Travel?",
        "answer": "Участвовать могут студенты очной формы обучения, возраст 18-28 лет (некоторые спонсоры до 25), уровень английского Intermediate и выше, учёба на 1-4 курсе бакалавриата или 1-2 курсе магистратуры. Студенты последнего курса и магистранты имеют повышенный риск отказа в визе.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "На каком языке проходит интервью?",
        "answer": "Интервью проходит на английском языке. Офицер будет общаться с вами по-английски. Именно поэтому важно заранее подготовить ответы на типичные вопросы на английском и тренироваться говорить уверенно.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Что такое Job Offer?",
        "answer": "Job Offer — официальное приглашение от американского работодателя. Содержит: место работы, должность, зарплату, даты контракта. Нужен для получения DS-2019 и визового интервью. Агентства помогают найти работодателя, или можно найти самостоятельно (Self-placement).",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Что будет если откажут в визе?",
        "answer": "Отказ в визе — это серьёзно. Теряются: деньги за программу (частично невозвратные), деньги за визовый сбор ($185). Отказ записывается в иммиграционную историю и нужно указывать при всех будущих визовых заявках. Можно подать повторно с устранением причин отказа.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Какие агентства Work and Travel есть в Казахстане? Как связаться с агентством?",
        "answer": "Одно из агентств в Казахстане — United Students Company (USCOM.KZ), работает с 2006 года (19 лет на рынке W&T). Офис в Астане: ул. Достык 18, офис 326, тел. +7 775 819 6635, email: astana@uscom.kz. Офис в Алматы: ул. Мынбаева 43А, офис 37, тел. +7 777 028 2040, email: almaty@uscom.kz. Сайт: uscom.kz. Это один из примеров — на рынке Казахстана есть и другие агентства-партнёры программы Work and Travel.",
        "trust_level": "по данным агентств",
        "source_url": "https://uscom.kz",
    },
    {
        "category": "program",
        "question": "Какие агентства Work and Travel USA есть в Казахстане?",
        "answer": "На рынке Казахстана работает несколько агентств: United Students Company (USCOM.KZ, с 2006 года), KCET (с 2001 года, более 20 000 участников, офис в Алматы), Columbus Work Travel (с 2012 года, более 10 000 студентов), Opportunity Programs, Globus Exchange, WorkAndTravelUS.kz и другие. У каждого свои условия и цены — рекомендуется сравнить несколько перед выбором.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Что такое KCET и какие у них условия?",
        "answer": "KCET — агентство Work and Travel USA, работает с 2001 года, отправили более 20 000 участников в США. Сотрудничают с американскими операторами INTRAX, AWA, AAG, CIEE, CHI. Главный офис в Алматы, представительство в Ташкенте. По новым правилам принимают студентов 4 курса, но для выпускных курсов выше риск отказа в визе.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Что такое Columbus Work Travel?",
        "answer": "Columbus Work Travel — агентство основанное в 2012 году, отправили в США более 10 000 студентов. Работают со студентами из Казахстана, Кыргызстана, Таджикистана и других стран СНГ. Сотрудничают с тремя визовыми спонсорами программы.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "visa_interview",
        "question": "Сколько собеседований нужно пройти для участия в программе?",
        "answer": "Обычно три собеседования: со спонсором программы (декабрь-май), с работодателем (январь-март), и финальное визовое интервью в консульстве США (апрель-июнь). Точные даты различаются по сезонам, агентство обычно готовит студента к каждому этапу отдельно.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "documents",
        "question": "Где находится консульство США для подачи на визу J-1?",
        "answer": "Посольство США в Нур-Султане (Астана): проспект Р. Кошкарбаева 3, тел. +7 7172 70-21-00. Генеральное консульство США в Алматы: ул. Жолдасбекова 97 (Самал 2), тел. +7 727 250-76-12. Это официальные контакты дипломатических представительств США в Казахстане.",
        "trust_level": "официальный источник",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Когда лучше начинать оформление документов на Work and Travel?",
        "answer": "Оформление обычно начинается в августе и заканчивается в феврале-марте следующего года. Чем раньше начать — тем шире выбор рабочих мест и локаций, и тем ниже итоговая стоимость программы у большинства агентств.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "program",
        "question": "Какие виды работы запрещены участникам Work and Travel?",
        "answer": "Госдепартамент США публикует список запрещённых видов занятости для J-1 участников — обычно это работы связанные с риском для здоровья, домашний труд в частных семьях, и некоторые другие категории. Точный актуальный список лучше уточнять у своего спонсора программы перед подписанием Job Offer.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },

    # ── Казахстанские агентства Work & Travel — профили (аналитика Vizora AI, июль 2026) ──
    {
        "category": "agencies_kazakhstan",
        "question": "Какие агентства Work and Travel есть в Казахстане?",
        "answer": "Основные операторы: KCET, USCOM, ABC Universe, Opportunity (workandtravelusa.kz), Airtravel, IEC Kazakhstan (МЦО), Globus Exchange и Columbus. У каждого свои сильные стороны: KCET — 20+ лет опыта, USCOM — премиальные работодатели, Opportunity — крупнейшие очные ярмарки вакансий, Airtravel — собственная авиакасса IATA, IEC — прямой партнёр InterExchange, Globus — премиум-сервис и выставки AKIEF, Columbus — сильная работа с регионами.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Сколько в среднем стоит Work and Travel через разные агентства Казахстана?",
        "answer": "Стоимость программы (без учёта SEVIS $220, консульского сбора $185 и авиабилетов) у большинства агентств Казахстана — примерно $1,300–$2,500. Ниже всего у IEC Kazakhstan при варианте Self-Arranged ($1,300–$1,500), выше всего у Globus Exchange за премиум-сервис ($1,800–$2,500). Точная цена зависит от пакета, даты подачи и того, кто подбирает работодателя — вы сами или агентство.",
        "trust_level": "по данным агентств",
        "source_url": None,
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Что такое агентство KCET?",
        "answer": "KCET (Kazakhstan Council for Educational Travel) — один из старейших операторов Work & Travel в Казахстане, работает с 2003 года, аккредитован Посольством и Консульством США для оформления виз J-1. Кроме W&T USA есть стажировки на круизных лайнерах и в Норвегии. Офис в Алматы (ул. Сатпаева 30А), сайт kcet.kz.",
        "trust_level": "по данным агентств",
        "source_url": "https://kcet.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Сколько стоит Work and Travel через KCET и какие требования?",
        "answer": "Стоимость программы через KCET — $1,600–$2,100 (плюс SEVIS $220 и консульский сбор $185, авиабилеты $900–$1,400 отдельно). Требования: возраст 18–23/24 года, очное обучение (1–3 курс при 4-летней программе, 1–4 при 5-летней), английский не ниже Intermediate (B1), без академических задолженностей и судимостей. Спонсоры в США: CIEE, InterExchange, Intrax, GeoVisions.",
        "trust_level": "по данным агентств",
        "source_url": "https://kcet.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Что такое агентство USCOM?",
        "answer": "USCOM (United Students Company) — агентство с офисами в Алматы и Астане, более 15 лет на рынке, известно эксклюзивными контрактами с премиальными работодателями США (сети отелей Marriott, Hilton, Hyatt, крупные курорты и национальные парки). Часовая оплата у работодателей USCOM обычно выше средней — $14–19/час. Сайт uscom.kz.",
        "trust_level": "по данным агентств",
        "source_url": "https://uscom.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Сколько стоит Work and Travel через USCOM и какие требования?",
        "answer": "Стоимость через USCOM — $1,700–$2,300 (плюс SEVIS $220 и консульский сбор $185), зависит от пакета и условий проживания. Требования: очное обучение, 1–3 курс, разговорный английский B1–B2, загранпаспорт. Из минусов — популярные вакансии закрываются быстро, стоит подавать документы пораньше.",
        "trust_level": "по данным агентств",
        "source_url": "https://uscom.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Что такое агентство ABC Universe?",
        "answer": "ABC Universe — молодёжное агентство Work & Travel в Алматы (пр. Сейфуллина 498) с активным продвижением в Instagram и TikTok (@abc_universe_kz). Полное сопровождение, вакансии в основном в сфере обслуживания и туризма на Атлантическом побережье США. Стоимость программы $1,800–$2,400 плюс SEVIS $220 и виза $185. Требования: очное обучение 1–3 курс, возраст 18–23 года.",
        "trust_level": "по данным агентств",
        "source_url": "http://abcuniverse.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Что такое агентство Opportunity и что за ярмарки вакансий они проводят?",
        "answer": "Opportunity (сайт workandtravelusa.kz) — один из крупнейших операторов W&T в Казахстане, известен ежегодными очными и онлайн Job Fairs (Ярмарками вакансий), где студент может пройти интервью и подписать Job Offer напрямую с американским работодателем за одну встречу. Доступ к 300+ проверенным работодателям, спонсоры CIEE, InterExchange, Greenheart. Офисы в Алматы (ул. Желтоксан 115) и Астане (ул. Кабанбай батыра 11). Стоимость $1,750–$2,200 плюс SEVIS $220 и виза $185.",
        "trust_level": "по данным агентств",
        "source_url": "https://workandtravelusa.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Что такое агентство Airtravel и в чём его особенность?",
        "answer": "Airtravel (Air Travel International, Алматы, ул. Гоголя 86) совмещает туроператора и агентство Work & Travel. Главная особенность — собственная аккредитация IATA, поэтому Airtravel может выписывать гибкие студенческие авиабилеты по субсидированным тарифам (от $850) с бесплатным изменением даты вылета. Стоимость программы $1,650–$2,100 плюс SEVIS $220 и виза $185. Требования: 1–3 курс, английский от Intermediate.",
        "trust_level": "по данным агентств",
        "source_url": "http://airtravel.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Что такое IEC Kazakhstan и чем отличается от других агентств?",
        "answer": "IEC Kazakhstan (МЦО) — официальный прямой представитель американской спонсорской организации InterExchange, работает в Казахстане 18+ лет, филиалы в Алматы, Астане, Шымкенте и Караганде. Есть два варианта W&T USA: Self-Arranged (сам ищешь работу) — $1,300–$1,500, и Full Placement (агентство подбирает) — $1,800–$2,300. Также есть W&T Germany, Camp USA, Au Pair. Плюс SEVIS $220 и виза $185. Из плюсов — прямой статус со спонсором без посредников и помощь с возвратом налогов (Tax Refund) после программы.",
        "trust_level": "по данным агентств",
        "source_url": "https://iec.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Что такое агентство Globus Exchange?",
        "answer": "Globus Exchange (Globus Education) — премиум-агентство с офисами в Алматы, Астане и Шымкенте, организатор международных образовательных выставок AKIEF. Помимо Work & Travel USA занимается поступлением в вузы за рубежом (Великобритания, США, Канада, Европа). W&T-сервис премиальный, с персональным менеджером. Стоимость $1,800–$2,500 плюс SEVIS $220 и виза $185 — самая высокая цена среди агентств Казахстана, но и самый полный спектр услуг.",
        "trust_level": "по данным агентств",
        "source_url": "https://globusedu.kz",
    },
    {
        "category": "agencies_kazakhstan",
        "question": "Что такое агентство Columbus и подходит ли оно студентам из регионов?",
        "answer": "Columbus (Columb-US) — агентство с фокусом на региональных студентов Казахстана: Петропавловск, Костанай, Караганда, Алматы. Хорошо подходит, если ты не из Алматы/Астаны — есть полностью дистанционное оформление и индивидуальное сопровождение. Требования: очная форма, 18–23 года, английский от Pre-Intermediate до Intermediate — порог ниже, чем у многих других агентств. Стоимость $1,600–$2,100 плюс SEVIS $220 и виза $185.",
        "trust_level": "по данным агентств",
        "source_url": "https://columb-us.kz",
    },
]


_STOPWORDS = frozenset({
    "что", "это", "как", "где", "про", "для", "при", "или", "есть",
    "там", "тут", "мне", "мой", "мне", "его", "ему", "ему", "она",
    "они", "нас", "вас", "вам", "них", "ним", "мои", "все", "всё",
    "кто", "чем", "чего", "чему", "какой", "такой",
})


def _tokenize(text: str) -> list[str]:
    """Word-boundary tokenization — a plain .split() leaves punctuation glued to
    the adjacent word (e.g. "AKIEF." or "USCOM?"), which silently breaks exact
    keyword matching for any term followed by a period, comma, or question mark."""
    return re.findall(r"\w+", text.lower())


def _keyword_score(query: str, item: dict) -> int:
    query_words = [
        w for w in _tokenize(query)
        if len(w) > 2 and w not in _STOPWORDS
    ]
    q_words = set(_tokenize(item["question"]))
    a_words = set(_tokenize(item["answer"]))
    score = 0
    for w in query_words:
        if w in q_words:
            score += 3  # question match outranks answer match
        elif w in a_words:
            score += 1
        elif len(w) > 5:
            stem = w[:-2]
            if any(tw.startswith(stem) for tw in q_words):
                score += 2
            elif any(tw.startswith(stem) for tw in a_words):
                score += 1
    return score


def _search_in_memory(query: str, top_k: int) -> list[dict[str, Any]]:
    scored = [(s, item) for item in _SEED_KB if (s := _keyword_score(query, item)) > 0]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:top_k]]


async def search_knowledge(
    query: str,
    top_k: int = 5,
    db: AsyncSession | None = None,
) -> list[dict[str, Any]]:
    """Return top_k KB entries matching query.

    Uses keyword scoring over question+answer text.
    Queries the DB when available, falls back to in-memory seed data.
    Includes trust_level so the AI can cite sources appropriately.
    """
    _close_db = False
    if db is None:
        db = AsyncSessionLocal()
        _close_db = True

    try:
        rows = await db.execute(
            select(KnowledgeBase).options(defer(KnowledgeBase.embedding))
        )
        all_entries = rows.scalars().all()
        if not all_entries:
            return _search_in_memory(query, top_k)

        scored = []
        for entry in all_entries:
            item = {
                "category": entry.category,
                "question": entry.question,
                "answer": entry.answer,
                "trust_level": entry.trust_level,
                "source_url": entry.source_url,
            }
            s = _keyword_score(query, item)
            if s > 0:
                scored.append((s, item))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:top_k]]

    except Exception as _exc:
        import logging as _log
        _log.getLogger(__name__).warning(
            "search_knowledge DB error, falling back to in-memory: %s", _exc
        )
        return _search_in_memory(query, top_k)
    finally:
        if _close_db:
            await db.close()


async def seed_knowledge_base() -> None:
    """Upsert all hand-verified seed entries into the knowledge_base table.

    Idempotent: skips questions that already exist (matched by text) so new
    entries added to _SEED_KB are inserted on the next startup without wiping
    the table or creating duplicates.
    """
    import uuid
    from datetime import datetime

    from sqlalchemy import select as sa_select

    from app.models.knowledge_base import KnowledgeBase

    try:
        async with AsyncSessionLocal() as db:
            existing_rows = await db.execute(sa_select(KnowledgeBase.question))
            existing_questions: set[str] = {row[0] for row in existing_rows}

            added = 0
            for item in _SEED_KB:
                if item["question"] in existing_questions:
                    continue
                db.add(KnowledgeBase(
                    id=str(uuid.uuid4()),
                    category=item["category"],
                    question=item["question"],
                    answer=item["answer"],
                    trust_level=item["trust_level"],
                    source_url=item.get("source_url"),
                    embedding=None,
                    created_at=datetime.utcnow(),
                    verified=True,
                ))
                existing_questions.add(item["question"])
                added += 1

            if added:
                await db.commit()
    except Exception as exc:  # noqa: BLE001
        import logging as _logging
        _logging.getLogger(__name__).warning("KB seed failed (non-fatal): %s", exc)
