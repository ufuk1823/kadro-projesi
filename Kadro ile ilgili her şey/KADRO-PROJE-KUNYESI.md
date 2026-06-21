# KADRO.ORG — PROJE KÜNYESİ VE TEKNİK ŞARTNAME

> **Bu belge ne işe yarar?** Bu dosya, Kadro.org projesinin tüm mantığını, kurallarını, alınan kararları, mevcut teknik kurulumu ve kaldığımız yeri tek bir yerde toplar. Yeni bir sohbette bir yapay zekaya bu dosyayı verirsen, projeyi sıfırdan anlatmana gerek kalmaz — okur ve kaldığı yerden devam edebilir.
>
> **Yapay zekaya not:** Bu projenin sahibi teknik biri değil. Açıklamaları sade tut, adım adım ilerle, "ufak ufak" inşa et. Kod bilgisi varsaymadan yönlendir.

---

## 1. PROJE NEDİR?

**Kadro.org** (sahip olunan alan adı: **kadro.org.tr**), İzmir merkezli bir **vatandaş bildirim platformu**. Amaç: insanların mahallelerindeki aksaklıkları **konumlu fotoğraflarla** bildirip biriktirmesi, böylece veriye dayalı bir **kamuoyu baskısı** oluşturulması (örn. belediyeye karşı).

Üç ana proje (kategori) var:
1. **Bozuk Yollar** — yol/asfalt hasarları, çukurlar
2. **Çevresel Temizlik** — çevre kirliliği tespiti
3. **Genel Aksaklıklar** — kırık banklar, bozuk sokak lambaları, hasarlı kaldırımlar, eksik/kırık levhalar

---

## 2. ÇEKİRDEK MEKANİKLER (DEĞİŞMEZ KURALLAR)

Bu kurallar projenin kalbidir, dokümanlarda ve eski kodda tanımlıdır:

### 2.1. 15 Metre / Tekil Sorun Noktası Kuralı
- Bir gönüllü konumlu foto çekince sistem GPS'i alır ve mevcut kayıtlarla mesafeyi karşılaştırır.
- **15 metre** içinde zaten bir kayıt varsa yeni nokta açılmaz; kişi var olan noktaya **dahil edilir**.
- Amaç: spam ve veri tekrarını önlemek, moderatör yükünü azaltmak, raporu sade tutmak.
- Kod sabiti: `DUPLICATE_RADIUS_METERS = 15`

### 2.2. 3 Fotoğraf Kuralı
- Bir sorun noktası için en fazla **1 ana + 2 yedek = 3 fotoğraf** saklanır.
- İlk yükleyenin fotoğrafı varsayılan **ana foto** olur.
- 3 foto dolduktan sonra gelenler **foto yükleyemez**, sadece **"Bildir"** yapabilir.
- Kod sabiti: `nearbyPhotoCount < 3`

### 2.3. Bildiren Kişi Sayısı (Ağırlık)
- Bir noktanın "ağırlığı" = o noktayı bildiren **benzersiz kişi sayısı** (foto yükleyen + sadece "Bildir" diyen toplamı).
- Örnek: 3 fotoğraflı + 39 fotoğrafsız bildirim = **"42 kişi bildirdi"**.
- Bu sayı fotoğraf sayısı değil, toplam farklı kişi sayısıdır.

### 2.4. Günlük İşlem Limiti
- **Günlük limit = 3** (KARAR: bu sohbette netleşti. Eski kodda 10 idi, 3 olarak değiştirilecek.)
- Kod sabiti olacak: `USER_DAILY_LIMIT = 3`

