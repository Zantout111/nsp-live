# نشر مشروع Next.js على Ubuntu + Nginx (nsp-live.com)

المشروع يبني وضع **`standalone`** وقاعدة **SQLite** عبر Prisma.

> **المسارات في هذا الملف أمثلة.** إن كان `package.json` مباشرة تحت `/var/www/nsp-app` فاستخدم ذلك بدل `/var/www/nsp-app/app` في الأوامر.

## 1) تثبيت Node.js 20 LTS على السيرفر

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential
node -v
npm -v
```

(اختياري: Bun غير مطلوب إذا استخدمت `npm run start:node`.)

## 2) رفع الكود إلى السيرفر

- إما **Git clone** من مستودعك، أو **rsync/scp** من جهازك.
- مسار مقترح للتطبيق (منفصل عن صفحة الترحيب الحالية):

```bash
sudo mkdir -p /var/www/nsp-app
sudo chown -R $USER:$USER /var/www/nsp-app
```

انسخ محتويات مجلد **`app`** (مشروع Next) إلى مثلاً:

`/var/www/nsp-app/app`

> لا ترفع `node_modules` ولا `.next` إن كان الحجم كبيراً؛ ثبّت على السيرفر.

## 3) ملف البيئة `.env` على السيرفر

في `/var/www/nsp-app/app` أنشئ `.env` (أو انسخه من جهازك بأمان):

- **`DATABASE_URL`** — مثال SQLite:

  ```env
  DATABASE_URL="file:./db/custom.db"
  ```

- أي مفاتيح API أخرى تستخدمها (ZAI، إلخ).

**مهم:** بعد أول رفع نفّذ تهيئة القاعدة:

```bash
cd /var/www/nsp-app/app
npx prisma generate
npx prisma db push
```

(أو انسخ ملف `db/custom.db` من بيئة التطوير إن أردت نفس البيانات.)

## 4) البناء (Build)

```bash
cd /var/www/nsp-app/app
npm ci
npm run build
```

سكربت `build` ينسخ `static` و`public` و`.env` داخل `.next/standalone/`، ويُجهّز `@swc/helpers` للـ standalone، ويربط **`public/uploads`** بمجلد **`uploads`** الدائم في جذر المشروع (انظر القسم 9).

## 5) التشغيل على المنفذ 3000 (داخل السيرفر)

من مجلد **`app`**:

```bash
cd /var/www/nsp-app/app
export PORT=3000
export HOSTNAME=127.0.0.1
npm run start:node
```

- `HOSTNAME=127.0.0.1` يقيّد الاستماع على localhost (آمن مع Nginx أمامه).
- للاختبار السريع يمكن `0.0.0.0` ثم إغلاق المنفذ 3000 من الجدار الناري الخارجي.

### تشغيل دائم بـ PM2

```bash
sudo npm install -g pm2
cd /var/www/nsp-app/app
PORT=3000 HOSTNAME=127.0.0.1 pm2 start npm --name "nsp-next" -- run start:node
pm2 save
pm2 startup
# نفّذ الأمر الذي يعرضه pm2 startup (مرة واحدة)
```

## 6) ضبط Nginx كـ Reverse Proxy

عدّل الموقع الحالي **`/etc/nginx/sites-available/nsp-live.com`** (أو أنشئ نسخة احتياطية من `index.html` فقط).

مثال **server** لـ HTTPS (استبدل المسارات إن اختلفت):

```nginx
server {
    listen 443 ssl http2;
    server_name nsp-live.com www.nsp-live.com;

    ssl_certificate     /etc/letsencrypt/live/nsp-live.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nsp-live.com/privkey.pem;

    # رفع الشعار حتى 2 MB؛ الافتراضي في Nginx غالباً 1m وقد يعيد 413
    client_max_body_size 5m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

ثم:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

الآن الطلبات إلى `https://nsp-live.com` تُمرَّر إلى Next على `127.0.0.1:3000`.

## 7) تحديثات لاحقة (تسلسل موصى به)

نفّذ من **جذر مشروع Next** (مثلاً `/var/www/nsp-app` أو `/var/www/nsp-app/app` حسب مكان `package.json`):

```bash
cd /var/www/nsp-app    # أو المسار الفعلي
git pull
npm ci
npx prisma generate
npx prisma db push
npm run build
pm2 restart nsp-next   # أو الاسم الحالي في pm2، مثل nsp-app
```

- **`npx prisma`** (أو `npm run db:generate` / `npm run db:push`) من نفس المجلد الذي فيه `.env` و`schema.prisma`؛ لا تشغّل Prisma من داخل `.next/standalone`.
- إذا ظهر **`prisma: command not found`** استخدم دائماً **`npx prisma ...`**.

## 8) ملاحظات

| الموضوع | توضيح |
|--------|--------|
| **الجدار الناري** | لا تفتح المنفذ 3000 للعامة؛ الوصول عبر 443 فقط. |
| **SQLite** | نسخ احتياطي دوري لملف قاعدة البيانات؛ إن كان `DATABASE_URL` نسبياً فتأكد أن **مجلد العمل** لـ PM2 متسق مع المسار (أو استخدم مساراً مطلقاً في `.env`). |
| **Flutter / تطبيق الجوال** | عرّف `API_BASE` على `https://nsp-live.com` (بدون شرطة مائلة أخيرة). |
| **Bun** | سكربت `npm start` الأصلي يستخدم Bun؛ على السيرفر استخدم **`npm run start:node`**. |
| **شعار ومرفقات `/uploads`** | تُحفظ في **`<جذر_المشروع>/uploads`** (مجلد دائم). بعد `npm run build` يُنشأ رابط رمزي من `.next/standalone/public/uploads` إلى هذا المجلد. لا تعتمد على نسخ يدوي خاطئ لـ `@swc/helpers`. راجع القسم 9. |

---

## 9) سجل الدروس المستفادة — أخطاء واجهناها وكيف نتجنبها

هذا القسم يلخّص تجربة نشر فعلية (PM2 + Nginx + standalone) حتى لا تُعاد نفس الأخطاء.

### 9.1 اسم العملية في PM2 (`nsp-app` مقابل `nsp-next`)

- الاسم في **`pm2 list`** مجرد تسمية؛ المهم **مسار السكربت** و**مجلد العمل**.
- تحقق دائماً: `pm2 show اسم_العملية` → **script path** يجب أن يشير إلى **`.../.next/standalone/server.js`** (أو تشغيل **`npm run start:node`** من جذر المشروع حيث `package.json`).
- وجود مشروع جوال أو خدمة أخرى لا يضارب الويب ما دام **لا يوجد منفذان على 3000** و**Nginx** يوجّه `location /` إلى التطبيق الصحيح.

### 9.2 خطأ `MODULE_NOT_FOUND` و`@swc/helpers` (تعطل PM2 / 502)

- **السبب:** حزمة **`@swc/helpers`** غير مضمّنة كاملة في مجلد standalone بعد التتبع (tracing)، أو نسخ يدوي خاطئ.
- **خطأ شائع جداً في الطرفية:**  
  `cp .../node_modules/@swc/helpers .../standalone/node_modules/`  
  ينتج مجلداً باسم **`helpers`** تحت `node_modules` وليس **`@swc/helpers`**، فيفشل التشغيل.
- **النسخ الصحيح يدوياً (للطوارئ):**

```bash
mkdir -p /var/www/nsp-app/.next/standalone/node_modules/@swc
rm -rf /var/www/nsp-app/.next/standalone/node_modules/@swc/helpers \
       /var/www/nsp-app/.next/standalone/node_modules/helpers
cp -rL /var/www/nsp-app/node_modules/@swc/helpers \
       /var/www/nsp-app/.next/standalone/node_modules/@swc/
```

- **`cp -rL`** يتبع الروابط الرمزية؛ بدونها قد يُنسخ `package.json` فقط دون مجلد **`esm/`**.
- في المستودع: سكربت البناء ينسخ `@swc/helpers` مع **`dereference`**؛ بعد **`git pull`** نفّذ **`npm run build`** من جذر المشروع ولا تعتمد على نسخ يدوي دائماً.

### 9.3 Node.js

- استخدم **Node 20 LTS** على السيرفر؛ إصدارات قديمة جداً قد تسبب مشاكل مع Next الحديث.

### 9.4 قاعدة البيانات و`DATABASE_URL` (SQLite)

- إن شغّلت **`server.js` من داخل `.next/standalone`** مع **`exec cwd = standalone`**، فالمسارات النسبية في **`DATABASE_URL`** تُفسَّر من ذلك المجلد؛ قد لا يجد SQLite الملف.
- **الحلول:** التشغيل من جذر المشروع عبر **`npm run start:node`**، أو **`DATABASE_URL` بمسار مطلق** (مثل `file:/var/www/nsp-app/prisma/db/custom.db`)، أو نسخ مجلد **`prisma/db`** إلى المكان المتوقع حسب إعدادك.

### 9.5 الشعار يظهر في الحقل `/uploads/...` لكن الصورة لا تظهر (404)

- **السبب 1:** كل **`npm run build`** يعيد إنشاء `.next/standalone`؛ الملفات داخل **`standalone/public/uploads`** القديمة تُفقد إن لم يكن هناك مجلد رفع **خارج** `.next`.
- **الحل في الكود (المستودع الحالي):** الرفع إلى **`<جذر_المشروع>/uploads`** + رابط رمزي **`standalone/public/uploads` → `../../../uploads`** بعد البناء + مسار **`app/uploads/[[...path]]`** كاحتياطي.
- **السبب 2 — Nginx:** إن وُجد **`location /uploads`** بـ **`alias`** لمجلد فارغ أو خاطئ، سيُرجَع 404 قبل الوصول إلى Node. الأبسط: **عدم عزل `/uploads`** وترك **`proxy_pass`** لنفس التطبيق على 3000، أو جعل **`alias`** يشير صراحةً إلى **`/var/www/nsp-app/uploads`**.
- **تشخيص سريع على السيرفر:**

```bash
ls -la /var/www/nsp-app/uploads/
ls -laL /var/www/nsp-app/.next/standalone/public/uploads/
curl -sI "http://127.0.0.1:3000/uploads/اسم_الملف.png"
find /var/www/nsp-app -name 'logo-ar-*.png' 2>/dev/null
```

### 9.6 صلاحيات مجلد `uploads`

- أنشئ **`mkdir -p /var/www/nsp-app/uploads`**.
- إن كان PM2 يعمل كـ **root** فلا تُلزم **`chown www-data`** إلا إن قررت تشغيل Node كـ **`www-data`**؛ خلاف ذلك قد تختلط الصلاحيات.

### 9.7 قائمة تحقق قبل اعتبار النشر ناجحاً

1. **`pm2 list`** → الحالة **online**، وليس **errored**.
2. **`pm2 logs ... --lines 30`** → لا أخطاء متكررة عند التشغيل.
3. **`curl -sI http://127.0.0.1:3000/`** → 200.
4. **الموقع من المتصفح** يفتح عبر النطاق (Nginx → 3000).
5. **رفع شعار تجريبي** ثم **`ls /var/www/nsp-app/uploads/`** يظهر الملف، و**`curl -sI`** على رابط الصورة يعيد **200** و**Content-Type** مناسباً للصورة.

### 9.8 أمان

- تجنّب نشر كلمات مرور أو مفاتيح SSH في الدردشة؛ تقليل استخدام **root** لـ SSH عندما يمكن.

---

*آخر تحديث للقسم 9: يسجّل أخطاء التشغيل والرفع التي تم حلّها في سياق نشر Ubuntu + PM2 + standalone.*
