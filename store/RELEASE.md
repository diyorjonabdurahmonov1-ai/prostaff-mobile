# Do'konlarga chiqarish yo'riqnomasi

Bu hujjat: nima tayyor, nimani siz qilasiz, qaysi buyruqlar bilan build olinadi va
qayerga nima yoziladi. Formalar uchun tayyor javoblar — `forms.md`, do'kon matnlari —
`listing.md`.

## 1. Avval hal qilinadigan narsalar (xavfi bor)

Bular rad etilishga yoki ish to'xtashiga olib kelishi mumkin. Hammasi bo'yicha qaror yoki
tekshiruv sizdan.

1. **To'lov qoidalari (eng katta xavf).** Ilovada ishchi hamyonini to'ldirish (komissiya uchun)
   va firma obunasi sotiladi, to'lov karta orqali, Atmos orqali. Apple va Google
   ilova ichidagi *raqamli* tovarlar uchun o'zlarining to'lov tizimini (In-App Purchase /
   Google Play Billing) talab qiladi; real hayotdagi xizmatlar uchun talab qilmaydi.
   Bizniki "ishchi va firma platformaga to'laydigan xizmat haqi" — u raqamli tovarmi yoki
   yo'qmi, buni sharhlovchi hal qiladi; men oldindan bila olmayman.
   - **A reja:** hozirgidek yuborish, sharh yozuvida tushuntirish: "to'lov platforma
     komissiyasi va xizmat haqi, real hayotdagi ish uchun, kontent sotilmaydi" (`forms.md`).
   - **B reja (rad etilsa):** iOS/Android'da ilova ichida to'ldirish va obuna
     tugmalarini o'chirib, hamyon va obunani faqat ko'rsatish; to'lovni ilovadan tashqarida
     (ofis) qabul qilish. Buni qilish kerak bo'lsa, ayting.
2. **Sharhlovchi joyi.** Sharhlovchilar O'zbekistonda emas; ularning telefonida yaqin
   atrofda ishchi bo'lmaydi, ilova bo'sh ko'rinadi. Shuning uchun App Review va Play'ga
   **demo video** (ishchi buyurtma oladi, mijoz buyurtma beradi) va demo akkauntlar
   kerak. `forms.md` ichida yozilgan.
3. **Ilova egaligi.** `app.json` ichidagi `extra.eas.projectId` Expo'dagi loyihaga ishora
   qiladi, `google-services.json` esa Firebase loyihasiga. Ikkalasi kimning hisobida?
   Expo loyihasi sizniki bo'lmasa, `npx eas-cli init` bilan o'zingizniki yaratiladi va
   `projectId` almashadi. Serverdagi Firebase kaliti (`FCM_SERVICE_ACCOUNT_FILE`) xuddi shu
   Firebase loyihasidan bo'lishi shart, aks holda bildirishnoma kelmaydi.
4. **Server sozlamalari.** `JWT_SECRET`, `ADMIN_PASSWORD`, Firebase kaliti. Admin ilovasi →
   Sozlamalar → "Xavfsizlik tekshiruvi" qizil bo'lmasligi kerak.
5. **Yuridik ma'lumot.** Ofertada (25-bo'lim) faqat telefon va Telegram bor. Tashkilot nomi,
   STIR, manzil chiqarilgach `src/constants/legal.ts` dagi `OFFER_OPERATOR` ga qo'shing.
   Developer akkaunti nomi ham shu tashkilot nomi bo'lishi kerak.
6. **Yosh chegarasi.** Maxfiylik siyosatida "18 yoshdan kichiklar uchun emas" deb yozilgan.
   Do'konlarda ham 18+ / "bolalar uchun emas" tanlang.

## 2. Nima tayyor

- Akkauntni ilovada o'chirish (Profil → "Akkauntni o'chirish") va ochiq sahifa
  `/delete-account`.
- Maxfiylik siyosati sahifasi `/privacy` va ilovada havola (Profil → "Maxfiylik siyosati").
- Faqat kerakli ruxsatlar: joylashuv, bildirishnoma, rasmlar; "boshqa ilovalar ustida
  ko'rsatish" va fon xizmati (sabablari `forms.md` da). Mikrofon, kamera, Face ID,
  xotira, "batareya cheklovini o'chirish" ruxsatlari olib tashlangan.