### 2.5. Isı Haritası Dairesi (Yoğunluk) — GÜNCEL FORMÜL
- Her sorun noktası haritada kırmızı bir daire ile gösterilir; çap, bildiren kişi sayısına göre **logaritmik** büyür.
- **Alt limit: 15 m, Üst limit: 70 m.** Sonsuza büyümez.
- **GÜNCEL formül:** `Çap = min( 15 + 55 × log(kişi_sayısı) / log(100) , 70 )`
- **1 kişi = 15 m** (taban), **100 kişi = 70 m**'de sabitlenir (100 ve üzeri hep 70 m).
- Yaklaşık değerler: `1→15`, `2→23`, `5→34`, `10→42.5`, `20→50`, `50→61.7`, `100→70`, `500→70` m.
- Mantık: 1→2 kişi artışı önemlidir; 50→51 fark yaratmaz; sistem sonsuza büyümez; harita okunabilir kalır.
- Kod sabitleri: `MIN_R = 15`, `MAX_R = 70`, doygunluk noktası = 100 kişi.
- **NOT:** Eski formül `ln(1+kişi)/ln(43)` idi ve 42 kişide tavanlıyordu; "1 kişi=15m" tabanını gerçekten vermiyordu. Yukarıdaki yeni formülle (`log(kişi)/log(100)`, 100 kişide tavan) **değiştirildi.** Bu yeni formül 1 kişide tam 15 m verir.

### 2.6. Fotoğraf İşleme
- Çekilen foto **1024 px genişliğe** küçültülür (`PHOTO_MAX_WIDTH = 1024`), JPEG ~0.8 kalite.
- **KARAR (kritik):** Foto **yalnızca canlı kameradan** çekilebilir, **galeriden yükleme YASAK**. Bunun için `<input type="file">` yerine sayfa içi canlı kamera (`getUserMedia`) kullanılır. Böylece galeri seçimi teknik olarak imkânsız olur ve fotonun "şu an, o konumda" çekildiği garantilenir.

### 2.7. Konum Zorunluluğu (Kapı)
- Bildirim için konum **zorunludur**. Konum kapalıysa kamera hiç açılmaz.
- Gösterilecek mesaj: **"Bildirim yapmak için konumunuzu açmalısınız."**

### 2.8. İsteğe Bağlı Not
- Vatandaş fotoğrafı çektikten sonra, göndermeden (tik/✓) hemen önce küçük bir pencere açılır.
- Pencerede not alanı: **"Notunuz varsa iletebilirsiniz"** + **"isteğe bağlı"** etiketi. Zorunlu değil.

---

## 3. ÜYELİK VE MAHALLE DOĞRULAMA SİSTEMİ

Bu, projenin "güven katmanı"dır. **Önemli: Eski prototipte bu sistem YOK** — eski kod kimseyi tanımıyor, herkes localStorage'daki rastgele bir cihaz ID'siyle her yere bildirim atabiliyordu. Hedeflenen sistem şudur:

- **Gezinme serbest:** Siteyi gezmek, ısı haritasına bakmak, gündemleri görmek için **giriş gerekmez.**
- **Giriş = Üyelik:** Yalnızca bir **katkı yapılacağı anda** (konumlu foto, bildirim, gündem oluşturma) **Google ile giriş** istenir. Ayrı bir "üye ol" formu yoktur. İlk Google girişi otomatik üyelik oluşturur; sonraki girişler sadece "son giriş" zamanını günceller.
- **Mahalle ataması:** Üyenin mahallesi, kayıt sırasında değil, **ilk konumlu fotoğrafı çektiği GPS noktasının düştüğü mahalle polygonuna göre** atanır.
- **Mahalle zorlaması:** Sonraki tüm görevlerde GPS, üyenin mahalle polygonu içindeyse kabul; dışındaysa **ret**. (Sınır verisi yoksa kural devre dışı, süreci moderatör yürütür.)
- **Adres değişikliği:** Ayda **1 kez**, fiziksel olarak orada olmak (GPS) şartıyla.
- **Eski katkı temizliği:** Üye mahalle değiştirince, eski mahalledeki tüm bireysel katkıları (foto, bildirim, oy) o mahallenin istatistiklerinden **silinir**. İlke: "bir kişi aynı anda iki mahalleyi etkileyemez."

