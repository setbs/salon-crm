# Security audit: salon-crm + product-store

Дата: 2026-09-05. **Production readiness: пока не рекомендован приём реальных платежей.**

Проверены исходники маршрутов, middleware, сервисов, Prisma schema и migrations, auth, uploads, Monobank, frontend API/рендеринг, deployment-файлы, доступная локальная git history, npm audit/outdated. Исправления находятся в рабочем дереве, не задеплоены. «Исправлено» ниже означает локальный код.

Выполнены 39 тестов на отдельной временной PostgreSQL с 23 migrations. Подписи webhook проверялись настоящим ECDSA, transport Monobank заменён тестовым. Временная БД остановлена. Рабочая БД, реальные заказы/платежи, seed и db:clean не запускались.

Production проверялся только HEAD-запросами. Railway Variables, PostgreSQL ACL/private networking/backups, содержимое Volume и удалённые git refs недоступны. Исчерпывающего penetration/load test не проводилось. Номера строк относятся к изменённому коду; функции названы для поиска после следующих правок.

## A. Находки по severity

### CRITICAL

**C1. Известный запасной JWT secret при неправильной конфигурации.**

- Файл: backend/src/config/env.ts:13,18; backend/src/modules/auth/auth.crypto.ts, createSessionToken.
- Эксплуатация: при отсутствии AUTH_SECRET ранее использовался опубликованный литерал. С ним можно подписать ADMIN JWT самостоятельно.
- Impact: полный доступ к CRM, клиентам и административным операциям. Использование именно этого секрета на Railway не подтверждено.
- **Исправлено:** fail-fast в production/Railway при отсутствии, длине менее 32 символов или известном placeholder; JWT ограничен HS256, issuer, обязательными exp/iat/sub.
- Вручную: установить криптографически случайный AUTH_SECRET; заменить старый, если он был default/публичным. Длина сама по себе не доказывает случайность.

**C2. Demo-пароли и ранее раскрытый Monobank token.**

- Файл: backend/prisma/seed.ts:5,6, около строки 138; merchant token был раскрыт в предыдущей переписке/скриншотах.
- Эксплуатация: если demo credentials используются в production, достаточно обычного login. Действующий раскрытый token даёт доступ к разрешённым ему операциям merchant API.
- Impact: захват CRM / злоупотребление API банка. Активность и права реального токена не проверялись.
- **Вручную, блокер:** перевыпустить token и заменить Railway Variable, сменить demo-пароли admin/сотрудников. Seed повторно обновляет passwordHash: на production его не запускать.
- В доступной локальной git history именованные назначения MONOBANK_TOKEN были пустыми/placeholders/references; подтверждения коммита реального merchant token не найдено. Это не отменяет ротацию после раскрытия в чате. Значения секретов в отчёт не включены.

### HIGH

**H1. IDOR в публичном чтении/повторной оплате заказа.**

- Файл: backend/src/modules/catalog/catalog.routes.ts:80,88; catalog.service.ts:113,117; payments/monobank.service.ts, formatStorePaymentStatus; ../product-store/src/api.ts:50.
- Эксплуатация: без входа перебрать числовые order ID и вызвать payment-status или pay.
- Impact: раскрытие суммы, статуса и payment URL чужого заказа; инициирование операций со счётом чужого заказа. Адрес/телефон клиента этот JSON напрямую не возвращает.
- Повторное создание PENDING invoice предотвращено, но **доступ по одному ID остаётся открытым**.
- Конкретный fix: случайный order access token, хеш в БД, проверка при status/pay, выдача владельцу при создании и поддержка на странице возврата. Не использовать телефон/email как пароль.
- **Не исправлено автоматически:** меняет контракт публичного API, existing return links и handling старых заказов. Требуется согласованное обновление backend/storefront.

**H2. Утечка личности клиента через публичную запись.**

- Файл: backend/src/modules/booking/booking.repository.ts:80; booking.service.ts:85.
- Эксплуатация: booking с чужим известным телефоном ранее возвращал имя/email из users, даже если пользователь их не вводил.
- Impact: раскрытие контактов, подтверждение связи телефона с человеком.
- **Исправлено:** в ответе только контакты из текущего запроса. DB integration test подтверждает отсутствие сохранённых приватных имени/email.
- Телефон всё ещё не верифицируется: поддельные bookings/aliases возможны, см. M4.

**H3. Отключение сотрудника и смена пароля/роли не отзывали JWT.**

