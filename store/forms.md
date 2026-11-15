# Do'kon formalari uchun tayyor javoblar

Hammasi ilovaning kodiga qarab yozilgan. Ingliz tilidagi matnlarni formaga o'zgartirmay
joylang (sharhlovchilar inglizcha o'qiydi). `<DOMEN>` o'rniga serveringiz manzili
(masalan `https://api.prostaff.uz`).

## Manzillar

| Nima | Qiymat |
|---|---|
| Maxfiylik siyosati | `<DOMEN>/privacy` |
| Akkauntni o'chirish (Google'da majburiy) | `<DOMEN>/delete-account` |
| Qo'llab-quvvatlash | +998 94 080 94 45, Telegram @Prostaffsupport |
| Paket / bundle id | `com.prostaff.app` |

---

## Google Play Console

### Data safety (Ma'lumotlar xavfsizligi)

Umumiy savollar:
- Ilova ma'lumot yig'adimi yoki ulashadimi? **Ha.**
- Ma'lumotlar uzatishda shifrlanadimi? **Ha** (HTTPS).
- Foydalanuvchi ma'lumotlarni o'chirishni so'ray oladimi? **Ha**, ilovada va `<DOMEN>/delete-account` da.

Har bir tur uchun: **Yig'iladi** — ha; **Ulashiladi** — yo'q (xizmat ko'rsatuvchilar bizning
nomimizdan ishlaydi, Google bunday uzatishni "ulashish" deb hisoblamaydi); **Majburiymi** — pastda.

