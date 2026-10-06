/**
 * The public offer — the agreement a person accepts by signing up.
 *
 * Kept as data rather than JSX so the screen stays a renderer, and kept in
 * Uzbek only: this is the legally operative text, and translating a contract is
 * how two versions end up saying different things. The screen says as much
 * above it when the app is running in another language.
 *
 * `OFFER_VERSION` is what a signed-up account agreed to. Change the text and
 * change the version with it — an account that accepted 1.0 has not accepted
 * whatever 2.0 says.
 *
 * TODO(office): add the operator's registration details (yuridik shaxs nomi,
 * STIR, manzil, bank rekvizitlari) to `OFFER_OPERATOR` once they are issued.
 * They belong in the closing section; the contacts below are what we can state
 * truthfully today.
 */

import { SUPPORT_PHONE, SUPPORT_TELEGRAM_HANDLE } from '@/lib/support';

export const OFFER_VERSION = '2.0';

/** Date the current text took effect, ISO, shown formatted by the screen. */
export const OFFER_UPDATED = '2026-09-21';

export const OFFER_OPERATOR = {
  name: 'PROSTAFF',
  phone: SUPPORT_PHONE,
  telegram: SUPPORT_TELEGRAM_HANDLE,
};

export interface OfferSection {
  /** Numbered heading, as it appears in the document. */
  title: string;
  /** Paragraphs. A line starting with "— " is rendered as a bullet. */
  body: string[];
}

export const OFFER_LEAD =
  'Ushbu hujjat PROSTAFF platformasidan foydalanish bo‘yicha ommaviy oferta — ya’ni ' +
  'har qanday jismoniy yoki yuridik shaxsga qaratilgan rasmiy taklifdir. Ilovada ' +
  'ro‘yxatdan o‘tish va undan foydalanish ushbu shartlarni to‘liq qabul qilish (aksept) ' +
  'hisoblanadi. Shartlarga rozi bo‘lmasangiz, ilovadan foydalanmang.';