- Файл: backend/src/modules/auth/auth.middleware.ts:10; auth.service.ts:23; auth.crypto.ts:61.
- Эксплуатация: сохранить JWT до увольнения/смены пароля и пользоваться до 12 часов. Ранее inactive employee также мог снова войти.
- Impact: сохраняющийся доступ к клиентам/операциям CRM.
- **Исправлено:** сверка пользователя, роли, employee profile/isActive и fingerprint текущего passwordHash при каждом CRM-запросе; active check при login.
- Старые JWT без credentialVersion после deploy недействительны: потребуется повторный вход. Logout отдельной украденной сессии остаётся M1.

**H4. Brute force, spam и неограниченное создание данных/счетов.**

- Файл: backend/src/app.ts:48; auth.crypto.ts:42; catalog.routes.ts:64,72; booking.routes.ts:26.
- Эксплуатация: повторять login, booking, orders, reviews, invoice creation; synchronous scrypt блокировал event loop.
- Impact: подбор паролей, заполнение БД, блокировка расписания, нагрузка CPU/merchant API.
- **Снижено:** express-rate-limit по IP, async scrypt verification, max password length, таймауты Monobank.
- Лимиты: login/booking/orders по 10 за 15 мин; pay retry 5 за 15 мин; reviews 5/час; uploads 20/мин; API 300/мин; webhook 120/мин; order polling 120/мин.
- Остаток: MemoryStore отдельный для каждой реплики и сбрасывается при рестарте. Ботнет/много IP не остановлены. Для нескольких реплик нужен общий store/edge limits; CAPTCHA/verification требуют решения по flow.
- Вручную: настроить TRUST_PROXY_HOPS. Значение 0 за proxy может ограничивать всех клиентов вместе; trust proxy=true опасен.

**H5. Overselling: товар не резервируется до оплаты.**

- Файл: backend/src/modules/catalog/catalog.repository.ts:186; admin/admin.service.ts, updateStoreOrderStatus (около 1068).
- Эксплуатация: несколько заказов читают один остаток, получают счета и оплачиваются; stock списывается только при admin confirmation.
- Impact: получение денег за товары, которых недостаточно. Условное списание при подтверждении защищает от отрицательного остатка, но не от лишних оплат.
- **Не исправлено автоматически:** нужно бизнес-правило резерва. Fix: атомарный резерв до invoice, TTL, освобождение при отмене/истечении и обработка позднего success.
- Повторный POST создания заказа создаёт ещё один заказ. Нужен order idempotency key с атомарной уникальностью и проверкой payload/владельца.

**H6. Конкурентные счета и неполный lifecycle платёжных попыток.**

- Файл: backend/src/modules/payments/monobank.service.ts:33.
- Эксплуатация: несколько pay-запросов ранее создавали разные счета и перезаписывали monobankInvoiceId.
- Impact: двойные платежи/несогласованный статус.
- **Частично исправлено:** row lock, повторное использование PENDING invoice, запрет оплаты REFUNDED/CANCELLED, network timeout. Два одновременных retry проверены.
- Остаток: FAILED retry заменяет invoice без истории попыток. Таймаут после принятия запроса банком создаёт неопределённость; старый invoice может прислать позднее событие.
- Fix: payment attempts, reconciliation invoice/status server-to-server, правила повторов/поздней оплаты. GET payment-status сейчас читает БД: потерянный webhook оставляет pending. Эти изменения требуют отдельного payment lifecycle.
- Блокировка строки удерживается во время создания invoice (до network timeout); это ограниченная, но существующая нагрузка на DB pool.

### MEDIUM

**M1. JWT в localStorage; logout не отзывает скопированный token.**

- Файл: frontend/src/api.ts:805,810; auth.crypto.ts:8.
- Условие: XSS/расширение/доступ к профилю браузера позволяют скопировать bearer token и использовать до exp. Staff TTL 12h.
- Прямого stored XSS не найдено. Смена пароля/роли и отключение теперь отзывает доступ.
- Открыто: server-side session IDs с revoke/logout либо отдельно спроектированные HttpOnly cookies + CSRF/SameSite/CORS. Само удаление localStorage не отзывает копию токена.

**M2. Слабая привязка webhook к invoice и состоянию.**

- Файл: backend/src/modules/payments/monobank.service.ts:146,154,166.
- Ранее: reference fallback, необязательная сумма, нет проверки валюты, hold считался PAID, параллельные callbacks могли перезаписать состояние.
- Подпись уже проверялась: неподписанный POST сам по себе не ставил PAID. Подмена reference требует подписанного payload/доступа к merchant API.
- **Исправлено:** только сохранённый invoiceId; amount/UAH обязательны для PAID; hold остаётся pending; row lock, игнорирование старых/равных modifiedDate, REFUNDED терминален.
- Проверены ECDSA, forged/missing signature, чужой invoice, amount/currency, replay и одновременные callbacks.
- Partial refunds не моделируются суммой; binary refund state требует отдельной бухгалтерской логики.