### 3.1. Üyelik / Adres (Gündem dokümanından netleşen)
- Üye olurken İl/İlçe/Mahalle bilgisinin **konum açarak** otomatik çekilir

- **Adres değişimi: ayda 1 kez** (sürekli adres değiştirip farklı mahallelerin gündemini provoke etmeyi engellemek için).

### 3.2. Konum Doğrulama Zinciri (oy/başlık/bildirim için ortak)
- Bir üye kendi mahallesinde işlem (oy/destek/başlık/bildirim) yapacağı zaman **konum açması zorunlu.**
- **Mahalle polygon/sınır verisi varsa** → konum doğrudan mahalle sınırına göre doğrulanır.
- **Mahalle polygonu yoksa** → geçici olarak **ilçe** bazlı doğrulama.
- **İlçe de yoksa** → **il** bazlı doğrulama (desteği kabul edilir).
- Örnek: İzmir/Konak/Alsancak başlığına destek; Alsancak polygonu yoksa kullanıcının Konak ilçesinde olup olmadığına bakılır.
- (Bu kademeli yöntem, kaliteli mahalle sınır verileri elde edilene kadar **geçici** doğrulama mekanizmasıdır.)

---

## 3.B. GÜNDEM (BAŞLIK) SİSTEMİ

Fotoğraflı saha bildirimlerinden **ayrı** ikinci bir ana sütun: vatandaşların mahalle özelinde **metin başlıkları** (gündem maddeleri) açıp birbirine destek verdiği, popüler olanların ana gündeme yükseldiği sistem.

### İki Bölüm
- **Gündem Adayları** ve **Ana Gündem** olmak üzere 2 bölüm var.
- Açılan **tüm başlıklar önce "Gündem Adayları"** bölümüne düşer.
- Bir aday başlık, açıldığı mahalledeki **toplam üye sayısının %10'u** kadar destek alırsa **Ana Gündem**'e yükselir.
  - Örnek: Alsancak'ta 100 üye varsa, bir başlığa **10 kişi** destek verince ana gündeme çıkar.

### Başlık Açma Kuralları
- Üye olan herkes **kendi il / ilçe / mahallesi özelinde** başlık açabilir.
- **Günde 1 başlık** açma sınırı (her üye, il/ilçe/mahalle özelinde günde 1 adet — spam tedbiri).

