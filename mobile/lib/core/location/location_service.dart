import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Kullanıcının konumu ve izin durumu.
class UserLocation {
  const UserLocation({
    required this.latitude,
    required this.longitude,
    this.label,
  });

  final double latitude;
  final double longitude;

  /// "Kadıköy, İstanbul" gibi okunabilir ad. Bilinmiyorsa `null`.
  final String? label;

  UserLocation withLabel(String? value) =>
      UserLocation(latitude: latitude, longitude: longitude, label: value);
}

/// Konum izninin sonucu.
enum LocationOutcome {
  /// Konum alındı.
  granted,

  /// Kullanıcı bu sefer reddetti; tekrar sorulabilir.
  denied,

  /// Kullanıcı kalıcı olarak reddetti; yalnızca ayarlardan açılabilir.
  deniedForever,

  /// Cihazın konum servisi kapalı.
  serviceDisabled,

  /// Konum alınamadı (zaman aşımı, donanım hatası).
  failed,
}

/// Cihaz konumu.
///
/// **Neden gerekli:** Ürünün temel vaadi "mahallendeki paketler". Konum
/// olmadan sunucu mesafe hesaplayamaz, "en yakın" sıralaması sessizce puana
/// göre sıralamaya düşer ve kartlarda mesafe hiç görünmez. Uygulama daha önce
/// konumu hiç istemiyordu; sunucudaki PostGIS yakınlık sorgusu boşa
/// çalışıyordu.
///
/// **İzin verilmezse:** Uygulama çalışmaya devam eder. Sunucu konumsuz da
/// sonuç döndürür (şehir geneli), yalnızca mesafe ve yakınlık sıralaması
/// olmaz. Bu yüzden hiçbir ekran izin verilmediği için kilitlenmez.
class LocationService {
  /// Son bilinen konum, uygulama yeniden açıldığında hemen kullanılabilsin
  /// diye saklanır: GPS ilk sabitlenmesi birkaç saniye sürer ve o süre
  /// boyunca liste konumsuz gelirdi.
  static const _latKey = 'last_location_lat';
  static const _lngKey = 'last_location_lng';
  static const _labelKey = 'last_location_label';

  UserLocation? _cached;

  UserLocation? get cached => _cached;

  /// Diskten son bilinen konumu okur. Ağ veya izin gerektirmez.
  Future<UserLocation?> restore() async {
    if (_cached != null) return _cached;

    final prefs = await SharedPreferences.getInstance();
    final lat = prefs.getDouble(_latKey);
    final lng = prefs.getDouble(_lngKey);
    if (lat == null || lng == null) return null;

    _cached = UserLocation(
      latitude: lat,
      longitude: lng,
      label: prefs.getString(_labelKey),
    );
    return _cached;
  }

  /// İzni kontrol eder ve konumu alır.
  ///
  /// [askIfDenied] false ise izin daha önce verilmemişse sistem penceresi
  /// gösterilmez — açılışta kullanıcıyı karşılamadan izin sormamak için.
  Future<(LocationOutcome, UserLocation?)> current({
    bool askIfDenied = true,
  }) async {
    if (kIsWeb) {
      // Tarayıcı derlemesi yalnızca doğrulama içindir.
      return (LocationOutcome.serviceDisabled, await restore());
    }

    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return (LocationOutcome.serviceDisabled, await restore());
      }

      var permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        if (!askIfDenied) return (LocationOutcome.denied, await restore());
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        return (LocationOutcome.deniedForever, await restore());
      }

      if (permission == LocationPermission.denied) {
        return (LocationOutcome.denied, await restore());
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          // Paket listelemede metre hassasiyeti gereksiz; düşük doğruluk
          // hem daha hızlı sabitlenir hem pili daha az tüketir.
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      );

      final location = UserLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        label: _cached?.label,
      );

      await _persist(location);
      return (LocationOutcome.granted, location);
    } catch (error) {
      // Zaman aşımı en yaygın sebep (kapalı alanda GPS sabitlenemez).
      // Son bilinen konumla devam etmek, hiç sonuç göstermemekten iyidir.
      if (kDebugMode) debugPrint('[konum] alınamadı: $error');
      return (LocationOutcome.failed, await restore());
    }
  }

  /// Sunucudan gelen okunabilir adı saklar (ilçe/il).
  Future<void> setLabel(String? label) async {
    final location = _cached;
    if (location == null) return;

    _cached = location.withLabel(label);
    await _persist(_cached!);
  }

  /// Kullanıcıyı sistem ayarlarına götürür (kalıcı ret durumunda).
  Future<void> openSettings() => Geolocator.openAppSettings();

  Future<void> _persist(UserLocation location) async {
    _cached = location;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_latKey, location.latitude);
    await prefs.setDouble(_lngKey, location.longitude);

    if (location.label != null) {
      await prefs.setString(_labelKey, location.label!);
    }
  }
}
