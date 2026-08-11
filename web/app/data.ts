export type SurpriseBag = {
  id: string;
  store: string;
  title: string;
  category: "Fırın" | "Market" | "Kafe" | "Restoran";
  image: string;
  distance: string;
  pickup: string;
  rating: number;
  reviews: number;
  originalPrice: number;
  price: number;
  left: number;
  description: string;
  address: string;
};

export const surpriseBags: SurpriseBag[] = [
  {
    id: "bag_istanbul_firin_01",
    store: "Moda Fırını",
    title: "Günün Fırın Paketi",
    category: "Fırın",
    image: "/images/bag-bakery.jpg",
    distance: "850 m",
    pickup: "20:00–20:30",
    rating: 4.8,
    reviews: 186,
    originalPrice: 420,
    price: 139,
    left: 3,
    description:
      "Gün içinde hazırlanan kruvasan, ekşi mayalı ekmek ve tatlılardan oluşan sürpriz paket.",
    address: "Caferağa Mah. Moda Cad. No:44, Kadıköy",
  },
  {
    id: "bag_besiktas_market_02",
    store: "Mahalle Manavı",
    title: "Taze Sebze & Meyve",
    category: "Market",
    image: "/images/bag-market.jpg",
    distance: "1,2 km",
    pickup: "19:30–21:00",
    rating: 4.6,
    reviews: 94,
    originalPrice: 350,
    price: 109,
    left: 5,
    description:
      "Görünümü kusursuz olmayabilir ama lezzeti yerinde mevsim sebze ve meyveleri.",
    address: "Sinanpaşa Mah. Şair Nedim Cad. No:18, Beşiktaş",
  },
  {
    id: "bag_karakoy_cafe_03",
    store: "Kök Kahve",
    title: "Kahve Yanı Sürprizi",
    category: "Kafe",
    image: "/images/bag-croissant.jpg",
    distance: "2,4 km",
    pickup: "21:00–21:30",
    rating: 4.9,
    reviews: 241,
    originalPrice: 390,
    price: 129,
    left: 2,
    description:
      "Kapanışa doğru tezgahta kalan günlük kruvasan, sandviç ve tatlı seçenekleri.",
    address: "Kemankeş Karamustafapaşa Mah. No:7, Karaköy",
  },
  {
    id: "bag_bakirkoy_patisserie_04",
    store: "Mimoza Pastanesi",
    title: "Tatlı Kurtarma Paketi",
    category: "Fırın",
    image: "/images/bag-pastries.jpg",
    distance: "3,1 km",
    pickup: "20:30–21:30",
    rating: 4.7,
    reviews: 132,
    originalPrice: 480,
    price: 149,
    left: 4,
    description:
      "Günlük üretimden kalan kek, kurabiye ve porsiyon tatlılardan seçki.",
    address: "Zeytinlik Mah. Yakut Sok. No:12, Bakırköy",
  },
];

export const dashboardOrders = [
  { id: "YP-1048", customer: "Eylül K.", bag: "Günün Fırın Paketi", time: "20:00", status: "Hazırlanıyor", amount: 139 },
  { id: "YP-1047", customer: "Deniz A.", bag: "Günün Fırın Paketi", time: "20:00", status: "Teslim edildi", amount: 139 },
  { id: "YP-1046", customer: "Mert D.", bag: "Kahve Yanı Sürprizi", time: "19:30", status: "Bekliyor", amount: 129 },
  { id: "YP-1045", customer: "Selin Y.", bag: "Taze Sebze & Meyve", time: "19:30", status: "Teslim edildi", amount: 109 },
];

export const faqItems = [
  {
    question: "Surprise Bag'in içinde ne olduğunu önceden görebilir miyim?",
    answer:
      "Paketin kategorisini ve örnek içeriğini görürsün; tam içerik işletmenin o gün elinde kalan taze ürünlere göre değişir.",
  },
  {
    question: "Paketi ne zaman teslim alabilirim?",
    answer:
      "Her paketin detayında net bir teslim alma aralığı bulunur. Doğrulama kaydırıcısı yalnızca bu zaman aralığında aktif olur.",
  },
  {
    question: "Siparişi arkadaşım teslim alabilir mi?",
    answer:
      "Evet. Aktif sipariş ekranındaki 'Arkadaşıma gönder' bağlantısı ile tek kullanımlık teslim kodunu paylaşabilirsin.",
  },
  {
    question: "İşletmeler ödemelerini nasıl alır?",
    answer:
      "Satışlar işletme panelinde raporlanır. Komisyon ve iadeler düşüldükten sonra hakedişler aylık olarak işletmeye aktarılır.",
  },
];