### Destek (Oy) Kuralları
- Her mahalle **yalnızca kendi bünyesindeki başlıklara** destek verebilir; başka mahallede açılmış başlığa müdahale edemez.
- Oylar **yalnızca konum eşleşmesi** olduğu sürece geçerlidir. Örn. Alsancak'a üye biri Silifke'deyse oy kullanamaz, başlık açamaz. (Doğrulama için Bölüm 3.2'deki polygon→ilçe→il zinciri kullanılır.)

### Görsel: Kırmızı Renk Skalası
- Başlıkların önemi **kırmızı renk skalasıyla** gösterilir: başlık **beyaz kutucukla** başlar, destek arttıkça **koyu kırmızıya** doğru gider.
- Kırmızılık derecesi, **mahallenin toplam üye sayısına oranla** belirlenir.
  - Örnek: mahallede 1000 üye varsa, 100 destek (%10) → hafif kırmızı; 900 destek → epey koyu kırmızı.

---

## 4. ZİP İÇİNDEKİ 4 HTML DOSYASININ MEKANİKLERİ (ESKİ PROTOTİP / v28–v33)

Gönderilen `kadro.zip` içinde 4 dosya vardı. Hepsi tek-dosya (HTML+CSS+JS gömülü) yapıdaydı.

### 4.1. `kadro.html` (~120 KB) — HUB / GİRİŞ EKRANI
- "YAPISAL ÇÖZÜMLER PROJELERİ" başlıklı ana sayfa.
- 3 proje kartı: Bozuk Yollar, Çevresel Temizlik, Genel Aksaklıklar.
- Karta tıklanınca animasyonlu geçiş: **"KADRO SAHA GÖREVİ AÇILIYOR"** → ilgili proje sayfasına yönlendirir.
- Kart görselleri Unsplash'ten dış link; logo gömülü base64.
- **KARAR:** Hub ve geçiş animasyonu **olduğu gibi kalacak.**

### 4.2 / 4.3 / 4.4. Proje Sayfaları (ORTAK MOTOR)
`bozuk-yollar.html` (~3.3 MB), `cevresel-temizlik.html` (~850 KB), `genel-aksakliklar.html` (~1.1 MB) — üçü de **aynı v28 tabanlı motorun varyantı**. Üçünde de birebir AYNI olan parçalar:

- **Firebase:** proje `kadro-org`, modüler SDK **v12.12.1**.
- **Eski koleksiyon:** `kadro_tasks`, alt koleksiyon `records` → yol: `kadro_tasks/{taskId}/records/{kayıt}`.
- **taskId üretimi:** `slug(il)-slug(ilçe)-slug(mahalle)-PROJEDEĞERİ` (örn. `izmir-konak-alsancak-bozuk-yol`). Buradaki "proje" kısmı dropdown'daki **etiket değil, `<option value>` değeridir.**
- **Harita:** Leaflet + OpenStreetMap.
- **Mahalle sınırı (fallback zinciri):** İzmir Kent Rehberi resmî CBS (ArcGIS, `kentrehberi.izmir.bel.tr`) → olmazsa OSM polygon → olmazsa mahalle/ilçe/il merkezine düşen kademeli yedekleme.
- **15 m kuralı, 3 foto limiti, logaritmik yoğunluk daireleri, günlük kota (eski: 10), 1024px küçültme** — hepsi yukarıdaki Bölüm 2'deki gibi.
- **Canlı rapor:** Firestore `onSnapshot` ile herkese canlı yayın.
- **Demo seed/clear:** "Demo verileri yükle" gibi herkese açık butonlar; Alsancak'a özel ~20-30 fotoğraflık demo veriyi `kadro_tasks`'a yazıyordu.
- **il/ilçe/mahalle verisi:** GitHub'daki bir `il_ilce_mahalle.json`'dan çekilip localStorage'a cacheleniyor.
- **Cihaz kimliği:** localStorage'da rastgele UUID (gerçek auth YOK).
- **Sokak adı:** Nominatim ters-geocode.
- **Moderatör paneli:** Vatandaş sadece ana fotoğrafı görür; yedekler (ana fotodan farklı, en fazla 2) yalnızca moderatör panelinde listelenir; moderatör "Ana foto yap" ile herhangi bir yedeği ana foto yapabilir (`setMainPhoto`, kaydın `moderatorMainPhoto` alanını günceller).

### 4.5. BULUNAN HATALAR (eski prototipte)
1. **`sokak-lambasi` anahtar çakışması (KRİTİK):** `cevresel-temizlik.html`'deki "Çevre Kirliliği Tespiti" seçeneğinin iç değeri `sokak-lambasi` olarak bırakılmış. Ama `bozuk-yollar` ve `genel-aksakliklar` sayfalarında da `sokak-lambasi` değeri var ("Bozuk Sokak Lambası" anlamında). Sonuç: çevre kirliliği bildirimleri ile sokak lambası bildirimleri aynı `...-sokak-lambasi` taskId kutusuna düşüp **birbirine karışır.** (Düzeltilecek.)
2. **Yanıltıcı fonksiyon adı:** Her sayfada `isAlsancakBozukYolSelected` adlı fonksiyon var ama içeride farklı projeyi kontrol ediyor — kopyala-yapıştır kalıntısı.
3. **Kod tekrarı:** Aynı ~900 satırlık motor 3 dosyada birebir tekrarlanıyor → her düzeltmeyi 3 kez yapmak gerekiyor. (İleride tek ortak motora indirilmeli.)
4. **Güvenlik:** Firebase config açıkta (istemci tarafı için normal), kota localStorage'da (silinince sıfırlanır), cihaz ID localStorage'da → "42 kişi bildirdi" sayısı teorik olarak şişirilebilir. Güven katmanı (Bölüm 3) tam da bunu çözmek için.

---

## 5. FIREBASE KURULUMU (BU SOHBETTE YAPILDI)

### 5.1. Gerçek Firebase Config (kadro-org)
```js
const firebaseConfig = {
  apiKey: "AIzaSyAPYVDL5o8PZMxNCHlulRktClrc74U0CEA",
  authDomain: "kadro-org.firebaseapp.com",
  projectId: "kadro-org",
  storageBucket: "kadro-org.firebasestorage.app",
  messagingSenderId: "976664604968",
  appId: "1:976664604968:web:733c514283d69848bea01d",
  measurementId: "G-LR3C2K6H6T"
};
```
- Proje sahibi hesap: **kadro.sivilhareketi@gmail.com**
- Plan: **Spark (ücretsiz)**. Firebase Storage kullanılMAZ (Blaze ister); fotoğraflar **base64 olarak doğrudan Firestore dokümanına** yazılır (1024px foto, 1 MB doküman sınırının altında kalır).

### 5.2. Yeni Veri Modeli (eski demoya dokunmadan)
```
kadro-org (Firestore)
├── kadro_tasks/      ← ESKİ DEMO. Dokunulmuyor.
├── reports/          ← YENİ. Her bildirim bir doküman.
│      { projectId, lat, lon, street, note, photo(base64), uid, userName, createdAt }
└── users/{uid}       ← YENİ. Google ile giriş yapan üyeler.
       { uid, name, email, photoURL, neighborhood:null, createdAt, lastLoginAt }
```
- `reports` ve `users` koleksiyonları elle açılmaz; kod ilk kayıtta otomatik oluşturur.

### 5.3. Tamamlanan Konsol Ayarları
- **Authentication → Google girişi: AÇIK** (Enabled). Destek e-postası seçildi.
- **Firestore → Rules: YAYINLANDI.** Yayınlanan kurallar:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /kadro_tasks/{doc=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /reports/{id} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## 6. YENİDEN İNŞA EDİLEN VATANDAŞ SAYFASI (MEVCUT DURUM)

Bozuk Yollar için yeni, sade vatandaş bildirim sayfası inşa edildi (`index.html` / `kadro-bozuk-yollar.html`):

- **Tasarım:** Koyu tema, mobil öncelikli. En üstte **KADRO.ORG**, altında değişmez metin *"Mahallenizde bakım ve onarım gerektiren yolları bildirebilirsiniz."*, sonra hi-vis amber buton *"📷 Fotoğraf Çek ve Konumu Kaydet"*. (Sahip "tasarım pazarlama sitesi gibi olmuş, şimdilik DOKUNMA, ileride güncelleriz" dedi — öncelik mekanik.)
- **Akış:** Buton → Google girişi (üye değilse) → konum kapısı (kapalıysa uyarı) → **canlı kamera** (galeri yok) → foto çek → isteğe bağlı not penceresi → "✓ Gönder".
- **Kayıt:** Bildirim Firestore `reports` koleksiyonuna gerçek olarak yazılıyor; ilk girişte `users/{uid}` oluşturuluyor.
- **Teknik:** Firebase modüler SDK v12.12.1, `getUserMedia` canlı kamera, `signInWithPopup` Google girişi, Nominatim ters-geocode.
- **Sabit iki metin (asla değişmez):** "Mahallenizde bakım ve onarım gerektiren yolları bildirebilirsiniz." ve "Fotoğraf Çek ve Konumu Kaydet".

### Test gerçeği (önemli)
Canlı kamera, konum ve Google girişi **yalnızca https üzerinden ve gerçek telefonda** çalışır. `file://` (dosyaya çift tıklama) ile çalışmaz. Bilgisayarda yerel test için `python -m http.server` + `localhost` kullanılabilir ama mobil test için canlı bir link gerekir.

---

## 7. YAYINA ALMA (HOSTING) DURUMU

- **Hedef (uzun vade):** Firebase Hosting + kadro.org.tr alan adını bağlamak (merkezi, ücretsiz, `.web.app` adresi Google girişinde otomatik izinli).
- **Sorun:** Firebase CLI (`firebase login`) bu bilgisayarda Google giriş köprüsünde sürekli takıldı (localhost 400 / "credentials no longer valid" hataları). Node.js + firebase-tools kuruldu ve çalışıyor; sorun yalnızca CLI giriş köprüsü.
- **GEÇİCİ ÇÖZÜM / AKTİF PLAN:** **Netlify Drop** (https://app.netlify.com/drop) ile `index.html`'i sürükle-bırak → `https://...netlify.app` linki al → o linki **Firebase Console → Authentication → Settings → Authorized domains**'e ekle (yoksa Google girişi reddedilir) → telefondan test et + arkadaşa gönder.
- **Hiçbir şey satın alınmasına gerek YOK.** VPS gerekmez. Domain (kadro.org.tr) deneme için şart değil; `.netlify.app` veya `.web.app` adresi yeterli.

---

## 8. YOL HARİTASI (SIRADAKİ TUĞLALAR — HENÜZ YAPILMADI)

1. **Yayına alma:** Netlify Drop ile canlı linki almak ve telefonda uçtan uca testi tamamlamak (giriş + foto + Firestore'a kayıt).
2. **Mahalle polygon ataması:** İlk konumlu fotoğrafta üyeye mahalle atamak (`users/{uid}.neighborhood`).
3. **Mahalle sınır zorlaması:** Bildirimi sadece üyenin mahallesi içinde kabul etmek.
4. **15 m gruplama + 3 foto + günlük 3 limit** kurallarını yeni `reports` akışına bağlamak (şu an `submitReport` düz ekleme yapıyor; bu mantık eklenecek).
5. **Isı haritası:** `reports` verisini Leaflet üzerinde logaritmik yoğunluk daireleriyle göstermek.
6. **Moderatör paneli:** Yedek fotoğraflardan ana foto seçimi.
7. **"Bildir" akışı:** 3 fotodan sonra fotosuz bildirim (bildiren kişi sayısını artırma).
8. **Adres değişikliği (30 gün) + eski katkı temizliği.**
9. **Diğer iki sayfa:** Aynı şablonu Çevresel Temizlik ve Genel Aksaklıklar için çıkarmak.
10. **`sokak-lambasi` çakışmasını düzeltmek** ve 3 dosyadaki tekrarlı motoru tek ortak yapıya indirmek.
11. **Güven sertleştirmesi:** Sunucu tarafı sayım, kota, sıkı kurallar.
12. **Gündem (Başlık) sistemi:** Başlık açma (günde 1, il/ilçe/mahalle özelinde), Gündem Adayları → Ana Gündem (%10 destek eşiği), konum-eşleşmeli destek/oy, kırmızı renk skalası (üye sayısına oranla).
13. **Üyelik akışı:** kayıt (adres / konumla otomatik), ayda 1 adres değişimi, konum doğrulama zinciri (polygon → ilçe → il).
14. **Mahalle üye sayısı sayacı:** %10 eşiği ve renk skalası için her mahallenin toplam üye sayısının tutulması.

---

## 9. SAHİBİNİN TERCİHLERİ / ÇALIŞMA TARZI

- Adım adım, "ufak ufak" ilerlemeyi tercih ediyor.
- Teknik/kod bilgisi yok; komut satırı ve geliştirici araçları konusunda yönlendirme gerekiyor.
- Önce **çalışan mekanik**, sonra tasarım güzelleştirme.
- Hız önemli (sınırlı oturum süresi olabiliyor); gereksiz tekrar ve uzun açıklamalardan kaçınılmalı.
- Türkçe konuşuluyor.

---

*Bu künye, projenin o ana kadarki durumunu yansıtır. Yeni gelişmelerde güncellenmelidir.*