**M3. Гонка public booking и обход расписания.**

- Файл: backend/src/modules/booking/booking.repository.ts:52,118; booking.service.ts:45,104.
- Ранее: два concurrent запроса проходили conflict check; POST допускал прошлое, inactive employee и игнорировал закрытые schedule overrides.
- **Исправлено для public booking:** Serializable transaction/409, будущее, active employee/service/category, override.
- PostgreSQL test: один 201 и один 409 для одинакового слота.
- Остаток: admin create/reschedule проверяет availability вне общей transaction (admin.service.ts: createAppointment/updateAppointment/ensureAppointmentSlotAvailable). Concurrent admin/public writes и смена расписания не имеют глобальной DB гарантии.
- Fix: единая транзакционная проверка/locks или exclusion constraint после проверки существующих пересечений. Потенциально конфликтующую production migration автоматически не выполнял.

**M4. Неподтверждённая идентичность и немодерируемые отзывы.**

- Файл: booking.repository.ts:80,102; catalog.repository.ts:182; schema.prisma, StoreReview.isPublished.
- Любой человек может назвать чужой телефон/aliases, отправить booking или отзыв без покупки; website honeypot обходится пустой строкой.
- Impact: загрязнение CRM, ложные записи/репутационный spam.
- Добавлены rate limits. OTP/подтверждение и moderation/verified purchase меняют flow и оставлены для отдельного решения.

**M5. Upload formats и ресурсный DoS.**

- Файл: backend/src/modules/admin/admin.service.ts:792; admin.routes.ts:334,379.
- Sharp распознаёт больше форматов, чем Content-Type whitelist. Замаскированный SVG раньше мог обрабатываться; default pixel limit велик.
- Impact: лишние parser attack surfaces/CPU-memory load от авторизованного сотрудника. Выполнение JS в готовом WebP не подтверждено.
- **Исправлено:** JPEG/PNG/GIF/WebP signature до Sharp, metadata.format, 6 MB, 40 MP, максимум 2 concurrent обработки, timeout 10 сек, WebP output, удаление частичных файлов.
- Тесты отвергают SVG/HTML с image/png, настоящий PNG становится WebP.
- Filename генерируется сервером (UUID), каталог фиксирован; path traversal через пользовательский filename отсутствует.
- Остаток: Volume quota/permissions, старые и orphan files, non-root container и disk monitoring требуют настройки.

**M6. Production frontend headers и dev CORS.**

- Файл: backend/src/app.ts:19,37; frontend/vite.config.ts; docker/frontend.Dockerfile.
- HEAD обоих production frontend: нет CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy; nosniff есть.
- Impact: clickjacking, отсутствие дополнительного ограничения последствий XSS.
- **Backend исправлен:** helmet + Permissions-Policy, explicit origins; localhost/private Vite origins только development вне Railway.
- Frontend headers остаются: backend helmet не защищает HTML другого домена. Настроить реальный static host/edge; CSP Report-Only с учётом fonts/images/maps, затем enforcing; запрет framing, HSTS после HTTPS проверки.

**M7. Сотрудник видел aggregate финансы других сотрудников по общему клиенту.**

- Файл: backend/src/modules/admin/admin.repository.ts, listClients (около 106).
- Верхний фильтр employeeId существовал, вложенные clientAppointments/productSales включали всех; из них считались visits/spent.
- **Исправлено:** вложенные записи ограничены employeeId. Общие aliases/notes остаются общими по модели CRM.

**M8. Внутренние ошибки и неполный audit trail.**

- Файл: backend/src/app.ts:68,94; payments/monobank.service.ts, invoice catch.
- console.error(error) мог содержать Prisma context/PII; catch invoice мог сохранить внутреннюю ошибку в публичный paymentError.
- **Исправлено:** generic 500/400/413, requestId и безопасные JSON logs, внутренние invoice errors не возвращаются; сообщения банка ограничены длиной.
- Остаток: старые paymentFailureReason в БД не очищены; нет полного durable audit CRUD сотрудников/товаров и store-payment events. CRM AppointmentAuditLog/PaymentAuditLog существуют.
- Fix: events после commit, alerts по 401/429/5xx, pending age, mismatch amount и диску; ограниченный доступ/retention логов.

