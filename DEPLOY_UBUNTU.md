# نشر مشروع Next.js على Ubuntu + Nginx (nsp-live.com)

المشروع يبني وضع **`standalone`** وقاعدة **SQLite** عبر Prisma.

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

سكربت `build` ينسخ `static` و`public` و`.env` داخل `.next/standalone/`.

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

## 7) تحديثات لاحقة

```bash
cd /var/www/nsp-app/app
git pull   # إن استخدمت Git
npm ci
npm run build
pm2 restart nsp-next
```

## 8) ملاحظات

| الموضوع | توضيح |
|--------|--------|
| **الجدار الناري** | لا تفتح المنفذ 3000 للعامة؛ الوصول عبر 443 فقط. |
| **SQLite** | نسخ احتياطي دوري لملف `db/custom.db`. |
| **Flutter / تطبيق الجوال** | عرّف `API_BASE` على `https://nsp-live.com` (بدون شرطة مائلة أخيرة). |
| **Bun** | سكربت `npm start` الأصلي يستخدم Bun؛ على السيرفر استخدم **`npm run start:node`**. |
| **شعار من لوحة التحكم** | يُحفظ تحت `.next/standalone/public/uploads` عند التشغيل من جذر المشروع؛ بعد `npm run build` تأكد من `client_max_body_size` في Nginx (انظر مثال الـ server أعلاه). |