export const OFFER_SECTIONS: OfferSection[] = [
  {
    title: '1. Umumiy qoidalar',
    body: [
      '1.1. Ushbu Ommaviy oferta (keyingi o‘rinlarda — «Oferta») PROSTAFF raqamli platformasidan foydalanish shartlarini belgilaydi.',
      '1.2. PROSTAFF — ishchilar, jismoniy shaxslar, mijozlar hamda xizmat ko‘rsatuvchi kompaniya va tashkilotlarni o‘zaro topishish, bog‘lanish, xizmat yoki ish takliflari haqida ma’lumot almashish va o‘zaro hamkorlik qilish imkonini beruvchi raqamli platformadir.',
      '1.3. PROSTAFF ushbu Oferta doirasida, alohida holatlar qonunchilik yoki alohida shartnomada nazarda tutilmagan bo‘lsa, ish beruvchi, xodim, pudratchi, buyurtmachi yoki xizmat ko‘rsatuvchi tashkilot sifatida ish yuritmaydi.',
      '1.4. Platformadagi ish yoki xizmat bo‘yicha kelishuvning bevosita tomonlari tegishli Ishchi, Mijoz yoki Xizmat ko‘rsatuvchi firma hisoblanadi.',
      '1.5. Ushbu Oferta nomuayyan doiradagi foydalanuvchilarga mo‘ljallangan bo‘lib, undan foydalanish orqali foydalanuvchi Oferta shartlarini to‘liq va so‘zsiz qabul qiladi.',
      '1.6. Foydalanuvchi «Ro‘yxatdan o‘tish», «Qabul qilaman», «Tasdiqlash», «Buyurtma berish», «Ishni qabul qilish» yoki Oferta shartlarini qabul qilganini bildiruvchi boshqa tugmani bosishi orqali Oferta shartlariga aksept beradi.',
      '1.7. Elektron shaklda Oferta shartlarini qabul qilish O‘zbekiston Respublikasi qonunchiligiga muvofiq shartnoma tuzishning elektron usullaridan biri hisoblanadi.',
      `1.8. Hujjat tahriri: ${OFFER_VERSION}.`,
    ],
  },
  {
    title: '2. Asosiy tushunchalar',
    body: [
      'Ushbu Oferta doirasida:',
      '— PROSTAFF / Platforma — Ishchilar, Mijozlar va Xizmat ko‘rsatuvchi firmalarni o‘zaro bog‘lashga xizmat qiluvchi raqamli axborot-vositachilik platformasi.',
      '— Operator — PROSTAFF platformasini boshqaruvchi yuridik shaxs yoki yakka tartibdagi tadbirkor.',
      '— Ishchi — Platformada ro‘yxatdan o‘tib, o‘z xizmatlarini taklif qiluvchi jismoniy shaxs.',
      '— Mijoz — Platforma orqali ishchi yoki xizmat ko‘rsatuvchi firmadan xizmat olishni istovchi jismoniy yoki yuridik shaxs.',
      '— Xizmat ko‘rsatuvchi firma — o‘z xizmatlarini Platforma orqali Mijozlarga taklif qiluvchi yuridik shaxs, yakka tartibdagi tadbirkor yoki boshqa qonuniy faoliyat yurituvchi tashkilot.',
      '— Buyurtma — Mijoz tomonidan Platforma orqali joylashtirilgan ish yoki xizmatga bo‘lgan talab.',
      '— Ish taklifi — Ishchi yoki Xizmat ko‘rsatuvchi firma tomonidan Mijozga taklif qilinadigan ish yoki xizmat.',
      '— Foydalanuvchi — Platformadan foydalanuvchi Ishchi, Mijoz yoki Xizmat ko‘rsatuvchi firma.',
    ],
  },
  {
    title: '3. Oferta predmeti',
    body: [
      '3.1. Operator Foydalanuvchiga PROSTAFF Platformasidan foydalanish imkoniyatini taqdim etadi.',
      '3.2. Platformaning asosiy vazifalari quyidagilardan iborat:',
      '— Ishchilarni Mijozlar bilan bog‘lash;',
      '— Mijozlarning ishchi topishiga yordam berish;',
      '— Xizmat ko‘rsatuvchi firmalarni Mijozlar bilan bog‘lash;',
      '— Mijozlarga mavjud ish va xizmatlar haqida ma’lumot taqdim etish;',
      '— Foydalanuvchilar o‘rtasida aloqa o‘rnatish imkonini yaratish;',
      '— Ish yoki xizmat bo‘yicha so‘rovlarni yuborish va qabul qilish imkoniyatini taqdim etish;',
      '— Platforma orqali bildirishnomalar yuborish;',
      '— Platformaning texnik ishlashini ta’minlash.',
      '3.3. PROSTAFF Foydalanuvchilar o‘rtasida ish yoki xizmatning o‘zi bo‘yicha tuziladigan kelishuvning tarafchisi emas, agar alohida shartnomada boshqacha belgilanmagan bo‘lsa.',
    ],
  },
  {
    title: '4. PROSTAFFning vazifalari',
    body: [
      '4.1. PROSTAFF Platformaning texnik jihatdan ishlashini ta’minlashga harakat qiladi.',
      '4.2. Platformada ro‘yxatdan o‘tgan Foydalanuvchilar o‘rtasida aloqa o‘rnatish imkoniyatini yaratadi.',
      '4.3. Platformadagi ma’lumotlarni texnik imkoniyatlar doirasida saqlaydi va qayta ishlaydi.',
      '4.4. Zarur hollarda Foydalanuvchilarga Platformadan foydalanish bo‘yicha texnik yordam ko‘rsatadi.',
      '4.5. PROSTAFF qonunchilikka, ushbu Oferta va Platformadan foydalanish qoidalariga zid bo‘lgan faoliyatni cheklash, akkauntni vaqtincha to‘xtatish yoki bloklash huquqiga ega.',
      '4.6. PROSTAFF qonunchilik talablariga muvofiq Foydalanuvchilarning shaxsga doir ma’lumotlarini himoya qilish choralarini ko‘radi.',
    ],
  },
  {
    title: '5. Ishchining huquq va majburiyatlari',
    body: [
      '5.1. Ishchi Platformada o‘zining malakasi, tajribasi, xizmat turi, mavjudligi va boshqa zarur ma’lumotlarni ko‘rsatishi mumkin.',
      '5.2. Ishchi taqdim etgan ma’lumotlarning haqqoniyligi uchun o‘zi javobgar.',
      '5.3. Ishchi:',
      '— o‘z ma’lumotlarini to‘g‘ri ko‘rsatishi;',
      '— Mijoz bilan kelishilgan ishni halol va sifatli bajarishi;',
      '— kelishilgan vaqt va joyga rioya qilishi;',
      '— qonunchilik talablariga rioya qilishi;',
      '— boshqa Foydalanuvchilarga hurmat bilan munosabatda bo‘lishi;',
      '— Platformadan noqonuniy maqsadlarda foydalanmasligi shart.',
      '5.4. Ishchi o‘zining mehnat yoki xizmat faoliyati bilan bog‘liq soliqlar, ruxsatnomalar, litsenziyalar va boshqa majburiyatlar mavjud bo‘lsa, ularni qonunchilikka muvofiq mustaqil bajaradi.',
      '5.5. Ishchi va Mijoz o‘rtasidagi ish shartlari, ish vaqti, haq miqdori va boshqa shartlar, agar alohida shartnoma mavjud bo‘lmasa, ular o‘rtasidagi kelishuv asosida belgilanadi.',
    ],
  },
  {
    title: '6. Mijozning huquq va majburiyatlari',
    body: [
      '6.1. Mijoz Platforma orqali Ishchi yoki Xizmat ko‘rsatuvchi firmani izlash va ular bilan bog‘lanish huquqiga ega.',
      '6.2. Mijoz buyurtma joylashtirganda ish yoki xizmat haqida imkon qadar to‘liq va to‘g‘ri ma’lumot berishi kerak.',
      '6.3. Mijoz Ishchi yoki Xizmat ko‘rsatuvchi firma bilan kelishilgan shartlarga rioya qilishi shart.',
      '6.4. Mijoz Ishchi yoki Xizmat ko‘rsatuvchi firma tomonidan bajarilgan ish yoki ko‘rsatilgan xizmat uchun kelishilgan haqni o‘z vaqtida to‘lashi kerak.',
      '6.5. Mijoz Platformadan boshqa Foydalanuvchilarni aldash, haqorat qilish, tahdid qilish yoki noqonuniy maqsadlarda foydalanmasligi kerak.',
    ],
  },
  {
    title: '7. Xizmat ko‘rsatuvchi firmalar',
    body: [
      '7.1. Xizmat ko‘rsatuvchi firma Platformada o‘z xizmatlarini joylashtirishi va Mijozlardan buyurtmalar qabul qilishi mumkin.',
      '7.2. Firma tomonidan Platformaga joylashtirilgan ma’lumotlarning haqqoniyligi uchun firma o‘zi javobgar.',
      '7.3. Firma quyidagilarni imkon qadar aniq ko‘rsatishi kerak:',
      '— xizmat turi;',
      '— narxi;',
      '— xizmat ko‘rsatish hududi;',
      '— ishchilar soni;',
      '— ish vaqti;',
      '— boshqa muhim shartlar.',
      '7.4. Firma va Mijoz o‘rtasidagi xizmat ko‘rsatish shartlari ularning o‘zaro kelishuvi asosida belgilanadi.',
      '7.5. PROSTAFF firma tomonidan ko‘rsatilgan xizmatning bevosita ijrochisi hisoblanmaydi.',
    ],
  },
  {
    title: '8. PROSTAFFning vositachilik roli',
    body: [
      '8.1. PROSTAFFning asosiy vazifasi — Foydalanuvchilarni bir-biri bilan bog‘lash va ular o‘rtasida aloqa o‘rnatish imkonini yaratish.',
      '8.2. PROSTAFF quyidagilarni bog‘lash uchun Platforma imkoniyatlarini taqdim etadi:',
      '— Ishchini Mijoz bilan;',
      '— Mijozni Ishchi bilan;',
      '— Xizmat ko‘rsatuvchi firmani Mijoz bilan;',
      '— Mijozni Xizmat ko‘rsatuvchi firma bilan.',
      '8.3. PROSTAFF, agar alohida shartnomada nazarda tutilmagan bo‘lsa, Ishchi yoki Xizmat ko‘rsatuvchi firmaning ish beruvchisi hisoblanmaydi.',
      '8.4. PROSTAFF Mijozning ham, Ishchining ham, Xizmat ko‘rsatuvchi firmaning ham bevosita vakili hisoblanmaydi.',
      '8.5. Platforma orqali topilgan Ishchi yoki Firma bilan hamkorlik qilish yoki qilmaslik haqidagi yakuniy qarorni Mijozning o‘zi qabul qiladi.',
      '8.6. Ishchi ham qaysi Mijozning buyurtmasini qabul qilish yoki qilmaslikni mustaqil hal qiladi.',
    ],
  },
  {
    title: '9. Ish va xizmat uchun to‘lov',
    body: [
      '9.1. Ish yoki xizmat uchun haq miqdori tegishli tomonlar — Ishchi va Mijoz yoki Firma va Mijoz — o‘rtasida kelishiladi.',
      '9.2. PROSTAFFning xizmat haqi, abonent to‘lovi, komissiyasi yoki boshqa to‘lovlari mavjud bo‘lsa, ular Platformada alohida ko‘rsatiladi.',
      '9.3. PROSTAFF tomonidan olinadigan platforma haqi Foydalanuvchiga to‘lovdan oldin ko‘rsatiladi.',
      '9.4. Foydalanuvchi tegishli to‘lovni amalga oshirish orqali ushbu to‘lov shartlariga rozilik bildiradi.',
      '9.5. To‘lovlarni qaytarish shartlari Platformadagi tegishli qoidalar yoki alohida shartlarda belgilanadi.',
    ],
  },
  {
    title: '10. Buyurtma va aloqa tartibi',
    body: [
      '10.1. Mijoz Platformada buyurtma joylashtirishi mumkin.',
      '10.2. Platforma mavjud mezonlar asosida tegishli Ishchi yoki Xizmat ko‘rsatuvchi firmalarga buyurtma haqida xabar yuborishi mumkin.',
      '10.3. Ishchi yoki Firma buyurtmani qabul qilishi yoki rad etishi mumkin.',
      '10.4. Tomonlar buyurtma tafsilotlarini Platforma orqali yoki qonuniy boshqa aloqa vositalari orqali kelishishlari mumkin.',
      '10.5. Buyurtmaning qabul qilinganligi Platformadagi tegishli status, bildirishnoma yoki boshqa elektron tasdiq orqali qayd etilishi mumkin.',
    ],
  },
  {
    title: '11. Geolokatsiya va bildirishnomalar',
    body: [
      '11.1. Foydalanuvchi roziligi va qurilma sozlamalariga muvofiq Platforma geolokatsiya ma’lumotlaridan foydalanishi mumkin.',
      '11.2. Platforma yaqin hududdagi ish yoki xizmat imkoniyatlari haqida bildirishnoma yuborishi mumkin.',
      '11.3. Foydalanuvchi qurilmasidagi bildirishnomalarni istalgan vaqtda o‘chirishi mumkin, agar qonunchilik yoki xizmatning zarur texnik funksiyasi bundan mustasno bo‘lmasa.',
    ],
  },
  {
    title: '12. Foydalanuvchi akkaunti',
    body: [
      '12.1. Foydalanuvchi ro‘yxatdan o‘tishda taqdim etgan ma’lumotlarining haqqoniyligi uchun javobgar.',
      '12.2. Foydalanuvchi o‘z login, parol, telefon raqami yoki boshqa autentifikatsiya ma’lumotlarini uchinchi shaxslarga bermasligi kerak.',
      '12.3. Akkauntdan amalga oshirilgan harakatlar, agar akkaunt xavfsizligi buzilgani haqida PROSTAFFga o‘z vaqtida xabar berilmagan bo‘lsa, tegishli Foydalanuvchi tomonidan amalga oshirilgan deb hisoblanishi mumkin.',
    ],
  },
  {
    title: '13. Taqiqlangan harakatlar',
    body: [
      'Foydalanuvchiga quyidagilar taqiqlanadi:',
      '13.1. Yolg‘on ma’lumot joylashtirish.',
      '13.2. Boshqa shaxs nomidan akkaunt ochish yoki undan foydalanish.',
      '13.3. Firibgarlik yoki boshqa noqonuniy faoliyat uchun Platformadan foydalanish.',
      '13.4. Boshqa Foydalanuvchilarning shaxsiy ma’lumotlarini noqonuniy yig‘ish yoki tarqatish.',
      '13.5. Platformaning texnik tizimiga zarar yetkazishga urinish.',
      '13.6. Spam, zararli dastur yoki noqonuniy kontent tarqatish.',
      '13.7. Boshqa Foydalanuvchilarni aldash, tahdid qilish yoki ta’qib qilish.',
      '13.8. Platformadan qonunchilikka zid bo‘lgan har qanday maqsadda foydalanish.',
    ],
  },
  {
    title: '14. Tomonlarning javobgarligi',
    body: [
      '14.1. Har bir Foydalanuvchi o‘zi taqdim etgan ma’lumotlarning haqqoniyligi uchun javobgar.',
      '14.2. Ishchi o‘zi bajargan ish yoki ko‘rsatgan xizmat sifati uchun tegishli qonunchilik va Mijoz bilan tuzilgan kelishuv doirasida javobgar.',
      '14.3. Xizmat ko‘rsatuvchi firma o‘zi ko‘rsatgan xizmat, uning sifati, xavfsizligi va qonunchilikka muvofiqligi uchun javobgar.',
      '14.4. Mijoz o‘z tomonidan berilgan buyurtma, taqdim etilgan ma’lumotlar va kelishilgan to‘lovlar uchun javobgar.',
      '14.5. PROSTAFF Foydalanuvchilar o‘rtasida tuzilgan alohida ish yoki xizmat kelishuvining bajarilishi uchun, qonunchilikda yoki alohida shartnomada PROSTAFF zimmasiga bunday javobgarlik yuklatilgan hollar bundan mustasno, bevosita javobgar emas.',
      '14.6. PROSTAFF Platformadagi ma’lumotlarning Foydalanuvchilar tomonidan buzib ko‘rsatilishi, noto‘g‘ri ma’lumot berilishi yoki Foydalanuvchilar o‘rtasidagi kelishuv bajarilmasligi uchun, o‘zining qonuniy majburiyatlari doirasidan tashqarida javobgar emas.',
    ],
  },
  {
    title: '15. Nizolarni hal qilish',
    body: [
      '15.1. Ishchi va Mijoz o‘rtasidagi nizolar, avvalo, ular o‘rtasida muzokara yo‘li bilan hal qilinadi.',
      '15.2. Firma va Mijoz o‘rtasidagi nizolar tegishli tomonlar o‘rtasida hal qilinadi.',
      '15.3. PROSTAFF zarur hollarda texnik ma’lumotlarni taqdim etish yoki Platformadagi murojaatlarni ko‘rib chiqish orqali nizoni tinch yo‘l bilan hal qilishga ko‘maklashishi mumkin.',
      '15.4. Nizo muzokara orqali hal qilinmasa, u O‘zbekiston Respublikasi qonunchiligida belgilangan tartibda ko‘rib chiqiladi.',
    ],
  },
  {
    title: '16. Shaxsiy ma’lumotlar',
    body: [
      '16.1. Foydalanuvchi Platformadan foydalanish jarayonida o‘zining shaxsiy ma’lumotlarini taqdim etishi mumkin.',
      '16.2. Foydalanuvchining shaxsiy ma’lumotlari PROSTAFF tomonidan qonunchilik va Platformaning Maxfiylik siyosatiga muvofiq qayta ishlanadi.',
      '16.3. Foydalanuvchi Platformadan foydalanishdan oldin Maxfiylik siyosati bilan tanishishi kerak.',
      '16.4. Foydalanuvchi o‘z ma’lumotlarini yangilash yoki qonunchilikda nazarda tutilgan hollarda ulardan foydalanish bo‘yicha murojaat qilish huquqiga ega.',
    ],
  },
  {
    title: '17. Platformadagi ma’lumotlar',
    body: [
      '17.1. Foydalanuvchilar Platformaga joylashtiradigan ma’lumotlar qonuniy, haqqoniy va boshqa shaxslarning huquqlarini buzmaydigan bo‘lishi kerak.',
      '17.2. PROSTAFF qonunchilikka yoki Platforma qoidalariga zid bo‘lgan kontentni olib tashlash yoki unga kirishni cheklash huquqiga ega.',
      '17.3. Foydalanuvchi Platformaga joylashtirgan ma’lumotlardan foydalanish bo‘yicha zarur huquqlarga ega ekanligini kafolatlaydi.',
    ],
  },
  {
    title: '18. Akkauntni bloklash',
    body: [
      '18.1. PROSTAFF quyidagi hollarda akkauntni vaqtincha to‘xtatishi yoki bloklashi mumkin:',
      '— Oferta shartlari buzilganda;',
      '— yolg‘on ma’lumot taqdim etilganda;',
      '— noqonuniy faoliyat aniqlanganda;',
      '— boshqa Foydalanuvchilarning xavfsizligiga tahdid tug‘ilganda;',
      '— Platformaga texnik zarar yetkazishga urinish bo‘lganda;',
      '— qonunchilik talabiga binoan.',
      '18.2. Zarur hollarda PROSTAFF bloklash sababini Foydalanuvchiga ma’lum qiladi.',
    ],
  },
  {
    title: '19. Intellektual mulk',
    body: [
      '19.1. PROSTAFF nomi, logotipi, dizayni, dasturiy ta’minoti, interfeysi va Platformaga tegishli boshqa materiallar Operatorning yoki tegishli huquq egalarining intellektual mulki hisoblanadi.',
      '19.2. Ularni Operatorning ruxsatisiz nusxalash, tarqatish, o‘zgartirish yoki tijorat maqsadida foydalanish taqiqlanadi.',
    ],
  },
  {
    title: '20. Platformaning texnik ishlashi',
    body: [
      '20.1. PROSTAFF Platformani imkon qadar uzluksiz ishlatishga harakat qiladi.',
      '20.2. Texnik xizmat ko‘rsatish, yangilash, aloqa tarmoqlaridagi nosozliklar yoki PROSTAFF nazoratidan tashqaridagi texnik sabablar tufayli Platforma vaqtincha ishlamasligi mumkin.',
      '20.3. PROSTAFF xavfsizlik, texnik xizmat yoki qonunchilik talablaridan kelib chiqib Platformaning ayrim funksiyalarini vaqtincha cheklashi mumkin.',
    ],
  },
  {
    title: '21. Ofertaga o‘zgartirishlar',
    body: [
      '21.1. PROSTAFF ushbu Oferta shartlariga o‘zgartirish va qo‘shimchalar kiritish huquqiga ega.',
      '21.2. O‘zgartirilgan Oferta Platformada e’lon qilingan kundan boshlab, unda boshqa sana ko‘rsatilmagan bo‘lsa, amal qiladi.',
      '21.3. Foydalanuvchi o‘zgartirilgan shartlar bilan rozi bo‘lmasa, Platformadan foydalanishni to‘xtatishi mumkin.',
      '21.4. Qonunchilikda majburiy ravishda oldindan xabardor qilish muddati belgilangan hollarda PROSTAFF tegishli muddatlarga rioya qiladi.',
    ],
  },
  {
    title: '22. Ofertani qabul qilish',
    body: [
      '22.1. Foydalanuvchi quyidagilar orqali Oferta shartlarini to‘liq va so‘zsiz qabul qilgan hisoblanadi, agar Platformada tegishli elektron tasdiqlash mexanizmi mavjud bo‘lsa:',
      '— «Ro‘yxatdan o‘tish»;',
      '— «Qabul qilaman»;',
      '— «Tasdiqlash»;',
      '— buyurtma joylashtirish;',
      '— ish yoki buyurtmani qabul qilish;',
      '— Platformadan Oferta shartlariga muvofiq foydalanishni boshlash.',
      '22.2. Oferta shartlarini qabul qilish orqali Foydalanuvchi ushbu Oferta bilan tanishganini va uning shartlariga rozi ekanligini tasdiqlaydi.',
      '22.3. Elektron aksept shartnoma tuzilganligini tasdiqlovchi elektron ma’lumot sifatida Platforma tizimida qayd etilishi mumkin.',
    ],
  },
  {
    title: '23. Ofertaning amal qilishi va bekor qilinishi',
    body: [
      '23.1. Ushbu Oferta Foydalanuvchi tomonidan aksept qilingan paytdan boshlab amal qiladi.',
      '23.2. Foydalanuvchi Platformadan foydalanishni to‘xtatish orqali kelgusida Platformadan foydalanishni bekor qilishi mumkin.',
      '23.3. Foydalanuvchining oldin yuzaga kelgan to‘lov, javobgarlik yoki boshqa majburiyatlari, agar qonunchilik yoki tegishli kelishuvda boshqacha belgilanmagan bo‘lsa, avtomatik ravishda bekor bo‘lmaydi.',
    ],
  },
  {
    title: '24. Yakuniy qoidalar',
    body: [
      '24.1. Ushbu Oferta O‘zbekiston Respublikasi qonunchiligiga muvofiq qo‘llaniladi.',
      '24.2. Oferta bilan tartibga solinmagan masalalar O‘zbekiston Respublikasi qonunchiligiga muvofiq hal qilinadi.',
      '24.3. Agar Oferta qoidalarining biror qismi haqiqiy emas deb topilsa, qolgan qoidalar o‘z kuchida qoladi.',
      '24.4. Foydalanuvchi Platformadan foydalanishni davom ettirish orqali Oferta va Platformaning amaldagi qoidalariga rioya qilish majburiyatini oladi.',
    ],
  },
  {
    title: '25. Rekvizitlar va bog‘lanish',
    body: [
      `Platforma: ${OFFER_OPERATOR.name}`,
      `Telefon: ${OFFER_OPERATOR.phone}`,
      `Telegram: ${OFFER_OPERATOR.telegram}`,
      'Murojaatlar ish kunlari 9:00–18:00 oralig‘ida qabul qilinadi va imkon qadar tez javob beriladi.',
    ],
  },
];