**M9. Dependency advisories.**

- Файл: package-lock.json, backend/package.json, package.json.
- Исходный salon-crm npm audit: 8 (4 high, 3 moderate, 1 low), включая build/dev transitive packages. Advisory severity не равна доказанному production exploit через формы.
- **Исправлено:** совместимые версии; qs 6.16.0 override, поскольку Express/body-parser ограничивали minor.
- Итог обоих audit: 0 известных находок. npm outdated выполнен; Express/Prisma/React/Vite majors автоматически не обновлялись.

**M10. Обход CSV formula guard.**

- Файл: frontend/src/features/dashboard/DashboardSection.tsx:731.
- Строка пользователя с минусом/whitespace перед формулой могла интерпретироваться spreadsheet при открытии CSV.
- **Исправлено:** защита =,+,-,@ и ведущих whitespace/control characters. Числовые значения сохраняются числами.

### LOW

**L1. Неполная validation params/query/admin limits.**

- Файл: backend/src/utils/time.ts:5; booking.schemas.ts; admin.routes.ts (BigInt params); catalog.service.ts, parsePublicOrderId.
- Некорректные/слишком большие IDs вызывают 500, большие массивы/непагинированные GET повышают нагрузку.
- Частично исправлены service ID filters, availability date, max услуг booking, длины email/password.
- Остаток: общая positive bigint schema с PostgreSQL upper bound, ограничения admin arrays/numbers/time и пагинация больших выдач. Zod body schemas уже strip неизвестные поля; orders quantity 1..99, items 1..50.

**L2. Env ignore и deploy reproducibility.**

- Файл: .gitignore обоих repos; docker/backend.Dockerfile, docker/frontend.Dockerfile.
- **Исправлено:** .env.* игнорируются, .env.example разрешён.
- Dockerfiles используют npm install, backend runtime не гарантирует перенос сгенерированного Prisma Client и не задаёт USER.
- Fix: npm ci, Prisma generate/copy, non-root с владельцем Volume. Фактический Railway deployment может использовать другие build/start commands, это не подтверждено.

## B. Покрытие 20 категорий

| Категория | Результат / границы |
| --- | --- |
| Authentication | scrypt/random salt/timingSafeEqual, HS256 issuer/exp, staff 12h/client 30m. Нет runtime plaintext passwords; demo credentials в seed. C1/C2/H3/M1. |
| Authorization | Централизованный /admin guard + assertAdmin/assertOwnEmployee/assertPaymentAccess. Employee endpoints намеренно не все admin-only. Тесты 401/403 есть; H1 открыт. |
| CORS | Allowlist/OPTIONS; arbitrary origin не отражается, credentials не включены. Local origins ограничены development. |
| CSRF | Auth через Authorization Bearer, cookie auth не найден. Классический cookie-CSRF не подтверждён. Public spam не лечится CSRF token. |
| XSS | В просмотренном React нет dangerouslySetInnerHTML/innerHTML/document.write/eval; текст выводится React escaping. Подтверждённого stored XSS нет; localStorage/CSP остаются рисками. |
| SQL injection | Tagged raw queries/Prisma.sql/Prisma.join; Unsafe/Prisma.raw не найдены. WHERE fragments параметризованы. |
| Uploads | Auth до raw parser, products admin-only, portfolio staff. Raster limits/WebP/UUID; содержимое/ACL Volume не проверены. |
| Abuse | Per-IP/per-instance лимиты добавлены. Не защита от распределённого DoS. |
| Monobank | Token backend env; цены Decimal из БД, signature + invoice binding/amount/ccy/order of events. Redirect не устанавливает PAID. H1/H6 остаются. |
| Store orders | Active SALE/BOTH, quantity/duplicates/total серверные. Нет резерва/idempotency. |
| Validation | Zod strips unknown properties; unsafe merge/prototype manipulation не найдено. L1. |
| Headers | Backend helmet есть локально; frontend edge требует настройки. |
| Secrets | Просмотрены env paths/именованные assignments доступной --all git history; найденные значения demo/dev/placeholder. Не охватывает внешние refs/reflog/Railway secrets. |
| Database | 23 migrations на пустой test DB успешны. db:clean явный с ALLOW_DB_CLEAN; auto seed/clean в просмотренных build/start нет. Private networking/roles/backups неизвестны. |
| Errors | Generic responses и safe logs; старые сохранённые errors не очищены. |
| Dependencies | Final audit 0 обоих, outdated проверен, majors не менялись. |
| Static files | Backend HEAD /.env, /.git/HEAD, /package.json: 404. Frontend: 200 text/html, вероятно SPA fallback, не доказательство утечки. Тела не скачивались. Vite source maps не включены, tracked maps не найдены. |
| Business logic | Public race/replay проверены; admin concurrency/stock/payment attempts остаются. |
| Production config | Guards/proxy config есть локально; actual Variables/edge chain неизвестны. |
| Monitoring | Safe JSON/requestId, existing CRM audit logs. Store events/security alerts требуют работы. |