| Toifa → tur | Majburiy | Maqsad |
|---|---|---|
| Shaxsiy ma'lumot → Ism | Ha | App functionality, Account management |
| Shaxsiy ma'lumot → Telefon raqami | Ha | App functionality, Account management |
| Shaxsiy ma'lumot → E-mail | Ixtiyoriy | Account management |
| Shaxsiy ma'lumot → Manzil | Ixtiyoriy (ishchi/firma profili, buyurtma manzili) | App functionality |
| Shaxsiy ma'lumot → Foydalanuvchi ID | Ha | Account management |
| Shaxsiy ma'lumot → Boshqa ma'lumot (passport seriyasi, faqat ishchi) | Ishchi uchun ha | Fraud prevention, App functionality |
| Moliyaviy → To'lov ma'lumoti (karta raqami, muddati, CVV to'lov paytida to'lov tizimiga uzatiladi, saqlanmaydi) | To'lov qilinsa | App functionality |
| Moliyaviy → Xaridlar tarixi (hamyon to'ldirish, obuna) | To'lov qilinsa | App functionality |
| Joylashuv → Aniq joylashuv | Ha | App functionality |
| Joylashuv → Taxminiy joylashuv | Ha | App functionality |
| Rasm va video → Rasmlar | Ixtiyoriy | App functionality |
| Foydalanuvchi kontenti → Boshqa kontent (baho va sharhlar) | Ixtiyoriy | App functionality |
| Qurilma yoki boshqa ID → Bildirishnoma tokeni | Ha | App functionality |

Quyidagilar **yo'q**: xabarlar, kontaktlar, kalendar, ovoz, fayllar, sog'liq, brauzer tarixi,
ilova faoliyati tahlili, nosozlik hisobotlari (hozircha hech qanday analitika yoki
crash-hisobot kutubxonasi yo'q), reklama ID.

Eslatma: karta ma'lumoti serverimiz xotirasidan o'tadi (bazaga yozilmaydi, logga
yozilmaydi). Google bunday "vaqtincha" qayta ishlashni e'lon qilishni talab qilmasligi mumkin;
yuqorida ehtiyot uchun e'lon qilingan.

### App access (Ilovaga kirish)

"Ba'zi qismlari cheklangan" ni tanlang va yozing:

```
The app has three roles: customer, worker and firm. Signing up needs an SMS code sent to
an Uzbek phone number, so please use these ready accounts (sign in with phone + password):

Customer — phone: <TELEFON>, password: <PAROL>
Worker   — phone: <TELEFON>, password: <PAROL>
Firm     — phone: <TELEFON>, password: <PAROL>

Orders are matched to workers within 15 km of the order. Because reviewers are outside
Uzbekistan, there will be no workers near your location, so the customer side will show an
empty list. A screen recording of the whole flow (customer creates an order, worker
receives and accepts it, worker arrives and finishes it, customer rates) is attached /
at <VIDEO HAVOLASI>.
```

(Akkauntlarni admin ilovasi orqali yarating: ishchi va firma — "Qo'shish" bilan; ishchining
hamyonida kamida 10 000 so'm yoki bepul ishlari qolgan bo'lsin. Parollarni bu hujjatga emas,
faqat do'kon formasiga yozing.)

### Foreground service permissions (Console → App content)

**FOREGROUND_SERVICE_LOCATION** — "Describe the feature":
```
A worker who switches the app to "Online" receives job requests from customers nearby. To
send requests to the right people, the app must keep reporting the worker's position
while the phone is in a pocket or another app (for example a navigator) is open. This is
done by a foreground service that shows a standing "You are online" notification and runs
only while the worker is Online; switching to Offline or signing out stops it.
```
Video: telefon ekranini yozing: ishchi "Onlayn" bosadi → bildirishnoma paydo bo'ladi →
boshqa ilovaga o'tadi → "Oflayn" bosganda to'xtaydi.

**FOREGROUND_SERVICE_SPECIAL_USE** (firmalar uchun) — subtype matni (manifestda ham shu):
```
Keeps an online provider reachable so new orders are shown over other apps.
```
"Describe the feature":
```
A service firm that is Online must notice new customer orders even when the app is not on
screen. The service only keeps the app process alive and shows a standing "You are online"
notification; it does no work of its own and stops when the firm goes Offline.
```

### Display over other apps (SYSTEM_ALERT_WINDOW)
Console'da alohida forma yo'q, lekin sharhlovchi so'rashi mumkin:
```
While a worker or firm is Online and the app is in the background, a small floating pill
("Online") is shown over other apps; when an order arrives it turns into an alert and the
app comes to the front, as in ride-hailing driver apps. It is only shown to providers who
are Online, is never shown to customers, and the user grants the permission in system
settings.
```

### Boshqa e'lonlar
- **Reklama:** yo'q. **Ilova turi:** ilova (o'yin emas). **Toifa:** Business yoki Lifestyle.
- **Target audience:** 18+.
- **Kontent reytingi (IARC):** zo'ravonlik, jinsiy kontent, qimor, giyohvand moddalar —
  hammasi "yo'q". "Foydalanuvchilar o'zaro aloqa qiladimi?" — ha (telefon raqami
  almashadi); "joylashuv ulashiladimi?" — ha. Natija odatda 3+/12+.
- **Government apps / health / finance:** yo'q. Karta bilan to'lov bor, lekin ilova bank yoki
  kredit xizmati emas.
- **Target SDK:** Expo avtomatik qo'yadi (36), talabga mos.

---

## App Store Connect

### App Privacy (maxfiylik "ozuqa yorliqlari")

**Kuzatuv (Tracking): yo'q.** Reklama yoki ma'lumot brokerlari uchun hech narsa ishlatilmaydi.
Hammasi **foydalanuvchiga bog'langan (Linked to You)**, maqsad: **App Functionality**
(va Account management qayerda ko'rsatilgan bo'lsa).

| Tur | Nima |
|---|---|
| Contact Info → Name, Phone Number, Email Address (ixtiyoriy) | akkaunt, aloqa |
| Location → Precise Location, Coarse Location | yaqin atrofdagi buyurtmalar |
| User Content → Photos, Other User Content (baho/sharh) | profil, buyurtma |
| Identifiers → User ID, Device ID (bildirishnoma tokeni) | akkaunt, bildirishnomalar |
| Purchases → Purchase History | hamyon, obuna |
| Financial Info → Payment Info | karta to'lov tizimiga uzatiladi, saqlanmaydi |
| Other Data → passport seriyasi (faqat ishchi) | firibgarlikning oldini olish |

### Age rating
4+ (zo'ravonlik, qimor va h.k. yo'q). Agar "foydalanuvchi yaratgan kontent" so'ralsa — baho
va sharhlar; bloklash/shikoyat yo'q, chunki bu ijtimoiy tarmoq emas.

### Background modes (Review Notes'ga yozing)
```
Background modes: location, remote-notification, fetch.

Location: a worker who switches to "Online" shares their position while the app is in the
background so that nearby job requests reach them (like a driver app). It is started only
by the worker's own tap on "Online", shows the system location indicator, and stops when
they go "Offline". Customers' location is only used while the app is open.

Remote notification: new-order and order-status alerts.
```

### Review Notes (App Review Information)
App access matnini yuqoridagidek (`App access`) joylang; demo akkauntlar va **demo video**
(App Review → Attachment). Qo'shimcha:
```
Fees: workers pay a platform commission per accepted job from a prepaid wallet, and
service firms pay a monthly platform subscription. These are fees for the matching
service for real-world jobs performed outside the app (cleaning, repairs, moving). No
digital content or in-app features are sold to customers.
Account deletion: Profile > Delete account.
Privacy policy: <DOMEN>/privacy
```

### Ruxsat matnlari (Info.plist, allaqachon qo'yilgan)
- Joylashuv (when in use): "PROSTAFF sizga eng yaqin ishchilarni va buyurtmalarni topish uchun joylashuvingizdan foydalanadi."
- Joylashuv (always): "PROSTAFF onlayn ishchilarga yaqin atrofdagi buyurtmalarni yuborish uchun joylashuvingizdan foydalanadi, ilova yopiq turganda ham."
- Rasmlar: "PROSTAFF buyurtmaga rasm biriktirish uchun galereyaga ruxsat so'raydi."

Kamera, mikrofon, Face ID, harakat — olib tashlangan, chunki ilova ularni ishlatmaydi.
