enum BagCategory {
  all('Tümü'),
  bakery('Fırın'),
  market('Market'),
  cafe('Kafe'),
  restaurant('Restoran');

  const BagCategory(this.label);
  final String label;
}

class SurpriseBag {
  const SurpriseBag({
    required this.id,
    required this.store,
    required this.title,
    required this.category,
    required this.imageAsset,
    required this.distanceKm,
    required this.pickupLabel,
    required this.rating,
    required this.reviewCount,
    required this.originalPrice,
    required this.price,
    required this.availableQuantity,
    required this.description,
    required this.address,
  });

  final String id;
  final String store;
  final String title;
  final BagCategory category;
  final String imageAsset;
  final double distanceKm;
  final String pickupLabel;
  final double rating;
  final int reviewCount;
  final int originalPrice;
  final int price;
  final int availableQuantity;
  final String description;
  final String address;
}

enum OrderStatus { paid, pickupPending, collected, cancelled, refunded }

class AppOrder {
  const AppOrder({
    required this.id,
    required this.orderNo,
    required this.bag,
    required this.quantity,
    required this.total,
    required this.status,
    required this.pickupLabel,
  });

  final String id;
  final String orderNo;
  final SurpriseBag bag;
  final int quantity;
  final int total;
  final OrderStatus status;
  final String pickupLabel;

  AppOrder copyWith({OrderStatus? status}) => AppOrder(
    id: id,
    orderNo: orderNo,
    bag: bag,
    quantity: quantity,
    total: total,
    status: status ?? this.status,
    pickupLabel: pickupLabel,
  );
}

class UserImpact {
  const UserImpact({
    required this.savedBags,
    required this.moneySaved,
    required this.co2Kg,
    required this.waterLiters,
  });

  final int savedBags;
  final int moneySaved;
  final double co2Kg;
  final int waterLiters;
}