## C. Проверки и файлы

- Backend build, salon/CRM frontend build, product-store build: успешно (TypeScript; Vite для frontend).
- Tests: 39 passed, 0 failed, 0 skipped, отдельная PostgreSQL с TEST_DATABASE_URL.
- Production guard checks: missing/placeholder secret и localhost origin отклонены; корректная фиктивная конфигурация принята.
- npm audit: 0/0. npm outdated exit 1 означает доступность новых версий, не ошибку тестов.
- git diff --check: без ошибок.
- Не выполнены реальный bank E2E/refund, production login, load test, backup restore и проверка Railway ACL/Volume.

Изменены salon-crm: .env.example, backend/.env.example, .gitignore, package.json, package-lock.json, backend/package.json; backend/src/app.ts, config/env.ts; modules/auth/{auth.crypto,auth.middleware,auth.schemas,auth.service}.ts; modules/booking/{booking.repository,booking.schemas,booking.service}.ts; modules/admin/{admin.repository,admin.service}.ts; modules/payments/monobank.service.ts; utils/time.ts; backend/tests/api.test.ts, db-api.test.ts, новый payments-security.test.ts; frontend/src/features/dashboard/DashboardSection.tsx; этот отчёт.

В product-store изменён только .gitignore. Seed, db:clean, migrations и schema не менялись. Другие пользовательские изменения frontend/src/App.tsx не относятся к аудиту.

## D. Пять обязательных шагов до реальных клиентов

1. Ротировать раскрытый Monobank token, заменить demo passwords и AUTH_SECRET на случайный. Хранить только Railway Variables; не присылать их в чат/не ставить VITE_*.
2. Закрыть H1: owner token для order status/pay/return; совместный backend/storefront deploy и политика старых ссылок.
3. Реализовать резерв товара/order idempotency/payment attempts/reconciliation. Sandbox-проверки duplicate POST, lost callback, late success, cancel после оплаты и refund.
4. Настроить Railway/edge: NODE_ENV=production; FRONTEND_ORIGIN=https://slcolorstudio-salon.com; STOREFRONT_ORIGIN=https://shop.slcolorstudio-salon.com; правильный HTTPS BACKEND_PUBLIC_URL; TRUST_PROXY_HOPS по фактической цепочке (для одной доверенной ingress обычно 1, проверить spoofed X-Forwarded-For и разные клиентские IP). Frontend CSP/framing/HSTS. После deploy повторно войти в CRM.
5. PostgreSQL private connection, runtime/migration roles, backup + проверенный restore БД и uploads. Проверить Volume path/cwd/права/квоты; исключить seed/clean из lifecycle, настроить alerts и общий limiter при нескольких репликах.

## E. Возможности атакующего после исправлений

- Посетитель: опубликованные данные и ограниченные по частоте записи/отзывы/заказы. Может указать чужой телефон; order IDOR пока раскрывает чужую payment information.
- DevTools/Postman: роль/цена/total из body не дают admin или скидку; backend выполняет проверки. Но H1, duplicate orders и отсутствие резервирования сохраняются.
- Бот: один IP ограничен, распределённые IP/реплики/рестарты обходят MemoryStore. Нужна многоуровневая защита.
- Employee: backend ограничивает собственными записями/платежами/портфолио; административные операции не разрешены только потому, что их можно отправить вручную. Глобальные concurrency guarantees ещё нужны.
- Основные блокеры: реальные leaked/default credentials, H1, H5, остаток H6 и неподтверждённая инфраструктура. Нулевой npm audit не делает систему безопасной автоматически.

## Источники

- [Express: trusted proxies](https://expressjs.com/en/guide/behind-proxies/) и [express-rate-limit: proxy troubleshooting](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues).
- [Sharp: constructor/pixel limits](https://sharp.pixelplumbing.com/api-constructor/).
- [Monobank acquiring API](https://api.monobank.ua/docs/acquiring.html), [invoice/webhook ordering](https://monobank.ua/api-docs/acquiring/integrations/marketplace-and-agents/post--api--merchant--invoice--create).
- [qs advisory, patched 6.16.0](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).