- Avtomatik tekshiruvlar (tiplar, lint, Android loyihasi va native kodni yig'ish).
- Ilova versiyasini majburiy yangilash: admin ilovasi → Sozlamalar → "Ilova versiyasi".

## 3. Kerakli hisoblar

- **Google Play Console** (bir martalik to'lov) va **Apple Developer Program** (yillik).
- **Expo hisobi** (build uchun), loyihaga kirish huquqi bilan.
- Apple'da: **App Store Connect** da ilova yozuvi (bundle id: `com.prostaff.app`).
- Google'da: Play Console'da ilova (paket nomi: `com.prostaff.app`).

## 4. Build

Hammasi shu papkada (`prostaff-mobile`), bir marta `npm ci` dan keyin:

```bash
npx eas-cli login

# Sinov uchun o'rnatiladigan fayl (telefonga o'rnatib ko'rish):
npx eas-cli build --platform android --profile preview

# Do'kon uchun:
npx eas-cli build --platform android --profile production   # AAB fayl
npx eas-cli build --platform ios --profile production       # Apple login va 2FA so'raydi
```

- Android'da birinchi marta EAS imzo kalitini o'zi yaratadi. **Uni zaxiralang:**
  `npx eas-cli credentials` → Android → kalitni yuklab oling va xavfsiz joyda saqlang.
- iOS'da sertifikat va profilni EAS o'zi yaratadi.
- Versiya raqami (`versionCode`, `buildNumber`) har build'da o'zi oshadi
  (`autoIncrement`); ko'rinadigan versiya `app.json` dagi `version`.

## 5. Yuklash

- **Android:** birinchi marta AAB faylni Play Console → Testing → Internal testing'ga qo'lda
  yuklang (osonroq). Keyin `npx eas-cli submit -p android --profile production` ishlaydi,
  lekin Google service account kaliti kerak bo'ladi.
- **iOS:** `npx eas-cli submit -p ios` (App Store Connect API kaliti yoki Apple ID) yoki
  Transporter ilovasi orqali; keyin TestFlight'da sinab, "Submit for Review".

## 6. Chiqarishdan oldin telefonda sinash (ikki telefon: ishchi va firma)

Oxirgi paytlarda qo'shilgan hech narsa haqiqiy telefonda hali sinalmagan. Bitta Xiaomi va
bitta Samsung'da (iPhone'da ham):

- [ ] Ro'yxatdan o'tish (SMS kod keladi), kirish, parolni tiklash.
- [ ] Ishchi: ruxsatlar kartasi, har bir "Ruxsat berish" tugmasi to'g'ri sozlamani ochadi;
      ruxsatlarsiz "Onlayn" bo'lmaydi.
- [ ] Ishchi onlayn bo'lib boshqa ilovaga o'tadi: tabletka chiqadi; test buyurtmada
      3 soniyalik jiringlash, tabletka to'q sariq bo'ladi, ilova oldinga chiqadi.
- [ ] Ilova yopilgach: tabletka qoladi, buyurtma bildirishnomasi jiringlaydi
      (serverda Firebase ulangan bo'lsa).
- [ ] Firma: xuddi shu; "Siz onlaynsiz" bildirishnomasi turadi.
- [ ] Buyurtma: yaratish → qabul → "Yetib keldim" → tugatish → baho.
- [ ] Kelmagan ishchi: 30 daqiqadan keyin "Ishchi kelmadi" tugmasi, buyurtma boshqalarga
      ketadi (testda sozlamada kutish vaqtini 5 daqiqaga tushiring).
- [ ] Mijoz buyurtmani bekor qiladi: ishchiga komissiya qaytadi.
- [ ] Hamyonni to'ldirish (haqiqiy karta, kichik summa), firma obunasi.
- [ ] Akkauntni o'chirish: tugallanmagan buyurtma bilan rad etiladi; bo'lmasa o'chadi.
- [ ] Til: o'zbekcha, ruscha, inglizcha.
- [ ] Ilova yopilgan holda "Ilovani yangilang" oynasi (sozlamada versiyani vaqtincha
      oshirib ko'ring, keyin qaytaring).

## 7. Chiqqandan keyin

- Eski ilovalarni to'xtatish: admin ilovasi → Sozlamalar → "Ilova versiyasi" ga eng past
  versiyani va do'kon havolalarini yozing (faqat yangi versiya do'konda paydo bo'lgandan keyin!).
- Har bir yangilanishda `app.json` dagi `version` ni oshiring.
